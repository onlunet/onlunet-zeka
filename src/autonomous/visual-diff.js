/**
 * ONLUNET ZEKA — Pure Node.js Visual Diff & Perceptual Hashing Engine
 * FAZ 71: Deterministic Image Comparison, dHash & Changed Region Detection
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES:
 * Uses native Node.js core modules only (node:zlib, node:fs, node:buffer).
 *
 * GUARANTEES:
 * 1. Pixel-level difference calculation with anti-aliasing jitter tolerance.
 * 2. 64-bit gradient Difference Hash (dHash) and Hamming distance.
 * 3. Spatial bounding box clustering for changed regions.
 * 4. Tolerance for responsive rendering and font rasterization differences.
 */

import fs from 'node:fs';
import zlib from 'node:zlib';

/**
 * Paeth filter predictor for PNG scanlines (RFC 2083)
 */
function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decodes PNG buffer into raw RGBA pixel buffer and dimensions in pure Node.js
 *
 * @param {Buffer} pngBuffer
 * @returns {{ width: number, height: number, data: Buffer }}
 */
export function decodePng(pngBuffer) {
  if (!pngBuffer || !Buffer.isBuffer(pngBuffer) || pngBuffer.length < 8) {
    throw new Error('[VISUAL_DIFF_ERROR] Invalid PNG buffer');
  }

  // Check PNG magic bytes
  const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!pngBuffer.subarray(0, 8).equals(PNG_HEADER)) {
    throw new Error('[VISUAL_DIFF_ERROR] Buffer does not contain valid PNG magic bytes');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6; // 6 = RGBA, 2 = RGB
  const idatChunks = [];

  while (offset < pngBuffer.length) {
    if (offset + 8 > pngBuffer.length) break;
    const length = pngBuffer.readUInt32BE(offset);
    const type = pngBuffer.subarray(offset + 4, offset + 8).toString('ascii');
    const chunkData = pngBuffer.subarray(offset + 8, offset + 8 + length);

    if (type === 'IHDR') {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8];
      colorType = chunkData[9];
    } else if (type === 'IDAT') {
      idatChunks.push(chunkData);
    } else if (type === 'IEND') {
      break;
    }

    offset += 8 + length + 4; // length + type + data + 4-byte CRC
  }

  if (width <= 0 || height <= 0 || idatChunks.length === 0) {
    throw new Error('[VISUAL_DIFF_ERROR] Failed to extract IHDR/IDAT chunks from PNG');
  }

  // Decompress IDAT stream
  const compressed = Buffer.concat(idatChunks);
  const decompressed = zlib.inflateSync(compressed);

  const bpp = colorType === 6 ? 4 : (colorType === 2 ? 3 : (colorType === 0 ? 1 : 4));
  const scanlineLength = 1 + width * bpp;
  const rgbaBuffer = Buffer.alloc(width * height * 4);

  let inOffset = 0;
  let prevScanline = Buffer.alloc(width * bpp);

  for (let y = 0; y < height; y++) {
    if (inOffset >= decompressed.length) break;
    const filterType = decompressed[inOffset++];
    const currentScanline = Buffer.alloc(width * bpp);

    for (let x = 0; x < width * bpp; x++) {
      const raw = decompressed[inOffset++];
      const left = x >= bpp ? currentScanline[x - bpp] : 0;
      const prior = prevScanline[x];
      const upLeft = x >= bpp ? prevScanline[x - bpp] : 0;

      let val = raw;
      if (filterType === 1) { // Sub
        val = (raw + left) & 0xff;
      } else if (filterType === 2) { // Up
        val = (raw + prior) & 0xff;
      } else if (filterType === 3) { // Average
        val = (raw + Math.floor((left + prior) / 2)) & 0xff;
      } else if (filterType === 4) { // Paeth
        val = (raw + paethPredictor(left, prior, upLeft)) & 0xff;
      }

      currentScanline[x] = val;

      // Map to target RGBA buffer
      const pixelIdx = Math.floor(x / bpp);
      const byteInPixel = x % bpp;
      const outBase = (y * width + pixelIdx) * 4;

      if (bpp === 4) {
        rgbaBuffer[outBase + byteInPixel] = val;
      } else if (bpp === 3) {
        rgbaBuffer[outBase + byteInPixel] = val;
        rgbaBuffer[outBase + 3] = 255;
      } else if (bpp === 1) {
        rgbaBuffer[outBase + 0] = val;
        rgbaBuffer[outBase + 1] = val;
        rgbaBuffer[outBase + 2] = val;
        rgbaBuffer[outBase + 3] = 255;
      }
    }

    prevScanline = currentScanline;
  }

  return { width, height, data: rgbaBuffer };
}

/**
 * Computes 64-bit gradient Difference Hash (dHash) from an RGBA image
 * Downsamples to 9x8 grayscale grid and compares horizontal adjacent gradients.
 *
 * @param {{ width: number, height: number, data: Buffer }} image
 * @returns {string} 16-character hexadecimal dHash string
 */
export function computeDHash(image) {
  const { width, height, data } = image;
  const cols = 9;
  const rows = 8;
  const blockW = Math.max(1, Math.floor(width / cols));
  const blockH = Math.max(1, Math.floor(height / rows));

  // 1. Downsample to 9x8 grayscale grid
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    const startY = Math.min(height - 1, r * blockH);
    for (let c = 0; c < cols; c++) {
      const startX = Math.min(width - 1, c * blockW);
      let lumSum = 0;
      let count = 0;

      // Sample pixels in block
      for (let y = startY; y < Math.min(height, startY + blockH); y += 2) {
        for (let x = startX; x < Math.min(width, startX + blockW); x += 2) {
          const idx = (y * width + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          lumSum += lum;
          count++;
        }
      }

      row.push(count > 0 ? lumSum / count : 128);
    }
    grid.push(row);
  }

  // 2. Compute difference bits (P[x] > P[x+1]) -> 8 bits per row, 64 bits total
  let hashHex = '';
  for (let r = 0; r < rows; r++) {
    let byteVal = 0;
    for (let c = 0; c < 8; c++) {
      if (grid[r][c] > grid[r][c + 1]) {
        byteVal |= (1 << (7 - c));
      }
    }
    hashHex += byteVal.toString(16).padStart(2, '0');
  }

  return hashHex;
}

