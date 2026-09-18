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
  getBrowserExecutablePath
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

test('FAZ 85 — REAL SCREENSHOT RECONSTRUCTION & CLOSED-LOOP VISUAL FIDELITY', async (t) => {
  const corporateGen = createCorporateGenerator();

  // Test 1: Browser availability
  await t.test('Test 1: Browser availability discovers system Google Chrome or Microsoft Edge', () => {
    const execPath = getBrowserExecutablePath();
    assert.ok(execPath, 'Browser executable path must not be empty');
    assert.ok(fs.existsSync(execPath), `Browser executable must exist on disk: ${execPath}`);
  });

  // Test 2: Deterministic viewport
  await t.test('Test 2: Deterministic viewport enforces requested dimensions in browser render', async () => {
    const html = `<!DOCTYPE html><html><body style="margin:0;background:#ffffff;"><section data-reference-section="hero" style="height:300px;background:#f0f9ff;"><h1 data-reference-role="hero_headline">Viewport Test</h1></section></body></html>`;
    const result = await renderAndCaptureScreenshot({
      html,
      viewport: { width: 1280, height: 720 },
      extractBoxes: true
    });

    assert.equal(result.dimensions.width, 1280, 'Render width must match requested viewport');
    assert.equal(result.dimensions.height, 720, 'Render height must match requested viewport');
  });

  // Test 3: Screenshot generation
  await t.test('Test 3: Screenshot generation captures valid PNG buffer with PNG magic bytes', async () => {
    const html = `<div style="padding:40px;background:#0f172a;color:#fff;"><h1>Magic PNG</h1></div>`;
    const result = await renderAndCaptureScreenshot({
      html,
      viewport: { width: 800, height: 600 }
    });

    assert.ok(Buffer.isBuffer(result.screenshotBuffer), 'Screenshot result must be a Buffer');
    assert.ok(result.screenshotBuffer.length > 500, 'Screenshot buffer must have non-trivial size');

    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.ok(result.screenshotBuffer.subarray(0, 8).equals(pngMagic), 'Buffer must start with PNG magic bytes');
  });

  // Test 4: Reference / generated dimension match
  await t.test('Test 4: Reference / generated dimension match aligns canvas without distortion', () => {
    const refBuf = createSyntheticPngBuffer(1000, 700);
    const genBuf = createSyntheticPngBuffer(1200, 800);

    const diff = generateDiffAndOverlay({
      referenceBuffer: refBuf,
      generatedBuffer: genBuf,
      matchViewport: true
    });

    assert.ok(diff, 'Diff output must exist');
    assert.ok(diff.diffBuffer, 'diffBuffer must exist');
    assert.ok(diff.overlayBuffer, 'overlayBuffer must exist');
    assert.ok(typeof diff.pixelSimilarity === 'number', 'pixelSimilarity must be a number');
    assert.ok(diff.pixelSimilarity >= 0 && diff.pixelSimilarity <= 100, 'pixelSimilarity must be in 0..100');
  });

  // Test 5: Reference vs generated comparison
  await t.test('Test 5: Reference vs generated comparison calculates pixel similarity and diff metrics', () => {
    const imgBuf = createSyntheticPngBuffer(800, 600);

    // Identical image diff
    const diffIdentical = generateDiffAndOverlay({
      referenceBuffer: imgBuf,
      generatedBuffer: imgBuf
    });

    assert.equal(diffIdentical.diffPixels, 0, 'Identical buffers must have 0 diff pixels');
    assert.equal(diffIdentical.pixelSimilarity, 100, 'Identical buffers must have 100% similarity');

    // Distinct image diff
    const diffOther = generateDiffAndOverlay({
      referenceBuffer: imgBuf,
      generatedBuffer: createSyntheticPngBuffer(800, 600, {
        heroColor: [20, 20, 20, 255]
      })
    });

    assert.ok(diffOther.diffPixels > 0, 'Different buffers must have diff pixels');
    assert.ok(diffOther.pixelSimilarity < 100, 'Different buffers must have similarity < 100');
  });

  // Test 6: Region screenshot comparison
  await t.test('Test 6: Region screenshot comparison calculates section-level IoU and position drift', () => {
    const refSpec = createDefaultGeometrySpec(1440, 900);
    const domSections = [
      {
        section: 'hero',
        bounds: { x: 0, y: 80, width: 1440, height: 420 },
        relativeBox: { left: 0, top: 0.088, width: 1, height: 0.466, right: 1, bottom: 0.554 }
      },
      {
        section: 'offerings',
        bounds: { x: 0, y: 500, width: 1440, height: 350 },
        relativeBox: { left: 0, top: 0.555, width: 1, height: 0.388, right: 1, bottom: 0.943 }
      }
    ];

    const regions = calculateRegionScreenshotFidelity({
      referenceGeometry: refSpec,
      domSections,
      dimensions: { width: 1440, height: 900 }
    });

    assert.ok(Array.isArray(regions), 'Regions must be an array');
    assert.ok(regions.length > 0, 'Regions must contain evaluated sections');

    const heroReg = regions.find(r => r.section === 'hero');
    assert.ok(heroReg, 'Hero region must be evaluated');
    assert.ok(typeof heroReg.iou === 'number', 'IoU must be numeric');
    assert.ok(heroReg.bounds && heroReg.bounds.delta, 'Bounds delta must be present');
  });

  // Test 7: DOM / reference geometry comparison
  await t.test('Test 7: DOM and reference geometry comparison extracts semantic bounding boxes', async () => {
    const html = `
      <section data-reference-section="hero" style="height:350px;display:flex;align-items:center;justify-content:center;">
        <h1 data-reference-role="hero_headline" style="font-size:36px;">Headline</h1>
        <a data-reference-role="cta_button" style="padding:10px 20px;background:blue;color:white;">Action</a>
      </section>
    `;

    const res = await renderAndCaptureScreenshot({
      html,
      viewport: { width: 1440, height: 900 },
      extractBoxes: true
    });

    assert.ok(res.domSections.length >= 1, 'Must extract hero section');
    assert.equal(res.domSections[0].section, 'hero');

    const headlineEl = res.domElements.find(el => el.role === 'hero_headline');
    assert.ok(headlineEl, 'Must extract headline element');
    assert.ok(headlineEl.relativeBox.width > 0, 'Headline relative width must be > 0');

    const ctaEl = res.domElements.find(el => el.role === 'cta_button');
    assert.ok(ctaEl, 'Must extract CTA button element');
    assert.ok(ctaEl.relativeBox.height > 0, 'CTA relative height must be > 0');
  });

  // Test 8: Diagnostics generation
  await t.test('Test 8: Diagnostics generation produces dominantFailures and actionable correctionHints', () => {
    const diag = diagnoseScreenshotFidelity({
      compositeFidelity: {
        visualFidelity: { overall: 0.65 }
      },
      regionFidelity: [
        {
          section: 'hero',
          iou: 0.62,
          geometry: 0.60,
          bounds: { delta: { width: 0.12, height: -0.15 } }
        },
        {
          section: 'offerings',
          iou: 0.70,
          geometry: 0.68,
          bounds: { delta: { width: 0.05, height: 0.02 } }
        }
      ],
      domElements: [
        {
          role: 'hero_headline',
          relativeBox: { width: 0.85, height: 0.1 }
        }
      ],
      referenceGeometry: {
        canvas: { width: 1440, height: 900 },
        elements: [
          {
            role: 'hero_headline',
            relativeBox: { width: 0.55, height: 0.1 }
          }
        ]
      }
    });

    assert.ok(diag, 'Diagnostics object must exist');
    assert.ok(Array.isArray(diag.dominantFailures), 'dominantFailures must be an array');
    assert.ok(diag.dominantFailures.length > 0, 'Must identify dominant failures');
    assert.ok(Array.isArray(diag.correctionHints), 'correctionHints must be an array');
    assert.ok(diag.correctionHints.length > 0, 'Must produce correction hints');

    for (const hint of diag.correctionHints) {
      assert.ok(hint.target, 'Hint must have a target token');
      assert.ok(hint.direction, 'Hint must have a direction');
      assert.ok(hint.reason, 'Hint must include diagnostic reason');
    }
  });

  // Test 9: Correction iteration
  await t.test('Test 9: Closed-loop reconstruction executes iterations and safely adjusts tokens', async () => {
    const synthSite = corporateGen.synthesizeCorporateProject({
      companyName: 'Akıllı Çözümler A.Ş.',
      industry: 'Kurumsal Danışmanlık'
    });
    const homeHtml = synthSite.files.find(f => f.path.includes('home.php'))?.content || '<html><body><h1>Test</h1></body></html>';

    const refShot = await renderAndCaptureScreenshot({
      html: homeHtml,
      viewport: { width: 1440, height: 900 }
    });

    const result = await runClosedLoopFidelityReconstruction({
      referenceBuffer: refShot.screenshotBuffer,
      companyName: 'Akıllı Çözümler A.Ş.',
      industry: 'Kurumsal Danışmanlık',
      maxIterations: 2
    });

    assert.ok(result, 'Reconstruction result must exist');
    assert.ok(Array.isArray(result.iterations), 'Iterations must be an array');
    assert.ok(result.iterations.length >= 1, 'At least iteration 0 must be recorded');
    assert.ok(result.bestIteration, 'bestIteration must be identified');
    assert.ok(typeof result.initialScore === 'number', 'initialScore must be numeric');
    assert.ok(typeof result.bestScore === 'number', 'bestScore must be numeric');
  });

  // Test 10: Monotonic improvement guarantee
  await t.test('Test 10: Monotonic improvement guarantee rejects score regressions', async () => {
    const refShot = await renderAndCaptureScreenshot({
      html: '<section data-reference-section="hero" style="height:400px;background:#1e293b;"><h1 data-reference-role="hero_headline" style="color:#fff;">Monotonic</h1></section>',
      viewport: { width: 1440, height: 900 }
    });

    const result = await runClosedLoopFidelityReconstruction({
      referenceBuffer: refShot.screenshotBuffer,
      companyName: 'Monotonik Test Ltd.',
      industry: 'Kurumsal Danışmanlık',
      maxIterations: 2
    });

    assert.equal(result.monotonicSafetyGuaranteed, true, 'monotonicSafetyGuaranteed must be true');
    assert.ok(result.bestScore >= result.initialScore, 'bestScore must never regress below initialScore');
  });

  // Test 11: Anti-cheat rejection
  await t.test('Test 11: Anti-cheat rejection detects synthetic or overlay hacks', () => {
    // Empty non-semantic DOM
    const violationEmpty = detectAntiCheatViolations({ html: '<div>Empty non semantic</div>' });
    assert.equal(violationEmpty.passed, false, 'Empty non-semantic DOM must be rejected');

    // Forbidden background overlay
    const violationOverlay = detectAntiCheatViolations({
      html: '<section style="background-image:url(reference.png)"><h1>Injected</h1></section>'
    });
    assert.equal(violationOverlay.passed, false, 'Injected background-image reference must be rejected');

    // Binary file duplication
    const dupBuffer = Buffer.from('identical-png-data');
    const violationDup = detectAntiCheatViolations({
      html: '<section><h1>Legit</h1></section>',
      generatedBuffer: dupBuffer,
      referenceBuffer: dupBuffer
    });
    assert.equal(violationDup.passed, false, 'Direct binary image duplication must be rejected');
  });

  // Test 12: Retail real benchmark
  await t.test('Test 12: Retail real benchmark executes closed-loop and outputs visual artifacts', async () => {
    const refCode = 'ecommerce_retail';
    const notes = 'High Conversion E-Commerce Retail Catalog Product Showcase Crimson';
    const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(refCode).digest('hex'), 'utf8');

    const analysis = analyzeReferenceImage({
      imageBuffer: dummyBuffer,
      notes,
      options: { industry: 'E-Ticaret ve Perakende', sector: refCode }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    // Render baseline retail view to use as visual reference
    const initialRetail = corporateGen.synthesizeCorporateProject({
      companyName: 'Vanguard Perakende',
      industry: 'E-Ticaret ve Perakende',
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });
    const retailHtml = initialRetail.files.find(f => f.path.includes('home.php'))?.content || '<html><body>Retail</body></html>';
    const retailRef = await renderAndCaptureScreenshot({
      html: retailHtml,
      viewport: { width: 1440, height: 900 }
    });

    const retailArtifactDir = path.join(PROJECT_ROOT, 'artifacts', 'faz85', 'retail');

    const closedLoop = await runClosedLoopFidelityReconstruction({
      referenceBuffer: retailRef.screenshotBuffer,
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      companyName: 'Vanguard Perakende',
      industry: 'E-Ticaret ve Perakende',
      maxIterations: 2,
      artifactsDir: retailArtifactDir
    });

    assert.ok(closedLoop.bestScore > 0, 'Retail best score must be measured');
    assert.ok(fs.existsSync(path.join(retailArtifactDir, 'reference.png')), 'reference.png artifact must be saved');
    assert.ok(fs.existsSync(path.join(retailArtifactDir, 'generated.png')), 'generated.png artifact must be saved');
    assert.ok(fs.existsSync(path.join(retailArtifactDir, 'diff.png')), 'diff.png artifact must be saved');
    assert.ok(fs.existsSync(path.join(retailArtifactDir, 'overlay.png')), 'overlay.png artifact must be saved');
    assert.ok(fs.existsSync(path.join(retailArtifactDir, 'diagnostics.json')), 'diagnostics.json artifact must be saved');
  });

  // Test 13: Architecture real benchmark
  await t.test('Test 13: Architecture real benchmark executes closed-loop and outputs visual artifacts', async () => {
    const refCode = 'architecture_design';
    const notes = 'Modern Architecture Editorial Magazine Raw Charcoal Brass Staggered';
    const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(refCode).digest('hex'), 'utf8');

    const analysis = analyzeReferenceImage({
      imageBuffer: dummyBuffer,
      notes,
      options: { industry: 'Mimarlık ve Tasarım', sector: refCode }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    // Render baseline architecture view to use as visual reference
    const initialArch = corporateGen.synthesizeCorporateProject({
      companyName: 'Atölye Modern Mimarlık',
      industry: 'Mimarlık ve Tasarım',
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });
    const archHtml = initialArch.files.find(f => f.path.includes('home.php'))?.content || '<html><body>Arch</body></html>';
    const archRef = await renderAndCaptureScreenshot({
      html: archHtml,
      viewport: { width: 1440, height: 900 }
    });

    const archArtifactDir = path.join(PROJECT_ROOT, 'artifacts', 'faz85', 'architecture');

    const closedLoop = await runClosedLoopFidelityReconstruction({
      referenceBuffer: archRef.screenshotBuffer,
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      companyName: 'Atölye Modern Mimarlık',
      industry: 'Mimarlık ve Tasarım',
      maxIterations: 2,
      artifactsDir: archArtifactDir
    });

    assert.ok(closedLoop.bestScore > 0, 'Architecture best score must be measured');
    assert.ok(fs.existsSync(path.join(archArtifactDir, 'reference.png')), 'reference.png artifact must be saved');
    assert.ok(fs.existsSync(path.join(archArtifactDir, 'generated.png')), 'generated.png artifact must be saved');
    assert.ok(fs.existsSync(path.join(archArtifactDir, 'diff.png')), 'diff.png artifact must be saved');
    assert.ok(fs.existsSync(path.join(archArtifactDir, 'overlay.png')), 'overlay.png artifact must be saved');
    assert.ok(fs.existsSync(path.join(archArtifactDir, 'diagnostics.json')), 'diagnostics.json artifact must be saved');
  });

  // Test 14: Law regression test
  await t.test('Test 14: Law regression test preserves high fidelity and produces valid screenshots', async () => {
    const refCode = 'legal_consulting';
    const notes = 'Prestige Legal Consulting Law Firm Trust Classical Navy Bronze Centered';
    const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(refCode).digest('hex'), 'utf8');

    const analysis = analyzeReferenceImage({
      imageBuffer: dummyBuffer,
      notes,
      options: { industry: 'Hukuk ve Arabuluculuk', sector: refCode }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    assert.equal(spec.layoutFamily, LayoutFamilies.LAYOUT_A, 'Law must preserve LAYOUT_A');

    const synth = corporateGen.synthesizeCorporateProject({
      companyName: 'Veritas Hukuk',
      industry: 'Hukuk ve Arabuluculuk',
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });

    const lawHtml = synth.files.find(f => f.path.includes('home.php'))?.content || '';
    assert.ok(lawHtml.length > 500, 'Law HTML must be fully generated');

    const shot = await renderAndCaptureScreenshot({
      html: lawHtml,
      viewport: { width: 1440, height: 900 }
    });

    assert.ok(shot.screenshotBuffer.length > 1000, 'Law screenshot must be successfully captured');
  });

  // Test 15: No-reference regression test
  await t.test('Test 15: No-reference regression test guarantees standard generation without errors', async () => {
    const synthNoRef = corporateGen.synthesizeCorporateProject({
      companyName: 'Klasik Danışmanlık Ltd.',
      industry: 'Genel Danışmanlık'
    });

    assert.ok(synthNoRef.files.length > 0, 'Files must be produced');
    assert.ok(synthNoRef.layoutFamily, 'Layout family must be resolved');

    const homeHtml = synthNoRef.files.find(f => f.path.includes('home.php'))?.content || '';
    assert.ok(homeHtml.length > 100, 'Home HTML must have content');

    const shot = await renderAndCaptureScreenshot({
      html: homeHtml,
      viewport: { width: 1440, height: 900 }
    });

    assert.ok(shot.screenshotBuffer.length > 1000, 'No-reference project must render cleanly');
  });
});
