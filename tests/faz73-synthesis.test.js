/**
 * ONLUNET ZEKA — FAZ 73 Comprehensive Autonomous Synthesis Test Suite
 *
 * Covers:
 * 1. Input Channel Ingestion (Manual, Website, Maps, Hybrid, Missing data)
 * 2. Anti-Hallucination & Provenance Verification (VERIFIED, INFERRED, GENERATED, MISSING)
 * 3. Sector & Design Reasoning (20 parameters with explainability)
 * 4. Layout Graph Engine (Dynamic section ordering & responsive rules)
 * 5. Design System Engine (WCAG AA contrast & CSS variables)
 * 6. From-Scratch Visual Composition (Rule 3 sticky header, Rule 5 zero thin-content, Rule 6 dropdowns)
 * 7. Design Originality Guard (Anti-pattern detection & scoring)
 * 8. Storage Isolation & Invariants (proposalOnly, executionAuthorized)
 * 9. Legacy Regression Preservation (Dual-mode legacy execution)
 * 10. Real Headless Chrome CDP Render & Responsive Validation
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import { normalizeCompanyProfile, DataProvenanceStatus, DataSource } from '../src/autonomous/company-profile-normalizer.js';
import { deduceDesignStrategy, classifyIndustryCategory } from '../src/autonomous/design-reasoning-engine.js';
import { buildLayoutGraph } from '../src/autonomous/layout-graph-engine.js';
import { generateDesignTokens, enforceWcagContrast } from '../src/autonomous/design-system-engine.js';
import { synthesizeWebsite } from '../src/autonomous/visual-composition-engine.js';
import { auditOriginality } from '../src/autonomous/design-originality-guard.js';
import { synthesizeAutonomousWebsite, GenerationMode } from '../src/autonomous/website-synthesis-engine.js';
import { launchHeadlessBrowser } from '../src/autonomous/browser-qa-inspector.js';
import { capturePageScreenshot } from '../src/autonomous/visual-capture-engine.js';

describe('ONLUNET ZEKA — Autonomous Website Synthesis Suite (FAZ 73)', () => {

  const testOutputDir = path.resolve(process.cwd(), 'storage', 'visual-designs', 'test-run');

  after(() => {
    try {
      if (fs.existsSync(testOutputDir)) {
        fs.rmSync(testOutputDir, { recursive: true, force: true });
      }
    } catch (_) {}
  });

  // ==========================================
  // 1. INPUT CHANNEL & NORMALIZATION SUITES
  // ==========================================

  test('1. Manual input only: normalizes company profile with verified provenance', () => {
    const manual = {
      companyName: 'Akın Hukuk Bürosu',
      industry: 'Hukuk & Arabuluculuk',
      description: 'Şirketler hukuku, sözleşmeler ve ticari davalarda uzman danışmanlık.',
      phone: '0212 444 01 23',
      email: 'iletisim@akinhukuk.com',
      address: 'Levent, İstanbul',
      services: ['Ticaret Hukuku', 'İş Hukuku', 'Sözleşme Yönetimi']
    };

    const profile = normalizeCompanyProfile({ manual });

    assert.strictEqual(profile.company.name.value, 'Akın Hukuk Bürosu');
    assert.strictEqual(profile.company.name.status, DataProvenanceStatus.VERIFIED);
    assert.strictEqual(profile.company.name.source, DataSource.MANUAL);
    assert.strictEqual(profile.contact.phone.value, '0212 444 01 23');
    assert.strictEqual(profile.contact.phone.status, DataProvenanceStatus.VERIFIED);
    assert.strictEqual(profile.offerings.services.length, 3);
    assert.strictEqual(profile.facts.hasPhysicalLocation, true);
    assert.strictEqual(profile.facts.hasVerifiedReviews, false);
    assert.ok(profile.confidenceScore >= 0.7);
  });

  test('2. Website input only: normalizes extracted metadata with website provenance', () => {
    const websiteData = {
      spec: {
        companyName: 'Falcon Solar Enerji',
        industry: 'Güneş Enerjisi & Endüstriyel Tesisat',
        description: 'Çatı ve arazi tipi güneş enerji santralleri anahtar teslim kurulumu.',
        contact: {
          phone: '0554 507 77 31',
          email: 'bilgi@falconenerji.com',
          city: 'Tekirdağ'
        },
        services: [
          { title: 'Çatı GES Kurulumu', description: 'Endüstriyel çatı güneş enerjisi projelendirme' },
          { title: 'Akü Depolama Sistemleri', description: 'Yüksek kapasiteli lityum enerji depolama' }
        ]
      }
    };

    const profile = normalizeCompanyProfile({ websiteData });

    assert.strictEqual(profile.company.name.value, 'Falcon Solar Enerji');
    assert.strictEqual(profile.company.name.source, DataSource.WEBSITE);
    assert.strictEqual(profile.company.industry.value, 'Güneş Enerjisi & Endüstriyel Tesisat');
    assert.strictEqual(profile.offerings.services.length, 2);
    assert.strictEqual(profile.contact.phone.value, '0554 507 77 31');
  });

  test('3. Google Maps input only: normalizes listing with rating, reviews and location', () => {
    const mapsData = {
      listing: {
        name: 'Güllüoğlu Baklavaları Karaköy',
        category: 'Tatlıcı & Kafe',
        rating: 4.8,
        reviewCount: 3200,
        phone: '0212 249 96 80',
        address: 'Kemankeş Karamustafa Paşa Mah., Karaköy, İstanbul',
        hours: { display: '07:00 - 00:00' },
        reviews: [
          { author: 'Can Demir', text: 'İstanbulun en lezzetli fıstıklı baklavası.', ratingNumber: 5 }
        ]
      },
      spec: {
        isFoodHospitality: true
      }
    };

    const profile = normalizeCompanyProfile({ mapsData });

    assert.strictEqual(profile.company.name.value, 'Güllüoğlu Baklavaları Karaköy');
    assert.strictEqual(profile.company.name.source, DataSource.MAPS);
    assert.strictEqual(profile.metrics.rating.value, 4.8);
    assert.strictEqual(profile.metrics.reviewCount.value, 3200);
    assert.strictEqual(profile.facts.hasVerifiedReviews, true);
    assert.strictEqual(profile.facts.isFoodHospitality, true);
    assert.strictEqual(profile.contact.workingHours.value, '07:00 - 00:00');
  });

  test('4. Hybrid input (Manual + Maps + Website): resolves precedence and merges data', () => {
    const manual = {
      companyName: 'Güllüoğlu Karaköy (Merkez)', // User override
      slogan: '1871den Beri Değişmeyen Hakiki Lezzet'
    };
    const mapsData = {
      listing: {
        name: 'Güllüoğlu',
        category: 'Tatlıcı',
        rating: 4.8,
        reviewCount: 3500,
        phone: '0212 249 96 80',
        address: 'Karaköy, İstanbul'
      }
    };
    const websiteData = {
      spec: {
        description: 'Geleneksel Gaziantep usulü taş fırında pişen fıstıklı baklava çeşitleri.',
        services: [{ title: 'Özel Tepsi Baklava Siparişi' }]
      }
    };

    const profile = normalizeCompanyProfile({ manual, mapsData, websiteData });

    // Manual takes precedence for name and slogan
    assert.strictEqual(profile.company.name.value, 'Güllüoğlu Karaköy (Merkez)');
    assert.strictEqual(profile.company.name.source, DataSource.MANUAL);
    assert.strictEqual(profile.company.slogan.value, '1871den Beri Değişmeyen Hakiki Lezzet');
    // Maps supplies rating and address
    assert.strictEqual(profile.metrics.rating.value, 4.8);
    assert.strictEqual(profile.contact.address.value, 'Karaköy, İstanbul');
    // Website supplies deep description and services
    assert.strictEqual(profile.company.description.value, 'Geleneksel Gaziantep usulü taş fırında pişen fıstıklı baklava çeşitleri.');
    assert.strictEqual(profile.offerings.services.length, 1);
  });

  test('5. Anti-Hallucination Guard: separates verified facts from inferred/missing fields', () => {
    const minimal = {
      companyName: 'Deniz Butik Kafe'
    };

    const profile = normalizeCompanyProfile({ manual: minimal });

    // Name is verified
    assert.strictEqual(profile.company.name.status, DataProvenanceStatus.VERIFIED);
    // Phone, email, address are MISSING, not hallucinated
    assert.strictEqual(profile.contact.phone.status, DataProvenanceStatus.MISSING);
    assert.strictEqual(profile.contact.phone.value, null);
    assert.strictEqual(profile.contact.email.status, DataProvenanceStatus.MISSING);
    assert.strictEqual(profile.contact.address.status, DataProvenanceStatus.MISSING);
    // Verified reviews fact is false
    assert.strictEqual(profile.facts.hasVerifiedReviews, false);
    assert.strictEqual(profile.facts.hasPhysicalLocation, false);
  });

  // ==========================================
  // 2. SECTOR & DESIGN REASONING SUITES
  // ==========================================

  test('6. Design Reasoning: deduces 20 distinct strategic parameters with machine-readable reasons', () => {
    const profile = normalizeCompanyProfile({
      manual: {
        companyName: 'Mega Metal Torna Sanayi',
        industry: 'Endüstriyel Talaşlı İmalat & Metal Sanayi',
        services: ['CNC Dik İşleme', 'Kaynaklı Montaj', 'Hassas Taşlama']
      }
    });

    const strategy = deduceDesignStrategy(profile);

    assert.strictEqual(strategy.industryCategory, 'industrial_manufacturing');
    assert.strictEqual(strategy.decisions.length, 20);

    // Verify explainability
    for (const d of strategy.decisions) {
      assert.ok(d.parameter, 'Decision has parameter name');
      assert.ok(d.decision, 'Decision has concrete decision');
      assert.ok(typeof d.reason === 'string' && d.reason.length > 10, 'Decision has clear reason');
      assert.ok(d.confidence >= 0.5 && d.confidence <= 1.0, 'Decision has bounded confidence');
    }

    // Check specific industrial traits
    assert.strictEqual(strategy.strategy.trustRequirement, 'technical_standards_and_certifications');
    assert.strictEqual(strategy.strategy.conversionPriority, 'request_for_quote_rfq');
    assert.strictEqual(strategy.strategy.contentDensity, 'deep_technical_editorial');
  });

  test('7. Sector classification distinguishes Gastronomy vs Legal vs Industrial', () => {
    assert.strictEqual(classifyIndustryCategory('Restoran & Ocakbaşı'), 'gastronomy');
    assert.strictEqual(classifyIndustryCategory('Avukatlık Bürosu & Hukuki Danışmanlık'), 'legal_consulting');
    assert.strictEqual(classifyIndustryCategory('Makine İmalat Fabrikası'), 'industrial_manufacturing');
    assert.strictEqual(classifyIndustryCategory('Özel Ağız ve Diş Sağlığı Polikliniği'), 'healthcare_medical');
  });

  // ==========================================
  // 3. LAYOUT GRAPH & DESIGN SYSTEM SUITES
  // ==========================================

  test('8. Layout Graph answers 7 structural questions and assigns section weights', () => {
    const profile = normalizeCompanyProfile({
      manual: {
        companyName: 'Liman Lojistik A.Ş.',
        industry: 'Uluslararası Taşımacılık & Depolama',
        address: 'Ambarlı Limanı, İstanbul'
      }
    });
    const strategy = deduceDesignStrategy(profile);
    const layout = buildLayoutGraph(profile, strategy);

    assert.ok(layout.sections.length >= 8, 'Layout has at least 8 structured sections');
    assert.strictEqual(layout.sections[0].type, 'header');
    assert.strictEqual(layout.sections[1].type, 'hero');

    const q = layout.architectureQuestions;
    assert.ok(Array.isArray(q.q1_sectionSequence));
    assert.ok(Object.keys(q.q2_visualHierarchy).length > 0);
    assert.ok(Object.keys(q.q3_containerWidths).length > 0);
    assert.ok(Array.isArray(q.q4_backgroundRhythm));
    assert.ok(Object.keys(q.q5_responsiveRules).length > 0);
    assert.ok(Array.isArray(q.q6_interactiveComponents));
    assert.ok(Array.isArray(q.q7_conversionTouchpoints));
  });

  test('9. Design System Engine computes parametric tokens and enforces WCAG AA contrast', () => {
    const profile = normalizeCompanyProfile({
      manual: {
        companyName: 'Kuzey Danışmanlık',
        industry: 'Kurumsal Yönetim Danışmanlığı'
      }
    });
    const strategy = deduceDesignStrategy(profile);
    const ds = generateDesignTokens(profile, strategy);

    assert.ok(ds.tokens.colors.primary);
    assert.ok(ds.tokens.colors.surface);
    assert.ok(ds.tokens.colors.text);
    assert.ok(ds.cssVariables.includes('--color-primary:'));
    assert.ok(ds.cssVariables.includes('--font-display:'));
    assert.strictEqual(ds.wcagContrastReport.isPassAA, true);
    assert.ok(ds.wcagContrastReport.textOnSurface >= 4.5);
  });

  test('10. enforceWcagContrast adjusts low-contrast text to meet standard', () => {
    // Light gray on white (#ccc on #fff) is ~1.6:1 (fails AA)
    const fixed = enforceWcagContrast('#cccccc', '#ffffff', 4.5);
    // Should be shifted to high contrast dark text
    assert.strictEqual(fixed, '#0f172a');
  });

  // ==========================================
  // 4. FROM-SCRATCH COMPOSITION & RULES SUITES
  // ==========================================

  test('11. Visual Composition: enforces Corporate Rule 3 (Opaque Sticky Header)', () => {
    const profile = normalizeCompanyProfile({
      manual: {
        companyName: 'Akdeniz Zeytinyağı',
        industry: 'Gurme Gıda & Şarküteri'
      }
    });
    const strategy = deduceDesignStrategy(profile);
    const layout = buildLayoutGraph(profile, strategy);
    const ds = generateDesignTokens(profile, strategy);

    const comp = synthesizeWebsite({ companyProfile: profile, designStrategy: strategy, layoutGraph: layout, designSystem: ds });

    // Corporate Rule 3 Invariant
    assert.ok(comp.css.includes('position: sticky !important;'), 'Header must be sticky !important');
    assert.ok(comp.css.includes('top: 0 !important;'), 'Header must stick to top: 0');
    assert.ok(comp.css.includes('z-index: 9999 !important;'), 'Header must have z-index: 9999');
    assert.ok(comp.css.includes('backdrop-filter: blur(16px) !important;'), 'Header must have backdrop blur');
  });

  test('12. Visual Composition: enforces Corporate Rule 6 (Dropdown Menus & No-Wrap)', () => {
    const profile = normalizeCompanyProfile({
      manual: {
        companyName: 'Ege Dental Poliklinik',
        industry: 'Sağlık & Medikal'
      }
    });
    const strategy = deduceDesignStrategy(profile);
    const layout = buildLayoutGraph(profile, strategy);
    const ds = generateDesignTokens(profile, strategy);

    const comp = synthesizeWebsite({ companyProfile: profile, designStrategy: strategy, layoutGraph: layout, designSystem: ds });

    // Corporate Rule 6 Invariants
    assert.ok(comp.css.includes('white-space: nowrap !important;'), 'Nav links must have white-space: nowrap');
    assert.ok(comp.css.includes('display: none !important;'), 'Dropdown must be display: none by default');
    assert.ok(comp.css.includes('position: absolute !important;'), 'Dropdown must be position: absolute');
    assert.ok(comp.html.includes('class="dropdown-menu"'), 'Dropdown markup exists in HTML');
  });

  test('13. Design Originality Guard flags Bootstrap clichés and calculates score', () => {
    const cleanAudit = auditOriginality({
      html: '<header><nav></nav></header><main><section><h2>Menü</h2></section></main>',
      css: 'position: sticky; top: 0; z-index: 9999; font-family: sans-serif; font-family: serif;',
      designStrategy: { industryCategory: 'gastronomy' }
    });
    assert.strictEqual(cleanAudit.isOriginal, true);
    assert.ok(cleanAudit.originalityScore >= 80);

    const dirtyAudit = auditOriginality({
      html: '<div class="col-md-4">Join 10,000+ happy teams with our all-in-one platform</div>',
      css: 'backdrop-filter: blur(10px); backdrop-filter: blur(10px); backdrop-filter: blur(10px); backdrop-filter: blur(10px); backdrop-filter: blur(10px); backdrop-filter: blur(10px);',
      designStrategy: { industryCategory: 'corporate_general' }
    });
    assert.ok(dirtyAudit.warnings.length >= 2, 'Detects generic SaaS copy and Bootstrap classes');
    assert.ok(dirtyAudit.originalityScore < cleanAudit.originalityScore);
  });

  // ==========================================
  // 5. STORAGE ISOLATION & INVARIANTS SUITES
  // ==========================================

  test('14. Storage Isolation: preview files written exclusively to storage/visual-designs/<id>/', async () => {
    const res = await synthesizeAutonomousWebsite({
      generationMode: GenerationMode.SYNTHESIS,
      manual: {
        companyName: 'Nova Lojistik',
        industry: 'Taşımacılık'
      },
      options: {
        skipBrowserRender: true
      }
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.generationId);
    assert.ok(res.report.storageDirectory.includes('storage'));
    assert.ok(fs.existsSync(res.report.previewPath));
    assert.ok(fs.existsSync(path.join(res.report.storageDirectory, 'design-system.json')));
    assert.ok(fs.existsSync(path.join(res.report.storageDirectory, 'layout-graph.json')));
    assert.ok(fs.existsSync(path.join(res.report.storageDirectory, 'company-profile.json')));
    assert.ok(fs.existsSync(path.join(res.report.storageDirectory, 'generation-report.json')));

    // Contract Invariants
    assert.strictEqual(res.proposalOnly, true);
    assert.strictEqual(res.executionAuthorized, false);
  });

  test('15. Legacy Mode Preservation: generationMode: "legacy" delegates cleanly', async () => {
    const res = await synthesizeAutonomousWebsite({
      generationMode: GenerationMode.LEGACY,
      manual: {
        companyName: 'Eski Usul Firma',
        industry: 'Geleneksel Ticaret'
      }
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.generationMode, GenerationMode.LEGACY);
    assert.ok(res.synthesis, 'Returns legacy synthesis spec');
    assert.strictEqual(res.proposalOnly, true);
    assert.strictEqual(res.executionAuthorized, false);
  });

  // ==========================================
  // 6. REAL BROWSER CDP RENDER & RESPONSIVE SUITES
  // ==========================================

  test('16. Live Chrome CDP: renders synthesized website and validates Desktop, Tablet, Mobile', async () => {
    const res = await synthesizeAutonomousWebsite({
      generationMode: GenerationMode.SYNTHESIS,
      manual: {
        companyName: 'Boğaziçi Gurme Restoran',
        industry: 'Restoran & Gastronomi',
        phone: '0212 287 01 02',
        address: 'Bebek, İstanbul',
        services: ['Deniz Ürünleri', 'Kalamar & Ahtapot Tava', 'Günün Taze Balıkları']
      },
      options: {
        skipBrowserRender: false
      }
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.qualityGate.contrastPass, true);
    assert.strictEqual(res.qualityGate.originalityPass, true);
    assert.strictEqual(res.qualityGate.responsivePass, true);

    // Verify captured responsive viewports
    assert.ok(res.report.screenshots.desktop, 'Captured desktop viewport');
    assert.ok(res.report.screenshots.tablet, 'Captured tablet viewport');
    assert.ok(res.report.screenshots.mobile, 'Captured mobile viewport');
  });

  // ==========================================
  // 7. SECURITY & HTTP API SUITES
  // ==========================================

  test('17. Security Guard: prevents path traversal and workspace escape', async () => {
    const malicious = {
      companyName: '../../../etc/passwd',
      industry: 'Hack Attempt',
      targetDirectory: '../../../../Windows/System32'
    };

    const res = await synthesizeAutonomousWebsite({
      generationMode: GenerationMode.SYNTHESIS,
      manual: malicious,
      options: { skipBrowserRender: true }
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.report.storageDirectory.includes('storage'));
    assert.ok(!res.report.storageDirectory.includes('System32'));
    assert.ok(res.qualityGate.pathIsolationPass, true);
  });

  test('18. Live HTTP API: POST /api/corporate/synthesize returns 200 with synthesis report', async () => {
    const payload = {
      generationMode: 'synthesis',
      manual: {
        companyName: 'Akın Hukuk ve Arabuluculuk',
        industry: 'Hukuk',
        phone: '0212 555 12 34',
        services: ['Ticaret Hukuku', 'Şirketler Danışmanlığı']
      },
      skipBrowserRender: true
    };

    const response = await fetch('http://localhost:4200/api/corporate/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.generationMode, 'synthesis');
    assert.strictEqual(data.proposalOnly, true);
    assert.strictEqual(data.executionAuthorized, false);
    assert.ok(data.qualityGate);
    assert.ok(data.previewUrl);
    assert.ok(data.report);
  });

});

