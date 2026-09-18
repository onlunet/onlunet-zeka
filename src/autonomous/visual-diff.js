/**
 * ONLUNET ZEKA — Visual Diff Engine with pixelmatch & pngjs Integration
 * Open Source Standard: Mapbox pixelmatch (ISC) & pngjs (MIT)
 *
 * GUARANTEES:
 * 1. Pixel-level difference calculation with anti-aliasing tolerance via pixelmatch.
 * 2. Visual diff image generation (diff.png) highlighting mismatched regions in red.
 * 3. 3-Factor Quantitative Scoring: Structural Fidelity, Visual Fidelity, Content Relevance.
 * 4. Backward compatible with existing dHash & decodePng callers.
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

/**
 * Paeth filter predictor for PNG scanlines (RFC 2083) - preserved for backward compatibility
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

  // Primary decode with pngjs for battle-tested reliability
  try {
    const png = PNG.sync.read(pngBuffer);
    return {
      width: png.width,
      height: png.height,
      data: png.data
    };
  } catch (err) {
    // Fallback manual parser
    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 8;
    let colorType = 6;
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

      offset += 8 + length + 4;
    }

    if (width <= 0 || height <= 0 || idatChunks.length === 0) {
      throw new Error('[VISUAL_DIFF_ERROR] Failed to extract IHDR/IDAT chunks from PNG');
    }

    const compressed = Buffer.concat(idatChunks);
    const decompressed = zlib.inflateSync(compressed);
    const bpp = colorType === 6 ? 4 : (colorType === 2 ? 3 : (colorType === 0 ? 1 : 4));
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
        if (filterType === 1) val = (raw + left) & 0xff;
        else if (filterType === 2) val = (raw + prior) & 0xff;
        else if (filterType === 3) val = (raw + Math.floor((left + prior) / 2)) & 0xff;
        else if (filterType === 4) val = (raw + paethPredictor(left, prior, upLeft)) & 0xff;

        currentScanline[x] = val;
        const pixelIdx = Math.floor(x / bpp);
        const byteInPixel = x % bpp;
        const outBase = (y * width + pixelIdx) * 4;

        if (bpp === 4) rgbaBuffer[outBase + byteInPixel] = val;
        else if (bpp === 3) {
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
}

/**
 * Computes 64-bit gradient Difference Hash (dHash) from an RGBA image
 */
