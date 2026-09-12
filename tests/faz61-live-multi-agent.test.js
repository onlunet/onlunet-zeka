/**
 * ONLUNET ZEKA - FAZ 61 Multi-Agent Live Certification Test Suite
 *
 * Validates 3-agent orchestration, cryptographic agent identity,
 * and tenant / workspace isolation under live provider execution.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native node:test, node:assert only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import {
  createAIControlPlane,
  createAgentIdentity,
  validateIdentityContinuity,
  createApprovalBoundary
} from '../src/control-plane/index.js';

describe('FAZ 61.8: Multi-Agent Live Certification & Isolation', () => {

  it('executes 3-agent workflow: Analysis -> Verification -> Synthesis with zero authority leakage', async () => {
    const controlPlane = createAIControlPlane();

    // Step 1: Analysis Agent
    const analysisRes = await controlPlane.executeDispatch({
      prompt: 'Analyze architectural invariant AI != AUTHORITY',
      agentId: 'agent-analyst',
      agentRole: 'RESEARCHER',
      taskType: 'reasoning',
      tenantId: 'tenant-multi-1',
      workspaceId: 'ws-multi-1'
    });
    assert.equal(analysisRes.status, 'SUCCESS');
    assert.strictEqual(analysisRes.proposalOnly, true);
    assert.strictEqual(analysisRes.executionAuthorized, false);

    // Step 2: Verification Agent
    const verificationRes = await controlPlane.executeDispatch({
      prompt: 'Verify proposal conforms to policy: ' + analysisRes.output,
      agentId: 'agent-verifier',
      agentRole: 'REVIEWER',
      taskType: 'reasoning',
      tenantId: 'tenant-multi-1',
      workspaceId: 'ws-multi-1'
    });
    assert.equal(verificationRes.status, 'SUCCESS');
    assert.strictEqual(verificationRes.proposalOnly, true);

    // Step 3: Synthesis Agent
    const synthesisRes = await controlPlane.executeDispatch({
      prompt: 'Synthesize findings: ' + verificationRes.output,
      agentId: 'agent-synthesizer',
      agentRole: 'COORDINATOR',
      taskType: 'reasoning',
      tenantId: 'tenant-multi-1',
      workspaceId: 'ws-multi-1'
    });
    assert.equal(synthesisRes.status, 'SUCCESS');
    assert.strictEqual(synthesisRes.proposalOnly, true);
    assert.strictEqual(synthesisRes.executionAuthorized, false);
    assert.strictEqual(synthesisRes.mutationAuthorized, false);
  });

  it('enforces immutable agent identity and blocks cross-tenant impersonation fail-closed', () => {
    const identityA = createAgentIdentity({
      agentId: 'agent-tenant-a',
      tenantId: 'tenant-a',
      workspaceId: 'workspace-a',
      taskId: 'task-a',
      providerId: 'local'
    });

    assert.throws(
      () => {
        validateIdentityContinuity(identityA, {
          agentId: 'agent-tenant-a',
          tenantId: 'tenant-b', // Unauthorized tenant mismatch attempt
          workspaceId: 'workspace-a',
          taskId: 'task-a'
        });
      },
      /Cross-tenant identity violation/
    );
  });

  it('prevents approval token reuse across multiple agents', () => {
    const boundary = createApprovalBoundary({ secret: 'sec-key-faz61-multi-test' });

    const token = boundary.issueApprovalToken({
      planId: 'plan-multi-1',
      taskId: 'task-multi-1',
      tenantId: 'tenant-multi-1',
      workspaceId: 'ws-multi-1',
      ttlMs: 60000
    });

    // Authorized agent consumes token
    const consume1 = boundary.consumeApprovalToken(token, {
      planId: 'plan-multi-1',
      taskId: 'task-multi-1',
      tenantId: 'tenant-multi-1',
      workspaceId: 'ws-multi-1'
    });
    assert.strictEqual(consume1.valid, true);

    // Replay attempt must throw SECURITY_BLOCKED
    assert.throws(
      () => boundary.consumeApprovalToken(token, {
        planId: 'plan-multi-1',
        taskId: 'task-multi-1',
        tenantId: 'tenant-multi-1',
        workspaceId: 'ws-multi-1'
      }),
      /already been consumed/
    );
  });
});
