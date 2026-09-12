/**
 * ONLUNET ZEKA — Controlled Visual Refactoring & Token Sync Test Suite (FAZ 72)
 * Comprehensive 20-Scenario Contract & Invariant Verification
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import {
  extractTokensFromCss,
  categorizeTokens,
  verifyTokenMatches,
  applyTokenUpdatesToCss,
  RefactoringErrorCodes
} from '../src/autonomous/visual-token-system.js';

import {
  createDesignProposal,
  validateDesignProposal,
  ALLOWED_CHANGE_TYPES,
  FORBIDDEN_OPERATIONS,
  ProposalPriority
} from '../src/autonomous/visual-proposal-engine.js';

import {
  mapFindingsToProposals,
  ANTI_AI_REMEDIATION_RULES,
  RemediationActionType
} from '../src/autonomous/visual-remediation-policy.js';

import {
  executeDesignProposal,
  rollbackVisualPatch,
  getAuditLedger,
  resetAuditLedgerForTesting,
  computeContentHash
} from '../src/autonomous/visual-refactoring-engine.js';

import {
  evaluateVisualRegressionPolicy,
  runVisualRegressionCycle
} from '../src/autonomous/visual-regression-loop.js';

import {
  createExecutionAuthorizationContract,
  AuthorizationDecision
} from '../src/contracts/execution-authorization.js';

import { analyzeScreenshot } from '../src/autonomous/visual-intelligence.js';

describe('ONLUNET ZEKA — Controlled Visual Refactoring & Design System Token Sync (FAZ 72)', () => {
  let tempDir;
  let testCssPath;
  const sampleCss = `
:root {
  --bg-canvas: #07090e;
  --primary: #6366f1;
  --primary-glow: rgba(99, 102, 241, 0.28);
  --text-main: #f8fafc;
  --text-dim: #64748b;
  --radius-sm: 6px;
  --radius-full: 9999px;
  --space-md: 16px;
}

body {
  background: var(--bg-canvas);
  color: var(--text-main);
}
`;

  beforeEach(() => {
    resetAuditLedgerForTesting();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onlunet-refactor-test-'));
    testCssPath = path.join(tempDir, 'styles.css');
    fs.writeFileSync(testCssPath, sampleCss, 'utf8');
  });

  // Helper for valid authorization contract
  function makeValidAuthorization() {
    return createExecutionAuthorizationContract({
      id: `auth-${Date.now()}`,
      requestId: `req-${Date.now()}`,
      taskId: `task-${Date.now()}`,
      planId: `plan-${Date.now()}`,
      admissionId: `adm-${Date.now()}`,
      handoffId: `hand-${Date.now()}`,
      decision: AuthorizationDecision.AUTHORIZED,
      reason: 'Authorized by test suite operator'
    });
  }

  test('1. proposal schema validation (valid proposal accepts normalized schema)', () => {
    const proposal = createDesignProposal({
      proposalId: 'prop-test-01',
      category: 'colorSystem',
      issue: 'Text contrast improvement',
      changes: [
        {
          type: 'color_token_update',
          target: '--text-dim',
          before: '#64748b',
          after: '#94a3b8',
          reason: 'WCAG compliance',
          risk: 'low'
        }
      ]
    });

    assert.equal(validateDesignProposal(proposal), true);
    assert.equal(proposal.proposalOnly, true);
    assert.equal(proposal.executionAuthorized, false);
    assert.equal(proposal.changes.length, 1);
  });

  test('2. invalid proposal rejection (rejects missing fields and empty changes)', () => {
    assert.throws(
      () => validateDesignProposal(null),
      /Proposal must be a non-null object/
    );

    assert.throws(
      () => validateDesignProposal({ proposalId: 'p1' }),
      /Missing required proposal field/
    );

    assert.throws(
      () => createDesignProposal({ changes: [] }),
      /Proposal changes must be a non-empty array/
    );
  });

  test('3. unauthorized execution rejection (rejects missing or denied authorization)', async () => {
    const proposal = createDesignProposal({
      changes: [{ type: 'design_token_update', target: '--text-dim', before: '#64748b', after: '#94a3b8' }]
    });

    // Case A: Missing authorization
    await assert.rejects(
      async () => {
        await executeDesignProposal({
          proposal,
          authorization: null,
          workspaceRoot: tempDir,
          targetFilePath: testCssPath
        });
      },
      /UNAUTHORIZED/
    );

    // Case B: Explicitly denied authorization
    const deniedAuth = createExecutionAuthorizationContract({
      id: 'auth-denied',
      requestId: 'req-1',
      taskId: 'task-1',
      planId: 'plan-1',
      admissionId: 'adm-1',
      handoffId: 'hand-1',
      decision: AuthorizationDecision.DENIED,
      reason: 'Security check failed'
    });

    await assert.rejects(
      async () => {
        await executeDesignProposal({
          proposal,
          authorization: deniedAuth,
          workspaceRoot: tempDir,
          targetFilePath: testCssPath
        });
      },
      /UNAUTHORIZED/
    );
  });

  test('4. arbitrary file modification rejection (rejects non-CSS variable targets)', () => {
    assert.throws(
      () => {
        createDesignProposal({
          changes: [
            {
              type: 'design_token_update',
              target: 'body { display: none; }',
              before: 'a',
              after: 'b'
            }
          ]
        });
      },
      /FORBIDDEN_OPERATION/
    );
  });

  test('5. arbitrary shell command rejection (rejects commands and scripts)', () => {
    assert.throws(
      () => {
        validateDesignProposal({
          proposalId: 'prop-malicious',
          category: 'system',
          issue: 'shell injection',
          proposalOnly: true,
          executionAuthorized: false,
          changes: [
            {
              type: 'shell_execution',
              target: '--primary',
              command: 'rm -rf /'
            }
          ]
        });
      },
      /FORBIDDEN_OPERATION/
    );
  });

  test('6. stale proposal rejection (rejects when before value mismatches target file)', async () => {
    const staleProposal = createDesignProposal({
      changes: [
        {
          type: 'color_token_update',
          target: '--text-dim',
          before: '#000000', // Actual is #64748b
          after: '#ffffff'
        }
      ]
    });

    const auth = makeValidAuthorization();

    await assert.rejects(
      async () => {
        await executeDesignProposal({
          proposal: staleProposal,
          authorization: auth,
          workspaceRoot: tempDir,
          targetFilePath: testCssPath
        });
      },
      /STALE_PROPOSAL/
    );
  });

  test('7. token update execution (safely updates token in target file)', async () => {
    const validProposal = createDesignProposal({
      changes: [
        {
          type: 'color_token_update',
          target: '--text-dim',
          before: '#64748b',
          after: '#94a3b8'
        }
      ]
    });

    const auth = makeValidAuthorization();
    const result = await executeDesignProposal({
      proposal: validProposal,
      authorization: auth,
      workspaceRoot: tempDir,
      targetFilePath: testCssPath
    });

    assert.equal(result.success, true);
    assert.equal(result.appliedCount, 1);

    const updatedContent = fs.readFileSync(testCssPath, 'utf8');
    assert.ok(updatedContent.includes('--text-dim: #94a3b8;'));
    assert.ok(!updatedContent.includes('--text-dim: #64748b;'));
  });

  test('8. atomic rollback (restores pre-patch file content and matches hash)', async () => {
    const originalContent = fs.readFileSync(testCssPath, 'utf8');
    const originalHash = computeContentHash(originalContent);

    const proposal = createDesignProposal({
      changes: [
        {
          type: 'radius_token_update',
          target: '--radius-full',
          before: '9999px',
          after: '6px'
        }
      ]
    });

    const auth = makeValidAuthorization();
    const execResult = await executeDesignProposal({
      proposal,
      authorization: auth,
      workspaceRoot: tempDir,
      targetFilePath: testCssPath
    });

    // Content was updated
    assert.ok(fs.readFileSync(testCssPath, 'utf8').includes('--radius-full: 6px;'));

    // Trigger Rollback
    const rollResult = await rollbackVisualPatch(execResult.patchId, tempDir);
    assert.equal(rollResult.success, true);
    assert.equal(rollResult.status, 'ROLLED_BACK');

    // Restored file content strictly matches original
    const restoredContent = fs.readFileSync(testCssPath, 'utf8');
    assert.equal(restoredContent, originalContent);
    assert.equal(computeContentHash(restoredContent), originalHash);
  });

  test('9. visual score comparison (evaluates score differences accurately)', () => {
    const beforeAudit = { overallScore: 80, categoryScores: { responsiveQuality: 85, colorSystem: 80 } };
    const afterAudit = { overallScore: 84, categoryScores: { responsiveQuality: 85, colorSystem: 85 } };

    const evaluation = evaluateVisualRegressionPolicy({ beforeAudit, afterAudit });
    assert.equal(evaluation.passed, true);
    assert.equal(evaluation.decision, 'KEEP');
    assert.equal(evaluation.diffs.overallScore, 4);
    assert.equal(evaluation.diffs.colorSystem, 5);
  });

  test('10. regression guard (triggers rollback when overall score drops)', () => {
    const beforeAudit = { overallScore: 84, categoryScores: { responsiveQuality: 85, colorSystem: 85 } };
    const afterAudit = { overallScore: 81, categoryScores: { responsiveQuality: 85, colorSystem: 85 } }; // Drop 3 pts

    const evaluation = evaluateVisualRegressionPolicy({ beforeAudit, afterAudit });
    assert.equal(evaluation.passed, false);
    assert.equal(evaluation.decision, 'ROLLBACK');
    assert.ok(evaluation.failures.some(f => f.includes('Genel tasarım skoru')));
  });

  test('11. responsive regression guard (rejects when responsive score drops >5 points)', () => {
    const beforeAudit = { overallScore: 85, categoryScores: { responsiveQuality: 90, colorSystem: 85 } };
    const afterAudit = { overallScore: 85, categoryScores: { responsiveQuality: 80, colorSystem: 85 } }; // -10 drop

    const evaluation = evaluateVisualRegressionPolicy({ beforeAudit, afterAudit });
    assert.equal(evaluation.passed, false);
    assert.equal(evaluation.decision, 'ROLLBACK');
    assert.ok(evaluation.failures.some(f => f.includes('Responsive kalite skoru')));
  });

  test('12. contrast regression guard (rejects when color/contrast score drops >5 points)', () => {
    const beforeAudit = { overallScore: 85, categoryScores: { responsiveQuality: 85, colorSystem: 90 } };
    const afterAudit = { overallScore: 85, categoryScores: { responsiveQuality: 85, colorSystem: 82 } }; // -8 drop

    const evaluation = evaluateVisualRegressionPolicy({ beforeAudit, afterAudit });
    assert.equal(evaluation.passed, false);
    assert.equal(evaluation.decision, 'ROLLBACK');
    assert.ok(evaluation.failures.some(f => f.includes('Renk sistemi ve kontrast skoru')));
  });

  test('13. successful keep decision (runVisualRegressionCycle retains improved patch)', async () => {
    const proposal = createDesignProposal({
      changes: [{ type: 'color_token_update', target: '--text-dim', before: '#64748b', after: '#94a3b8' }],
      expectedImpact: { visualScore: '+3' }
    });

    const auth = makeValidAuthorization();
    const cycle = await runVisualRegressionCycle({
      proposal,
      authorization: auth,
      workspaceRoot: tempDir,
      targetFilePath: testCssPath,
      beforeAudit: { overallScore: 80, categoryScores: { responsiveQuality: 85, colorSystem: 80 } }
    });

    assert.equal(cycle.decision, 'KEEP');
    assert.equal(cycle.passed, true);
    assert.equal(cycle.rollbackResult, null);
    assert.ok(fs.readFileSync(testCssPath, 'utf8').includes('--text-dim: #94a3b8;'));
  });

  test('14. failed visual improvement -> rollback (automatically reverts regressed patch)', async () => {
    const proposal = createDesignProposal({
      changes: [{ type: 'radius_token_update', target: '--radius-full', before: '9999px', after: '6px' }]
    });

    const auth = makeValidAuthorization();

    // Injected mock audit runner that simulates visual regression
    const mockAuditRunner = async () => ({
      overallScore: 75, // Regression from 84 to 75!
      categoryScores: { responsiveQuality: 70, colorSystem: 70 },
      findings: [{ severity: 'critical', title: 'Layout broken' }]
    });

    const cycle = await runVisualRegressionCycle({
      proposal,
      authorization: auth,
      workspaceRoot: tempDir,
      targetFilePath: testCssPath,
      beforeAudit: { overallScore: 84, categoryScores: { responsiveQuality: 85, colorSystem: 85 }, findings: [] },
      auditRunner: mockAuditRunner
    });

    assert.equal(cycle.decision, 'ROLLBACK');
    assert.equal(cycle.passed, false);
    assert.ok(cycle.rollbackResult);
    assert.equal(cycle.rollbackResult.status, 'ROLLED_BACK');

    // Target file is restored back to 9999px
    assert.ok(fs.readFileSync(testCssPath, 'utf8').includes('--radius-full: 9999px;'));
  });

  test('15. concurrent proposal isolation (independent patches do not collide)', async () => {
    const prop1 = createDesignProposal({
      proposalId: 'prop-concurrent-1',
      changes: [{ type: 'design_token_update', target: '--text-dim', before: '#64748b', after: '#94a3b8' }]
    });
    const prop2 = createDesignProposal({
      proposalId: 'prop-concurrent-2',
      changes: [{ type: 'radius_token_update', target: '--radius-full', before: '9999px', after: '6px' }]
    });

    const auth = makeValidAuthorization();

    // Execute concurrently
    const [res1, res2] = await Promise.all([
      executeDesignProposal({ proposal: prop1, authorization: auth, workspaceRoot: tempDir, targetFilePath: testCssPath }),
      executeDesignProposal({ proposal: prop2, authorization: auth, workspaceRoot: tempDir, targetFilePath: testCssPath })
    ]);

    assert.notEqual(res1.patchId, res2.patchId);
    assert.equal(res1.success, true);
    assert.equal(res2.success, true);
  });

  test('16. external CWD safety (execution preserves clean working directory)', async () => {
    const cwdBefore = fs.readdirSync(process.cwd());

    const proposal = createDesignProposal({
      changes: [{ type: 'color_token_update', target: '--text-dim', before: '#64748b', after: '#94a3b8' }]
    });
    const auth = makeValidAuthorization();

    await executeDesignProposal({
      proposal,
      authorization: auth,
      workspaceRoot: tempDir,
      targetFilePath: testCssPath
    });

    const cwdAfter = fs.readdirSync(process.cwd());
    assert.deepEqual(cwdBefore, cwdAfter);
  });

  test('17. audit record creation (execution and rollback produce immutable ledger records)', async () => {
    const proposal = createDesignProposal({
      changes: [{ type: 'color_token_update', target: '--text-dim', before: '#64748b', after: '#94a3b8' }]
    });
    const auth = makeValidAuthorization();

    const res = await executeDesignProposal({
      proposal,
      authorization: auth,
      workspaceRoot: tempDir,
      targetFilePath: testCssPath,
      actor: 'qa-agent'
    });

    const ledgerAfterExec = getAuditLedger();
    assert.equal(ledgerAfterExec.length, 1);
    assert.equal(ledgerAfterExec[0].actor, 'qa-agent');
    assert.equal(ledgerAfterExec[0].status, 'APPLIED');

    await rollbackVisualPatch(res.patchId, tempDir);

    const ledgerAfterRoll = getAuditLedger();
    assert.equal(ledgerAfterRoll.length, 1);
    assert.equal(ledgerAfterRoll[0].status, 'ROLLED_BACK');
    assert.equal(ledgerAfterRoll[0].rollbackAvailable, false);
  });

  test('18. authorization boundary invariant (cannot forge executionAuthorized = true)', () => {
    assert.throws(
      () => {
        createDesignProposal({
          executionAuthorized: true, // Attempt forgery
          changes: [{ type: 'design_token_update', target: '--text-dim', before: 'a', after: 'b' }]
        });
      },
      /UNAUTHORIZED/
    );
  });

  test('19. proposalOnly invariant (proposals always maintain proposalOnly = true)', () => {
    const proposal = createDesignProposal({
      changes: [{ type: 'design_token_update', target: '--text-dim', before: 'a', after: 'b' }]
    });
    assert.equal(proposal.proposalOnly, true);
    assert.equal(proposal.executionAuthorized, false);
  });

  test('20. no auto-fix from Visual Intelligence (analyzeScreenshot never writes to disk)', async () => {
    const dummyPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82
    ]);

    const filesBefore = fs.readdirSync(tempDir);
    const result = await analyzeScreenshot({
      imageBuffer: dummyPng,
      analysisProfile: 'dashboard'
    });

    assert.equal(result.proposalOnly, true);
    assert.equal(result.executionAuthorized, false);

    const filesAfter = fs.readdirSync(tempDir);
    assert.deepEqual(filesBefore, filesAfter);
  });

});
