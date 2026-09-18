import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { analyzeReferenceImage, buildImageDesignSpec } from '../src/autonomous/reference-image-analyzer.js';
import { createCorporateGenerator } from '../src/autonomous/corporate-generator.js';
import { computeDecodedPixelHash } from '../src/autonomous/reference-geometry-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REAL_REF_PATH = path.resolve(PROJECT_ROOT, 'storage/reference-uploads/ref_0241d7c9-7ccc-467d-a7ed-0f09ac0baacd.jpeg');

test('FAZ 89 — ANTI-CHEAT & SECURITY INTEGRITY SUITE', async (t) => {
  const refBuf = fs.readFileSync(REAL_REF_PATH);
  const refFileName = path.basename(REAL_REF_PATH);
  const refSha256 = crypto.createHash('sha256').update(refBuf).digest('hex');

  const analysis = analyzeReferenceImage({ imageBuffer: refBuf, notes: 'PetShop reference' });
  const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
  const generator = createCorporateGenerator();
  const synthesis = generator.synthesizeCorporateProject({
    companyName: 'Gökhan KOÇ PetShop',
    industry: 'PetShop & Hayvan Bakımı',
    imageDesignSpec: spec,
    referenceAnalysis: analysis,
    fidelityMode: 'exact'
  });

  await t.test('Test 1: Reference file name does not leak into generated files', () => {
    for (const f of synthesis.files) {
      assert.ok(!f.content.includes(refFileName), `File ${f.path} must not contain reference file name`);
    }
  });

  await t.test('Test 2: Reference binary data is not base64 encoded into HTML/CSS', () => {
    const base64Prefix = refBuf.toString('base64').substring(0, 64);
    for (const f of synthesis.files) {
      assert.ok(!f.content.includes(base64Prefix), `File ${f.path} must not contain base64 encoded reference binary`);
    }
  });

  await t.test('Test 3: No CSS background-image reference screenshot injection', () => {
    for (const f of synthesis.files) {
      assert.ok(!f.content.includes('background-image: url(' + refFileName), `File ${f.path} must not use reference as background`);
    }
  });

  await t.test('Test 4: Golden Master immutability is strictly maintained', () => {
    function hash(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase(); }
    const schemaHash = hash(path.resolve(PROJECT_ROOT, '../onlunet-kurumsal/database/schema.sql'));
    const serverHash = hash(path.resolve(PROJECT_ROOT, '../onlunet-kurumsal/scripts/server.js'));
    const sqliteSize = fs.statSync(path.resolve(PROJECT_ROOT, '../onlunet-kurumsal/storage/database.sqlite')).size;

    assert.equal(schemaHash, '7F9C6B4B55B4DB36102735EFFD1DDD9F9F5B86ED646198A81982808BA77AB9C9');
    assert.equal(serverHash, '2455AF188AF22EBFE4B4EF11EB580D1A4D7344A896E992B58809FCF38FF87797');
    assert.equal(sqliteSize, 1208320);
  });
});
