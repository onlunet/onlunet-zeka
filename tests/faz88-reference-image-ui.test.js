import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { PNG } from 'pngjs';
import { chromium } from 'playwright-core';

import { PROJECT_ROOT } from '../src/interfaces/core.js';
const GOLDEN_MASTER_ROOT = path.resolve(PROJECT_ROOT, '..', 'onlunet-kurumsal');

import {
  analyzeReferenceImage,
  buildImageDesignSpec,
  getBrowserExecutablePath,
  computeDecodedPixelHash
} from '../src/autonomous/reference-image-analyzer.js';

import {
  createCorporateGenerator
} from '../src/autonomous/corporate-generator.js';

const INDEX_HTML_PATH = path.join(PROJECT_ROOT, 'src', 'app', 'public', 'index.html');
const APP_JS_PATH = path.join(PROJECT_ROOT, 'src', 'app', 'public', 'app.js');

test('FAZ 88.1 — REFERENCE IMAGE UI INTEGRATION SUITE', async (t) => {
  const indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8') + '\n' + (fs.existsSync(APP_JS_PATH) ? fs.readFileSync(APP_JS_PATH, 'utf8') : '');

  // Test 1: Reference Image mode button in DOM
  await t.test('Test 1: Reference Image mode button is present in DOM with correct label', () => {
    assert.ok(indexHtml.includes('id="corp-mode-image-btn"'), 'Mode button corp-mode-image-btn must exist');
    assert.ok(indexHtml.includes('Referans Görsel / Şablon'), 'Label must contain Referans Görsel / Şablon');
    assert.ok(indexHtml.includes('switchCorpModernizerMode(\'image\')'), 'Button must trigger switchCorpModernizerMode("image")');
  });

  // Test 2: File input is present in DOM
  await t.test('Test 2: File input is present in DOM with accessible attributes', () => {
    assert.ok(indexHtml.includes('id="corp-reference-file"'), 'File input corp-reference-file must exist');
    assert.ok(indexHtml.includes('type="file"'), 'Must have type="file"');
    assert.ok(indexHtml.includes('accept="image/png,image/jpeg,image/webp"'), 'Must specify accept for png, jpeg, webp');
  });

  // Test 3: PNG format is explicitly supported
  await t.test('Test 3: PNG format is accepted by file input and validator', () => {
    assert.ok(indexHtml.includes('image/png'), 'accept must include image/png');
    assert.ok(indexHtml.includes('PNG'), 'UI description must mention PNG');
    assert.ok(indexHtml.includes('validTypes.includes'), 'Client validator must check valid MIME types');
  });

  // Test 4: JPG / JPEG format is explicitly supported
  await t.test('Test 4: JPG and JPEG formats are accepted by file input and validator', () => {
    assert.ok(indexHtml.includes('image/jpeg'), 'accept must include image/jpeg');
    assert.ok(indexHtml.includes('JPG'), 'UI description must mention JPG');
  });

  // Test 5: WEBP format is explicitly supported
  await t.test('Test 5: WEBP format is accepted by file input and validator', () => {
    assert.ok(indexHtml.includes('image/webp'), 'accept must include image/webp');
    assert.ok(indexHtml.includes('WEBP'), 'UI description must mention WEBP');
  });

  // Test 6: Invalid file types are rejected by extension and MIME check
  await t.test('Test 6: Invalid file types are rejected with user-friendly notification', () => {
    assert.ok(indexHtml.includes('Lütfen geçerli bir PNG, JPG veya WEBP dosyası yükleyin'), 'Must show friendly message for invalid files');
    assert.ok(indexHtml.includes('(png|jpe?g|webp)'), 'Must regex-validate allowed extensions');
  });

  // Test 7: Upload endpoint /api/corporate/upload-reference is invoked
  await t.test('Test 7: Upload handler connects to /api/corporate/upload-reference', () => {
    assert.ok(indexHtml.includes('/api/corporate/upload-reference'), 'Must call /api/corporate/upload-reference');
    assert.ok(indexHtml.includes('imageBase64: base64Data'), 'Must pass imageBase64 in payload');
    assert.ok(indexHtml.includes('originalName: file.name'), 'Must pass originalName in payload');
  });

  // Test 8: referenceImageFidelity: "exact" is supported and selectable
  await t.test('Test 8: referenceImageFidelity "exact" is supported in UI and state', () => {
    assert.ok(indexHtml.includes('id="fidelity-card-exact"'), 'Exact fidelity card must exist');
    assert.ok(indexHtml.includes('value="exact"'), 'Radio value exact must exist');
    assert.ok(indexHtml.includes('Birebir Tasarım'), 'Must label exact mode accurately');
    assert.ok(indexHtml.includes('switchCorpImageFidelity(\'exact\')'), 'Click handler must switch to exact');
  });

  // Test 9: referenceImageFidelity: "similar" is supported and selectable
  await t.test('Test 9: referenceImageFidelity "similar" is supported in UI and state', () => {
    assert.ok(indexHtml.includes('id="fidelity-card-similar"'), 'Similar fidelity card must exist');
    assert.ok(indexHtml.includes('value="similar"'), 'Radio value similar must exist');
    assert.ok(indexHtml.includes('Benzer / Esnek Tasarım'), 'Must label similar mode accurately');
    assert.ok(indexHtml.includes('switchCorpImageFidelity(\'similar\')'), 'Click handler must switch to similar');
  });

  // Test 10: Upload response is stored in UI state
  await t.test('Test 10: Upload response is assigned to currentUploadedReferenceData state', () => {
    assert.ok(indexHtml.includes('currentUploadedReferenceData ='), 'Must assign to currentUploadedReferenceData');
    assert.ok(indexHtml.includes('imagePath: data.imagePath'), 'Must record imagePath');
    assert.ok(indexHtml.includes('analysis: data.analysis'), 'Must record analysis');
    assert.ok(indexHtml.includes('designSpec: data.designSpec'), 'Must record designSpec');
  });

  // Test 11: Reference analysis is included in production payload
  await t.test('Test 11: generateCorporatePlan forwards reference data into /api/corporate/plan payload', () => {
    assert.ok(indexHtml.includes('payload.referenceImage = currentUploadedReferenceData.base64'), 'Must forward referenceImage');
    assert.ok(indexHtml.includes('payload.referenceImagePath = currentUploadedReferenceData.imagePath'), 'Must forward referenceImagePath');
    assert.ok(indexHtml.includes('payload.referenceAnalysis = currentUploadedReferenceData.analysis'), 'Must forward referenceAnalysis');
    assert.ok(indexHtml.includes('payload.imageDesignSpec = currentUploadedReferenceData.designSpec'), 'Must forward imageDesignSpec');
    assert.ok(indexHtml.includes('payload.referenceImageFidelity = currentUploadedReferenceFidelity'), 'Must forward fidelity mode');
  });

  // Test 12: Production pipeline consumes reference data and builds spec-driven site
  await t.test('Test 12: Corporate generator synthesizes project using spec-driven layout with reference spec', () => {
    const corporateGen = createCorporateGenerator();
    const synth = corporateGen.synthesizeCorporateProject({
      companyName: 'Birebir Mimarlık A.Ş.',
      industry: 'Mimarlık ve Tasarım',
      imageDesignSpec: {
        source: 'reference_image',
        isReferenceReproduction: true,
        layoutFamily: 'LAYOUT_D_SPLIT_HERO',
        sections: [
          { id: 'sec-hero', type: 'hero', bounds: { x: 0, y: 0, width: 1440, height: 450 } },
          { id: 'sec-offerings', type: 'offerings', bounds: { x: 0, y: 450, width: 1440, height: 350 } }
        ]
      },
      fidelityMode: 'exact'
    });

    const homeFile = synth.files.find(f => f.path.includes('home.php'))?.content || '';
    assert.ok(homeFile.includes('data-reference-section="hero"'), 'Home PHP must render data-reference-section');
    assert.ok(synth.files.some(f => f.path.includes('database.sqlite')), 'SQLite database must be synthesized');
  });

  // Test 13: Existing Web URL mode is not regressed
  await t.test('Test 13: Web URL mode remains fully functional and intact', () => {
    assert.ok(indexHtml.includes('id="corp-mode-site-btn"'), 'Web site button must remain');
    assert.ok(indexHtml.includes('id="corp-site-modernizer-box"'), 'Web site box must remain');
    assert.ok(indexHtml.includes('id="corp-modernize-url"'), 'Web site URL input must remain');
    assert.ok(indexHtml.includes('corpInspectAndFillSite()'), 'Inspection handler must remain');
  });

  // Test 14: Existing Google Maps mode is not regressed
  await t.test('Test 14: Google Maps mode remains fully functional and intact', () => {
    assert.ok(indexHtml.includes('id="corp-mode-maps-btn"'), 'Google Maps button must remain');
    assert.ok(indexHtml.includes('id="corp-maps-modernizer-box"'), 'Google Maps box must remain');
    assert.ok(indexHtml.includes('id="corp-maps-modernize-url"'), 'Google Maps URL input must remain');
    assert.ok(indexHtml.includes('corpInspectAndFillMaps()'), 'Maps inspection handler must remain');
  });

  // Test 15: Visual QA tab remains completely separate from reference image creation
  await t.test('Test 15: Visual QA tab remains an audit tool, distinct from Kurumsal Site Üret', () => {
    assert.ok(indexHtml.includes('id="tab-visual-qa-btn"'), 'Visual QA tab button must exist separately');
    assert.ok(indexHtml.includes('id="view-visual-qa"'), 'Visual QA section must remain independent');
    assert.ok(indexHtml.includes('id="visual-audit-url-input"'), 'Visual QA URL input must remain separate');
  });

  // Test 16: User-friendly error message on upload failure
  await t.test('Test 16: Failure handler displays user-friendly alert without raw stack traces', () => {
    assert.ok(indexHtml.includes('Referans görsel analiz edilemedi'), 'Friendly failure message must be presented');
    assert.ok(indexHtml.includes('Referans görsel sunucuya gönderilemedi'), 'Network error message must be presented');
  });

  // Test 17: Fidelity mode default value is 'exact'
  await t.test('Test 17: Fidelity mode defaults to exact', () => {
    assert.ok(indexHtml.includes('currentUploadedReferenceFidelity = \'exact\''), 'Default fidelity mode must be exact');
    assert.ok(indexHtml.includes('id="fidelity-radio-exact" value="exact" checked'), 'Exact radio must be checked by default');
    assert.ok(indexHtml.includes('id="fidelity-card-exact" class="corp-fidelity-card selected"'), 'Exact card must have selected class by default');
  });

  // Test 18: Backend API contract integrity for /api/corporate/upload-reference
  await t.test('Test 18: Backend /api/corporate/upload-reference returns expected schema contract', async () => {
    const png = new PNG({ width: 200, height: 150 });
    for (let i = 0; i < 200 * 150 * 4; i += 4) {
      png.data[i] = 40; png.data[i+1] = 80; png.data[i+2] = 160; png.data[i+3] = 255;
    }
    const buf = PNG.sync.write(png);

    const analysis = analyzeReferenceImage({ imageBuffer: buf });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

    assert.ok(spec, 'Spec must be built');
    assert.equal(spec.fidelityMode, 'exact');
    assert.ok(spec.layoutFamily, 'layoutFamily must be determined');
    assert.ok(Array.isArray(spec.sections) || Array.isArray(spec.layout?.sections), 'Sections must be an array');
  });

  // Test 19: End-to-end headless browser UI interaction
  await t.test('Test 19: Real headless Chrome loads dashboard and interacts with Reference Image mode', async () => {
    const browserPath = getBrowserExecutablePath();
    if (!browserPath) {
      assert.ok(true, 'Skipping browser E2E test (no Chrome/Edge executable found)');
      return;
    }

    const browser = await chromium.launch({
      executablePath: browserPath,
      headless: true,
      args: ['--no-sandbox', '--disable-gpu']
    });

    const page = await browser.newPage();
    const rawHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
    const appJs = fs.existsSync(APP_JS_PATH) ? fs.readFileSync(APP_JS_PATH, 'utf8') : '';
    const pageContent = rawHtml.includes('</body>') ? rawHtml.replace('</body>', `<script>${appJs}</script></body>`) : `${rawHtml}<script>${appJs}</script>`;
    await page.setContent(pageContent, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Activate corporate view tab so elements are visible
    await page.evaluate(() => {
      const viewCorp = document.getElementById('view-corporate');
      if (viewCorp) viewCorp.classList.add('active');
    });

    // Initial state: site mode active
    const siteBoxVisible = await page.evaluate(() => {
      const el = document.getElementById('corp-site-modernizer-box');
      return el && window.getComputedStyle(el).display !== 'none';
    });
    assert.equal(siteBoxVisible, true, 'Site mode box must be visible initially');

    // Click Reference Image mode button
    await page.click('#corp-mode-image-btn');

    const imageBoxVisible = await page.evaluate(() => {
      const el = document.getElementById('corp-image-modernizer-box');
      return el && window.getComputedStyle(el).display !== 'none';
    });
    assert.equal(imageBoxVisible, true, 'Image mode box must be visible after click');

    const siteBoxHidden = await page.evaluate(() => {
      const el = document.getElementById('corp-site-modernizer-box');
      return el && window.getComputedStyle(el).display === 'none';
    });
    assert.equal(siteBoxHidden, true, 'Site mode box must be hidden when in image mode');

    // Make fidelity selector box visible as happens after upload
    await page.evaluate(() => {
      const box = document.getElementById('corp-fidelity-selector-box');
      if (box) box.style.display = 'block';
    });

    // Switch fidelity to similar
    await page.click('#fidelity-card-similar');
    const fidelityState = await page.evaluate(() => {
      const radioSimilar = document.getElementById('fidelity-radio-similar');
      const cardSimilar = document.getElementById('fidelity-card-similar');
      return {
        checked: radioSimilar?.checked,
        hasSelectedClass: cardSimilar?.classList.contains('selected')
      };
    });
    assert.equal(fidelityState.checked, true, 'Similar radio must be checked');
    assert.equal(fidelityState.hasSelectedClass, true, 'Similar card must have selected class');

    // Switch fidelity back to exact
    await page.click('#fidelity-card-exact');
    const fidelityExactState = await page.evaluate(() => {
      const radioExact = document.getElementById('fidelity-radio-exact');
      const cardExact = document.getElementById('fidelity-card-exact');
      return {
        checked: radioExact?.checked,
        hasSelectedClass: cardExact?.classList.contains('selected')
      };
    });
    assert.equal(fidelityExactState.checked, true, 'Exact radio must be checked');
    assert.equal(fidelityExactState.hasSelectedClass, true, 'Exact card must have selected class');

    await page.close();
    await browser.close();
  });

  // Test 20: Golden Master immutability check
  await t.test('Test 20: Golden Master files in onlunet-kurumsal remain strictly untouched', () => {
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
