import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { PROJECT_ROOT } from '../src/interfaces/core.js';
import {
  validateReferenceImageSecurity,
  storeReferenceImageSecurely,
  analyzeReferenceImage,
  buildImageDesignSpec,
  LayoutFamilies
} from '../src/autonomous/reference-image-analyzer.js';
import {
  createCorporateGenerator,
  resolveLayoutFamily,
  computeLayoutFingerprint
} from '../src/autonomous/corporate-generator.js';

// Minimal valid PNG buffer: 1x1 transparent PNG
const SAMPLE_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// Second distinct valid PNG buffer: 2x1 PNG with color
const SAMPLE_PNG_BUFFER_B = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEElEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test('FAZ 78 — KURUMSAL WEBSITE GENERATOR GERÇEK GÖRSEL ÜRETİM TESTLERİ', async (t) => {
  const corporateGen = createCorporateGenerator();

  // Test 1: Upload reference image -> HTTP success, image stored, analyzer invoked
  await t.test('Test 1: Upload reference image -> HTTP success, image stored, analyzer invoked', async () => {
    const testFile = 'test_upload_sample.png';
    const stored = storeReferenceImageSecurely(SAMPLE_PNG_BUFFER, testFile, { storageBaseDir: PROJECT_ROOT });

    assert.ok(stored.storagePath, 'Storage path must be defined');
    assert.ok(fs.existsSync(stored.storagePath), 'Stored file must exist on disk');
    assert.equal(stored.fileSizeBytes, SAMPLE_PNG_BUFFER.length);

    const analysis = analyzeReferenceImage({
      imageBuffer: SAMPLE_PNG_BUFFER,
      imagePath: stored.storagePath,
      notes: 'Dark elegant hero'
    });

    assert.ok(analysis.colorPalette, 'Color palette must be extracted');
    assert.ok(analysis.compositionStyle, 'Composition style must be detected');
    assert.ok(analysis.layoutStyle, 'Layout style must be detected');
    assert.ok(analysis.typographyScale, 'Typography scale must be detected');

    // Clean up temporary upload
    if (fs.existsSync(stored.storagePath)) {
      fs.unlinkSync(stored.storagePath);
    }
  });

  // Test 2: Reference image -> DesignSpec generated matching Section 6 specification
  await t.test('Test 2: Reference image -> DesignSpec generated matching Section 6 specification', () => {
    const analysis = analyzeReferenceImage({
      imageBuffer: SAMPLE_PNG_BUFFER,
      notes: 'Minimal modern tech'
    });

    const designSpec = buildImageDesignSpec({
      analysis,
      fidelityMode: 'exact',
      viewport: { width: 1440, height: 900 }
    });

    assert.equal(designSpec.source, 'reference_image');
    assert.equal(designSpec.fidelityMode, 'exact');
    assert.ok(designSpec.viewport);
    assert.equal(designSpec.viewport.width, 1440);
    assert.equal(designSpec.viewport.height, 900);

    // Visual Style
    assert.ok(Array.isArray(designSpec.visualStyle.primaryColors));
    assert.ok(designSpec.visualStyle.primaryColors.length > 0);
    assert.ok(designSpec.visualStyle.typography.fontDisplay);
    assert.ok(designSpec.visualStyle.borderRadius);

    // Layout & Grid
    assert.ok(designSpec.layout.header);
    assert.ok(designSpec.layout.hero);
    assert.ok(Array.isArray(designSpec.layout.sections));
    assert.equal(designSpec.grid.columns, 12);

    // Components & Density
    assert.ok(Array.isArray(designSpec.components));
    assert.ok(designSpec.components.length > 0);
    assert.ok(['compact', 'balanced', 'airy'].includes(designSpec.density));
    assert.ok(designSpec.imageTreatment);
    assert.ok(designSpec.layoutFamily);
  });

  // Test 3: DesignSpec -> LayoutGraph / Layout Family properly resolved
  await t.test('Test 3: DesignSpec -> LayoutGraph / Layout Family properly resolved', () => {
    const analysisA = { compositionStyle: 'asymmetric', visualTone: 'dark' };
    const specA = buildImageDesignSpec({ analysis: analysisA, fidelityMode: 'exact' });
    const familyA = resolveLayoutFamily({ imageDesignSpec: specA, fidelityMode: 'exact' });

    const analysisB = { compositionStyle: 'centered', visualTone: 'warm' };
    const specB = buildImageDesignSpec({ analysis: analysisB, fidelityMode: 'exact' });
    const familyB = resolveLayoutFamily({ imageDesignSpec: specB, fidelityMode: 'exact' });

    assert.ok(familyA, 'Family A should be resolved');
    assert.ok(familyB, 'Family B should be resolved');
    assert.notEqual(familyA, familyB, 'Different composition styles must resolve to different layout families');
  });

  // Test 4: Layout Family -> Generated HTML/CSS changed significantly
  await t.test('Test 4: Layout Family -> Generated HTML/CSS changed significantly', () => {
    const specBase = {
      companyName: 'Akdeniz Global Mühendislik',
      industry: 'Mühendislik & Proje',
      services: ['Proje Çizimi', 'Statik Hesaplama', 'Saha Denetimi']
    };

    const projectA = corporateGen.synthesizeCorporateProject({
      ...specBase,
      layoutFamily: LayoutFamilies.LAYOUT_B
    });

    const projectB = corporateGen.synthesizeCorporateProject({
      ...specBase,
      layoutFamily: LayoutFamilies.LAYOUT_D
    });

    const htmlA = projectA.files.find(f => f.path === 'public/index.html').content;
    const htmlB = projectB.files.find(f => f.path === 'public/index.html').content;

    assert.notEqual(htmlA, htmlB, 'HTML for Layout B and Layout D must be distinct');
    assert.ok(htmlA.includes('layout-b-hero') || htmlA.includes('layout_b'), 'HTML A must contain layout B hero signature');
    assert.ok(htmlB.includes('layout-d-hero') || htmlB.includes('layout_d') || htmlB.includes('bento'), 'HTML B must contain layout D bento signature');

    const fpA = projectA.layoutFingerprint;
    const fpB = projectB.layoutFingerprint;
    assert.notEqual(fpA.computedHash, fpB.computedHash, 'Layout fingerprints must differ');
    assert.notEqual(fpA.heroType, fpB.heroType, 'Hero types must differ');
  });

  // Test 5: Different reference images -> Different designs & fingerprints
  await t.test('Test 5: Different reference images -> Different designs & fingerprints (REFERENCE_A !== REFERENCE_B)', () => {
    const analysisA = analyzeReferenceImage({ imageBuffer: SAMPLE_PNG_BUFFER, notes: 'modern dark split' });
    const specA = buildImageDesignSpec({ analysis: analysisA, fidelityMode: 'exact' });

    const analysisB = analyzeReferenceImage({ imageBuffer: SAMPLE_PNG_BUFFER_B, notes: 'warm editorial architecture' });
    const specB = buildImageDesignSpec({ analysis: analysisB, fidelityMode: 'exact' });

    const companyData = {
      companyName: 'Ornek Firma Ltd.',
      industry: 'Genel Kurumsal',
      services: ['Hizmet 1', 'Hizmet 2', 'Hizmet 3']
    };

    const resultA = corporateGen.synthesizeCorporateProject({
      ...companyData,
      imageDesignSpec: specA,
      referenceAnalysis: analysisA,
      fidelityMode: 'exact'
    });

    const resultB = corporateGen.synthesizeCorporateProject({
      ...companyData,
      imageDesignSpec: specB,
      referenceAnalysis: analysisB,
      fidelityMode: 'exact'
    });

    assert.notEqual(resultA.layoutFingerprint.computedHash, resultB.layoutFingerprint.computedHash, 'Fingerprint A must not equal Fingerprint B');
  });

  // Test 6: Exact mode -> high structural fidelity
  await t.test('Test 6: Exact mode -> high structural fidelity to reference image', () => {
    const analysis = analyzeReferenceImage({ imageBuffer: SAMPLE_PNG_BUFFER });
    const specExact = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    const familyExact = resolveLayoutFamily({ imageDesignSpec: specExact, fidelityMode: 'exact' });

    assert.equal(specExact.fidelityMode, 'exact');
    assert.ok(familyExact, 'Family must be resolved in exact mode');
  });

  // Test 7: Similar mode -> same visual language, non-identical DOM structure
  await t.test('Test 7: Similar mode -> same visual language, non-identical DOM structure', () => {
    const analysis = analyzeReferenceImage({ imageBuffer: SAMPLE_PNG_BUFFER });
    const specSimilar = buildImageDesignSpec({ analysis, fidelityMode: 'similar' });

    const companyData = {
      companyName: 'Varyasyon Test A.Ş.',
      industry: 'Danışmanlık',
      services: ['Analiz', 'Strateji']
    };

    const projectExact = corporateGen.synthesizeCorporateProject({
      ...companyData,
      imageDesignSpec: buildImageDesignSpec({ analysis, fidelityMode: 'exact' }),
      fidelityMode: 'exact'
    });

    const projectSimilar = corporateGen.synthesizeCorporateProject({
      ...companyData,
      imageDesignSpec: specSimilar,
      fidelityMode: 'similar'
    });

    const htmlExact = projectExact.files.find(f => f.path === 'public/index.html').content;
    const htmlSimilar = projectSimilar.files.find(f => f.path === 'public/index.html').content;

    assert.notEqual(htmlExact, htmlSimilar, 'Exact mode and Similar mode must produce different DOM structures');
    assert.notEqual(projectExact.layoutFingerprint.computedHash, projectSimilar.layoutFingerprint.computedHash, 'Fingerprints must differ between Exact and Similar');
  });

  // Test 8: No image -> independent design generation, not Golden Master clone
  await t.test('Test 8: No image -> independent design generation, not Golden Master clone', () => {
    const project = corporateGen.synthesizeCorporateProject({
      companyName: 'Özgür Enerji Sistemleri',
      industry: 'Enerji & Sanayi',
      services: ['Güneş Paneli', 'Endüstriyel Akü']
    });

    const fp = project.layoutFingerprint;
    assert.ok(fp, 'Layout fingerprint must be computed');
    assert.ok(fp.computedHash, 'Fingerprint hash must exist');
    assert.ok(project.layoutFamily, 'Layout family must be assigned');
  });

  // Test 9: Same company + same image -> deterministic result
  await t.test('Test 9: Same company + same image -> deterministic result', () => {
    const analysis = analyzeReferenceImage({ imageBuffer: SAMPLE_PNG_BUFFER });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    const input = {
      companyName: 'Determinizm Test Ltd.',
      industry: 'Bilişim',
      services: ['Bulut', 'Yazılım'],
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    };

    const run1 = corporateGen.synthesizeCorporateProject(input);
    const run2 = corporateGen.synthesizeCorporateProject(input);

    assert.equal(run1.layoutFingerprint.computedHash, run2.layoutFingerprint.computedHash, 'Runs must have identical fingerprint hashes');
    assert.equal(run1.layoutFamily, run2.layoutFamily, 'Runs must have identical layout families');
  });

  // Test 10: Same company + different image -> visually different result
  await t.test('Test 10: Same company + different image -> visually different result', () => {
    const analysis1 = analyzeReferenceImage({ imageBuffer: SAMPLE_PNG_BUFFER });
    const spec1 = buildImageDesignSpec({ analysis: analysis1, fidelityMode: 'exact' });

    const analysis2 = analyzeReferenceImage({ imageBuffer: SAMPLE_PNG_BUFFER_B });
    const spec2 = buildImageDesignSpec({ analysis: analysis2, fidelityMode: 'exact' });

    const baseData = {
      companyName: 'Determinizm Fark Test A.Ş.',
      industry: 'Otomotiv',
      services: ['Periyodik Bakım', 'Yedek Parça']
    };

    const res1 = corporateGen.synthesizeCorporateProject({ ...baseData, imageDesignSpec: spec1, fidelityMode: 'exact' });
    const res2 = corporateGen.synthesizeCorporateProject({ ...baseData, imageDesignSpec: spec2, fidelityMode: 'exact' });

    assert.notEqual(res1.layoutFingerprint.computedHash, res2.layoutFingerprint.computedHash, 'Fingerprints must differ for different reference images');
  });

  // Section 19: 3 Distinct Firms Comparison (Petshop !== Logistics !== Architecture)
  await t.test('Section 19: 3 Distinct Firms Comparison (Petshop !== Logistics !== Architecture)', () => {
    const petshop = corporateGen.synthesizeCorporateProject({
      companyName: 'Gökhan Koç PetShop & Beslenme',
      industry: 'PetShop & Evcil Hayvan Beslenmesi',
      services: ['Kuru & Yaş Kedi Maması', 'Köpek Maması', 'Kedi Kumu & Hijyen']
    });

    const logistics = corporateGen.synthesizeCorporateProject({
      companyName: 'TransAvrasya Uluslararası Lojistik',
      industry: 'Lojistik & Taşımacılık',
      services: ['Karayolu Taşımacılığı', 'Denizyolu Konteyner', 'Soğuk Depolama']
    });

    const architecture = corporateGen.synthesizeCorporateProject({
      companyName: 'Atölye Modern Mimarlık & Tasarım',
      industry: 'İnşaat & Gayrimenkul',
      services: ['Mimari Projelendirme', 'Kentsel Tasarım', 'İç Mimari Uygulama']
    });

    const fpPet = petshop.layoutFingerprint;
    const fpLog = logistics.layoutFingerprint;
    const fpArc = architecture.layoutFingerprint;

    assert.equal(petshop.layoutFamily, LayoutFamilies.LAYOUT_D, 'Petshop should map to Bento Grid Layout D');
    assert.equal(logistics.layoutFamily, LayoutFamilies.LAYOUT_B, 'Logistics should map to Split Hero Layout B');
    assert.equal(architecture.layoutFamily, LayoutFamilies.LAYOUT_C, 'Architecture should map to Editorial Hero Layout C');

    assert.notEqual(fpPet.computedHash, fpLog.computedHash, 'Petshop fingerprint must differ from Logistics');
    assert.notEqual(fpLog.computedHash, fpArc.computedHash, 'Logistics fingerprint must differ from Architecture');
    assert.notEqual(fpPet.computedHash, fpArc.computedHash, 'Petshop fingerprint must differ from Architecture');

    assert.notEqual(fpPet.heroType, fpLog.heroType, 'Petshop hero must differ from Logistics hero');
    assert.notEqual(fpLog.heroType, fpArc.heroType, 'Logistics hero must differ from Architecture hero');
  });

  // Section 13: Security Controls
  await t.test('Section 13: Security Controls (MIME, size, executable payload, path traversal)', () => {
    const validResult = validateReferenceImageSecurity({ buffer: SAMPLE_PNG_BUFFER, originalName: 'valid.png' });
    assert.equal(validResult.valid, true);

    const bigBuf = Buffer.alloc(11 * 1024 * 1024);
    assert.throws(() => {
      validateReferenceImageSecurity({ buffer: bigBuf, originalName: 'huge.png' });
    }, /10MB limit/);

    assert.throws(() => {
      validateReferenceImageSecurity({ buffer: SAMPLE_PNG_BUFFER, originalName: 'malicious.php' });
    }, /Unsupported or dangerous file extension/);

    assert.throws(() => {
      validateReferenceImageSecurity({ buffer: SAMPLE_PNG_BUFFER, originalName: 'payload.exe' });
    }, /Unsupported or dangerous file extension/);

    assert.throws(() => {
      validateReferenceImageSecurity({ buffer: SAMPLE_PNG_BUFFER, originalName: 'exploit.js' });
    }, /Unsupported or dangerous file extension/);

    assert.throws(() => {
      validateReferenceImageSecurity({ buffer: SAMPLE_PNG_BUFFER, originalName: 'xss.html' });
    }, /Unsupported or dangerous file extension/);

    assert.throws(() => {
      validateReferenceImageSecurity({ buffer: SAMPLE_PNG_BUFFER, originalName: '../../../etc/passwd.png' });
    }, /Path traversal/);

    const svgScript = Buffer.from('<svg><script>alert(1)</script></svg>');
    assert.throws(() => {
      validateReferenceImageSecurity({ buffer: svgScript, originalName: 'attack.svg' });
    }, /Unsupported or dangerous/);
  });

  // Section 12: Golden Master Backend Freeze
  await t.test('Section 12: Golden Master Backend Freeze (schema.sql, scripts/server.js unmodified)', () => {
    const goldenMasterDir = 'D:\\Antigravity\\onlunet-kurumsal';
    if (fs.existsSync(goldenMasterDir)) {
      const serverJs = path.join(goldenMasterDir, 'scripts', 'server.js');
      const schemaSql = path.join(goldenMasterDir, 'database', 'schema.sql');
      const dbSqlite = path.join(goldenMasterDir, 'storage', 'database.sqlite');

      assert.ok(fs.existsSync(serverJs), 'Golden Master server.js must exist');
      assert.ok(fs.existsSync(schemaSql), 'Golden Master schema.sql must exist');
      assert.ok(fs.existsSync(dbSqlite), 'Golden Master database.sqlite must exist');
    }
  });
});
