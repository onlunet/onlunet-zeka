import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeReferenceImage } from '../src/autonomous/reference-image-analyzer.js';
import { extractReferenceGeometry } from '../src/autonomous/reference-geometry-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REAL_REF_PATH = path.resolve(PROJECT_ROOT, 'storage/reference-uploads/ref_0241d7c9-7ccc-467d-a7ed-0f09ac0baacd.jpeg');

test('FAZ 90 — REFERENCE VISUAL ANALYSIS SUITE', async (t) => {
  assert.ok(fs.existsSync(REAL_REF_PATH), 'Real PetShop reference must exist');
  const refBuf = fs.readFileSync(REAL_REF_PATH);

  await t.test('Test 1: Visual density extraction returns bounded metrics with confidence scores', () => {
    const analysis = analyzeReferenceImage({ imageBuffer: refBuf, notes: 'PetShop reference' });
    assert.ok(analysis.visualDensityMetrics, 'visualDensityMetrics must be present');
    const vdm = analysis.visualDensityMetrics;

    assert.ok(vdm.content_density.value >= 0 && vdm.content_density.value <= 1.0, 'content_density must be in [0, 1]');
    assert.ok(vdm.content_density.confidence >= 0.70, 'content_density confidence must be >= 0.70');

    assert.ok(vdm.image_density.value >= 0 && vdm.image_density.value <= 1.0, 'image_density must be in [0, 1]');
    assert.ok(vdm.image_density.confidence >= 0.70, 'image_density confidence must be >= 0.70');

    assert.ok(vdm.text_density.value >= 0 && vdm.text_density.value <= 1.0, 'text_density must be in [0, 1]');
    assert.ok(vdm.text_density.confidence >= 0.70, 'text_density confidence must be >= 0.70');

    assert.ok(vdm.whitespace_ratio.value >= 0 && vdm.whitespace_ratio.value <= 1.0, 'whitespace_ratio must be in [0, 1]');
    assert.ok(vdm.whitespace_ratio.confidence >= 0.70, 'whitespace_ratio confidence must be >= 0.70');

    assert.ok(typeof vdm.horizontal_alignment.value === 'string', 'horizontal_alignment must be string');
    assert.ok(typeof vdm.vertical_alignment.value === 'string', 'vertical_alignment must be string');
  });

  await t.test('Test 2: Semantic palette extraction produces full color bindings', () => {
    const analysis = analyzeReferenceImage({ imageBuffer: refBuf, notes: 'PetShop reference' });
    assert.ok(analysis.semanticPalette, 'semanticPalette must be present');
    const sp = analysis.semanticPalette;

    assert.ok(sp['--color-bg-primary'], '--color-bg-primary must exist');
    assert.ok(sp['--color-bg-secondary'], '--color-bg-secondary must exist');
    assert.ok(sp['--color-text-primary'], '--color-text-primary must exist');
    assert.ok(sp['--color-text-secondary'], '--color-text-secondary must exist');
    assert.ok(sp['--color-brand'], '--color-brand must exist');
    assert.ok(sp['--color-accent'], '--color-accent must exist');
    assert.ok(sp['--color-border'], '--color-border must exist');
  });

  await t.test('Test 3: Element bounding boxes have roles, relative coordinates, and confidence', () => {
    const geo = extractReferenceGeometry(refBuf);
    assert.ok(geo.elements && geo.elements.length > 0, 'Geometry elements must not be empty');

    for (const el of geo.elements) {
      assert.ok(el.id, 'Element must have id');
      assert.ok(el.role, 'Element must have role');
      assert.ok(el.bounds, 'Element must have bounds');
      assert.ok(el.relativeBounds, 'Element must have relativeBounds');
      assert.ok(el.confidence === undefined || (el.confidence >= 0 && el.confidence <= 1.0), 'Element confidence must be in [0, 1]');
    }

    const titleEl = geo.elements.find(e => e.role === 'hero_headline');
    assert.ok(titleEl, 'hero_headline element must exist');
    assert.ok(titleEl.confidence >= 0.85, 'hero_headline confidence must be >= 0.85');
  });
});
