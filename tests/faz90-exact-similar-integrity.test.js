import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const ARTIFACTS_DIR = path.resolve(PROJECT_ROOT, 'artifacts/faz90');

test('FAZ 90 — EXACT VS SIMILAR INTEGRITY SUITE', async (t) => {
  assert.ok(fs.existsSync(ARTIFACTS_DIR), 'artifacts/faz90 directory must exist');

  await t.test('Test 1: Exact mode and Similar mode outputs maintain distinct design tokens and structure', () => {
    const exactDiagPath = path.join(ARTIFACTS_DIR, 'exact/diagnostics.json');
    const simDiagPath = path.join(ARTIFACTS_DIR, 'similar/diagnostics.json');

    assert.ok(fs.existsSync(exactDiagPath), 'exact diagnostics must exist');
    assert.ok(fs.existsSync(simDiagPath), 'similar diagnostics must exist');

    const exactDiag = JSON.parse(fs.readFileSync(exactDiagPath, 'utf8'));
    const simDiag = JSON.parse(fs.readFileSync(simDiagPath, 'utf8'));

    assert.notEqual(
      exactDiag.renderProof.htmlHash,
      simDiag.renderProof.htmlHash,
      'Exact and similar modes must produce distinct HTML outputs'
    );
  });

  await t.test('Test 2: Exact overall visual fidelity meets or exceeds target threshold', () => {
    const convPath = path.join(ARTIFACTS_DIR, 'convergence.json');
    const conv = JSON.parse(fs.readFileSync(convPath, 'utf8'));

    assert.ok(conv.exact.finalOverall >= 0.80, 'Exact overall score must be >= 0.80');
    assert.ok(conv.exact.finalPixelSimilarity >= 0.50, 'Exact pixel similarity must be >= 0.50');
  });
});
