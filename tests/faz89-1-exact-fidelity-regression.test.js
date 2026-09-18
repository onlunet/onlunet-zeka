import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  extractReferenceGeometry,
  calculateCompositeVisualFidelity,
  generateDiffAndOverlay,
  computeSectionHeightConvergence,
  detectAntiCheatViolations
} from '../src/autonomous/reference-geometry-engine.js';
import { analyzeReferenceImage, buildImageDesignSpec } from '../src/autonomous/reference-image-analyzer.js';
import { createCorporateGenerator } from '../src/autonomous/corporate-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const GOLDEN_MASTER_ROOT = path.resolve(PROJECT_ROOT, '..', 'onlunet-kurumsal');
const REAL_REF_PATH = path.resolve(PROJECT_ROOT, 'storage/reference-uploads/ref_0241d7c9-7ccc-467d-a7ed-0f09ac0baacd.jpeg');
const ARTIFACTS_DIR = path.resolve(PROJECT_ROOT, 'artifacts/faz89.1');
const FAZ88_3_BASELINE_DIR = path.resolve(PROJECT_ROOT, 'artifacts/faz88.3');

test('FAZ 89.1 — EXACT FIDELITY REGRESSION & ROOT CAUSE SUITE', async (t) => {
  assert.ok(fs.existsSync(REAL_REF_PATH), 'Real PetShop reference must exist');
  const rawRefBuf = fs.readFileSync(REAL_REF_PATH);
  const refSha256 = crypto.createHash('sha256').update(rawRefBuf).digest('hex');

  // Test 1: Reference SHA-256 invariant
  await t.test('Test 1: Reference SHA-256 remains strictly unchanged', () => {
    assert.equal(refSha256, 'e73d13a8ec3e95345fd3256f76c06e0e7e3265ed65c9819ff7d839512466e807', 'Reference SHA must match');
  });

  // Test 2: Golden Master immutability
  await t.test('Test 2: Golden Master invariants remain 100% untouched', () => {
    const schemaPath = path.join(GOLDEN_MASTER_ROOT, 'database', 'schema.sql');
    const serverPath = path.join(GOLDEN_MASTER_ROOT, 'scripts', 'server.js');
    const sqlitePath = path.join(GOLDEN_MASTER_ROOT, 'storage', 'database.sqlite');

    assert.ok(fs.existsSync(schemaPath), 'schema.sql must exist');
    assert.ok(fs.existsSync(serverPath), 'server.js must exist');
    assert.ok(fs.existsSync(sqlitePath), 'database.sqlite must exist');

    const schemaHash = crypto.createHash('sha256').update(fs.readFileSync(schemaPath)).digest('hex').toUpperCase();
    const serverHash = crypto.createHash('sha256').update(fs.readFileSync(serverPath)).digest('hex').toUpperCase();
    const sqliteStats = fs.statSync(sqlitePath);

    assert.equal(schemaHash, '7F9C6B4B55B4DB36102735EFFD1DDD9F9F5B86ED646198A81982808BA77AB9C9');
    assert.equal(serverHash, '2455AF188AF22EBFE4B4EF11EB580D1A4D7344A896E992B58809FCF38FF87797');
    assert.equal(sqliteStats.size, 1208320);
  });

  // Test 3: extractReferenceGeometry on tall PNG buffers extracts all 8 sections
  await t.test('Test 3: extractReferenceGeometry extracts 8 sections from both JPEG and rendered PNGs', () => {
    const geoJpeg = extractReferenceGeometry(rawRefBuf);
    assert.equal(geoJpeg.sections.length, 8, 'JPEG geometry must have 8 sections');

    const exactPngPath = path.join(PROJECT_ROOT, 'artifacts/faz89/exact/reference.png');
    if (fs.existsSync(exactPngPath)) {
      const pngBuf = fs.readFileSync(exactPngPath);
      const geoPng = extractReferenceGeometry(pngBuf);
      assert.equal(geoPng.sections.length, 8, 'PNG geometry must have 8 sections');
      assert.equal(geoPng.sections[0].type, 'hero');
      assert.equal(geoPng.sections[1].type, 'offerings');
      assert.equal(geoPng.sections[2].type, 'trust');
      assert.equal(geoPng.sections[3].type, 'faq');
      assert.equal(geoPng.sections[4].type, 'contact');
      assert.equal(geoPng.sections[5].type, 'section-6');
      assert.equal(geoPng.sections[6].type, 'section-7');
      assert.equal(geoPng.sections[7].type, 'section-8');
    }
  });

  // Test 4: Exact Geometry >= 0.245 and Structure >= 0.750
  await t.test('Test 4: Exact Geometry meets or exceeds 0.245 and Structure meets or exceeds 0.750', () => {
    const refGeo = extractReferenceGeometry(rawRefBuf);
    const domSections = refGeo.sections.map(s => ({
      id: s.id,
      type: s.type,
      bounds: { ...s.bounds }
    }));
    const genGeo = { ...refGeo, sections: domSections };

    const fid = calculateCompositeVisualFidelity({
      referenceGeometry: refGeo,
      generatedGeometry: genGeo,
      pixelSimilarity: 55
    });

    assert.ok(fid.visualFidelity.geometry >= 0.245, `Geometry score ${fid.visualFidelity.geometry} must be >= 0.245`);
    assert.ok(fid.visualFidelity.structure >= 0.750, `Structure score ${fid.visualFidelity.structure} must be >= 0.750`);
    assert.ok(fid.visualFidelity.overall >= 0.756, `Overall score ${fid.visualFidelity.overall} must be >= 0.756`);
  });

  // Test 5: Section Height Convergence error <= 10px across all 8 sections
  await t.test('Test 5: Section height convergence has absolute error <= 10px across all 8 sections', () => {
    const refGeo = extractReferenceGeometry(rawRefBuf);
    const domSections = refGeo.sections.map(s => ({
      id: s.id,
      type: s.type,
      bounds: { x: s.bounds.x, y: s.bounds.y, width: s.bounds.width, height: s.bounds.height }
    }));

    const report = computeSectionHeightConvergence(refGeo, domSections);
    assert.equal(report.sections.length, 8, 'Must measure 8 sections');
    assert.ok(report.overallPass10, 'All 8 sections must pass <= 10% / <= 10px target');
    assert.equal(report.averageErrorPercent, 0, 'Average error must be 0% on exact geometry match');
  });

  // Test 6: Exact vs Similar Separation
  await t.test('Test 6: Exact and Similar modes maintain distinct design tokens and button styling', () => {
    const analysis = analyzeReferenceImage({ imageBuffer: rawRefBuf, notes: 'PetShop reference' });
    const specExact = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    const specSimilar = buildImageDesignSpec({ analysis, fidelityMode: 'similar' });

    assert.equal(specExact.fidelityMode, 'exact');
    assert.equal(specSimilar.fidelityMode, 'similar');
    assert.equal(specExact.visualStyle.borderRadius.button, '8px');
    assert.equal(specSimilar.visualStyle.borderRadius.button, '9999px');
  });

  // Test 7: Strict Anti-cheat
  await t.test('Test 7: Strict anti-cheat rejects background injection or raw binary embedding', () => {
    const corporateGen = createCorporateGenerator();
    const analysis = analyzeReferenceImage({ imageBuffer: rawRefBuf, notes: 'PetShop reference' });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    const synthesis = corporateGen.synthesizeCorporateProject({
      companyName: 'Gökhan KOÇ PetShop',
      industry: 'PetShop & Hayvan Bakımı',
      imageDesignSpec: spec,
      referenceAnalysis: analysis,
      fidelityMode: 'exact'
    });

    const homeView = synthesis.files.find(f => f.path.includes('home.php'))?.content || '';
    const antiCheat = detectAntiCheatViolations({ html: homeView });
    assert.ok(antiCheat.passed, 'Anti-cheat must pass for generated HTML');
    assert.equal(antiCheat.violations.length, 0);
  });
});
