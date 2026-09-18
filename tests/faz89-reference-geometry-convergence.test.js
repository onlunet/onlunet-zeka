import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractReferenceGeometry, computeSectionHeightConvergence, createDefaultGeometrySpec } from '../src/autonomous/reference-geometry-engine.js';
import { analyzeReferenceImage, buildImageDesignSpec } from '../src/autonomous/reference-image-analyzer.js';
import { createCorporateGenerator } from '../src/autonomous/corporate-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REAL_REF_PATH = path.resolve(PROJECT_ROOT, 'storage/reference-uploads/ref_0241d7c9-7ccc-467d-a7ed-0f09ac0baacd.jpeg');

test('FAZ 89 — REFERENCE GEOMETRY CONVERGENCE SUITE', async (t) => {
  assert.ok(fs.existsSync(REAL_REF_PATH), 'Real PetShop reference must exist');
  const refBuf = fs.readFileSync(REAL_REF_PATH);

  await t.test('Test 1: extractReferenceGeometry on real PetShop reference extracts 8 authentic sections', () => {
    const geo = extractReferenceGeometry(refBuf);
    assert.equal(geo.sections.length, 8, 'Must detect exactly 8 canonical sections');
    assert.equal(geo.canvas.width, 1024, 'Width must be 1024');
    assert.equal(geo.canvas.height, 1536, 'Height must be 1536');
    assert.equal(geo.sections[0].type, 'hero');
    assert.equal(geo.sections[0].bounds.height, 183);
    assert.equal(geo.sections[1].type, 'offerings');
    assert.equal(geo.sections[1].bounds.height, 183);
    assert.equal(geo.sections[2].type, 'trust');
    assert.equal(geo.sections[2].bounds.height, 183);
    assert.equal(geo.sections[3].type, 'faq');
    assert.equal(geo.sections[3].bounds.height, 305);
    assert.equal(geo.sections[4].type, 'contact');
    assert.equal(geo.sections[4].bounds.height, 183);
    assert.equal(geo.sections[5].type, 'section-6');
    assert.equal(geo.sections[5].bounds.height, 183);
    assert.equal(geo.sections[6].type, 'section-7');
    assert.equal(geo.sections[6].bounds.height, 244);
    assert.equal(geo.sections[7].type, 'section-8');
    assert.equal(geo.sections[7].bounds.height, 72);
  });

  await t.test('Test 2: analyzeReferenceImage and buildImageDesignSpec preserve 8-section geometry', () => {
    const analysis = analyzeReferenceImage({ imageBuffer: refBuf, notes: 'PetShop reference' });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    assert.ok(spec.geometry, 'Design spec must include geometry');
    assert.equal(spec.geometry.sections.length, 8, 'Design spec geometry must contain 8 sections');
    assert.equal(spec.layout.sections.length, 8, 'Layout sections must mirror the 8 reference sections');
  });

  await t.test('Test 3: corporate generator synthesizes home page with exact 8-section bounded containers', () => {
    const analysis = analyzeReferenceImage({ imageBuffer: refBuf, notes: 'PetShop reference' });
    const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    const generator = createCorporateGenerator();
    const synthesis = generator.synthesizeCorporateProject({
      companyName: 'Gökhan KOÇ PetShop',
      industry: 'PetShop & Hayvan Bakımı',
      slogan: 'Kaliteli Mama & Aksesuar',
      description: 'Balıkesir merkezde premium kedi ve köpek mamaları.',
      address: 'Balıkesir / Türkiye',
      phone: '0532 000 00 00',
      imageDesignSpec: spec,
      referenceAnalysis: analysis,
      fidelityMode: 'exact'
    });

    const homeFile = synthesis.files.find(f => f.path === 'resources/views/frontend/home.php');
    assert.ok(homeFile, 'Home view must exist in synthesis');
    const html = homeFile.content;

    assert.ok(html.includes('data-reference-section="hero"'), 'Hero section present');
    assert.ok(html.includes('data-reference-section="offerings"'), 'Offerings section present');
    assert.ok(html.includes('data-reference-section="trust"'), 'Trust section present');
    assert.ok(html.includes('data-reference-section="faq"'), 'FAQ section present');
    assert.ok(html.includes('data-reference-section="contact"'), 'Contact section present');
    assert.ok(html.includes('data-reference-section="brands"'), 'Brands section present');
    assert.ok(html.includes('data-reference-section="location"'), 'Location section present');
    assert.ok(html.includes('data-reference-section="footer"'), 'Footer section present');

    assert.ok(html.includes('height: 183px'), 'Hero/offerings/trust 183px height style applied');
    assert.ok(html.includes('height: 305px'), 'FAQ 305px height style applied');
    assert.ok(html.includes('height: 244px'), 'Location 244px height style applied');
    assert.ok(html.includes('height: 72px'), 'Footer 72px height style applied');
  });

  await t.test('Test 4: computeSectionHeightConvergence evaluates section height accuracy', () => {
    const refGeo = extractReferenceGeometry(refBuf);
    const domSections = refGeo.sections.map(s => ({
      id: s.id,
      type: s.type,
      bounds: { x: s.bounds.x, y: s.bounds.y, width: s.bounds.width, height: s.bounds.height }
    }));

    const report = computeSectionHeightConvergence(refGeo, domSections);
    assert.equal(report.averageErrorPercent, 0, 'Average height error should be 0% on perfect match');
    assert.equal(report.overallPass10, true, 'Should pass <= 10% threshold');
    assert.equal(report.overallPass5, true, 'Should pass <= 5% threshold');
    assert.equal(report.sections.length, 8, 'Report should contain all 8 sections');
  });
});
