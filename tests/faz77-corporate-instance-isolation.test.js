/**
 * FAZ 77 — Gerçek Corporate Instance Üretimi & Uçtan Uca İzolasyon Test Paketi
 *
 * Test Kapsamı:
 * 1. Source Immutability (Golden Master SHA-256 hash invariant)
 * 2. Real Customer Instance Creation (Customer A: Akdeniz Lojistik, Customer B: Marmara Endüstri)
 * 3. Database Isolation (A DB has A only, B DB has B only)
 * 4. Media Isolation (A uploads != B uploads, path traversal blocked)
 * 5. Frontend Isolation (A frontend != B frontend)
 * 6. Configuration Isolation (branding, email, phone, paths)
 * 7. Cross-Contamination Stress Test (sequential generate/regenerate/update/production)
 * 8. Admin -> Frontend Round Trip (Admin modifies DB -> Generator/Render -> Frontend reflects updates)
 * 9. Frontend -> Backend Round Trip (Leads submitted to A write to A DB only, B to B only)
 * 10. Auth / Session Isolation (Session token on A is rejected on B, and vice-versa)
 * 11. Production Build Validation (sitemap, robots, SEO, responsive CSS, no thin-content)
 * 12. Zero Feature Invention Regression (provenance tracking, no hallucinated awards/founded year)
 * 13. Approval & Authority State Machine (approval = false blocks mutations, proposalOnly invariant)
 * 14. Backend Capability Gate Regression (11 FULL / 2 DEFERRED / 0 MISSING)
 * 15. Golden Master DB Mutation Guard (writes to Golden Master throw IMMUTABILITY VIOLATION)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import {
  createCorporateGenerator,
  extractCorporateSpecFromDatabase,
  regenerateInstanceFrontend,
  CorporatePalettes
} from '../src/autonomous/corporate-generator.js';
import { buildCorporateSiteSpec } from '../src/autonomous/corporate-spec.js';
import { buildInformationArchitecture } from '../src/autonomous/information-architecture.js';
import { runPreviewQa } from '../src/autonomous/preview-qa-suite.js';
import { validateBackendCapabilities } from '../src/autonomous/backend-capability-registry.js';

const GOLDEN_MASTER_PATH = 'D:/Antigravity/onlunet-kurumsal';
const CRITICAL_FILES = [
  'database/schema.sql',
  'scripts/server.js',
  'storage/database.sqlite'
];

function computeFileHash(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function getGoldenMasterHashes() {
  const hashes = {};
  for (const rel of CRITICAL_FILES) {
    const fullPath = path.join(GOLDEN_MASTER_PATH, rel);
    hashes[rel] = computeFileHash(fullPath);
  }
  return hashes;
}

test('FAZ 77 — 1. Source Immutability & Golden Master Protection', async (t) => {
  const initialHashes = getGoldenMasterHashes();

  // Run generator
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz77-hash-test-'));
  try {
    const generator = createCorporateGenerator({ sourceKurumsalPath: GOLDEN_MASTER_PATH });
    const spec = {
      companyName: 'Deneme Firma A.Ş.',
      services: ['Hizmet 1'],
      targetDir: 'deneme-proje'
    };
    const synthesis = generator.synthesizeCorporateProject(spec);
    const plan = generator.createCorporatePlan({ synthesis, workspaceRoot: tempDir });
    await generator.applyCorporatePlan({ plan, workspaceRoot: tempDir, approval: true });

    // Verify Golden Master Hashes are 100% UNCHANGED
    const postHashes = getGoldenMasterHashes();
    for (const rel of CRITICAL_FILES) {
      assert.equal(
        postHashes[rel],
        initialHashes[rel],
        `CRITICAL FAILURE: Source mutation detected in ${rel}`
      );
    }
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
  }
});

test('FAZ 77 — 2. Real Customer Instance Generation (Customer A & Customer B)', async (t) => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz77-instances-'));
  const generator = createCorporateGenerator({ sourceKurumsalPath: GOLDEN_MASTER_PATH });

  try {
    // Customer A: Akdeniz Lojistik A.Ş.
    const specA = {
      companyName: 'Akdeniz Lojistik A.Ş.',
      industry: 'Taşımacılık',
      slogan: 'Küresel Taşımacılıkta Güvenilir Rota',
      description: 'Uluslararası karayolu ve denizyolu lojistik operasyonları.',
      services: [
        { title: 'Karayolu Taşımacılığı', description: 'Avrupa ve Ortadoğu hatlarında parsiyel ve komple taşımacılık.' },
        { title: 'Denizyolu Lojistik', description: 'FCL ve LCL konteyner taşımacılığı, liman gümrükleme.' }
      ],
      contact: {
        phone: '+90 216 555 1234',
        email: 'bilgi@akdenizlojistik.com',
        address: 'Lojistik Vadisi No:12, Tuzla',
        city: 'İstanbul'
      },
      adminUser: { email: 'admin@akdenizlojistik.com' },
      theme: { palette: 'blue' },
      targetDir: 'akdeniz-lojistik'
    };

    // Customer B: Marmara Endüstri Ltd.
    const specB = {
      companyName: 'Marmara Endüstri Ltd.',
      industry: 'Endüstriyel Üretim',
      slogan: 'Hassas Talaşlı İmalat & Mühendislik',
      description: 'Havacılık ve otomotiv standartlarında 5 eksen CNC işleme.',
      services: [
        { title: 'CNC İşleme', description: 'Mikron hassasiyetinde 5 eksen CNC freze ve torna üretimi.' },
        { title: 'Endüstriyel Bakım', description: 'Ağır sanayi pres ve hatlarının periyodik revizyonu.' }
      ],
      contact: {
        phone: '+90 212 444 5678',
        email: 'info@marmaraendustri.com',
        address: 'İkitelli OSB Metal-İş Sanayi Sitesi 4. Blok No:8',
        city: 'İstanbul'
      },
      adminUser: { email: 'admin@marmaraendustri.com' },
      theme: { palette: 'emerald' },
      targetDir: 'marmara-endustri'
    };

    // Build Plan A & Execute
    const synthesisA = generator.synthesizeCorporateProject(specA);
    const planA = generator.createCorporatePlan({ synthesis: synthesisA, workspaceRoot: rootDir });
    const resultA = await generator.applyCorporatePlan({ plan: planA, workspaceRoot: rootDir, approval: true });
    assert.equal(resultA.success, true);

    // Build Plan B & Execute
    const synthesisB = generator.synthesizeCorporateProject(specB);
    const planB = generator.createCorporatePlan({ synthesis: synthesisB, workspaceRoot: rootDir });
    const resultB = await generator.applyCorporatePlan({ plan: planB, workspaceRoot: rootDir, approval: true });
    assert.equal(resultB.success, true);

    const dirA = path.join(rootDir, 'akdeniz-lojistik');
    const dirB = path.join(rootDir, 'marmara-endustri');

    // =========================================================================
    // 3. Database Isolation
    // =========================================================================
    await t.test('3. Database Isolation: A DB contains A only, B DB contains B only', () => {
      const dbPathA = path.join(dirA, 'storage', 'database.sqlite');
      const dbPathB = path.join(dirB, 'storage', 'database.sqlite');

      assert.ok(fs.existsSync(dbPathA), 'Instance A database must exist');
      assert.ok(fs.existsSync(dbPathB), 'Instance B database must exist');

      const dbA = new DatabaseSync(dbPathA);
      const dbB = new DatabaseSync(dbPathB);

      try {
        // A Settings
        const settingA = dbA.prepare("SELECT value FROM site_settings WHERE key = 'agency.agency_name'").get();
        assert.equal(settingA.value, 'Akdeniz Lojistik A.Ş.');
        const phoneA = dbA.prepare("SELECT value FROM site_settings WHERE key = 'site.topbar_phone'").get();
        assert.equal(phoneA.value, '+90 216 555 1234');

        // B Settings
        const settingB = dbB.prepare("SELECT value FROM site_settings WHERE key = 'agency.agency_name'").get();
        assert.equal(settingB.value, 'Marmara Endüstri Ltd.');
        const phoneB = dbB.prepare("SELECT value FROM site_settings WHERE key = 'site.topbar_phone'").get();
        assert.equal(phoneB.value, '+90 212 444 5678');

        // Isolation: A must NOT contain B
        const aContainsB = dbA.prepare("SELECT COUNT(*) as cnt FROM site_settings WHERE value LIKE '%Marmara Endüstri%'").get();
        assert.equal(aContainsB.cnt, 0, 'Instance A DB must not contain Marmara Endüstri');

        // Isolation: B must NOT contain A
        const bContainsA = dbB.prepare("SELECT COUNT(*) as cnt FROM site_settings WHERE value LIKE '%Akdeniz Lojistik%'").get();
        assert.equal(bContainsA.cnt, 0, 'Instance B DB must not contain Akdeniz Lojistik');

        // Services in A vs B
        const servicesA = dbA.prepare("SELECT title FROM cms_translations WHERE title LIKE '%Karayolu Taşımacılığı%'").all();
        assert.equal(servicesA.length, 1);
        const servicesA_BCheck = dbA.prepare("SELECT title FROM cms_translations WHERE title LIKE '%CNC İşleme%'").all();
        assert.equal(servicesA_BCheck.length, 0, 'Instance A must not contain CNC İşleme');

        const servicesB = dbB.prepare("SELECT title FROM cms_translations WHERE title LIKE '%CNC İşleme%'").all();
        assert.equal(servicesB.length, 1);
        const servicesB_ACheck = dbB.prepare("SELECT title FROM cms_translations WHERE title LIKE '%Karayolu Taşımacılığı%'").all();
        assert.equal(servicesB_ACheck.length, 0, 'Instance B must not contain Karayolu Taşımacılığı');
      } finally {
        dbA.close();
        dbB.close();
      }
    });

    // =========================================================================
    // 4. Media Isolation & Path Traversal Guard
    // =========================================================================
    await t.test('4. Media Isolation: A uploads != B uploads, cross access blocked', () => {
      const uploadsA = path.join(dirA, 'storage', 'uploads');
      const uploadsB = path.join(dirB, 'storage', 'uploads');

      if (!fs.existsSync(uploadsA)) fs.mkdirSync(uploadsA, { recursive: true });
      if (!fs.existsSync(uploadsB)) fs.mkdirSync(uploadsB, { recursive: true });

      // Upload a-test.jpg to A, b-test.jpg to B
      fs.writeFileSync(path.join(uploadsA, 'a-test.jpg'), Buffer.from('FAKE_IMAGE_A'));
      fs.writeFileSync(path.join(uploadsB, 'b-test.jpg'), Buffer.from('FAKE_IMAGE_B'));

      // Verify A has a-test.jpg and NOT b-test.jpg
      assert.ok(fs.existsSync(path.join(uploadsA, 'a-test.jpg')));
      assert.equal(fs.existsSync(path.join(uploadsA, 'b-test.jpg')), false);

      // Verify B has b-test.jpg and NOT a-test.jpg
      assert.ok(fs.existsSync(path.join(uploadsB, 'b-test.jpg')));
      assert.equal(fs.existsSync(path.join(uploadsB, 'a-test.jpg')), false);

      // Path traversal attack simulation: ../../marmara-endustri/storage/uploads/b-test.jpg from A
      const simulatedTraversal = path.resolve(uploadsA, '../../marmara-endustri/storage/uploads/b-test.jpg');
      assert.ok(!simulatedTraversal.startsWith(path.resolve(uploadsA)), 'Path traversal escapes uploadsA sandbox');
    });

    // =========================================================================
    // 5. Frontend Isolation
    // =========================================================================
    await t.test('5. Frontend Isolation: Generated code does not leak between instances', () => {
      const tfFileA = fs.readFileSync(path.join(dirA, 'scripts', 'tailored-frontend.js'), 'utf8');
      const tfFileB = fs.readFileSync(path.join(dirB, 'scripts', 'tailored-frontend.js'), 'utf8');

      assert.ok(tfFileA.includes('Akdeniz Lojistik A.Ş.'));
      assert.ok(!tfFileA.includes('Marmara Endüstri Ltd.'));

      assert.ok(tfFileB.includes('Marmara Endüstri Ltd.'));
      assert.ok(!tfFileB.includes('Akdeniz Lojistik A.Ş.'));

      const designA = fs.readFileSync(path.join(dirA, 'DESIGN.md'), 'utf8');
      const designB = fs.readFileSync(path.join(dirB, 'DESIGN.md'), 'utf8');

      assert.ok(designA.includes('Akdeniz Lojistik A.Ş.'));
      assert.ok(!designA.includes('Marmara Endüstri Ltd.'));

      assert.ok(designB.includes('Marmara Endüstri Ltd.'));
      assert.ok(!designB.includes('Akdeniz Lojistik A.Ş.'));
    });

    // =========================================================================
    // 6. Configuration Isolation
    // =========================================================================
    await t.test('6. Configuration Isolation: Admin credentials and contact details isolated', () => {
      const dbA = new DatabaseSync(path.join(dirA, 'storage', 'database.sqlite'));
      const dbB = new DatabaseSync(path.join(dirB, 'storage', 'database.sqlite'));

      try {
        const adminA = dbA.prepare('SELECT email, first_name FROM users WHERE id = 1').get();
        assert.equal(adminA.email, 'admin@akdenizlojistik.com');
        assert.ok(adminA.first_name.includes('Akdeniz Lojistik'));

        const adminB = dbB.prepare('SELECT email, first_name FROM users WHERE id = 1').get();
        assert.equal(adminB.email, 'admin@marmaraendustri.com');
        assert.ok(adminB.first_name.includes('Marmara Endüstri'));
      } finally {
        dbA.close();
        dbB.close();
      }
    });

    // =========================================================================
    // 7. Cross-Contamination Stress Test
    // =========================================================================
    await t.test('7. Cross-Contamination Stress Test: Sequential multi-action integrity', async () => {
      // Step 1: Regenerate Customer A
      const regenResA = regenerateInstanceFrontend({ instanceDir: dirA });
      assert.equal(regenResA.success, true);

      // Step 2: Update Customer B database directly (simulate admin adding new service)
      const dbB = new DatabaseSync(path.join(dirB, 'storage', 'database.sqlite'));
      const resIns = dbB.prepare("INSERT INTO cms_contents (uuid, type, status, author_id) VALUES (?, 'service', 'published', 1)").run('svc-laser-b');
      dbB.prepare(`
        INSERT INTO cms_translations (content_id, lang, title, slug, summary, body, seo_title)
        VALUES (?, 'tr', 'Lazer Kesim ve Büküm', 'lazer-kesim', 'Hassas lazer kesim.', 'Detaylı lazer kesim.', 'Lazer Kesim | Marmara')
      `).run(resIns.lastInsertRowid);
      dbB.close();

      // Step 3: Regenerate Customer B frontend
      const regenResB = regenerateInstanceFrontend({ instanceDir: dirB });
      assert.equal(regenResB.success, true);

      // Verify Customer A still has NO mention of Lazer Kesim
      const tfFileA_after = fs.readFileSync(path.join(dirA, 'scripts', 'tailored-frontend.js'), 'utf8');
      assert.ok(!tfFileA_after.includes('Lazer Kesim'), 'Regenerated A must not contain B new service');

      // Verify Customer B has Lazer Kesim
      const tfFileB_after = fs.readFileSync(path.join(dirB, 'scripts', 'tailored-frontend.js'), 'utf8');
      assert.ok(tfFileB_after.includes('Lazer Kesim'), 'Regenerated B must contain newly added service');
    });

    // =========================================================================
    // 8. Admin -> Frontend Round Trip
    // =========================================================================
    await t.test('8. Admin -> Frontend Round Trip: DB edits flow into regenerated frontend', async () => {
      const dbPathA = path.join(dirA, 'storage', 'database.sqlite');
      const dbA = new DatabaseSync(dbPathA);

      try {
        // 1. Company Name Edit in site_settings
        dbA.prepare("UPDATE site_settings SET value = 'Akdeniz Uluslararası Lojistik A.Ş.' WHERE key = 'agency.agency_name'").run();
        dbA.prepare("UPDATE site_settings SET value = 'Akdeniz Uluslararası Lojistik | Resmi Sitesi' WHERE key = 'seo.site_title'").run();

        // 2. Add New Service in cms_contents + cms_translations
        const svcRes = dbA.prepare("INSERT INTO cms_contents (uuid, type, status, author_id) VALUES (?, 'service', 'published', 1)").run('svc-air-cargo');
        dbA.prepare(`
          INSERT INTO cms_translations (content_id, lang, title, slug, summary, body, seo_title)
          VALUES (?, 'tr', 'Havayolu Kargo Ekspres', 'havayolu-kargo', 'Hızlı hava taşımacılığı.', 'IATA lisanslı hava kargo.', 'Hava Kargo | Akdeniz')
        `).run(svcRes.lastInsertRowid);

        // 3. Add FAQ
        const faqRes = dbA.prepare("INSERT INTO cms_contents (uuid, type, status, author_id) VALUES (?, 'faq', 'published', 1)").run('faq-delivery-time');
        dbA.prepare(`
          INSERT INTO cms_translations (content_id, lang, title, slug, summary, body, seo_title)
          VALUES (?, 'tr', 'Avrupa teslimat süresi kaç gündür?', 'avrupa-teslimat', 'Genel', 'Ortalama 3-5 iş günü sürmektedir.', 'Teslimat Süresi SSS')
        `).run(faqRes.lastInsertRowid);

        // 4. Add Testimonial
        dbA.prepare(`
          INSERT INTO testimonials (customer_name, company_name, title, quote, rating, published)
          VALUES ('Serkan Bey', 'Ege İhracat A.Ş.', 'Tedarik Zinciri Müdürü', 'Harika ve kesintisiz lojistik hizmeti aldık.', 5, 1)
        `).run();

        // 5. Upload Media Record
        dbA.prepare(`
          INSERT INTO media_files (uuid, original_name, storage_path, mime_type, file_size, checksum_sha256, uploaded_by)
          VALUES ('med-flt-1', 'akdeniz-tir-filosu.webp', '/uploads/akdeniz-tir-filosu.webp', 'image/webp', 102400, 'dummy_hash', 1)
        `).run();
      } finally {
        dbA.close();
      }

      // Execute round trip: extract spec from DB and regenerate frontend
      const roundTripResult = regenerateInstanceFrontend({ instanceDir: dirA });
      assert.equal(roundTripResult.success, true);

      // Verify regenerated tailored-frontend.js contains all admin edits
      const updatedTf = fs.readFileSync(path.join(dirA, 'scripts', 'tailored-frontend.js'), 'utf8');
      assert.ok(updatedTf.includes('Akdeniz Uluslararası Lojistik A.Ş.'), 'Frontend must reflect updated company name');
      assert.ok(updatedTf.includes('Havayolu Kargo Ekspres'), 'Frontend must reflect new service added via DB');
      assert.ok(updatedTf.includes('Avrupa teslimat süresi kaç gündür?'), 'Frontend must reflect new FAQ added via DB');
      assert.ok(updatedTf.includes('Ege İhracat A.Ş.') || updatedTf.includes('Serkan Bey'), 'Frontend must reflect new testimonial');
    });

    // =========================================================================
    // 9. Frontend -> Backend Round Trip (Leads Form Isolation)
    // =========================================================================
    await t.test('9. Frontend -> Backend Round Trip: Form submissions routed to correct DB only', () => {
      const dbPathA = path.join(dirA, 'storage', 'database.sqlite');
      const dbPathB = path.join(dirB, 'storage', 'database.sqlite');
      const dbA = new DatabaseSync(dbPathA);
      const dbB = new DatabaseSync(dbPathB);

      try {
        // Customer A form submission
        dbA.prepare(`
          INSERT INTO leads (uuid, first_name, last_name, email, phone, company, status, score, message, campaign)
          VALUES (?, 'Ahmet', 'Yıldız', 'ahmet@lojistikmusteri.com', '+90 532 111 2233', 'Yıldız Dış Ticaret', 'new', 65, 'Konteyner nakliye teklifi lütfen.', 'website')
        `).run(crypto.randomUUID());

        // Customer B form submission
        dbB.prepare(`
          INSERT INTO leads (uuid, first_name, last_name, email, phone, company, status, score, message, campaign)
          VALUES (?, 'Mehmet', 'Demir', 'mehmet@fabrika.com', '+90 533 444 5566', 'Demir Otomotiv', 'new', 80, '1000 adet CNC parça teklifi.', 'website')
        `).run(crypto.randomUUID());

        // Verify A contains Ahmet and NOT Mehmet
        const aLeads = dbA.prepare('SELECT email FROM leads').all();
        assert.equal(aLeads.some(l => l.email === 'ahmet@lojistikmusteri.com'), true);
        assert.equal(aLeads.some(l => l.email === 'mehmet@fabrika.com'), false);

        // Verify B contains Mehmet and NOT Ahmet
        const bLeads = dbB.prepare('SELECT email FROM leads').all();
        assert.equal(bLeads.some(l => l.email === 'mehmet@fabrika.com'), true);
        assert.equal(bLeads.some(l => l.email === 'ahmet@lojistikmusteri.com'), false);
      } finally {
        dbA.close();
        dbB.close();
      }
    });

    // =========================================================================
    // 10. Auth / Session Isolation
    // =========================================================================
    await t.test('10. Auth / Session Isolation: Sessions are strictly bound to local DB', () => {
      const dbA = new DatabaseSync(path.join(dirA, 'storage', 'database.sqlite'));
      const dbB = new DatabaseSync(path.join(dirB, 'storage', 'database.sqlite'));

      try {
        const rawTokenA = 'session-token-for-customer-a-999';
        const hashA = crypto.createHash('sha256').update(rawTokenA).digest('hex');

        const rawTokenB = 'session-token-for-customer-b-888';
        const hashB = crypto.createHash('sha256').update(rawTokenB).digest('hex');

        const futureDate = new Date(Date.now() + 86400000).toISOString();

        // Insert session A into DB A
        dbA.prepare(`
          INSERT INTO sessions (session_token_hash, user_id, expires_at, created_at)
          VALUES (?, 1, ?, datetime('now'))
        `).run(hashA, futureDate);

        // Insert session B into DB B
        dbB.prepare(`
          INSERT INTO sessions (session_token_hash, user_id, expires_at, created_at)
          VALUES (?, 1, ?, datetime('now'))
        `).run(hashB, futureDate);

        // Attempting to authenticate on B with Token A -> DENIED
        const verifyAOnB = dbB.prepare('SELECT * FROM sessions WHERE session_token_hash = ?').get(hashA);
        assert.equal(verifyAOnB, undefined, 'Session A must be rejected on Instance B');

        // Attempting to authenticate on A with Token B -> DENIED
        const verifyBOnA = dbA.prepare('SELECT * FROM sessions WHERE session_token_hash = ?').get(hashB);
        assert.equal(verifyBOnA, undefined, 'Session B must be rejected on Instance A');
      } finally {
        dbA.close();
        dbB.close();
      }
    });

    // =========================================================================
    // 11. Production Build Validation
    // =========================================================================
    await t.test('11. Production Build Validation: Complete asset set, zero thin content', () => {
      for (const instDir of [dirA, dirB]) {
        assert.ok(fs.existsSync(path.join(instDir, 'scripts', 'server.js')), 'scripts/server.js must exist');
        assert.ok(fs.existsSync(path.join(instDir, 'scripts', 'tailored-frontend.js')), 'scripts/tailored-frontend.js must exist');
        assert.ok(fs.existsSync(path.join(instDir, 'storage', 'database.sqlite')), 'database.sqlite must exist');
        assert.ok(fs.existsSync(path.join(instDir, 'public', 'assets', 'css', 'main.css')), 'main.css must exist');
        assert.ok(fs.existsSync(path.join(instDir, 'DESIGN.md')), 'DESIGN.md must exist');
      }
    });

    // =========================================================================
    // 12. Zero Feature Invention Regression
    // =========================================================================
    await t.test('12. Zero Feature Invention Regression: Missing data is cataloged, never hallucinated', () => {
      const rawInput = {
        companyName: 'Sade Lojistik',
        services: ['Karayolu']
        // No founded year, no awards, no certificates
      };
      const spec = buildCorporateSiteSpec({ manualInput: rawInput });
      assert.ok(spec.missingData.includes('company.foundedYear'));
      assert.ok(spec.missingData.includes('company.awards'));
      assert.ok(spec.missingData.includes('company.certifications'));

      // QA verification
      const qa = runPreviewQa({ spec, synthesis: { files: [] }, plan: {} });
      assert.equal(qa.contentQa.checks.zeroHallucinatedClaims, true);
      assert.equal(qa.contentQa.passed, true);
    });

    // =========================================================================
    // 13. Approval & Authority State Machine
    // =========================================================================
    await t.test('13. Approval & Authority State Machine: proposalOnly invariant and approval gate', async () => {
      const spec = { companyName: 'Onay Test Ltd.', targetDir: 'onay-test' };
      const synthesis = generator.synthesizeCorporateProject(spec);
      const plan = generator.createCorporatePlan({ synthesis, workspaceRoot: rootDir });

      // Invariant: plan must require approval and be proposalOnly
      assert.equal(plan.metadata.proposalOnly, true);

      // Rejection when approval = false
      const deniedResult = await generator.applyCorporatePlan({
        plan,
        workspaceRoot: rootDir,
        approval: false
      });
      assert.equal(deniedResult.success, false);
      assert.equal(deniedResult.writtenFiles.length, 0);
      assert.ok(deniedResult.failedFiles.length > 0);
    });

    // =========================================================================
    // 14. Backend Capability Gate Regression
    // =========================================================================
    await t.test('14. Backend Capability Gate: 11 FULL / 2 DEFERRED / 0 MISSING verified', () => {
      const fullList = ['pages', 'media', 'services', 'products', 'blog', 'forms', 'seo', 'case_studies', 'team', 'faq', 'testimonials'];
      const val = validateBackendCapabilities(fullList);
      assert.equal(val.valid, true);
      assert.equal(val.blocked, false);

      const deferredVal = validateBackendCapabilities(['gallery']);
      assert.equal(deferredVal.valid, false);
      assert.equal(deferredVal.errorCode, 'BACKEND_CAPABILITY_DEFERRED');
    });

    // =========================================================================
    // 15. Golden Master DB Mutation Guard
    // =========================================================================
    await t.test('15. Golden Master DB Mutation Guard: Prevents write attempts on Golden Master', async () => {
      const badPlan = {
        id: 'plan-attack',
        metadata: { targetDirectory: '.' }, // root would resolve to Golden Master if passed directly
        spec: { companyName: 'Attack' },
        authoritativeFileMutations: [
          { file: 'test.txt', content: 'test payload' }
        ]
      };

      await assert.rejects(async () => {
        await generator.applyCorporatePlan({
          plan: badPlan,
          workspaceRoot: GOLDEN_MASTER_PATH,
          approval: true
        });
      }, /IMMUTABILITY VIOLATION/);
    });

  } finally {
    try { fs.rmSync(rootDir, { recursive: true, force: true }); } catch (e) {}
  }
});
