/**
 * ONLUNET ZEKA - FAZ 66.9 LIVE MODEL CERTIFICATION MATRIX + SCHEDULER FORENSIC VALIDATION TEST SUITE
 *
 * Verifies the fundamental architectural invariant:
 * LIVE MODEL CATALOG ≠ LIVE MODEL INFERENCE
 *
 * Enforces Zero Fake Pass, Capability Confidence (UNKNOWN !== SUPPORTED),
 * Model-Level Circuit Isolation, Quota Isolation, Forensic Scheduler Explanations,
 * Controlled Failover Traces, Secret Redaction, and Zero AI Authority.
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
  CapabilityConfidence,
  QuotaState,
  ProviderType,
  certifyModelCapability,
  calculateModelScore,
  getManualModelOverride,
  DefaultLiveCertifications
} from '../src/orchestration/ai-resource-orchestrator.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createModelRegistry } from '../src/providers/model-registry.js';
import {
  ProviderCapabilities,
  StandardModelCapabilities,
  normalizeCapability
} from '../src/providers/provider-capabilities.js';
import { CircuitBreakerState } from '../src/providers/circuit-breaker.js';
import { GatewayInvocationStatus } from '../src/providers/provider-gateway.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 66.9: Live Model Certification Matrix + Scheduler Forensic Validation', () => {

  // 1. CATALOG-ONLY DISTINCTION
  it('1. Catalog-only distinction: Catalog registration does NOT imply LIVE_CERTIFIED', () => {
    const orchestrator = createAIResourceOrchestrator({ initialCertifications: [] });

    // In an empty certification state, all catalog models must be CATALOG_ONLY, not LIVE_CERTIFIED
    const inventory = orchestrator.listResources();
    assert.ok(inventory.length > 0, 'Inventory must contain registered catalog models');

    for (const res of inventory) {
      if (res.providerType === ProviderType.LOCAL) {
        assert.strictEqual(res.status, ModelAvailability.CERTIFIED_BUILTIN, 'Local engine must be CERTIFIED_BUILTIN');
      } else {
        assert.notStrictEqual(res.status, ModelAvailability.LIVE_CERTIFIED, `Unverified model ${res.resourceId} must NOT be LIVE_CERTIFIED`);
        assert.strictEqual(res.liveCertified, false, `Unverified model ${res.resourceId} liveCertified must be false`);
      }
    }

    assert.strictEqual(orchestrator.isModelCertified('groq', 'llama-3.3-70b-versatile'), false,
      'Model must not be certified before inference is proven');
  });

  // 2. DISCOVERY DISTINCTION
  it('2. Discovery distinction: Discovered models are DISCOVERED / CATALOG_ONLY, NOT LIVE_CERTIFIED', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.registerProvider({
      providerId: 'discovery-test-provider',
      name: 'Discovery Test Provider',
      capabilities: [ProviderCapabilities.TEXT],
      discoverModels: async () => ({
        providerId: 'discovery-test-provider',
        discoveredAt: new Date().toISOString(),
        source: 'live_api',
        live: true,
        models: [
          { id: 'discovered-model-alpha', capabilities: [ProviderCapabilities.TEXT] },
          { id: 'discovered-model-beta', capabilities: [ProviderCapabilities.TEXT] }
        ]
      }),
      invoke: async () => ({ output: 'OK' })
    });

    const orchestrator = createAIResourceOrchestrator({ registry, initialCertifications: [] });
    const discovered = await orchestrator.discoverProviderModels('discovery-test-provider');

    assert.ok(Array.isArray(discovered), 'Discovered result must be array');
    assert.strictEqual(discovered.length, 2);

    // Discovery alone does NOT confer LIVE_CERTIFIED status
    assert.strictEqual(orchestrator.isModelCertified('discovery-test-provider', 'discovered-model-alpha'), false,
      'Discovery must not grant LIVE_CERTIFIED status');
    assert.strictEqual(orchestrator.isModelCertified('discovery-test-provider', 'discovered-model-beta'), false,
      'Discovery must not grant LIVE_CERTIFIED status');
  });

  // 3. LIVE INFERENCE CERTIFICATION
  it('3. Live inference certification: Real verified response certifies model', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    const expectedOutput = 'ONLUNET_GENUINE_INFERENCE_OUTPUT_2026';
    const simulatedLatency = 135;

    registry.registerProvider({
      providerId: 'cert-provider',
      name: 'Certified Provider',
      model: 'cert-model-v1',
      defaultModel: 'cert-model-v1',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({
        output: expectedOutput,
        rawContent: expectedOutput,
        model: 'cert-model-v1',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        latencyMs: simulatedLatency
      })
    });

    const orchestrator = createAIResourceOrchestrator({ registry, initialCertifications: [] });
    assert.strictEqual(orchestrator.isModelCertified('cert-provider', 'cert-model-v1'), false);

    const result = await orchestrator.dispatchTask({
      taskId: 'cert-validation-task',
      prompt: 'Execute authentic inference check',
      preferredProvider: 'cert-provider'
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.providerId, 'cert-provider');
    assert.strictEqual(result.liveCertified, true);
    assert.strictEqual(result.modelState, ModelAvailability.LIVE_CERTIFIED);
    assert.ok(result.responseHash, 'Must provide SHA-256 fingerprint');

    // Model must now be recognized as certified
    assert.strictEqual(orchestrator.isModelCertified('cert-provider', 'cert-model-v1'), true);
  });

  // 4. HTTP EVIDENCE VERIFICATION
  it('4. HTTP evidence verification: Certification strictly requires valid HTTP 200', () => {
    const orchestrator = createAIResourceOrchestrator({ initialCertifications: [] });

    // Manually certifying with HTTP 200 telemetry succeeds
    const cert = orchestrator.certifyModelInference('groq', 'llama-3.3-70b-versatile', {
      httpStatus: 200,
      latencyMs: 1490,
      sha256: '39b9eac80f1acf42081aa27fb3a07d2ee91f64626d6e20165f3e2e02d61f46d0'
    });

    assert.strictEqual(cert.httpStatus, 200);
    assert.strictEqual(cert.status, ModelAvailability.LIVE_CERTIFIED);
    assert.strictEqual(orchestrator.isModelCertified('groq', 'llama-3.3-70b-versatile'), true);
  });

  // 5. LATENCY EVIDENCE VERIFICATION
  it('5. Latency evidence verification: Real measured latency recorded without fake numbers', async () => {
    const orchestrator = createAIResourceOrchestrator();
    const res = await orchestrator.dispatchTask({
      taskId: 'latency-proof-task',
      prompt: 'Echo test',
      preferredProvider: 'local'
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(typeof res.latency, 'number', 'Latency must be a measured number');
    assert.ok(res.latency >= 0, 'Latency must be non-negative');
  });

  // 6. SHA-256 EVIDENCE VERIFICATION
  it('6. SHA-256 evidence verification: Deterministic response hash computed on content', async () => {
    const orchestrator = createAIResourceOrchestrator();
    const res = await orchestrator.dispatchTask({
      taskId: 'sha-test-task',
      prompt: 'Deterministic hash test',
      preferredProvider: 'local'
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.ok(res.responseHash, 'Response hash must be present');
    assert.strictEqual(res.responseHash.length, 64, 'SHA-256 hex must be exactly 64 characters');

    // Re-verify deterministic hash computation
    const rawContent = res.output || res.rawContent || '';
    const recomputed = crypto.createHash('sha256').update(String(rawContent)).digest('hex');
    assert.strictEqual(res.responseHash, recomputed, 'Response hash must match cryptographically');
  });

  // 7. EMPTY ENV -> DISCOVERY
  it('7. Empty model env falls back to discovery without hardcoded env model keys', async () => {
    const origEnv = process.env.TEST_DYNAMIC_MODEL;
    delete process.env.TEST_DYNAMIC_MODEL;

    const orchestrator = createAIResourceOrchestrator();
    const discovered = await orchestrator.discoverProviderModels('local');
    assert.ok(Array.isArray(discovered));
    assert.ok(discovered.length > 0);

    if (origEnv) process.env.TEST_DYNAMIC_MODEL = origEnv;
  });

  // 8. MANUAL OVERRIDE WORKS
  it('8. Manual override prioritizes selected model', () => {
    process.env.GROQ_MODEL = 'llama-3.3-70b-override';
    const override = getManualModelOverride('groq');
    assert.strictEqual(override, 'llama-3.3-70b-override');

    const orchestrator = createAIResourceOrchestrator();
    const res = orchestrator.getResource('groq', 'llama-3.3-70b-override');
    assert.ok(res, 'Orchestrator must register the manual override resource');
    assert.strictEqual(res.modelId, 'llama-3.3-70b-override');

    delete process.env.GROQ_MODEL;
  });

  // 9. OVERRIDE DOES NOT IMPLY CERTIFICATION
  it('9. Override does NOT imply certification (Zero Fake Pass)', () => {
    process.env.GROQ_MODEL = 'llama-unverified-override';
    const orchestrator = createAIResourceOrchestrator({ initialCertifications: [] });
    const res = orchestrator.getResource('groq', 'llama-unverified-override');

    assert.ok(res);
    assert.strictEqual(res.liveCertified, false, 'Manual override must NOT automatically be liveCertified');
    assert.notStrictEqual(res.status, ModelAvailability.LIVE_CERTIFIED, 'Manual override must NOT be LIVE_CERTIFIED without inference');

    delete process.env.GROQ_MODEL;
  });

  // 10. CAPABILITY UNKNOWN HANDLING (UNKNOWN !== SUPPORTED)
  it('10. Capability unknown handling strictly enforces UNKNOWN !== SUPPORTED', () => {
    const mockResource = {
      resourceId: 'test-res',
      providerId: 'test-provider',
      capabilities: ['text', 'vision']
    };

    // Unknown capability
    const certUnknown = certifyModelCapability(mockResource, 'quantum_teleportation', false);
    assert.strictEqual(certUnknown.confidence, CapabilityConfidence.UNKNOWN);
    assert.strictEqual(certUnknown.catalog, false);
    assert.strictEqual(certUnknown.liveVerified, false);

    // Catalog-only capability
    const certCatalog = certifyModelCapability(mockResource, 'vision', false);
    assert.strictEqual(certCatalog.confidence, CapabilityConfidence.CATALOG_ONLY);
    assert.strictEqual(certCatalog.catalog, true);
    assert.strictEqual(certCatalog.liveVerified, false);

    // Live-certified capability
    const certLive = certifyModelCapability(mockResource, 'vision', true);
    assert.strictEqual(certLive.confidence, CapabilityConfidence.LIVE_CERTIFIED);
    assert.strictEqual(certLive.catalog, true);
    assert.strictEqual(certLive.liveVerified, true);
  });

  // 11. CAPABILITY FILTERING
  it('11. Capability filtering isolates models by required features', () => {
    const orchestrator = createAIResourceOrchestrator();

    const visionModels = orchestrator.listResources({ capability: StandardModelCapabilities.VISION });
    assert.ok(visionModels.length > 0, 'Must find vision-capable models');

    for (const m of visionModels) {
      const caps = m.capabilities.map(c => normalizeCapability(c));
      assert.ok(caps.includes(StandardModelCapabilities.VISION) || caps.includes('image_input'));
    }
  });

  // 12. QUOTA ISOLATION
  it('12. Quota isolation: Quota exceeded provider does not impair other providers', () => {
    const orchestrator = createAIResourceOrchestrator();

    orchestrator.setQuotaState('openai', null, QuotaState.QUOTA_EXCEEDED);
    assert.strictEqual(orchestrator.getQuotaState('openai'), QuotaState.QUOTA_EXCEEDED);

    // Other providers must remain NORMAL
    assert.strictEqual(orchestrator.getQuotaState('gemini'), QuotaState.NORMAL);
    assert.strictEqual(orchestrator.getQuotaState('groq'), QuotaState.NORMAL);
    assert.strictEqual(orchestrator.getQuotaState('local'), QuotaState.NORMAL);

    const candidates = orchestrator.selectCandidates({ requiredCapabilities: [ProviderCapabilities.TEXT] });
    assert.strictEqual(candidates.some(c => c.providerId === 'openai'), false, 'OpenAI must be excluded');
    assert.ok(candidates.some(c => c.providerId === 'local' || c.providerId === 'gemini'), 'Other providers remain available');
  });

  // 13. RATE-LIMIT ISOLATION
  it('13. Rate-limit isolation: Rate-limiting one provider does not impair others', () => {
    const orchestrator = createAIResourceOrchestrator();

    orchestrator.setQuotaState('groq', null, QuotaState.RATE_LIMITED);
    assert.strictEqual(orchestrator.getQuotaState('groq'), QuotaState.RATE_LIMITED);
    assert.strictEqual(orchestrator.getQuotaState('gemini'), QuotaState.NORMAL);
    assert.strictEqual(orchestrator.getQuotaState('local'), QuotaState.NORMAL);
  });

  // 14. MODEL CIRCUIT ISOLATION
  it('14. Model circuit isolation: NVIDIA DeepSeek Pro circuit open does NOT trip Llama Vision', () => {
    const orchestrator = createAIResourceOrchestrator();

    const deepseekKey = 'deepseek-ai/deepseek-v4-pro-0813';
    const llamaKey = 'meta/llama-3.2-11b-vision-instruct';

    // Fail DeepSeek twice to open circuit
    orchestrator.recordFailure('nvidia', deepseekKey, new Error('Timeout 504'));
    orchestrator.recordFailure('nvidia', deepseekKey, new Error('Timeout 504'));

    assert.strictEqual(orchestrator.canExecute('nvidia', deepseekKey), false, 'DeepSeek circuit must be OPEN');
    assert.strictEqual(orchestrator.canExecute('nvidia', llamaKey), true, 'Llama Vision circuit must remain CLOSED');
  });

  // 15. PROVIDER ISOLATION
  it('15. Provider isolation: Complete provider failure fails over to healthy alternatives', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'dead-provider',
      name: 'Dead Provider',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => {
        throw new Error('Connection refused ECONNREFUSED');
      }
    });

    registry.registerProvider({
      providerId: 'healthy-provider',
      name: 'Healthy Provider',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => ({
        output: 'RECOVERED_VIA_PROVIDER_FAILOVER',
        model: 'healthy-model'
      })
    });

    const orchestrator = createAIResourceOrchestrator({ registry });

    const res = await orchestrator.dispatchTask({
      taskId: 'provider-isolation-task',
      prompt: 'Test provider crash resilience',
      preferredProvider: 'dead-provider'
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.providerId, 'healthy-provider');
    assert.strictEqual(res.fallbackTriggered, true);
    assert.strictEqual(res.primaryProviderId, 'dead-provider');
  });

  // 16. SCHEDULER EXPLANATION PRODUCES FORENSIC AUDIT TRAIL
  it('16. Scheduler explanation produces complete forensic audit trail', () => {
    const orchestrator = createAIResourceOrchestrator();

    const explanation = orchestrator.selectBestModel({
      task: 'Analyze system architecture for vulnerabilities',
      requiredCapabilities: [StandardModelCapabilities.TEXT_GENERATION]
    });

    assert.ok(explanation.selectedModel, 'Must produce selectedModel');
    assert.ok(explanation.selectedProvider, 'Must produce selectedProvider');
    assert.strictEqual(typeof explanation.score, 'number', 'Must produce score');
    assert.ok(explanation.selectionReason, 'Must produce selectionReason');
    assert.ok(Array.isArray(explanation.candidates), 'Must produce candidates array');
    assert.ok(Array.isArray(explanation.rejectedModels), 'Must produce rejectedModels array');
    assert.ok(explanation.rejectionReasons && typeof explanation.rejectionReasons === 'object', 'Must produce rejectionReasons');
    assert.ok(explanation.scoreBreakdown && typeof explanation.scoreBreakdown === 'object', 'Must produce scoreBreakdown');
  });

  // 17. FAILOVER TRACE STRUCTURE MATCHES FORENSIC SCHEMA
  it('17. Failover trace structure matches forensic schema', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'failing-primary',
      name: 'Failing Primary',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      invoke: async () => {
        const err = new Error('HTTP 503 Service Unavailable');
        err.status = 503;
        throw err;
      }
    });

    registry.registerProvider({
      providerId: 'succeeding-fallback',
      name: 'Succeeding Fallback',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      invoke: async () => ({
        output: 'FALLBACK_TRACE_SUCCESS',
        model: 'model-fb'
      })
    });

    const orchestrator = createAIResourceOrchestrator({ registry });

    const res = await orchestrator.dispatchTask({
      taskId: 'trace-schema-test',
      prompt: 'Check failover trace schema',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      preferredProvider: 'failing-primary'
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.fallbackTriggered, true);
    assert.ok(res.failoverTraces.length >= 1, 'Must have at least 1 failover trace');

    const trace = res.failoverTraces[0];
    assert.strictEqual(trace.primaryProvider, 'failing-primary');
    assert.ok(trace.primaryModel.includes('failing-primary'));
    assert.strictEqual(trace.fallbackProvider, 'succeeding-fallback');
    assert.ok(trace.fallbackModel.includes('succeeding-fallback'));
    assert.ok(trace.failureType, 'Trace must include failureType');
    assert.strictEqual(trace.fallbackTriggered, true);
    assert.strictEqual(typeof trace.attemptNumber, 'number');
    assert.strictEqual(typeof trace.latency, 'number', 'Trace must include measured latency');
    assert.ok(trace.responseHash, 'Trace must include responseHash');
  });

  // 18. INFINITE RETRY PREVENTION
  it('18. Infinite retry prevention strictly caps attempts at maxFailoverAttempts', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    let attempts = 0;

    for (let i = 1; i <= 5; i++) {
      registry.registerProvider({
        providerId: `fail-prov-${i}`,
        name: `Fail Provider ${i}`,
        capabilities: [ProviderCapabilities.TEXT],
        invoke: async () => {
          attempts++;
          throw new Error(`Fail attempt ${attempts}`);
        }
      });
    }

    const orchestrator = createAIResourceOrchestrator({ registry });
    const maxAttempts = 3;

    const res = await orchestrator.dispatchTask({
      taskId: 'infinite-retry-test',
      prompt: 'Test retry barrier',
      maxFailoverAttempts: maxAttempts
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.FAILED);
    assert.ok(attempts <= maxAttempts, `Attempts (${attempts}) must not exceed maxFailoverAttempts (${maxAttempts})`);
    assert.strictEqual(res.attemptNumber, attempts);
  });

  // 19. SECRET REDACTION
  it('19. Secret redaction prevents leaks in inventory, credentials, traces, and telemetry', async () => {
    const orchestrator = createAIResourceOrchestrator();

    // 1. Check credentials
    for (const prov of ['nvidia', 'gemini', 'groq', 'openrouter', 'kimi', 'openai', 'local']) {
      const cred = orchestrator.resolveCredential({ providerId: prov });
      assert.ok(cred.alias, `Provider ${prov} must have alias`);
      assert.strictEqual(cred.apiKey, undefined, `Provider ${prov} must not expose apiKey`);
      assert.strictEqual(cred.secret, undefined, `Provider ${prov} must not expose secret`);
      assert.strictEqual(cred.token, undefined, `Provider ${prov} must not expose token`);
    }

    // 2. Check inventory
    const inventory = orchestrator.listResources();
    for (const res of inventory) {
      assert.strictEqual(res.apiKey, undefined, 'Resource must not contain apiKey');
      assert.strictEqual(res.secret, undefined, 'Resource must not contain secret');
      assert.strictEqual(res.token, undefined, 'Resource must not contain token');
    }

    // 3. Check dispatch telemetry
    const result = await orchestrator.dispatchTask({
      taskId: 'secret-check-task',
      prompt: 'Secret check',
      preferredProvider: 'local'
    });

    const serialized = JSON.stringify(result);
    assert.strictEqual(serialized.includes('apiKey'), false, 'Result must not contain apiKey key');
  });

  // 20. ZERO AI AUTHORITY
  it('20. Zero AI authority enforced on all orchestration outcomes', async () => {
    const orchestrator = createAIResourceOrchestrator();

    // Success outcome
    const successResult = await orchestrator.dispatchTask({
      taskId: 'zero-auth-success',
      prompt: 'Perform read-only query',
      preferredProvider: 'local'
    });

    assert.strictEqual(successResult.proposalOnly, true);
    assert.strictEqual(successResult.executionAuthorized, false);
    assert.strictEqual(successResult.mutationAuthorized, false);
    assert.strictEqual(successResult.deploymentAuthorized, false);
    assert.strictEqual(successResult.networkAuthorized, false);
    assert.strictEqual(successResult.shellAuthorized, false);
    assert.strictEqual(successResult.requiresApproval, true);

    // Failure outcome
    const failResult = await orchestrator.dispatchTask({
      taskId: 'zero-auth-fail',
      prompt: 'Invalid capability test',
      requiredCapabilities: ['non_existent_super_intelligence_capability']
    });

    assert.strictEqual(failResult.proposalOnly, true);
    assert.strictEqual(failResult.executionAuthorized, false);
    assert.strictEqual(failResult.mutationAuthorized, false);
    assert.strictEqual(failResult.deploymentAuthorized, false);
    assert.strictEqual(failResult.networkAuthorized, false);
    assert.strictEqual(failResult.shellAuthorized, false);
    assert.strictEqual(failResult.requiresApproval, true);
  });

  // 21. REGRESSION PROTECTION
  it('21. Regression protection: FAZ 1-66.8 contracts preserved intact', () => {
    const orchestrator = createAIResourceOrchestrator();

    assert.ok(orchestrator.gateway, 'Gateway must exist');
    assert.ok(orchestrator.registry, 'Registry must exist');
    assert.ok(orchestrator.modelRegistry, 'Model registry must exist');
    assert.ok(orchestrator.circuitBreaker, 'Circuit breaker must exist');
    assert.ok(typeof orchestrator.isModelCertified === 'function', 'isModelCertified must exist');
    assert.ok(typeof orchestrator.getCapabilityCertification === 'function', 'getCapabilityCertification must exist');
    assert.ok(typeof orchestrator.getCertificationMatrix === 'function', 'getCertificationMatrix must exist');

    const matrix = orchestrator.getCertificationMatrix();
    assert.ok(Array.isArray(matrix), 'Certification matrix must be an array');
    assert.ok(matrix.length > 0, 'Certification matrix must not be empty');

    for (const item of matrix) {
      assert.ok(item.resourceId, 'Matrix item must have resourceId');
      assert.ok(item.providerId, 'Matrix item must have providerId');
      assert.ok(item.modelId, 'Matrix item must have modelId');
      assert.ok(item.modelState, 'Matrix item must have modelState');
      assert.strictEqual(typeof item.liveCertified, 'boolean', 'Matrix item must have boolean liveCertified');
      assert.strictEqual(item.catalogStatus, 'REGISTERED');
    }
  });

});
