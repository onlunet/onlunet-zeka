import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { calculateCompositeVisualFidelity, extractReferenceGeometry, generateDiffAndOverlay } from '../src/autonomous/reference-geometry-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BASELINE_DIR = path.resolve(PROJECT_ROOT, 'artifacts/faz89/baseline');

test('FAZ 89 — METRIC INTEGRITY & SEPARATION SUITE', async (t) => {
  const refBuf = fs.readFileSync(path.join(BASELINE_DIR, 'reference.png'));
  const genBuf = fs.readFileSync(path.join(BASELINE_DIR, 'generated.png'));

  await t.test('Test 1: Raw Pixel Similarity, Geometry Score, and Composite Overall are distinct metrics', () => {
    const refGeo = extractReferenceGeometry(refBuf);
    const genGeo = extractReferenceGeometry(genBuf);

    const diff = generateDiffAndOverlay({
      referenceBuffer: refBuf,
      generatedBuffer: genBuf,
      matchViewport: true,
      threshold: 0.15
    });

    const fid = calculateCompositeVisualFidelity({
      referenceGeometry: refGeo,
      generatedGeometry: genGeo,
      pixelSimilarity: Math.round(diff.rawPixelSimilarity * 100)
    });

    const rawSim = diff.rawPixelSimilarity;
    const geoScore = fid.visualFidelity.geometry;
    const compScore = fid.visualFidelity.overall;

    assert.ok(typeof rawSim === 'number', 'Raw pixel similarity must be a number');
    assert.ok(typeof geoScore === 'number', 'Geometry score must be a number');
    assert.ok(typeof compScore === 'number', 'Composite score must be a number');

    assert.notEqual(rawSim, compScore, 'Raw pixel similarity must NOT equal composite overall score');
    assert.notEqual(geoScore, compScore, 'Geometry score must NOT equal composite overall score');
  });

  await t.test('Test 2: Metric calculation does not artificially inflate raw pixel similarity to 1.0 on distinct buffers', () => {
    const diff = generateDiffAndOverlay({
      referenceBuffer: refBuf,
      generatedBuffer: genBuf,
      matchViewport: true,
      threshold: 0.15
    });

    assert.ok(diff.rawPixelSimilarity < 0.99, 'Raw pixel similarity on distinct buffers must be < 1.0');
    assert.ok(diff.diffPixels > 0, 'diffPixels must be > 0 on distinct buffers');
  });
});
