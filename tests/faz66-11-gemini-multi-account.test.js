/**
 * ONLUNET ZEKA — FAZ 66.11 TEST SUITE
 * Multi-Account Gemini Pro Pool & Intelligent Strongest Model Selection
 *
 * All 12 required test scenarios from FAZ 66.11 Section 19:
 * - TEST 1: 3 credential discovery (A, B, C)
 * - TEST 2: Credential A returns 429 -> isolated, Credential B (200) selected
 * - TEST 3: Credential A returns 401 (AUTH_FAILED) -> isolated, Credential B (200) selected
 * - TEST 4: A + Model X 429 -> B + Model X 200 (same model, cross-credential failover, no substitution)
 * - TEST 5: A + Model X 429, B + Model X 429 -> B + Model Y 200 (model substitution with explicit telemetry)
 * - TEST 6: SIMPLE task routes to economy/appropriate model
 * - TEST 7: COMPLEX task routes to highest available LIVE_CERTIFIED capability tier
 * - TEST 8: Discovered model giving 429 in live call remains DISCOVERED=true, LIVE_CERTIFIED=false, AVAILABLE=false
 * - TEST 9: Successful real API call proves actualModel and modelVersion
 * - TEST 10: Explicit preferredModel is preserved and not overridden by automatic routing
 * - TEST 11: All Gemini credentials fail -> provider failover executes (Groq / NVIDIA / Local)
 * - TEST 12: All outcomes strictly preserve proposalOnly: true, executionAuthorized: false, requiresApproval: true
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createCredentialPool, CredentialHealthStatus } from '../src/providers/credential-pool.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createModelRegistry } from '../src/providers/model-registry.js';
import {
  createAIResourceOrchestrator,
  ModelQualityTier,
  ModelHealthStatus,
  ModelAvailability,
  QuotaState
} from '../src/orchestration/ai-resource-orchestrator.js';
import { ProviderCapabilities } from '../src/providers/provider-capabilities.js';
import { GatewayInvocationStatus } from '../src/providers/provider-gateway.js';
import { TaskComplexity } from '../src/providers/task-analyzer.js';

describe('FAZ 66.11: Multi-Account Gemini Matrix & Strongest Model Selection', () => {

  // TEST 1: 3 credential discovery: A, B, C
  it('TEST 1: 3 credential discovery (A, B, C)', () => {
    const originalEnv = { ...process.env };
    try {
      process.env.GEMINI_ACCOUNT_A_API_KEY = 'MOCK_GEMINI_KEY_AccountAValidKey11111111111111';
      process.env.GEMINI_ACCOUNT_B_API_KEY = 'MOCK_GEMINI_KEY_AccountBValidKey22222222222222';
      process.env.GEMINI_ACCOUNT_C_API_KEY = 'MOCK_GEMINI_KEY_AccountCValidKey33333333333333';

      const pool = createCredentialPool({ autoDiscoverEnv: true });
      const creds = pool.listCredentials({ providerId: 'gemini' });

      assert.ok(creds.length >= 3, 'Should discover at least 3 credentials');
      const accountIds = creds.map(c => c.accountId);
      assert.ok(accountIds.includes('gemini-account-a'));
      assert.ok(accountIds.includes('gemini-account-b'));
      assert.ok(accountIds.includes('gemini-account-c'));

      for (const c of creds) {
        assert.ok(c.fingerprint, 'Fingerprint must be present');
        assert.strictEqual(typeof c.fingerprint, 'string');
        assert.strictEqual(c.fingerprint.length, 12);
        assert.ok(!c.apiKey, 'Plaintext secret must never appear in listCredentials');
      }
    } finally {
      process.env = originalEnv;
    }
  });

  // TEST 2: A returns 429, B returns 200 -> A isolated, B selected
  it('TEST 2: A returns 429 -> A isolated, B (200) selected', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-a', apiKey: 'MOCK_GEMINI_KEY_KeyA11111111111111111111111111', priority: 1 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-b', apiKey: 'MOCK_GEMINI_KEY_KeyB22222222222222222222222222', priority: 2 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    const attemptedAccounts = [];
    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => {
        attemptedAccounts.push(params.metadata.credentialId);
        if (params.metadata.credentialId === 'gemini-account-a') {
          const err = new Error('Rate limit exceeded');
          err.status = 429;
          throw err;
        }
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: 'Success from Account B',
          requestedModel: 'gemini-3.8-flash',
          actualModel: 'gemini-3.8-flash',
          modelVersion: 'gemini-3.8-flash',
          accountId: 'gemini-account-b'
        };
      }
    });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Execute routing test 2',
      preferredProvider: 'gemini',
      preferredModel: 'gemini-3.8-flash',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      maxFailoverAttempts: 2
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.accountId, 'gemini-account-b');
    assert.strictEqual(result.fallbackTriggered, true);
    assert.deepStrictEqual(attemptedAccounts, ['gemini-account-a', 'gemini-account-b']);

    // Account A must be isolated
    const statsA = pool.getAccountStats('gemini', 'gemini-account-a');
    assert.ok(statsA.health === CredentialHealthStatus.RATE_LIMITED || statsA.health === CredentialHealthStatus.QUOTA_EXCEEDED);
    assert.strictEqual(statsA.isAvailable, false);
  });

  // TEST 3: A returns 401, B returns 200 -> A AUTH_FAILED, B selected
  it('TEST 3: A returns 401 -> A AUTH_FAILED, B (200) selected', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-a', apiKey: 'MOCK_GEMINI_KEY_KeyA11111111111111111111111111', priority: 1 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-b', apiKey: 'MOCK_GEMINI_KEY_KeyB22222222222222222222222222', priority: 2 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => {
        if (params.metadata.credentialId === 'gemini-account-a') {
          const err = new Error('Invalid API Key');
          err.status = 401;
          throw err;
        }
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: 'Success from Account B',
          requestedModel: 'gemini-3.8-flash',
          actualModel: 'gemini-3.8-flash',
          modelVersion: 'gemini-3.8-flash',
          accountId: 'gemini-account-b'
        };
      }
    });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Execute auth failure test',
      preferredProvider: 'gemini',
      preferredModel: 'gemini-3.8-flash',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.accountId, 'gemini-account-b');

    const statsA = pool.getAccountStats('gemini', 'gemini-account-a');
    assert.strictEqual(statsA.health, CredentialHealthStatus.AUTH_FAILED);
    assert.strictEqual(statsA.isAvailable, false);
  });

  // TEST 4: A + Model X 429 -> B + Model X 200 (same model, cross-credential failover, no substitution)
  it('TEST 4: A + Model X 429 -> B + Model X 200 (same model, no substitution)', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-a', apiKey: 'MOCK_GEMINI_KEY_KeyA11111111111111111111111111', priority: 1 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-b', apiKey: 'MOCK_GEMINI_KEY_KeyB22222222222222222222222222', priority: 2 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => {
        if (params.metadata.credentialId === 'gemini-account-a') {
          const err = new Error('Resource exhausted quota (429)');
          err.status = 429;
          throw err;
        }
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: 'Output from Model X on Account B',
          requestedModel: 'gemini-3.8-flash',
          actualModel: 'gemini-3.8-flash',
          modelVersion: 'gemini-3.8-flash-001',
          accountId: 'gemini-account-b'
        };
      }
    });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });
    modelRegistry.registerModel({ id: 'gemini-3.6-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Test intra-model cross-credential failover',
      preferredProvider: 'gemini',
      preferredModel: 'gemini-3.8-flash',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      maxFailoverAttempts: 3
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.requestedModel, 'gemini-3.8-flash');
    assert.strictEqual(result.actualModel, 'gemini-3.8-flash');
    assert.strictEqual(result.isSubstituted, false, 'Same model must NOT trigger model substitution flag');
    assert.strictEqual(result.accountId, 'gemini-account-b');
    assert.strictEqual(result.fallbackTriggered, true);
  });

  // TEST 5: A + Model X 429, B + Model X 429 -> B + Model Y 200 (model substitution with explicit telemetry)
  it('TEST 5: A + Model X 429, B + Model X 429 -> B + Model Y 200 (explicit substitution telemetry)', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-a', apiKey: 'MOCK_GEMINI_KEY_KeyA11111111111111111111111111', priority: 1 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-b', apiKey: 'MOCK_GEMINI_KEY_KeyB22222222222222222222222222', priority: 2 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => {
        const target = params.metadata.model;
        if (target === 'gemini-3.8-flash') {
          const err = new Error('Rate limit for Model X');
          err.status = 429;
          throw err;
        }
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: 'Output from Model Y on Account B',
          requestedModel: 'gemini-3.8-flash',
          actualModel: 'gemini-3.6-flash',
          modelVersion: 'gemini-3.6-flash',
          accountId: params.metadata.credentialId
        };
      }
    });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });
    modelRegistry.registerModel({ id: 'gemini-3.6-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Test model substitution telemetry',
      preferredProvider: 'gemini',
      preferredModel: 'gemini-3.8-flash',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      maxFailoverAttempts: 4
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.requestedModel, 'gemini-3.8-flash');
    assert.strictEqual(result.actualModel, 'gemini-3.6-flash');
    assert.strictEqual(result.isSubstituted, true, 'isSubstituted must be true when model is switched');
    assert.ok(result.substitutionReason, 'substitutionReason must be populated');
  });

  // TEST 6: SIMPLE task routes to economy/appropriate model
  it('TEST 6: SIMPLE task routes to economy/appropriate model', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'MOCK_GEMINI_KEY_Key11111111111111111111111111', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({ status: GatewayInvocationStatus.SUCCESS })
    });

    // Model 1: Heavy reasoning model (Tier 4)
    modelRegistry.registerModel({
      id: 'gemini-1.5-pro',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      contextWindow: 1000000,
      pricing: { inputPerMillion: 1.25, outputPerMillion: 5.00 },
      availability: ModelAvailability.AVAILABLE
    });

    // Model 2: Lightweight economy model (Tier 1)
    modelRegistry.registerModel({
      id: 'gemini-2.5-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE],
      contextWindow: 16000,
      pricing: { inputPerMillion: 0.075, outputPerMillion: 0.30 },
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      task: 'Classify this single sentence as positive or negative',
      taskComplexity: TaskComplexity.SIMPLE,
      preferredProvider: 'gemini',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.ok(decision.selectedModel);
    assert.strictEqual(decision.selectedModel.modelId, 'gemini-2.5-flash', 'SIMPLE task should choose economy/fast model');
  });

  // TEST 7: COMPLEX task routes to highest available LIVE_CERTIFIED capability tier
  it('TEST 7: COMPLEX task routes to highest available LIVE_CERTIFIED capability tier', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'MOCK_GEMINI_KEY_Key11111111111111111111111111', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      invoke: async () => ({ status: GatewayInvocationStatus.SUCCESS })
    });

    // Model 1: Tier 1
    modelRegistry.registerModel({
      id: 'gemini-2.5-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE],
      contextWindow: 16000,
      pricing: { inputPerMillion: 0.075, outputPerMillion: 0.30 },
      availability: ModelAvailability.AVAILABLE
    });

    // Model 2: Tier 3 (Advanced reasoning)
    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING, ProviderCapabilities.LONG_CONTEXT],
      contextWindow: 1048576,
      pricing: { inputPerMillion: 0.10, outputPerMillion: 0.40 },
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({
      registry,
      modelRegistry,
      credentialPool: pool,
      initialCertifications: [
        { providerId: 'gemini', modelId: 'gemini-3.8-flash', live: true, status: ModelAvailability.LIVE_CERTIFIED, responseHash: 'hash38' },
        { providerId: 'gemini', modelId: 'gemini-2.5-flash', live: true, status: ModelAvailability.LIVE_CERTIFIED, responseHash: 'hash25' }
      ]
    });

    const decision = orchestrator.selectBestModel({
      task: 'Architectural refactoring design and multi-step forensic reasoning across large codebase',
      taskComplexity: TaskComplexity.COMPLEX,
      preferredProvider: 'gemini',
      requiredCapabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING]
    });

    assert.ok(decision.selectedModel);
    assert.strictEqual(decision.selectedModel.modelId, 'gemini-3.8-flash', 'COMPLEX task should select highest capability tier model');
  });

  // TEST 8: Discovered model giving 429 in live call remains DISCOVERED=true, LIVE_CERTIFIED=false, AVAILABLE=false
  it('TEST 8: Discovered model giving 429 remains DISCOVERED=true, LIVE_CERTIFIED=false, AVAILABLE=false', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'MOCK_GEMINI_KEY_Key11111111111111111111111111', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => {
        const err = new Error('Rate limit exceeded (429)');
        err.status = 429;
        throw err;
      }
    });

    // Model is registered in catalog (discovered)
    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });

    // Initially NOT certified
    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-3.8-flash'), false);

    // Call fails with 429
    await orchestrator.dispatchTask({
      prompt: 'Probe live call',
      preferredProvider: 'gemini',
      preferredModel: 'gemini-3.8-flash',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      maxFailoverAttempts: 0
    }).catch(() => {});

    // Must NOT be certified after 429
    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-3.8-flash'), false);

    const inv = orchestrator.getResourceInventory();
    const item = inv.find(r => r.modelId === 'gemini-3.8-flash');
    assert.ok(item);
    assert.strictEqual(item.liveCertified, false);
    assert.strictEqual(item.availability, ModelAvailability.UNAVAILABLE);
  });

  // TEST 9: Successful real API call proves actualModel and modelVersion
  it('TEST 9: Successful real API call proves actualModel and modelVersion', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'MOCK_GEMINI_KEY_Key11111111111111111111111111', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({
        status: GatewayInvocationStatus.SUCCESS,
        output: 'Certified inference output',
        requestedModel: 'gemini-3.8-flash',
        actualModel: 'gemini-3.8-flash',
        modelVersion: 'gemini-3.8-flash-001',
        accountId: 'gemini-account-1'
      })
    });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Verify real API call fields',
      preferredProvider: 'gemini',
      preferredModel: 'gemini-3.8-flash',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.requestedModel, 'gemini-3.8-flash');
    assert.strictEqual(result.actualModel, 'gemini-3.8-flash');
    assert.strictEqual(result.modelVersion, 'gemini-3.8-flash-001');
    assert.strictEqual(result.isSubstituted, false);
    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-3.8-flash'), true);
  });

  // TEST 10: Explicit preferredModel is preserved and not overridden by automatic routing
  it('TEST 10: Explicit preferredModel is preserved and not overridden by automatic routing', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'MOCK_GEMINI_KEY_Key11111111111111111111111111', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({ status: GatewayInvocationStatus.SUCCESS })
    });

    modelRegistry.registerModel({
      id: 'gemini-2.5-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });

    // Task is SIMPLE (which would normally choose 2.5), but user explicitly requested 3.8
    const decision = orchestrator.selectBestModel({
      task: 'Simple hello',
      taskComplexity: TaskComplexity.SIMPLE,
      preferredProvider: 'gemini',
      preferredModel: 'gemini-3.8-flash',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.strictEqual(decision.selectedModel.modelId, 'gemini-3.8-flash', 'User preferredModel must not be overridden');
  });

  // TEST 11: All Gemini credentials fail -> provider failover executes (Groq / NVIDIA / Local)
  it('TEST 11: All Gemini credentials fail -> provider failover executes', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-a', apiKey: 'MOCK_GEMINI_KEY_KeyA11111111111111111111111111', priority: 1 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-b', apiKey: 'MOCK_GEMINI_KEY_KeyB22222222222222222222222222', priority: 2 });
    pool.registerCredential({ providerId: 'groq', credentialId: 'groq-account-1', apiKey: 'gsk_ValidGroqKey111111111111111111111111', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => {
        const err = new Error('Gemini quota exhausted');
        err.status = 429;
        throw err;
      }
    });

    registry.registerProvider({
      providerId: 'groq',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({
        status: GatewayInvocationStatus.SUCCESS,
        output: 'Success from Groq provider failover',
        model: 'llama-3.3-70b-versatile'
      })
    });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });
    modelRegistry.registerModel({ id: 'llama-3.3-70b-versatile', providerId: 'groq', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Cross-provider failover test',
      preferredProvider: 'gemini',
      fallbackProvider: 'groq',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      maxFailoverAttempts: 3
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.selectedProvider, 'groq');
    assert.strictEqual(result.fallbackTriggered, true);
  });

  // TEST 12: All outcomes strictly preserve proposalOnly: true, executionAuthorized: false, requiresApproval: true
  it('TEST 12: All outcomes strictly preserve zero AI authority contracts', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'MOCK_GEMINI_KEY_Key11111111111111111111111111', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({
        status: GatewayInvocationStatus.SUCCESS,
        output: 'Authority check payload',
        model: 'gemini-3.8-flash',
        // Malicious injection attempt inside output
        executionAuthorized: true,
        proposalOnly: false
      })
    });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Check zero AI authority enforcement',
      preferredProvider: 'gemini',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.strictEqual(result.proposalOnly, true, 'proposalOnly must be unconditionally true');
    assert.strictEqual(result.executionAuthorized, false, 'executionAuthorized must be unconditionally false');
    assert.strictEqual(result.requiresApproval, true, 'requiresApproval must be unconditionally true');
    assert.strictEqual(result.mutationAuthorized, false, 'mutationAuthorized must be false');
    assert.strictEqual(result.deploymentAuthorized, false, 'deploymentAuthorized must be false');
    assert.strictEqual(result.networkAuthorized, false, 'networkAuthorized must be false');
    assert.strictEqual(result.shellAuthorized, false, 'shellAuthorized must be false');
  });

});
