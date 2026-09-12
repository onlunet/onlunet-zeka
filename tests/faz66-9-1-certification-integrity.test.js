/**
 * ONLUNET ZEKA - FAZ 66.9.1 CERTIFICATION INTEGRITY TEST SUITE
 *
 * Forensic Validation Gate:
 * Enforces Zero Fake Pass, validates that HTTP 200 alone != LIVE_CERTIFIED,
 * proves aborted/timeout requests cannot certify, and guarantees strict
 * isolation across quota, auth, provider, and model circuits.
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
  certifyModelCapability,
  DefaultLiveCertifications
} from '../src/orchestration/ai-resource-orchestrator.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createModelRegistry } from '../src/providers/model-registry.js';
import {
  ProviderCapabilities,
  StandardModelCapabilities
} from '../src/providers/provider-capabilities.js';
import { CircuitBreakerState } from '../src/providers/circuit-breaker.js';
import { GatewayInvocationStatus } from '../src/providers/provider-gateway.js';

describe('FAZ 66.9.1: Forensic Certification Integrity Gate', () => {

  // 1. HTTP 200 WITHOUT VALID BODY CANNOT CERTIFY
  it('1. HTTP 200 without valid body cannot certify', () => {
    const orchestrator = createAIResourceOrchestrator({ initialCertifications: [] });

    // Telemetry claims HTTP 200, but has empty/null body
    const certEmpty = orchestrator.certifyModelInference('test-provider', 'model-empty-body', {
      httpStatus: 200,
      output: '',
      latencyMs: 120,
      sha256: 'somehash'
    });

    assert.strictEqual(certEmpty.live, false, 'Empty output body must NOT be certified');
    assert.strictEqual(certEmpty.status, ModelAvailability.INFERENCE_FAILED);
    assert.strictEqual(orchestrator.isModelCertified('test-provider', 'model-empty-body'), false);
  });

  // 2. ABORTED REQUEST CANNOT CERTIFY
  it('2. Aborted request cannot certify', () => {
    const orchestrator = createAIResourceOrchestrator({ initialCertifications: [] });

    // Client abort after 35s timeout
    const certAborted = orchestrator.certifyModelInference('nvidia', 'deepseek-ai/deepseek-v4-pro-0813', {
      httpStatus: null,
      transport: 'ABORTED',
      aborted: true,
      error: 'This operation was aborted due to client timeout (>35000ms)',
      latencyMs: 36633,
      output: null,
      sha256: null
    });

    assert.strictEqual(certAborted.live, false, 'Aborted request must NOT be certified');
    assert.strictEqual(certAborted.status, ModelAvailability.DEFERRED, 'Aborted model must have DEFERRED status');
    assert.strictEqual(certAborted.sha256, null, 'Aborted model must not have response hash');
    assert.strictEqual(orchestrator.isModelCertified('nvidia', 'deepseek-ai/deepseek-v4-pro-0813'), false);
  });

  // 3. TIMEOUT CANNOT CERTIFY
  it('3. Timeout cannot certify', () => {
    const orchestrator = createAIResourceOrchestrator({ initialCertifications: [] });

    const certTimeout = orchestrator.certifyModelInference('test-provider', 'timeout-model', {
      httpStatus: 504,
      timeout: true,
      error: 'Gateway Timeout after 30000ms',
      latencyMs: 30001,
      output: null,
      sha256: null
    });

    assert.strictEqual(certTimeout.live, false, 'Timeout must NOT be certified');
    assert.strictEqual(certTimeout.status, ModelAvailability.DEFERRED);
    assert.strictEqual(orchestrator.isModelCertified('test-provider', 'timeout-model'), false);
  });

  // 4. EMPTY OUTPUT CANNOT CERTIFY
  it('4. Empty output cannot certify during real dispatch', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });

    // Provider returns HTTP 200 with completely empty output string
    registry.registerProvider({
      providerId: 'empty-producer',
      name: 'Empty Producer',
      model: 'empty-model',
      defaultModel: 'empty-model',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({
        output: '   ', // whitespace only
        rawContent: '',
        model: 'empty-model',
        latencyMs: 50
      })
    });

    const orchestrator = createAIResourceOrchestrator({ registry, initialCertifications: [] });

    const res = await orchestrator.dispatchTask({
      taskId: 'empty-body-test',
      prompt: 'Check empty body rejection',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      preferredProvider: 'empty-producer',
      maxFailoverAttempts: 1
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.FAILED);
    assert.strictEqual(orchestrator.isModelCertified('empty-producer', 'empty-model'), false);
  });

  // 5. CATALOG DISCOVERY CANNOT CERTIFY
  it('5. Catalog discovery cannot certify (LIVE MODEL CATALOG !== LIVE MODEL INFERENCE)', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.registerProvider({
      providerId: 'catalog-provider',
      name: 'Catalog Provider',
      capabilities: [ProviderCapabilities.TEXT],
      discoverModels: async () => ({
        providerId: 'catalog-provider',
        discoveredAt: new Date().toISOString(),
        source: 'live_api',
        live: true,
        models: [
          { id: 'catalog-model-1', capabilities: [ProviderCapabilities.TEXT] }
        ]
      }),
      invoke: async () => ({ output: 'OK' })
    });

    const orchestrator = createAIResourceOrchestrator({ registry, initialCertifications: [] });
    const discovered = await orchestrator.discoverProviderModels('catalog-provider');

    assert.strictEqual(discovered.length, 1);
    assert.strictEqual(orchestrator.isModelCertified('catalog-provider', 'catalog-model-1'), false,
      'Discovered model must remain uncertified until proven with inference');
  });

  // 6. STATIC REGISTRY CANNOT CERTIFY
  it('6. Static registry cannot certify', () => {
    const orchestrator = createAIResourceOrchestrator({ initialCertifications: [] });

    const res = orchestrator.getResource('groq', 'llama-3.3-70b-versatile');
    assert.ok(res, 'Must exist in static catalog');
    assert.strictEqual(res.liveCertified, false, 'Static catalog entry must have liveCertified=false');
    assert.strictEqual(orchestrator.isModelCertified('groq', 'llama-3.3-70b-versatile'), false);
  });

  // 7. 401 BECOMES AUTH_FAILED
  it('7. 401 becomes AUTH_FAILED', () => {
    const orchestrator = createAIResourceOrchestrator({ initialCertifications: [] });

    const cert401 = orchestrator.certifyModelInference('kimi', 'moonshot-v1-8k', {
      httpStatus: 401,
      status: 'AUTH_FAILED',
      error: 'Invalid Authentication (401)',
      latencyMs: 1872,
      output: null,
      sha256: null
    });

    assert.strictEqual(cert401.live, false);
    assert.strictEqual(cert401.status, ModelAvailability.AUTH_FAILED);
    assert.strictEqual(orchestrator.isModelCertified('kimi', 'moonshot-v1-8k'), false);
  });

  // 8. 429 QUOTA BECOMES QUOTA_EXCEEDED
  it('8. 429 quota becomes QUOTA_EXCEEDED and isolates provider from scheduler', () => {
    const orchestrator = createAIResourceOrchestrator();

    const cert429 = orchestrator.certifyModelInference('openai', 'gpt-4o', {
      httpStatus: 429,
      status: 'QUOTA_EXCEEDED',
      error: 'You have no credits remaining (insufficient_quota)',
      latencyMs: 2704,
      output: null,
      sha256: null
    });

    assert.strictEqual(cert429.live, false);
    assert.strictEqual(cert429.status, ModelAvailability.QUOTA_EXCEEDED);
    assert.strictEqual(orchestrator.isModelCertified('openai', 'gpt-4o'), false);

    // Isolate provider quota state
    orchestrator.setQuotaState('openai', null, QuotaState.QUOTA_EXCEEDED);
    const candidates = orchestrator.selectCandidates({ requiredCapabilities: [ProviderCapabilities.TEXT] });
    assert.strictEqual(candidates.some(c => c.providerId === 'openai'), false, 'Quota exceeded provider must be excluded');
  });

  // 9. SUCCESSFUL REAL RESPONSE BECOMES LIVE_CERTIFIED
  it('9. Successful real response becomes LIVE_CERTIFIED', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    const authenticOutput = 'GENUINE_PROVEN_OUTPUT_PASS';

    registry.registerProvider({
      providerId: 'genuine-prov',
      name: 'Genuine Provider',
      model: 'genuine-model-1',
      defaultModel: 'genuine-model-1',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({
        output: authenticOutput,
        rawContent: authenticOutput,
        model: 'genuine-model-1',
        latencyMs: 88
      })
    });

    const orchestrator = createAIResourceOrchestrator({ registry, initialCertifications: [] });
    assert.strictEqual(orchestrator.isModelCertified('genuine-prov', 'genuine-model-1'), false);

    const res = await orchestrator.dispatchTask({
      taskId: 'genuine-task',
      prompt: 'Execute genuine task',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      preferredProvider: 'genuine-prov'
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.liveCertified, true);
    assert.strictEqual(res.modelState, ModelAvailability.LIVE_CERTIFIED);
    assert.ok(res.responseHash, 'Must generate response hash');
    assert.strictEqual(orchestrator.isModelCertified('genuine-prov', 'genuine-model-1'), true);
  });

  // 10. SHA256 ONLY GENERATED FOR VALID RESPONSE
  it('10. SHA256 only generated for valid response (never for errors or timeouts)', () => {
    const orchestrator = createAIResourceOrchestrator({ initialCertifications: [] });

    // 1. Timeout attempt
    const timeoutEntry = orchestrator.certifyModelInference('nvidia', 'deepseek-ai/deepseek-v4-pro-0813', {
      timeout: true,
      error: 'Timeout',
      output: null,
      sha256: null
    });
    assert.strictEqual(timeoutEntry.sha256, null);

    // 2. Auth failed attempt
    const authEntry = orchestrator.certifyModelInference('kimi', 'moonshot-v1-8k', {
      httpStatus: 401,
      error: 'Auth failed',
      output: null,
      sha256: null
    });
    assert.strictEqual(authEntry.sha256, null);

    // 3. Valid response attempt
    const validEntry = orchestrator.certifyModelInference('nvidia', 'meta/llama-3.2-11b-vision-instruct', {
      httpStatus: 200,
      output: 'VALID_TEXT',
      latencyMs: 6008,
      sha256: '4d27bb8590373ff06cb75a65bb8db15d8e7540ec24228af61c3ac6c6e949486c'
    });
    assert.ok(validEntry.sha256);
    assert.strictEqual(validEntry.sha256.length, 64);
  });

  // 11. PROVIDER ISOLATION PRESERVED
  it('11. Provider isolation preserved: One provider outage does not impact others', () => {
    const orchestrator = createAIResourceOrchestrator();

    // Mark OpenAI as QUOTA_EXCEEDED, Kimi as AUTH_FAILED
    orchestrator.setQuotaState('openai', null, QuotaState.QUOTA_EXCEEDED);
    orchestrator.setHealthState('kimi', null, ModelHealthStatus.AUTH_FAILED);

    assert.strictEqual(orchestrator.getQuotaState('openai'), QuotaState.QUOTA_EXCEEDED);
    assert.strictEqual(orchestrator.getHealthState('kimi'), ModelHealthStatus.AUTH_FAILED);

    // Gemini, Groq, NVIDIA, Local remain healthy
    assert.strictEqual(orchestrator.getQuotaState('gemini'), QuotaState.NORMAL);
    assert.strictEqual(orchestrator.getQuotaState('groq'), QuotaState.NORMAL);
    assert.strictEqual(orchestrator.getQuotaState('nvidia'), QuotaState.NORMAL);
    assert.strictEqual(orchestrator.getHealthState('local'), ModelHealthStatus.HEALTHY);

    const candidates = orchestrator.selectCandidates({ requiredCapabilities: [ProviderCapabilities.TEXT] });
    assert.strictEqual(candidates.some(c => c.providerId === 'openai'), false);
    assert.strictEqual(candidates.some(c => c.providerId === 'kimi'), false);
    assert.ok(candidates.some(c => c.providerId === 'groq' || c.providerId === 'local'));
  });

  // 12. MODEL ISOLATION PRESERVED
  it('12. Model isolation preserved: NVIDIA DeepSeek circuit trip does not trip Llama Vision', () => {
    const orchestrator = createAIResourceOrchestrator();
    const deepseekKey = 'deepseek-ai/deepseek-v4-pro-0813';
    const llamaKey = 'meta/llama-3.2-11b-vision-instruct';

    // Trip DeepSeek
    orchestrator.recordFailure('nvidia', deepseekKey, new Error('Timeout'));
    orchestrator.recordFailure('nvidia', deepseekKey, new Error('Timeout'));

    assert.strictEqual(orchestrator.canExecute('nvidia', deepseekKey), false);
    assert.strictEqual(orchestrator.canExecute('nvidia', llamaKey), true);
  });

  // 13. ZERO AI AUTHORITY PRESERVED
  it('13. Zero AI authority preserved across all execution outcomes', async () => {
    const orchestrator = createAIResourceOrchestrator();

    const result = await orchestrator.dispatchTask({
      taskId: 'zero-auth-audit',
      prompt: 'Check zero AI authority',
      preferredProvider: 'local'
    });

    assert.strictEqual(result.proposalOnly, true);
    assert.strictEqual(result.executionAuthorized, false);
    assert.strictEqual(result.mutationAuthorized, false);
    assert.strictEqual(result.deploymentAuthorized, false);
    assert.strictEqual(result.networkAuthorized, false);
    assert.strictEqual(result.shellAuthorized, false);
    assert.strictEqual(result.requiresApproval, true);
  });

  // 14. NO SECRET LEAKAGE
  it('14. No secret leakage across credentials, inventory, and traces', () => {
    const orchestrator = createAIResourceOrchestrator();

    for (const p of ['nvidia', 'gemini', 'groq', 'openrouter', 'kimi', 'openai', 'local']) {
      const cred = orchestrator.resolveCredential({ providerId: p });
      assert.strictEqual(cred.apiKey, undefined);
      assert.strictEqual(cred.secret, undefined);
      assert.strictEqual(cred.token, undefined);
    }

    const inventory = orchestrator.listResources();
    for (const r of inventory) {
      assert.strictEqual(r.apiKey, undefined);
      assert.strictEqual(r.secret, undefined);
    }
  });

});
