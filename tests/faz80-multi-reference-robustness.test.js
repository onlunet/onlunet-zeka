import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { PROJECT_ROOT } from '../src/interfaces/core.js';
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

// 8 Distinct Reference Definitions
const TEST_REFERENCES = [
  {
    id: 'R01',
    code: 'corporate_b2b',
    title: 'Kurumsal B2B',
    companyName: 'Atlas B2B Strateji Danışmanlığı A.Ş.',
    industry: 'Kurumsal Danışmanlık',
    notes: 'Corporate B2B Executive Asymmetric Split Hero Navy Blue',
    expectedFamily: LayoutFamilies.LAYOUT_B,
    expectedPalette: '#0f172a'
  },
  {
    id: 'R02',
    code: 'restaurant_gourmet',
    title: 'Restoran / Gourmet',
    companyName: 'La Maison Gourmet Restoran',
    industry: 'Restoran ve Gurme Mutfak',
    notes: 'Gourmet Restaurant Luxury Dining Wine Gold Centered Hero',
    expectedFamily: LayoutFamilies.LAYOUT_A,
    expectedPalette: '#831843'
  },
  {
    id: 'R03',
    code: 'petshop_care',
    title: 'Petshop / Hayvan Bakımı',
    companyName: 'Pati Dostları Petshop',
    industry: 'Petshop ve Hayvan Bakımı',
    notes: 'Petshop Animal Care Friendly Emerald Orange Bento Grid',
    expectedFamily: LayoutFamilies.LAYOUT_D,
    expectedPalette: '#059669'
  },
  {
    id: 'R04',
    code: 'logistics_freight',
    title: 'Lojistik / Nakliye',
    companyName: 'TransGlobal Lojistik & Filo',
    industry: 'Lojistik ve Taşımacılık',
    notes: 'Industrial Logistics Freight Cargo Timeline Process Navy Amber',
    expectedFamily: LayoutFamilies.LAYOUT_F,
    expectedPalette: '#1e3a8a'
  },
  {
    id: 'R05',
    code: 'architecture_design',
    title: 'Mimarlık / İnşaat',
    companyName: 'Atölye Modern Mimarlık & Tasarım',
    industry: 'Mimarlık ve Tasarım',
    notes: 'Modern Architecture Editorial Magazine Raw Charcoal Brass Staggered',
    expectedFamily: LayoutFamilies.LAYOUT_C,
    expectedPalette: '#18181b'
  },
  {
    id: 'R06',
    code: 'healthcare_clinic',
    title: 'Sağlık / Klinik',
    companyName: 'Özel Yaşam Sağlık Kliniği',
    industry: 'Sağlık ve Klinik',
    notes: 'Clean Healthcare Medical Clinic Hospital Doctors Cyan Teal Centered',
    expectedFamily: LayoutFamilies.LAYOUT_A,
    expectedPalette: '#0891b2'
  },
  {
    id: 'R07',
    code: 'saas_tech',
    title: 'Teknoloji / SaaS',
    companyName: 'NovaCloud AI & SaaS Teknolojileri',
    industry: 'Teknoloji ve Yazılım',
    notes: 'Futuristic SaaS Tech Cloud Software Violet Indigo Bento Hero',
    expectedFamily: LayoutFamilies.LAYOUT_D,
    expectedPalette: '#7c3aed'
  },
  {
    id: 'R08',
    code: 'ecommerce_retail',
    title: 'E-Ticaret / Ürün',
    companyName: 'Vanguard Perakende & E-Ticaret',
    industry: 'E-Ticaret ve Perakende',
    notes: 'High Conversion E-Commerce Retail Catalog Product Showcase Crimson',
    expectedFamily: LayoutFamilies.LAYOUT_E,
    expectedPalette: '#e11d48'
  }
];

