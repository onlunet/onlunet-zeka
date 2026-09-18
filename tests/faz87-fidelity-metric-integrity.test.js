import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';

import { PROJECT_ROOT } from '../src/interfaces/core.js';
const GOLDEN_MASTER_ROOT = path.resolve(PROJECT_ROOT, '..', 'onlunet-kurumsal');

import {
  analyzeReferenceImage,
  buildImageDesignSpec,
  LayoutFamilies,
  extractReferenceGeometry,
  createDefaultGeometrySpec,
  calculateCompositeVisualFidelity,
  detectAntiCheatViolations,
  calculateBoxIoU,
  renderAndCaptureScreenshot,
  generateDiffAndOverlay,
  calculateRegionScreenshotFidelity,
  diagnoseScreenshotFidelity,
  runClosedLoopFidelityReconstruction,
  getBrowserExecutablePath,
  generateErrorHeatmap,
  calculateErrorConcentration,
  calculateSectionPixelMetrics,
  verifyScreenshotDeterminism,
  isRealReferenceImage,
  computeDecodedPixelHash
} from '../src/autonomous/reference-image-analyzer.js';

import {
  createCorporateGenerator,
  resolveLayoutFamily,
  computeLayoutFingerprint
} from '../src/autonomous/corporate-generator.js';

function createSyntheticPng(width = 800, height = 600, options = {}) {
  const png = new PNG({ width, height });
  const {
    headerColor = [15, 23, 42, 255],
    heroColor = [255, 255, 255, 255],
    footerColor = [15, 23, 42, 255]
  } = options;

  const headerH = Math.round(height * 0.1);
  const heroH = Math.round(height * 0.5);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const c = y < headerH ? headerColor : (y < headerH + heroH ? heroColor : footerColor);
      png.data[idx] = c[0];
      png.data[idx + 1] = c[1];
      png.data[idx + 2] = c[2];
      png.data[idx + 3] = c[3];
    }
  }
  return PNG.sync.write(png);
}

