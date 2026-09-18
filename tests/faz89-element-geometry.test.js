import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractReferenceGeometry, extractDOMElementGeometry, calculateBoxIoU } from '../src/autonomous/reference-geometry-engine.js';
import { analyzeReferenceImage, buildImageDesignSpec } from '../src/autonomous/reference-image-analyzer.js';
import { createCorporateGenerator } from '../src/autonomous/corporate-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REAL_REF_PATH = path.resolve(PROJECT_ROOT, 'storage/reference-uploads/ref_0241d7c9-7ccc-467d-a7ed-0f09ac0baacd.jpeg');

test('FAZ 89 — ELEMENT GEOMETRY & BOUNDING BOX SUITE', async (t) => {
  const refBuf = fs.readFileSync(REAL_REF_PATH);
  const refGeo = extractReferenceGeometry(refBuf);

  await t.test('Test 1: Reference elements model contains hero_headline and cta_button', () => {
    assert.ok(refGeo.elements && refGeo.elements.length >= 2, 'Elements must contain key semantic roles');
    const headline = refGeo.elements.find(e => e.role === 'hero_headline');
    const cta = refGeo.elements.find(e => e.role === 'cta_button');
    assert.ok(headline, 'Hero headline element must exist');
    assert.ok(cta, 'Hero CTA element must exist');
    assert.equal(headline.sectionId, 'sec-hero');
    assert.equal(cta.sectionId, 'sec-hero');
  });

  await t.test('Test 2: Corporate generator renders data-reference-role attributes on child elements', () => {
    const analysis = analyzeReferenceImage({ imageBuffer: refBuf, notes: 'PetShop reference' });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    const generator = createCorporateGenerator();
    const synthesis = generator.synthesizeCorporateProject({
      companyName: 'Gökhan KOÇ PetShop',
      industry: 'PetShop & Hayvan Bakımı',
      slogan: 'Kaliteli Mama & Aksesuar',
      description: 'Balıkesir merkezde premium pet ürünleri.',
      imageDesignSpec: spec,
      referenceAnalysis: analysis,
      fidelityMode: 'exact'
    });

    const homeFile = synthesis.files.find(f => f.path === 'resources/views/frontend/home.php');
    const html = homeFile.content;

    assert.ok(html.includes('data-reference-role="hero_headline"'), 'Headline role present');
    assert.ok(html.includes('data-reference-role="cta_button"'), 'CTA button role present');
    assert.ok(html.includes('data-reference-role="card_item"'), 'Card items role present');
    assert.ok(html.includes('data-reference-role="trust_stat"'), 'Trust stat role present');
    assert.ok(html.includes('data-reference-role="faq_item"'), 'FAQ items role present');
    assert.ok(html.includes('data-reference-role="location_card"'), 'Location card role present');
  });

  await t.test('Test 3: calculateBoxIoU measures element overlap accurately', () => {
    const boxA = { x: 20, y: 30, width: 500, height: 80 };
    const boxB = { x: 20, y: 30, width: 500, height: 80 };
    assert.equal(calculateBoxIoU(boxA, boxB), 1.0, 'Identical boxes have IoU 1.0');

    const boxC = { x: 20, y: 200, width: 500, height: 80 };
    assert.equal(calculateBoxIoU(boxA, boxC), 0.0, 'Disjoint boxes have IoU 0.0');
  });
});
