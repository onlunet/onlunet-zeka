import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeReferenceImage } from '../src/autonomous/reference-image-analyzer.js';
import { extractReferenceGeometry, calculateCompositeVisualFidelity } from '../src/autonomous/reference-geometry-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REAL_REF_PATH = path.resolve(PROJECT_ROOT, 'storage/reference-uploads/ref_0241d7c9-7ccc-467d-a7ed-0f09ac0baacd.jpeg');

test('FAZ 90 — COLOR CONVERGENCE SUITE', async (t) => {
  assert.ok(fs.existsSync(REAL_REF_PATH), 'Real PetShop reference must exist');
  const refBuf = fs.readFileSync(REAL_REF_PATH);
  const analysis = analyzeReferenceImage({ imageBuffer: refBuf, notes: 'PetShop reference' });

  await t.test('Test 1: Inferred palette contains valid primary, accent, and background tokens', () => {
    assert.ok(analysis.detectedPalette.primary, 'Primary color must exist');
    assert.ok(analysis.detectedPalette.accent, 'Accent color must exist');
    assert.ok(analysis.detectedPalette.bgLight, 'bgLight must exist');
    assert.ok(analysis.detectedPalette.surface, 'Surface color must exist');
    assert.match(analysis.detectedPalette.primary, /^#[0-9a-fA-F]{6}$/, 'Primary must be valid hex');
  });

  await t.test('Test 2: Color fidelity score evaluates theme and surface alignment >= 0.85', () => {
    const geo = extractReferenceGeometry(refBuf);
    const fid = calculateCompositeVisualFidelity({
      referenceGeometry: geo,
      generatedGeometry: geo,
      pixelSimilarity: 56
    });

    assert.ok(fid.visualFidelity.color >= 0.85, 'Color fidelity must be >= 0.85');
  });
});