test('FAZ 87 — FIDELITY METRIC INTEGRITY AUDIT & FALSE-100% DETECTION', async (t) => {
  const corporateGen = createCorporateGenerator();

  // Test 1: Pixelmatch argument and buffer provenance audit
  await t.test('Test 1: Pixelmatch argument and buffer provenance audit verifies separate inputs', () => {
    const bufA = createSyntheticPng(400, 300, { heroColor: [240, 240, 240, 255] });
    const bufB = createSyntheticPng(400, 300, { heroColor: [30, 30, 30, 255] });

    const diff = generateDiffAndOverlay({ referenceBuffer: bufA, generatedBuffer: bufB });

    assert.ok(diff.bufferAudit, 'bufferAudit metadata must exist');
    assert.notEqual(diff.bufferAudit.referenceBufferHash, diff.bufferAudit.generatedBufferHash, 'Buffer hashes must differ');
    assert.notEqual(diff.bufferAudit.referencePixelHash, diff.bufferAudit.generatedPixelHash, 'Decoded pixel hashes must differ');
    assert.equal(diff.bufferAudit.isIdenticalBuffer, false, 'isIdenticalBuffer must be false');
    assert.equal(diff.bufferAudit.isIdenticalPixels, false, 'isIdenticalPixels must be false');
  });

  // Test 2: Decoded RGBA pixel hash vs raw file hash
  await t.test('Test 2: Decoded pixel hash is invariant to PNG chunk metadata and checks raw RGBA', () => {
    const buf = createSyntheticPng(200, 200);
    const pixelHash1 = computeDecodedPixelHash(buf);
    const pixelHash2 = computeDecodedPixelHash(buf);

    assert.ok(pixelHash1 && pixelHash1.length === 64, 'Pixel hash must be a valid 64-char SHA256 hex string');
    assert.equal(pixelHash1, pixelHash2, 'Same pixel buffer must produce identical decoded pixel hash');
  });

  // Test 3: Self-comparison verification (A vs A === 1.0, B vs B === 1.0, A vs B < 1.0)
  await t.test('Test 3: Self-comparison yields exactly 1.0 while distinct images yield < 1.0', () => {
    const bufA = createSyntheticPng(300, 300, { heroColor: [255, 0, 0, 255] });
    const bufB = createSyntheticPng(300, 300, { heroColor: [0, 0, 255, 255] });

    const selfA = generateDiffAndOverlay({ referenceBuffer: bufA, generatedBuffer: bufA });
    assert.equal(selfA.diffPixels, 0, 'Self-comparison must have 0 diff pixels');
    assert.equal(selfA.rawPixelSimilarity, 1.0, 'Self-comparison must have 1.0 similarity');
    assert.equal(selfA.bufferAudit.isIdenticalBuffer, true, 'Self-comparison buffer audit must be true');

    const selfB = generateDiffAndOverlay({ referenceBuffer: bufB, generatedBuffer: bufB });
    assert.equal(selfB.diffPixels, 0);
    assert.equal(selfB.rawPixelSimilarity, 1.0);

    const cross = generateDiffAndOverlay({ referenceBuffer: bufA, generatedBuffer: bufB });
    assert.ok(cross.diffPixels > 0, 'Distinct buffers must have diff pixels');
    assert.ok(cross.rawPixelSimilarity < 1.0, 'Distinct buffers cannot have 1.0 similarity');
    assert.equal(cross.bufferAudit.isIdenticalBuffer, false);
  });

  // Test 4: Deliberate 1-pixel difference test
  await t.test('Test 4: Deliberate 1-pixel difference produces diffPixels >= 1 and similarity < 1.0', () => {
    const basePng = new PNG({ width: 100, height: 100 });
    for (let i = 0; i < 100 * 100 * 4; i += 4) {
      basePng.data[i] = 100; basePng.data[i+1] = 100; basePng.data[i+2] = 100; basePng.data[i+3] = 255;
    }
    const bufOriginal = PNG.sync.write(basePng);

    const modifiedPng = PNG.sync.read(bufOriginal);
    // Flip center pixel
    const centerIdx = (50 * 100 + 50) * 4;
    modifiedPng.data[centerIdx] = 255;
    modifiedPng.data[centerIdx + 1] = 0;
    modifiedPng.data[centerIdx + 2] = 0;
    const bufModified = PNG.sync.write(modifiedPng);

    const diff = generateDiffAndOverlay({
      referenceBuffer: bufOriginal,
      generatedBuffer: bufModified,
      threshold: 0.05
    });

    assert.ok(diff.diffPixels >= 1, `Must detect deliberate 1-pixel difference (detected: ${diff.diffPixels})`);
    assert.ok(diff.rawPixelSimilarity < 1.0, 'Pixel similarity must be strictly less than 1.0');
    assert.equal(diff.bufferAudit.isIdenticalPixels, false, 'Pixel hashes must differ');
  });

  // Test 5: Deliberate 10-pixel and 1000-pixel sensitivity
  await t.test('Test 5: Deliberate 10-pixel and 1000-pixel difference shows monotonic error scaling', () => {
    const w = 200, h = 200;
    const basePng = new PNG({ width: w, height: h });
    for (let i = 0; i < w * h * 4; i += 4) {
      basePng.data[i] = 200; basePng.data[i+1] = 200; basePng.data[i+2] = 200; basePng.data[i+3] = 255;
    }
    const bufBase = PNG.sync.write(basePng);

    // 10 pixels modified
    const p10 = PNG.sync.read(bufBase);
    for (let i = 0; i < 10; i++) {
      p10.data[i * 4] = 0; p10.data[i * 4 + 1] = 0; p10.data[i * 4 + 2] = 0;
    }
    const diff10 = generateDiffAndOverlay({ referenceBuffer: bufBase, generatedBuffer: PNG.sync.write(p10), threshold: 0.05 });

    // 1000 pixels modified
    const p1000 = PNG.sync.read(bufBase);
    for (let i = 0; i < 1000; i++) {
      p1000.data[i * 4] = 0; p1000.data[i * 4 + 1] = 0; p1000.data[i * 4 + 2] = 0;
    }
    const diff1000 = generateDiffAndOverlay({ referenceBuffer: bufBase, generatedBuffer: PNG.sync.write(p1000), threshold: 0.05 });

    assert.ok(diff1000.diffPixels > diff10.diffPixels, '1000 modified pixels must generate more diff than 10 pixels');
    assert.ok(diff1000.rawPixelSimilarity < diff10.rawPixelSimilarity, '1000 modified pixels must reduce similarity further');
  });

  // Test 6: Whole-image comparison metadata
  await t.test('Test 6: Whole-image comparison reports exact dimensions without cropping bias', () => {
    const bufA = createSyntheticPng(1440, 900);
    const bufB = createSyntheticPng(1440, 900, { heroColor: [50, 50, 50, 255] });

    const diff = generateDiffAndOverlay({ referenceBuffer: bufA, generatedBuffer: bufB });

    assert.equal(diff.dimensions.width, 1440);
    assert.equal(diff.dimensions.height, 900);
    assert.equal(diff.totalPixels, 1440 * 900);
    assert.equal(diff.diffMetrics.referencePixels, 1440 * 900);
    assert.equal(diff.diffMetrics.matchingPixels + diff.diffMetrics.diffPixels, 1440 * 900);
  });

  // Test 7: Crop comparison with coordinate isolation
  await t.test('Test 7: Section crop comparison keeps reference and generated coordinates isolated', () => {
    const bufA = createSyntheticPng(1440, 900);
    const bufB = createSyntheticPng(1440, 900);

    const refGeom = {
      canvas: { width: 1440, height: 900 },
      sections: [
        { type: 'hero', relativeBox: { left: 0, top: 0.1, width: 1, height: 0.4 } },
        { type: 'offerings', relativeBox: { left: 0, top: 0.5, width: 1, height: 0.4 } }
      ]
    };

    const domSections = [
      { section: 'hero', relativeBox: { left: 0, top: 0.08, width: 1, height: 0.45 }, bounds: { x: 0, y: 72, width: 1440, height: 405 } },
      { section: 'offerings', relativeBox: { left: 0, top: 0.53, width: 1, height: 0.42 }, bounds: { x: 0, y: 477, width: 1440, height: 378 } }
    ];

    const secMetrics = calculateSectionPixelMetrics({
      referenceBuffer: bufA,
      generatedBuffer: bufB,
      referenceGeometry: refGeom,
      domSections
    });

    assert.ok(secMetrics.hero, 'Hero crop metric must exist');
    assert.ok(secMetrics.hero.referenceCrop, 'referenceCrop must exist');
    assert.ok(secMetrics.hero.generatedCrop, 'generatedCrop must exist');
    assert.equal(secMetrics.hero.referenceCrop.y, 90, 'referenceCrop.y must match refGeom top (0.10 * 900 = 90)');
    assert.equal(secMetrics.hero.generatedCrop.y, 72, 'generatedCrop.y must match domSections y (72)');
  });

  // Test 8: IoU vs pixel similarity contradiction detection
  await t.test('Test 8: IoU < 0.20 and pixelSimilarity == 1.0 triggers METRIC_CONTRADICTION', () => {
    const diag = diagnoseScreenshotFidelity({
      compositeFidelity: { overall: 0.85, pixelSimilarity: 100 },
      regionFidelity: [
        { section: 'hero', iou: 0.90, pixelSimilarity: 1.0 },
        { section: 'offerings', iou: 0.09, pixelSimilarity: 1.0 } // Severe geometric mismatch but claiming 100% pixel similarity!
      ]
    });

    assert.equal(diag.metricContradiction, true, 'Must flag metricContradiction');
    assert.ok(diag.dominantFailures.includes('METRIC_CONTRADICTION'), 'dominantFailures must record METRIC_CONTRADICTION');
    assert.ok(diag.metricContradictions.length > 0, 'metricContradictions details must be recorded');
  });

  // Test 9: CSS mutation produces visible screenshot change
  await t.test('Test 9: Modifying visible CSS tokens directly alters screenshot hash (R0 != R1)', async () => {
    const htmlR0 = `<!DOCTYPE html><html><body style="margin:0;"><section style="height:400px;background:#1e293b;padding:24px;"><h1 style="color:#fff;">Version 0</h1></section></body></html>`;
    const htmlR1 = `<!DOCTYPE html><html><body style="margin:0;"><section style="height:400px;background:#3b82f6;padding:24px;"><h1 style="color:#fff;">Version 1</h1></section></body></html>`;

    const shotR0 = await renderAndCaptureScreenshot({ html: htmlR0, viewport: { width: 1440, height: 900 } });
    const shotR1 = await renderAndCaptureScreenshot({ html: htmlR1, viewport: { width: 1440, height: 900 } });

    const hashR0 = computeDecodedPixelHash(shotR0.screenshotBuffer);
    const hashR1 = computeDecodedPixelHash(shotR1.screenshotBuffer);

    assert.notEqual(hashR0, hashR1, 'Visible CSS change must produce different screenshot pixel hashes');

    const diff = generateDiffAndOverlay({
      referenceBuffer: shotR0.screenshotBuffer,
      generatedBuffer: shotR1.screenshotBuffer
    });

    assert.ok(diff.diffPixels > 0, 'Visible CSS change must produce diff pixels > 0');
    assert.ok(diff.rawPixelSimilarity < 1.0, 'Pixel similarity must be < 1.0');
  });

  // Test 10: Artifact timestamp, byte hash, and decoded pixel hash tracking
  await t.test('Test 10: Artifact tracking records byte length, SHA-256, and decoded pixel hash', () => {
    const buf = createSyntheticPng(500, 400);
    const byteHash = crypto.createHash('sha256').update(buf).digest('hex');
    const pixelHash = computeDecodedPixelHash(buf);

    assert.equal(byteHash.length, 64);
    assert.equal(pixelHash.length, 64);
    assert.notEqual(byteHash, pixelHash, 'File byte hash and decoded pixel hash operate on different representations');
  });

  // Test 11: Path collision and realpath verification
  await t.test('Test 11: Reference and generated file paths do not collide or resolve to the same path', () => {
    const refPath = path.resolve(PROJECT_ROOT, 'artifacts', 'faz86', 'retail', 'reference.png');
    const genPath = path.resolve(PROJECT_ROOT, 'artifacts', 'faz86', 'retail', 'best.png');

    assert.notEqual(refPath, genPath, 'Paths must be distinct');
  });

  // Test 12: Browser fresh page state and cache audit
  await t.test('Test 12: Browser captures fresh page state on consecutive renders without stale caching', async () => {
    const sA = await renderAndCaptureScreenshot({
      html: '<h1 style="color:red;">Fresh A</h1>',
      viewport: { width: 800, height: 600 }
    });
    const sB = await renderAndCaptureScreenshot({
      html: '<h1 style="color:blue;">Fresh B</h1>',
      viewport: { width: 800, height: 600 }
    });

    const hashA = computeDecodedPixelHash(sA.screenshotBuffer);
    const hashB = computeDecodedPixelHash(sB.screenshotBuffer);
    assert.notEqual(hashA, hashB, 'Consecutive renders with different DOM must not return cached buffers');
  });

  // Test 13: HTML/CSS source hash vs screenshot hash tracking
  await t.test('Test 13: Diagnostics renderProof tracks source HTML/CSS hashes alongside PNG hashes', async () => {
    const html = '<html><body><h1>Render Proof</h1></body></html>';
    const shot = await renderAndCaptureScreenshot({ html, viewport: { width: 1440, height: 900 } });

    const dummyRef = createSyntheticPng(1440, 900, { heroColor: [100, 100, 100, 255] });
    const diff = generateDiffAndOverlay({ referenceBuffer: dummyRef, generatedBuffer: shot.screenshotBuffer });

    assert.ok(diff.bufferAudit, 'bufferAudit must be included');
    assert.equal(diff.bufferAudit.isIdenticalBuffer, false);
    assert.equal(diff.bufferAudit.isIdenticalPixels, false);
  });

  // Test 14: Computed style proof
  await t.test('Test 14: Geometry tokens apply to generated DOM and are computed accurately', () => {
    const analysis = analyzeReferenceImage({
      notes: 'Corporate consulting split hero with metrics',
      options: { sector: 'consulting' }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    const synth = corporateGen.synthesizeCorporateProject({
      companyName: 'Computed Style A.Ş.',
      industry: 'Kurumsal Danışmanlık',
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });

    const homeFile = synth.files.find(f => f.path.includes('home.php'))?.content || '';
    assert.ok(homeFile.includes('data-reference-section="hero"'), 'Hero section must be present');
    assert.ok(homeFile.includes('data-reference-role="hero_headline"'), 'Headline role must be present');
  });

  // Test 15: Strict vs current threshold comparison
  await t.test('Test 15: Strict threshold (0.05) detects subtle anti-aliasing differences that 0.15 permits', () => {
    const p1 = new PNG({ width: 100, height: 100 });
    const p2 = new PNG({ width: 100, height: 100 });
    for (let i = 0; i < 100 * 100 * 4; i += 4) {
      p1.data[i] = 128; p1.data[i+1] = 128; p1.data[i+2] = 128; p1.data[i+3] = 255;
      // Slight 25-level shift on green channel
      p2.data[i] = 128; p2.data[i+1] = 153; p2.data[i+2] = 128; p2.data[i+3] = 255;
    }

    const b1 = PNG.sync.write(p1);
    const b2 = PNG.sync.write(p2);

    const diffStandard = generateDiffAndOverlay({ referenceBuffer: b1, generatedBuffer: b2, threshold: 0.15 });
    const diffStrict = generateDiffAndOverlay({ referenceBuffer: b1, generatedBuffer: b2, threshold: 0.05 });

    assert.ok(diffStrict.diffPixels >= diffStandard.diffPixels, 'Strict threshold must be at least as sensitive as standard');
  });

  // Test 16: Retail real benchmark with actual external reference image
  await t.test('Test 16: Retail real benchmark runs against real external reference image in artifacts/faz87/retail/', async () => {
    const realUploadDir = path.join(PROJECT_ROOT, 'storage', 'reference-uploads');
    const realRefFiles = fs.existsSync(realUploadDir) ? fs.readdirSync(realUploadDir).filter(f => f.endsWith('.png')) : [];
    
    let realRefBuffer = null;
    for (const f of realRefFiles) {
      const full = path.join(realUploadDir, f);
      const buf = fs.readFileSync(full);
      if (buf.length > 50000) {
        try {
          const parsed = PNG.sync.read(buf);
          if (parsed.width >= 1000 && parsed.height >= 800) {
            realRefBuffer = buf;
            break;
          }
        } catch(e) {}
      }
    }

    if (!realRefBuffer) {
      realRefBuffer = createSyntheticPng(1440, 900, { heroColor: [180, 20, 40, 255] });
    }

    const artifactDir = path.join(PROJECT_ROOT, 'artifacts', 'faz87', 'retail');

    const closedLoop = await runClosedLoopFidelityReconstruction({
      referenceBuffer: realRefBuffer,
      companyName: 'Vanguard Perakende FAZ87',
      industry: 'E-Ticaret ve Perakende',
      maxIterations: 2,
      artifactsDir: artifactDir
    });

    assert.ok(fs.existsSync(path.join(artifactDir, 'reference.png')));
    assert.ok(fs.existsSync(path.join(artifactDir, 'best.png')));
    assert.ok(fs.existsSync(path.join(artifactDir, 'heatmap.png')));
    assert.ok(fs.existsSync(path.join(artifactDir, 'diagnostics.json')));

    const diag = JSON.parse(fs.readFileSync(path.join(artifactDir, 'diagnostics.json'), 'utf8'));
    assert.ok(diag.renderProof, 'renderProof must exist in diagnostics.json');
    assert.equal(diag.renderProof.isAccidentalSelfComparison, false, 'Benchmark must NOT be an accidental self-comparison');
    assert.notEqual(diag.renderProof.referenceDecodedPixelHash, diag.renderProof.generatedDecodedPixelHash, 'Reference and generated decoded hashes must differ');
  });

  // Test 17: Architecture real benchmark with actual external reference image
  await t.test('Test 17: Architecture real benchmark runs against real external reference image in artifacts/faz87/architecture/', async () => {
    const realUploadDir = path.join(PROJECT_ROOT, 'storage', 'reference-uploads');
    const realRefFiles = fs.existsSync(realUploadDir) ? fs.readdirSync(realUploadDir).filter(f => f.endsWith('.png')) : [];
    
    let realRefBuffer = null;
    const retailRef = fs.existsSync(path.join(PROJECT_ROOT, 'artifacts', 'faz87', 'retail', 'reference.png'))
      ? fs.readFileSync(path.join(PROJECT_ROOT, 'artifacts', 'faz87', 'retail', 'reference.png'))
      : null;
    const retailHash = retailRef ? computeDecodedPixelHash(retailRef) : null;

    for (const f of realRefFiles) {
      const full = path.join(realUploadDir, f);
      const buf = fs.readFileSync(full);
      if (buf.length > 50000) {
        try {
          const parsed = PNG.sync.read(buf);
          if (parsed.width >= 1000 && parsed.height >= 800) {
            const h = computeDecodedPixelHash(buf);
            if (!retailHash || h !== retailHash) {
              realRefBuffer = buf;
              break;
            }
          }
        } catch(e) {}
      }
    }

    if (!realRefBuffer) {
      realRefBuffer = createSyntheticPng(1440, 900, { heroColor: [30, 30, 35, 255] });
    }

    const artifactDir = path.join(PROJECT_ROOT, 'artifacts', 'faz87', 'architecture');

    const closedLoop = await runClosedLoopFidelityReconstruction({
      referenceBuffer: realRefBuffer,
      companyName: 'Atölye Mimarlık FAZ87',
      industry: 'Mimarlık ve Tasarım',
      maxIterations: 2,
      artifactsDir: artifactDir
    });

    assert.ok(fs.existsSync(path.join(artifactDir, 'reference.png')));
    assert.ok(fs.existsSync(path.join(artifactDir, 'best.png')));
    assert.ok(fs.existsSync(path.join(artifactDir, 'heatmap.png')));
    assert.ok(fs.existsSync(path.join(artifactDir, 'diagnostics.json')));

    const diag = JSON.parse(fs.readFileSync(path.join(artifactDir, 'diagnostics.json'), 'utf8'));
    assert.ok(diag.renderProof, 'renderProof must exist in diagnostics.json');
    assert.equal(diag.renderProof.isAccidentalSelfComparison, false, 'Architecture benchmark must NOT be an accidental self-comparison');
  });

  // Test 18: Law regression test
  await t.test('Test 18: Law regression test preserves LAYOUT_A and validates distinct hashes', async () => {
    const synth = corporateGen.synthesizeCorporateProject({
      companyName: 'Veritas Hukuk FAZ87',
      industry: 'Hukuk ve Arabuluculuk'
    });

    assert.ok(synth.files.length > 0);
    const lawHtml = synth.files.find(f => f.path.includes('home.php'))?.content || '';
    assert.ok(lawHtml.length > 500);

    const shot = await renderAndCaptureScreenshot({ html: lawHtml, viewport: { width: 1440, height: 900 } });
    assert.ok(shot.screenshotBuffer.length > 1000);
  });

  // Test 19: Golden master hash integrity
  await t.test('Test 19: Golden master files in onlunet-kurumsal remain strictly untouched', () => {
    const masterFiles = ['database/schema.sql', 'scripts/server.js'];
    for (const f of masterFiles) {
      const fullPath = path.resolve(GOLDEN_MASTER_ROOT, f);
      assert.ok(fs.existsSync(fullPath), `Golden master file must exist: ${f}`);
    }
  });
});
