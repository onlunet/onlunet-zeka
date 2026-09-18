import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) !== 0) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

export function createZipFromDirectory(sourceDir, options = {}) {
  const root = path.resolve(sourceDir);
  if (!fs.existsSync(root)) {
    throw new Error('ZIP Source directory not found: ' + sourceDir);
  }

  const excludes = options.excludes || ['node_modules', '.git', '.DS_Store', 'Thumbs.db'];
  const entries = [];

  function walk(currentDir) {
    const files = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const f of files) {
      if (excludes.includes(f.name)) continue;
      const fullPath = path.join(currentDir, f.name);
      if (f.isDirectory()) {
        walk(fullPath);
      } else if (f.isFile()) {
        const relPath = path.relative(root, fullPath).replace(/\\/g, '/');
        const data = fs.readFileSync(fullPath);
        entries.push({ relPath, data });
      }
    }
  }

  walk(root);
  return createZipFromEntries(entries);
}

export function createZipFromEntries(entries = []) {
  const localHeaders = [];
  const centralHeaders = [];
  let currentOffset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.relPath, 'utf-8');
    const rawData = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || '', 'utf-8');
    
    const deflated = zlib.deflateRawSync(rawData, { level: 6 });
    const isCompressed = deflated.length < rawData.length;
    const finalData = isCompressed ? deflated : rawData;
    const compMethod = isCompressed ? 8 : 0;
    const fileCrc = crc32(rawData);

    const dosTime = 0x6000;
    const dosDate = 0x5D30;

    const localHdr = Buffer.alloc(30 + nameBuf.length);
    localHdr.writeUInt32LE(0x04034B50, 0);
    localHdr.writeUInt16LE(20, 4);
    localHdr.writeUInt16LE(0x0800, 6);
    localHdr.writeUInt16LE(compMethod, 8);
    localHdr.writeUInt16LE(dosTime, 10);
    localHdr.writeUInt16LE(dosDate, 12);
    localHdr.writeUInt32LE(fileCrc, 14);
    localHdr.writeUInt32LE(finalData.length, 18);
    localHdr.writeUInt32LE(rawData.length, 22);
    localHdr.writeUInt16LE(nameBuf.length, 26);
    localHdr.writeUInt16LE(0, 28);
    nameBuf.copy(localHdr, 30);

    localHeaders.push(localHdr, finalData);

    const centralHdr = Buffer.alloc(46 + nameBuf.length);
    centralHdr.writeUInt32LE(0x02014B50, 0);
    centralHdr.writeUInt16LE(20, 4);
    centralHdr.writeUInt16LE(20, 6);
    centralHdr.writeUInt16LE(0x0800, 8);
    centralHdr.writeUInt16LE(compMethod, 10);
    centralHdr.writeUInt16LE(dosTime, 12);
    centralHdr.writeUInt16LE(dosDate, 14);
    centralHdr.writeUInt32LE(fileCrc, 16);
    centralHdr.writeUInt32LE(finalData.length, 20);
    centralHdr.writeUInt32LE(rawData.length, 24);
    centralHdr.writeUInt16LE(nameBuf.length, 28);
    centralHdr.writeUInt16LE(0, 30);
    centralHdr.writeUInt16LE(0, 32);
    centralHdr.writeUInt16LE(0, 34);
    centralHdr.writeUInt16LE(0, 36);
    centralHdr.writeUInt32LE(0, 38);
    centralHdr.writeUInt32LE(currentOffset, 42);
    nameBuf.copy(centralHdr, 46);

    centralHeaders.push(centralHdr);
    currentOffset += localHdr.length + finalData.length;
  }

  const centralDirBuffer = Buffer.concat(centralHeaders);
  const centralDirOffset = currentOffset;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054B50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirBuffer.length, 12);
  eocd.writeUInt32LE(centralDirOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, centralDirBuffer, eocd]);
}