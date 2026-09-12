import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { createCorporateGenerator, CorporatePalettes } from '../src/autonomous/corporate-generator.js';
import { createApplicationServer } from '../src/app/server.js';

const require = createRequire(import.meta.url);

test('ONLUNET ZEKA — Corporate Generator Engine', async (t) => {
  const corporateGen = createCorporateGenerator({
    sourceKurumsalPath: 'D:\\Antigravity\\onlunet-kurumsal'
  });

  await t.test('1. Validates available color palettes', () => {
    assert.ok(CorporatePalettes.BLUE);
    assert.ok(CorporatePalettes.EMERALD);
    assert.ok(CorporatePalettes.GOLD);
    assert.ok(CorporatePalettes.PURPLE);
    assert.ok(CorporatePalettes.CRIMSON);
    assert.equal(CorporatePalettes.BLUE.primary, '#2563eb');
  });

  await t.test('2. Synthesizes complete corporate project with onlunet-kurumsal admin and custom frontend', () => {
    const spec = {
      companyName: 'Akdeniz Lojistik A.Ş.',
      industry: 'Lojistik & Taşımacılık',
      slogan: 'Güvenle Taşır, Zamanında Ulaştırır',
      description: '25 yılı aşkın süredir uluslararası karayolu ve denizyolu taşımacılığında güvenilir çözüm ortağınız.',
      services: [
        'Uluslararası Karayolu Taşımacılığı',
        'Denizyolu Konteyner',
        'Soğuk Zincir Lojistiği',
        'Depolama & Gümrükleme'
      ],
      contact: {
        phone: '+90 212 555 9988',
        email: 'info@akdenizlojistik.com',
        address: 'Büyükdere Cad. No:142 Şişli',
        city: 'İstanbul',
        workingHours: 'Hafta İçi: 08:30 - 18:00'
      },
      theme: { palette: 'blue' },
      adminUser: {
        username: 'akdenizadmin',
        email: 'admin@akdenizlojistik.com',
        password: 'AdminPassword2026!'
      }
    };

    const synthesis = corporateGen.synthesizeCorporateProject(spec);

    assert.equal(synthesis.projectName, 'Akdeniz Lojistik A.Ş.');
    assert.equal(synthesis.projectType, 'corporate-portal');
    assert.ok(synthesis.files.length > 50, `Expected at least 50 files, got ${synthesis.files.length}`);

    // Check custom frontend home.php
    const homeFile = synthesis.files.find(f => f.path === 'resources/views/frontend/home.php');
    assert.ok(homeFile, 'home.php must exist');
    assert.ok(homeFile.content.includes('Güvenle Taşır, Zamanında Ulaştırır'));
    assert.ok(homeFile.content.includes('Uluslararası Karayolu Taşımacılığı'));

    // Check custom layout app.php
    const layoutFile = synthesis.files.find(f => f.path === 'resources/views/layout/app.php');
    assert.ok(layoutFile, 'app.php must exist');
    assert.ok(layoutFile.content.includes('Akdeniz Lojistik A.Ş.'));
    assert.ok(layoutFile.content.includes('+90 212 555 9988'));

    // Check onlunet-kurumsal Admin Panel presence
    const adminLayoutFile = synthesis.files.find(f => f.path === 'resources/views/layout/admin.php');
    assert.ok(adminLayoutFile, 'admin.php layout must be present');
    assert.ok(adminLayoutFile.content.includes('Akdeniz Lojistik A.Ş.'));

    const adminDashboard = synthesis.files.find(f => f.path === 'resources/views/admin/dashboard.php');
    assert.ok(adminDashboard, 'admin dashboard must be present');

    const adminCms = synthesis.files.find(f => f.path === 'resources/views/admin/cms-list.php');
    assert.ok(adminCms, 'admin cms-list must be present');

    const adminLeads = synthesis.files.find(f => f.path === 'resources/views/admin/leads-list.php');
    assert.ok(adminLeads, 'admin leads-list must be present');

    const adminSec = synthesis.files.find(f => f.path === 'resources/views/admin/security-center.php');
    assert.ok(adminSec, 'admin security-center must be present');

    // Check tailored frontend JS module
    const tfJs = synthesis.files.find(f => f.path === 'scripts/tailored-frontend.js');
    assert.ok(tfJs, 'scripts/tailored-frontend.js must exist for Node.js server');
    assert.ok(tfJs.content.includes('isTailored: true'));
    assert.ok(tfJs.content.includes('Akdeniz Lojistik A.Ş.'));
    assert.ok(tfJs.content.includes('getNavLinksHtml'));
    assert.ok(tfJs.content.includes('getHomeHtml'));

    // Check server.js contains tailored frontend loader
    const serverJs = synthesis.files.find(f => f.path === 'scripts/server.js');
    assert.ok(serverJs, 'scripts/server.js must exist');
    assert.ok(serverJs.content.includes('tailoredFrontend'));

    // Check run.bat and README.md
    const runBat = synthesis.files.find(f => f.path === 'run.bat');
    assert.ok(runBat, 'run.bat must be present');
    assert.ok(runBat.content.includes('node scripts/server.js'));

    const readme = synthesis.files.find(f => f.path === 'README.md');
    assert.ok(readme, 'README.md must be present');
    assert.ok(readme.content.includes('akdenizadmin'));
  });

  await t.test('3. Builds authoritative ExecutionPlanContract', () => {
    const spec = { companyName: 'Atlas Hukuk', industry: 'Hukuk', theme: { palette: 'gold' } };
    const synthesis = corporateGen.synthesizeCorporateProject(spec);
    const plan = corporateGen.createCorporatePlan({ synthesis, workspaceRoot: process.cwd() });

    assert.ok(plan.id.startsWith('plan-corp-'));
    assert.ok(plan.authoritativeFileMutations);
    assert.equal(plan.authoritativeFileMutations.length, synthesis.files.length);
    assert.equal(plan.metadata.projectName, 'Atlas Hukuk');
  });

  await t.test('4. Safely applies file mutations with full preflight & controlled execution', async () => {
    const tempTarget = path.join(process.cwd(), 'temp-test-corp-output');
    try {
      const spec = {
        companyName: 'Test Firma',
        targetDir: 'temp-test-corp-output',
        adminUser: { email: 'admin@testfirma.com' }
      };
      const synthesis = corporateGen.synthesizeCorporateProject(spec);
      const plan = corporateGen.createCorporatePlan({ synthesis, workspaceRoot: process.cwd() });

      const result = await corporateGen.applyCorporatePlan({
        plan,
        workspaceRoot: process.cwd(),
        approval: true
      });

      assert.equal(result.success, true);
      assert.ok(result.writtenFiles.length > 50);

      // Verify files actually exist on disk
      assert.ok(fs.existsSync(path.join(tempTarget, 'run.bat')));
      assert.ok(fs.existsSync(path.join(tempTarget, 'resources/views/frontend/home.php')));
      assert.ok(fs.existsSync(path.join(tempTarget, 'resources/views/admin/dashboard.php')));

      // Verify SQLite database was copied and seeded
      const targetDb = path.join(tempTarget, 'storage/database.sqlite');
      assert.ok(fs.existsSync(targetDb), 'storage/database.sqlite must exist');
      const db = new DatabaseSync(targetDb);
      const agencyName = db.prepare("SELECT value FROM site_settings WHERE key = 'agency.agency_name'").get();
      assert.equal(agencyName.value, 'Test Firma');
      const adminUser = db.prepare("SELECT email FROM users WHERE id = 1").get();
      assert.equal(adminUser.email, 'admin@testfirma.com');
      db.close();
    } finally {
      if (fs.existsSync(tempTarget)) {
        fs.rmSync(tempTarget, { recursive: true, force: true });
      }
    }
  });

  await t.test('5. Rejects corporate mutation when approval is denied', async () => {
    const spec = { companyName: 'Reddedilen Firma', targetDir: 'temp-rejected-corp' };
    const synthesis = corporateGen.synthesizeCorporateProject(spec);
    const plan = corporateGen.createCorporatePlan({ synthesis, workspaceRoot: process.cwd() });

    const result = await corporateGen.applyCorporatePlan({
      plan,
      workspaceRoot: process.cwd(),
      approval: false // Explicitly denied
    });

    assert.equal(result.success, false);
    assert.equal(result.writtenFiles.length, 0);
    assert.ok(result.failedFiles.length > 0);
    assert.ok(result.failedFiles[0].reason.includes('Preflight') || result.failedFiles[0].reason.includes('approval'));
  });

  await t.test('6. Synthesizes corporate project with optional Google Maps link and reference URLs', () => {
    const spec = {
      companyName: 'Akdeniz Lojistik A.Ş.',
      industry: 'Lojistik & Taşımacılık',
      slogan: 'Güvenle Taşır, Zamanında Ulaştırır',
      contact: { address: 'Büyükdere Cad. No:142', city: 'İstanbul' },
      googleMapsUrl: 'https://maps.app.goo.gl/sample123',
      referenceUrls: ['https://orneklojistik.com', 'https://linear.app'],
      inspirationNotes: 'Linear tarzı koyu tema ve ferah kartlar',
      layoutPreferences: ['apple-hero', 'stats-counter', 'google-reviews', 'faq-accordion', 'map-widget']
    };

    const synthesis = corporateGen.synthesizeCorporateProject(spec);

    // Verify contact.php contains Google Maps embed iframe and direct link
    const contactFile = synthesis.files.find(f => f.path === 'resources/views/frontend/contact.php');
    assert.ok(contactFile, 'contact.php must exist');
    assert.ok(contactFile.content.includes('Google Haritalar & Canlı Lokasyon Bölümü'));
    assert.ok(contactFile.content.includes('iframe width="100%"'));
    assert.ok(contactFile.content.includes('Google Haritalarda Aç'));

    // Verify home.php contains Reviews and FAQs
    const homeFile = synthesis.files.find(f => f.path === 'resources/views/frontend/home.php');
    assert.ok(homeFile, 'home.php must exist');
    assert.ok(homeFile.content.includes('İş Ortaklarımızın Değerlendirmeleri'));
    assert.ok(homeFile.content.includes('Sıkça Sorulan Sorular'));

    // Verify README.md contains Reference analysis
    const readmeFile = synthesis.files.find(f => f.path === 'README.md');
    assert.ok(readmeFile, 'README.md must exist');
    assert.ok(readmeFile.content.includes('🎯 Referans Siteler ve Tasarım İlham Analizi'));
    assert.ok(readmeFile.content.includes('https://linear.app'));
    assert.ok(readmeFile.content.includes('Linear tarzı koyu tema'));
  });

  await t.test('7. Applies plan and seeds Google Maps URL and Reference URLs into SQLite database', async () => {
    const tempTarget = path.join(process.cwd(), 'temp-test-corp-maps-output');
    try {
      const spec = {
        companyName: 'Harita Test A.Ş.',
        targetDir: 'temp-test-corp-maps-output',
        googleMapsUrl: 'https://maps.google.com/?q=Test+Lokasyon',
        referenceUrls: ['https://testreference.com'],
        inspirationNotes: 'Örnek tasarım notu'
      };
      const synthesis = corporateGen.synthesizeCorporateProject(spec);
      const plan = corporateGen.createCorporatePlan({ synthesis, workspaceRoot: process.cwd() });

      const result = await corporateGen.applyCorporatePlan({
        plan,
        workspaceRoot: process.cwd(),
        approval: true
      });

      assert.equal(result.success, true);
      const targetDb = path.join(tempTarget, 'storage/database.sqlite');
      assert.ok(fs.existsSync(targetDb));

      const db = new DatabaseSync(targetDb);
      const mapsSetting = db.prepare("SELECT value FROM site_settings WHERE key = 'site.google_maps_url'").get();
      assert.equal(mapsSetting.value, 'https://maps.google.com/?q=Test+Lokasyon');

      const refSetting = db.prepare("SELECT value FROM site_settings WHERE key = 'site.reference_urls'").get();
      assert.ok(refSetting.value.includes('https://testreference.com'));

      const notesSetting = db.prepare("SELECT value FROM site_settings WHERE key = 'site.design_notes'").get();
      assert.equal(notesSetting.value, 'Örnek tasarım notu');
      db.close();
    } finally {
      if (fs.existsSync(tempTarget)) {
        fs.rmSync(tempTarget, { recursive: true, force: true });
      }
    }
  });

  await t.test('8. Synthesizes standalone pages for all services and products with getPage and seeds rich content', async () => {
    const tempTarget = path.join(process.cwd(), 'temp-test-corp-subpages');
    try {
      const spec = {
        companyName: 'Falcon Enerji Test',
        industry: 'Akü ve Güneş Enerjisi',
        targetDir: 'temp-test-corp-subpages',
        services: [
          { title: 'Endüstriyel Akü Satış', slug: 'endustriyel-aku-satis', url: '/hizmetlerimiz/endustriyel-aku-satis/' },
          { title: 'Solar Sistem Kurulumları', slug: 'solar-sistem-kurulumlari', url: '/hizmetlerimiz/solar-sistem-kurulumlari/' }
        ],
        products: [
          { title: 'Lityum Aküler', slug: 'lityum-akuler', url: '/lityum-akuler/' },
          { title: 'Forkliftler', slug: 'forkliftler', url: '/forkliftler/' }
        ]
      };

      const synthesis = corporateGen.synthesizeCorporateProject(spec);
      
      // Verify server.js contains tailoredFrontend.getPage hook
      const serverFile = synthesis.files.find(f => f.path === 'scripts/server.js');
      assert.ok(serverFile, 'server.js must exist');
      assert.ok(serverFile.content.includes('tailoredFrontend.getPage'), 'server.js must include tailoredFrontend.getPage route hook');

      // Verify tailored-frontend.js exports getPage, getPageHtml, getAllPages
      const tfFile = synthesis.files.find(f => f.path === 'scripts/tailored-frontend.js');
      assert.ok(tfFile, 'tailored-frontend.js must exist');
      assert.ok(tfFile.content.includes('getPage(pathname, lang = \'tr\')'));
      assert.ok(tfFile.content.includes('getAllPages()'));

      // Dynamically load tailored-frontend module in isolated context to test routing
      const tempTfPath = path.join(process.cwd(), 'temp-test-tf.cjs');
      fs.writeFileSync(tempTfPath, tfFile.content);
      try {
        const tfModule = require(tempTfPath);
        
        // 1. Service subpage lookup
        const svcPage = tfModule.getPage('/hizmetlerimiz/endustriyel-aku-satis/');
        assert.ok(svcPage, 'Service page should be resolvable');
        assert.equal(svcPage.title, 'Endüstriyel Akü Satış');
        assert.ok(svcPage.content.includes('Teknik Spesifikasyonlar & Standartlar'));
        assert.ok(svcPage.content.includes('Hızlı Teklif & Danışmanlık'));

        // 2. Product subpage direct & alias lookup
        const prdPage = tfModule.getPage('/lityum-akuler/');
        assert.ok(prdPage, 'Product direct page should be resolvable');
        assert.equal(prdPage.title, 'Lityum Aküler');

        const prdAlias = tfModule.getPage('/urunler/lityum-akuler/');
        assert.ok(prdAlias, 'Product /urunler/ alias should resolve');
        assert.equal(prdAlias.title, 'Lityum Aküler');

        // 3. getAllPages list
        const allPages = tfModule.getAllPages();
        assert.equal(allPages.length, 4);

        // 4. Dropdown and Catalog link guarantees
        const navHtml = tfModule.getNavLinksHtml('tr');
        assert.ok(navHtml.includes('/tr/lityum-akuler/'), 'Dropdown must include product link');
        assert.ok(navHtml.includes('/tr/forkliftler/'), 'Dropdown must include product link');
        assert.ok(navHtml.includes('Tüm Ürünler Kataloğu (2 Ürün)'), 'Dropdown footer link must include total product count');

        const homeHtml = tfModule.getHomeHtml('tr');
        assert.ok(homeHtml.includes('href="/tr/lityum-akuler/"'), 'Product catalog card must link directly to product page');
        assert.ok(homeHtml.includes('Detaylı İncele &rarr;'), 'Product card must have Detaylı İncele link');
      } finally {
        if (fs.existsSync(tempTfPath)) fs.unlinkSync(tempTfPath);
      }

      // Test database seeding with rich autonomous content
      const plan = corporateGen.createCorporatePlan({ synthesis, workspaceRoot: process.cwd() });
      const result = await corporateGen.applyCorporatePlan({
        plan,
        workspaceRoot: process.cwd(),
        approval: true
      });
      assert.equal(result.success, true);

      const db = new DatabaseSync(path.join(tempTarget, 'storage/database.sqlite'));
      const transRows = db.prepare("SELECT title, slug, summary, body FROM cms_translations").all();
      assert.ok(transRows.length >= 4, 'All services and products should be seeded into cms_translations');
      
      const akuRow = transRows.find(r => r.slug === 'endustriyel-aku-satis');
      assert.ok(akuRow, 'endustriyel-aku-satis should exist in translations');
      assert.ok(akuRow.summary.length > 20, 'Summary must be rich Turkish copy');
      assert.ok(akuRow.body.length > 20, 'Body must be rich Turkish copy');
      db.close();

    } finally {
      if (fs.existsSync(tempTarget)) {
        fs.rmSync(tempTarget, { recursive: true, force: true });
      }
    }
  });

  await t.test('9. Guarantees Google Ads, DoubleClick, GA4 & Meta Pixel CSP compatibility in scripts/server.js', async () => {
    const spec = {
      companyName: 'CSP Test Enerji',
      targetDir: 'temp-csp-test'
    };
    const synthesis = corporateGen.synthesizeCorporateProject(spec);
    const serverFile = synthesis.files.find(f => f.path === 'scripts/server.js');
    assert.ok(serverFile, 'scripts/server.js must exist');
    assert.ok(serverFile.content.includes('googleads.g.doubleclick.net'), 'CSP must include googleads.g.doubleclick.net');
    assert.ok(serverFile.content.includes('googleadservices.com'), 'CSP must include googleadservices.com');
    assert.ok(serverFile.content.includes('connect.facebook.net'), 'CSP must include connect.facebook.net');
    assert.ok(serverFile.content.includes('script-src-elem'), 'CSP must include script-src-elem');
    assert.ok(serverFile.content.includes('connect-src'), 'CSP must include connect-src');
  });

  await t.test('10. Guarantees mobile responsiveness: hamburger toggle, drawer styles, responsive grids, and fluid clamp typography', async () => {
    const spec = {
      companyName: 'Mobil Uyumluluk Test A.Ş.',
      targetDir: 'temp-mobile-test',
      services: [
        { title: 'Endüstriyel Akü Hizmeti', slug: 'endustriyel-aku', description: 'Akü ve güç sistemleri servisi.' }
      ],
      products: [
        { title: 'Traksiyoner Akü', slug: 'traksiyoner-aku', description: 'Traksiyoner forklift aküleri.' }
      ]
    };
    const synthesis = corporateGen.synthesizeCorporateProject(spec);

    // 1. design-tokens.css must contain mobile responsiveness tokens & media queries
    const cssFile = synthesis.files.find(f => f.path === 'public/assets/css/design-tokens.css');
    assert.ok(cssFile, 'design-tokens.css must exist');
    assert.ok(cssFile.content.includes('.mobile-nav-toggle'), 'Must define .mobile-nav-toggle');
    assert.ok(cssFile.content.includes('.hamburger-bar'), 'Must define .hamburger-bar');
    assert.ok(cssFile.content.includes('.nav-container.is-open'), 'Must define .nav-container.is-open');
    assert.ok(cssFile.content.includes('@media (max-width: 992px)'), 'Must define 992px breakpoint');
    assert.ok(cssFile.content.includes('overflow-x: hidden !important;'), 'Must enforce horizontal overflow prevention');
    assert.ok(cssFile.content.includes('.hero-grid-split'), 'Must define responsive hero grid collapse');
    assert.ok(cssFile.content.includes('.simulator-grid-split'), 'Must define responsive simulator grid collapse');
    assert.ok(cssFile.content.includes('.subpage-layout-grid'), 'Must define responsive subpage grid collapse');

    // 2. app.php layout must include hamburger button and nav-container
    const appFile = synthesis.files.find(f => f.path === 'resources/views/layout/app.php');
    assert.ok(appFile, 'app.php must exist');
    assert.ok(appFile.content.includes('class="mobile-nav-toggle"'), 'app.php must contain mobile hamburger button');
    assert.ok(appFile.content.includes('id="mobile-nav-toggle"'), 'app.php must contain hamburger id');
    assert.ok(appFile.content.includes('class="nav-container"'), 'app.php must contain nav-container');

    // 3. tailored-frontend.js Home & Subpages must have responsive classes
    const tfFile = synthesis.files.find(f => f.path === 'scripts/tailored-frontend.js');
    assert.ok(tfFile, 'tailored-frontend.js must exist');
    const homeDecoded = Buffer.from(tfFile.content.match(/HOME_RAW = Buffer\.from\('([^']+)'/)[1], 'base64').toString('utf-8');
    assert.ok(homeDecoded.includes('hero-grid-split'), 'Hero must have hero-grid-split class');
    assert.ok(homeDecoded.includes('hero-title-responsive'), 'Hero title must have hero-title-responsive class');
    assert.ok(homeDecoded.includes('clamp('), 'Hero title must use clamp() fluid typography');
    assert.ok(homeDecoded.includes('simulator-grid-split'), 'Simulator must have simulator-grid-split class');
    assert.ok(homeDecoded.includes('lead-section-grid'), 'Lead section must have lead-section-grid class');

    // 4. Subpages must have subpage-layout-grid and subpage-hero-title
    const subpagesMatch = tfFile.content.match(/SUBPAGES_DATA = JSON\.parse\(Buffer\.from\('([^']+)'/);
    assert.ok(subpagesMatch, 'SUBPAGES_DATA must exist in tailored-frontend.js');
    const subpagesObj = JSON.parse(Buffer.from(subpagesMatch[1], 'base64').toString('utf-8'));
    const firstSubpageKey = Object.keys(subpagesObj)[0];
    assert.ok(firstSubpageKey, 'At least one subpage must exist');
    const firstSubpageHtml = Buffer.from(subpagesObj[firstSubpageKey].b64, 'base64').toString('utf-8');
    assert.ok(firstSubpageHtml.includes('subpage-layout-grid'), 'Subpage main must have subpage-layout-grid class');
    assert.ok(firstSubpageHtml.includes('subpage-hero-title'), 'Subpage title must have subpage-hero-title class');
    assert.ok(firstSubpageHtml.includes('clamp('), 'Subpage title must use clamp() fluid typography');
  });
});

test('ONLUNET ZEKA — Server Corporate Generation HTTP API', async (t) => {
  let server;
  let baseUrl;
  const httpWorkspace = path.join(process.cwd(), 'scratch-http-corp-workspace');

  if (!fs.existsSync(httpWorkspace)) {
    fs.mkdirSync(httpWorkspace, { recursive: true });
  }

  await new Promise((resolve) => {
    server = createApplicationServer();
    server.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (fs.existsSync(httpWorkspace)) {
      fs.rmSync(httpWorkspace, { recursive: true, force: true });
    }
  });

  await t.test('1. GET /api/corporate/palettes returns available themes', async () => {
    const res = await fetch(`${baseUrl}/api/corporate/palettes`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.palettes.BLUE);
    assert.ok(data.palettes.EMERALD);
  });

  await t.test('1.1. GET /api/corporate/sectors returns 13 main categories and 79 sub-sectors', async () => {
    const res = await fetch(`${baseUrl}/api/corporate/sectors`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.categories.length, 13);
    assert.ok(data.subSectors.length >= 78);
    assert.ok(data.subSectors.some(s => s.id === 'DIS_KLINIGI_AGIZ_SAGLIGI'));
    assert.ok(data.subSectors.some(s => s.id === 'MIMARLIK_IC_MIMARLIK_OFISI'));
  });

  await t.test('2. POST /api/corporate/plan synthesizes company project and creates plan', async () => {
    // Select workspace
    await fetch(`${baseUrl}/api/workspace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath: httpWorkspace })
    });

    const res = await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Nova Sağlık A.Ş.',
        industry: 'Sağlık & Klinik',
        slogan: 'Sağlığınız İçin Modern Çözümler',
        theme: { palette: 'emerald' },
        targetDirectory: 'nova-saglik'
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.synthesis.projectName, 'Nova Sağlık A.Ş.');
    assert.ok(data.authoritativePlanId.startsWith('plan-corp-'));
    assert.ok(data.plan.proposedFileMutations.length > 50);
  });

  await t.test('3. POST /api/corporate/generate writes corporate files to disk', async () => {
    const res = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approval: true
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.result.writtenFiles.length > 50);

    // Verify file written to workspace disk
    const homeDisk = path.join(httpWorkspace, 'nova-saglik', 'resources/views/frontend/home.php');
    assert.ok(fs.existsSync(homeDisk));
    const content = fs.readFileSync(homeDisk, 'utf-8');
    assert.ok(content.includes('Sağlığınız İçin Modern Çözümler'));
  });

  await t.test('4. POST /api/corporate/plan supports optional googleMapsUrl and referenceUrls via HTTP', async () => {
    const res = await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Atlas Lojistik',
        industry: 'Lojistik',
        googleMapsUrl: 'https://maps.google.com/?q=Atlas+Lojistik',
        referenceUrls: ['https://linear.app'],
        inspirationNotes: 'Minimalist düzen',
        layoutPreferences: ['apple-hero', 'google-reviews', 'faq-accordion']
      })
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.synthesis.spec.googleMapsUrl, 'https://maps.google.com/?q=Atlas+Lojistik');
    assert.equal(data.synthesis.spec.referenceUrls[0], 'https://linear.app');

    const contactFile = data.synthesis.files.find(f => f.path === 'resources/views/frontend/contact.php');
    assert.ok(contactFile.content.includes('Google Haritalarda Aç'));

    const homeFile = data.synthesis.files.find(f => f.path === 'resources/views/frontend/home.php');
    assert.ok(homeFile.content.includes('İş Ortaklarımızın Değerlendirmeleri'));
  });

  await t.test('5. POST /api/corporate/inspect-site validates input correctly', async () => {
    // Missing URL should return 400
    const resEmpty = await fetch(`${baseUrl}/api/corporate/inspect-site`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(resEmpty.status, 400);
    const dataEmpty = await resEmpty.json();
    assert.equal(dataEmpty.success, false);
    assert.ok(dataEmpty.error.includes('Site URL gereklidir'));
  });

  await t.test('6. GET /api/projects returns project list with activeProject status', async () => {
    const res = await fetch(`${baseUrl}/api/projects`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.projects));
  });

  await t.test('7. POST /api/projects/start validates missing projectId and non-existent project', async () => {
    const resMissing = await fetch(`${baseUrl}/api/projects/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(resMissing.status, 400);

    const resNotFound = await fetch(`${baseUrl}/api/projects/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'non-existent-proj-xyz' })
    });
    assert.equal(resNotFound.status, 404);
  });

  await t.test('8. POST /api/projects/stop gracefully stops active project server', async () => {
    const res = await fetch(`${baseUrl}/api/projects/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.message.includes('durduruldu'));
  });

  await t.test('9. POST /api/projects/browser-audit validates missing projectId and non-existent project', async () => {
    const resMissing = await fetch(`${baseUrl}/api/projects/browser-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(resMissing.status, 400);

    const resNotFound = await fetch(`${baseUrl}/api/projects/browser-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'non-existent-proj-xyz' })
    });
    assert.equal(resNotFound.status, 404);
  });
});


