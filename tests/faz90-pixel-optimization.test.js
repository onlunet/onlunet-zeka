import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.resolve(PROJECT_ROOT, 'artifacts/faz90');

test('FAZ 90 — PIXEL OPTIMIZATION SUITE', async (t) => {
  assert.ok(fs.existsSync(ARTIFACTS_DIR), 'artifacts/faz90 directory must exist');

  await t.test('Test 1: Optimization history records monotonic stability across iterative rounds', () => {
    const historyPath = path.join(ARTIFACTS_DIR, 'optimization-history.json');
    assert.ok(fs.existsSync(historyPath), 'optimization-history.json must exist');
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));

    assert.ok(history.rounds && history.rounds.length >= 2, 'Must record multiple rounds');
    assert.ok(history.gain.overallDelta >= 0, 'Overall delta must be non-negative (improved or maintained)');
    assert.ok(history.gain.pixelSimilarityDelta >= 0, 'Pixel similarity delta must be non-negative');
  });

  await t.test('Test 2: Final convergence report contains section pixel error attribution', () => {
    const convPath = path.join(ARTIFACTS_DIR, 'convergence.json');
    assert.ok(fs.existsSync(convPath), 'convergence.json must exist');
    const conv = JSON.parse(fs.readFileSync(convPath, 'utf8'));

    assert.ok(conv.sectionMetrics, 'Section metrics must be present');
    assert.ok(conv.exact.finalOverall >= 0.80, 'Final overall fidelity must meet >= 0.80');
    assert.ok(conv.antiCheat.passed, 'Anti-cheat must pass');
  });
});
