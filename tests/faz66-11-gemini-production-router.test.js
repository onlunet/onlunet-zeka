/**
 * ONLUNET ZEKA - FAZ 66.11 Test Suite
 * Gemini Pro Multi-Account Production Router
 * 
 * Tests:
 * A — N account discovery
 * B — account ordering
 * C — independent health state
 * D — quota failover
 * E — rate-limit failover
 * F — auth-failed isolation
 * G — same-model cross-account failover
 * H — SIMPLE task economical routing
 * I — COMPLEX task premium routing
 * J — CRITICAL task quality enforcement
 * K — Gemini 3.8 preference when certified
 * L — fallback when Gemini 3.8 unavailable
 * M — no repeated candidate
 * N — maxFailoverAttempts
 * O — telemetry integrity
 * P — secret isolation
 * Q — dynamic model discovery
 * R — live certification enforcement
 * S — provider failover
 * T — dashboard status & regression compatibility
 * 
 * ZERO EXTERNAL DEPENDENCIES: node:test and node:assert only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

import {
  createCredentialPool,
  CredentialHealthStatus,
  computeCredentialFingerprint
} from '../src/providers/credential-pool.js';
import {
  createAIResourceOrchestrator,
  ModelHealthStatus,
  ModelAvailability,
  ModelQualityTier,
  ProviderType,
  ProviderPriority,
  QuotaState,
  GatewayInvocationStatus,
  ProviderCapabilities
} from '../src/orchestration/ai-resource-orchestrator.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { analyzeTask, TaskComplexity } from '../src/providers/task-analyzer.js';

describe('FAZ 66.11: Gemini Pro Multi-Account Production Router Suite', () => {

  // Test A: N account discovery from environment patterns
  it('Test A: Discovers N Gemini accounts from multiple env patterns', () => {
    const origEnv = { ...process.env };
    try {
      process.env.GEMINI_ACCOUNT_1_API_KEY = 'AIzaSyTestKey01111111111111111111111';
      process.env.GEMINI_ACCOUNT_2_API_KEY = 'AIzaSyTestKey02222222222222222222222';
      process.env.GEMINI_ACCOUNT_3_KEY = 'AIzaSyTestKey03333333333333333333333';
      process.env.GEMINI_API_KEY_4 = 'AIzaSyTestKey04444444444444444444444';

      const pool = createCredentialPool({ autoDiscoverEnv: true });
      const creds = pool.listCredentials({ providerId: 'gemini' });

      assert.ok(creds.length >= 4, 'Should discover at least 4 Gemini credentials');
      const ids = creds.map(c => c.credentialId);
      assert.ok(ids.includes('gemini-account-1'), 'Discovers gemini-account-1');
      assert.ok(ids.includes('gemini-account-2'), 'Discovers gemini-account-2');
      assert.ok(ids.includes('gemini-account-3'), 'Discovers gemini-account-3');
      assert.ok(ids.includes('gemini-account-4'), 'Discovers gemini-account-4');
    } finally {
      process.env = origEnv;
    }
  });

  // Test B: Account ordering is deterministic and naturally sorted
  it('Test B: Account ordering is deterministic and naturally sorted', () => {
    const origEnv = { ...process.env };
    try {
      // Intentionally insert out of order
      process.env.GEMINI_ACCOUNT_10_API_KEY = 'AIzaSyTestKey1000000000000000000000';
      process.env.GEMINI_ACCOUNT_2_API_KEY = 'AIzaSyTestKey0200000000000000000000';
      process.env.GEMINI_ACCOUNT_1_API_KEY = 'AIzaSyTestKey0100000000000000000000';

      const pool = createCredentialPool({ autoDiscoverEnv: true });
      const creds = pool.listCredentials({ providerId: 'gemini' });

      assert.strictEqual(creds[0].credentialId, 'gemini-account-1');
      assert.strictEqual(creds[1].credentialId, 'gemini-account-2');
      assert.strictEqual(creds[2].credentialId, 'gemini-account-10');
      assert.strictEqual(creds[0].priority, 1);
      assert.strictEqual(creds[1].priority, 2);
      assert.strictEqual(creds[2].priority, 3);
    } finally {
      process.env = origEnv;
    }
  });

  // Test C: Independent health state per account & model
  it('Test C: Maintains independent health states per account and model', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-alpha', apiKey: 'key-alpha-12345' });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-beta', apiKey: 'key-beta-67890' });

    // Mark model-level rate limit on alpha for 3.8
    pool.markModelRateLimited('gemini', 'acc-alpha', 'gemini-3.8-flash', '429 Rate Limit');

    assert.strictEqual(pool.getModelHealth('gemini', 'acc-alpha', 'gemini-3.8-flash'), CredentialHealthStatus.RATE_LIMITED);
    assert.strictEqual(pool.isCandidateAvailable('gemini', 'acc-alpha', 'gemini-3.8-flash'), false);
    // 3.5 on alpha should remain available
    assert.strictEqual(pool.isCandidateAvailable('gemini', 'acc-alpha', 'gemini-3.5-flash'), true);
    // beta should remain completely healthy and available
    assert.strictEqual(pool.isCandidateAvailable('gemini', 'acc-beta', 'gemini-3.8-flash'), true);
    assert.strictEqual(pool.getCredential('gemini', 'acc-beta').health, CredentialHealthStatus.HEALTHY);
  });

  // Test D: Quota failover across accounts
  it('Test D: Fails over from quota-exceeded account to healthy account', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    const pool = createCredentialPool({ autoDiscoverEnv: false });

    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-01', apiKey: 'key-01-secret' });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-02', apiKey: 'key-02-secret' });

    let acc01Calls = 0;
    let acc02Calls = 0;

    registry.registerProvider({
      providerId: 'gemini',
      name: 'Google Gemini Pro',
      capabilities: [ProviderCapabilities.TEXT],
      priority: 1,
      invoke: async (params) => {
        const credId = params?.metadata?.credentialId;
        if (credId === 'acc-01') {
          acc01Calls++;
          const err = new Error('Resource has been exhausted (e.g. check quota)');
          err.status = 429;
          throw err;
        }
        if (credId === 'acc-02') {
          acc02Calls++;
          return {
            output: 'Success from account 2',
            model: 'gemini-3.8-flash',
            status: GatewayInvocationStatus.SUCCESS
          };
        }
        throw new Error('Unknown credential');
      }
    });

    const orchestrator = createAIResourceOrchestrator({
      registry,
      credentialPool: pool,
      initialCertifications: [
        { providerId: 'gemini', modelId: 'gemini-3.8-flash', httpStatus: 200, live: true }
      ]
    });

    const result = await orchestrator.dispatchTask({
      prompt: 'Summarize production architecture requirements',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      maxFailoverAttempts: 3
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.fallbackTriggered, true);
    assert.strictEqual(acc01Calls, 1);
    assert.strictEqual(acc02Calls, 1);
    assert.strictEqual(result.credentialId, 'acc-02');
    assert.strictEqual(pool.getCredential('gemini', 'acc-01').health, CredentialHealthStatus.QUOTA_EXCEEDED);
    assert.strictEqual(pool.isAvailable('gemini', 'acc-01'), false);
  });

  // Test E: Rate-limit failover & cooldown
  it('Test E: Applies cooldown on RATE_LIMITED account and fails over', async () => {
    let nowTime = 100000;
    const pool = createCredentialPool({ autoDiscoverEnv: false, defaultCooldownMs: 15000, now: () => nowTime });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-rl-1', apiKey: 'key-rl-1' });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-rl-2', apiKey: 'key-rl-2' });

    pool.markRateLimited('gemini', 'acc-rl-1', 'RPM Limit Reached');
    assert.strictEqual(pool.getCredential('gemini', 'acc-rl-1').health, CredentialHealthStatus.RATE_LIMITED);
    assert.strictEqual(pool.isAvailable('gemini', 'acc-rl-1'), false);
    assert.strictEqual(pool.isAvailable('gemini', 'acc-rl-2'), true);

    // Advance time past cooldown
    nowTime += 16000;
    assert.strictEqual(pool.isAvailable('gemini', 'acc-rl-1'), true);
    assert.strictEqual(pool.getCredential('gemini', 'acc-rl-1').health, CredentialHealthStatus.HEALTHY);
  });

  // Test F: AUTH_FAILED isolation
  it('Test F: Strictly isolates AUTH_FAILED account preventing further attempts', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    const pool = createCredentialPool({ autoDiscoverEnv: false });

    pool.registerCredential({ providerId: 'gemini', credentialId: 'bad-auth-acc', apiKey: 'bad-key-123' });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'good-auth-acc', apiKey: 'good-key-456' });

    let badAuthCalls = 0;
    let goodAuthCalls = 0;

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      priority: 1,
      invoke: async (params) => {
        if (params?.metadata?.credentialId === 'bad-auth-acc') {
          badAuthCalls++;
          const err = new Error('API_KEY_INVALID: API key not valid. Please pass a valid API key.');
          err.status = 401;
          throw err;
        }
        goodAuthCalls++;
        return { output: 'Authenticated OK', status: GatewayInvocationStatus.SUCCESS, model: 'gemini-3.8-flash' };
      }
    });

    const orchestrator = createAIResourceOrchestrator({
      registry,
      credentialPool: pool,
      initialCertifications: [{ providerId: 'gemini', modelId: 'gemini-3.8-flash', live: true }]
    });

    const res1 = await orchestrator.dispatchTask({ prompt: 'First test' });
    assert.strictEqual(res1.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res1.credentialId, 'good-auth-acc');
    assert.strictEqual(badAuthCalls, 1);
    assert.strictEqual(goodAuthCalls, 1);

    // Second task: bad-auth-acc must NEVER be called again
    const res2 = await orchestrator.dispatchTask({ prompt: 'Second test' });
    assert.strictEqual(res2.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res2.credentialId, 'good-auth-acc');
    assert.strictEqual(badAuthCalls, 1, 'Bad auth account was not retried');
    assert.strictEqual(goodAuthCalls, 2);
  });

  // Test G: Same-model cross-account failover
  it('Test G: Fails over to another account with the SAME model (no substitution)', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    const pool = createCredentialPool({ autoDiscoverEnv: false });

    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-primary', apiKey: 'key-primary' });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-secondary', apiKey: 'key-secondary' });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      priority: 1,
      invoke: async (params) => {
        if (params?.metadata?.credentialId === 'acc-primary') {
          const err = new Error('429 Quota Exceeded on Primary');
          err.status = 429;
          throw err;
        }
        return {
          output: 'Done on same model',
          model: 'gemini-3.8-flash',
          modelVersion: 'gemini-3.8-flash-001',
          status: GatewayInvocationStatus.SUCCESS
        };
      }
    });

    const orchestrator = createAIResourceOrchestrator({
      registry,
      credentialPool: pool,
      initialCertifications: [{ providerId: 'gemini', modelId: 'gemini-3.8-flash', live: true }]
    });

    const res = await orchestrator.dispatchTask({
      prompt: 'Task for 3.8',
      preferredModel: 'gemini-3.8-flash'
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.actualModel, 'gemini-3.8-flash');
    assert.strictEqual(res.requestedModel, 'gemini-3.8-flash');
    assert.strictEqual(res.isSubstituted, false, 'Model was not substituted');
    assert.strictEqual(res.credentialId, 'acc-secondary');
    assert.strictEqual(res.fallbackTriggered, true);
  });

  // Test H: SIMPLE task economical routing
  it('Test H: Routes SIMPLE tasks to economy model preserving 3.8 quota', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gem-acc-h', apiKey: 'key-h' });

    const orchestrator = createAIResourceOrchestrator({
      credentialPool: pool,
      initialCertifications: [
        { providerId: 'gemini', modelId: 'gemini-3.8-flash', live: true },
        { providerId: 'gemini', modelId: 'gemini-2.5-flash', live: true }
      ]
    });

    const decision = orchestrator.selectBestModel({
      task: 'Format this json to lowercase keys',
      taskComplexity: TaskComplexity.SIMPLE,
      preferredProvider: 'gemini'
    });

    assert.strictEqual(decision.taskComplexity, TaskComplexity.SIMPLE);
    assert.strictEqual(decision.selectedModel.qualityTier, ModelQualityTier.TIER_1);
    assert.notStrictEqual(decision.selectedModel.modelId, 'gemini-3.8-flash', 'Gemini 3.8 is not burned on simple formatting task');
  });

  // Test I: COMPLEX task premium routing
  it('Test I: Routes COMPLEX task to Gemini 3.8 / Tier 3+ when available', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gem-acc-i', apiKey: 'key-i' });

    const orchestrator = createAIResourceOrchestrator({
      credentialPool: pool,
      initialCertifications: [
        { providerId: 'gemini', modelId: 'gemini-3.8-flash', live: true },
        { providerId: 'gemini', modelId: 'gemini-2.5-flash', live: true }
      ]
    });

    const decision = orchestrator.selectBestModel({
      task: 'Multi-file refactor and architectural analysis of distributed scheduler',
      taskComplexity: TaskComplexity.COMPLEX,
      preferredProvider: 'gemini'
    });

    assert.strictEqual(decision.taskComplexity, TaskComplexity.COMPLEX);
    assert.strictEqual(decision.selectedModel.modelId, 'gemini-3.8-flash');
    assert.ok(
      decision.selectedModel.qualityTier === ModelQualityTier.TIER_3 ||
      decision.selectedModel.qualityTier === ModelQualityTier.TIER_4
    );
  });

  // Test J: CRITICAL task quality enforcement
  it('Test J: Routes CRITICAL task prioritizing highest quality tier over cost', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gem-acc-j', apiKey: 'key-j' });

    const orchestrator = createAIResourceOrchestrator({
      credentialPool: pool,
      initialCertifications: [
        { providerId: 'gemini', modelId: 'gemini-3.8-flash', live: true },
        { providerId: 'gemini', modelId: 'gemini-2.5-flash', live: true }
      ]
    });

    const decision = orchestrator.selectBestModel({
      task: 'Production architecture security remediation for data loss prevention',
      taskComplexity: TaskComplexity.CRITICAL,
      preferredProvider: 'gemini'
    });

    assert.strictEqual(decision.taskComplexity, TaskComplexity.CRITICAL);
    assert.ok(
      decision.selectedModel.qualityTier === ModelQualityTier.TIER_3 ||
      decision.selectedModel.qualityTier === ModelQualityTier.TIER_4
    );
    assert.strictEqual(decision.selectedModel.modelId, 'gemini-3.8-flash');
  });

  // Test K: Gemini 3.8 preference when certified
  it('Test K: Prioritizes Gemini 3.8 when certified and available', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gem-acc-k', apiKey: 'key-k' });

    const orchestrator = createAIResourceOrchestrator({
      credentialPool: pool,
      initialCertifications: [
        { providerId: 'gemini', modelId: 'gemini-3.8-flash', live: true }
      ]
    });

    const decision = orchestrator.selectBestModel({
      task: 'Standard coding implementation task',
      preferredProvider: 'gemini'
    });

    assert.strictEqual(decision.selectedModel.modelId, 'gemini-3.8-flash');
    assert.strictEqual(decision.selectedModel.liveCertified, true);
  });

  // Test L: Fallback when Gemini 3.8 unavailable
  it('Test L: Performs graceful substitution with explicit telemetry when Gemini 3.8 is unavailable', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-single', apiKey: 'key-single' });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      priority: 1,
      invoke: async (params) => {
        const model = params?.metadata?.model;
        if (model === 'gemini-3.8-flash') {
          const err = new Error('Model not found: gemini-3.8-flash (404)');
          err.status = 404;
          err.code = 'NOT_FOUND';
          throw err;
        }
        return {
          output: 'Fallback from 3.5 succeeded',
          model: 'gemini-3.5-flash',
          status: GatewayInvocationStatus.SUCCESS
        };
      }
    });

    const orchestrator = createAIResourceOrchestrator({
      registry,
      credentialPool: pool,
      initialCertifications: [
        { providerId: 'gemini', modelId: 'gemini-3.8-flash', live: true },
        { providerId: 'gemini', modelId: 'gemini-3.5-flash', live: true }
      ]
    });

    const res = await orchestrator.dispatchTask({
      prompt: 'Complex task',
      preferredModel: 'gemini-3.8-flash',
      maxFailoverAttempts: 3
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.requestedModel, 'gemini-3.8-flash');
    assert.strictEqual(res.actualModel, 'gemini-3.5-flash');
    assert.strictEqual(res.isSubstituted, true);
    assert.strictEqual(res.fallbackTriggered, true);
  });

  // Test M: No repeated candidate within same task
  it('Test M: Never retries the same candidate identity within the same task execution', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-dup', apiKey: 'key-dup' });

    const attemptedCandidateIds = [];

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      priority: 1,
      invoke: async (params) => {
        const candId = `gemini:${params?.metadata?.model}:${params?.metadata?.credentialId}`;
        attemptedCandidateIds.push(candId);
        const err = new Error('500 Internal Error');
        err.status = 500;
        throw err;
      }
    });

    const orchestrator = createAIResourceOrchestrator({
      registry,
      credentialPool: pool,
      initialCertifications: [{ providerId: 'gemini', modelId: 'gemini-3.8-flash', live: true }]
    });

    await orchestrator.dispatchTask({
      prompt: 'Testing deduplication',
      maxFailoverAttempts: 5
    });

    // Verify all attempted candidate identities are unique
    const uniqueAttempts = new Set(attemptedCandidateIds);
    assert.strictEqual(attemptedCandidateIds.length, uniqueAttempts.size, 'No candidate identity was repeated');
  });

  // Test N: maxFailoverAttempts enforced
  it('Test N: Strictly enforces maxFailoverAttempts limit', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-1', apiKey: 'k1' });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-2', apiKey: 'k2' });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-3', apiKey: 'k3' });

    let attemptsCount = 0;
    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      priority: 1,
      invoke: async () => {
        attemptsCount++;
        const err = new Error('Always failing');
        err.status = 500;
        throw err;
      }
    });

    const orchestrator = createAIResourceOrchestrator({
      registry,
      credentialPool: pool
    });

    const res = await orchestrator.dispatchTask({
      prompt: 'Testing limit',
      maxFailoverAttempts: 2
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.FAILED);
    assert.strictEqual(attemptsCount, 2, 'Stopped exactly after maxFailoverAttempts=2');
  });

  // Test O: Complete Section 17 telemetry schema integrity
  it('Test O: Emits complete Section 17 telemetry schema', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-tel', apiKey: 'key-tel-secret' });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      priority: 1,
      invoke: async () => ({
        output: 'Structured telemetry output',
        model: 'gemini-3.8-flash',
        modelVersion: 'gemini-3.8-flash-001',
        usage: { inputTokens: 42, outputTokens: 18, totalTokens: 60 },
        status: GatewayInvocationStatus.SUCCESS
      })
    });

    const orchestrator = createAIResourceOrchestrator({
      registry,
      credentialPool: pool,
      initialCertifications: [{ providerId: 'gemini', modelId: 'gemini-3.8-flash', live: true }]
    });

    const res = await orchestrator.dispatchTask({
      prompt: 'Testing telemetry payload',
      taskId: 'task-tel-001'
    });

    // Verify all Section 17 fields
    assert.strictEqual(res.taskId, 'task-tel-001');
    assert.strictEqual(res.providerId, 'gemini');
    assert.strictEqual(res.modelId, 'gemini-3.8-flash');
    assert.strictEqual(res.credentialId, 'acc-tel');
    assert.strictEqual(res.requestedModel, 'gemini-3.8-flash');
    assert.strictEqual(res.actualModel, 'gemini-3.8-flash');
    assert.strictEqual(res.modelVersion, 'gemini-3.8-flash-001');
    assert.ok(res.qualityTier, 'Has qualityTier');
    assert.ok(res.taskComplexity, 'Has taskComplexity');
    assert.strictEqual(res.attemptNumber, 1);
    assert.strictEqual(res.fallbackTriggered, false);
    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.ok(typeof res.latencyMs === 'number', 'latencyMs is numeric');
    assert.strictEqual(res.inputTokens, 42);
    assert.strictEqual(res.outputTokens, 18);
    assert.strictEqual(res.totalTokens, 60);
    assert.ok(res.responseHash && res.responseHash.length === 64, 'Has 64-char SHA-256 responseHash');
  });

  // Test P: Secret isolation
  it('Test P: Strict secret isolation: API keys never appear in telemetry or serialized outputs', async () => {
    const rawSecret = 'AIzaSySecretNeverExposeUnderAnyCircumstances999';
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'acc-sec', apiKey: rawSecret });

    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      priority: 1,
      invoke: async () => ({
        output: 'Safe content',
        status: GatewayInvocationStatus.SUCCESS,
        model: 'gemini-3.8-flash'
      })
    });

    const orchestrator = createAIResourceOrchestrator({ registry, credentialPool: pool });
    const res = await orchestrator.dispatchTask({ prompt: 'Safe prompt' });

    const serialized = JSON.stringify(res);
    assert.strictEqual(serialized.includes(rawSecret), false, 'Raw API key is NOT present in serialized result');
    assert.strictEqual(res.credentialFingerprint, computeCredentialFingerprint(rawSecret));
  });

  // Test Q: Dynamic model discovery
  it('Test Q: Dynamically discovers models and registers them into runtime catalog', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      priority: 1,
      discoverModels: async () => [
        { id: 'gemini-custom-experiment', displayName: 'Gemini Experimental 9.9', capabilities: ['TEXT'], contextWindow: 32768 }
      ],
      invoke: async () => ({ output: 'OK', status: GatewayInvocationStatus.SUCCESS })
    });

    const orchestrator = createAIResourceOrchestrator({ registry });
    const discovered = await orchestrator.discoverProviderModels('gemini');

    assert.ok(discovered.length >= 1);
    assert.ok(discovered.some(m => m.id === 'gemini-custom-experiment'));
  });

  // Test R: Live certification enforcement
  it('Test R: Model is never marked LIVE_CERTIFIED without empirical success', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      priority: 1,
      invoke: async () => {
        const err = new Error('Model not available (404)');
        err.status = 404;
        throw err;
      }
    });

    const orchestrator = createAIResourceOrchestrator({ registry });
    const res = await orchestrator.dispatchTask({
      prompt: 'Testing uncertified model',
      preferredModel: 'gemini-uncertified'
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.FAILED);
    const certified = orchestrator.getCertifiedModels();
    assert.strictEqual(certified.some(c => c.modelId === 'gemini-uncertified' && c.live === true), false);
  });

  // Test S: Provider failover cascade (Gemini -> Groq)
  it('Test S: Cascades to secondary provider when all Gemini credentials fail', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gem-1', apiKey: 'k1' });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'gem-2', apiKey: 'k2' });
    pool.registerCredential({ providerId: 'groq', credentialId: 'groq-1', apiKey: 'gsk-12345' });

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      priority: 1,
      invoke: async () => {
        const err = new Error('429 Quota Exceeded on Gemini');
        err.status = 429;
        throw err;
      }
    });

    registry.registerProvider({
      providerId: 'groq',
      capabilities: [ProviderCapabilities.TEXT],
      priority: 2,
      invoke: async () => ({
        output: 'Groq secondary backup response',
        model: 'llama-3.3-70b-versatile',
        status: GatewayInvocationStatus.SUCCESS
      })
    });

    const orchestrator = createAIResourceOrchestrator({
      registry,
      credentialPool: pool,
      initialCertifications: [
        { providerId: 'gemini', modelId: 'gemini-3.8-flash', live: true },
        { providerId: 'groq', modelId: 'llama-3.3-70b-versatile', live: true }
      ]
    });

    const res = await orchestrator.dispatchTask({
      prompt: 'Critical backup test',
      maxFailoverAttempts: 4
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.providerId, 'groq');
    assert.strictEqual(res.modelId, 'llama-3.3-70b-versatile');
    assert.strictEqual(res.fallbackTriggered, true);
  });

  // Test T: Dashboard status & regression compatibility
  it('Test T: Provides programmatic getCredentialPoolStatus() and preserves zero AI authority', async () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'dashboard-acc-1', apiKey: 'd-key-1' });
    pool.registerCredential({ providerId: 'gemini', credentialId: 'dashboard-acc-2', apiKey: 'd-key-2' });

    pool.recordAccountUsage('gemini', 'dashboard-acc-1', {
      inputTokens: 100,
      outputTokens: 50,
      cost: 0.002,
      latencyMs: 1450,
      status: 'SUCCESS'
    });
    pool.markQuotaExceeded('gemini', 'dashboard-acc-2', 'Quota exhausted');

    const orchestrator = createAIResourceOrchestrator({ credentialPool: pool });
    const status = orchestrator.getCredentialPoolStatus('gemini');

    assert.strictEqual(status.providerId, 'gemini');
    assert.strictEqual(status.totalAccounts, 2);
    assert.strictEqual(status.healthyAccounts, 1);
    assert.strictEqual(status.availableAccounts, 1);

    const acc1 = status.accounts.find(a => a.accountId === 'dashboard-acc-1');
    assert.ok(acc1);
    assert.strictEqual(acc1.health, CredentialHealthStatus.HEALTHY);
    assert.strictEqual(acc1.requests, 1);
    assert.strictEqual(acc1.tokens.total, 150);
    assert.strictEqual(acc1.quota, 'AVAILABLE');

    const acc2 = status.accounts.find(a => a.accountId === 'dashboard-acc-2');
    assert.ok(acc2);
    assert.strictEqual(acc2.health, CredentialHealthStatus.QUOTA_EXCEEDED);
    assert.strictEqual(acc2.quota, 'EXHAUSTED');

    // Immutable Zero AI Authority check
    const sampleResult = await orchestrator.dispatchTask({ prompt: 'test' });
    assert.strictEqual(sampleResult.proposalOnly, true);
    assert.strictEqual(sampleResult.executionAuthorized, false);
    assert.strictEqual(sampleResult.requiresApproval, true);
  });

});
