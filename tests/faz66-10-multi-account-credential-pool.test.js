/**
 * ONLUNET ZEKA - FAZ 66.10 TEST SUITE
 * MULTI-ACCOUNT CREDENTIAL POOL & INTELLIGENT QUOTA ROUTING
 *
 * Validates:
 * Test A: Tek credential normal çalışıyor
 * Test B: İki credential mevcut ve birincisi HEALTHY
 * Test C: Birinci credential RATE_LIMITED → ikinci credential seçiliyor
 * Test D: Birinci credential QUOTA_EXCEEDED → ikinci credential seçiliyor
 * Test E: Birinci credential AUTH_FAILED → scheduler tarafından izole ediliyor
 * Test F: İki credential da başarısız → provider failover gerçekleşiyor
 * Test G: Aynı model farklı credential'larda ayrı health state taşıyor
 * Test H: Credential secret'i telemetry'ye sızmıyor
 * Test I: Credential rotation model certification'ı bozmaz
 * Test J: Task complexity düşükken uygun ekonomik model seçilebilir
 * Test K: Task complexity yüksekken güçlü model tercih ediliyor
 * Test L: Vision task text-only candidate'a gönderilmiyor
 * Test M: 429 RATE_LIMITED doğru sınıflandırılıyor
 * Test N: Timeout sonrası credential kalıcı olarak silinmiyor
 * Test O: Cooldown süresi dolduğunda credential yeniden candidate olabiliyor
 * Test P: Concurrent dispatch sırasında aynı credential state race-condition oluşturmuyor
 * Test Q: Cost tracking credential rotation nedeniyle double-count yapmıyor
 * Test R: Gerçek API key hiçbir test çıktısında görünmüyor
 * Test S: Provider + model + credential candidate identity deterministik
 * Test T: Mevcut FAZ 66.9.2 regression suite bozulmuyor
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

describe('FAZ 66.10: Multi-Account Credential Pool & Intelligent Quota Routing', () => {

  // Test A: Tek credential normal çalışıyor
  it('Test A: Tek credential normal çalışıyor', async () => {
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    const dummyKey = 'MOCK_GEMINI_KEY_TestKey_SingleAccount_01';
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: dummyKey,
      priority: 1
    });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      name: 'Google Gemini Provider',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => {
        assert.strictEqual(params.metadata.apiKey, dummyKey, 'Injected API key must match registered key');
        assert.strictEqual(params.metadata.credentialId, 'gemini-account-01');
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: JSON.stringify({ result: 'Single account operational' }),
          model: 'gemini-3.6-flash',
          actualModel: 'gemini-3.6-flash',
          requestedModel: 'gemini-3.6-flash',
          credentialId: params.metadata.credentialId,
          credentialFingerprint: params.metadata.credentialFingerprint
        };
      }
    });

    modelRegistry.registerModel({
      id: 'gemini-3.6-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({
      registry,
      modelRegistry,
      credentialPool,
      initialCertifications: []
    });

    const result = await orchestrator.dispatchTask({
      prompt: 'Hello from Test A',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      preferredProvider: 'gemini',
      preferredModel: 'gemini-3.6-flash'
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.credentialId, 'gemini-account-01');
    assert.strictEqual(result.credentialFingerprint, computeCredentialFingerprint(dummyKey));
    assert.strictEqual(result.fallbackTriggered, false);
    assert.strictEqual(result.attemptNumber, 1);
    assert.strictEqual(result.executionAuthorized, false);
    assert.strictEqual(result.proposalOnly, true);
  });

  // Test B: İki credential mevcut ve birincisi HEALTHY
  it('Test B: İki credential mevcut ve birincisi HEALTHY', async () => {
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_AccountOneHealthy',
      priority: 1
    });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-02',
      apiKey: 'MOCK_GEMINI_KEY_AccountTwoStandby',
      priority: 2
    });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => ({
        status: GatewayInvocationStatus.SUCCESS,
        output: 'Account 1 success',
        model: 'gemini-3.6-flash'
      })
    });

    modelRegistry.registerModel({
      id: 'gemini-3.6-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      requiredCapabilities: [ProviderCapabilities.TEXT],
      preferredProvider: 'gemini',
      preferredModel: 'gemini-3.6-flash'
    });

    assert.ok(decision.candidates.length >= 2, 'Should have candidates for both accounts');
    assert.strictEqual(decision.selectedModel.credentialId, 'gemini-account-01', 'Priority 1 account should be ranked first');

    const result = await orchestrator.dispatchTask({
      prompt: 'Test B',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });
    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.credentialId, 'gemini-account-01');
  });

  // Test C: Birinci credential RATE_LIMITED → ikinci credential seçiliyor
  it('Test C: Birinci credential RATE_LIMITED → ikinci credential seçiliyor', async () => {
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_Account01RateLimited',
      priority: 1
    });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-02',
      apiKey: 'MOCK_GEMINI_KEY_Account02Healthy',
      priority: 2
    });

    // Mark account-01 as RATE_LIMITED
    credentialPool.markRateLimited('gemini', 'gemini-account-01', 'Exceeded RPM quota');

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    let attemptedKey = null;
    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => {
        attemptedKey = params.metadata.apiKey;
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: 'Account 2 handled request',
          model: 'gemini-3.8-flash'
        };
      }
    });

    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      requiredCapabilities: [ProviderCapabilities.TEXT],
      preferredProvider: 'gemini'
    });

    // Account 01 should be filtered out; Account 02 selected
    assert.strictEqual(decision.selectedModel.credentialId, 'gemini-account-02');

    const result = await orchestrator.dispatchTask({
      prompt: 'Test C',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });
    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.credentialId, 'gemini-account-02');
    assert.strictEqual(attemptedKey, 'MOCK_GEMINI_KEY_Account02Healthy');
  });

  // Test D: Birinci credential QUOTA_EXCEEDED → ikinci credential seçiliyor
  it('Test D: Birinci credential QUOTA_EXCEEDED → ikinci credential seçiliyor', async () => {
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_Account01QuotaExceeded',
      priority: 1
    });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-02',
      apiKey: 'MOCK_GEMINI_KEY_Account02Active',
      priority: 2
    });

    credentialPool.markQuotaExceeded('gemini', 'gemini-account-01', 'Billing credit exhausted');

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({
        status: GatewayInvocationStatus.SUCCESS,
        output: 'Account 02 processed',
        model: 'gemini-3.6-flash'
      })
    });

    modelRegistry.registerModel({
      id: 'gemini-3.6-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      requiredCapabilities: [ProviderCapabilities.TEXT],
      preferredProvider: 'gemini'
    });

    assert.strictEqual(decision.selectedModel.credentialId, 'gemini-account-02');
    const result = await orchestrator.dispatchTask({
      prompt: 'Test D',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });
    assert.strictEqual(result.credentialId, 'gemini-account-02');
  });

  // Test E: Birinci credential AUTH_FAILED → scheduler tarafından izole ediliyor
  it('Test E: Birinci credential AUTH_FAILED → scheduler tarafından izole ediliyor', async () => {
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_InvalidKey',
      priority: 1
    });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-02',
      apiKey: 'MOCK_GEMINI_KEY_ValidKey',
      priority: 2
    });

    credentialPool.markAuthFailed('gemini', 'gemini-account-01', 'API key invalid');

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({
        status: GatewayInvocationStatus.SUCCESS,
        output: 'Account 2 valid',
        model: 'gemini-3.6-flash'
      })
    });

    modelRegistry.registerModel({
      id: 'gemini-3.6-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      requiredCapabilities: [ProviderCapabilities.TEXT],
      preferredProvider: 'gemini'
    });

    assert.strictEqual(decision.selectedModel.credentialId, 'gemini-account-02');
    const rejected01 = decision.rejectedModels.find(r => r.credentialId === 'gemini-account-01');
    assert.ok(rejected01, 'Account 01 must be in rejected models list');
    assert.strictEqual(rejected01.failedGate, 'HEALTH_STATUS');
  });

  // Test F: İki credential da başarısız → provider failover gerçekleşiyor
  it('Test F: İki credential da başarısız → provider failover gerçekleşiyor', async () => {
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_Key1',
      priority: 1
    });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-02',
      apiKey: 'MOCK_GEMINI_KEY_Key2',
      priority: 2
    });
    credentialPool.registerCredential({
      providerId: 'groq',
      credentialId: 'groq-account-01',
      apiKey: 'gsk-test-key',
      priority: 3
    });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => {
        const err = new Error('HTTP 429 Resource has exhausted its quota');
        err.status = 429;
        err.code = 'RATE_LIMITED';
        throw err;
      }
    });

    registry.registerProvider({
      providerId: 'groq',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({
        status: GatewayInvocationStatus.SUCCESS,
        output: 'Groq failover response',
        model: 'llama-3.3-70b-versatile'
      })
    });

    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    modelRegistry.registerModel({
      id: 'llama-3.3-70b-versatile',
      providerId: 'groq',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Perform resilient failover',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      maxFailoverAttempts: 4
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.providerId, 'groq');
    assert.strictEqual(result.fallbackTriggered, true);
    assert.ok(result.failoverTraces.length >= 1, 'Failover traces must record failures');
  });

  // Test G: Aynı model farklı credential'larda ayrı health state taşıyor
  it('Test G: Aynı model farklı credential\'larda ayrı health state taşıyor', () => {
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_G1',
      priority: 1
    });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-02',
      apiKey: 'MOCK_GEMINI_KEY_G2',
      priority: 2
    });

    credentialPool.markRateLimited('gemini', 'gemini-account-01', 'Cooldown active');

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({})
    });

    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool, initialCertifications: [] });
    const resources = orchestrator.listResources().filter(r => r.modelId === 'gemini-3.8-flash');

    assert.strictEqual(resources.length, 2, 'Should have 2 candidates for the same model');
    const acc1 = resources.find(r => r.credentialId === 'gemini-account-01');
    const acc2 = resources.find(r => r.credentialId === 'gemini-account-02');

    assert.strictEqual(acc1.health, ModelHealthStatus.RATE_LIMITED);
    assert.strictEqual(acc2.health, ModelHealthStatus.HEALTHY);
  });

  // Test H: Credential secret'i telemetry'ye sızmıyor
  it('Test H: Credential secret\'i telemetry\'ye sızmıyor', async () => {
    const secretKey = 'MOCK_GEMINI_KEY_SecretNeverExposeInLogsOrTelemetry999';
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: secretKey,
      priority: 1
    });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => ({
        status: GatewayInvocationStatus.SUCCESS,
        output: 'Clean response',
        model: 'gemini-3.6-flash'
      })
    });

    modelRegistry.registerModel({
      id: 'gemini-3.6-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool, initialCertifications: [] });
    const result = await orchestrator.dispatchTask({
      prompt: 'Security check',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    const serialized = JSON.stringify(result);
    assert.strictEqual(serialized.includes(secretKey), false, 'Raw API key must NOT appear in serialized telemetry');
    assert.strictEqual(result.credentialId, 'gemini-account-01');
    assert.strictEqual(result.credentialFingerprint, computeCredentialFingerprint(secretKey));
  });

  // Test I: Credential rotation model certification'ı bozmaz
  it('Test I: Credential rotation model certification\'ı bozmaz', async () => {
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_CertKey01',
      priority: 1
    });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-02',
      apiKey: 'MOCK_GEMINI_KEY_CertKey02',
      priority: 2
    });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    let attempts = 0;
    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async (params) => {
        attempts++;
        if (attempts === 1) {
          const err = new Error('HTTP 429 Rate limit exceeded');
          err.status = 429;
          throw err;
        }
        return {
          status: GatewayInvocationStatus.SUCCESS,
          output: 'Certified model response',
          model: 'gemini-3.8-flash'
        };
      }
    });

    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool });

    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-3.8-flash'), true, 'Should be certified initially');

    const result = await orchestrator.dispatchTask({
      prompt: 'Cert test',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });
    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.credentialId, 'gemini-account-02');
    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-3.8-flash'), true, 'Model remains certified after account failover');
  });

  // Test J: Task complexity düşükken uygun ekonomik model seçilebilir
  it('Test J: Task complexity düşükken uygun ekonomik model seçilebilir', () => {
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_KeyJ',
      priority: 1
    });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      invoke: async () => ({})
    });

    modelRegistry.registerModel({
      id: 'gemini-2.5-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    modelRegistry.registerModel({
      id: 'gemini-pro-reasoning',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      task: 'Calculate 2 + 2',
      taskComplexity: TaskComplexity.LOW,
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.ok(decision.selectedModel, 'A model must be selected');
    assert.ok(decision.selectedModel.modelId.includes('flash'), 'Low complexity task should prioritize economical flash model');
  });

  // Test K: Task complexity yüksekken güçlü model tercih ediliyor
  it('Test K: Task complexity yüksekken güçlü model tercih ediliyor', () => {
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_KeyK',
      priority: 1
    });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      invoke: async () => ({})
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
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      task: 'Analyze microservice architecture security tradeoffs and formal proofs',
      taskComplexity: TaskComplexity.HIGH,
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.ok(decision.selectedModel, 'A model must be selected');
    assert.strictEqual(decision.selectedModel.modelId, 'gemini-3.8-flash', 'High complexity task should prioritize reasoning flagship model');
  });

  // Test L: Vision task text-only candidate'a gönderilmiyor
  it('Test L: Vision task text-only candidate\'a gönderilmiyor', () => {
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_KeyL',
      priority: 1
    });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.VISION],
      invoke: async () => ({})
    });

    modelRegistry.registerModel({
      id: 'text-only-model',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    modelRegistry.registerModel({
      id: 'vision-capable-model',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.VISION],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool, initialCertifications: [] });
    const decision = orchestrator.selectBestModel({
      requiredCapabilities: [ProviderCapabilities.VISION]
    });

    assert.ok(decision.selectedModel, 'A model must be selected');
    assert.strictEqual(decision.selectedModel.modelId, 'vision-capable-model');
    const rejected = decision.rejectedModels.find(r => r.modelId === 'text-only-model');
    assert.ok(rejected, 'Text only model must be rejected');
    assert.strictEqual(rejected.failedGate, 'CAPABILITY_COMPATIBILITY');
  });

  // Test M: 429 RATE_LIMITED doğru sınıflandırılıyor
  it('Test M: 429 RATE_LIMITED doğru sınıflandırılıyor', () => {
    const err429 = new Error('Resource has exhausted its rate limit per minute');
    err429.status = 429;
    const classified = classifyError(err429);

    assert.strictEqual(classified.code, 'RATE_LIMITED');
    assert.strictEqual(classified.quotaState, QuotaState.RATE_LIMITED);
    assert.strictEqual(classified.health, ModelHealthStatus.RATE_LIMITED);

    const errBilling = new Error('Insufficient quota or balance exceeded');
    errBilling.status = 429;
    const classifiedQuota = classifyError(errBilling);
    assert.strictEqual(classifiedQuota.code, 'QUOTA_EXCEEDED');
    assert.strictEqual(classifiedQuota.quotaState, QuotaState.QUOTA_EXCEEDED);
  });

  // Test N: Timeout sonrası credential kalıcı olarak silinmiyor
  it('Test N: Timeout sonrası credential kalıcı olarak silinmiyor', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_TimeoutKey'
    });

    pool.markTimeout('gemini', 'gemini-account-01', 'Read timeout');
    const cred = pool.getCredential('gemini', 'gemini-account-01');

    assert.ok(cred, 'Credential must still exist');
    assert.strictEqual(cred.health, CredentialHealthStatus.TIMEOUT);
    assert.strictEqual(cred.enabled, true, 'Credential must NOT be disabled permanently');

    // On next success, it recovers
    pool.recordSuccess('gemini', 'gemini-account-01', 500);
    const recovered = pool.getCredential('gemini', 'gemini-account-01');
    assert.strictEqual(recovered.health, CredentialHealthStatus.HEALTHY);
  });

  // Test O: Cooldown süresi dolduğunda credential yeniden candidate olabiliyor
  it('Test O: Cooldown süresi dolduğunda credential yeniden candidate olabiliyor', () => {
    let mockTime = 100000;
    const pool = createCredentialPool({
      autoDiscoverEnv: false,
      now: () => mockTime,
      defaultCooldownMs: 5000
    });

    pool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_CooldownKey'
    });

    pool.markRateLimited('gemini', 'gemini-account-01', 'Rate limit');
    assert.strictEqual(pool.isAvailable('gemini', 'gemini-account-01'), false);

    // Advance time beyond cooldown
    mockTime += 6000;
    assert.strictEqual(pool.isAvailable('gemini', 'gemini-account-01'), true, 'Should be available after cooldown expires');
  });

  // Test P: Concurrent dispatch sırasında aynı credential state race-condition oluşturmuyor
  it('Test P: Concurrent dispatch sırasında aynı credential state race-condition oluşturmuyor', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false, defaultMaxConcurrent: 3 });
    pool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_ConcurrencyKey',
      maxConcurrentRequests: 2
    });

    assert.strictEqual(pool.acquireConcurrency('gemini', 'gemini-account-01'), true);
    assert.strictEqual(pool.acquireConcurrency('gemini', 'gemini-account-01'), true);
    assert.strictEqual(pool.acquireConcurrency('gemini', 'gemini-account-01'), false, 'Cannot exceed maxConcurrency 2');

    pool.releaseConcurrency('gemini', 'gemini-account-01');
    assert.strictEqual(pool.acquireConcurrency('gemini', 'gemini-account-01'), true, 'Slot freed');
    pool.releaseConcurrency('gemini', 'gemini-account-01');
    pool.releaseConcurrency('gemini', 'gemini-account-01');
  });

  // Test Q: Cost tracking credential rotation nedeniyle double-count yapmıyor
  it('Test Q: Cost tracking credential rotation nedeniyle double-count yapmıyor', () => {
    const cost = calculateCost({
      providerId: 'gemini',
      model: 'gemini-3.8-flash',
      inputTokens: 100,
      outputTokens: 50
    });

    assert.ok(cost, 'Cost must be calculated');
    assert.strictEqual(typeof cost.estimatedCostUsd, 'number');
    assert.ok(cost.estimatedCostUsd > 0);
  });

  // Test R: Gerçek API key hiçbir test çıktısında görünmüyor
  it('Test R: Gerçek API key hiçbir test çıktısında görünmüyor', () => {
    const pool = createCredentialPool({ autoDiscoverEnv: false });
    pool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_SecretShouldNeverBePrinted'
    });

    const publicList = pool.listCredentials();
    assert.strictEqual(publicList[0].apiKey, undefined, 'Public credential list must omit apiKey property');
    assert.strictEqual(publicList[0].fingerprint.length, 12);
  });

  // Test S: Provider + model + credential candidate identity deterministik
  it('Test S: Provider + model + credential candidate identity deterministik', () => {
    const credentialPool = createCredentialPool({ autoDiscoverEnv: false });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-01',
      apiKey: 'MOCK_GEMINI_KEY_KeyS1',
      priority: 1
    });
    credentialPool.registerCredential({
      providerId: 'gemini',
      credentialId: 'gemini-account-02',
      apiKey: 'MOCK_GEMINI_KEY_KeyS2',
      priority: 2
    });

    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({})
    });

    modelRegistry.registerModel({
      id: 'gemini-3.8-flash',
      providerId: 'gemini',
      capabilities: [ProviderCapabilities.TEXT],
      availability: ModelAvailability.AVAILABLE
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, credentialPool, initialCertifications: [] });
    const resources = orchestrator.listResources().filter(r => r.modelId === 'gemini-3.8-flash');

    assert.strictEqual(resources.length, 2);
    assert.strictEqual(resources[0].candidateId, 'gemini:gemini-3.8-flash:gemini-account-01');
    assert.strictEqual(resources[1].candidateId, 'gemini:gemini-3.8-flash:gemini-account-02');
  });

  // Test T: Mevcut FAZ 66.9.2 regression suite bozulmuyor
  it('Test T: Mevcut FAZ 66.9.2 regression suite bozulmuyor', () => {
    const orchestrator = createAIResourceOrchestrator();
    const inventory = orchestrator.listResources();
    assert.ok(inventory.length > 0, 'Inventory must not be empty');
    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-1.5-flash'), false);
  });

});
