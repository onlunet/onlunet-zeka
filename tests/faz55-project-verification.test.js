/**
 * FAZ 55: Project / Test Verification Orchestration Test Suite
 * Minimum 65 Meaningful Security, Adversarial, Invariant & Isolation Tests
 *
 * SCOPE LOCK:
 * - Deterministic multi-check aggregation across task/project level.
 * - Read-only inspection only.
 * - Zero execution authority.
 * - Zero mutation authority.
 * - Zero retries, zero auto-fix, zero loops, zero background processes.
 * - Fail-closed on all mismatch, injection, prototype pollution, and traversal attempts.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

import {
  createJobEngine,
  createMultiAgentOrchestrationPlan,
  createAgentDefinition,
  createAgentRegistry,
  createAgentProposal,
  aggregateAndReviewProposals,
  createApprovalRecord,
  evaluateApprovalAdmission,
  executeAdmittedBridge,
  ExecutionBridgeStatus,
  ApprovalStatus,
  ApprovalSourceType,
  ProposalOperationType,
  AgentCapabilities,
  ErrorCodes,
  createProjectVerificationPlan,
  orchestrateProjectVerification,
  ProjectVerificationStatus,
  ProjectCheckType,
  CheckSeverity,
  computeProposalSetFingerprint,
  DefaultProposalAuthorityGuarantee
} from '../src/index.js';
import { createApplicationServer } from '../src/app/index.js';

describe('FAZ 55: Project / Test Verification Orchestration Suite', () => {

  function setupProjectTestExecution(tempDir, {
    target = 'src/index.js',
    content = 'console.log("hello world");',
    packageJson = true,
    operation = ProposalOperationType.MODIFY
  } = {}) {
    const jobEngine = createJobEngine();
    const registry = createAgentRegistry();

    registry.register(createAgentDefinition({
      id: 'architect-1',
      name: 'Architect',
      role: 'SYSTEM_ARCHITECT',
      capabilities: [AgentCapabilities.ARCHITECTURE, AgentCapabilities.CODE_REVIEW],
      tenantId: 'tenant-proj',
      workspaceId: tempDir
    }));

    registry.register(createAgentDefinition({
      id: 'backend-1',
      name: 'Backend Dev',
      role: 'BACKEND_DEVELOPER',
      capabilities: [AgentCapabilities.BACKEND_DEVELOPMENT],
      tenantId: 'tenant-proj',
      workspaceId: tempDir
    }));

    const orchestrationPlan = createMultiAgentOrchestrationPlan({
      id: 'plan-proj-100',
      taskId: 'task-proj-100',
      tenantId: 'tenant-proj',
      workspaceId: tempDir,
      objective: 'Project-level verification execution',
      members: [
        { agentId: 'backend-1', role: 'BACKEND_DEVELOPER', providerId: 'local-provider', capabilities: [AgentCapabilities.BACKEND_DEVELOPMENT] }
      ]
    });

    if (packageJson) {
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-project', version: '1.0.0' }), 'utf-8');
    }

    if (target) {
      const fullPath = path.join(tempDir, target);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(fullPath, content, 'utf-8');
    }

    const proposal = createAgentProposal({
      id: 'prop-proj-1',
      taskId: 'task-proj-100',
      agentId: 'backend-1',
      tenantId: 'tenant-proj',
      workspaceId: tempDir,
      objective: 'Apply changes',
      operations: [{ type: operation, target, description: content }],
      proposedFiles: target ? [target] : []
    });

    const reviewResult = aggregateAndReviewProposals({
      taskId: 'task-proj-100',
      orchestrationPlan,
      proposals: [proposal],
      agentRegistry: registry
    });

    const approval = createApprovalRecord({
      id: 'appr-proj-1',
      taskId: 'task-proj-100',
      orchestrationPlanId: orchestrationPlan.id,
      tenantId: 'tenant-proj',
      workspaceId: tempDir,
      reviewResult,
      source: { type: ApprovalSourceType.HUMAN, approverId: 'senior-qa' },
      decision: ApprovalStatus.APPROVED
    });

    const admissionDecision = evaluateApprovalAdmission({
      tenantId: 'tenant-proj',
      workspaceId: tempDir,
      taskId: 'task-proj-100',
      orchestrationPlan,
      reviewResult,
      approval,
      proposals: [proposal]
    });

    const executionResult = executeAdmittedBridge({
      executionId: 'exec-proj-100',
      jobEngine,
      admissionDecision,
      approval,
      reviewResult,
      orchestrationPlan,
      proposals: [proposal],
      workspaceRoot: tempDir,
      tenantId: 'tenant-proj'
    });

    return {
      tempDir,
      jobEngine,
      orchestrationPlan,
      proposal,
      reviewResult,
      approval,
      admissionDecision,
      executionResult,
      target,
      content
    };
  }

  // --- Group 1: Verification Plan Contract & Basics ---
  describe('1. Project Verification Plan & Baseline Flows', () => {
    test('1. valid verification plan creates immutable, frozen plan contract', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-1-'));
      const plan = createProjectVerificationPlan({
        id: 'ver-plan-1',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        executionIds: ['exec-proj-100'],
        checks: [
          { type: ProjectCheckType.EXECUTION_RESULT, expected: { outcome: 'SUCCEEDED' } }
        ]
      });

      assert.equal(plan.id, 'ver-plan-1');
      assert.ok(Object.isFrozen(plan));
      assert.ok(Object.isFrozen(plan.checks));
      assert.throws(() => { plan.id = 'TAMPERED'; }, TypeError);
    });

    test('2. empty verification plan (0 checks) executes and yields VERIFIED_SUCCESS with 0 checks', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-2-'));
      const plan = createProjectVerificationPlan({
        id: 'ver-plan-2',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'ver-run-2',
        verificationPlan: plan,
        executionResults: []
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
      assert.equal(res.totalChecks, 0);
    });

    test('3. malformed verification plan (null/string) causes VERIFICATION_DENIED fail-closed', () => {
      const resNull = orchestrateProjectVerification({ verificationId: 'v-3a', verificationPlan: null });
      assert.equal(resNull.status, ProjectVerificationStatus.VERIFICATION_DENIED);

      const resStr = orchestrateProjectVerification({ verificationId: 'v-3b', verificationPlan: 'STRING_PLAN' });
      assert.equal(resStr.status, ProjectVerificationStatus.VERIFICATION_DENIED);
    });

    test('4. missing verificationId causes VERIFICATION_DENIED fail-closed', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-4-'));
      const plan = createProjectVerificationPlan({
        id: 'ver-plan-4',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: null,
        verificationPlan: plan
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
    });

    test('5. invalid verificationId characters causes VERIFICATION_DENIED fail-closed', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-5-'));
      const plan = createProjectVerificationPlan({
        id: 'ver-plan-5',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'bad/id/with/slashes',
        verificationPlan: plan
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
    });
  });

  // --- Group 2: Scope, Task, Job, Tenant & Workspace Mismatches ---
  describe('2. Scope Bindings, Identity, Tenant & Workspace Defenses', () => {
    test('6. task mismatch between context and verificationPlan causes VERIFICATION_DENIED', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-6-'));
      const plan = createProjectVerificationPlan({
        id: 'ver-plan-6',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-6',
        verificationPlan: plan,
        context: { taskId: 'foreign-task-999' }
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
      assert.ok(res.failureReason.includes('Task mismatch'));
    });

    test('7. job mismatch between context and verificationPlan causes VERIFICATION_DENIED', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-7-'));
      const plan = createProjectVerificationPlan({
        id: 'ver-plan-7',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-7',
        verificationPlan: plan,
        context: { jobId: 'foreign-job-999' }
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
      assert.ok(res.failureReason.includes('Job mismatch'));
    });

    test('8. execution mismatch: required executionId missing from results causes VERIFICATION_DENIED', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-8-'));
      const plan = createProjectVerificationPlan({
        id: 'ver-plan-8',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        executionIds: ['exec-required-1', 'exec-required-2'],
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-8',
        verificationPlan: plan,
        executionResults: [{ executionId: 'exec-required-1', tenantId: 'tenant-proj', taskId: 'task-proj-100' }]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
      assert.ok(res.failureReason.includes('Execution mismatch'));
    });

    test('9. tenant mismatch between caller and verificationPlan causes VERIFICATION_DENIED fail-closed', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-9-'));
      const plan = createProjectVerificationPlan({
        id: 'ver-plan-9',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-9',
        verificationPlan: plan,
        context: { tenantId: 'foreign-tenant' }
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
      assert.ok(res.failureReason.includes('Tenant mismatch'));
    });

    test('10. workspace mismatch between caller and plan causes VERIFICATION_DENIED', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-10-'));
      const plan = createProjectVerificationPlan({
        id: 'ver-plan-10',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-10',
        verificationPlan: plan,
        context: { workspaceId: 'D:\\Different\\Workspace' }
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
      assert.ok(res.failureReason.includes('Workspace mismatch'));
    });

    test('11. cross-tenant execution result in executionResults causes VERIFICATION_DENIED', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-11-'));
      const plan = createProjectVerificationPlan({
        id: 'ver-plan-11',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        executionIds: ['exec-1'],
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-11',
        verificationPlan: plan,
        executionResults: [{ executionId: 'exec-1', tenantId: 'foreign-tenant', taskId: 'task-proj-100' }]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
      assert.ok(res.failureReason.includes('Tenant mismatch in execution result'));
    });

    test('12. proposal fingerprint mismatch causes VERIFICATION_DENIED', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-12-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-12',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const tamperedProposal = [{
        ...fixtures.proposal,
        operations: [{ type: ProposalOperationType.MODIFY, target: 'other.js' }]
      }];

      const res = orchestrateProjectVerification({
        verificationId: 'v-12',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult],
        expectedProposalFingerprint: computeProposalSetFingerprint([fixtures.proposal]),
        proposals: tamperedProposal
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
      assert.ok(res.failureReason.includes('Proposal fingerprint mismatch'));
    });
  });

  // --- Group 3: Execution Result & State Invariant Checks ---
  describe('3. Multi-Check Verification: Execution Results & File States', () => {
    test('13. valid execution result check passes with ValidationResult.PASS', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-13-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-13',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.EXECUTION_RESULT, expected: { outcome: 'SUCCEEDED' } }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-13',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
      assert.equal(res.passedCount, 1);
    });

    test('14. failed execution result check marks check as FAIL and produces VERIFIED_FAILURE', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-14-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const failedResult = {
        ...fixtures.executionResult,
        outcome: 'FAILED',
        status: ExecutionBridgeStatus.FAILED
      };

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-14',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.EXECUTION_RESULT, expected: { outcome: 'SUCCEEDED' } }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-14',
        verificationPlan: plan,
        executionResults: [failedResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
      assert.equal(res.failedCount, 1);
    });

    test('15. expected file exists check passes when file is present on disk', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-15-'));
      const fixtures = setupProjectTestExecution(tempDir, { target: 'src/index.js' });

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-15',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.EXPECTED_FILE, target: 'src/index.js' }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-15',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
      assert.equal(res.passedCount, 1);
    });

    test('16. expected file missing check reports FAIL and produces VERIFIED_FAILURE', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-16-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-16',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.EXPECTED_FILE, target: 'missing/file.js' }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-16',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
      assert.equal(res.failedCount, 1);
    });

    test('17. expected content match check passes when content matches', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-17-'));
      const fixtures = setupProjectTestExecution(tempDir, {
        target: 'config.json',
        content: '{"setting":true}'
      });

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-17',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.FILE_CONTENT, target: 'config.json', expected: { expectedContent: '{"setting":true}' } }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-17',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
    });

    test('18. expected content mismatch produces check FAIL and VERIFIED_FAILURE (NO FALSE SUCCESS)', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-18-'));
      const fixtures = setupProjectTestExecution(tempDir, {
        target: 'config.json',
        content: '{"setting":true}'
      });

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-18',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.FILE_CONTENT, target: 'config.json', expected: { expectedContent: '{"setting":false}' } }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-18',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
    });

    test('19. unexpected file modification check detects unlisted target mutation', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-19-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-19',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          {
            type: ProjectCheckType.UNEXPECTED_FILE,
            target: 'unauthorized-file.js',
            expected: { expectedFileChanges: ['authorized.js'] }
          }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-19',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
      assert.ok(res.failureReason.includes('Unexpected file modification'));
    });
  });

  // --- Group 4: Test, Build, Artifact & Contract Checks ---
  describe('4. Test, Build, Artifact & Project Contract Checks', () => {
    test('20. TEST_RESULT check passes when bound execution result succeeded', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-20-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-20',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.TEST_RESULT, expected: { status: 'SUCCEEDED' } }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-20',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
    });

    test('21. TEST_RESULT check fails when bound execution failed or verificationResult is FAIL', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-21-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const failedTestResult = {
        ...fixtures.executionResult,
        outcome: 'FAILED',
        verificationResult: 'FAIL'
      };

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-21',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.TEST_RESULT, expected: { status: 'SUCCEEDED' } }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-21',
        verificationPlan: plan,
        executionResults: [failedTestResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
    });

    test('22. BUILD_RESULT check passes when build execution succeeded', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-22-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-22',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.BUILD_RESULT, expected: { outcome: 'SUCCEEDED' } }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-22',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
    });

    test('23. BUILD_RESULT check fails when build execution failed', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-23-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const failedBuild = {
        ...fixtures.executionResult,
        outcome: 'FAILED'
      };

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-23',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.BUILD_RESULT, expected: { outcome: 'SUCCEEDED' } }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-23',
        verificationPlan: plan,
        executionResults: [failedBuild]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
    });

    test('24. ARTIFACT_EXISTS check passes when build artifact is present on disk', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-24-'));
      fs.writeFileSync(path.join(tempDir, 'bundle.js'), 'function bundle(){}', 'utf-8');
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-24',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.ARTIFACT_EXISTS, target: 'bundle.js' }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-24',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
    });

    test('25. ARTIFACT_EXISTS check fails when artifact is missing', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-25-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-25',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.ARTIFACT_EXISTS, target: 'dist/bundle.min.js' }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-25',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
    });

    test('26. PROJECT_CONTRACT check passes when package.json is valid', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-26-'));
      const fixtures = setupProjectTestExecution(tempDir, { packageJson: true });

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-26',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.PROJECT_CONTRACT }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-26',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
    });

    test('27. PROJECT_CONTRACT check fails when package.json is missing or corrupted', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-27-'));
      const fixtures = setupProjectTestExecution(tempDir, { packageJson: false });

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-27',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.PROJECT_CONTRACT }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-27',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
      assert.ok(res.failureReason.includes('package.json missing'));
    });
  });

  // --- Group 5: Severity & Deterministic Aggregation ---
  describe('5. Check Severity & Aggregation Rules', () => {
    test('28. single REQUIRED check failure causes overall VERIFIED_FAILURE', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-28-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-28',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.EXECUTION_RESULT, expected: { outcome: 'SUCCEEDED' }, severity: CheckSeverity.REQUIRED },
          { type: ProjectCheckType.EXPECTED_FILE, target: 'non-existent.txt', severity: CheckSeverity.REQUIRED }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-28',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
      assert.equal(res.passedCount, 1);
      assert.equal(res.failedCount, 1);
    });

    test('29. all checks passing yields overall VERIFIED_SUCCESS', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-29-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-29',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.EXECUTION_RESULT, expected: { outcome: 'SUCCEEDED' }, severity: CheckSeverity.REQUIRED },
          { type: ProjectCheckType.PROJECT_CONTRACT, severity: CheckSeverity.REQUIRED }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-29',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
      assert.equal(res.passedCount, 2);
      assert.equal(res.failedCount, 0);
    });

    test('30. OPTIONAL check failure does not fail overall project if required checks pass', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-30-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-30',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.EXECUTION_RESULT, expected: { outcome: 'SUCCEEDED' }, severity: CheckSeverity.REQUIRED },
          { type: ProjectCheckType.EXPECTED_FILE, target: 'optional-doc.md', severity: CheckSeverity.OPTIONAL }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-30',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
      assert.equal(res.passedCount, 1);
      assert.equal(res.failedCount, 1);
    });

    test('31. deterministic check execution order matches plan order', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-31-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-31',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { id: 'c-3', type: ProjectCheckType.PROJECT_CONTRACT },
          { id: 'c-1', type: ProjectCheckType.EXECUTION_RESULT },
          { id: 'c-2', type: ProjectCheckType.FILE_STATE, target: 'src/index.js' }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-31',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.checkResults[0].id, 'c-3');
      assert.equal(res.checkResults[1].id, 'c-1');
      assert.equal(res.checkResults[2].id, 'c-2');
    });

    test('32. deterministic aggregation: identical inputs yield deeply equal results', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-32-'));
      const fixtures = setupProjectTestExecution(tempDir);
      const fixedClock = 1758000000000;

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-32',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [{ type: ProjectCheckType.PROJECT_CONTRACT }]
      });

      const res1 = orchestrateProjectVerification({
        verificationId: 'v-32',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult],
        now: fixedClock
      });

      const res2 = orchestrateProjectVerification({
        verificationId: 'v-32',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult],
        now: fixedClock
      });

      assert.deepEqual(res1, res2);
    });
  });

  // --- Group 6: Immutability, Deep Freeze & Injection Defenses ---
  describe('6. Immutability, Deep Freeze & Adversarial Defenses', () => {
    test('33. result deep freeze: project verification result and all check results are frozen', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-33-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-33',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [{ type: ProjectCheckType.PROJECT_CONTRACT }]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-33',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.ok(Object.isFrozen(res));
      assert.ok(Object.isFrozen(res.checkResults));
      res.checkResults.forEach(r => assert.ok(Object.isFrozen(r)));
      assert.ok(Object.isFrozen(res.passedChecks));
      assert.ok(Object.isFrozen(res.failedChecks));
      assert.throws(() => { res.status = 'MODIFIED'; }, TypeError);
    });

    test('34. authority injection in execution results cannot escalate project verification guarantee', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-34-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const injectedResult = {
        ...fixtures.executionResult,
        authorityGuarantee: {
          executionAuthorized: true,
          mutationAuthorized: true,
          proposalOnly: false
        }
      };

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-34',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [{ type: ProjectCheckType.EXECUTION_RESULT }]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-34',
        verificationPlan: plan,
        executionResults: [injectedResult]
      });

      assert.equal(res.authorityGuarantee.executionAuthorized, false);
      assert.equal(res.authorityGuarantee.mutationAuthorized, false);
      assert.equal(res.authorityGuarantee.proposalOnly, true);
    });

    test('35. retry injection in result does not generate retry flags or directives', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-35-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const injectedResult = {
        ...fixtures.executionResult,
        retry: true,
        autoRetry: true
      };

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-35',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [{ type: ProjectCheckType.EXECUTION_RESULT }]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-35',
        verificationPlan: plan,
        executionResults: [injectedResult]
      });

      assert.equal(res.retry, undefined);
      assert.equal(res.autoRetry, undefined);
      assert.equal(res.metadata.terminal, true);
    });

    test('36. auto-execute injection in plan is ignored', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-36-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-36',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [{ type: ProjectCheckType.EXECUTION_RESULT }],
        metadata: { autoExecute: true }
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-36',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.autoExecute, undefined);
      assert.equal(res.metadata.singleOrchestration, true);
    });

    test('37. path traversal in check target causes VERIFICATION_DENIED fail-closed', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-37-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-37',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.FILE_STATE, target: '../../etc/shadow' }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-37',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
      assert.ok(res.failureReason.includes('Security violation'));
    });

    test('38. absolute path in check target causes VERIFICATION_DENIED', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-38-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-38',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.FILE_STATE, target: '/var/log/syslog' }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-38',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
    });

    test('39. UNC path in check target causes VERIFICATION_DENIED', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-39-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-39',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.FILE_STATE, target: '\\\\remote\\share\\file.txt' }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-39',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
    });

    test('40. null byte in check target causes VERIFICATION_DENIED', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-40-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-40',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.FILE_STATE, target: 'file.txt\0.exe' }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-40',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
    });

    test('41. command injection in check target causes VERIFICATION_DENIED', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-41-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-41',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.FILE_STATE, target: 'test.js; rm -rf /' }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-41',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFICATION_DENIED);
    });

    test('42. prototype pollution in verificationPlan creation throws Error fail-closed', () => {
      const poisoned = JSON.parse('{"id":"p-poll","taskId":"t","jobId":"j","tenantId":"t","workspaceId":"w","__proto__":{"polluted":true}}');
      assert.throws(() => {
        createProjectVerificationPlan(poisoned);
      }, /Prototype pollution/);
    });

    test('43. type confusion in plan fields throws Error fail-closed', () => {
      assert.throws(() => {
        createProjectVerificationPlan({ id: 'p', taskId: ['array-task'], jobId: 'j', tenantId: 't', workspaceId: 'w' });
      }, /taskId/);

      assert.throws(() => {
        createProjectVerificationPlan({ id: 'p', taskId: 't', jobId: 'j', tenantId: 't', workspaceId: 'w', checks: 'not-array' });
      }, /checks must be an array/);
    });
  });

  // --- Group 7: Read-Only, No Loop, No Retry & Terminality ---
  describe('7. Read-Only Invariant, Zero Retries & Terminality', () => {
    test('44. read-only guarantee: verification does not write or mutate filesystem', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-44-'));
      const targetFile = path.join(tempDir, 'preserved.txt');
      fs.writeFileSync(targetFile, 'do-not-change', 'utf-8');
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-44',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.FILE_CONTENT, target: 'preserved.txt', expected: { expectedContent: 'different' } }
        ]
      });

      orchestrateProjectVerification({
        verificationId: 'v-44',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      // Confirm file on disk remains unchanged
      assert.equal(fs.readFileSync(targetFile, 'utf-8'), 'do-not-change');
    });

    test('45. no mutation authority: output contract guarantees mutationAuthorized is false', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-45-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-45',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-45',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.authorityGuarantee.mutationAuthorized, false);
      assert.equal(res.authorityGuarantee.proposalOnly, true);
    });

    test('46. no execution authority: output contract guarantees executionAuthorized is false', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-46-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-46',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-46',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.authorityGuarantee.executionAuthorized, false);
      assert.equal(res.authorityGuarantee.shellAuthorized, false);
    });

    test('47. no automatic retry: failed project verification produces terminal result without retrying', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-47-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-47',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.EXPECTED_FILE, target: 'missing.txt' }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-47',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
      assert.equal(res.metadata.terminal, true);
      assert.equal(res.retry, undefined);
    });

    test('48. no background worker, queue or timer in project verification', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-48-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-48',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-48',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.queue, undefined);
      assert.equal(res.worker, undefined);
      assert.equal(res.timer, undefined);
    });

    test('49. replay protection: verifying same plan twice produces consistent terminal results', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-49-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-49',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [{ type: ProjectCheckType.PROJECT_CONTRACT }]
      });

      const r1 = orchestrateProjectVerification({
        verificationId: 'v-49a',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      const r2 = orchestrateProjectVerification({
        verificationId: 'v-49b',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(r1.status, r2.status);
      assert.equal(r1.metadata.terminal, true);
      assert.equal(r2.metadata.terminal, true);
    });

    test('50. failed verification terminates: does not trigger AI diagnosis or repair loop', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-50-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-50',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.FILE_STATE, target: 'non-existent-fail.js' }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-50',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
      assert.equal(res.aiDiagnosis, undefined);
      assert.equal(res.autoRepair, undefined);
    });
  });

  // --- Group 8: Comprehensive Check Scenarios & Edge Cases ---
  describe('8. Check Scenarios, Edge Cases & Multi-Execution Scenarios', () => {
    test('51. multiple execution results bound to different checks evaluate correctly', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-51-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const exec1 = { ...fixtures.executionResult, id: 'exec-1', executionId: 'exec-1', outcome: 'SUCCEEDED' };
      const exec2 = { ...fixtures.executionResult, id: 'exec-2', executionId: 'exec-2', outcome: 'SUCCEEDED' };

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-51',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        executionIds: ['exec-1', 'exec-2'],
        checks: [
          { executionId: 'exec-1', type: ProjectCheckType.EXECUTION_RESULT, expected: { outcome: 'SUCCEEDED' } },
          { executionId: 'exec-2', type: ProjectCheckType.BUILD_RESULT, expected: { outcome: 'SUCCEEDED' } }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-51',
        verificationPlan: plan,
        executionResults: [exec1, exec2]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
      assert.equal(res.passedCount, 2);
    });

    test('52. mixed check results: 3 pass, 1 required fails -> VERIFIED_FAILURE', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-52-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-52',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { id: 'c1', type: ProjectCheckType.PROJECT_CONTRACT, severity: CheckSeverity.REQUIRED },
          { id: 'c2', type: ProjectCheckType.FILE_STATE, target: 'src/index.js', severity: CheckSeverity.REQUIRED },
          { id: 'c3', type: ProjectCheckType.EXECUTION_RESULT, expected: { outcome: 'SUCCEEDED' }, severity: CheckSeverity.REQUIRED },
          { id: 'c4', type: ProjectCheckType.EXPECTED_FILE, target: 'missing-asset.png', severity: CheckSeverity.REQUIRED }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-52',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
      assert.equal(res.passedCount, 3);
      assert.equal(res.failedCount, 1);
    });

    test('53. FILE_CONTENT check with contentIncludes evaluates substring correctly', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-53-'));
      const fixtures = setupProjectTestExecution(tempDir, {
        target: 'banner.txt',
        content: 'Antigravity Verification Orchestrator v1.0'
      });

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-53',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.FILE_CONTENT, target: 'banner.txt', expected: { contentIncludes: 'Verification Orchestrator' } }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-53',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
    });

    test('54. REGRESSION check delegates to test execution evaluation cleanly', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-54-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-54',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.REGRESSION, expected: { status: 'SUCCEEDED' } }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-54',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
    });

    test('55. ARTIFACT_CONTENT check validates artifact payload accurately', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-55-'));
      fs.writeFileSync(path.join(tempDir, 'summary.json'), '{"passed":100}', 'utf-8');
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-55',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.ARTIFACT_CONTENT, target: 'summary.json', expected: { expectedContent: '{"passed":100}' } }
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-55',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
    });

    test('56. no admission creation in project verification', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-56-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-56',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-56',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.admission, undefined);
      assert.equal(res.admit, undefined);
    });

    test('57. no approval creation in project verification', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-57-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-57',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-57',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.approval, undefined);
      assert.equal(res.approve, undefined);
    });

    test('58. no AI invocation in project verification', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-58-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-58',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: []
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-58',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.aiProvider, undefined);
      assert.equal(res.agent, undefined);
    });

    test('59. check without target when target is required fails gracefully', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-59-'));
      const fixtures = setupProjectTestExecution(tempDir);

      const plan = createProjectVerificationPlan({
        id: 'ver-plan-59',
        taskId: 'task-proj-100',
        jobId: 'job-proj-100',
        tenantId: 'tenant-proj',
        workspaceId: tempDir,
        checks: [
          { type: ProjectCheckType.FILE_STATE, target: null } // Missing target
        ]
      });

      const res = orchestrateProjectVerification({
        verificationId: 'v-59',
        verificationPlan: plan,
        executionResults: [fixtures.executionResult]
      });

      assert.equal(res.status, ProjectVerificationStatus.VERIFIED_FAILURE);
      assert.ok(res.failureReason.includes('requires a target path'));
    });
  });

  // --- Group 9: HTTP Boundary POST /api/verify-project ---
  describe('9. HTTP Server Boundary: POST /api/verify-project', () => {
    let server;
    let baseUrl;
    let appWorkspaceDir;

    before(async () => {
      appWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'faz55-server-'));
      fs.writeFileSync(path.join(appWorkspaceDir, 'package.json'), '{"name":"srv-test"}', 'utf-8');

      const app = createApplicationServer();
      await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const port = server.address().port;
          baseUrl = `http://127.0.0.1:${port}`;
          resolve();
        });
      });
    });

    after(async () => {
      if (server) {
        await new Promise(resolve => server.close(resolve));
      }
    });

    function postJson(urlPath, payload, headers = {}) {
      return new Promise((resolve, reject) => {
        const body = JSON.stringify(payload);
        const req = http.request(`${baseUrl}${urlPath}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            ...headers
          }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
            } catch (err) {
              resolve({ statusCode: res.statusCode, raw: data });
            }
          });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });
    }

    test('60. POST /api/verify-project successfully orchestrates project verification', async () => {
      const mockResult = {
        executionId: 'exec-http-proj-1',
        jobId: 'job-http-proj-1',
        taskId: 'task-http-proj-1',
        tenantId: 'tenant-http-proj',
        workspaceRoot: appWorkspaceDir,
        status: 'EXECUTED',
        outcome: 'SUCCEEDED'
      };

      const plan = {
        id: 'plan-http-proj-1',
        taskId: 'task-http-proj-1',
        jobId: 'job-http-proj-1',
        tenantId: 'tenant-http-proj',
        workspaceId: appWorkspaceDir,
        checks: [
          { type: ProjectCheckType.PROJECT_CONTRACT }
        ]
      };

      const res = await postJson('/api/verify-project', {
        verificationId: 'ver-http-proj-1',
        verificationPlan: plan,
        executionResults: [mockResult],
        tenantId: 'tenant-http-proj'
      }, { 'x-tenant-id': 'tenant-http-proj' });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.projectResult.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
    });

    test('61. POST /api/verify-project returns 400 when tenant mismatches fail-closed', async () => {
      const plan = {
        id: 'plan-http-proj-ten',
        taskId: 't-1',
        jobId: 'j-1',
        tenantId: 'tenant-real',
        workspaceId: appWorkspaceDir,
        checks: []
      };

      const res = await postJson('/api/verify-project', {
        verificationId: 'ver-http-ten',
        verificationPlan: plan,
        tenantId: 'tenant-attacker'
      }, { 'x-tenant-id': 'tenant-attacker' });

      assert.equal(res.statusCode, 400);
    });

    test('62. POST /api/verify-project returns 400 when plan is missing', async () => {
      const res = await postJson('/api/verify-project', {
        verificationId: 'ver-http-no-plan',
        verificationPlan: null
      });

      assert.equal(res.statusCode, 400);
    });

    test('63. POST /api/verify-project returns terminal verification state', async () => {
      const plan = {
        id: 'plan-http-term',
        taskId: 't-term',
        jobId: 'j-term',
        tenantId: 'tenant-term',
        workspaceId: appWorkspaceDir,
        checks: []
      };

      const res = await postJson('/api/verify-project', {
        verificationId: 'ver-http-term',
        verificationPlan: plan,
        tenantId: 'tenant-term'
      }, { 'x-tenant-id': 'tenant-term' });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.projectResult.metadata.terminal, true);
    });

    test('64. failed verification stops and reports failure cleanly via HTTP', async () => {
      const plan = {
        id: 'plan-http-fail',
        taskId: 't-fail',
        jobId: 'j-fail',
        tenantId: 'tenant-fail',
        workspaceId: appWorkspaceDir,
        checks: [
          { type: ProjectCheckType.EXPECTED_FILE, target: 'does-not-exist.js' }
        ]
      };

      const res = await postJson('/api/verify-project', {
        verificationId: 'ver-http-fail',
        verificationPlan: plan,
        tenantId: 'tenant-fail'
      }, { 'x-tenant-id': 'tenant-fail' });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.projectResult.status, ProjectVerificationStatus.VERIFIED_FAILURE);
      assert.equal(res.body.projectResult.failedCount, 1);
    });

    test('65. successful verification stops cleanly via HTTP without further action', async () => {
      const plan = {
        id: 'plan-http-succ',
        taskId: 't-succ',
        jobId: 'j-succ',
        tenantId: 'tenant-succ',
        workspaceId: appWorkspaceDir,
        checks: [
          { type: ProjectCheckType.PROJECT_CONTRACT }
        ]
      };

      const res = await postJson('/api/verify-project', {
        verificationId: 'ver-http-succ',
        verificationPlan: plan,
        tenantId: 'tenant-succ'
      }, { 'x-tenant-id': 'tenant-succ' });

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.projectResult.status, ProjectVerificationStatus.VERIFIED_SUCCESS);
      assert.equal(res.body.projectResult.passedCount, 1);
      assert.equal(res.body.projectResult.authorityGuarantee.executionAuthorized, false);
    });
  });
});
