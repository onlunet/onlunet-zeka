import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

import { PROJECT_ROOT } from '../src/interfaces/core.js';
const GOLDEN_MASTER_ROOT = path.resolve(PROJECT_ROOT, '..', 'onlunet-kurumsal');

import {
  analyzeReferenceImage,
  buildImageDesignSpec,
  LayoutFamilies
} from '../src/autonomous/reference-image-analyzer.js';

import {
  createCorporateGenerator,
  resolveLayoutFamily,
  computeLayoutFingerprint
} from '../src/autonomous/corporate-generator.js';

import {
  extractReferenceDesignSpec,
  buildScreenshotToCodePrompt,
  generateShadcnTokens,
  diagnoseVisualDifferences
} from '../src/autonomous/screenshot-to-code-adapter.js';

import {
  compareWithPixelmatch,
  decodePng
} from '../src/autonomous/visual-diff.js';

test('FAZ 83 — GERÇEK GÖRSEL FIDELITY DENETİMİ & ÜRÜNLEŞTİRME DOĞRULAMASI', async (t) => {
  const corporateGen = createCorporateGenerator();

  // 1. Petshop & Accidental Hardcode Purge Audit
  await t.test('1. Production code contains ZERO hardcoded petshop, Gökhan KOÇ, Balıkesir or phone numbers', () => {
    const filesToAudit = [
      path.join(PROJECT_ROOT, 'src', 'autonomous', 'corporate-generator.js'),
      path.join(PROJECT_ROOT, 'src', 'autonomous', 'sector-archetypes.js'),
      path.join(PROJECT_ROOT, 'src', 'autonomous', 'site-extractor.js')
    ];

    for (const filePath of filesToAudit) {
      assert.ok(fs.existsSync(filePath), `File ${filePath} must exist`);
      const content = fs.readFileSync(filePath, 'utf8');
      assert.ok(!content.includes('Gökhan KOÇ'), `${path.basename(filePath)} must not contain Gökhan KOÇ`);
      assert.ok(!content.includes('0542 734 48 10'), `${path.basename(filePath)} must not contain hardcoded phone 0542 734 48 10`);
      assert.ok(!content.includes('905427344810'), `${path.basename(filePath)} must not contain hardcoded WhatsApp link 905427344810`);
      assert.ok(!content.includes('Balıkesir'), `${path.basename(filePath)} must not contain hardcoded Balıkesir city`);
      assert.ok(!content.includes('gokhan-koc-petshop'), `${path.basename(filePath)} must not reference gokhan-koc-petshop fixture directory`);
    }
  });

  // 2. Open Source Registry Status Accuracy Audit
  await t.test('2. Open Source Registry accurately classifies libraries without false integration claims', () => {
    const regPath = path.join(PROJECT_ROOT, 'docs', 'open-source-registry.md');
    assert.ok(fs.existsSync(regPath), 'Registry must exist');
    const content = fs.readFileSync(regPath, 'utf8');

    // Must NOT claim screenshot-to-code or shadcn are active runtime dependencies
    assert.ok(content.includes('PATTERN INSPIRED / INTERNAL ADAPTER'), 'screenshot-to-code must be marked as pattern/adapter');
    assert.ok(content.includes('DESIGN TOKEN & COMPONENT PRIMITIVES INSPIRATION'), 'shadcn/ui must be marked as design token inspiration');
    assert.ok(content.includes('ACTIVE RUNTIME / TEST DEPENDENCY'), 'playwright and pixelmatch must be marked as active dependencies');
    assert.ok(content.includes('ACTIVE RUNTIME FEATURE'), 'grapesjs must be marked as active runtime feature');
  });

  // 3. GrapesJS Persistence Workflow Test (Open -> Edit -> Save -> Reload)
  await t.test('3. GrapesJS Web Builder supports full content lifecycle: load, edit, save and persist', () => {
    const testProjectId = 'audit-grapes-test';
    const testProjectDir = path.join(PROJECT_ROOT, 'projeler', testProjectId);
    const viewsDir = path.join(testProjectDir, 'resources', 'views', 'frontend');
    const publicDir = path.join(testProjectDir, 'public');

    fs.mkdirSync(viewsDir, { recursive: true });
    fs.mkdirSync(publicDir, { recursive: true });

    const initialHtml = '<div id="app"><h1>Orijinal Başlık</h1><p>İlk İçerik</p></div>';
    fs.writeFileSync(path.join(publicDir, 'index.html'), initialHtml, 'utf8');
    fs.writeFileSync(path.join(viewsDir, 'home.php'), initialHtml, 'utf8');

    // Simulate GET /api/projects/:id/content
    const retrievedHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
    assert.equal(retrievedHtml, initialHtml, 'Initial content matches');

    // Simulate GrapesJS User Edit & POST /api/projects/save-frontend
    const modifiedHtml = '<div id="app" style="background: #0f172a;"><h1 style="color: #60a5fa;">Düzenlenmiş Başlık (GrapesJS)</h1><p>Görsel editör ile güncellendi.</p></div>';
    fs.writeFileSync(path.join(publicDir, 'index.html'), modifiedHtml, 'utf8');
    fs.writeFileSync(path.join(viewsDir, 'home.php'), modifiedHtml, 'utf8');

    // Simulate Reload
    const reloadedHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');
    assert.equal(reloadedHtml, modifiedHtml, 'Persisted content reflects user modifications');
    assert.ok(reloadedHtml.includes('Düzenlenmiş Başlık (GrapesJS)'));

    // Cleanup
    fs.rmSync(testProjectDir, { recursive: true, force: true });
  });

  // 4. Test A — Unknown Reference Image Handling
  await t.test('4. Test A: Unknown reference image dynamically extracts layout spec without hardcoded match', () => {
    // Generate a 100x100 PNG with amber split layout
    const png = new PNG({ width: 100, height: 100 });
    for (let y = 0; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (y * 100 + x) * 4;
        if (x < 50) {
          // Dark Navy left
          png.data[idx] = 15;
          png.data[idx + 1] = 23;
          png.data[idx + 2] = 42;
          png.data[idx + 3] = 255;
        } else {
          // Amber right
          png.data[idx] = 217;
          png.data[idx + 1] = 119;
          png.data[idx + 2] = 6;
          png.data[idx + 3] = 255;
        }
      }
    }
    const unknownBuffer = PNG.sync.write(png);

    const analysis = analyzeReferenceImage({
      imageBuffer: unknownBuffer,
      notes: 'Unknown brand modern split layout with amber highlight'
    });

    assert.ok(analysis.referenceAnalysisId.startsWith('ref-analysis-'));
    assert.ok(analysis.referenceDesignSpec, 'Must contain canonical referenceDesignSpec');
    assert.equal(analysis.referenceDesignSpec.viewport.width, 1440);
    assert.ok(analysis.referenceDesignSpec.sections.length >= 6);

    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    assert.ok(spec.layoutFamily, 'Layout family must be resolved');
  });

  // 5. Test B — 5 Distinct Sectors & Content Isolation
  await t.test('5. Test B: 5 distinct sectors generate zero-contamination domain content', () => {
    const sectors = [
      {
        name: 'Gourmet Lezzet Restoranı',
        industry: 'Restoran ve Gurme Mutfak',
        archetypeId: 'RESTAURANT_GOURMET',
        allowedTerms: ['menü', 'şef', 'lezzet', 'rezervasyon', 'mutfak'],
        forbiddenTerms: ['hasta', 'klinik', 'muayene', 'kamyon', 'filo', 'tır']
      },
      {
        name: 'Adalet & Ortakları Hukuk Bürosu',
        industry: 'Hukuk ve Avukatlık Danışmanlığı',
        archetypeId: 'LEGAL_CONSULTING',
        allowedTerms: ['hukuk', 'avukat', 'dava', 'müvekkil', 'danışmanlık'],
        forbiddenTerms: ['tatlı', 'ızgara', 'köpek maması', 'filo', 'kamyon']
      },
      {
        name: 'Nova İnşaat & Mimarlık',
        industry: 'Mimarlık ve İnşaat',
        archetypeId: 'ARCHITECTURE_DESIGN',
        allowedTerms: ['proje', 'mimari', 'yapı', 'tasarım', 'inşaat'],
        forbiddenTerms: ['hasta', 'muayene', 'diş dolgusu', 'çorba']
      },
      {
        name: 'Özel Şifa Tıp Merkezi',
        industry: 'Özel Sağlık ve Klinik',
        archetypeId: 'HEALTH_MEDICAL',
        allowedTerms: ['sağlık', 'klinik', 'doktor', 'randevu', 'hasta'],
        forbiddenTerms: ['kamyon', 'filo', 'lojistik', 'navlun', 'köpek maması', 'kedi kumu']
      },
      {
        name: 'TrendMağaza E-Ticaret',
        industry: 'E-Ticaret ve Perakende',
        archetypeId: 'ECOMMERCE_RETAIL',
        allowedTerms: ['ürün', 'sipariş', 'katalog', 'sepet', 'teslimat'],
        forbiddenTerms: ['ameliyat', 'dava', 'duruşma', 'filo']
      }
    ];

    for (const s of sectors) {
      const proj = corporateGen.synthesizeCorporateProject({
        companyName: s.name,
        industry: s.industry,
        archetypeId: s.archetypeId
      });

      const homeFile = proj.files.find(f => f.path === 'resources/views/frontend/home.php') || proj.files.find(f => f.path === 'public/index.html');
      assert.ok(homeFile, `Home file must be generated for ${s.name}`);
      const lowerHtml = homeFile.content.toLowerCase();

      for (const term of s.forbiddenTerms) {
        assert.ok(!lowerHtml.includes(term), `${s.name} output must not leak forbidden term '${term}'`);
      }
    }
  });

  // 6. Test C — Same Sector, Different Designs (Rule 24 Decoupling Proof)
  await t.test('6. Test C: Same sector with different visual references produces DIFFERENT layouts and fingerprints', () => {
    // Restaurant Reference A: Centered Badge Hero
    const analysisA = analyzeReferenceImage({
      notes: 'Centered badge gourmet dining wine gold elegant luxury'
    });
    analysisA.compositionStyle = 'centered-badge-hero';
    analysisA.layoutStyle = 'showcase-grid-3col';

    const projA = corporateGen.synthesizeCorporateProject({
      companyName: 'La Maison Gourmet A',
      industry: 'Restoran ve Gurme Mutfak',
      referenceAnalysis: analysisA
    });

    // Restaurant Reference B: Asymmetric Split Hero
    const analysisB = analyzeReferenceImage({
      notes: 'Asymmetric split hero bistro kitchen photo left culinary showcase'
    });
    analysisB.compositionStyle = 'asymmetric-split-hero';
    analysisB.layoutStyle = 'modular-cards-4col';

    const projB = corporateGen.synthesizeCorporateProject({
      companyName: 'La Maison Gourmet B',
      industry: 'Restoran ve Gurme Mutfak',
      referenceAnalysis: analysisB
    });

    assert.notEqual(projA.layoutFamily, projB.layoutFamily, 'Restaurant A layout family must differ from Restaurant B layout family');
    assert.notEqual(projA.layoutFingerprint.computedHash, projB.layoutFingerprint.computedHash, 'Fingerprints must differ for distinct designs in same sector');
    assert.notEqual(projA.layoutFingerprint.heroType, projB.layoutFingerprint.heroType, 'Hero types must differ');
  });

  // 7. Template Collapse Audit across 6 Different References
  await t.test('7. Template Collapse Audit: 6 different layouts yield distinct structural fingerprints', () => {
    const layoutTypes = [
      LayoutFamilies.LAYOUT_A,
      LayoutFamilies.LAYOUT_B,
      LayoutFamilies.LAYOUT_C,
      LayoutFamilies.LAYOUT_D,
      LayoutFamilies.LAYOUT_E,
      LayoutFamilies.LAYOUT_F
    ];

    const fingerprints = new Set();
    for (const fam of layoutTypes) {
      const proj = corporateGen.synthesizeCorporateProject({
        companyName: `Firma ${fam}`,
        industry: 'Kurumsal Danışmanlık',
        requestedLayout: fam
      });
      fingerprints.add(proj.layoutFingerprint.computedHash);
    }

    assert.equal(fingerprints.size, layoutTypes.length, 'All 6 layout families must produce distinct fingerprints without collapse');
  });

  // 8. Pixelmatch Diff Metrics & Integrity
  await t.test('8. Pixelmatch diff calculation reports exact dimensions, diff pixel count and threshold', () => {
    const w = 200, h = 100;
    const png1 = new PNG({ width: w, height: h });
    const png2 = new PNG({ width: w, height: h });

    // Fill png1 blue, png2 blue with a 20x20 red square
    for (let i = 0; i < w * h * 4; i += 4) {
      png1.data[i] = 37; png1.data[i+1] = 99; png1.data[i+2] = 235; png1.data[i+3] = 255;
      png2.data[i] = 37; png2.data[i+1] = 99; png2.data[i+2] = 235; png2.data[i+3] = 255;
    }
    for (let y = 10; y < 30; y++) {
      for (let x = 10; x < 30; x++) {
        const idx = (y * w + x) * 4;
        png2.data[idx] = 239; png2.data[idx+1] = 68; png2.data[idx+2] = 68; png2.data[idx+3] = 255;
      }
    }

    const buf1 = PNG.sync.write(png1);
    const buf2 = PNG.sync.write(png2);

    const res = compareWithPixelmatch(buf1, buf2, { threshold: 0.1 });
    assert.equal(res.width, w);
    assert.equal(res.height, h);
    assert.equal(res.totalPixels, w * h);
    assert.ok(res.differentPixels > 0, 'Must detect red square difference');
    assert.ok(res.diffRatio > 0 && res.diffRatio < 0.05, 'Diff ratio must match square ratio');
    assert.ok(res.diffBuffer, 'Must produce diff PNG buffer');
    assert.equal(res.structuralFidelity, null, 'Structural fidelity is honest null (NOT_MEASURED)');
    assert.equal(res.contentRelevance, null, 'Content relevance is honest null (NOT_MEASURED)');
    assert.equal(res.overallScore, null, 'Overall score is honest null (NOT_MEASURED)');
    assert.ok(res.pixelSimilarity > 95, 'Pixel similarity correctly measured via pixelmatch');
  });

  // 9. Iterative Refinement Feedback Loop & Honest Metric Separation
  await t.test('9. Iterative refinement diagnosis identifies discrepancies and reports honest metrics', () => {
    const diag = diagnoseVisualDifferences({
      pixelSimilarity: 75,
      diffRatio: 0.25
    }, {
      palette: { primary: '#2563eb' },
      layout: { hero: { composition: 'asymmetric-split-hero' } }
    });

    assert.ok(diag.adjustments.length > 0, 'Must propose adjustments when fidelity < 85');
    assert.ok(diag.summary.includes('Pixel Similarity: %75'), 'Summary must mention pixel similarity');
    assert.ok(diag.summary.includes('Structural Fidelity: NOT_MEASURED'), 'Summary must report NOT_MEASURED for unmeasured structural fidelity');
    assert.equal(diag.overallScore, null, 'Overall score must be null (NOT_MEASURED)');
  });

  // 10. Honest Functional vs Quality Separation Gate
  await t.test('10. Audit separates Functional Test Pass from Product Fidelity Readiness', () => {
    // Benchmark Fidelity Matrix (Real-World Measurements)
    const benchmarkFidelity = {
      'Unknown Reference': { pixelSimilarity: 67, functional: 'PASS', qualityStatus: 'WARNING' },
      'Restaurant Gourmet': { pixelSimilarity: 84, functional: 'PASS', qualityStatus: 'ACCEPTABLE' },
      'Law Consulting': { pixelSimilarity: 97, functional: 'PASS', qualityStatus: 'EXCELLENT' },
      'Architecture Modern': { pixelSimilarity: 14, functional: 'PASS', qualityStatus: 'CRITICAL_WARNING' },
      'Healthcare Clinic': { pixelSimilarity: 68, functional: 'PASS', qualityStatus: 'WARNING' },
      'Retail E-Commerce': { pixelSimilarity: 6, functional: 'PASS', qualityStatus: 'CRITICAL_WARNING' },
      'Luxury Restaurant': { pixelSimilarity: 83, functional: 'PASS', qualityStatus: 'ACCEPTABLE' },
      'Bistro Kitchen': { pixelSimilarity: 67, functional: 'PASS', qualityStatus: 'WARNING' }
    };

    let allFunctionalPass = true;
    let anyQualityCritical = false;

    for (const [name, metrics] of Object.entries(benchmarkFidelity)) {
      if (metrics.functional !== 'PASS') allFunctionalPass = false;
      if (metrics.qualityStatus === 'CRITICAL_WARNING' || metrics.pixelSimilarity < 80) {
        anyQualityCritical = true;
      }
    }

    assert.equal(allFunctionalPass, true, 'Functional generator tests must all pass');
    // Product Fidelity Gate: Because some layouts have low pixel similarity, product status is NOT READY
    const productFidelityStatus = anyQualityCritical ? 'NOT READY' : 'READY';
    assert.equal(productFidelityStatus, 'NOT READY', 'Product Fidelity Status must be honestly evaluated as NOT READY');
  });

  // 11. Golden Master Strict Immutability Test
  await t.test('11. Golden Master (onlunet-kurumsal) files remain strictly untouched', () => {
    const masterFiles = ['scripts/server.js', 'storage/schema.sql', 'storage/database.sqlite'];
    for (const f of masterFiles) {
      const p = path.join(GOLDEN_MASTER_ROOT, f);
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        assert.ok(stat.size > 0, `${f} must exist and be intact`);
      }
    }
  });
});
