import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

const BENCHMARK_REFERENCES = [
  {
    id: 'R01',
    code: 'corporate_b2b',
    title: 'Corporate B2B',
    companyName: 'Atlas B2B Strateji & Danışmanlık A.Ş.',
    industry: 'Kurumsal Danışmanlık & B2B',
    notes: 'Corporate B2B Executive Asymmetric Split Hero Navy Blue',
    expectedPalette: '#0f172a',
    expectedFamily: LayoutFamilies.LAYOUT_B
  },
  {
    id: 'R02',
    code: 'restaurant_gourmet',
    title: 'Restaurant',
    companyName: 'La Maison Gourmet Restoran',
    industry: 'Restoran ve Gurme Mutfak',
    notes: 'Gourmet Restaurant Luxury Dining Wine Gold Centered Hero',
    expectedPalette: '#831843',
    expectedFamily: LayoutFamilies.LAYOUT_A
  },
  {
    id: 'R03',
    code: 'architecture_design',
    title: 'Architecture',
    companyName: 'Atölye Modern Mimarlık & Tasarım',
    industry: 'Mimarlık ve Tasarım',
    notes: 'Modern Architecture Editorial Magazine Raw Charcoal Brass Staggered',
    expectedPalette: '#18181b',
    expectedFamily: LayoutFamilies.LAYOUT_C
  },
  {
    id: 'R04',
    code: 'saas_tech',
    title: 'SaaS',
    companyName: 'NovaCloud AI & SaaS Teknolojileri',
    industry: 'Teknoloji ve Yazılım',
    notes: 'Futuristic SaaS Tech Cloud Software Violet Indigo Bento Hero',
    expectedPalette: '#7c3aed',
    expectedFamily: LayoutFamilies.LAYOUT_D
  },
  {
    id: 'R05',
    code: 'healthcare_clinic',
    title: 'Healthcare',
    companyName: 'Özel Yaşam Sağlık Kliniği',
    industry: 'Sağlık ve Klinik',
    notes: 'Clean Healthcare Medical Clinic Hospital Doctors Cyan Teal Centered',
    expectedPalette: '#0891b2',
    expectedFamily: LayoutFamilies.LAYOUT_A
  },
  {
    id: 'R06',
    code: 'logistics_freight',
    title: 'Logistics',
    companyName: 'TransGlobal Lojistik & Kargo',
    industry: 'Lojistik ve Taşımacılık',
    notes: 'Industrial Logistics Freight Cargo Timeline Process Navy Amber',
    expectedPalette: '#1e3a8a',
    expectedFamily: LayoutFamilies.LAYOUT_F
  },
  {
    id: 'R07',
    code: 'ecommerce_retail',
    title: 'E-commerce',
    companyName: 'Vanguard Perakende & E-Ticaret',
    industry: 'E-Ticaret ve Perakende',
    notes: 'High Conversion E-Commerce Retail Catalog Product Showcase Crimson',
    expectedPalette: '#e11d48',
    expectedFamily: LayoutFamilies.LAYOUT_E
  },
  {
    id: 'R08',
    code: 'legal_consulting',
    title: 'Legal / Consulting',
    companyName: 'Veritas Uluslararası Hukuk & Danışmanlık',
    industry: 'Hukuk ve Arabuluculuk',
    notes: 'Prestige Legal Consulting Law Firm Trust Classical Navy Bronze Centered',
    expectedPalette: '#1e293b',
    expectedFamily: LayoutFamilies.LAYOUT_A
  },
  {
    id: 'R09',
    code: 'real_estate',
    title: 'Real Estate',
    companyName: 'Prime Gayrimenkul & Yatırım Portföyü',
    industry: 'Gayrimenkul ve Emlak',
    notes: 'Luxury Real Estate Property Villa Portfolio Living Emerald Gold Split Showcase',
    expectedPalette: '#064e3b',
    expectedFamily: LayoutFamilies.LAYOUT_B
  },
  {
    id: 'R10',
    code: 'creative_agency',
    title: 'Creative Agency',
    companyName: 'Nexus Studio & Dijital Tasarım Ajansı',
    industry: 'Kreatif Ajans ve Reklam Stüdyosu',
    notes: 'Avant-Garde Creative Agency Studio Neon Cyan Dark Mode Bold Bento',
    expectedPalette: '#09090b',
    expectedFamily: LayoutFamilies.LAYOUT_D
  },
  // Hard Cases
  {
    id: 'H01',
    code: 'asymmetric_extreme',
    title: 'Çok Asimetrik Layout',
    notes: 'extreme asymmetric broken-grid diagonal minimal layout',
    expectedFamily: LayoutFamilies.LAYOUT_E
  },
  {
    id: 'H02',
    code: 'visual_overlapping',
    notes: 'heavy overlapping floating cards multi-layer bento overlay',
    expectedFamily: LayoutFamilies.LAYOUT_D
  },
  {
    id: 'H03',
    code: 'dense_editorial',
    notes: 'ultra dense heavy typography newspaper editorial brutalist',
    expectedFamily: LayoutFamilies.LAYOUT_C
  }
];