test('FAZ 80 — MULTI-REFERENCE ROBUSTNESS & VISUAL REFERENCE GENERALIZATION', async (t) => {
  const corporateGen = createCorporateGenerator();

  // Test 1: 8 Distinct Reference Dataset Analysis
  await t.test('Test 1: 8 references produce distinct, industry-appropriate analyses', () => {
    const analyses = TEST_REFERENCES.map(ref => {
      const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(ref.code).digest('hex'), 'utf8');
      return {
        ref,
        analysis: analyzeReferenceImage({
          imageBuffer: dummyBuffer,
          notes: ref.notes,
          options: { industry: ref.industry, sector: ref.code }
        })
      };
    });

    assert.equal(analyses.length, 8, 'Must analyze all 8 references');

    // Check color palette diversity
    const primaryColors = new Set(analyses.map(a => a.analysis.detectedPalette.primary));
    assert.equal(primaryColors.size, 8, 'All 8 references must have distinct primary colors');

    // Verify expected palettes
    for (const { ref, analysis } of analyses) {
      assert.equal(analysis.detectedPalette.primary, ref.expectedPalette, `${ref.id} primary color must match archetype`);
    }
  });

  // Test 2: DesignSpec Isolation & Mapping
  await t.test('Test 2: DesignSpec correctly isolates layout family, typography and card radius', () => {
    const specs = TEST_REFERENCES.map(ref => {
      const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(ref.code).digest('hex'), 'utf8');
      const analysis = analyzeReferenceImage({
        imageBuffer: dummyBuffer,
        notes: ref.notes,
        options: { industry: ref.industry, sector: ref.code }
      });
      return {
        ref,
        spec: buildImageDesignSpec({ analysis, fidelityMode: 'exact' })
      };
    });

    for (const { ref, spec } of specs) {
      assert.equal(spec.layoutFamily, ref.expectedFamily, `${ref.id} must map to expected layout family ${ref.expectedFamily}`);
      assert.ok(spec.visualStyle.typography.fontFamily, 'Font family must be defined');
      assert.ok(spec.visualStyle.borderRadius.card, 'Card border radius must be defined');
    }
  });

  // Test 3: Cross-Reference Fingerprint Isolation (R01 != R02 != R03 != ... != R08)
  await t.test('Test 3: All 8 references produce unique layout fingerprints (Cross-reference isolation)', () => {
    const fingerprints = TEST_REFERENCES.map(ref => {
      const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(ref.code).digest('hex'), 'utf8');
      const analysis = analyzeReferenceImage({
        imageBuffer: dummyBuffer,
        notes: ref.notes,
        options: { industry: ref.industry, sector: ref.code }
      });
      const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

      const synth = corporateGen.synthesizeCorporateProject({
        companyName: ref.companyName,
        industry: ref.industry,
        services: [{ title: `${ref.industry} Çözümü`, description: 'Özel hizmet', icon: '🔹' }],
        referenceAnalysis: analysis,
        imageDesignSpec: spec,
        fidelityMode: 'exact',
        layoutFamily: spec.layoutFamily
      });

      return {
        id: ref.id,
        hash: synth.layoutFingerprint.computedHash,
        fingerprint: synth.layoutFingerprint
      };
    });

    const uniqueHashes = new Set(fingerprints.map(f => f.hash));
    assert.equal(uniqueHashes.size, 8, 'All 8 references must produce unique fingerprints in Exact mode');
  });

  // Test 4: Deterministic Reproducibility (R[i] == R[i] without randomness)
  await t.test('Test 4: Deterministic generation guarantees identical fingerprints for same reference input', () => {
    for (const ref of TEST_REFERENCES) {
      const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(ref.code).digest('hex'), 'utf8');
      const analysis1 = analyzeReferenceImage({ imageBuffer: dummyBuffer, notes: ref.notes, options: { industry: ref.industry } });
      const spec1 = buildImageDesignSpec({ analysis: analysis1, fidelityMode: 'exact' });
      const synth1 = corporateGen.synthesizeCorporateProject({
        companyName: ref.companyName,
        industry: ref.industry,
        referenceAnalysis: analysis1,
        imageDesignSpec: spec1,
        fidelityMode: 'exact'
      });

      const analysis2 = analyzeReferenceImage({ imageBuffer: dummyBuffer, notes: ref.notes, options: { industry: ref.industry } });
      const spec2 = buildImageDesignSpec({ analysis: analysis2, fidelityMode: 'exact' });
      const synth2 = corporateGen.synthesizeCorporateProject({
        companyName: ref.companyName,
        industry: ref.industry,
        referenceAnalysis: analysis2,
        imageDesignSpec: spec2,
        fidelityMode: 'exact'
      });

      assert.equal(synth1.layoutFingerprint.computedHash, synth2.layoutFingerprint.computedHash, `${ref.id} deterministic run 1 must match run 2`);
    }
  });

  // Test 5: Exact vs Similar Controlled Variation (Exact !== Similar for all 8)
  await t.test('Test 5: Similar mode produces controlled structural variation distinct from Exact mode', () => {
    for (const ref of TEST_REFERENCES) {
      const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(ref.code).digest('hex'), 'utf8');
      const analysis = analyzeReferenceImage({ imageBuffer: dummyBuffer, notes: ref.notes, options: { industry: ref.industry } });

      const specExact = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
      const synthExact = corporateGen.synthesizeCorporateProject({
        companyName: ref.companyName,
        industry: ref.industry,
        referenceAnalysis: analysis,
        imageDesignSpec: specExact,
        fidelityMode: 'exact'
      });

      const specSimilar = buildImageDesignSpec({ analysis, fidelityMode: 'similar' });
      const synthSimilar = corporateGen.synthesizeCorporateProject({
        companyName: ref.companyName,
        industry: ref.industry,
        referenceAnalysis: analysis,
        imageDesignSpec: specSimilar,
        fidelityMode: 'similar'
      });

      assert.notEqual(
        synthExact.layoutFingerprint.computedHash,
        synthSimilar.layoutFingerprint.computedHash,
        `${ref.id}: Exact fingerprint must differ from Similar fingerprint`
      );

      assert.notEqual(
        synthExact.files.find(f => f.path === 'public/index.html').content,
        synthSimilar.files.find(f => f.path === 'public/index.html').content,
        `${ref.id}: Exact HTML must differ structurally from Similar HTML`
      );
    }
  });

  // Test 6: Template Repetition Prevention (Anti-Clone Test)
  await t.test('Test 6: System does not repeat a single template with changed colors (True structural diversity)', () => {
    const htmls = TEST_REFERENCES.map(ref => {
      const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(ref.code).digest('hex'), 'utf8');
      const analysis = analyzeReferenceImage({ imageBuffer: dummyBuffer, notes: ref.notes, options: { industry: ref.industry } });
      const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
      const synth = corporateGen.synthesizeCorporateProject({
        companyName: ref.companyName,
        industry: ref.industry,
        referenceAnalysis: analysis,
        imageDesignSpec: spec,
        fidelityMode: 'exact'
      });
      return {
        id: ref.id,
        html: synth.files.find(f => f.path === 'public/index.html').content
      };
    });

    // Check that layout families across references span multiple distinct templates
    const layoutRoots = htmls.map(h => {
      const match = h.html.match(/data-layout-family="([^"]+)"/);
      return match ? match[1] : 'unknown';
    });

    const uniqueLayouts = new Set(layoutRoots);
    assert.ok(uniqueLayouts.size >= 5, `Expected at least 5 distinct layout families across 8 references, got ${uniqueLayouts.size}: ${[...uniqueLayouts].join(', ')}`);
  });

  // Test 7: Golden Master Immutability
  await t.test('Test 7: Golden master files in onlunet-kurumsal remain untouched', () => {
    const goldenSchema = path.join('D:\\Antigravity\\onlunet-kurumsal', 'database', 'schema.sql');
    const goldenServer = path.join('D:\\Antigravity\\onlunet-kurumsal', 'scripts', 'server.js');
    const goldenDb = path.join('D:\\Antigravity\\onlunet-kurumsal', 'storage', 'database.sqlite');

    assert.ok(fs.existsSync(goldenSchema), 'Golden schema must exist');
    assert.ok(fs.existsSync(goldenServer), 'Golden server must exist');
    assert.ok(fs.existsSync(goldenDb), 'Golden sqlite database must exist');

    const schemaHash = crypto.createHash('sha256').update(fs.readFileSync(goldenSchema)).digest('hex').toUpperCase();
    const serverHash = crypto.createHash('sha256').update(fs.readFileSync(goldenServer)).digest('hex').toUpperCase();
    const dbSize = fs.statSync(goldenDb).size;

    assert.equal(schemaHash, '7F9C6B4B55B4DB36102735EFFD1DDD9F9F5B86ED646198A81982808BA77AB9C9', 'Golden schema hash mismatch');
    assert.equal(serverHash, '2455AF188AF22EBFE4B4EF11EB580D1A4D7344A896E992B58809FCF38FF87797', 'Golden server hash mismatch');
    assert.equal(dbSize, 1208320, 'Golden database size mismatch');
  });
});