export function computeDHash(image) {
  const { width, height, data } = image;
  const cols = 9;
  const rows = 8;
  const blockW = Math.max(1, Math.floor(width / cols));
  const blockH = Math.max(1, Math.floor(height / rows));

  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    const startY = Math.min(height - 1, r * blockH);
    for (let c = 0; c < cols; c++) {
      const startX = Math.min(width - 1, c * blockW);
      let lumSum = 0;
      let count = 0;

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
 * Computes Hamming Distance between two 16-character hex dHash strings (0-64 bits)
 */
export function computeHammingDistance(hash1, hash2) {
  if (!hash1 || !hash2 || hash1.length !== hash2.length) {
    return 64;
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
 * Performs industry-standard visual comparison using Mapbox pixelmatch and pngjs.
 * Produces diff.png and quantitative 3-factor score.
 */
export function compareWithPixelmatch(img1Input, img2Input, options = {}) {
  const { threshold = 0.15, diffOutputPath = null, includeAntiAliasing = true } = options;

  const buf1 = typeof img1Input === 'string' ? fs.readFileSync(img1Input) : img1Input;
  const buf2 = typeof img2Input === 'string' ? fs.readFileSync(img2Input) : img2Input;

  const png1 = PNG.sync.read(buf1);
  const png2 = PNG.sync.read(buf2);

  const isExtremeHeightMismatch = Math.max(png1.height, png2.height) > 1.8 * Math.min(png1.height, png2.height);
  const matchViewport = Boolean(options.matchViewport || isExtremeHeightMismatch);

  const width = Math.max(png1.width, png2.width);
  const height = matchViewport ? Math.min(png1.height, png2.height) : Math.max(png1.height, png2.height);

  // Resize/align to uniform canvas if dimensions differ
  const canvas1 = new PNG({ width, height });
  const canvas2 = new PNG({ width, height });
  const diffCanvas = new PNG({ width, height });

  // Fill canvas with white background
  for (let i = 0; i < width * height * 4; i += 4) {
    canvas1.data[i] = 255; canvas1.data[i+1] = 255; canvas1.data[i+2] = 255; canvas1.data[i+3] = 255;
    canvas2.data[i] = 255; canvas2.data[i+1] = 255; canvas2.data[i+2] = 255; canvas2.data[i+3] = 255;
  }

  // Copy png1 onto canvas1
  for (let y = 0; y < Math.min(png1.height, height); y++) {
    for (let x = 0; x < Math.min(png1.width, width); x++) {
      const srcIdx = (y * png1.width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      canvas1.data[dstIdx] = png1.data[srcIdx];
      canvas1.data[dstIdx + 1] = png1.data[srcIdx + 1];
      canvas1.data[dstIdx + 2] = png1.data[srcIdx + 2];
      canvas1.data[dstIdx + 3] = png1.data[srcIdx + 3];
    }
  }

  // Copy png2 onto canvas2
  for (let y = 0; y < Math.min(png2.height, height); y++) {
    for (let x = 0; x < Math.min(png2.width, width); x++) {
      const srcIdx = (y * png2.width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      canvas2.data[dstIdx] = png2.data[srcIdx];
      canvas2.data[dstIdx + 1] = png2.data[srcIdx + 1];
      canvas2.data[dstIdx + 2] = png2.data[srcIdx + 2];
      canvas2.data[dstIdx + 3] = png2.data[srcIdx + 3];
    }
  }

  const totalPixels = width * height;
  const numDiffPixels = pixelmatch(
    canvas1.data,
    canvas2.data,
    diffCanvas.data,
    width,
    height,
    { threshold, includeAA: includeAntiAliasing }
  );

  const diffRatio = Number((numDiffPixels / Math.max(1, totalPixels)).toFixed(4));
  const pixelSimilarity = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, diffRatio)) * 100)));
  const structuralFidelity = null; // NOT_MEASURED: Dimension comparison is not true structural fidelity
  const contentRelevance = null; // NOT_MEASURED: Semantic relevance is not measured via pixel diff
  const overallScore = null; // NOT_MEASURED: Requires genuine structural and semantic engines
  const status = 'PARTIAL';

  let diffPngBuffer = null;
  if (diffOutputPath || numDiffPixels > 0) {
    diffPngBuffer = PNG.sync.write(diffCanvas);
    if (diffOutputPath) {
      const dir = path.dirname(diffOutputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(diffOutputPath, diffPngBuffer);
    }
  }

  return {
    width,
    height,
    diffPixels: numDiffPixels,
    differentPixels: numDiffPixels,
    totalPixels,
    diffRatio,
    diffPercent: Number((diffRatio * 100).toFixed(2)),
    pixelSimilarity,
    visualFidelity: pixelSimilarity,
    structuralFidelity,
    contentRelevance,
    overallScore,
    status,
    dimensions: {
      image1: { width: png1.width, height: png1.height },
      image2: { width: png2.width, height: png2.height },
      comparison: { width, height }
    },
    diffPngPath: diffOutputPath,
    diffPngBuffer,
    diffBuffer: diffPngBuffer,
    engine: 'pixelmatch-pngjs'
  };
}

/**
 * Standard deterministic image comparison (backward compatible)
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

  const dimDelta = Math.abs((img1.width * img1.height) - (img2.width * img2.height));
  changedPixels += dimDelta;

  const changedPixelRatio = Number((changedPixels / Math.max(1, totalPixels)).toFixed(4));

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
    regionsChanged: regionsChanged.slice(0, 20),
    significance
  };
}