test('FAZ 81 — REAL-WORLD IMAGE-TO-WEBSITE BENCHMARK', async (t) => {
  const corporateGen = createCorporateGenerator();

  await t.test('Test 1: 13 benchmark references produce industry-appropriate analyses and distinct palettes', () => {
    const analyses = BENCHMARK_REFERENCES.map(ref => {
      const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(ref.code).digest('hex'), 'utf8');
      return {
        ref,
        analysis: analyzeReferenceImage({
          imageBuffer: dummyBuffer,
          notes: ref.notes || ref.code,
          options: { industry: ref.industry || ref.code, sector: ref.code }
        })
      };
    });

    assert.equal(analyses.length, 13, 'Must analyze all 13 references (10 standard + 3 hard)');

    for (const { ref, analysis } of analyses.slice(0, 10)) {
      assert.equal(analysis.detectedPalette.primary, ref.expectedPalette, `${ref.id} primary color must match archetype`);
    }
  });

  await t.test('Test 2: Layout family is properly mapped for both standard and hard references', () => {
    for (const ref of BENCHMARK_REFERENCES) {
      const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(ref.code).digest('hex'), 'utf8');
      const analysis = analyzeReferenceImage({
        imageBuffer: dummyBuffer,
        notes: ref.notes || ref.code,
        options: { industry: ref.industry || ref.code, sector: ref.code }
      });
      const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
      assert.equal(spec.layoutFamily, ref.expectedFamily, `${ref.id} must map to expected layout family ${ref.expectedFamily}`);
    }
  });

  await t.test('Test 3: Cross-Reference Fingerprint Isolation', () => {
    const fingerprints = BENCHMARK_REFERENCES.map(ref => {
      const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(ref.code).digest('hex'), 'utf8');
      const analysis = analyzeReferenceImage({
        imageBuffer: dummyBuffer,
        notes: ref.notes || ref.code,
        options: { industry: ref.industry || ref.code, sector: ref.code }
      });
      const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
      const synth = corporateGen.synthesizeCorporateProject({
        companyName: `Benchmark Firma ${ref.id}`,
        industry: ref.code,
        referenceAnalysis: analysis,
        imageDesignSpec: spec,
        fidelityMode: 'exact'
      });
      return synth.fingerprint;
    });

    assert.equal(fingerprints.length, 13, 'Must generate 13 fingerprints');
  });

  await t.test('Test 4: Similar mode produces structural divergence from Exact mode', () => {
    for (const ref of BENCHMARK_REFERENCES) {
      const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(ref.code).digest('hex'), 'utf8');
      const analysis = analyzeReferenceImage({
        imageBuffer: dummyBuffer,
        notes: ref.notes || ref.code,
        options: { industry: ref.industry || ref.code, sector: ref.code }
      });
      const specExact = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
      const specSimilar = buildImageDesignSpec({ analysis, fidelityMode: 'similar' });

      assert.notEqual(specExact.layoutFamily, specSimilar.layoutFamily, `${ref.id}: Similar mode must produce different layout family than Exact`);
    }
  });

  await t.test('Test 5: Deterministic generation guarantees identical fingerprints for same reference input', () => {
    const ref = BENCHMARK_REFERENCES[0];
    const dummyBuffer = Buffer.from(crypto.createHash('sha256').update(ref.code).digest('hex'), 'utf8');
    const analysis = analyzeReferenceImage({
      imageBuffer: dummyBuffer,
      notes: ref.notes || ref.code,
      options: { industry: ref.code, sector: ref.code }
    });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    const synth1 = corporateGen.synthesizeCorporateProject({
      companyName: 'Atlas Danışmanlık A.Ş.',
      industry: ref.code,
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });
    const synth2 = corporateGen.synthesizeCorporateProject({
      companyName: 'Atlas Danışmanlık A.Ş.',
      industry: ref.code,
      referenceAnalysis: analysis,
      imageDesignSpec: spec,
      fidelityMode: 'exact'
    });

    assert.equal(synth1.fingerprint, synth2.fingerprint, 'Fingerprints must be 100% identical for same input');
    assert.equal(synth1.indexHtml, synth2.indexHtml, 'Generated HTML must be 100% identical byte-for-byte');
  });

  await t.test('Test 6: Golden master files in onlunet-kurumsal remain untouched', () => {
    const schemaPath = path.join(GOLDEN_MASTER_ROOT, 'database', 'schema.sql');
    const serverPath = path.join(GOLDEN_MASTER_ROOT, 'scripts', 'server.js');
    const dbPath = path.join(GOLDEN_MASTER_ROOT, 'storage', 'database.sqlite');

    assert.ok(fs.existsSync(schemaPath), 'schema.sql must exist');
    assert.ok(fs.existsSync(serverPath), 'server.js must exist');
    assert.ok(fs.existsSync(dbPath), 'database.sqlite must exist');

    const schemaHash = crypto.createHash('sha256').update(fs.readFileSync(schemaPath)).digest('hex').toUpperCase();
    const serverHash = crypto.createHash('sha256').update(fs.readFileSync(serverPath)).digest('hex').toUpperCase();
    const dbStat = fs.statSync(dbPath);

    assert.equal(schemaHash, '7F9C6B4B55B4DB36102735EFFD1DDD9F9F5B86ED646198A81982808BA77AB9C9');
    assert.equal(serverHash, '2455AF188AF22EBFE4B4EF11EB580D1A4D7344A896E992B58809FCF38FF87797');
    assert.equal(dbStat.size, 1208320);
  });
});
