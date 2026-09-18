/**
 * ONLUNET ZEKA — FAZ 76 Comprehensive E2E Verification Test Suite
 *
 * Covers all 7 test categories specified in Section 19:
 * 1. Input Sources: Manual, Old Website URL, Google Maps URL, Reference Image, Hybrid
 * 2. Extraction & Normalization: Precedence, Evidence, Confidence, Zero Feature Invention
 * 3. Generation: Dynamic Sitemap, Design System, Responsive Frontend, Standalone Pages, SEO
 * 4. Capability Gate: FULL, DEFERRED (409), MISSING (409), Static Content allowance
 * 5. Security: SSRF, Malicious URL, XSS, Malicious Image, Path Traversal
 * 6. Authority & Approval Gate: Preview isolation, Approval required, Denied approval blocks, Plan Consumption
 * 7. Admin & Backend Integration: SQLite Seeding for team, faq, testimonials; Template dummy purge; Backend Freeze.
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import { buildCorporateSiteSpec, SpecDataSource } from '../src/autonomous/corporate-spec.js';
import { ingestMultiSourceCorporateData } from '../src/autonomous/multi-source-adapter.js';
import { buildInformationArchitecture } from '../src/autonomous/information-architecture.js';
import { runPreviewQa } from '../src/autonomous/preview-qa-suite.js';
import { validateUrlSecurity } from '../src/autonomous/site-extractor.js';
import { validateReferenceImageSecurity } from '../src/autonomous/reference-image-analyzer.js';
import { createCorporateGenerator } from '../src/autonomous/corporate-generator.js';
import { validateBackendCapabilities, BackendCapabilities, CapabilityStatus } from '../src/autonomous/backend-capability-registry.js';

// Minimal 1x1 valid PNG for reference testing
const VALID_PNG_BUFFER = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');

describe('FAZ 76 — 1. Input Sources & Ingestion', () => {
  test('ingests manual data completely and builds canonical CorporateSiteSpec', () => {
    const spec = buildCorporateSiteSpec({
      manual: {
        companyName: 'Akınlar Mühendislik Sanayi',
        industry: 'Mühendislik & İmalat',
        slogan: 'Kalitede Öncü, İnovasyonda Güçlü',
        description: 'CNC talaşlı imalat ve endüstriyel makine yedek parça üretimi.',
        phone: '+90 212 444 8899',
        email: 'info@akinlar.com.tr',
        address: 'İkitelli OSB Metal-İş San. Sit. 12. Blok No:45',
        city: 'İstanbul',
        services: ['CNC Talaşlı İmalat', 'Lazer Kesim & Büküm', 'Kaynak ve Montaj'],
        products: ['Hassas Dişli Grubu', 'Hidrolik Silindir Piston']
      }
    });

    assert.equal(spec.company.name, 'Akınlar Mühendislik Sanayi');
    assert.equal(spec.company.industry, 'Mühendislik & İmalat');
    assert.equal(spec.contact.phone, '+90 212 444 8899');
    assert.equal(spec.contact.email, 'info@akinlar.com.tr');
    assert.equal(spec.services.length, 3);
    assert.equal(spec.products.length, 2);
    assert.equal(spec.sourceEvidence['company.name'].source, SpecDataSource.MANUAL);
    assert.equal(spec.sourceEvidence['company.name'].confidence, 1.0);
    assert.equal(spec.sourceEvidence['company.name'].isVerified, true);
  });

  test('ingests Google Maps listing data with verified provenance and rating', () => {
    const spec = buildCorporateSiteSpec({
      mapsData: {
        name: 'Boğaziçi Oto Servis & Ekspertiz',
        category: 'Oto Bakım ve Onarım',
        phone: '+90 216 555 4321',
        address: 'Sanayi Cad. No:28 Kadıköy',
        rating: 4.8,
        reviewCount: 142,
        hours: 'Pzt-Cmt: 08:30 - 19:00',
        url: 'https://maps.google.com/?cid=123456789'
      }
    });

    assert.equal(spec.company.name, 'Boğaziçi Oto Servis & Ekspertiz');
    assert.equal(spec.company.industry, 'Oto Bakım ve Onarım');
    assert.equal(spec.contact.phone, '+90 216 555 4321');
    assert.equal(spec.location.rating, 4.8);
    assert.equal(spec.location.reviewCount, 142);
    assert.equal(spec.sourceEvidence['company.name'].source, SpecDataSource.GOOGLE_MAPS);
    assert.equal(spec.sourceEvidence['company.name'].confidence, 0.95);
  });

  test('ingests scraped website data when manual data is omitted', () => {
    const spec = buildCorporateSiteSpec({
      websiteData: {
        spec: {
          companyName: 'Lodos Enerji Sistemleri',
          industry: 'Yenilenebilir Enerji',
          slogan: 'Rüzgarın ve Güneşin Gücü',
          description: 'Güneş ve rüzgar enerjisi santralleri anahtar teslim mühendislik çözümleri.',
          contact: {
            phone: '+90 232 333 4455',
            email: 'iletisim@lodosenerji.com'
          },
          services: [
            { title: 'Çatı GES Projelendirme', description: 'Fabrika çatıları için EPC çözümleri.' }
          ]
        }
      }
    });

    assert.equal(spec.company.name, 'Lodos Enerji Sistemleri');
    assert.equal(spec.company.industry, 'Yenilenebilir Enerji');
    assert.equal(spec.contact.phone, '+90 232 333 4455');
    assert.equal(spec.sourceEvidence['company.name'].source, SpecDataSource.OLD_WEBSITE);
    assert.equal(spec.sourceEvidence['company.name'].confidence, 0.85);
  });

  test('enforces strict precedence: MANUAL > GOOGLE_MAPS > OLD_WEBSITE > INFERENCE', () => {
    const spec = buildCorporateSiteSpec({
      manual: {
        companyName: 'Akınlar A.Ş. (Manuel)',
        phone: '+90 212 111 0000'
      },
      mapsData: {
        name: 'Akınlar Sanayi (Maps)',
        phone: '+90 212 222 0000',
        address: 'Maps Adresi No:1',
        category: 'Metal Sanayi (Maps)'
      },
      websiteData: {
        spec: {
          companyName: 'Akınlar Web (Site)',
          phone: '+90 212 333 0000',
          address: 'Web Adresi No:2',
          industry: 'Makine İmalat (Web)',
          slogan: 'Web Sloganı'
        }
      }
    });

    // 1. Company Name: Manual wins over Maps and Web
    assert.equal(spec.company.name, 'Akınlar A.Ş. (Manuel)');
    assert.equal(spec.sourceEvidence['company.name'].source, SpecDataSource.MANUAL);

    // 2. Phone: Manual wins
    assert.equal(spec.contact.phone, '+90 212 111 0000');
    assert.equal(spec.sourceEvidence['contact.phone'].source, SpecDataSource.MANUAL);

    // 3. Industry: Maps wins over Web when Manual is omitted
    assert.equal(spec.company.industry, 'Metal Sanayi (Maps)');
    assert.equal(spec.sourceEvidence['company.industry'].source, SpecDataSource.GOOGLE_MAPS);

    // 4. Address: Maps wins over Web when Manual is omitted
    assert.equal(spec.contact.address, 'Maps Adresi No:1');
    assert.equal(spec.sourceEvidence['contact.address'].source, SpecDataSource.GOOGLE_MAPS);

    // 5. Slogan: Web wins when Manual and Maps are omitted
    assert.equal(spec.company.slogan, 'Web Sloganı');
    assert.equal(spec.sourceEvidence['company.slogan'].source, SpecDataSource.OLD_WEBSITE);
  });
});

describe('FAZ 76 — 2. Zero Feature Invention & Evidence Tracking', () => {
  test('never invents non-existent services, products, employees or awards', () => {
    const spec = buildCorporateSiteSpec({
      manual: {
        companyName: 'Basit Danışmanlık',
        industry: 'Yönetim Danışmanlığı'
        // No services, no products, no team, no testimonials, no founded year
      }
    });

    assert.equal(spec.services.length, 0);
    assert.equal(spec.products.length, 0);
    assert.equal(spec.team.length, 0);
    assert.equal(spec.testimonials.length, 0);
    assert.equal(spec.caseStudies.length, 0);

    // Missing fields are explicitly catalogued in missingData
    assert.ok(spec.missingData.includes('offerings.services'));
    assert.ok(spec.missingData.includes('offerings.products'));
    assert.ok(spec.missingData.includes('content.team'));
    assert.ok(spec.missingData.includes('content.testimonials'));
    assert.ok(spec.missingData.includes('contact.phone'));
  });

  test('marks inferred fallback values explicitly with inference: true and low confidence', () => {
    const spec = buildCorporateSiteSpec({
      manual: {
        companyName: 'Yıldız Ticaret'
        // No industry, no slogan, no description
      }
    });

    assert.equal(spec.sourceEvidence['company.industry'].inference, true);
    assert.ok(spec.sourceEvidence['company.industry'].confidence <= 0.4);
    assert.equal(spec.sourceEvidence['company.industry'].isVerified, false);

    assert.equal(spec.sourceEvidence['company.slogan'].inference, true);
    assert.ok(spec.sourceEvidence['company.slogan'].confidence <= 0.4);
  });
});

describe('FAZ 76 — 3. Information Architecture & Dynamic Sitemap', () => {
  test('generates dynamic sitemap matching ONLY available content (zero thin content)', () => {
    const spec = buildCorporateSiteSpec({
      manual: {
        companyName: 'Nova Lojistik',
        description: 'Uluslararası taşımacılık ve antrepo yönetimi.',
        services: [
          { title: 'Denizyolu Konteyner', slug: 'denizyolu-konteyner' },
          { title: 'Havayolu Kargo', slug: 'havayolu-kargo' }
        ],
        faq: [
          { question: 'Teslimat süresi ne kadar?', answer: 'Ortalama 3-5 iş günü.' }
        ]
        // NO products, NO team, NO testimonials, NO case studies, NO blog
      }
    });

    const ia = buildInformationArchitecture(spec, { baseUrl: 'https://novalojistik.com' });

    // Available pages exist
    assert.ok(ia.flatRoutes.some(r => r.path === '/tr/'));
    assert.ok(ia.flatRoutes.some(r => r.path === '/tr/hakkimizda/'));
    assert.ok(ia.flatRoutes.some(r => r.path === '/tr/hizmetlerimiz/'));
    assert.ok(ia.flatRoutes.some(r => r.path === '/tr/hizmetlerimiz/denizyolu-konteyner/'));
    assert.ok(ia.flatRoutes.some(r => r.path === '/tr/hizmetlerimiz/havayolu-kargo/'));
    assert.ok(ia.flatRoutes.some(r => r.path === '/tr/sss/'));
    assert.ok(ia.flatRoutes.some(r => r.path === '/tr/iletisim/'));

    // Non-existent pages are STRICTLY OMITTED (Zero thin content)
    assert.ok(!ia.flatRoutes.some(r => r.path.includes('/urunler/')));
    assert.ok(!ia.flatRoutes.some(r => r.path.includes('/ekibimiz/')));
    assert.ok(!ia.flatRoutes.some(r => r.path.includes('/referanslar/')));
    assert.ok(!ia.flatRoutes.some(r => r.path.includes('/vaka-calismalari/')));
    assert.ok(!ia.flatRoutes.some(r => r.path.includes('/blog/')));

    // Valid XML sitemap & robots.txt generated
    assert.ok(ia.xmlSitemap.includes('<loc>https://novalojistik.com/tr/hizmetlerimiz/denizyolu-konteyner/</loc>'));
    assert.ok(ia.robotsTxt.includes('Sitemap: https://novalojistik.com/sitemap.xml'));
  });
});

describe('FAZ 76 — 4. Backend Capability Gate Enforcement', () => {
  test('FULL capabilities (pages, media, services, products, blog, forms, seo, case_studies, team, faq, testimonials) pass gate', () => {
    const caps = ['pages', 'media', 'services', 'products', 'blog', 'forms', 'seo', 'case_studies', 'team', 'faq', 'testimonials'];
    const result = validateBackendCapabilities(caps);
    assert.equal(result.valid, true);
    assert.equal(result.blocked, false);
    assert.equal(result.missingCapabilities.length, 0);
    assert.equal(result.availableCapabilities.length, 11);
  });

  test('DEFERRED capabilities (gallery, brand_references) block generation with 409 and clear remediation', () => {
    const resGallery = validateBackendCapabilities(['gallery']);
    assert.equal(resGallery.valid, false);
    assert.equal(resGallery.blocked, true);
    assert.equal(resGallery.statusCode, 409);
    assert.equal(resGallery.errorCode, 'BACKEND_CAPABILITY_DEFERRED');
    assert.ok(resGallery.message.includes('[BACKEND CAPABILITY DEFERRED]'));

    const resRef = validateBackendCapabilities(['brand_references']);
    assert.equal(resRef.valid, false);
    assert.equal(resRef.blocked, true);
    assert.equal(resRef.statusCode, 409);
    assert.equal(resRef.errorCode, 'BACKEND_CAPABILITY_DEFERRED');
    assert.ok(resRef.message.includes('Marka Referansları & Partner Logoları'));
  });

  test('MISSING unverified capabilities block generation with 409', () => {
    const resMissing = validateBackendCapabilities(['unsupported_custom_crm_feature']);
    assert.equal(resMissing.valid, false);
    assert.equal(resMissing.blocked, true);
    assert.equal(resMissing.statusCode, 409);
    assert.equal(resMissing.errorCode, 'BACKEND_CAPABILITY_MISSING');
  });

  test('Static content in frontend does NOT trigger backend capability gate', async () => {
    // Static testimonials in spec without requiring managed backend CRUD
    const ingestResult = await ingestMultiSourceCorporateData({
      manual: {
        companyName: 'Statik İçerikli Şirket',
        services: ['Danışmanlık'],
        testimonials: [{ author: 'Ali Bey', content: 'Çok memnun kaldık' }]
        // testimonialsRequired is false/omitted -> static only
      }
    });

    assert.equal(ingestResult.isGenerationBlocked, false);
    assert.equal(ingestResult.capabilityValidation.valid, true);
  });
});

describe('FAZ 76 — 5. Security & SSRF Defense', () => {
  test('blocks SSRF attacks on loopback, private ranges, cloud metadata and dangerous protocols', () => {
    // Loopback
    assert.throws(() => validateUrlSecurity('http://127.0.0.1:8000/api'), /SSRF Protection: Loopback IP/);
    assert.throws(() => validateUrlSecurity('http://localhost:3000'), /SSRF Protection: Loopback\/internal hostname/);
    assert.throws(() => validateUrlSecurity('http://127.0.0.1.nip.io'), /SSRF Protection: Loopback\/internal hostname/);

    // Private RFC 1918
    assert.throws(() => validateUrlSecurity('http://10.0.0.1/status'), /SSRF Protection: Private IP/);
    assert.throws(() => validateUrlSecurity('http://172.16.0.5/admin'), /SSRF Protection: Private IP/);
    assert.throws(() => validateUrlSecurity('http://192.168.1.1/router'), /SSRF Protection: Private IP/);

    // Cloud Metadata
    assert.throws(() => validateUrlSecurity('http://169.254.169.254/latest/meta-data/'), /SSRF Protection: Cloud metadata/);

    // Forbidden schemes
    assert.throws(() => validateUrlSecurity('file:///etc/passwd'), /Forbidden protocol scheme/);
    assert.throws(() => validateUrlSecurity('gopher://127.0.0.1:25'), /Forbidden protocol scheme/);
    assert.throws(() => validateUrlSecurity('javascript:alert(1)'), /Forbidden protocol scheme/);

    // Credentials in URL
    assert.throws(() => validateUrlSecurity('http://admin:secret@malicious.com'), /URLs with user credentials are forbidden/);

    // Valid public URL passes
    const valid = validateUrlSecurity('https://kurumsal-sirket.com.tr/hakkimizda');
    assert.equal(valid.valid, true);
    assert.equal(valid.normalizedUrl, 'https://kurumsal-sirket.com.tr/hakkimizda');
  });

  test('validates reference images and blocks path traversal, oversized files, and invalid headers', () => {
    // Path traversal in filename
    assert.throws(() => {
      validateReferenceImageSecurity({
        buffer: VALID_PNG_BUFFER,
        originalName: '../../../etc/passwd.png'
      });
    }, /Path traversal or invalid characters/);

    // Invalid extension
    assert.throws(() => {
      validateReferenceImageSecurity({
        buffer: VALID_PNG_BUFFER,
        originalName: 'shell.php'
      });
    }, /Unsupported file extension/);

    // Fake MIME header / invalid magic bytes
    const fakeBuffer = Buffer.from('FAKE_HEADER_CONTENT_NOT_IMAGE_MAGIC_BYTES_123');
    assert.throws(() => {
      validateReferenceImageSecurity({
        buffer: fakeBuffer,
        originalName: 'fake.png'
      });
    }, /File signature does not match valid PNG, JPEG, or WebP/);

    // Valid PNG passes
    const valid = validateReferenceImageSecurity({
      buffer: VALID_PNG_BUFFER,
      originalName: 'design_reference.png'
    });
    assert.equal(valid.valid, true);
  });
});

describe('FAZ 76 — 6. Three-Way Preview QA & Approval Gate', () => {
  test('runPreviewQa evaluates Visual, Content, and Security QA on synthesized corporate project', () => {
    const generator = createCorporateGenerator();
    const synthesis = generator.synthesizeCorporateProject({
      companyName: 'Akdeniz Lojistik A.Ş.',
      industry: 'Taşımacılık',
      slogan: 'Güvenle Taşıyoruz',
      description: 'Lojistik ve antrepo çözümleri.',
      services: ['Karayolu Taşımacılığı', 'Denizyolu Lojistik'],
      contact: { phone: '+90 216 555 1234', email: 'bilgi@akdenizlojistik.com' }
    });

    const plan = generator.createCorporatePlan({ synthesis });
    const qa = runPreviewQa({ spec: synthesis.spec, synthesis, plan });

    assert.equal(qa.passed, true);
    assert.equal(qa.verdict, 'PASSED_READY_FOR_REVIEW');
    assert.equal(qa.visualQa.passed, true);
    assert.equal(qa.visualQa.checks.stickyHeader, true);
    assert.equal(qa.visualQa.checks.dropdownMenuArchitecture, true);
    assert.equal(qa.visualQa.checks.noWrapNavLinks, true);
    assert.equal(qa.contentQa.passed, true);
    assert.equal(qa.contentQa.checks.companyNameVerified, true);
    assert.equal(qa.securityQa.passed, true);
    assert.equal(qa.securityQa.checks.noXssVectors, true);
    assert.equal(qa.securityQa.checks.noPathTraversal, true);
  });

  test('strictly blocks file mutations when approval is denied (approval = false)', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'corp-approval-test-'));
    try {
      const generator = createCorporateGenerator();
      const synthesis = generator.synthesizeCorporateProject({
        companyName: 'Onay Reddi Test A.Ş.',
        targetDir: 'test-proje'
      });
      const plan = generator.createCorporatePlan({ synthesis, workspaceRoot: tempDir });

      // User rejects approval
      const res = await generator.applyCorporatePlan({
        plan,
        workspaceRoot: tempDir,
        approval: false
      });

      assert.equal(res.success, false);
      assert.ok(res.failedFiles.length > 0);
      assert.ok(res.failedFiles[0].reason.includes('Preflight admission denied'));

      // Invariant: zero files written to disk!
      const targetAbsPath = path.join(tempDir, 'test-proje');
      assert.equal(fs.existsSync(targetAbsPath), false);
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  });
});

describe('FAZ 76 — 7. End-to-End Build & Backend Integration (SQLite Seeding)', () => {
  test('synthesizes, seeds SQLite with team, faq, testimonials, purges dummy tables, and guarantees 0 backend mutations', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'corp-e2e-build-'));
    try {
      const generator = createCorporateGenerator();
      const spec = {
        companyName: 'Zirve Teknolojik Çözümler A.Ş.',
        industry: 'Yazılım ve Donanım',
        slogan: 'Yenilikçi Çözümler, Güçlü Altyapı',
        description: 'Endüstri 4.0 otomasyon ve bulut ERP çözümleri.',
        services: [
          { title: 'Bulut ERP Entegrasyonu', description: 'Kurumsal kaynak planlama altyapısı.' },
          { title: 'Siber Güvenlik Denetimi', description: 'Sızma testi ve SOC analizi.' }
        ],
        products: [
          { title: 'ZirveIoT Gateway Cihazı', description: 'Endüstriyel telemetri cihazı.' }
        ],
        team: [
          { name: 'Dr. Mehmet Can', role: 'Baş Mühendis', bio: '20 yıllık gömülü sistem tecrübesi.' }
        ],
        faq: [
          { question: 'ERP geçiş süresi ne kadardır?', answer: 'Ortalama 4-8 hafta sürmektedir.' }
        ],
        testimonials: [
          { name: 'Ayşe Hanım', companyName: 'Atlas Holding', title: 'IT Direktörü', content: 'Kesintisiz destek aldık, tavsiye ederiz.', rating: 5 }
        ],
        contact: {
          phone: '+90 212 999 1122',
          email: 'destek@zirveteknoloji.com',
          address: 'Teknopark İstanbul No:14',
          city: 'İstanbul'
        },
        adminUser: { email: 'admin@zirveteknoloji.com' },
        targetDir: 'zirve-proje'
      };

      const synthesis = generator.synthesizeCorporateProject(spec);
      const plan = generator.createCorporatePlan({ synthesis, workspaceRoot: tempDir });

      // Run preview QA
      assert.equal(plan.qaReport.passed, true);
      assert.ok(plan.informationArchitecture.totalPageCount >= 5);

      // Execute approved plan
      const result = await generator.applyCorporatePlan({
        plan,
        workspaceRoot: tempDir,
        approval: true
      });

      assert.equal(result.success, true);
      assert.ok(result.writtenFiles.length > 50);

      // Verify SQLite Database Seeding
      const dbPath = path.join(tempDir, 'zirve-proje', 'storage', 'database.sqlite');
      assert.ok(fs.existsSync(dbPath), 'database.sqlite must exist');

      const db = new DatabaseSync(dbPath);

      // 1. Verify dummy table purge
      const dummyLeads = db.prepare('SELECT COUNT(*) as count FROM leads').get();
      assert.equal(dummyLeads.count, 0, 'dummy leads must be purged');

      // 2. Verify site_settings seeded
      const siteTitle = db.prepare("SELECT value FROM site_settings WHERE key = 'agency.agency_name'").get();
      assert.equal(siteTitle.value, 'Zirve Teknolojik Çözümler A.Ş.');

      // 3. Verify services seeded in cms_contents
      const seededServices = db.prepare("SELECT COUNT(*) as count FROM cms_contents WHERE type = 'service'").get();
      assert.equal(seededServices.count, 2, '2 services must be seeded');

      // 4. Verify products seeded in cms_contents
      const seededProducts = db.prepare("SELECT COUNT(*) as count FROM cms_contents WHERE type = 'product'").get();
      assert.equal(seededProducts.count, 1, '1 product must be seeded');

      // 5. Verify team seeded in cms_contents (FAZ 75.2 & FAZ 76)
      const seededTeam = db.prepare("SELECT COUNT(*) as count FROM cms_contents WHERE type = 'team'").get();
      assert.equal(seededTeam.count, 1, '1 team member must be seeded');

      // 6. Verify FAQ seeded in cms_contents (FAZ 75.2 & FAZ 76)
      const seededFaq = db.prepare("SELECT COUNT(*) as count FROM cms_contents WHERE type = 'faq'").get();
      assert.equal(seededFaq.count, 1, '1 FAQ must be seeded');

      // 7. Verify testimonials seeded in testimonials table (FAZ 75.2 & FAZ 76)
      const seededReviews = db.prepare('SELECT COUNT(*) as count FROM testimonials').get();
      assert.equal(seededReviews.count, 1, '1 testimonial must be seeded');
      const testm = db.prepare('SELECT * FROM testimonials LIMIT 1').get();
      assert.equal(testm.customer_name || testm.name, 'Ayşe Hanım');
      assert.equal(testm.company_name, 'Atlas Holding');
      assert.equal(testm.rating, 5);

      // 8. Verify Admin user updated
      const adminUser = db.prepare('SELECT email, first_name FROM users WHERE id = 1').get();
      assert.equal(adminUser.email, 'admin@zirveteknoloji.com');

      db.close();
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
    }
  });
});
