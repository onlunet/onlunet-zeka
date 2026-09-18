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

test('FAZ 89 — VISUAL CONVERGENCE & FIDELITY SUITE', async (t) => {
  assert.ok(fs.existsSync(BASELINE_DIR), 'Baseline artifacts directory must exist');

  await t.test('Test 1: Dondurulan FAZ 88.3 baseline metrikleri doğrulanır', () => {
    const metricsPath = path.join(BASELINE_DIR, 'metrics.json');
    assert.ok(fs.existsSync(metricsPath), 'metrics.json must exist in baseline');
    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    assert.equal(metrics.baselineScores.geometry, 0.245);
    assert.equal(metrics.baselineScores.structure, 0.75);
    assert.equal(metrics.baselineScores.pixelSimilarity, 0.519);
    assert.equal(metrics.baselineScores.overall, 0.756);
  });

  await t.test('Test 2: Perfect geometry alignment drives composite fidelity above target threshold', () => {
    const refBuf = fs.readFileSync(path.join(BASELINE_DIR, 'reference.png'));
    const refGeo = extractReferenceGeometry(refBuf);
    const domSections = refGeo.sections.map(s => ({
      id: s.id,
      type: s.type,
      bounds: { ...s.bounds }
    }));
    const genGeo = { ...refGeo, sections: domSections };

    const fid = calculateCompositeVisualFidelity({
      referenceGeometry: refGeo,
      generatedGeometry: genGeo,
      pixelSimilarity: 56
    });

    assert.ok(fid.visualFidelity.geometry >= 0.40, 'Geometry score must be >= 0.40');
    assert.ok(fid.visualFidelity.structure >= 0.80, 'Structure score must be >= 0.80');
    assert.ok(fid.visualFidelity.overall >= 0.78, 'Overall fidelity must be >= 0.78');
  });

  await t.test('Test 3: Raw pixel similarity computation does not artificially clip or mask pixels', () => {
    const refBuf = fs.readFileSync(path.join(BASELINE_DIR, 'reference.png'));
    const genBuf = fs.readFileSync(path.join(BASELINE_DIR, 'generated.png'));

    const diff = generateDiffAndOverlay({
      referenceBuffer: refBuf,
      generatedBuffer: genBuf,
      matchViewport: true,
      threshold: 0.15
    });

    assert.equal(diff.totalPixels, 1024 * 1536, 'Full canvas 1,572,864 pixels must be evaluated');
    assert.ok(diff.diffPixels > 0, 'Must have realistic diff pixel count');
    assert.ok(diff.rawPixelSimilarity > 0.50, 'Raw pixel similarity must be measured accurately');
  });
});
