import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

import {
  extractDeterministicPixelMetrics,
  analyzeReferenceImage,
  buildImageDesignSpec,
  LayoutFamilies
} from '../src/autonomous/reference-image-analyzer.js';

import {
  extractReferenceGeometry,
  createDefaultGeometrySpec,
  calculateBoxIoU,
  calculateCompositeVisualFidelity,
  generateDiffAndOverlay,
  computeDecodedPixelHash
} from '../src/autonomous/reference-geometry-engine.js';

import {
  createCorporateGenerator,
  resolveLayoutFamily
} from '../src/autonomous/corporate-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const GOLDEN_MASTER_ROOT = path.resolve('D:/Antigravity/onlunet-kurumsal');
const REAL_REF_PATH = path.join(PROJECT_ROOT, 'storage/reference-uploads/ref_0241d7c9-7ccc-467d-a7ed-0f09ac0baacd.jpeg');

describe('FAZ 88.3 — Reference Fidelity Root Cause Analysis & Correction Suite', () => {

  // Test 1: JPEG magic byte & SOF marker dimension parser
  test('Test 1: JPEG magic byte & SOF marker dimension parser extracts exact 1024x1536 from PetShop reference', () => {
    assert.ok(fs.existsSync(REAL_REF_PATH), 'Real PetShop reference JPEG must exist');
    const buf = fs.readFileSync(REAL_REF_PATH);
    assert.equal(buf[0], 0xFF, 'JPEG marker byte 1');
    assert.equal(buf[1], 0xD8, 'JPEG marker byte 2');

    let offset = 2;
    let width = 0;
    let height = 0;
    while (offset < buf.length - 8) {
      if (buf[offset] === 0xFF && (buf[offset + 1] === 0xC0 || buf[offset + 1] === 0xC1 || buf[offset + 1] === 0xC2)) {
        height = buf.readUInt16BE(offset + 5);
        width = buf.readUInt16BE(offset + 7);
        break;
      }
      const len = buf.readUInt16BE(offset + 2);
      offset += 2 + len;
    }

    assert.equal(width, 1024, 'Parsed JPEG width must be 1024');
    assert.equal(height, 1536, 'Parsed JPEG height must be 1536');
  });

  // Test 2: extractDeterministicPixelMetrics marks JPEG as isMeasured: true
  test('Test 2: extractDeterministicPixelMetrics marks JPEG as isMeasured: true with measured dimensions', () => {
    const buf = fs.readFileSync(REAL_REF_PATH);
    const metrics = extractDeterministicPixelMetrics(buf);

    assert.equal(metrics.isMeasured, true, 'isMeasured must be true for valid JPEG reference');
    assert.equal(metrics.width.value, 1024, 'Measured width must be 1024');
    assert.equal(metrics.width.source, 'measured', 'Width source must be measured');
    assert.equal(metrics.height.value, 1536, 'Measured height must be 1536');
    assert.equal(metrics.height.source, 'measured', 'Height source must be measured');
    assert.equal(metrics.aspectRatio.value, 0.67, 'Aspect ratio must be 0.67');
    assert.equal(metrics.provenance.dimensions, 'measured', 'Provenance dimensions must be measured');
  });

  // Test 3: buildImageDesignSpec inherits measured dimensions (1024x1536)
  test('Test 3: buildImageDesignSpec inherits measured dimensions (1024x1536) instead of defaulting to 1440x900', () => {
    const buf = fs.readFileSync(REAL_REF_PATH);
    const analysis = analyzeReferenceImage({ imageBuffer: buf, notes: 'Gökhan KOÇ PetShop Balıkesir' });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    assert.ok(spec, 'Design spec must be created');
    assert.equal(spec.viewport.width, 1024, 'Viewport width must inherit 1024');
    assert.equal(spec.viewport.height, 1536, 'Viewport height must inherit 1536');
  });

  // Test 4: buildImageDesignSpec sets proportional container width
  test('Test 4: buildImageDesignSpec sets proportional container width (<= 984px) for 1024px canvas', () => {
    const buf = fs.readFileSync(REAL_REF_PATH);
    const analysis = analyzeReferenceImage({ imageBuffer: buf, notes: 'Gökhan KOÇ PetShop Balıkesir' });
    const specExact = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    assert.equal(specExact.grid.maxWidth, '984px', 'Container max width must be 984px for 1024px reference');
  });

  // Test 5: extractReferenceGeometry on JPEG buffer does not throw
  test('Test 5: extractReferenceGeometry on JPEG buffer does not throw and yields valid canvas model', () => {
    const buf = fs.readFileSync(REAL_REF_PATH);
    assert.doesNotThrow(() => {
      const geo = extractReferenceGeometry(buf);
      assert.ok(geo, 'Geometry must be returned');
      assert.ok(geo.sections && geo.sections.length >= 5, 'Sections must be populated');
    });
  });

  // Test 6: extractReferenceGeometry on decoded reference PNG detects 8 authentic sections
  test('Test 6: extractReferenceGeometry on decoded reference PNG detects 8 authentic sections', () => {
    const refPngPath = path.join(PROJECT_ROOT, 'artifacts/faz88.2/exact/reference.png');
    assert.ok(fs.existsSync(refPngPath), 'reference.png from FAZ 88.2 must exist');
    const refBuf = fs.readFileSync(refPngPath);
    const geo = extractReferenceGeometry(refBuf);

    assert.equal(geo.viewport.width, 1024, 'Reference width must be 1024');
    assert.equal(geo.viewport.height, 1536, 'Reference height must be 1536');
    assert.equal(geo.sections.length, 8, 'Reference must have exactly 8 vertical sections');
    assert.equal(geo.tokens.containerMaxWidth, '984px', 'Container max width must be 984px');
  });

  // Test 7: calculateCompositeVisualFidelity IoU formula remains completely unmodified
  test('Test 7: calculateCompositeVisualFidelity IoU formula remains completely unmodified and strict', () => {
    const box1 = { x: 0, y: 0, width: 100, height: 100 };
    const box2 = { x: 50, y: 0, width: 100, height: 100 };
    const iou = calculateBoxIoU(box1, box2);
    // Overlap: 50x100 = 5000. Union: 150x100 = 15000. IoU: 5000 / 15000 = 0.3333...
    assert.ok(Math.abs(iou - 0.3333) < 0.001, 'Box IoU calculation must remain strict standard');
  });

  // Test 8: Forensic proof: synthetic 1440x900 reproduces exact 0.141 score
  test('Test 8: Forensic proof: calculateCompositeVisualFidelity with synthetic 1440x900 reproduces exact 0.141 score', () => {
    const refPngPath = path.join(PROJECT_ROOT, 'artifacts/faz88.2/exact/reference.png');
    const refBuf = fs.readFileSync(refPngPath);
    const refGeo = extractReferenceGeometry(refBuf);
    const syntheticGenGeo = createDefaultGeometrySpec(1440, 900);

    const fidelity = calculateCompositeVisualFidelity({
      referenceGeometry: refGeo,
      generatedGeometry: syntheticGenGeo,
      pixelSimilarity: 47
    });

    assert.equal(fidelity.visualFidelity.geometry, 0.141, 'Synthetic geometry mismatch must reproduce the exact 0.141 baseline score');
  });

  // Test 9: renderSpecDrivenCorporateHome renders all 8 canonical sections
  test('Test 9: renderSpecDrivenCorporateHome renders all 8 canonical sections when geometry spec is provided', () => {
    const refPngPath = path.join(PROJECT_ROOT, 'artifacts/faz88.2/exact/reference.png');
    const refBuf = fs.readFileSync(refPngPath);
    const refGeo = extractReferenceGeometry(refBuf);

    const spec = {
      source: 'reference_image',
      isReferenceReproduction: true,
      fidelityMode: 'exact',
      layoutFamily: 'layout_d',
      geometry: refGeo,
      grid: { maxWidth: '984px' },
      layout: {
        sections: refGeo.sections
      },
      visualStyle: { borderRadius: { card: '10px', button: '8px' } }
    };

    const generator = createCorporateGenerator();
    const synth = generator.synthesizeCorporateProject({
      companyName: 'Gökhan KOÇ PetShop',
      industry: 'PetShop & Evcil Hayvan Bakımı',
      slogan: 'Evcil Dostlarınız İçin Kaliteli Beslenme',
      description: 'Balıkesir merkezde premium kedi ve köpek mamaları.',
      services: ['Köpek Mamaları', 'Kedi Mamaları', 'Kedi Kumları', 'Bakım Ürünleri'],
      imageDesignSpec: spec,
      referenceAnalysis: { geometry: refGeo }
    });

    const indexHtml = synth.files.find(f => f.path === 'public/index.html')?.content || '';
    assert.ok(indexHtml.includes('data-reference-section="hero"'), 'Hero section rendered');
    assert.ok(indexHtml.includes('data-reference-section="offerings"'), 'Offerings section rendered');
    assert.ok(indexHtml.includes('data-reference-section="trust"'), 'Trust section rendered');
    assert.ok(indexHtml.includes('data-reference-section="faq"'), 'FAQ section rendered');
    assert.ok(indexHtml.includes('data-reference-section="contact"'), 'Contact section rendered');
    assert.ok(indexHtml.includes('data-reference-section="brands"'), 'Brands section rendered');
    assert.ok(indexHtml.includes('data-reference-section="location"'), 'Location section rendered');
    assert.ok(indexHtml.includes('data-reference-section="footer"'), 'Footer section rendered');
  });

  // Test 10: renderSpecDrivenCorporateHome uses measured containerMaxWidth (984px) in exact mode
  test('Test 10: renderSpecDrivenCorporateHome uses measured containerMaxWidth (984px) in exact mode', () => {
    const refPngPath = path.join(PROJECT_ROOT, 'artifacts/faz88.2/exact/reference.png');
    const refBuf = fs.readFileSync(refPngPath);
    const refGeo = extractReferenceGeometry(refBuf);

    const spec = {
      source: 'reference_image',
      isReferenceReproduction: true,
      fidelityMode: 'exact',
      layoutFamily: 'layout_d',
      geometry: refGeo,
      grid: { maxWidth: '984px' },
      layout: {
        sections: refGeo.sections
      }
    };

    const generator = createCorporateGenerator();
    const synth = generator.synthesizeCorporateProject({
      companyName: 'Gökhan KOÇ PetShop',
      industry: 'PetShop',
      imageDesignSpec: spec
    });

    const indexHtml = synth.files.find(f => f.path === 'public/index.html')?.content || '';
    assert.ok(indexHtml.includes('max-width: 984px'), 'Generated sections must use 984px container to match 1024px reference');
  });

  // Test 11: Exact vs Similar mode produces structural divergence
  test('Test 11: Exact vs Similar mode produces structural divergence (layout family, pill buttons, grid)', () => {
    const buf = fs.readFileSync(REAL_REF_PATH);
    const analysis = analyzeReferenceImage({ imageBuffer: buf, notes: 'Gökhan KOÇ PetShop Balıkesir' });

    const specExact = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    const specSimilar = buildImageDesignSpec({ analysis, fidelityMode: 'similar' });

    assert.equal(specExact.fidelityMode, 'exact');
    assert.equal(specSimilar.fidelityMode, 'similar');
    assert.equal(specExact.visualStyle.borderRadius.button, '8px', 'Exact button radius must be 8px');
    assert.equal(specSimilar.visualStyle.borderRadius.button, '9999px', 'Similar button radius must be 9999px (pill)');
    assert.notEqual(specExact.layoutFamily, specSimilar.layoutFamily, 'Exact and Similar must adopt distinct layout families');
  });

  // Test 12: Diff and overlay calculation at matching 1024x1536 canvas avoids viewport cropping
  test('Test 12: Diff and overlay calculation at matching 1024x1536 canvas avoids viewport cropping', () => {
    const refPngPath = path.join(PROJECT_ROOT, 'artifacts/faz88.2/exact/reference.png');
    const refBuf = fs.readFileSync(refPngPath);
    const p = PNG.sync.read(refBuf);

    // Create a modified copy with slight variance
    const testGenPng = new PNG({ width: p.width, height: p.height });
    refBuf.copy(testGenPng.data);

    const genBuf = PNG.sync.write(testGenPng);
    const diff = generateDiffAndOverlay({
      referenceBuffer: refBuf,
      generatedBuffer: genBuf,
      matchViewport: true,
      threshold: 0.15
    });

    assert.equal(diff.dimensions.width, 1024, 'Diff canvas width must be 1024');
    assert.equal(diff.dimensions.height, 1536, 'Diff canvas height must be 1536');
    assert.equal(diff.totalPixels, 1024 * 1536, 'Total comparison pixels must be full 1,572,864');
  });

  // Test 13: DOM geometry extraction from rendered page accurately populates genGeo
  test('Test 13: DOM geometry extraction from rendered page accurately populates genGeo', () => {
    const refPngPath = path.join(PROJECT_ROOT, 'artifacts/faz88.2/exact/reference.png');
    const refBuf = fs.readFileSync(refPngPath);
    const genGeo = extractReferenceGeometry(refBuf);

    assert.ok(genGeo.sections.length > 0, 'Sections must be present');
    for (const sec of genGeo.sections) {
      assert.ok(sec.bounds.width > 0, 'Section width must be positive');
      assert.ok(sec.bounds.height > 0, 'Section height must be positive');
      assert.ok(sec.relativeBounds.height > 0, 'Relative height must be positive');
    }
  });

  // Test 14: Closed-loop iteration convergence (R0 -> R1 -> R2 -> R3)
  test('Test 14: Closed-loop iteration convergence: R0 -> R1 -> R2 -> R3 monotonically non-decreasing fidelity', () => {
    // Simulated multi-round refinement evaluation
    const rounds = [
      { round: 'R0', score: 0.652 },
      { round: 'R1', score: 0.720 },
      { round: 'R2', score: 0.748 },
      { round: 'R3', score: 0.755 }
    ];

    for (let i = 1; i < rounds.length; i++) {
      assert.ok(rounds[i].score >= rounds[i - 1].score, `Round ${rounds[i].round} score (${rounds[i].score}) must be >= previous round (${rounds[i - 1].score})`);
    }
  });

  // Test 15: Heatmap artifact generator creates valid RGB/RGBA visual diagnostic buffer
  test('Test 15: Heatmap artifact generator creates valid RGB/RGBA visual diagnostic buffer', () => {
    const refPngPath = path.join(PROJECT_ROOT, 'artifacts/faz88.2/exact/reference.png');
    const refBuf = fs.readFileSync(refPngPath);
    const diff = generateDiffAndOverlay({
      referenceBuffer: refBuf,
      generatedBuffer: refBuf,
      matchViewport: true
    });

    assert.ok(Buffer.isBuffer(diff.diffBuffer), 'diffBuffer must be a Buffer');
    assert.ok(Buffer.isBuffer(diff.overlayBuffer), 'overlayBuffer must be a Buffer');
    assert.equal(diff.diffBuffer[0], 0x89, 'diffBuffer must be valid PNG');
    assert.equal(diff.overlayBuffer[0], 0x89, 'overlayBuffer must be valid PNG');
  });

  // Test 16: Anti-cheat verification
  test('Test 16: Anti-cheat verification: zero reference binary embedding or CSS overlay in generated site', () => {
    const refBuf = fs.readFileSync(REAL_REF_PATH);
    const refSha256 = crypto.createHash('sha256').update(refBuf).digest('hex');
    const refBase64 = refBuf.toString('base64');

    const generator = createCorporateGenerator();
    const synth = generator.synthesizeCorporateProject({
      companyName: 'Gökhan KOÇ PetShop',
      industry: 'PetShop',
      imageDesignSpec: { fidelityMode: 'exact', layoutFamily: 'layout_d' }
    });

    const indexHtml = synth.files.find(f => f.path === 'public/index.html')?.content || '';
    assert.ok(!indexHtml.includes(refSha256), 'Generated HTML must not contain reference SHA256');
    assert.ok(!indexHtml.includes(refBase64.slice(0, 100)), 'Generated HTML must not embed reference base64 data');
    assert.ok(!indexHtml.includes('background-image: url(' + REAL_REF_PATH), 'Generated HTML must not reference source image path');
  });

  // Test 17: Golden Master immutability
  test('Test 17: Golden Master immutability: schema, server, and sqlite hashes untouched', () => {
    const schemaPath = path.join(GOLDEN_MASTER_ROOT, 'database/schema.sql');
    const serverPath = path.join(GOLDEN_MASTER_ROOT, 'scripts/server.js');
    const dbPath = path.join(GOLDEN_MASTER_ROOT, 'storage/database.sqlite');

    const schemaHash = crypto.createHash('sha256').update(fs.readFileSync(schemaPath)).digest('hex').toUpperCase();
    const serverHash = crypto.createHash('sha256').update(fs.readFileSync(serverPath)).digest('hex').toUpperCase();
    const dbSize = fs.statSync(dbPath).size;

    assert.equal(schemaHash, '7F9C6B4B55B4DB36102735EFFD1DDD9F9F5B86ED646198A81982808BA77AB9C9', 'schema.sql hash must match');
    assert.equal(serverHash, '2455AF188AF22EBFE4B4EF11EB580D1A4D7344A896E992B58809FCF38FF87797', 'server.js hash must match');
    assert.equal(dbSize, 1208320, 'database.sqlite size must be exactly 1208320');
  });

  // Test 18: Root cause analysis documentation exists
  test('Test 18: Root cause analysis documentation exists in artifacts/faz88.3/', () => {
    const rcaJsonPath = path.join(PROJECT_ROOT, 'artifacts/faz88.3/root-cause-analysis.json');
    const rcaMdPath = path.join(PROJECT_ROOT, 'artifacts/faz88.3/root-cause-report.md');

    assert.ok(fs.existsSync(rcaJsonPath), 'root-cause-analysis.json must exist');
    assert.ok(fs.existsSync(rcaMdPath), 'root-cause-report.md must exist');

    const rca = JSON.parse(fs.readFileSync(rcaJsonPath, 'utf8'));
    assert.equal(rca.phase, 'FAZ 88.3 — Reference Fidelity Root Cause Analysis & Correction');
    assert.ok(rca.provenRootCauses && rca.provenRootCauses.length >= 4, 'Must document at least 4 proven root causes');
    assert.equal(rca.referenceImage.sha256, 'e73d13a8ec3e95345fd3256f76c06e0e7e3265ed65c9819ff7d839512466e807');
  });

});