/**
 * Computes Hamming distance between two hex hash strings
 *
 * @param {string} hash1
 * @param {string} hash2
 * @returns {number} Hamming distance (number of differing bits)
 */
export function computeHammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return 64; // Max distance on length mismatch
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const n1 = parseInt(hash1[i], 16);
    const n2 = parseInt(hash2[i], 16);
    let xor = n1 ^ n2;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

/**
 * Compares two PNG images deterministically:
 * Returns changed pixel ratio, perceptual distance, changed regions, and significance.
 *
 * @param {Buffer|string} img1Input - Buffer or filepath of baseline image
 * @param {Buffer|string} img2Input - Buffer or filepath of current image
 * @param {Object} [options]
 * @param {number} [options.colorTolerance=18] - Per-channel delta tolerance for anti-aliasing
 * @param {number} [options.blockSize=32] - Grid cell size for changed region clustering
 * @returns {Object} Structured diff report
 */
export function compareImages(img1Input, img2Input, options = {}) {
  const { colorTolerance = 18, blockSize = 32 } = options;

  const buf1 = typeof img1Input === 'string' ? fs.readFileSync(img1Input) : img1Input;
  const buf2 = typeof img2Input === 'string' ? fs.readFileSync(img2Input) : img2Input;

  const img1 = decodePng(buf1);
  const img2 = decodePng(buf2);

  const hash1 = computeDHash(img1);
  const hash2 = computeDHash(img2);
  const perceptualDistance = computeHammingDistance(hash1, hash2);

  const compWidth = Math.min(img1.width, img2.width);
  const compHeight = Math.min(img1.height, img2.height);
  const totalPixels = Math.max(img1.width * img1.height, img2.width * img2.height);

  let changedPixels = 0;
  const dirtyBlocks = new Map();

  for (let y = 0; y < compHeight; y++) {
    for (let x = 0; x < compWidth; x++) {
      const idx1 = (y * img1.width + x) * 4;
      const idx2 = (y * img2.width + x) * 4;

      const dr = Math.abs(img1.data[idx1] - img2.data[idx2]);
      const dg = Math.abs(img1.data[idx1 + 1] - img2.data[idx2 + 1]);
      const db = Math.abs(img1.data[idx1 + 2] - img2.data[idx2 + 2]);

      if (dr > colorTolerance || dg > colorTolerance || db > colorTolerance) {
        changedPixels++;
        const bx = Math.floor(x / blockSize);
        const by = Math.floor(y / blockSize);
        const key = `${bx}:${by}`;
        dirtyBlocks.set(key, { bx, by });
      }
    }
  }

  // Add difference in dimensions if height or width differ
  const dimDelta = Math.abs((img1.width * img1.height) - (img2.width * img2.height));
  changedPixels += dimDelta;

  const changedPixelRatio = Number((changedPixels / Math.max(1, totalPixels)).toFixed(4));

  // Cluster dirty blocks into changed bounding boxes
  const regionsChanged = [];
  const visited = new Set();

  for (const [key, b] of dirtyBlocks.entries()) {
    if (visited.has(key)) continue;
    visited.add(key);

    let minBx = b.bx;
    let maxBx = b.bx;
    let minBy = b.by;
    let maxBy = b.by;

    const queue = [b];
    while (queue.length > 0) {
      const curr = queue.shift();
      const neighbors = [
        `${curr.bx + 1}:${curr.by}`,
        `${curr.bx - 1}:${curr.by}`,
        `${curr.bx}:${curr.by + 1}`,
        `${curr.bx}:${curr.by - 1}`
      ];

      for (const nKey of neighbors) {
        if (dirtyBlocks.has(nKey) && !visited.has(nKey)) {
          visited.add(nKey);
          const nb = dirtyBlocks.get(nKey);
          minBx = Math.min(minBx, nb.bx);
          maxBx = Math.max(maxBx, nb.bx);
          minBy = Math.min(minBy, nb.by);
          maxBy = Math.max(maxBy, nb.by);
          queue.push(nb);
        }
      }
    }

    regionsChanged.push({
      x: minBx * blockSize,
      y: minBy * blockSize,
      width: (maxBx - minBx + 1) * blockSize,
      height: (maxBy - minBy + 1) * blockSize
    });
  }

  // Classify significance
  let significance = 'none';
  if (changedPixelRatio === 0 && perceptualDistance === 0) {
    significance = 'none';
  } else if (changedPixelRatio < 0.01 && perceptualDistance <= 3) {
    significance = 'low';
  } else if (changedPixelRatio < 0.08 && perceptualDistance <= 10) {
    significance = 'medium';
  } else if (changedPixelRatio < 0.25 || perceptualDistance <= 22) {
    significance = 'high';
  } else {
    significance = 'critical';
  }

  return {
    changedPixelRatio,
    perceptualDistance,
    hashBaseline: hash1,
    hashCurrent: hash2,
    dimensions: {
      baseline: { width: img1.width, height: img1.height },
      current: { width: img2.width, height: img2.height }
    },
    regionsChanged: regionsChanged.slice(0, 20), // Bound max regions reported
    significance
  };
}
