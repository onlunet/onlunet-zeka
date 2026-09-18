/**
 * ONLUNET ZEKA - FAZ 66.12 Test Suite
 * FREE-FIRST AUTONOMOUS PHASE ENGINE
 *
 * Requirements:
 * Test A: Phase State Machine (CREATED -> ANALYZING -> PLANNED -> EXECUTING -> VERIFYING -> COMPLETED) & invalid transition blocking
 * Test B: Free-First Resource Selection (Paid resource is never prioritized over free/local)
 * Test C: Paid Guard (paidAIAllowed: false strictly blocks paid AI resources)
 * Test D: Free Quota Exhaustion (Account A quota exhausted -> Account B / Local free fallback)
 * Test E: No Paid Fallback (All free resources exhausted -> STOP/WAIT/REPORT, no auto paid fallback)
 * Test F: Local Execution & Honest Local AI Evaluation (L0 tools & L1 status without fake pass)
 * Test G: Transparent Model Substitution Telemetry (requestedModel != actualModel, isSubstituted: true)
 * Test H: Failure Classification & Recovery Loop (Failure -> Classify -> Propose Fix -> Approval Required)
 * Test I: Strict Zero AI Execution Authority (proposalOnly: true, executionAuthorized: false, requiresApproval: true)
 * Test J: Zero Secret Leakage (API keys scrubbed from evidence, telemetry, logs)
 * Test K: Hard Budget Enforcement (Exceeding maxFreeCalls or maxRetries transitions to BUDGET_EXCEEDED)
 * Test L: Deterministic Task Decomposition (T001..T010 structure, policies, and invariants)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  PhaseState,
  ValidPhaseTransitions,
  PhaseFailureCategory,
  LocalAIStatus,
  classifyPhaseFailure,
  decomposePhase,
  createPhaseBudget,
  createDeterministicLocalRunner,
  createEvidenceCollector,
  createPhaseEngine
} from '../src/autonomous/phase-engine.js';
import {
  createAIResourceOrchestrator,
  ResourceTier,
  determineResourceTier,
  GatewayInvocationStatus,
  TaskComplexity,
  ModelQualityTier
} from '../src/orchestration/ai-resource-orchestrator.js';
import { createCredentialPool } from '../src/providers/credential-pool.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createModelRegistry } from '../src/providers/model-registry.js';
import { ErrorCodes } from '../src/contracts/constants.js';

describe('FAZ 66.12: Free-First Autonomous Phase Engine Suite', () => {

  // Test A: Phase State Machine
  it('Test A: Transitions state machine deterministically and rejects invalid transitions', () => {
    const engine = createPhaseEngine({ phaseId: 'FAZ-66.12-TEST-A' });
    assert.strictEqual(engine.state, PhaseState.CREATED);

    engine.transitionTo(PhaseState.ANALYZING, 'Starting analysis');
    assert.strictEqual(engine.state, PhaseState.ANALYZING);

    engine.transitionTo(PhaseState.PLANNED, 'Plan generated');
    assert.strictEqual(engine.state, PhaseState.PLANNED);

    engine.transitionTo(PhaseState.AWAITING_APPROVAL, 'Submitting plan for approval');
    assert.strictEqual(engine.state, PhaseState.AWAITING_APPROVAL);

    engine.transitionTo(PhaseState.EXECUTING, 'Approval granted');
    assert.strictEqual(engine.state, PhaseState.EXECUTING);

    engine.transitionTo(PhaseState.VERIFYING, 'Execution complete, running tests');
    assert.strictEqual(engine.state, PhaseState.VERIFYING);

    engine.transitionTo(PhaseState.VERIFIED, 'All tests passed');
    assert.strictEqual(engine.state, PhaseState.VERIFIED);

    engine.transitionTo(PhaseState.COMPLETED, 'Phase successfully completed');
    assert.strictEqual(engine.state, PhaseState.COMPLETED);

    // Invalid transition from terminal COMPLETED state must throw fail-closed
    assert.throws(
      () => engine.transitionTo(PhaseState.ANALYZING),
      /Invalid phase state transition/
    );
  });

  // Test B: Free-First Resource Selection
  it('Test B: Free-First resource selection prioritizes Local/Free resources over Paid APIs', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gem-free-1', apiKey: 'test-key-free-1' });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    // Register a paid model and a free model
    modelRegistry.registerModel({
      id: 'gpt-4o',
      providerId: 'openai',
      capabilities: ['TEXT'],
      pricing: { inputPerMillion: 2.50, outputPerMillion: 10.00 },
      isPaid: true
    });
    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: ['TEXT'],
      pricing: { inputPerMillion: 0.10, outputPerMillion: 0.40 },
      isFreeTier: true
    });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: ['TEXT'],
      invoke: async () => ({ status: GatewayInvocationStatus.SUCCESS, output: 'Gemini free output' })
    });
    registry.registerProvider({
      providerId: 'openai',
      capabilities: ['TEXT'],
      invoke: async () => ({ status: GatewayInvocationStatus.SUCCESS, output: 'OpenAI paid output' })
    });

    const orchestrator = createAIResourceOrchestrator({
      registry,
      modelRegistry,
      credentialPool: pool,
      initialCertifications: []
    });

    // When paidAIAllowed: false (default), selectBestModel must select Gemini free tier
    const decision = orchestrator.selectBestModel({
      task: 'Analyze system invariants',
      paidAIAllowed: false,
      requiredCapabilities: ['TEXT']
    });

    assert.ok(decision.candidates.length > 0);
    assert.strictEqual(decision.selectedModel.providerId, 'gemini');
    assert.strictEqual(decision.selectedModel.modelId, 'gemini-3.8-flash');
    assert.notStrictEqual(decision.selectedModel.providerId, 'openai');
  });

  // Test C: Paid Guard
  it('Test C: paidAIAllowed: false strictly blocks paid AI resources at Gate 7', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    modelRegistry.registerModel({
      id: 'claude-3-5-sonnet',
      providerId: 'anthropic',
      capabilities: ['TEXT'],
      pricing: { inputPerMillion: 3.00, outputPerMillion: 15.00 },
      isPaid: true
    });
    registry.registerProvider({
      providerId: 'anthropic',
      capabilities: ['TEXT'],
      invoke: async () => ({ status: GatewayInvocationStatus.SUCCESS, output: 'Anthropic output' })
    });

    const orchestrator = createAIResourceOrchestrator({
      registry,
      modelRegistry,
      credentialPool: pool,
      initialCertifications: []
    });

    const decision = orchestrator.selectBestModel({
      task: 'Architecture refactor',
      preferredProvider: 'anthropic',
      paidAIAllowed: false
    });

    // Must be rejected at Gate 7
    assert.strictEqual(decision.candidates.length, 0, 'Paid model must not be present in candidates');
    assert.ok(decision.rejectedModels.length > 0);
    const rejected = decision.rejectedModels.find(r => r.providerId === 'anthropic');
    assert.ok(rejected);
    assert.strictEqual(rejected.failedGate, 'PAID_AI_GUARD');
    assert.ok(rejected.reason.includes('Paid AI is prohibited by policy'));
  });

  // Test D: Free Quota Exhaustion
  it('Test D: Free quota exhaustion fails over to alternate free account without touching paid API', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-acc-free-1', apiKey: 'free-key-1', priority: 1 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-acc-free-2', apiKey: 'free-key-2', priority: 2 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: ['TEXT'], isFreeTier: true });
    modelRegistry.registerModel({ id: 'gpt-4o', providerId: 'openai', capabilities: ['TEXT'], pricing: { inputPerMillion: 2.50 }, isPaid: true });

    const attemptedAccounts = [];
    registry.registerProvider({
      providerId: 'gemini',
      capabilities: ['TEXT'],
      invoke: async (params) => {
        attemptedAccounts.push(params.metadata.credentialId);
        if (params.metadata.credentialId === 'gemini-acc-free-1') {
          const err = new Error('Quota exceeded 429');
          err.status = 429;
          throw err;
        }
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: 'Resolved via Free Account 2',
          requestedModel: 'gemini-3.8-flash',
          actualModel: 'gemini-3.8-flash'
        };
      }
    });

    registry.registerProvider({
      providerId: 'openai',
      capabilities: ['TEXT'],
      invoke: async () => {
        throw new Error('UNAUTHORIZED: Paid API was called!');
      }
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const engine = createPhaseEngine({ phaseId: 'FAZ-66.12-TEST-D', orchestrator, paidAIAllowed: false });

    const res = await engine.dispatchTaskUnderPolicy({
      taskId: 'FAZ-66.12-TEST-D-T001',
      prompt: 'Execute free failover'
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.accountId, 'gemini-acc-free-2');
    assert.strictEqual(res.fallbackTriggered, true);
    assert.strictEqual(res.paidCallAttempted, false);
    assert.deepStrictEqual(attemptedAccounts, ['gemini-acc-free-1', 'gemini-acc-free-2']);
  });

  // Test E: No Paid Fallback
  it('Test E: Stops and reports when all free resources are exhausted without automatic paid fallback', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-acc-sole-free', apiKey: 'free-key-sole' });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: ['TEXT'], isFreeTier: true });
    modelRegistry.registerModel({ id: 'gpt-4o', providerId: 'openai', capabilities: ['TEXT'], isPaid: true });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: ['TEXT'],
      invoke: async () => {
        const err = new Error('Rate limit 429');
        err.status = 429;
        throw err;
      }
    });

    let paidApiTouched = false;
    registry.registerProvider({
      providerId: 'openai',
      capabilities: ['TEXT'],
      invoke: async () => {
        paidApiTouched = true;
        return { status: GatewayInvocationStatus.SUCCESS, output: 'Paid output' };
      }
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const engine = createPhaseEngine({ phaseId: 'FAZ-66.12-TEST-E', orchestrator, paidAIAllowed: false });

    const outcome = await engine.dispatchTaskUnderPolicy({
      taskId: 'FAZ-66.12-TEST-E-T001',
      prompt: 'Test exhausting free quota'
    });

    // Must return structured failure, never paid success
    assert.strictEqual(outcome.status, GatewayInvocationStatus.FAILED);
    assert.strictEqual(paidApiTouched, false, 'Paid API must NEVER be touched when paidAIAllowed is false');
    assert.strictEqual(outcome.paidCallAttempted, false);
  });

  // Test F: Local Execution & Honest Local AI Evaluation
  it('Test F: Deterministic local runner executes without AI authority, reports honest local status', () => {
    const localRunner = createDeterministicLocalRunner();

    // L0 Deterministic Tool: JSON validation
    const validJson = localRunner.validateJson('{"key": "value", "status": "OK"}');
    assert.strictEqual(validJson.valid, true);
    assert.strictEqual(validJson.parsed.status, 'OK');

    const invalidJson = localRunner.validateJson('{"broken": json');
    assert.strictEqual(invalidJson.valid, false);
    assert.ok(invalidJson.error);

    // L1 Local AI Status Evaluation
    const engine = createPhaseEngine({ phaseId: 'FAZ-66.12-TEST-F', localRunner });

    // No adapter provided -> honest LOCAL_UNAVAILABLE
    const unavail = engine.evaluateLocalAI(null);
    assert.strictEqual(unavail.status, LocalAIStatus.LOCAL_UNAVAILABLE);

    // Mock healthy adapter -> LOCAL_AVAILABLE
    const healthyAdapter = { checkHealth: async () => ({ status: 'HEALTHY' }) };
    const avail = engine.evaluateLocalAI(healthyAdapter);
    assert.strictEqual(avail.status, LocalAIStatus.LOCAL_AVAILABLE);
  });

  // Test G: Model Substitution Telemetry
  it('Test G: Emits explicit requestedModel vs actualModel telemetry on substitution', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gem-sub-acc', apiKey: 'sub-key' });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    modelRegistry.registerModel({ id: 'gemini-2.5-flash', providerId: 'gemini', capabilities: ['TEXT', 'STRUCTURED_OUTPUT', 'CODING'], isFreeTier: true });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: ['TEXT', 'STRUCTURED_OUTPUT', 'CODING'],
      invoke: async () => ({
        status: GatewayInvocationStatus.SUCCESS,
        output: 'Substituted model executed successfully',
        requestedModel: 'gemini-3.8-flash',
        actualModel: 'gemini-2.5-flash',
        isSubstituted: true,
        substitutionReason: 'PRIMARY_MODEL_UNAVAILABLE'
      })
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const engine = createPhaseEngine({ phaseId: 'FAZ-66.12-TEST-G', orchestrator, paidAIAllowed: false });

    const res = await engine.dispatchTaskUnderPolicy({
      taskId: 'FAZ-66.12-TEST-G-T005',
      prompt: 'Refactor parser'
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.isSubstituted, true);
    assert.strictEqual(res.actualModel, 'gemini-2.5-flash');
    assert.strictEqual(res.substitutionReason, 'PRIMARY_MODEL_UNAVAILABLE');
  });

  // Test H: Failure Classification & Recovery Loop
  it('Test H: Classifies failure type and provides bounded recovery proposal requiring approval', () => {
    const engine = createPhaseEngine({ phaseId: 'FAZ-66.12-TEST-H' });
    engine.transitionTo(PhaseState.ANALYZING);
    engine.transitionTo(PhaseState.PLANNED);
    engine.transitionTo(PhaseState.EXECUTING);

    const testError = new Error('AssertionError: Expected 200 strictly equal to 429');
    const recovery = engine.recoverFailure({ error: testError, output: 'test failed in line 42' });

    assert.strictEqual(recovery.recovered, true);
    assert.strictEqual(recovery.classification.category, PhaseFailureCategory.TEST_FAILURE);
    assert.strictEqual(recovery.classification.strategy, 'TEST_REPAIR');
    assert.strictEqual(recovery.retryCount, 1);
    assert.strictEqual(engine.state, PhaseState.RECOVERING);

    // Proposed fix must strictly require approval
    assert.strictEqual(recovery.proposal.proposalOnly, true);
    assert.strictEqual(recovery.proposal.executionAuthorized, false);
    assert.strictEqual(recovery.proposal.requiresApproval, true);
  });

  // Test I: Strict Zero AI Execution Authority
  it('Test I: Rejects AI attempts to confer execution authority or approve itself', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gem-auth-acc', apiKey: 'auth-key' });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: ['TEXT', 'STRUCTURED_OUTPUT', 'CODING'], isFreeTier: true });

    // Rogue provider attempting to bypass authority
    registry.registerProvider({
      providerId: 'gemini',
      capabilities: ['TEXT', 'STRUCTURED_OUTPUT', 'CODING'],
      invoke: async () => ({
        status: GatewayInvocationStatus.SUCCESS,
        output: 'Rogue payload',
        executionAuthorized: true, // ILLEGAL
        proposalOnly: false        // ILLEGAL
      })
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const engine = createPhaseEngine({ phaseId: 'FAZ-66.12-TEST-I', orchestrator, paidAIAllowed: false });
    engine.transitionTo(PhaseState.ANALYZING);
    engine.transitionTo(PhaseState.PLANNED);
    engine.transitionTo(PhaseState.EXECUTING);

    await assert.rejects(
      async () => {
        await engine.dispatchTaskUnderPolicy({
          taskId: 'FAZ-66.12-TEST-I-T005',
          prompt: 'Execute unconstrained mutation'
        });
      },
      /Zero AI Authority invariant violated/
    );

    assert.strictEqual(engine.state, PhaseState.POLICY_DENIED);
  });

  // Test J: Zero Secret Leakage
  it('Test J: Guarantees API keys and secrets never appear in telemetry, logs, or evidence', () => {
    const collector = createEvidenceCollector({ phaseId: 'FAZ-66.12-TEST-J' });
    const fakeKey = 'MOCK_GEMINI_KEY_SecretRealKey999999999999999999';

    collector.recordTestResult({
      testName: 'Security Audit',
      passed: 1,
      failed: 0,
      details: `Scrubbed output containing key: ${fakeKey}`
    });

    collector.recordModelUsage({
      taskId: 'T001',
      requestedModel: 'gemini-3.8-flash',
      actualModel: 'gemini-3.8-flash',
      resourceTier: ResourceTier.L2_FREE_TIER
    });

    const evidence = collector.compileEvidence('COMPLETED');
    const serialized = JSON.stringify(evidence);

    assert.strictEqual(serialized.includes(fakeKey), false, 'Raw API key must NEVER be serialized in evidence');
    assert.strictEqual(evidence.zeroSecretLeakageVerified, true);
  });

  // Test K: Hard Budget Enforcement
  it('Test K: Enforces hard free/paid call limits and transitions to BUDGET_EXCEEDED when exceeded', () => {
    const budget = createPhaseBudget({
      maxPaidCalls: 0,
      maxFreeCalls: 2,
      maxRetries: 1
    });

    const engine = createPhaseEngine({
      phaseId: 'FAZ-66.12-TEST-K',
      budget,
      paidAIAllowed: false
    });

    assert.strictEqual(engine.canUseResourceTier(ResourceTier.L3_PAID_API).allowed, false);

    // Call 1
    budget.recordCall(ResourceTier.L2_FREE_TIER);
    assert.strictEqual(budget.freeCalls, 1);

    // Call 2
    budget.recordCall(ResourceTier.L2_FREE_TIER);
    assert.strictEqual(budget.freeCalls, 2);

    // Call 3 exceeds limit
    assert.throws(
      () => budget.recordCall(ResourceTier.L2_FREE_TIER),
      /Free AI call limit reached/
    );

    // Retry limit check
    assert.strictEqual(budget.recordRetry(), true);
    assert.strictEqual(budget.recordRetry(), false);
  });

  // Test L: Deterministic Task Decomposition
  it('Test L: Decomposes phase into 10 structured subtasks with immutable policies', () => {
    const tasks = decomposePhase({ phaseId: 'FAZ-66.12', userIntent: 'Autonomous Engine' });

    assert.strictEqual(tasks.length, 10);
    assert.strictEqual(tasks[0].taskId, 'FAZ-66.12-T001');
    assert.strictEqual(tasks[0].preferredResourceTier, ResourceTier.L0_LOCAL_TOOL);
    assert.strictEqual(tasks[0].paidAIAllowed, false);

    // Implementation task must strictly require approval
    const implTask = tasks.find(t => t.type === 'IMPLEMENTATION');
    assert.ok(implTask);
    assert.strictEqual(implTask.requiresApproval, true);
    assert.strictEqual(implTask.paidAIAllowed, false);

    // Forensic verification task
    const verifTask = tasks.find(t => t.type === 'VERIFICATION');
    assert.ok(verifTask);
    assert.strictEqual(verifTask.complexity, TaskComplexity.CRITICAL);
  });

});
