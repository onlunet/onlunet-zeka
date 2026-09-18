import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeSectionHeightConvergence, extractReferenceGeometry, calculateSectionPixelMetrics } from '../src/autonomous/reference-geometry-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REAL_REF_PATH = path.resolve(PROJECT_ROOT, 'storage/reference-uploads/ref_0241d7c9-7ccc-467d-a7ed-0f09ac0baacd.jpeg');

test('FAZ 90 — SECTION VISUAL CONVERGENCE SUITE', async (t) => {
  assert.ok(fs.existsSync(REAL_REF_PATH), 'Real PetShop reference must exist');
  const refBuf = fs.readFileSync(REAL_REF_PATH);
  const geo = extractReferenceGeometry(refBuf);

  await t.test('Test 1: All 8 sections maintain strict height alignment with <= 5% error target', () => {
    const domSections = geo.sections.map(s => ({
      id: s.id,
      type: s.type,
      bounds: { ...s.bounds }
    }));

    const report = computeSectionHeightConvergence(geo, domSections);
    assert.equal(report.sections.length, 8, 'Must measure all 8 sections');
    assert.equal(report.overallPass5, true, 'All sections must pass <= 5% height error');
    assert.equal(report.averageErrorPercent, 0, 'Average height error must be 0% on matching geometry');
  });

  await t.test('Test 2: Section bounds match reference layout hierarchy without cumulative vertical drift', () => {
    let accumulatedY = 0;
    for (const sec of geo.sections) {
      assert.equal(sec.bounds.y, accumulatedY, `Section ${sec.id} start Y must equal accumulated Y (${accumulatedY})`);
      accumulatedY += sec.bounds.height;
    }
    assert.equal(accumulatedY, 1536, 'Total accumulated height must match canvas 1536px');
  });
});
