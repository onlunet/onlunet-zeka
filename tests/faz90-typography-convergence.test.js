import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractReferenceGeometry, calculateCompositeVisualFidelity } from '../src/autonomous/reference-geometry-engine.js';
import { analyzeReferenceImage, buildImageDesignSpec } from '../src/autonomous/reference-image-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REAL_REF_PATH = path.resolve(PROJECT_ROOT, 'storage/reference-uploads/ref_0241d7c9-7ccc-467d-a7ed-0f09ac0baacd.jpeg');

test('FAZ 90 — TYPOGRAPHY CONVERGENCE SUITE', async (t) => {
  assert.ok(fs.existsSync(REAL_REF_PATH), 'Real PetShop reference must exist');
  const refBuf = fs.readFileSync(REAL_REF_PATH);
  const analysis = analyzeReferenceImage({ imageBuffer: refBuf, notes: 'PetShop reference' });
  const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });

  await t.test('Test 1: Headline typography scale ratio and font family match design tokens', () => {
    assert.ok(spec.visualStyle.typography.fontFamily, 'Font family must be defined');
    assert.equal(spec.visualStyle.typography.headlineWeight, 800, 'Headline weight in exact mode must be 800');
    assert.ok(spec.visualStyle.typography.scaleRatio >= 1.2, 'Scale ratio must be >= 1.2');
  });

  await t.test('Test 2: Typography fidelity score in composite calculation meets threshold', () => {
    const geo = extractReferenceGeometry(refBuf);
    const fid = calculateCompositeVisualFidelity({
      referenceGeometry: geo,
      generatedGeometry: geo,
      pixelSimilarity: 56
    });

    assert.ok(fid.visualFidelity.typography >= 0.80, 'Typography fidelity score must be >= 0.80');
  });
});
