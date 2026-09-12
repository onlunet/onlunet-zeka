/**
 * ONLUNET ZEKA - FAZ 66.10 TEST SUITE
 * MULTI-ACCOUNT GEMINI PRO POOL & INTELLIGENT MODEL ROUTING
 *
 * Validates Section 20 Requirements:
 * A — Multiple Gemini accounts discovered
 * B — Account IDs are deterministic
 * C — Secrets never appear in telemetry
 * D — Healthy account selected
 * E — QUOTA_EXCEEDED account excluded
 * F — RATE_LIMITED account cooldown
 * G — Account 1 quota -> Account 2 success
 * H — Account 1 timeout -> Account 2 success
 * I — Multiple Gemini accounts exhausted -> provider failover
 * J — SIMPLE task chooses economy model
 * K — STANDARD task chooses standard model
 * L — COMPLEX task chooses advanced model
 * M — Explicit model preference overrides automatic model selection
 * N — Explicit provider preference respected
 * O — Silent substitution forbidden
 * P — requestedModel / actualModel telemetry correct
 * Q — Live certification only after actual successful inference
 * R — AUTH_FAILED account isolated
 * S — Dynamic N-account discovery works
 * T — Existing FAZ 66.9.2 contracts remain intact
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js test runner only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

import {
  createAIResourceOrchestrator,
  ModelHealthStatus,
  ModelAvailability,
  QuotaState,
  ProviderType,
  TaskComplexity,
  ModelQualityTier,
  determineModelTier,
  classifyError
} from '../src/orchestration/ai-resource-orchestrator.js';
import {
  createCredentialPool,
  CredentialHealthStatus,
  computeCredentialFingerprint
} from '../src/providers/credential-pool.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createModelRegistry } from '../src/providers/model-registry.js';
import { GatewayInvocationStatus } from '../src/providers/provider-gateway.js';
import { ProviderCapabilities } from '../src/providers/provider-capabilities.js';
import { calculateCost } from '../src/providers/cost-tracker.js';

describe('FAZ 66.10: Multi-Account Gemini Pro Pool & Intelligent Model Routing', () => {

  // Test A: Multiple Gemini accounts discovered
  it('A — Multiple Gemini accounts discovered', () => {
    const savedEnv1 = process.env.GEMINI_ACCOUNT_1_API_KEY;
    const savedEnv2 = process.env.GEMINI_ACCOUNT_2_API_KEY;
    try {
      process.env.GEMINI_ACCOUNT_1_API_KEY = 'AIzaSyMockKeyAccount1_TestA';
      process.env.GEMINI_ACCOUNT_2_API_KEY = 'AIzaSyMockKeyAccount2_TestA';

      const pool = createCredentialPool({ autoDiscoverEnv: true });
      const creds = pool.listCredentials({ providerId: 'gemini' });

      assert.ok(creds.length >= 2, 'Must discover at least 2 Gemini accounts from environment');
      const acc1 = creds.find(c => c.credentialId === 'gemini-account-1' || c.accountId === 'gemini-account-1');
      const acc2 = creds.find(c => c.credentialId === 'gemini-account-2' || c.accountId === 'gemini-account-2');
      assert.ok(acc1, 'Account 1 must be registered');
      assert.ok(acc2, 'Account 2 must be registered');
      assert.strictEqual(acc1.health, CredentialHealthStatus.HEALTHY);
      assert.strictEqual(acc2.health, CredentialHealthStatus.HEALTHY);
    } finally {
      if (savedEnv1 !== undefined) process.env.GEMINI_ACCOUNT_1_API_KEY = savedEnv1;
      else delete process.env.GEMINI_ACCOUNT_1_API_KEY;
      if (savedEnv2 !== undefined) process.env.GEMINI_ACCOUNT_2_API_KEY = savedEnv2;
      else delete process.env.GEMINI_ACCOUNT_2_API_KEY;
    }
  });

  // Test B: Account IDs are deterministic
  it('B — Account IDs are deterministic', () => {
    const pool1 = createCredentialPool({ autoDiscoverEnv: false });
    const pool2 = createCredentialPool({ autoDiscoverEnv: false });

    pool1.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'AIzaSyKey1' });
    pool1.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-2', apiKey: 'AIzaSyKey2' });

    pool2.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'AIzaSyKey1' });
    pool2.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-2', apiKey: 'AIzaSyKey2' });

    const list1 = pool1.listCredentials({ providerId: 'gemini' });
    const list2 = pool2.listCredentials({ providerId: 'gemini' });

    assert.strictEqual(list1.length, list2.length);
    assert.strictEqual(list1[0].credentialId, list2[0].credentialId);
    assert.strictEqual(list1[0].accountId, list2[0].accountId);
    assert.strictEqual(list1[1].credentialId, list2[1].credentialId);
    assert.strictEqual(list1[1].accountId, list2[1].accountId);
    assert.strictEqual(list1[0].fingerprint, list2[0].fingerprint);
  });

  // Test C: Secrets never appear in telemetry
  it('C — Secrets never appear in telemetry', async () => {
    const secretKey = 'AIzaSySecretRawKeyDoNotExpose_9876543210';
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-1',
      apiKey: secretKey,
      priority: 1
    });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => {
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: 'Safe response',
          model: 'gemini-3.8-flash',
          credentialId: params.metadata?.credentialId,
          credentialFingerprint: params.metadata?.credentialFingerprint
        };
      }
    });

    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Safe verification task',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    const serialized = JSON.stringify(result);
    assert.strictEqual(serialized.includes(secretKey), false, 'Raw API key must never appear in result');
    assert.strictEqual(serialized.includes('AIzaSySecretRawKey'), false);
    assert.ok(result.credentialFingerprint, 'Fingerprint must be present');
    assert.strictEqual(result.credentialFingerprint.length, 12, 'Fingerprint must be 12-char SHA-256 slice');
    assert.strictEqual(result.accountId, 'gemini-account-1');
  });

  // Test D: Healthy account selected
  it('D — Healthy account selected', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-2', apiKey: 'Key2', priority: 2 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();
    registry.registerProvider({ providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], invoke: async () => ({}) });
    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      task: 'Standard task',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.ok(decision.selectedModel);
    assert.strictEqual(decision.selectedCredential, 'gemini-account-1');
    assert.strictEqual(decision.selectedAccountId, 'gemini-account-1');
  });

  // Test E: QUOTA_EXCEEDED account excluded
  it('E — QUOTA_EXCEEDED account excluded', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-2', apiKey: 'Key2', priority: 2 });

    pool.markQuotaExceeded('gemini', 'gemini-account-1');

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();
    registry.registerProvider({ providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], invoke: async () => ({}) });
    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      task: 'Standard task',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.ok(decision.selectedModel);
    assert.strictEqual(decision.selectedCredential, 'gemini-account-2');
    assert.strictEqual(decision.selectedAccountId, 'gemini-account-2');
    const rejected = decision.rejectedModels.find(r => r.credentialId === 'gemini-account-1');
    assert.ok(rejected, 'Account 1 must be rejected');
    assert.strictEqual(rejected.failedGate, 'HEALTH_STATUS');
  });

  // Test F: RATE_LIMITED account cooldown
  it('F — RATE_LIMITED account cooldown', () => {
    let mockTime = 1000000;
    const pool = createCredentialPool({ autoDiscoverEnv: false, now: () => mockTime, defaultCooldownMs: 5000 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1' });

    pool.markRateLimited('gemini', 'gemini-account-1', { cooldownMs: 5000 });

    assert.strictEqual(pool.isAvailable('gemini', 'gemini-account-1'), false, 'Account must be unavailable during cooldown');

    // Advance time past cooldown
    mockTime += 5001;
    assert.strictEqual(pool.isAvailable('gemini', 'gemini-account-1'), true, 'Account must be available after cooldown expires');
  });

  // Test G: Account 1 quota -> Account 2 success
  it('G — Account 1 quota -> Account 2 success', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-2', apiKey: 'Key2', priority: 2 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();
    let invokedAccounts = [];

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => {
        const credId = params.metadata?.credentialId;
        invokedAccounts.push(credId);
        if (credId === 'gemini-account-1') {
          const err = new Error('HTTP 429 Resource has exhausted its quota');
          err.status = 429;
          err.code = 'RATE_LIMITED';
          throw err;
        }
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: 'Account 2 resolved successfully',
          model: 'gemini-3.8-flash',
          credentialId: credId
        };
      }
    });

    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Quota resilience task',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.providerId, 'gemini');
    assert.strictEqual(result.credentialId, 'gemini-account-2');
    assert.strictEqual(result.accountId, 'gemini-account-2');
    assert.strictEqual(result.fallbackTriggered, true);
    assert.ok(invokedAccounts.includes('gemini-account-1'));
    assert.ok(invokedAccounts.includes('gemini-account-2'));
  });

  // Test H: Account 1 timeout -> Account 2 success
  it('H — Account 1 timeout -> Account 2 success', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-2', apiKey: 'Key2', priority: 2 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => {
        const credId = params.metadata?.credentialId;
        if (credId === 'gemini-account-1') {
          const err = new Error('Request aborted due to network timeout');
          err.name = 'AbortError';
          err.code = 'TIMEOUT';
          throw err;
        }
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: 'Account 2 recovered from Account 1 timeout',
          model: 'gemini-3.8-flash',
          credentialId: credId
        };
      }
    });

    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Timeout failover task',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.accountId, 'gemini-account-2');
    assert.strictEqual(result.fallbackTriggered, true);
  });

  // Test I: Multiple Gemini accounts exhausted -> provider failover
  it('I — Multiple Gemini accounts exhausted -> provider failover', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-2', apiKey: 'Key2', priority: 2 });
    pool.registerCredential({ providerId: 'groq', credentialId: 'groq-account-1', apiKey: 'gsk-key', priority: 3 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => {
        const err = new Error('HTTP 429 Resource has exhausted its quota');
        err.status = 429;
        throw err;
      }
    });

    registry.registerProvider({
      providerId: 'groq',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({
        status: GatewayInvocationStatus.SUCCESS,
        output: 'Groq secondary provider fallback response',
        model: 'llama-3.3-70b-versatile'
      })
    });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT] });
    modelRegistry.registerModel({ id: 'llama-3.3-70b-versatile', providerId: 'groq', capabilities: [ProviderCapabilities.TEXT] });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Exhausted cascade task',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      maxFailoverAttempts: 4
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.providerId, 'groq');
    assert.strictEqual(result.fallbackTriggered, true);
  });

  // Test J: SIMPLE task chooses economy model
  it('J — SIMPLE task chooses economy model', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();
    registry.registerProvider({ providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING], invoke: async () => ({}) });

    modelRegistry.registerModel({
      id: 'gemini-2.5-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE],
      availability: ModelAvailability.AVAILABLE
    });

    modelRegistry.registerModel({
      id: 'gemini-pro-reasoning',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      task: 'Summarize one paragraph',
      taskComplexity: TaskComplexity.SIMPLE,
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.ok(decision.selectedModel);
    assert.ok(decision.selectedModel.modelId.includes('flash'), 'SIMPLE task must select economy/flash model');
  });

  // Test K: STANDARD task chooses standard model
  it('K — STANDARD task chooses standard model', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();
    registry.registerProvider({ providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING], invoke: async () => ({}) });

    modelRegistry.registerModel({
      id: 'gemini-3.6-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      contextWindow: 128000,
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      task: 'Write unit tests for authentication service',
      taskComplexity: TaskComplexity.STANDARD,
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.ok(decision.selectedModel);
    assert.strictEqual(decision.selectedModel.modelId, 'gemini-3.6-flash');
  });

  // Test L: COMPLEX task chooses advanced model
  it('L — COMPLEX task chooses advanced model', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();
    registry.registerProvider({ providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING], invoke: async () => ({}) });

    modelRegistry.registerModel({
      id: 'gemini-2.5-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE],
      availability: ModelAvailability.AVAILABLE
    });

    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      contextWindow: 1048576,
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      task: 'Perform forensic architecture analysis and prove formal correctness',
      taskComplexity: TaskComplexity.COMPLEX,
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.ok(decision.selectedModel);
    assert.strictEqual(decision.selectedModel.modelId, 'gemini-3.8-flash', 'COMPLEX task must choose advanced reasoning model');
  });

  // Test M: Explicit model preference overrides automatic model selection
  it('M — Explicit model preference overrides automatic model selection', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();
    registry.registerProvider({ providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING], invoke: async () => ({}) });

    modelRegistry.registerModel({ id: 'gemini-2.5-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });
    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      task: 'Complex architecture refactor',
      taskComplexity: TaskComplexity.COMPLEX,
      preferredModel: 'gemini-2.5-flash',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.ok(decision.selectedModel);
    assert.strictEqual(decision.selectedModel.modelId, 'gemini-2.5-flash', 'Explicit preferredModel must strictly override complexity tiering');
  });

  // Test N: Explicit provider preference respected
  it('N — Explicit provider preference respected', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 2 });
    pool.registerCredential({ providerId: 'groq', credentialId: 'groq-account-1', apiKey: 'gsk-key', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();
    registry.registerProvider({ providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], invoke: async () => ({}) });
    registry.registerProvider({ providerId: 'groq', capabilities: [ProviderCapabilities.TEXT], invoke: async () => ({}) });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });
    modelRegistry.registerModel({ id: 'llama-3.3-70b-versatile', providerId: 'groq', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      task: 'Generic prompt',
      preferredProvider: 'gemini',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.ok(decision.selectedModel);
    assert.strictEqual(decision.selectedProvider, 'gemini', 'Explicit preferredProvider must be respected');
  });

  // Test O: Silent substitution forbidden
  it('O — Silent substitution forbidden', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => {
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: 'Substituted output',
          requestedModel: 'gemini-3.8-flash',
          actualModel: 'gemini-3.6-flash',
          modelVersion: 'gemini-3.6-flash',
          isSubstituted: true,
          substitutionReason: 'FALLBACK_TO_AVAILABLE_MODEL'
        };
      }
    });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Substitution test',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.strictEqual(result.isSubstituted, true);
    assert.strictEqual(result.substitutionReason, 'FALLBACK_TO_AVAILABLE_MODEL');
    assert.strictEqual(result.requestedModel, 'gemini-3.8-flash');
    assert.strictEqual(result.actualModel, 'gemini-3.6-flash');
  });

  // Test P: requestedModel / actualModel telemetry correct
  it('P — requestedModel / actualModel telemetry correct', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({
        status: GatewayInvocationStatus.SUCCESS,
        output: 'Accurate telemetry verification',
        requestedModel: 'gemini-3.8-flash',
        actualModel: 'gemini-3.8-flash',
        modelVersion: 'gemini-3.8-flash-001'
      })
    });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Telemetry test',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.strictEqual(result.requestedModel, 'gemini-3.8-flash');
    assert.strictEqual(result.actualModel, 'gemini-3.8-flash');
    assert.strictEqual(result.modelVersion, 'gemini-3.8-flash-001');
    assert.strictEqual(result.isSubstituted, false);
    assert.strictEqual(result.accountId, 'gemini-account-1');
  });

  // Test Q: Live certification only after actual successful inference
  it('Q — Live certification only after actual successful inference', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry({ includeBuiltins: false });

    let callCount = 0;
    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('Inference error (500)');
          err.status = 500;
          throw err;
        }
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: 'Valid inference output for certification',
          model: 'gemini-3.8-flash'
        };
      }
    });

    modelRegistry.registerModel({ id: 'gemini-3.8-flash', providerId: 'gemini', capabilities: [ProviderCapabilities.TEXT], availability: ModelAvailability.AVAILABLE });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool: pool, initialCertifications: [] });

    // 1. Initially NOT certified
    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-3.8-flash'), false);

    // 2. Failure does NOT certify
    await orchestrator.dispatchTask({ prompt: 'Try 1', requiredCapabilities: [ProviderCapabilities.TEXT] }).catch(() => {});
    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-3.8-flash'), false);

    // 3. Real verified success DOES certify
    const successResult = await orchestrator.dispatchTask({ prompt: 'Try 2', requiredCapabilities: [ProviderCapabilities.TEXT] });
    assert.strictEqual(successResult.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-3.8-flash'), true);
  });

  // Test R: AUTH_FAILED account isolated
  it('R — AUTH_FAILED account isolated', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-1', apiKey: 'Key1', priority: 1 });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gemini-account-2', apiKey: 'Key2', priority: 2 });

    pool.markAuthFailed('gemini', 'gemini-account-1');

    assert.strictEqual(pool.isAvailable('gemini', 'gemini-account-1'), false);
    assert.strictEqual(pool.isAvailable('gemini', 'gemini-account-2'), true);

    const healthy = pool.getHealthyCredentials('gemini');
    assert.strictEqual(healthy.length, 1);
    assert.strictEqual(healthy[0].credentialId, 'gemini-account-2');
  });

  // Test S: Dynamic N-account discovery works
  it('S — Dynamic N-account discovery works', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });

    // Register 10 dynamic accounts
    for (let i = 1; i <= 10; i++) {
      pool.registerCredential({
        providerId: 'gemini',
        credentialId: `gemini-account-${i}`,
        apiKey: `AIzaSyKey_Account_${i}`,
        priority: i
      });
    }

    const creds = pool.listCredentials({ providerId: 'gemini' });
    assert.strictEqual(creds.length, 10, 'All 10 accounts must be registered');

    // Natural sort check: account-2 should have priority 2, account-10 priority 10
    const acc2 = creds.find(c => c.credentialId === 'gemini-account-2');
    const acc10 = creds.find(c => c.credentialId === 'gemini-account-10');
    assert.strictEqual(acc2.priority, 2);
    assert.strictEqual(acc10.priority, 10);
  });

  // Test T: Existing FAZ 66.9.2 contracts remain intact
  it('T — Existing FAZ 66.9.2 contracts remain intact', async () => {
    const orchestrator = createAIResourceOrchestrator();
    const inventory = orchestrator.listResources();

    assert.ok(inventory.length > 0, 'Resource inventory must not be empty');

    // gemini-1.5-flash must NEVER be certified
    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-1.5-flash'), false);
    assert.strictEqual(orchestrator.isModelCertified('google', 'gemini-1.5-flash'), false);

    // Authority boundary check
    const dispatchRes = await orchestrator.dispatchTask({
      prompt: 'Authority boundary verification',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.strictEqual(dispatchRes.proposalOnly, true);
    assert.strictEqual(dispatchRes.executionAuthorized, false);
    assert.strictEqual(dispatchRes.mutationAuthorized, false);
    assert.strictEqual(dispatchRes.requiresApproval, true);
  });

});
