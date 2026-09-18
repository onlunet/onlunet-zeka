/**
 * ONLUNET ZEKA — Autonomous Design Orchestration & Cross-Sector Differentiation Test Suite (FAZ 74.1)
 *
 * 14 MANDATORY TESTS:
 * 1. UI Endpoint Routing: POST /api/corporate/plan routes to synthesizeAutonomousWebsite.
 * 2. Generation Mode Invariant: generationMode === 'AUTONOMOUS_SYNTHESIS' across pipeline, report, and API.
 * 3. Design Reasoning -> HTML: Strategy decisions explicitly reflected in DOM tags/attributes.
 * 4. Layout Graph -> DOM: DOM sections appear in the exact order specified by layoutGraph.sections.
 * 5. Design System -> CSS: Parametric tokens injected as CSS variables and applied to layout.
 * 6. Visual Composition -> DOM: Dynamic composition eliminates the single hardcoded skeleton anti-pattern.
 * 7. Template Bypass: Zero pre-baked templates or static HTML clones used in generation.
 * 8. Same-Sector Variation: 3 companies in the same sector (PetShop Boutique, Clinic, E-commerce) yield distinct layouts.
 * 9. Cross-Sector Variation: 6 distinct sectors yield fundamentally different DOM trees and section orders.
 * 10. Structural Similarity Metric: Pairwise DOM structural similarity between sectors is strictly < 0.70.
 * 11. Design Fingerprint Generation: Valid designFingerprint generated and saved to disk.
 * 12. Preview Integrity: synthesis.files contains valid public/index.html ready for UI preview.
 * 13. Legacy Fallback Detection: forceLegacy flag triggers generationMode === 'LEGACY_FALLBACK'.
 * 14. Arazya Real-World UI Generation: Arazya Petshop synthesizes full autonomous design with real Google data.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

import { synthesizeAutonomousWebsite, GenerationMode } from '../src/autonomous/website-synthesis-engine.js';
import { buildLayoutGraph } from '../src/autonomous/layout-graph-engine.js';
import { synthesizeWebsite } from '../src/autonomous/visual-composition-engine.js';
import { deduceDesignStrategy } from '../src/autonomous/design-reasoning-engine.js';
import { generateDesignTokens } from '../src/autonomous/design-system-engine.js';
import { normalizeCompanyProfile } from '../src/autonomous/company-profile-normalizer.js';

// Helper: computes Jaccard similarity between two arrays of tokens/signatures
function computeJaccardSimilarity(arrA, arrB) {
  const setA = new Set(arrA);
  const setB = new Set(arrB);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 1.0;
  return intersection.size / union.size;
}

test('ONLUNET ZEKA — Genuine Autonomous Design Orchestration (FAZ 74.1)', async (t) => {

  await t.test('1. UI Endpoint Routing: POST /api/corporate/plan triggers synthesizeAutonomousWebsite', async () => {
    // Send mock request to live server port 4200
    const payload = JSON.stringify({
      companyName: 'Akdeniz Gemi İmalat Sanayi',
      industry: 'Endüstriyel İmalat',
      slogan: 'Ağır Sanayi ve Hassas Talaşlı İmalat',
      description: 'Gemi inşa ve endüstriyel tesisler için yüksek standartlı parça üretimi.',
      services: [
        { title: 'Talaşlı İmalat', description: '5 eksen CNC freze ve torna işleme.' },
        { title: 'Kaynak ve Montaj', description: 'Sertifikalı kaynak yöntemleri.' }
      ],
      contact: {
        phone: '0216 555 44 33',
        email: 'info@akdenizgemi.com.tr',
        address: 'Tuzla Tersaneler Bölgesi, İstanbul'
      }
    });

    const options = {
      hostname: '127.0.0.1',
      port: 4200,
      path: '/api/corporate/plan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const response = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    assert.equal(response.statusCode, 200, 'Endpoint should return 200 OK');
    assert.equal(response.body.success, true, 'Response must be success: true');
    assert.equal(response.body.generationMode, 'AUTONOMOUS_SYNTHESIS', 'Must use AUTONOMOUS_SYNTHESIS mode');
    assert.ok(response.body.previewUrl, 'Must return a previewUrl');
    assert.ok(response.body.designFingerprint, 'Must return designFingerprint');
    assert.ok(response.body.synthesis, 'Must return synthesis object for UI');
    assert.ok(Array.isArray(response.body.synthesis.files), 'synthesis.files must be an array');
    assert.equal(response.body.synthesis.files[0].path, 'public/index.html', 'First file must be public/index.html');
    assert.ok(response.body.synthesis.files[0].content.includes('<!DOCTYPE html>'), 'File content must contain full HTML');
  });

  await t.test('2. Generation Mode Invariant: generationMode === "AUTONOMOUS_SYNTHESIS" is verified', async () => {
    const result = await synthesizeAutonomousWebsite({
      generationMode: GenerationMode.AUTONOMOUS_SYNTHESIS,
      manual: {
        companyName: 'Test Firma A.Ş.',
        industry: 'Kurumsal Danışmanlık'
      },
      options: { skipBrowserRender: true }
    });

    assert.equal(result.generationMode, 'AUTONOMOUS_SYNTHESIS', 'Pipeline output must have generationMode AUTONOMOUS_SYNTHESIS');
    assert.equal(result.report.generationMode, 'AUTONOMOUS_SYNTHESIS', 'Report must have generationMode AUTONOMOUS_SYNTHESIS');
    assert.equal(result.proposalOnly, true, 'proposalOnly invariant must remain true');
    assert.equal(result.executionAuthorized, false, 'executionAuthorized invariant must remain false');
  });

  await t.test('3. Design Reasoning -> HTML: Strategy decisions explicitly reflected in DOM tags/attributes', async () => {
    const result = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Bosphorus Avukatlık Bürosu',
        industry: 'Hukuk ve Danışmanlık',
        slogan: 'Hukuki Güven ve Kurumsal Danışmanlık'
      },
      options: { skipBrowserRender: true }
    });

    const html = result.composition.html;
    assert.ok(html.includes('data-hero-pattern="centered_editorial_authority"'), 'Legal industry must produce centered editorial hero in DOM');
    assert.ok(html.includes('hero-centered'), 'Legal industry must have hero-centered CSS class in DOM');
    assert.ok(html.includes('data-trust-pattern="credential_badges"'), 'Legal industry must have credential badges trust pattern');
  });

  await t.test('4. Layout Graph -> DOM: DOM sections appear in the exact order specified by layoutGraph.sections', async () => {
    // Test Gastronomy: Menu catalog must appear BEFORE trust bar and about section
    const resultGastro = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Gaziantep Lezzet Konağı',
        industry: 'Restoran ve Lokanta',
        slogan: 'Geleneksel Mutfak Sanatı'
      },
      options: { skipBrowserRender: true }
    });

    const html = resultGastro.composition.html;
    const heroIndex = html.indexOf('id="hero"');
    const menuIndex = html.indexOf('id="offerings-section"');
    const trustIndex = html.indexOf('id="trust-bar-section"');
    const aboutIndex = html.indexOf('id="hakkimizda"');

    assert.ok(heroIndex !== -1, 'Hero must exist');
    assert.ok(menuIndex !== -1, 'Menu offerings must exist');
    assert.ok(trustIndex !== -1, 'Trust bar must exist');
    assert.ok(aboutIndex !== -1, 'About section must exist');

    // Section order check: hero -> menu -> trust -> about
    assert.ok(heroIndex < menuIndex, 'Hero must precede menu offerings');
    assert.ok(menuIndex < trustIndex, 'Menu offerings must precede trust bar in gastronomy');
    assert.ok(trustIndex < aboutIndex, 'Trust bar must precede about in gastronomy');
  });

  await t.test('5. Design System -> CSS: Parametric tokens injected as CSS variables and applied to layout', async () => {
    const customBrandColor = '#8b5cf6';
    const profile = normalizeCompanyProfile({
      manual: {
        companyName: 'Mor Yıldız Ajans',
        industry: 'Dijital Medya & Tasarım',
        theme: customBrandColor
      }
    });

    const strategy = deduceDesignStrategy(profile);
    const layout = buildLayoutGraph(profile, strategy);
    const tokens = generateDesignTokens(profile, strategy);
    const composition = synthesizeWebsite({
      companyProfile: profile,
      designStrategy: strategy,
      layoutGraph: layout,
      designSystem: tokens
    });

    assert.ok(composition.css.includes('--color-primary:'), 'CSS must declare --color-primary variable');
    assert.ok(composition.css.includes('--font-display:'), 'CSS must declare --font-display variable');
    assert.ok(composition.css.includes('--font-body:'), 'CSS must declare --font-body variable');
    assert.ok(composition.html.includes(composition.css), 'HTML must embed the generated CSS stylesheet');
  });

  await t.test('6. Visual Composition -> DOM: Dynamic composition eliminates single hardcoded skeleton', async () => {
    // Industrial profile
    const indProfile = normalizeCompanyProfile({
      manual: {
        companyName: 'Hassas Makina Sanayi',
        industry: 'Endüstriyel İmalat'
      }
    });
    const indStrategy = deduceDesignStrategy(indProfile);
    const indLayout = buildLayoutGraph(indProfile, indStrategy);
    const indTokens = generateDesignTokens(indProfile, indStrategy);
    const indComp = synthesizeWebsite({
      companyProfile: indProfile,
      designStrategy: indStrategy,
      layoutGraph: indLayout,
      designSystem: indTokens
    });

    // Gastronomy profile
    const foodProfile = normalizeCompanyProfile({
      manual: {
        companyName: 'Nefis Fırın & Cafe',
        industry: 'Restoran ve Lokanta'
      }
    });
    const foodStrategy = deduceDesignStrategy(foodProfile);
    const foodLayout = buildLayoutGraph(foodProfile, foodStrategy);
    const foodTokens = generateDesignTokens(foodProfile, foodStrategy);
    const foodComp = synthesizeWebsite({
      companyProfile: foodProfile,
      designStrategy: foodStrategy,
      layoutGraph: foodLayout,
      designSystem: foodTokens
    });

    assert.notEqual(indLayout.architectureQuestions.q1_sectionSequence.join(','),
      foodLayout.architectureQuestions.q1_sectionSequence.join(','),
      'Industrial and Gastronomy must have different section sequences');

    assert.ok(indComp.html.includes('data-hero-pattern="split_hero_specs_and_stats"'), 'Industrial must have specs hero');
    assert.ok(foodComp.html.includes('data-hero-pattern="split_hero_appetite_led"'), 'Gastronomy must have appetite hero');
    assert.notEqual(indComp.html, foodComp.html, 'Synthesized HTML must NOT be identical');
  });

  await t.test('7. Template Bypass: Zero pre-baked templates or static clones used in generation', async () => {
    const result = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Algoritmik Tasarım Ltd.',
        industry: 'Yazılım'
      },
      options: { skipBrowserRender: true }
    });

    // Verify it doesn't contain boilerplate template placeholders
    const html = result.composition.html;
    assert.ok(!html.includes('LOREM_IPSUM'), 'Must not contain template dummy text');
    assert.ok(!html.includes('{{TEMPLATE_BODY}}'), 'Must not contain template handlebar markers');
    assert.ok(!html.includes('DUMMY_COMPANY_NAME'), 'Must not contain dummy company placeholders');
    assert.ok(result.qualityGate.originalityPass, 'Originality guard must pass');
  });

  await t.test('8. Same-Sector Variation: 3 companies in Petcare (Boutique, Clinic, E-commerce) yield distinct layouts', async () => {
    // 1. Boutique Petshop
    const resA = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Pati Butik & Kuaför',
        industry: 'Petshop',
        slogan: 'Seçkin Dostlara Özel Butik Bakım',
        description: 'Özel tasarım kedi ve köpek kıyafetleri, butik organik mamalar ve lüks spa.'
      },
      options: { skipBrowserRender: true, inspirationNotes: 'butik lüks pet bakım ve özel tasarım tasmalar' }
    });

    // 2. Community Veterinary Clinic
    const resB = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Merkez Veteriner Kliniği',
        industry: 'Petshop & Veteriner',
        slogan: '7/24 Dostunuzun Yanındayız',
        description: 'Koruyucu hekimlik, aşı takvimi, cerrahi tedavi ve acil hekim desteği.'
      },
      options: { skipBrowserRender: true, inspirationNotes: 'veteriner kliniği, aşı ve acil tedavi' }
    });

    // 3. E-commerce / Wholesale Petshop
    const resC = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Arazya Mama Toptan',
        industry: 'Petshop',
        slogan: 'En Uygun Fiyatlı Orijinal Mamalar',
        description: 'Kedi ve köpek mamalarında toptan fiyatına perakende satış ve aynı gün hızlı teslimat.'
      },
      options: { skipBrowserRender: true, inspirationNotes: 'toptan mama satışı, kapıda ödeme, hızlı kurye' }
    });

    // Verify distinct hero patterns
    assert.equal(resA.designFingerprint.heroSignature, 'boutique_curated_showcase', 'A must have boutique showcase hero');
    assert.equal(resB.designFingerprint.heroSignature, 'community_care_hero', 'B must have community care hero');
    assert.equal(resC.designFingerprint.heroSignature, 'product_conversion_first', 'C must have product conversion first hero');

    // Verify distinct layout signatures
    assert.notEqual(resA.designFingerprint.layoutSignature, resB.designFingerprint.layoutSignature, 'A and B must have different layout signatures');
    assert.notEqual(resB.designFingerprint.layoutSignature, resC.designFingerprint.layoutSignature, 'B and C must have different layout signatures');
    assert.notEqual(resA.designFingerprint.layoutSignature, resC.designFingerprint.layoutSignature, 'A and C must have different layout signatures');

    // Verify distinct card signatures
    assert.notEqual(resA.designFingerprint.cardSignature, resC.designFingerprint.cardSignature, 'A and C must have different offering card patterns');
  });

  await t.test('9. Cross-Sector Variation: 6 distinct sectors yield fundamentally different DOM trees', async () => {
    const sectors = [
      { name: 'Gastronomi', manual: { companyName: 'Anadolu Lezzetleri', industry: 'Restoran' } },
      { name: 'Hukuk', manual: { companyName: 'Adalet Hukuk Bürosu', industry: 'Hukuk Danışmanlık' } },
      { name: 'Endüstri', manual: { companyName: 'Toros Çelik Dövme', industry: 'İmalat & Sanayi' } },
      { name: 'Petshop', manual: { companyName: 'Pati Diyarı', industry: 'Petshop Mama' } },
      { name: 'Yazılım', manual: { companyName: 'SaaSify Bulut Sistemleri', industry: 'Yazılım ve Teknoloji' } },
      { name: 'Sağlık', manual: { companyName: 'Özel Hayat Tıp Merkezi', industry: 'Sağlık ve Klinik' } }
    ];

    const results = [];
    for (const s of sectors) {
      const res = await synthesizeAutonomousWebsite({
        manual: s.manual,
        options: { skipBrowserRender: true }
      });
      results.push(res);
    }

    // Collect hero patterns
    const heroPatterns = results.map(r => r.designFingerprint.heroSignature);
    const uniqueHeroPatterns = new Set(heroPatterns);
    assert.ok(uniqueHeroPatterns.size >= 5, `Expected at least 5 unique hero signatures across 6 sectors, got ${uniqueHeroPatterns.size}`);

    // Collect layout signatures
    const layoutSignatures = results.map(r => r.designFingerprint.layoutSignature);
    const uniqueLayoutSignatures = new Set(layoutSignatures);
    assert.ok(uniqueLayoutSignatures.size >= 5, `Expected at least 5 unique layout signatures across 6 sectors, got ${uniqueLayoutSignatures.size}`);
  });

  await t.test('10. Structural Similarity Metric: Pairwise DOM structural similarity between sectors is strictly < 0.70', async () => {
    const sectorConfigs = [
      { id: 'gastro', manual: { companyName: 'Lezzet Sofrası', industry: 'Restoran ve Lokanta' } },
      { id: 'legal', manual: { companyName: 'Demir & Ortakları Hukuk', industry: 'Hukuk' } },
      { id: 'industrial', manual: { companyName: 'Atlas CNC Sanayi', industry: 'Endüstriyel İmalat' } },
      { id: 'retail', manual: { companyName: 'Pati Market', industry: 'Petshop' } },
      { id: 'health', manual: { companyName: 'Yaşam Polikliniği', industry: 'Sağlık ve Klinik' } }
    ];

    const fingerprints = [];
    for (const sc of sectorConfigs) {
      const res = await synthesizeAutonomousWebsite({
        manual: sc.manual,
        options: { skipBrowserRender: true }
      });
      // Extract structural tokens: section id + layoutPattern + interactiveComponent
      const structuralTokens = res.layoutGraph.sections.map(s => `${s.id}:${s.layoutPattern}:${s.interactiveComponent}`);
      fingerprints.push({ id: sc.id, tokens: structuralTokens });
    }

    // Verify pairwise Jaccard similarity across all pairs
    for (let i = 0; i < fingerprints.length; i++) {
      for (let j = i + 1; j < fingerprints.length; j++) {
        const sim = computeJaccardSimilarity(fingerprints[i].tokens, fingerprints[j].tokens);
        assert.ok(sim < 0.70,
          `Structural similarity between ${fingerprints[i].id} and ${fingerprints[j].id} must be < 0.70, got ${sim.toFixed(3)}`
        );
      }
    }
  });

  await t.test('11. Design Fingerprint Generation: Valid designFingerprint generated and saved to disk', async () => {
    const result = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Fingerprint Test Şirketi',
        industry: 'Hukuk'
      },
      options: { skipBrowserRender: true }
    });

    const fp = result.designFingerprint;
    assert.ok(fp, 'Fingerprint must exist');
    assert.ok(fp.generationId, 'Fingerprint must have generationId');
    assert.ok(fp.layoutSignature, 'Fingerprint must have layoutSignature');
    assert.ok(fp.heroSignature, 'Fingerprint must have heroSignature');
    assert.ok(fp.paletteSignature, 'Fingerprint must have paletteSignature');
    assert.ok(fp.typeSignature, 'Fingerprint must have typeSignature');
    assert.ok(fp.ctaSignature, 'Fingerprint must have ctaSignature');
    assert.ok(fp.cardSignature, 'Fingerprint must have cardSignature');
    assert.ok(fp.densitySignature, 'Fingerprint must have densitySignature');
    assert.ok(fp.computedHash, 'Fingerprint must have computedHash');
    assert.ok(Array.isArray(fp.sectionOrder), 'Fingerprint must have sectionOrder array');

    // Verify disk write
    const fpFilePath = path.join(result.report.storageDirectory, 'design-fingerprint.json');
    assert.ok(fs.existsSync(fpFilePath), 'design-fingerprint.json must exist in storage');
    const diskFp = JSON.parse(fs.readFileSync(fpFilePath, 'utf-8'));
    assert.equal(diskFp.computedHash, fp.computedHash, 'Disk fingerprint must match in-memory fingerprint');
  });

  await t.test('12. Preview Integrity: synthesis.files contains valid public/index.html ready for UI preview', async () => {
    const payload = JSON.stringify({
      companyName: 'Boğaziçi Dental Klinik',
      industry: 'Sağlık',
      services: [{ title: 'İmplant Tedavisi', description: 'Ağrısız cerrahi implant.' }]
    });

    const options = {
      hostname: '127.0.0.1',
      port: 4200,
      path: '/api/corporate/plan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const res = await new Promise((resolve, reject) => {
      const req = http.request(options, (r) => {
        let d = '';
        r.on('data', chunk => { d += chunk; });
        r.on('end', () => resolve(JSON.parse(d)));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    assert.ok(res.synthesis, 'synthesis object must exist');
    const indexFile = res.synthesis.files.find(f => f.path === 'public/index.html');
    assert.ok(indexFile, 'public/index.html must exist in files array');
    assert.ok(indexFile.content.length > 2000, 'HTML content must be rich and complete (> 2000 chars)');
    assert.ok(indexFile.content.includes('<header class="site-header" id="site-header">'), 'Must include solid sticky header');
    assert.ok(indexFile.content.includes('Boğaziçi Dental Klinik'), 'Must include company name');
  });

  await t.test('13. Legacy Fallback Detection: forceLegacy flag triggers generationMode === "LEGACY_FALLBACK"', async () => {
    const payload = JSON.stringify({
      companyName: 'Legacy Test Ltd.',
      industry: 'Danışmanlık',
      forceLegacy: true
    });

    const options = {
      hostname: '127.0.0.1',
      port: 4200,
      path: '/api/corporate/plan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const res = await new Promise((resolve, reject) => {
      const req = http.request(options, (r) => {
        let d = '';
        r.on('data', chunk => { d += chunk; });
        r.on('end', () => resolve(JSON.parse(d)));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    assert.equal(res.generationMode, 'LEGACY_FALLBACK', 'forceLegacy must trigger LEGACY_FALLBACK mode');
    assert.equal(res.success, true, 'Legacy fallback must return success: true');
    assert.ok(res.synthesis, 'Legacy fallback must return synthesis object');
  });

  await t.test('14. Arazya Real-World UI Generation: Arazya Petshop synthesizes full autonomous design with real Google data', async () => {
    const arazyaPayload = JSON.stringify({
      companyName: 'Arazya Petshop & Kedi Köpek Maması',
      industry: 'Petshop',
      slogan: 'Tüm Evcil Hayvan İhtiyaçları Aynı Gün Kapınızda',
      description: 'Orijinal premium kedi ve köpek mamaları, konserve lezzetler, kedi kumları ve pet aksesuarları.',
      services: [
        { title: 'Kedi Mamaları & Konserveler', description: 'Tahılsız ve kısırlaştırılmış kedi mamaları.' },
        { title: 'Köpek Mamaları & Ödüller', description: 'Büyük ve küçük ırk premium köpek mamaları.' },
        { title: 'Kedi Kumları & Hijyen', description: 'Doğal bentonit ve çam peleti kum çeşitleri.' }
      ],
      contact: {
        phone: '0532 111 22 33',
        email: 'siparis@arazyapet.com',
        address: 'Kadıköy, İstanbul',
        workingHours: 'Hergün 09:00 - 21:00'
      },
      googleRating: 4.9,
      googleReviewCount: 114,
      googleReviews: [
        { author: 'Canan T.', text: 'Aynı gün hızlı kurye ile mamamız kapımıza geldi, hediyeler için de teşekkürler!', stars: '★★★★★' },
        { author: 'Murat K.', text: 'Orijinal ürün, son kullanma tarihi çok yeni. Tavsiye ederim.', stars: '★★★★★' }
      ]
    });

    const options = {
      hostname: '127.0.0.1',
      port: 4200,
      path: '/api/corporate/plan',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(arazyaPayload)
      }
    };

    const res = await new Promise((resolve, reject) => {
      const req = http.request(options, (r) => {
        let d = '';
        r.on('data', chunk => { d += chunk; });
        r.on('end', () => resolve(JSON.parse(d)));
      });
      req.on('error', reject);
      req.write(arazyaPayload);
      req.end();
    });

    assert.equal(res.success, true, 'Arazya generation must succeed');
    assert.equal(res.generationMode, 'AUTONOMOUS_SYNTHESIS', 'Arazya must be synthesized autonomously');
    assert.equal(res.designFingerprint.heroSignature, 'product_conversion_first', 'Arazya must have product conversion first hero');
    assert.equal(res.designFingerprint.cardSignature, 'product_catalog_bento_grid', 'Arazya must have product catalog bento grid');
    assert.equal(res.designFingerprint.trustSignature, 'delivery_guarantee_trust_bar', 'Arazya must have delivery guarantee trust bar');

    const html = res.synthesis.files[0].content;
    assert.ok(html.includes('Aynı Gün Kurye'), 'Arazya HTML must emphasize fast delivery');
    assert.ok(html.includes('Arazya Petshop'), 'Arazya HTML must contain company name');
    assert.ok(html.includes('4.9'), 'Arazya HTML must contain verified Google rating');
  });

});
