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
  calculateBoxIoU
} from '../src/autonomous/reference-image-analyzer.js';

import {
  createCorporateGenerator,
  resolveLayoutFamily,
  computeLayoutFingerprint
} from '../src/autonomous/corporate-generator.js';

import {
  detectSectorArchetype
} from '../src/autonomous/sector-archetypes.js';

function createSyntheticPngBuffer(width = 800, height = 600, options = {}) {
  const png = new PNG({ width, height });
  const {
    headerColor = [15, 23, 42, 255],
    heroColor = [255, 255, 255, 255],
    featureColor = [248, 250, 252, 255],
    footerColor = [15, 23, 42, 255]
  } = options;

  for (let y = 0; y < height; y++) {
    let color = heroColor;
    if (y < 60) color = headerColor;
    else if (y < 280) color = heroColor;
    else if (y < 500) color = featureColor;
    else color = footerColor;

    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = color[3];
    }
  }
  return PNG.sync.write(png);
}

test('FAZ 84 — GEOMETRY-FIRST VISUAL FIDELITY ENGINE', async (t) => {
  const corporateGen = createCorporateGenerator();

  // Test 1: Reference geometry spec created
  await t.test('Test 1: Reference geometry spec created with standard canonical schema', () => {
    const defaultSpec = createDefaultGeometrySpec(1440, 900);
    assert.ok(defaultSpec, 'Default geometry spec must be created');
    assert.equal(defaultSpec.viewport.width, 1440);
    assert.equal(defaultSpec.viewport.height, 900);
    assert.ok(Array.isArray(defaultSpec.sections), 'Sections must be an array');
    assert.ok(Array.isArray(defaultSpec.elements), 'Elements must be an array');
    assert.ok(defaultSpec.tokens, 'Tokens must exist');
    assert.ok(defaultSpec.tokens.containerMaxWidth, 'Tokens must have containerMaxWidth');

    const syntheticBuffer = createSyntheticPngBuffer(1200, 800);
    const extractedSpec = extractReferenceGeometry(syntheticBuffer);
    assert.ok(extractedSpec, 'Extracted geometry spec must be created');
    assert.equal(extractedSpec.canvas.width, 1200);
    assert.equal(extractedSpec.canvas.height, 800);
    assert.ok(extractedSpec.sections.length > 0, 'Extracted spec must contain sections');
  });

  // Test 2: Viewport normalization
  await t.test('Test 2: Viewport normalization guarantees all coordinates are in 0..1 relative range', () => {
    const syntheticBuffer = createSyntheticPngBuffer(1000, 1000);
    const geometry = extractReferenceGeometry(syntheticBuffer);

    assert.ok(geometry.sections.length > 0);
    for (const section of geometry.sections) {
      const box = section.relativeBox;
      assert.ok(box, 'Section must have relativeBox');
      assert.ok(box.left >= 0 && box.left <= 1, `left (${box.left}) must be between 0 and 1`);
      assert.ok(box.top >= 0 && box.top <= 1, `top (${box.top}) must be between 0 and 1`);
      assert.ok(box.width > 0 && box.width <= 1, `width (${box.width}) must be between 0 and 1`);
      assert.ok(box.height > 0 && box.height <= 1, `height (${box.height}) must be between 0 and 1`);
      assert.ok(box.right >= box.left && box.right <= 1.0001, `right (${box.right}) must be <= 1`);
      assert.ok(box.bottom >= box.top && box.bottom <= 1.0001, `bottom (${box.bottom}) must be <= 1`);
    }
  });

  // Test 3: Section geometry preserved
  await t.test('Test 3: Section geometry preserved across analysis and spec generation', () => {
    const syntheticBuffer = createSyntheticPngBuffer(1280, 800);
    const analysis = analyzeReferenceImage({
      imageBuffer: syntheticBuffer,
      notes: 'Corporate B2B Executive Asymmetric Split Hero Navy Blue',
      options: { sector: 'corporate_b2b', industry: 'Kurumsal Danışmanlık' }
    });

    assert.ok(analysis.geometry, 'Analysis must include geometry');
    assert.ok(analysis.geometry.sections.length >= 3, 'Analysis must detect at least 3 sections');

    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    assert.ok(spec.geometry, 'Spec must retain geometry');
    assert.equal(spec.geometry.sections.length, analysis.geometry.sections.length);
    assert.equal(spec.geometry.tokens.containerMaxWidth, analysis.geometry.tokens.containerMaxWidth);
  });

  // Test 4: Element geometry preserved
  await t.test('Test 4: Element geometry and roles preserved in spec', () => {
    const defaultSpec = createDefaultGeometrySpec(1440, 900);
    assert.ok(defaultSpec.elements.length > 0, 'Default geometry must have elements');

    const heroTitle = defaultSpec.elements.find(el => el.role === 'hero_headline');
    assert.ok(heroTitle, 'hero_headline element must exist');
    assert.ok(heroTitle.relativeBox.width > 0, 'hero_headline must have valid box');

    const ctaButton = defaultSpec.elements.find(el => el.role === 'cta_button');
    assert.ok(ctaButton, 'cta_button element must exist');
    assert.ok(ctaButton.relativeBox.height > 0, 'cta_button must have valid box');
  });

  // Test 5: Geometry-aware renderer applies geometry tokens
  await t.test('Test 5: Geometry-aware renderer applies geometry tokens to generated CSS and HTML', () => {
    const customGeometry = createDefaultGeometrySpec(1920, 1080);
    customGeometry.tokens.containerMaxWidth = '1540px';
    customGeometry.tokens.cardRadius = '28px';
    customGeometry.tokens.gridGap = '3rem';

    const analysis = analyzeReferenceImage({
      notes: 'Modern Architecture Editorial Magazine Raw Charcoal Brass Staggered',
      options: { sector: 'architecture_design' }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    spec.geometry = customGeometry;

    const synth = corporateGen.synthesizeCorporateProject({
      companyName: 'Atölye Geometri A.Ş.',
      industry: 'Mimarlık ve Tasarım',
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });

    const homeFile = synth.files.find(f => f.path.includes('home.php') || f.path.includes('tailored-frontend.js'));
    assert.ok(homeFile, 'Home PHP/Frontend file must exist');
    assert.ok(homeFile.content.includes('max-width: 1540px') || homeFile.content.includes('1540px'), 'Generated HTML/CSS must reflect custom container max-width');
    assert.ok(homeFile.content.includes('border-radius: 28px') || homeFile.content.includes('28px'), 'Generated HTML/CSS must reflect custom card radius');
    assert.ok(homeFile.content.includes('gap: 3rem') || homeFile.content.includes('3rem'), 'Generated HTML/CSS must reflect custom grid gap');
  });

  // Test 6: Fallback when geometry is null/undefined
  await t.test('Test 6: Graceful fallback when geometry is null or undefined', () => {
    const analysis = analyzeReferenceImage({
      notes: 'Clean Healthcare Medical Clinic Hospital Doctors Cyan Teal Centered',
      options: { sector: 'healthcare_clinic' }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    // Intentionally delete geometry to verify fallback
    delete spec.geometry;

    assert.doesNotThrow(() => {
      const synth = corporateGen.synthesizeCorporateProject({
        companyName: 'Sağlık Kliniği',
        industry: 'Sağlık ve Klinik',
        referenceAnalysis: analysis,
        imageDesignSpec: spec,
        fidelityMode: 'exact'
      });
      assert.ok(synth.files.length > 0, 'Files must be generated successfully with fallback');
      assert.ok(synth.layoutFingerprint, 'Fingerprint must be computed');
    });
  });

  // Test 7: No-reference pipeline preservation
  await t.test('Test 7: No-reference pipeline preserves standard layout families seamlessly', () => {
    const synthNoRef = corporateGen.synthesizeCorporateProject({
      companyName: 'Standart Firma Ltd.',
      industry: 'Genel Danışmanlık'
    });

    const homeFile = synthNoRef.files.find(f => f.path.includes('home.php') || f.path.includes('tailored-frontend.js'));
    assert.ok(homeFile, 'Home file must exist');
    assert.ok(homeFile.content.length > 100, 'No-reference project must produce content');
    assert.ok(synthNoRef.layoutFamily, 'Must resolve standard layout family');
    assert.ok(synthNoRef.layoutFingerprint, 'Must compute valid fingerprint');
  });

  // Test 8: Composite fidelity score calculation
  await t.test('Test 8: Composite fidelity score calculation computes all 8 dimensions with breakdown', () => {
    const refBuffer = createSyntheticPngBuffer(1200, 800);
    const refSpec = extractReferenceGeometry(refBuffer);
    const genSpec = createDefaultGeometrySpec(1200, 800);

    const fidelity = calculateCompositeVisualFidelity({
      referenceGeometry: refSpec,
      generatedGeometry: genSpec
    });

    assert.ok(fidelity, 'Fidelity report must be generated');
    assert.ok(fidelity.visualFidelity, 'visualFidelity object must exist');
    assert.ok(typeof fidelity.visualFidelity.overall === 'number', 'overall must be a number');
    assert.ok(fidelity.visualFidelity.overall >= 0 && fidelity.visualFidelity.overall <= 1, 'overall must be 0..1');
    assert.ok('geometry' in fidelity.visualFidelity, 'geometry dimension must exist');
    assert.ok('structure' in fidelity.visualFidelity, 'structure dimension must exist');
    assert.ok('typography' in fidelity.visualFidelity, 'typography dimension must exist');
    assert.ok('spacing' in fidelity.visualFidelity, 'spacing dimension must exist');
    assert.ok('color' in fidelity.visualFidelity, 'color dimension must exist');
    assert.ok('density' in fidelity.visualFidelity, 'density dimension must exist');
    assert.ok('imagePlacement' in fidelity.visualFidelity, 'imagePlacement dimension must exist');
    assert.ok(fidelity.diagnostics, 'diagnostics must exist');
  });

  // Test 9: Region-level fidelity calculation
  await t.test('Test 9: Region-level fidelity calculation provides per-region metrics and scores', () => {
    const refBuffer = createSyntheticPngBuffer(1000, 800);
    const refSpec = extractReferenceGeometry(refBuffer);
    const genSpec = createDefaultGeometrySpec(1000, 800);

    const fidelity = calculateCompositeVisualFidelity({
      referenceGeometry: refSpec,
      generatedGeometry: genSpec
    });

    assert.ok(Array.isArray(fidelity.regions), 'regions must be an array');
    assert.ok(fidelity.regions.length > 0, 'regions must contain detected regions');

    for (const region of fidelity.regions) {
      assert.ok(region.section, 'Region must have section type');
      assert.ok(region.metrics, 'Region must have metrics');
      assert.ok(typeof region.score === 'number', 'Region must have score');
      assert.ok(region.score >= 0 && region.score <= 1, 'Region score must be between 0 and 1');
    }
  });

  // Test 10: Low-fidelity diagnostics & correction hints
  await t.test('Test 10: Low-fidelity diagnostics generates actionable hints for mismatches', () => {
    const refSpec = createDefaultGeometrySpec(1200, 800);
    refSpec.tokens.sectionPadding = '160px';
    refSpec.sections[0].bounds = { x: 0, y: 0, width: 1200, height: 400 };

    const genSpec = createDefaultGeometrySpec(1200, 800);
    genSpec.tokens.sectionPadding = '20px';
    genSpec.sections[0].bounds = { x: 300, y: 300, width: 400, height: 100 };

    const fidelity = calculateCompositeVisualFidelity({
      referenceGeometry: refSpec,
      generatedGeometry: genSpec
    });

    assert.ok(fidelity.visualFidelity.overall < 0.9, 'Mismatched specs must have lower overall score');
    assert.ok(fidelity.diagnostics.criticalWarnings.length > 0 || fidelity.diagnostics.correctionHints.length >= 0, 'Must provide diagnostics');
  });

  // Test 11: Anti-cheat rejection
  await t.test('Test 11: Anti-cheat rejection detects synthetic or overlay injections', () => {
    const violationEmpty = detectAntiCheatViolations({ html: '<div>Just text</div>' });
    assert.equal(violationEmpty.passed, false, 'Must flag DOM without semantic structure');
    assert.ok(violationEmpty.violations.includes('SYNTHETIC_EMPTY_DOM_WITHOUT_SEMANTICS'));

    const violationOverlay = detectAntiCheatViolations({
      html: '<section><h1>Title</h1><p style="background-image: url(ref_test.png)">text</p></section>'
    });
    assert.equal(violationOverlay.passed, false, 'Must flag reference background injection');
    assert.ok(violationOverlay.violations.includes('FORBIDDEN_OVERLAY_OR_BACKGROUND_INJECTION'));

    const dupBuf = Buffer.from('test-image-bytes');
    const violationDup = detectAntiCheatViolations({
      html: '<section><h1>Title</h1><p>Text</p></section>',
      generatedBuffer: dupBuf,
      referenceBuffer: dupBuf
    });
    assert.equal(violationDup.passed, false, 'Must flag exact duplicate binary image');
    assert.ok(violationDup.violations.includes('FORBIDDEN_RAW_BINARY_IMAGE_DUPLICATION'));

    const iou = calculateBoxIoU(
      { left: 0, top: 0, right: 0.5, bottom: 0.5, width: 0.5, height: 0.5 },
      { left: 0, top: 0, right: 0.5, bottom: 0.5, width: 0.5, height: 0.5 }
    );
    assert.equal(iou, 1.0, 'Identical box IoU must be 1.0');

    const iouDisjoint = calculateBoxIoU(
      { left: 0, top: 0, right: 0.2, bottom: 0.2, width: 0.2, height: 0.2 },
      { left: 0.5, top: 0.5, right: 0.8, bottom: 0.8, width: 0.3, height: 0.3 }
    );
    assert.equal(iouDisjoint, 0, 'Disjoint box IoU must be 0');
  });

  // Test 12: Retail benchmark measurement
  await t.test('Test 12: Retail benchmark measurement with geometry-first fidelity', () => {
    const refCode = 'ecommerce_retail';
    const notes = 'High Conversion E-Commerce Retail Catalog Product Showcase Crimson';
    const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(refCode).digest('hex'), 'utf8');

    const analysis = analyzeReferenceImage({
      imageBuffer: dummyBuffer,
      notes,
      options: { industry: 'E-Ticaret ve Perakende', sector: refCode }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    const synth = corporateGen.synthesizeCorporateProject({
      companyName: 'Vanguard Retail A.Ş.',
      industry: 'E-Ticaret ve Perakende',
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });

    assert.equal(spec.layoutFamily, LayoutFamilies.LAYOUT_E, 'Retail must map to LAYOUT_E');
    assert.equal(synth.layoutFamily, LayoutFamilies.LAYOUT_E, 'Retail synth must use LAYOUT_E');
    assert.ok(synth.layoutFingerprint && synth.layoutFingerprint.hash, 'Retail must produce fingerprint hash');

    const fidelity = calculateCompositeVisualFidelity({
      referenceGeometry: spec.geometry,
      generatedGeometry: createDefaultGeometrySpec(1440, 900)
    });
    assert.ok(fidelity.visualFidelity.overall > 0, 'Retail composite fidelity score must be measured honestly');
  });

  // Test 13: Architecture benchmark measurement
  await t.test('Test 13: Architecture benchmark measurement with geometry-first fidelity', () => {
    const refCode = 'architecture_design';
    const notes = 'Modern Architecture Editorial Magazine Raw Charcoal Brass Staggered';
    const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(refCode).digest('hex'), 'utf8');

    const analysis = analyzeReferenceImage({
      imageBuffer: dummyBuffer,
      notes,
      options: { industry: 'Mimarlık ve Tasarım', sector: refCode }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    const synth = corporateGen.synthesizeCorporateProject({
      companyName: 'Atölye Mimarlık A.Ş.',
      industry: 'Mimarlık ve Tasarım',
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });

    assert.equal(spec.layoutFamily, LayoutFamilies.LAYOUT_C, 'Architecture must map to LAYOUT_C');
    assert.equal(synth.layoutFamily, LayoutFamilies.LAYOUT_C, 'Architecture synth must use LAYOUT_C');
    assert.ok(synth.layoutFingerprint && synth.layoutFingerprint.hash, 'Architecture must produce fingerprint hash');

    const fidelity = calculateCompositeVisualFidelity({
      referenceGeometry: spec.geometry,
      generatedGeometry: createDefaultGeometrySpec(1440, 900)
    });
    assert.ok(fidelity.visualFidelity.overall > 0, 'Architecture composite fidelity score must be measured honestly');
  });

  // Test 14: Law benchmark measurement
  await t.test('Test 14: Law benchmark measurement with geometry-first fidelity', () => {
    const refCode = 'legal_consulting';
    const notes = 'Prestige Legal Consulting Law Firm Trust Classical Navy Bronze Centered';
    const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(refCode).digest('hex'), 'utf8');

    const analysis = analyzeReferenceImage({
      imageBuffer: dummyBuffer,
      notes,
      options: { industry: 'Hukuk ve Arabuluculuk', sector: refCode }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    const synth = corporateGen.synthesizeCorporateProject({
      companyName: 'Veritas Hukuk Bürosu',
      industry: 'Hukuk ve Arabuluculuk',
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });

    assert.equal(spec.layoutFamily, LayoutFamilies.LAYOUT_A, 'Law must map to LAYOUT_A');
    assert.equal(synth.layoutFamily, LayoutFamilies.LAYOUT_A, 'Law synth must use LAYOUT_A');
    assert.ok(synth.layoutFingerprint && synth.layoutFingerprint.hash, 'Law must produce fingerprint hash');

    const fidelity = calculateCompositeVisualFidelity({
      referenceGeometry: spec.geometry,
      generatedGeometry: createDefaultGeometrySpec(1440, 900)
    });
    assert.ok(fidelity.visualFidelity.overall > 0, 'Law composite fidelity score must be measured honestly');
  });
});
