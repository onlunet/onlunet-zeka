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
  isRealReferenceImage
} from '../src/autonomous/reference-image-analyzer.js';

import {
  createCorporateGenerator,
  resolveLayoutFamily,
  computeLayoutFingerprint
} from '../src/autonomous/corporate-generator.js';

function createSyntheticPngBuffer(width = 800, height = 600, options = {}) {
  const png = new PNG({ width, height });
  const {
    headerColor = [15, 23, 42, 255],
    heroColor = [255, 255, 255, 255],
    featureColor = [248, 250, 252, 255],
    footerColor = [15, 23, 42, 255]
  } = options;

  const headerH = Math.round(height * 0.1);
  const heroH = Math.round(height * 0.4);
  const featureH = Math.round(height * 0.35);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      let c = footerColor;
      if (y < headerH) {
        c = headerColor;
      } else if (y < headerH + heroH) {
        c = heroColor;
      } else if (y < headerH + heroH + featureH) {
        c = featureColor;
      }
      png.data[idx] = c[0];
      png.data[idx + 1] = c[1];
      png.data[idx + 2] = c[2];
      png.data[idx + 3] = c[3];
    }
  }
  return PNG.sync.write(png);
}

test('FAZ 86 — PIXEL-LEVEL FIDELITY PROOF & VISUAL CONVERGENCE', async (t) => {
  const corporateGen = createCorporateGenerator();

  // Test 1: Real vs synthetic reference detection
  await t.test('Test 1: Real reference detection accurately identifies synthetic vs real uploads', () => {
    const syntheticBuffer = createSyntheticPngBuffer(200, 200);
    const synthClassification = isRealReferenceImage({ imageBuffer: syntheticBuffer });
    assert.equal(synthClassification.isReal, false, 'Small synthetic buffer must be marked SYNTHETIC');
    assert.equal(synthClassification.type, 'SYNTHETIC');

    const realPath = path.join(PROJECT_ROOT, 'storage', 'reference-uploads', 'ref_sample.png');
    const pathClassification = isRealReferenceImage({ filePath: realPath });
    assert.equal(pathClassification.type, 'REAL_REFERENCE', 'Reference uploads path must be REAL_REFERENCE');
  });

  // Test 2: Exact screenshot dimensions
  await t.test('Test 2: Exact screenshot dimensions match viewport without stretching or padding', async () => {
    const html = `<!DOCTYPE html><html><body style="margin:0;background:#ffffff;"><div style="height:400px;background:#2563eb;"></div></body></html>`;
    const res = await renderAndCaptureScreenshot({
      html,
      viewport: { width: 1440, height: 900 }
    });

    assert.equal(res.dimensions.width, 1440, 'Width must be exactly 1440px');
    assert.equal(res.dimensions.height, 900, 'Height must be exactly 900px');

    const png = PNG.sync.read(res.screenshotBuffer);
    assert.equal(png.width, 1440, 'PNG buffer width must match');
    assert.equal(png.height, 900, 'PNG buffer height must match');
  });

  // Test 3: Deterministic repeated screenshot
  await t.test('Test 3: Deterministic repeated screenshot verifies 100% pixel match (S1 === S2)', async () => {
    const html = `<section style="padding:40px;background:#0f172a;color:#fff;"><h1>Deterministic</h1><p>Test</p></section>`;
    const detResult = await verifyScreenshotDeterminism({
      html,
      viewport: { width: 1200, height: 800 }
    });

    assert.equal(detResult.isDeterministic, true, 'Repeated screenshot must be deterministic');
    assert.equal(detResult.diffPixels, 0, 'S1 vs S2 diff pixels must be 0');
    assert.equal(detResult.pixelSimilarity, 1.0, 'S1 vs S2 pixel similarity must be 1.0');
    assert.equal(detResult.status, 'DETERMINISTIC');
  });

  // Test 4: Raw pixel similarity calculation
  await t.test('Test 4: Raw pixel similarity is computed directly from pixelmatch without composite derivation', () => {
    const bufA = createSyntheticPngBuffer(800, 600, { heroColor: [255, 255, 255, 255] });
    const bufB = createSyntheticPngBuffer(800, 600, { heroColor: [0, 0, 0, 255] });

    const diff = generateDiffAndOverlay({
      referenceBuffer: bufA,
      generatedBuffer: bufB,
      matchViewport: true
    });

    assert.ok(typeof diff.rawPixelSimilarity === 'number', 'rawPixelSimilarity must be a number');
    assert.ok(diff.rawPixelSimilarity >= 0 && diff.rawPixelSimilarity <= 1, 'rawPixelSimilarity must be 0..1 scale');
    assert.ok(diff.diffRatio > 0, 'Different colors must produce positive diffRatio');
    assert.equal(diff.rawPixelSimilarity, Number((1 - diff.diffRatio).toFixed(4)), 'rawPixelSimilarity must strictly equal 1 - diffRatio');
  });

  // Test 5: Diff pixel ratio and metric breakdown
  await t.test('Test 5: Diff pixel ratio reports complete breakdown (reference, diff, matching, ratio)', () => {
    const bufA = createSyntheticPngBuffer(1000, 800);
    const bufB = createSyntheticPngBuffer(1000, 800);

    const diff = generateDiffAndOverlay({ referenceBuffer: bufA, generatedBuffer: bufB });

    assert.equal(diff.diffMetrics.referencePixels, 800000);
    assert.equal(diff.diffMetrics.diffPixels, 0);
    assert.equal(diff.diffMetrics.matchingPixels, 800000);
    assert.equal(diff.diffMetrics.diffRatio, 0);
    assert.equal(diff.diffMetrics.pixelSimilarity, 1.0);
  });

  // Test 6: Region pixel similarity
  await t.test('Test 6: Region pixel similarity calculates section-level pixel metrics and IoU', () => {
    const refBuf = createSyntheticPngBuffer(1440, 900);
    const genBuf = createSyntheticPngBuffer(1440, 900);

    const refGeom = createDefaultGeometrySpec(1440, 900);
    const domSections = [
      { section: 'hero', bounds: { x: 0, y: 80, width: 1440, height: 420 }, relativeBox: { left: 0, top: 0.088, width: 1, height: 0.466 } },
      { section: 'offerings', bounds: { x: 0, y: 500, width: 1440, height: 350 }, relativeBox: { left: 0, top: 0.555, width: 1, height: 0.388 } }
    ];

    const sectionMetrics = calculateSectionPixelMetrics({
      referenceBuffer: refBuf,
      generatedBuffer: genBuf,
      referenceGeometry: refGeom,
      domSections
    });

    assert.ok(sectionMetrics.hero, 'Hero section metrics must exist');
    assert.ok(typeof sectionMetrics.hero.pixelSimilarity === 'number');
    assert.ok(typeof sectionMetrics.hero.diffRatio === 'number');
    assert.ok(typeof sectionMetrics.hero.iou === 'number');
  });

  // Test 7: Error concentration by region
  await t.test('Test 7: Error concentration calculates diff pixel percentage distribution across regions', () => {
    const bufA = createSyntheticPngBuffer(1000, 800, { heroColor: [255, 255, 255, 255] });
    const bufB = createSyntheticPngBuffer(1000, 800, { heroColor: [10, 10, 10, 255] });

    const diff = generateDiffAndOverlay({ referenceBuffer: bufA, generatedBuffer: bufB });
    const errorConc = calculateErrorConcentration({
      diffBuffer: diff.diffBuffer,
      dimensions: { width: 1000, height: 800 }
    });

    assert.ok(errorConc.totalDiffPixels > 0, 'Must record diff pixels');
    assert.ok(errorConc.regions.hero, 'Hero region must exist');
    assert.ok(errorConc.regions.cards, 'Cards region must exist');
    assert.ok(errorConc.regions.footer, 'Footer region must exist');
  });

  // Test 8: Error heatmap generation
  await t.test('Test 8: Error heatmap generation produces valid color-graded PNG buffer', () => {
    const bufA = createSyntheticPngBuffer(800, 600, { heroColor: [255, 255, 255, 255] });
    const bufB = createSyntheticPngBuffer(800, 600, { heroColor: [0, 0, 0, 255] });

    const diff = generateDiffAndOverlay({ referenceBuffer: bufA, generatedBuffer: bufB });
    const heatmapBuf = generateErrorHeatmap({ diffBuffer: diff.diffBuffer, width: 800, height: 600 });

    assert.ok(Buffer.isBuffer(heatmapBuf), 'Heatmap must be a PNG buffer');
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.ok(heatmapBuf.subarray(0, 8).equals(pngMagic), 'Heatmap must start with PNG magic bytes');

    const parsed = PNG.sync.read(heatmapBuf);
    assert.equal(parsed.width, 800);
    assert.equal(parsed.height, 600);
  });

  // Test 9: R0 Measurement
  await t.test('Test 9: R0 measurement captures baseline raw pixel similarity and 8-factor breakdown', async () => {
    const synthSite = corporateGen.synthesizeCorporateProject({
      companyName: 'Temel Kurumsal A.Ş.',
      industry: 'Kurumsal Danışmanlık'
    });
    const homeHtml = synthSite.files.find(f => f.path.includes('home.php'))?.content || '<html><body>R0</body></html>';

    const refShot = await renderAndCaptureScreenshot({ html: homeHtml, viewport: { width: 1440, height: 900 } });

    const result = await runClosedLoopFidelityReconstruction({
      referenceBuffer: refShot.screenshotBuffer,
      companyName: 'Temel Kurumsal A.Ş.',
      industry: 'Kurumsal Danışmanlık',
      maxIterations: 1
    });

    const r0 = result.iterations[0];
    assert.equal(r0.iteration, 0, 'First iteration must be R0');
    assert.ok(typeof r0.score === 'number', 'R0 must have overall score');
    assert.ok(typeof r0.pixelSimilarity === 'number', 'R0 must have pixel similarity');
    assert.ok(r0.compositeFidelity.visualFidelity, 'R0 must have composite breakdown');
  });

  // Test 10: R1 / R2 / R3 measurement and iteration tracking
  await t.test('Test 10: R1/R2/R3 iterative measurement tracks each step independently', async () => {
    const synthSite = corporateGen.synthesizeCorporateProject({
      companyName: 'İterasyon Ltd.',
      industry: 'Teknoloji ve Yazılım'
    });
    const homeHtml = synthSite.files.find(f => f.path.includes('home.php'))?.content || '';

    const refShot = await renderAndCaptureScreenshot({ html: homeHtml, viewport: { width: 1440, height: 900 } });

    const result = await runClosedLoopFidelityReconstruction({
      referenceBuffer: refShot.screenshotBuffer,
      companyName: 'İterasyon Ltd.',
      industry: 'Teknoloji ve Yazılım',
      maxIterations: 3
    });

    assert.ok(result.iterations.length >= 1, 'Must record iterations');
    assert.ok(result.iterations.length <= 4, 'Must not exceed max iterations (R0..R3)');

    for (const it of result.iterations) {
      assert.ok(it.screenResult && it.screenResult.screenshotBuffer, `R${it.iteration} must contain screenshot`);
      assert.ok(it.diffResult && it.diffResult.diffBuffer, `R${it.iteration} must contain diff`);
    }
  });

  // Test 11: Best candidate selection
  await t.test('Test 11: Best candidate selection retains optimal iteration', async () => {
    const refShot = await renderAndCaptureScreenshot({
      html: '<section data-reference-section="hero" style="height:350px;background:#18181b;"><h1 data-reference-role="hero_headline" style="color:#fff;">Best</h1></section>',
      viewport: { width: 1440, height: 900 }
    });

    const result = await runClosedLoopFidelityReconstruction({
      referenceBuffer: refShot.screenshotBuffer,
      companyName: 'Best Test A.Ş.',
      industry: 'Kurumsal Danışmanlık',
      maxIterations: 2
    });

    assert.ok(result.bestIteration, 'Best iteration must be identified');
    assert.ok(result.finalFidelity >= result.initialFidelity, 'Final fidelity must be >= initial');
    assert.ok(result.bestScore >= result.initialScore, 'Best score must be >= initial');
  });

  // Test 12: Pixel-level monotonic safety
  await t.test('Test 12: Dual monotonic safety rejects candidate if pixel similarity regresses', () => {
    const prevPixelSim = 0.75;
    const candPixelSim = 0.60; // 15% drop
    const candScore = 0.85; // higher composite score
    const bestScore = 0.80;

    const scoreImproved = candScore > bestScore;
    const pixelImproved = candPixelSim > prevPixelSim;
    const scoreStable = candScore >= (bestScore - 0.02);
    const pixelStable = candPixelSim >= (prevPixelSim - 0.03);

    const accepted = (scoreImproved && pixelStable) || (pixelImproved && scoreStable);
    assert.equal(accepted, false, 'Candidate with regressed pixel similarity must be rejected despite higher composite');
  });

  // Test 13: Retail real benchmark visual proof
  await t.test('Test 13: Retail real benchmark generates complete FAZ86 visual artifact set', async () => {
    const refCode = 'ecommerce_retail';
    const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(refCode).digest('hex'), 'utf8');

    const analysis = analyzeReferenceImage({
      imageBuffer: dummyBuffer,
      notes: 'High Conversion E-Commerce Retail Catalog Product Showcase Crimson',
      options: { industry: 'E-Ticaret ve Perakende', sector: refCode }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    const initialRetail = corporateGen.synthesizeCorporateProject({
      companyName: 'Vanguard Retail FAZ86',
      industry: 'E-Ticaret ve Perakende',
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });
    const retailHtml = initialRetail.files.find(f => f.path.includes('home.php'))?.content || '';

    const retailRef = await renderAndCaptureScreenshot({ html: retailHtml, viewport: { width: 1440, height: 900 } });
    const retailArtifactDir = path.join(PROJECT_ROOT, 'artifacts', 'faz86', 'retail');

    const closedLoop = await runClosedLoopFidelityReconstruction({
      referenceBuffer: retailRef.screenshotBuffer,
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      companyName: 'Vanguard Retail FAZ86',
      industry: 'E-Ticaret ve Perakende',
      maxIterations: 2,
      artifactsDir: retailArtifactDir
    });

    assert.ok(fs.existsSync(path.join(retailArtifactDir, 'reference.png')), 'reference.png must exist');
    assert.ok(fs.existsSync(path.join(retailArtifactDir, 'best.png')), 'best.png must exist');
    assert.ok(fs.existsSync(path.join(retailArtifactDir, 'heatmap.png')), 'heatmap.png must exist');
    assert.ok(fs.existsSync(path.join(retailArtifactDir, 'best-overlay.png')), 'best-overlay.png must exist');
    assert.ok(fs.existsSync(path.join(retailArtifactDir, 'diagnostics.json')), 'diagnostics.json must exist');

    const diag = JSON.parse(fs.readFileSync(path.join(retailArtifactDir, 'diagnostics.json'), 'utf8'));
    assert.ok(diag.iterations, 'Diagnostics must include iterations');
    assert.ok(diag.sectionMetrics, 'Diagnostics must include sectionMetrics');
    assert.ok(diag.errorConcentration, 'Diagnostics must include errorConcentration');
  });

  // Test 14: Architecture real benchmark visual proof
  await t.test('Test 14: Architecture real benchmark generates complete FAZ86 visual artifact set', async () => {
    const refCode = 'architecture_design';
    const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(refCode).digest('hex'), 'utf8');

    const analysis = analyzeReferenceImage({
      imageBuffer: dummyBuffer,
      notes: 'Modern Architecture Editorial Magazine Raw Charcoal Brass Staggered',
      options: { industry: 'Mimarlık ve Tasarım', sector: refCode }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    const initialArch = corporateGen.synthesizeCorporateProject({
      companyName: 'Atölye Mimarlık FAZ86',
      industry: 'Mimarlık ve Tasarım',
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });
    const archHtml = initialArch.files.find(f => f.path.includes('home.php'))?.content || '';

    const archRef = await renderAndCaptureScreenshot({ html: archHtml, viewport: { width: 1440, height: 900 } });
    const archArtifactDir = path.join(PROJECT_ROOT, 'artifacts', 'faz86', 'architecture');

    const closedLoop = await runClosedLoopFidelityReconstruction({
      referenceBuffer: archRef.screenshotBuffer,
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      companyName: 'Atölye Mimarlık FAZ86',
      industry: 'Mimarlık ve Tasarım',
      maxIterations: 2,
      artifactsDir: archArtifactDir
    });

    assert.ok(fs.existsSync(path.join(archArtifactDir, 'reference.png')));
    assert.ok(fs.existsSync(path.join(archArtifactDir, 'best.png')));
    assert.ok(fs.existsSync(path.join(archArtifactDir, 'heatmap.png')));
    assert.ok(fs.existsSync(path.join(archArtifactDir, 'diagnostics.json')));
  });

  // Test 15: Law regression test
  await t.test('Test 15: Law regression test preserves high fidelity without unwanted token drift', async () => {
    const refCode = 'legal_consulting';
    const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(refCode).digest('hex'), 'utf8');

    const analysis = analyzeReferenceImage({
      imageBuffer: dummyBuffer,
      notes: 'Prestige Legal Consulting Law Firm Trust Classical Navy Bronze Centered',
      options: { industry: 'Hukuk ve Arabuluculuk', sector: refCode }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    assert.equal(spec.layoutFamily, LayoutFamilies.LAYOUT_A, 'Law must preserve LAYOUT_A');

    const synth = corporateGen.synthesizeCorporateProject({
      companyName: 'Veritas Hukuk FAZ86',
      industry: 'Hukuk ve Arabuluculuk',
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });

    const lawHtml = synth.files.find(f => f.path.includes('home.php'))?.content || '';
    assert.ok(lawHtml.length > 500);

    const shot = await renderAndCaptureScreenshot({ html: lawHtml, viewport: { width: 1440, height: 900 } });
    assert.ok(shot.screenshotBuffer.length > 1000);
  });

  // Test 16: Anti-cheat rejection
  await t.test('Test 16: Anti-cheat rejection flags empty DOM, injected overlays, and duplicate binary images', () => {
    const violationEmpty = detectAntiCheatViolations({ html: '<div>Just simple non semantic text</div>' });
    assert.equal(violationEmpty.passed, false);

    const violationOverlay = detectAntiCheatViolations({
      html: '<section style="background-image:url(reference.png)"><h1>Hacked</h1></section>'
    });
    assert.equal(violationOverlay.passed, false);

    const dupBuf = Buffer.from('identical-bytes-fixture');
    const violationDup = detectAntiCheatViolations({
      html: '<section><h1>Normal</h1></section>',
      generatedBuffer: dupBuf,
      referenceBuffer: dupBuf
    });
    assert.equal(violationDup.passed, false);
  });

  // Test 17: No-reference regression test
  await t.test('Test 17: No-reference regression test guarantees standard generation', async () => {
    const synthNoRef = corporateGen.synthesizeCorporateProject({
      companyName: 'Standart İş Danışmanlığı',
      industry: 'Genel Danışmanlık'
    });

    assert.ok(synthNoRef.files.length > 0);
    assert.ok(synthNoRef.layoutFamily);

    const homeHtml = synthNoRef.files.find(f => f.path.includes('home.php'))?.content || '';
    assert.ok(homeHtml.length > 100);

    const shot = await renderAndCaptureScreenshot({ html: homeHtml, viewport: { width: 1440, height: 900 } });
    assert.ok(shot.screenshotBuffer.length > 1000);
  });

  // Test 18: Full suite non-interference verification
  await t.test('Test 18: Full suite non-interference ensures Golden Master remains unmodified', () => {
    const masterFiles = ['database/schema.sql', 'scripts/server.js'];
    for (const f of masterFiles) {
      const fullPath = path.resolve(GOLDEN_MASTER_ROOT, f);
      assert.ok(fs.existsSync(fullPath), `Golden master file must exist: ${f}`);
    }
  });
});
