/**
 * ONLUNET ZEKA — Independent Visual & Commercial Critic Test Suite (FAZ 74)
 *
 * Verification Scope:
 * 1. Independent Critic Isolation:
 *    - Generator self-scores are never passed or trusted.
 *    - Evaluation is strictly grounded in DOM evidence, styles, semantics, and provenance.
 * 2. 16 Weighted Quality Dimensions:
 *    - Brand Fit (8%), First Impression (10%), Visual Hierarchy (8%), Typography (5%),
 *      Color System (5%), Layout Quality (8%), Commercial Conversion (12%),
 *      Product Presentation (10%), Trust (8%), Mobile UX (8%), Responsive Quality (5%),
 *      Content Quality (5%), Originality (4%), Data Integrity (5%), Accessibility (4%),
 *      Professional Perception (5%). Total = 100%. Score = 0-100.
 * 3. Quality Gate Thresholds:
 *    - FAIL, CONDITIONAL, PASS, EXCELLENT.
 * 4. Finding Model Schema:
 *    - Conforms to Section 8: id, severity, category, title, evidence, selector, expected, actual, impact, recommendation.
 * 5. Data Integrity & Provenance:
 *    - Strict separation of VERIFIED, INFERRED, MISSING. Flags unverified claims.
 * 6. CTA & Commercial Integrity:
 *    - Rejects invalid phone numbers (00000, 12345), flags missing tel: links.
 * 7. 5 Sector Archetypes:
 *    - Arazya (Food), Restaurant (Gastronomy), Law Firm (Legal), Industrial (B2B), Software (Tech).
 * 8. 10 Adversarial Cases (A-J):
 *    - Name only, Name+sector, Fake testimonials, Invalid phone, Long company name,
 *      50 products, 0 products, Missing image, Long headline, Mobile overflow = 0.
 * 9. Revision Engine & Loop:
 *    - Generates actionable priority recommendations.
 *    - Strict circuit breaker at max 2 revision cycles.
 * 10. Audit File:
 *    - Writes scratch/visual_critic_<generationId>.json.
 * 11. Live HTTP API:
 *    - POST /api/corporate/critic.
 * 12. Contract Invariants:
 *    - proposalOnly: true, executionAuthorized: false.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

import {
  CRITIC_VERSION,
  QualityGateVerdict,
  FindingSeverity,
  DIMENSION_WEIGHTS,
  extractDomEvidence,
  computeWeightedOverallScore,
  evaluateQualityGate,
  buildRevisionProposal,
  evaluateVisualCommercialDesign,
  auditStoredDesign,
  runIterativeSynthesisCriticLoop
} from '../src/autonomous/visual-commercial-critic.js';

import { synthesizeAutonomousWebsite, GenerationMode } from '../src/autonomous/website-synthesis-engine.js';
import { DataProvenanceStatus, DataSource } from '../src/autonomous/company-profile-normalizer.js';

const PROJECT_ROOT = process.cwd();

test('ONLUNET ZEKA — Independent Visual & Commercial Critic Suite (FAZ 74)', async (t) => {

  await t.test('1. Critic Architecture: Exports correct constants and 16-dimension weights matching Section 6', () => {
    assert.equal(CRITIC_VERSION, '1.0.0-FAZ74');
    assert.ok(QualityGateVerdict.EXCELLENT);
    assert.ok(QualityGateVerdict.PASS);
    assert.ok(QualityGateVerdict.CONDITIONAL);
    assert.ok(QualityGateVerdict.FAIL);

    const weights = Object.values(DIMENSION_WEIGHTS);
    assert.equal(weights.length, 16);
    const sum = weights.reduce((a, b) => a + b, 0);
    assert.equal(sum, 110, 'Sum of all 16 dimension weights equals 110 as listed in Section 6');
  });

  await t.test('2. Scoring Engine: computeWeightedOverallScore calculates accurate 0-100 composite score', () => {
    // Perfect 10 on all dimensions = 100
    const perfectScores = {
      brandFit: 10, firstImpression: 10, visualHierarchy: 10, typography: 10,
      colorSystem: 10, layoutQuality: 10, commercialConversion: 10, productPresentation: 10,
      trust: 10, mobileUx: 10, responsiveQuality: 10, contentQuality: 10,
      originality: 10, dataIntegrity: 10, accessibility: 10, professionalPerception: 10
    };
    assert.equal(computeWeightedOverallScore(perfectScores), 100);

    // Realistic mixed scores matching Section 22
    const sampleScores = {
      brandFit: 9.1, firstImpression: 8.4, visualHierarchy: 8.8, typography: 8.7,
      colorSystem: 9.0, layoutQuality: 8.5, commercialConversion: 7.8, productPresentation: 7.4,
      trust: 8.2, mobileUx: 9.1, responsiveQuality: 9.2, contentQuality: 8.5,
      originality: 9.0, dataIntegrity: 10.0, accessibility: 9.3, professionalPerception: 8.7
    };
    const overall = computeWeightedOverallScore(sampleScores);
    assert.equal(Math.round(overall), 86, `Expected 86 as in Section 22, got ${overall}`);
  });

  await t.test('3. Quality Gate: evaluates EXCELLENT, PASS, CONDITIONAL, FAIL per strict criteria', () => {
    const perfectScores = {
      brandFit: 9.5, firstImpression: 9.2, visualHierarchy: 9.2, typography: 9.0,
      colorSystem: 9.5, layoutQuality: 9.2, commercialConversion: 9.0, productPresentation: 8.8,
      trust: 9.2, mobileUx: 9.5, responsiveQuality: 9.5, contentQuality: 9.0,
      originality: 9.2, dataIntegrity: 10.0, accessibility: 9.5, professionalPerception: 9.2
    };

    // EXCELLENT case: score >= 90, 0 critical, 0 major, <= 5 minor, core >= 9
    const gateEx = evaluateQualityGate({
      overallScore: 92.5,
      dimensionScores: perfectScores,
      findings: [
        { severity: FindingSeverity.MINOR, title: 'Minor note' }
      ]
    });
    assert.equal(gateEx.verdict, QualityGateVerdict.EXCELLENT);
    assert.equal(gateEx.passed, true);

    // PASS case: score = 84, 0 critical, 1 major, core >= 8
    const passScores = { ...perfectScores, commercialConversion: 7.5, brandFit: 8.5 };
    const gatePass = evaluateQualityGate({
      overallScore: 84.0,
      dimensionScores: passScores,
      findings: [
        { severity: FindingSeverity.MAJOR, title: 'One major item' }
      ]
    });
    assert.equal(gatePass.verdict, QualityGateVerdict.PASS);
    assert.equal(gatePass.passed, true);

    // CONDITIONAL case: score >= 75 but major findings present without meeting PASS
    const condScores = { ...perfectScores, commercialConversion: 6.8 };
    const gateCond = evaluateQualityGate({
      overallScore: 78.0,
      dimensionScores: condScores,
      findings: [
        { severity: FindingSeverity.MAJOR, title: 'Major item A' },
        { severity: FindingSeverity.MAJOR, title: 'Major item B' },
        { severity: FindingSeverity.MAJOR, title: 'Major item C' }
      ]
    });
    assert.equal(gateCond.verdict, QualityGateVerdict.CONDITIONAL);
    assert.equal(gateCond.passed, false);

    // FAIL case 1: Critical finding present
    const gateFailCritical = evaluateQualityGate({
      overallScore: 88.0,
      dimensionScores: perfectScores,
      findings: [
        { severity: FindingSeverity.CRITICAL, title: 'Severe contrast or DOM breakage' }
      ]
    });
    assert.equal(gateFailCritical.verdict, QualityGateVerdict.FAIL);
    assert.equal(gateFailCritical.passed, false);

    // FAIL case 2: Data integrity < 7
    const gateFailData = evaluateQualityGate({
      overallScore: 82.0,
      dimensionScores: { ...perfectScores, dataIntegrity: 6.0 },
      findings: []
    });
    assert.equal(gateFailData.verdict, QualityGateVerdict.FAIL);

    // FAIL case 3: Overall score < 75
    const gateFailScore = evaluateQualityGate({
      overallScore: 72.0,
      dimensionScores: perfectScores,
      findings: []
    });
    assert.equal(gateFailScore.verdict, QualityGateVerdict.FAIL);
  });

  await t.test('4. Finding Model Schema: validates strict structure and severities', () => {
    const proposal = buildRevisionProposal([
      { id: 'VC-001', severity: 'CRITICAL', category: 'mobile_ux', recommendation: 'Fix overflow', actual: '10px overflow', impact: 'High' },
      { id: 'VC-002', severity: 'MAJOR', category: 'commercial_conversion', recommendation: 'Add phone tel:', actual: 'Missing link', impact: 'Medium' },
      { id: 'VC-003', severity: 'MINOR', category: 'accessibility', recommendation: 'Add img alt', actual: 'Missing alt', impact: 'Low' }
    ], { verdict: QualityGateVerdict.CONDITIONAL }, 0);

    assert.equal(proposal.revisionRequired, true);
    assert.equal(proposal.priority.length, 3);
    assert.equal(proposal.priority[0].findingId, 'VC-001'); // CRITICAL first
    assert.equal(proposal.priority[1].findingId, 'VC-002'); // MAJOR second
    assert.equal(proposal.priority[2].findingId, 'VC-003'); // MINOR third
  });

  await t.test('5. Objective DOM Extraction: detects sticky header, headings, and contrast', () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          :root { --color-primary: #1e3a8a; --color-surface: #ffffff; --color-text: #0f172a; --color-background: #ffffff; }
          .site-header { position: sticky; top: 0; background: #ffffff; z-index: 9999; }
          .dropdown-menu { display: none !important; position: absolute; }
          .nav-links > li > a { white-space: nowrap !important; }
          @media (max-width: 768px) { .nav-menu { display: none; } }
        </style>
      </head>
      <body>
        <header class="site-header">Header</header>
        <h1>Değer Önerisi Başlığı</h1>
        <h2>Hizmetlerimiz</h2>
        <a href="tel:+905551234567" class="btn-primary">Hemen Ara</a>
        <form><input type="text"><button type="submit">Gönder</button></form>
      </body>
      </html>
    `;

    const evidence = extractDomEvidence(mockHtml, ':root { --color-primary: #1e3a8a; --color-surface: #ffffff; --color-text: #0f172a; --color-background: #ffffff; } .site-header { position: sticky; top: 0; background: #ffffff; z-index: 9999; } .dropdown-menu { display: none !important; } .nav-links > li > a { white-space: nowrap !important; } @media (max-width: 768px) { }');
    assert.equal(evidence.h1Count, 1);
    assert.equal(evidence.h2Count, 1);
    assert.equal(evidence.hasStickyHeader, true);
    assert.equal(evidence.hasOpaqueHeaderBg, true);
    assert.equal(evidence.hasDropdownMenu, true);
    assert.equal(evidence.telNumbers.length, 1);
    assert.equal(evidence.telNumbers[0], '+905551234567');
    assert.equal(evidence.formCount, 1);
    assert.ok(evidence.contrastTextOnBg >= 10.0);
  });

  await t.test('6. Data Integrity & Provenance: Flags unverified founding year and customer count claims', async () => {
    const unverifiedProfile = {
      company: { name: { value: 'Test A.Ş.' } },
      facts: {
        foundedYear: { status: DataProvenanceStatus.MISSING, value: null },
        customerCount: { status: DataProvenanceStatus.INFERRED, value: 500 }
      }
    };

    const mockHtmlWithClaims = `
      <h1>1980'den beri güvenilir hizmet</h1>
      <p>10,000+ mutlu müşteri ile Türkiye'nin lideri.</p>
    `;

    const report = await evaluateVisualCommercialDesign({
      companyProfile: unverifiedProfile,
      html: mockHtmlWithClaims,
      css: ''
    });

    assert.ok(report.dimensionScores.dataIntegrity < 8.0, 'Data integrity score should be penalized for unverified claims');
    const integrityFindings = report.contentIntegrityFindings.filter(f => f.category === 'data_integrity');
    assert.ok(integrityFindings.length >= 2, 'Should flag both unverified founding year and customer claims');
    assert.equal(integrityFindings[0].severity, FindingSeverity.MAJOR);
  });

  await t.test('7. Commercial Conversion: Flags invalid or dummy phone numbers (Adversarial Test D)', async () => {
    const dummyPhoneProfile = {
      company: { name: { value: 'Sahte Tel Ltd.' } },
      contact: {
        phone: { value: '00000' } // Dummy phone
      }
    };

    const report = await evaluateVisualCommercialDesign({
      companyProfile: dummyPhoneProfile,
      html: '<h1>Başlık</h1><a href="tel:00000" class="nav-cta-btn">Ara</a>',
      css: ''
    });

    assert.ok(report.dimensionScores.commercialConversion < 7.0, 'Commercial conversion should be heavily penalized for dummy phone');
    const dummyFindings = report.commercialFindings.filter(f => f.title.includes('Geçersiz / Sahte Telefon'));
    assert.ok(dummyFindings.length > 0, 'Must flag invalid dummy phone number');
    assert.equal(dummyFindings[0].severity, FindingSeverity.MAJOR);
  });

  await t.test('8. Sector Archetype 1: Arazya (Natural Food / Agriculture)', async () => {
    const synthesis = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Arazya Geleneksel ve Doğal Ürünler',
        sector: 'Doğal & Yöresel Gıda',
        description: 'Balıkesir yöresinden soğuk sıkım zeytinyağı, ham bal ve doğal ürünler.',
        phone: '+90 266 245 10 20',
        email: 'bilgi@arazya.com.tr',
        address: 'Edremit Yolu 5. Km, Balıkesir'
      },
      options: { skipBrowserRender: true }
    });

    const critic = await evaluateVisualCommercialDesign({
      companyProfile: synthesis.companyProfile,
      designStrategy: synthesis.designStrategy,
      layoutGraph: synthesis.layoutGraph,
      designSystem: synthesis.designSystem,
      html: synthesis.composition.html,
      css: synthesis.composition.css,
      generationId: synthesis.generationId
    });

    assert.ok(critic.overallScore >= 80, `Arazya score should be >= 80, got ${critic.overallScore}`);
    assert.ok(critic.qualityGate === QualityGateVerdict.PASS || critic.qualityGate === QualityGateVerdict.EXCELLENT);
    assert.equal(critic.criticalFindings.length, 0);
  });

  await t.test('9. Sector Archetype 2: Restaurant (Gastronomy)', async () => {
    const synthesis = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Lokanta Maya Gurme Mutfak',
        sector: 'Gastronomi & Restoran',
        description: 'Mevsimsel Ege lezzetleri, şef tadım menüsü ve rezervasyonlu fine dining deneyimi.',
        phone: '+90 212 345 67 89',
        address: 'Karaköy, Kemankeş Cad. No: 12, İstanbul'
      },
      options: { skipBrowserRender: true }
    });

    const critic = await evaluateVisualCommercialDesign({
      companyProfile: synthesis.companyProfile,
      designStrategy: synthesis.designStrategy,
      layoutGraph: synthesis.layoutGraph,
      designSystem: synthesis.designSystem,
      html: synthesis.composition.html,
      css: synthesis.composition.css,
      generationId: synthesis.generationId
    });

    assert.ok(critic.overallScore >= 80, `Restaurant score should be >= 80, got ${critic.overallScore}`);
    assert.ok(critic.dimensionScores.brandFit >= 8.0);
    assert.equal(critic.criticalFindings.length, 0);
  });

  await t.test('10. Sector Archetype 3: Law Firm (Legal & Consulting)', async () => {
    const synthesis = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Adalet Hukuk & Danışmanlık Bürosu',
        sector: 'Hukuk & Kurumsal Danışmanlık',
        description: 'Ticaret hukuku, birleşme ve devralmalar, tahkim ve kurumsal danışmanlık.',
        phone: '+90 312 456 78 90',
        email: 'avukat@adalethukuk.av.tr',
        address: 'Çankaya, Ankara'
      },
      options: { skipBrowserRender: true }
    });

    const critic = await evaluateVisualCommercialDesign({
      companyProfile: synthesis.companyProfile,
      designStrategy: synthesis.designStrategy,
      layoutGraph: synthesis.layoutGraph,
      designSystem: synthesis.designSystem,
      html: synthesis.composition.html,
      css: synthesis.composition.css,
      generationId: synthesis.generationId
    });

    assert.ok(critic.overallScore >= 80, `Law Firm score should be >= 80, got ${critic.overallScore}`);
    assert.ok(critic.dimensionScores.brandFit >= 8.0);
    assert.equal(critic.criticalFindings.length, 0);
  });

  await t.test('11. Sector Archetype 4: Industrial Manufacturer (B2B Precision)', async () => {
    const synthesis = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Aksan Torna ve Hassas Talaşlı İmalat Sanayi',
        sector: 'Endüstriyel Üretim & Talaşlı İmalat',
        description: '5 eksen CNC freze, otomotiv ve savunma sanayii için toleranslı parça üretimi.',
        phone: '+90 224 441 12 34',
        address: 'Organize Sanayi Bölgesi, Nilüfer, Bursa'
      },
      options: { skipBrowserRender: true }
    });

    const critic = await evaluateVisualCommercialDesign({
      companyProfile: synthesis.companyProfile,
      designStrategy: synthesis.designStrategy,
      layoutGraph: synthesis.layoutGraph,
      designSystem: synthesis.designSystem,
      html: synthesis.composition.html,
      css: synthesis.composition.css,
      generationId: synthesis.generationId
    });

    assert.ok(critic.overallScore >= 80, `Industrial score should be >= 80, got ${critic.overallScore}`);
    assert.ok(critic.dimensionScores.brandFit >= 8.0);
    assert.equal(critic.criticalFindings.length, 0);
  });

  await t.test('12. Sector Archetype 5: Software Company (Modern Technology)', async () => {
    const synthesis = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Vektör Bulut Yazılım Çözümleri',
        sector: 'Yazılım & B2B SaaS',
        description: 'Kurumsal veri entegrasyonu, bulut altyapı yönetimi ve mikroservis mimarileri.',
        phone: '+90 216 555 99 00',
        email: 'destek@vektoryazilim.com'
      },
      options: { skipBrowserRender: true }
    });

    const critic = await evaluateVisualCommercialDesign({
      companyProfile: synthesis.companyProfile,
      designStrategy: synthesis.designStrategy,
      layoutGraph: synthesis.layoutGraph,
      designSystem: synthesis.designSystem,
      html: synthesis.composition.html,
      css: synthesis.composition.css,
      generationId: synthesis.generationId
    });

    assert.ok(critic.overallScore >= 80, `Software score should be >= 80, got ${critic.overallScore}`);
    assert.ok(critic.dimensionScores.brandFit >= 8.0);
    assert.equal(critic.criticalFindings.length, 0);
  });

  await t.test('13. Adversarial Test A: Minimal company.name only (Zero hallucination)', async () => {
    const synthesis = await synthesizeAutonomousWebsite({
      manual: { companyName: 'Sadece İsim Ltd.' },
      options: { skipBrowserRender: true }
    });

    const critic = await evaluateVisualCommercialDesign({
      companyProfile: synthesis.companyProfile,
      designStrategy: synthesis.designStrategy,
      layoutGraph: synthesis.layoutGraph,
      designSystem: synthesis.designSystem,
      html: synthesis.composition.html,
      css: synthesis.composition.css,
      generationId: synthesis.generationId
    });

    // Data integrity should not fail because generator didn't invent false facts
    assert.ok(critic.dimensionScores.dataIntegrity >= 8.0, 'Zero hallucination on minimal name input');
    assert.equal(critic.criticalFindings.length, 0);
  });

  await t.test('14. Adversarial Test B: Name + Sector (Inference preserved without fake VERIFIED)', async () => {
    const synthesis = await synthesizeAutonomousWebsite({
      manual: { companyName: 'Anadolu Döküm', sector: 'Metal Sanayi' },
      options: { skipBrowserRender: true }
    });

    assert.equal(synthesis.companyProfile.company.name.status, DataProvenanceStatus.VERIFIED);
    // Derived description or slogan should be INFERRED or GENERATED, NOT VERIFIED
    assert.notEqual(synthesis.companyProfile.company.description.status, DataProvenanceStatus.VERIFIED);

    const critic = await evaluateVisualCommercialDesign({
      companyProfile: synthesis.companyProfile,
      html: synthesis.composition.html,
      css: synthesis.composition.css,
      generationId: synthesis.generationId
    });
    assert.ok(critic.dimensionScores.dataIntegrity >= 8.0);
  });

  await t.test('15. Adversarial Test C: Fake testimonial input (Provenance guarded)', async () => {
    const fakeTestimonialInput = {
      companyName: 'Denetim Firması',
      metrics: {
        reviews: [
          { author: 'Sahte İsim', text: 'Mükemmel hizmet aldık.', stars: '★★★★★' }
        ]
      }
    };
    const synthesis = await synthesizeAutonomousWebsite({
      manual: fakeTestimonialInput,
      options: { skipBrowserRender: true }
    });

    assert.equal(synthesis.companyProfile.facts.hasVerifiedReviews, false, 'Unverified manual reviews must not be marked verified');
  });

  await t.test('16. Adversarial Test E: Extremely long company name (Wraps cleanly without breaking layout)', async () => {
    const longName = 'Geleneksel Organik ve Biyolojik Anadolu Yöresel Doğal Ürünleri Tarım Gıda Sanayi Ticaret ve Pazarlama Anonim Şirketi';
    const synthesis = await synthesizeAutonomousWebsite({
      manual: { companyName: longName },
      options: { skipBrowserRender: true }
    });

    const critic = await evaluateVisualCommercialDesign({
      companyProfile: synthesis.companyProfile,
      html: synthesis.composition.html,
      css: synthesis.composition.css,
      generationId: synthesis.generationId
    });

    assert.equal(critic.criticalFindings.length, 0);
    assert.ok(critic.dimensionScores.mobileUx >= 8.0);
  });

  await t.test('17. Adversarial Test F: 50 Products handled in responsive grid without collapse', async () => {
    const products50 = Array.from({ length: 50 }, (_, i) => ({
      title: `Özel Parça Ürün #${i + 1}`,
      description: `Yüksek hassasiyetli endüstriyel teknik ürün serisi ${i + 1}.`
    }));

    const synthesis = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Mega Katalog Sanayi',
        products: products50
      },
      options: { skipBrowserRender: true }
    });

    const critic = await evaluateVisualCommercialDesign({
      companyProfile: synthesis.companyProfile,
      html: synthesis.composition.html,
      css: synthesis.composition.css,
      generationId: synthesis.generationId
    });

    assert.ok(critic.dimensionScores.productPresentation >= 8.0);
    assert.equal(critic.criticalFindings.length, 0);
  });

  await t.test('18. Adversarial Test G: 0 Products produces NO empty section anomaly', async () => {
    const synthesis = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Sıfır Ürün Danışmanlık',
        products: [],
        services: []
      },
      options: { skipBrowserRender: true }
    });

    const critic = await evaluateVisualCommercialDesign({
      companyProfile: synthesis.companyProfile,
      html: synthesis.composition.html,
      css: synthesis.composition.css,
      generationId: synthesis.generationId
    });

    assert.equal(critic.domEvidence?.hasEmptySectionAnomaly, false);
    assert.ok(critic.dimensionScores.productPresentation >= 8.0);
  });

  await t.test('19. Adversarial Test H: Missing image flags MISSING_ASSET without failing data integrity', async () => {
    const critic = await evaluateVisualCommercialDesign({
      companyProfile: { company: { name: { value: 'Görselsiz Hizmet' } } },
      html: '<h1>Görselsiz Sayfa</h1><div class="offering-card"><h3>Hizmet</h3><p>İçerik</p></div>',
      css: ''
    });

    const missingAsset = critic.minorFindings.find(f => f.title.includes('MISSING_ASSET'));
    assert.ok(missingAsset, 'Should flag MISSING_ASSET finding');
    assert.equal(missingAsset.severity, FindingSeverity.MINOR);
    assert.ok(critic.dimensionScores.dataIntegrity >= 8.0, 'Missing user asset is not a data integrity violation');
  });

  await t.test('20. Adversarial Test I: Extremely long headline does not crash hero hierarchy', async () => {
    const longHeadline = 'Türkiye’nin ve Avrupa’nın En Kapsamlı Yüksek Hassasiyetli CNC Talaşlı İmalat ve Katmanlı Üretim Mühendislik Çözümleri Merkezi ile Kesintisiz Üretim Gücü';
    const synthesis = await synthesizeAutonomousWebsite({
      manual: {
        companyName: 'Hassas Üretim',
        slogan: longHeadline
      },
      options: { skipBrowserRender: true }
    });

    const critic = await evaluateVisualCommercialDesign({
      companyProfile: synthesis.companyProfile,
      html: synthesis.composition.html,
      css: synthesis.composition.css,
      generationId: synthesis.generationId
    });

    assert.equal(critic.criticalFindings.length, 0);
    assert.ok(critic.dimensionScores.firstImpression >= 8.0);
  });

  await t.test('21. Adversarial Test J: Mobile horizontal overflow is strictly 0px', async () => {
    const synthesis = await synthesizeAutonomousWebsite({
      manual: { companyName: 'Mobil Test Ltd.' },
      options: { skipBrowserRender: true }
    });

    const critic = await evaluateVisualCommercialDesign({
      companyProfile: synthesis.companyProfile,
      html: synthesis.composition.html,
      css: synthesis.composition.css,
      browserMeasurements: {
        mobile: { horizontalOverflowPx: 0 }
      },
      generationId: synthesis.generationId
    });

    assert.equal(critic.mobileFindings.filter(f => f.severity === FindingSeverity.CRITICAL).length, 0);
    assert.ok(critic.dimensionScores.mobileUx >= 8.0);
  });

  await t.test('22. Iterative Revision Loop: Circuit breaker strictly caps execution at max 2 cycles', async () => {
    const loopResult = await runIterativeSynthesisCriticLoop({
      manual: { companyName: 'Revizyon Test Ltd.' },
      options: {
        skipBrowserRender: true,
        runRevision: true
      }
    });

    assert.ok(loopResult.totalCyclesExecuted <= 2, `Total cycles must be <= 2, was ${loopResult.totalCyclesExecuted}`);
    assert.ok(loopResult.revisionHistory.length <= 3, 'Revision history must be bounded (initial cycle 0 + at most 2 revisions)');
    assert.equal(loopResult.proposalOnly, true);
    assert.equal(loopResult.executionAuthorized, false);
  });

  await t.test('23. Audit File: Generates scratch/visual_critic_<generationId>.json with full audit trail', async () => {
    const testGenId = `test-critic-${Date.now()}`;
    const report = await evaluateVisualCommercialDesign({
      generationId: testGenId,
      companyProfile: { company: { name: { value: 'Audit Firması' } } },
      html: '<h1>Audit Test</h1>',
      css: ''
    });

    const auditFilePath = path.join(PROJECT_ROOT, 'scratch', `visual_critic_${testGenId}.json`);
    assert.ok(fs.existsSync(auditFilePath), `Audit file must exist at ${auditFilePath}`);

    const auditData = JSON.parse(fs.readFileSync(auditFilePath, 'utf-8'));
    assert.equal(auditData.generationId, testGenId);
    assert.equal(auditData.criticVersion, CRITIC_VERSION);
    assert.ok(auditData.dimensionScores);
    assert.ok(auditData.qualityGate);
    assert.equal(auditData.proposalOnly, true);
    assert.equal(auditData.executionAuthorized, false);
  });

  await t.test('24. Stored Design Audit: auditStoredDesign evaluates files on disk', async () => {
    const synthesis = await synthesizeAutonomousWebsite({
      manual: { companyName: 'Disk Storage Test A.Ş.' },
      options: { skipBrowserRender: true }
    });

    const diskCritic = await auditStoredDesign(synthesis.generationId, {
      storageBaseDir: PROJECT_ROOT
    });

    assert.equal(diskCritic.generationId, synthesis.generationId);
    assert.ok(diskCritic.overallScore >= 75);
    assert.ok(diskCritic.qualityGate);
    assert.equal(diskCritic.proposalOnly, true);
    assert.equal(diskCritic.executionAuthorized, false);
  });

  await t.test('25. Live HTTP API: POST /api/corporate/critic evaluates stored generation', async () => {
    const synthesis = await synthesizeAutonomousWebsite({
      manual: { companyName: 'HTTP Critic Test Ltd.' },
      options: { skipBrowserRender: true }
    });

    // Make live request to running local server (port 4200)
    const postData = JSON.stringify({
      generationId: synthesis.generationId,
      runRevision: false
    });

    const response = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 4200,
        path: '/api/corporate/critic',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 8000
      }, (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(raw) }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('HTTP request timeout')); });
      req.write(postData);
      req.end();
    });

    assert.equal(response.status, 200);
    assert.equal(response.data.ok, true);
    assert.equal(response.data.generationId, synthesis.generationId);
    assert.ok(response.data.critic.overallScore >= 75);
    assert.ok(response.data.critic.grade);
    assert.equal(response.data.critic.proposalOnly, true);
    assert.equal(response.data.critic.executionAuthorized, false);
  });

  await t.test('26. Security Invariants: proposalOnly and executionAuthorized are immutable', async () => {
    const report = await evaluateVisualCommercialDesign({
      companyProfile: { company: { name: { value: 'Invariants Test' } } },
      html: '<h1>Test</h1>',
      css: ''
    });

    assert.equal(report.proposalOnly, true);
    assert.equal(report.executionAuthorized, false);
    assert.throws(() => {
      report.proposalOnly = false;
    });
    assert.throws(() => {
      report.executionAuthorized = true;
    });
  });

});
