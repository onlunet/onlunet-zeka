import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeReferenceImage, buildImageDesignSpec } from '../src/autonomous/reference-image-analyzer.js';
import { createCorporateGenerator } from '../src/autonomous/corporate-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REAL_REF_PATH = path.resolve(PROJECT_ROOT, 'storage/reference-uploads/ref_0241d7c9-7ccc-467d-a7ed-0f09ac0baacd.jpeg');

test('FAZ 89 — EXACT VS SIMILAR SEPARATION SUITE', async (t) => {
  const refBuf = fs.readFileSync(REAL_REF_PATH);
  const analysis = analyzeReferenceImage({ imageBuffer: refBuf, notes: 'PetShop reference' });

  await t.test('Test 1: Exact mode generates faithful mirror spec while Similar introduces controlled adaptation', () => {
    const exactSpec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    const similarSpec = buildImageDesignSpec({ analysis, fidelityMode: 'similar' });

    assert.equal(exactSpec.fidelityMode, 'exact');
    assert.equal(similarSpec.fidelityMode, 'similar');
    assert.equal(exactSpec.visualStyle.borderRadius.button, '8px');
    assert.equal(similarSpec.visualStyle.borderRadius.button, '9999px');
  });

  await t.test('Test 2: Exact and Similar synthesized home views produce distinct styling and DOM tokens', () => {
    const generator = createCorporateGenerator();

    const exactSpec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    const similarSpec = buildImageDesignSpec({ analysis, fidelityMode: 'similar' });

    const synExact = generator.synthesizeCorporateProject({
      companyName: 'Gökhan KOÇ PetShop',
      industry: 'PetShop & Hayvan Bakımı',
      imageDesignSpec: exactSpec,
      referenceAnalysis: analysis,
      fidelityMode: 'exact'
    });

    const synSimilar = generator.synthesizeCorporateProject({
      companyName: 'Gökhan KOÇ PetShop',
      industry: 'PetShop & Hayvan Bakımı',
      imageDesignSpec: similarSpec,
      referenceAnalysis: analysis,
      fidelityMode: 'similar'
    });

    const exactHtml = synExact.files.find(f => f.path === 'resources/views/frontend/home.php').content;
    const similarHtml = synSimilar.files.find(f => f.path === 'resources/views/frontend/home.php').content;

    assert.notEqual(exactHtml, similarHtml, 'Exact and Similar HTML must be structurally and stylistically distinct');
    assert.ok(exactHtml.includes('border-radius: 8px'), 'Exact uses 8px button radius');
    assert.ok(similarHtml.includes('border-radius: 9999px'), 'Similar uses 9999px pill button radius');
  });
});
