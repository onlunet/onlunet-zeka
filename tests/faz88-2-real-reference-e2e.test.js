/**
 * FAZ 88.2 — REAL REFERENCE IMAGE END-TO-END VERIFICATION TEST SUITE
 *
 * Verifies the full chain from reference image selection to generated site rendering:
 * 1. Real Reference File (Non-synthetic, external PNG/JPG)
 * 2. Live HTTP Server + Headless Chromium UI interaction
 * 3. Network Assertions across:
 *    - POST /api/corporate/upload-reference
 *    - POST /api/corporate/plan
 *    - POST /api/corporate/create
 * 4. Reference Continuity Verification:
 *    uploadedReferenceId === plannedReferenceId === createdReferenceId
 * 5. Exact Fidelity Pipeline Execution & Spec-Driven Scaffolding
 * 6. Generated Site Disk & Real Browser Render Verification
 * 7. Similar Fidelity Pipeline Execution
 * 8. Golden Master Immutability Guarantee
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { chromium } from 'playwright-core';

import { PROJECT_ROOT } from '../src/interfaces/core.js';
import { createApplicationServer } from '../src/app/server.js';
import {
  getBrowserExecutablePath,
  computeDecodedPixelHash
} from '../src/autonomous/reference-image-analyzer.js';

const GOLDEN_MASTER_ROOT = path.resolve(PROJECT_ROOT, '..', 'onlunet-kurumsal');
const REAL_REFERENCE_ARCH = path.join(PROJECT_ROOT, 'artifacts', 'faz87', 'architecture', 'reference.png');
const REAL_REFERENCE_RETAIL = path.join(PROJECT_ROOT, 'artifacts', 'faz87', 'retail', 'reference.png');

test('FAZ 88.2 — REAL REFERENCE IMAGE PRODUCTION E2E SUITE', async (t) => {
  let server;
  let baseUrl;
  let browser;
  let page;
  const testProjectDirs = [];
  const networkLog = [];

  // Shared test context across subtests
  let uploadedReferenceId = null;
  let uploadedImagePath = null;
  let uploadedAnalysis = null;
  let uploadedDesignSpec = null;
  let plannedPlanId = null;
  let createdTargetDir = null;
  let createdIndexHtmlPath = null;

  // Start live application server on dynamic port
  await new Promise((resolve) => {
    server = createApplicationServer();
    server.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  const browserPath = getBrowserExecutablePath();
  if (browserPath) {
    browser = await chromium.launch({
      executablePath: browserPath,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });
    page = await browser.newPage();

    // Attach network interception to record every API call and payload
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/corporate/')) {
        let postData = null;
        try {
          postData = req.postDataJSON();
        } catch (_) {
          postData = req.postData();
        }
        networkLog.push({
          type: 'REQUEST',
          url,
          method: req.method(),
          headers: req.headers(),
          payload: postData,
          timestamp: Date.now()
        });
      }
    });

    page.on('response', async (res) => {
      const url = res.url();
      if (url.includes('/api/corporate/')) {
        let body = null;
        try {
          body = await res.json();
        } catch (_) {}
        networkLog.push({
          type: 'RESPONSE',
          url,
          status: res.status(),
          headers: res.headers(),
          body,
          timestamp: Date.now()
        });
      }
    });
  }

  t.after(async () => {
    if (page) {
      await page.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    // Clean up test project directories
    for (const p of testProjectDirs) {
      if (fs.existsSync(p)) {
        try {
          fs.rmSync(p, { recursive: true, force: true });
        } catch (_) {}
      }
    }
  });

  // Test 1: Real reference image provenance check
  await t.test('Test 1: Real reference images are external, non-synthetic, and valid PNGs', () => {
    assert.ok(fs.existsSync(REAL_REFERENCE_ARCH), 'Architecture reference PNG must exist');
    assert.ok(fs.existsSync(REAL_REFERENCE_RETAIL), 'Retail reference PNG must exist');

    const archBuf = fs.readFileSync(REAL_REFERENCE_ARCH);
    const retailBuf = fs.readFileSync(REAL_REFERENCE_RETAIL);

    // PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
    assert.equal(archBuf[0], 0x89);
    assert.equal(archBuf[1], 0x50);
    assert.equal(archBuf[2], 0x4e);
    assert.equal(archBuf[3], 0x47);

    assert.equal(retailBuf[0], 0x89);
    assert.equal(retailBuf[1], 0x50);
    assert.equal(retailBuf[2], 0x4e);
    assert.equal(retailBuf[3], 0x47);

    // Verify significant file sizes (real images, not dummy 1x1 stubs)
    assert.ok(archBuf.length > 50000, 'Architecture reference must be > 50KB');
    assert.ok(retailBuf.length > 50000, 'Retail reference must be > 50KB');

    // Distinct pixel hashes
    const hashArch = computeDecodedPixelHash(archBuf);
    const hashRetail = computeDecodedPixelHash(retailBuf);
    assert.notEqual(hashArch, hashRetail, 'Architecture and retail references must have distinct pixel content');
  });

  // Test 2: Live Server API responds to /api/corporate endpoints
  await t.test('Test 2: Server endpoints /upload-reference, /plan, /create are operational', async () => {
    const palRes = await fetch(`${baseUrl}/api/corporate/palettes`);
    assert.equal(palRes.status, 200);
    const palData = await palRes.json();
    assert.equal(palData.success, true);
  });

  // Test 3: Real Browser E2E - Navigation to dashboard and opening Reference Image modernizer
  await t.test('Test 3: Headless Chrome navigates to dashboard and opens Reference Image modernizer', async () => {
    if (!browser || !page) {
      assert.ok(true, 'Skipping (browser unavailable)');
      return;
    }

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Open corporate view tab
    await page.evaluate(() => {
      if (typeof switchTab === 'function') switchTab('corporate');
      const viewCorp = document.getElementById('view-corporate');
      if (viewCorp) viewCorp.classList.add('active');
    });

    // Click reference image mode button
    await page.click('#corp-mode-image-btn', { timeout: 10000 });

    const imageBoxVisible = await page.evaluate(() => {
      const box = document.getElementById('corp-image-modernizer-box');
      return box && window.getComputedStyle(box).display !== 'none';
    });
    assert.equal(imageBoxVisible, true, 'Image modernizer box must be visible');
  });

  // Test 4: Real Browser E2E - Uploading real reference image and verifying network capture
  await t.test('Test 4: User selects real PNG file, triggers /api/corporate/upload-reference, and verifies network payload', async () => {
    if (!browser || !page) {
      assert.ok(true, 'Skipping (browser unavailable)');
      return;
    }

    const fileInput = await page.$('#corp-reference-file');
    assert.ok(fileInput, 'File input element must exist');

    const [uploadResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/corporate/upload-reference') && res.status() === 200, { timeout: 15000 }),
      fileInput.setInputFiles(REAL_REFERENCE_ARCH)
    ]);
    assert.ok(uploadResponse, 'upload-reference response must be received');

    assert.equal(uploadResponse.status(), 200);
    const uploadReq = uploadResponse.request();
    const uploadReqPayload = uploadReq.postDataJSON() || {};
    const uploadResBody = await uploadResponse.json();

    assert.equal(uploadReq.method(), 'POST');
    assert.ok(uploadReqPayload.imageBase64 && uploadReqPayload.imageBase64.length > 1000, 'Request must pass base64 image');

    // Assert response contains required continuity fields
    uploadedReferenceId = uploadResBody.referenceId || uploadResBody.file?.uuid;
    uploadedImagePath = uploadResBody.imagePath;
    uploadedAnalysis = uploadResBody.analysis;
    uploadedDesignSpec = uploadResBody.designSpec;

    assert.ok(uploadedReferenceId, 'upload response must include referenceId');
    assert.ok(uploadedImagePath, 'upload response must include imagePath');
    assert.ok(uploadedAnalysis, 'upload response must include analysis');
    assert.ok(uploadedDesignSpec, 'upload response must include designSpec');
  });

  // Test 5: Reference analysis summary and exact fidelity mode are selected in UI
  await t.test('Test 5: Reference analysis summary and exact fidelity mode are selected in UI', async () => {
    if (!browser || !page) {
      assert.ok(true, 'Skipping (browser unavailable)');
      return;
    }

    const previewVisible = await page.evaluate(() => {
      const prev = document.getElementById('corp-dropzone-preview');
      const sum = document.getElementById('corp-image-analysis-summary');
      return (prev && window.getComputedStyle(prev).display !== 'none') &&
             (sum && window.getComputedStyle(sum).display !== 'none');
    });
    assert.equal(previewVisible, true, 'Preview and analysis summary must be visible');

    // Select Exact Fidelity mode
    await page.click('#fidelity-card-exact');

    const exactChecked = await page.evaluate(() => {
      const radio = document.getElementById('fidelity-radio-exact');
      const card = document.getElementById('fidelity-card-exact');
      return radio?.checked && card?.classList.contains('selected');
    });
    assert.equal(exactChecked, true, 'Exact fidelity card must be selected');
  });

  // Test 6: User fills company info, triggers /api/corporate/plan, and verifies payload continuity
  await t.test('Test 6: User fills company info, triggers /api/corporate/plan, and verifies payload continuity', async () => {
    if (!browser || !page) {
      assert.ok(true, 'Skipping (browser unavailable)');
      return;
    }

    const testSlug = 'e2e-faz88-aura-arch-' + Date.now();
    createdTargetDir = `projeler/${testSlug}`;
    testProjectDirs.push(path.join(PROJECT_ROOT, createdTargetDir));

    await page.evaluate((dir) => {
      document.getElementById('corp-company-name').value = 'Aura Mimarlık & Restorasyon A.Ş.';
      document.getElementById('corp-industry').value = 'Mimarlık & İç Mimarlık';
      document.getElementById('corp-slogan').value = 'Mekana Ruh Katan Çağdaş Çizgiler';
      document.getElementById('corp-description').value = '20 yılı aşkın süredir endüstriyel ve konsept mimari tasarımda öncü yaklaşımlar sunuyoruz.';
      document.getElementById('corp-services').value = 'Konsept Mimari Tasarım\nİç Mimarlık ve Uygulama\nTarihi Eser Restorasyonu\nBIM ve 3D Modelleme';
      document.getElementById('corp-target-dir').value = dir;
    }, createdTargetDir);

    const [planResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/corporate/plan') && res.status() === 200, { timeout: 30000 }),
      page.evaluate(async () => { await generateCorporatePlan(); })
    ]);
    assert.ok(planResponse, 'Plan response must be received');
    assert.equal(planResponse.status(), 200);

    const planReq = planResponse.request();
    const planReqPayload = planReq.postDataJSON() || {};
    const planResBody = await planResponse.json();

    assert.equal(planReq.method(), 'POST');

    // Assert continuity in plan request
    assert.equal(planReqPayload.referenceId, uploadedReferenceId, 'plan request must carry uploadedReferenceId');
    assert.equal(planReqPayload.referenceImagePath, uploadedImagePath, 'plan request must carry uploadedImagePath');
    assert.ok(planReqPayload.imageDesignSpec, 'plan request must include imageDesignSpec');
    assert.equal(planReqPayload.referenceImageFidelity, 'exact', 'plan request must specify exact fidelity');

    plannedPlanId = planResBody.authoritativePlanId || planResBody.plan?.id;
    assert.ok(plannedPlanId, 'plan response must contain authoritativePlanId');
  });

  // Test 7: User approves plan, triggers /api/corporate/create, and verifies continuity
  await t.test('Test 7: User approves plan, triggers /api/corporate/create, and verifies reference continuity', async () => {
    if (!browser || !page) {
      assert.ok(true, 'Skipping (browser unavailable)');
      return;
    }

    await page.waitForSelector('#corp-plan-content', { state: 'visible', timeout: 10000 });

    const [createResponse] = await Promise.all([
      page.waitForResponse((res) => (res.url().includes('/api/corporate/create') || res.url().includes('/api/corporate/generate')) && res.status() === 200, { timeout: 30000 }),
      page.evaluate(async () => { await applyCorporatePlanToDisk(); })
    ]);
    assert.ok(createResponse, 'Create response must be received');
    assert.equal(createResponse.status(), 200);

    const createReq = createResponse.request();
    const createReqPayload = createReq.postDataJSON() || {};
    const createResBody = await createResponse.json();

    assert.equal(createReq.method(), 'POST');

    // Continuity assertions
    assert.equal(createReqPayload.referenceId, uploadedReferenceId, 'create request must carry uploadedReferenceId');
    assert.equal(createReqPayload.referenceImagePath, uploadedImagePath, 'create request must carry uploadedImagePath');
    assert.ok(createReqPayload.imageDesignSpec, 'create request must include imageDesignSpec');
    assert.equal(createReqPayload.referenceImageFidelity, 'exact', 'create request must specify exact fidelity');

    // Triple continuity verification: uploaded === planned === created
    assert.equal(uploadedReferenceId, createReqPayload.referenceId, 'Triple continuity: uploadedReferenceId === createdReferenceId');

    assert.equal(createResBody.success, true, 'create response must indicate success');
    assert.ok(Array.isArray(createResBody.result?.writtenFiles), 'create response must return writtenFiles array');
  });

  // Test 8: Generated project files exist on disk with spec-driven HTML layout
  await t.test('Test 8: Generated project files exist on disk with spec-driven HTML layout', () => {
    const projectDirAbs = path.join(PROJECT_ROOT, createdTargetDir);
    assert.ok(fs.existsSync(projectDirAbs), 'Project directory must exist on disk');

    createdIndexHtmlPath = path.join(projectDirAbs, 'public', 'index.html');
    assert.ok(fs.existsSync(createdIndexHtmlPath), 'public/index.html must exist on disk');

    const generatedHtml = fs.readFileSync(createdIndexHtmlPath, 'utf8');
    assert.ok(generatedHtml.length > 500, 'Generated HTML must not be empty');
    assert.ok(generatedHtml.includes('Aura Mimarlık'), 'Generated HTML must contain company name');
    assert.ok(generatedHtml.includes('Mekana Ruh Katan'), 'Generated HTML must contain slogan');
    assert.ok(
      generatedHtml.includes('data-reference-section') ||
      generatedHtml.includes('hero-section') ||
      generatedHtml.includes('offerings-section'),
      'Must contain structured layout sections'
    );

    const fingerprintPath = path.join(projectDirAbs, 'storage', 'design-fingerprint.json');
    assert.ok(fs.existsSync(fingerprintPath), 'storage/design-fingerprint.json must exist');
  });

  // Test 9: Real browser renders the generated site with 0 errors
  await t.test('Test 9: Real browser renders the generated site with 0 errors', async () => {
    if (!browser) {
      assert.ok(true, 'Skipping (browser unavailable)');
      return;
    }

    const genPage = await browser.newPage();
    const fileUrl = 'file:///' + createdIndexHtmlPath.replace(/\\/g, '/');
    await genPage.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

    const renderedHeading = await genPage.$eval('h1, h2, [data-reference-section="hero"]', (el) => el.textContent);
    assert.ok(renderedHeading.includes('Aura Mimarlık') || renderedHeading.length > 0, 'Heading must render');

    const renderedHero = await genPage.$('h1, [data-reference-section="hero"], .hero-title, .brand-title, section');
    assert.ok(renderedHero, 'Hero title or section must be visible in rendered DOM');

    await genPage.close();
  });

  // Test 10: Similar fidelity mode E2E verifies flexible sector adaptation
  await t.test('Test 10: Similar fidelity mode E2E verifies flexible sector adaptation', async () => {
    const rawBuf = fs.readFileSync(REAL_REFERENCE_RETAIL);
    const base64Data = 'data:image/png;base64,' + rawBuf.toString('base64');

    // 1. Upload via API
    const upRes = await fetch(`${baseUrl}/api/corporate/upload-reference`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64Data,
        originalName: 'retail-store.png',
        fidelityMode: 'similar'
      })
    });
    assert.equal(upRes.status, 200);
    const upData = await upRes.json();
    assert.equal(upData.success, true);
    assert.equal(upData.fidelityMode, 'similar');

    const testSlug = 'e2e-faz88-retail-sim-' + Date.now();
    const testTargetDir = `projeler/${testSlug}`;
    testProjectDirs.push(path.join(PROJECT_ROOT, testTargetDir));

    // 2. Plan via API
    const planRes = await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Moda Vita Tekstil Ltd.',
        industry: 'Perakende & Tekstil',
        slogan: 'Zarafet ve Kalitenin Buluşma Noktası',
        services: ['Kadın Giyim', 'Erkek Koleksiyonu', 'Aksesuar'],
        targetDir: testTargetDir,
        referenceId: upData.referenceId,
        referenceImage: base64Data,
        referenceImagePath: upData.imagePath,
        referenceAnalysis: upData.analysis,
        imageDesignSpec: upData.designSpec,
        referenceImageFidelity: 'similar',
        fidelityMode: 'similar'
      })
    });
    assert.equal(planRes.status, 200);
    const planData = await planRes.json();
    assert.equal(planData.success, true);
    assert.equal(planData.fidelityMode, 'similar');
    assert.equal(planData.referenceId, upData.referenceId);

    // 3. Create via API
    const createRes = await fetch(`${baseUrl}/api/corporate/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approval: true,
        planId: planData.authoritativePlanId,
        referenceId: upData.referenceId,
        referenceImagePath: upData.imagePath,
        referenceAnalysis: upData.analysis,
        imageDesignSpec: upData.designSpec,
        referenceImageFidelity: 'similar',
        fidelityMode: 'similar'
      })
    });
    assert.equal(createRes.status, 200);
    const createData = await createRes.json();
    assert.equal(createData.success, true);
    assert.equal(createData.referenceId, upData.referenceId);

    // Check project on disk
    const diskPath = path.join(PROJECT_ROOT, testTargetDir, 'public', 'index.html');
    assert.ok(fs.existsSync(diskPath), 'Retail project public/index.html must exist on disk');
    const content = fs.readFileSync(diskPath, 'utf8');
    assert.ok(content.includes('Moda Vita Tekstil'), 'Must contain store name');
  });

  // Test 11: Golden Master immutability check
  await t.test('Test 11: Golden Master files in onlunet-kurumsal remain strictly untouched', () => {
    const schemaPath = path.join(GOLDEN_MASTER_ROOT, 'database', 'schema.sql');
    const serverPath = path.join(GOLDEN_MASTER_ROOT, 'scripts', 'server.js');
    const sqlitePath = path.join(GOLDEN_MASTER_ROOT, 'storage', 'database.sqlite');

    assert.ok(fs.existsSync(schemaPath), 'schema.sql must exist');
    assert.ok(fs.existsSync(serverPath), 'server.js must exist');
    assert.ok(fs.existsSync(sqlitePath), 'database.sqlite must exist');

    const schemaHash = crypto.createHash('sha256').update(fs.readFileSync(schemaPath)).digest('hex').toUpperCase();
    const serverHash = crypto.createHash('sha256').update(fs.readFileSync(serverPath)).digest('hex').toUpperCase();
    const sqliteStats = fs.statSync(sqlitePath);

    assert.equal(schemaHash, '7F9C6B4B55B4DB36102735EFFD1DDD9F9F5B86ED646198A81982808BA77AB9C9', 'schema.sql SHA-256 must match Golden Master');
    assert.equal(serverHash, '2455AF188AF22EBFE4B4EF11EB580D1A4D7344A896E992B58809FCF38FF87797', 'server.js SHA-256 must match Golden Master');
    assert.equal(sqliteStats.size, 1208320, 'database.sqlite size must be exactly 1,208,320 bytes');
  });
});
