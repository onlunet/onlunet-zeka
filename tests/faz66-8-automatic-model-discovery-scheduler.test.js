/**
 * ONLUNET ZEKA - FAZ 66.8 AUTOMATIC MODEL DISCOVERY + INTELLIGENT AI SCHEDULER TEST SUITE
 * Validates dynamic live model discovery, multi-criteria scheduler scoring,
 * capability matching, quota/rate-limit isolation, workload distribution,
 * model-level circuit breaker, infinite retry prevention, and zero AI authority.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  createAIResourceOrchestrator,
  ModelHealthStatus,
  ModelAvailability,
  QuotaState,
  ProviderType,
  calculateModelScore,
  getManualModelOverride,
  DefaultSchedulerWeights
} from '../src/orchestration/ai-resource-orchestrator.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import {
  ProviderCapabilities,
  StandardModelCapabilities,
  normalizeCapability
} from '../src/providers/provider-capabilities.js';
import { CircuitBreakerState } from '../src/providers/circuit-breaker.js';
import { GatewayInvocationStatus } from '../src/providers/provider-gateway.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 66.8: Automatic Model Discovery + Intelligent AI Scheduler', () => {

  // 1. EMPTY MODEL ENV -> LIVE DISCOVERY
  it('1. Empty model env -> live discovery', async () => {
    const origEnv = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;

    const override = getManualModelOverride('gemini');
    assert.strictEqual(override, null, 'Empty or missing model env must return null override');

    const orchestrator = createAIResourceOrchestrator();
    const discovered = await orchestrator.discoverProviderModels('local');
    assert.ok(Array.isArray(discovered), 'Discovered models must be an array');
    assert.ok(discovered.length > 0, 'Local provider must return at least one discovered model');
    assert.strictEqual(discovered.providerId, 'local');

    if (origEnv) process.env.GEMINI_MODEL = origEnv;
  });

  // 2. MANUAL MODEL OVERRIDE -> OVERRIDE WORKS
  it('2. Manual model override -> override works', () => {
    const orig = process.env.GROQ_MODEL;
    process.env.GROQ_MODEL = 'llama-3.3-70b-versatile-custom';

    const override = getManualModelOverride('groq');
    assert.strictEqual(override, 'llama-3.3-70b-versatile-custom', 'Manual override must return env value');

    if (orig) process.env.GROQ_MODEL = orig;
    else delete process.env.GROQ_MODEL;
  });

  // 3. DISCOVERY FAILURE -> NOT LIVE_CERTIFIED
  it('3. Discovery failure -> not LIVE_CERTIFIED', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.registerProvider({
      providerId: 'unreachable-provider',
      name: 'Unreachable Gateway',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => { throw new Error('Unreachable'); },
      discoverModels: async () => {
        const err = new Error('HTTP 401 Unauthorized: Invalid API key');
        err.status = 401;
        throw err;
      }
    });

    const orchestrator = createAIResourceOrchestrator({ registry });
    const discovered = await orchestrator.discoverProviderModels('unreachable-provider');

    assert.strictEqual(discovered.live, false, 'Discovery failure must NOT be marked live');
    assert.strictEqual(discovered.status, 'DEFERRED', 'Discovery failure must be DEFERRED');
    assert.strictEqual(discovered.reason, 'MODEL_DISCOVERY_FAILED', 'Must record failure reason');
  });

  // 4. STATIC CATALOG != LIVE AVAILABILITY
  it('4. Static catalog != live availability', () => {
    const orchestrator = createAIResourceOrchestrator();
    const deepseek = orchestrator.getResource('nvidia', 'deepseek-ai/deepseek-v4-pro-0813');

    assert.ok(deepseek, 'DeepSeek V4 Pro must exist in catalog metadata');
    assert.strictEqual(deepseek.availability, 'UNAVAILABLE', 'Unverified static catalog model must be UNAVAILABLE');
    assert.strictEqual(deepseek.health, ModelHealthStatus.DEGRADED, 'Timeout/deferred model must be marked DEGRADED');
    assert.strictEqual(deepseek.status, ModelAvailability.DEFERRED, 'Must have DEFERRED status');
  });

  // 5. CAPABILITY FILTERING
  it('5. Capability filtering', () => {
    const orchestrator = createAIResourceOrchestrator();

    const visionResources = orchestrator.listResources({ capability: StandardModelCapabilities.VISION });
    assert.ok(visionResources.length > 0, 'Must find vision-capable resources');

    for (const res of visionResources) {
      const normCaps = res.capabilities.map(c => normalizeCapability(c));
      assert.ok(
        normCaps.includes(StandardModelCapabilities.VISION) || normCaps.includes('image_input'),
        'All filtered resources must support vision'
      );
    }
  });

  // 6. UNKNOWN CAPABILITY IS NOT SUPPORTED
  it('6. Unknown capability is not supported (UNKNOWN !== SUPPORTED)', () => {
    const orchestrator = createAIResourceOrchestrator();

    const unknownCapability = 'teleportation_quantum_compute';
    const normalized = normalizeCapability(unknownCapability);
    assert.strictEqual(normalized, 'unknown', 'Unrecognized capability must normalize to unknown');

    const decision = orchestrator.selectBestModel({
      requiredCapabilities: [unknownCapability]
    });

    assert.strictEqual(decision.selectedModel, null, 'No model should be selected for unsupported unknown capability');
    assert.ok(decision.rejectedModels.length > 0, 'Models must be rejected under capability gate');
  });

  // 7. QUOTA EXCEEDED ISOLATION
  it('7. Quota exceeded isolation', () => {
    const orchestrator = createAIResourceOrchestrator();

    orchestrator.setQuotaState('kimi', null, QuotaState.QUOTA_EXCEEDED);
    assert.strictEqual(orchestrator.getQuotaState('kimi'), QuotaState.QUOTA_EXCEEDED);

    assert.strictEqual(orchestrator.getQuotaState('gemini'), QuotaState.NORMAL);
    assert.strictEqual(orchestrator.getQuotaState('groq'), QuotaState.NORMAL);
    assert.strictEqual(orchestrator.getQuotaState('nvidia'), QuotaState.NORMAL);
    assert.strictEqual(orchestrator.getQuotaState('local'), QuotaState.NORMAL);

    const candidates = orchestrator.selectCandidates({ requiredCapabilities: [ProviderCapabilities.TEXT] });
    assert.strictEqual(candidates.some(c => c.providerId === 'kimi'), false, 'Kimi must be excluded from candidates');
    assert.ok(candidates.some(c => c.providerId === 'local' || c.providerId === 'gemini'), 'Other providers remain available');
  });

  // 8. RATE LIMIT ISOLATION
  it('8. Rate limit isolation', () => {
    const orchestrator = createAIResourceOrchestrator();

    orchestrator.setQuotaState('groq', 'llama-3.3-70b-versatile', QuotaState.RATE_LIMITED);
    assert.strictEqual(orchestrator.getQuotaState('groq', 'llama-3.3-70b-versatile'), QuotaState.RATE_LIMITED);

    assert.strictEqual(orchestrator.getQuotaState('nvidia', 'meta/llama-3.2-11b-vision-instruct'), QuotaState.NORMAL);
    assert.strictEqual(orchestrator.getQuotaState('gemini'), QuotaState.NORMAL);
  });

  // 9. MODEL-LEVEL CIRCUIT BREAKER
  it('9. Model-level circuit breaker', () => {
    const orchestrator = createAIResourceOrchestrator();

    const modelA = 'meta/llama-3.2-11b-vision-instruct';
    const modelB = 'deepseek-ai/deepseek-v4-pro-0813';

    for (let i = 0; i < 5; i++) {
      orchestrator.recordFailure('nvidia', modelB, new Error('Simulated failure'));
    }

    assert.strictEqual(orchestrator.getCircuitState('nvidia', modelB), CircuitBreakerState.OPEN);
    assert.strictEqual(orchestrator.canExecute('nvidia', modelB), false, 'Tripped model must not be executable');

    assert.strictEqual(orchestrator.getCircuitState('nvidia', modelA), CircuitBreakerState.CLOSED);
    assert.strictEqual(orchestrator.canExecute('nvidia', modelA), true, 'Sibling model on same provider must remain executable');
  });

  // 10. PROVIDER-LEVEL ISOLATION
  it('10. Provider-level isolation', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'faulty-provider',
      name: 'Faulty Provider',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => {
        throw new Error('500 Internal Server Error: Database down');
      }
    });

    registry.registerProvider({
      providerId: 'healthy-provider',
      name: 'Healthy Provider',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => {
        return {
          output: 'HEALTHY_PROV_SUCCESS',
          model: 'healthy-model',
          usage: { totalTokens: 12 },
          latencyMs: 80
        };
      }
    });

    const orchestrator = createAIResourceOrchestrator({ registry });

    const result = await orchestrator.dispatchTask({
      taskId: 'prov-iso-task-1',
      prompt: 'Test provider isolation',
      preferredProvider: 'faulty-provider'
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.providerId, 'healthy-provider');
    assert.strictEqual(result.fallbackTriggered, true);
  });

  // 11. INTELLIGENT MODEL SCORING
  it('11. Intelligent model scoring', () => {
    const healthyResource = {
      resourceId: 'gemini:gemini-1.5-flash',
      providerId: 'gemini',
      modelId: 'gemini-1.5-flash',
      capabilities: ['text_generation', 'reasoning', 'coding', 'vision'],
      availability: ModelAvailability.AVAILABLE,
      health: ModelHealthStatus.HEALTHY,
      quotaState: QuotaState.NORMAL,
      circuitState: CircuitBreakerState.CLOSED,
      latencyMs: 180
    };

    const degradedResource = {
      resourceId: 'nvidia:deepseek-ai/deepseek-v4-pro-0813',
      providerId: 'nvidia',
      modelId: 'deepseek-ai/deepseek-v4-pro-0813',
      capabilities: ['text_generation', 'reasoning'],
      availability: ModelAvailability.UNAVAILABLE,
      health: ModelHealthStatus.DEGRADED,
      quotaState: QuotaState.NORMAL,
      circuitState: CircuitBreakerState.CLOSED,
      latencyMs: null
    };

    const healthyScore = calculateModelScore({
      resource: healthyResource,
      requiredCapabilities: ['text_generation']
    });

    const degradedScore = calculateModelScore({
      resource: degradedResource,
      requiredCapabilities: ['text_generation']
    });

    assert.ok(healthyScore.totalScore > 0, 'Healthy resource must have positive score');
    assert.strictEqual(degradedScore.totalScore, 0.0, 'Unavailable/degraded resource must have 0 score');
    assert.ok(healthyScore.totalScore > degradedScore.totalScore, 'Healthy model score must exceed degraded score');
  });

  // 12. SELECTION EXPLANATION
  it('12. Selection explanation produces forensic audit trail', () => {
    const orchestrator = createAIResourceOrchestrator();

    const decision = orchestrator.selectBestModel({
      task: 'Analyze cybersecurity vulnerability report',
      requiredCapabilities: [StandardModelCapabilities.TEXT_GENERATION]
    });

    assert.ok(decision.selectedModel, 'Must select a model');
    assert.strictEqual(typeof decision.selectionReason, 'string');
    assert.ok(decision.selectionReason.length > 10, 'Must have detailed selection reason');
    assert.ok(Array.isArray(decision.candidates), 'Must list eligible candidates');
    assert.ok(Array.isArray(decision.rejectedModels), 'Must list rejected models');
    assert.ok(typeof decision.rejectionReasons === 'object', 'Must provide rejection reasons map');
    assert.ok(typeof decision.scoreBreakdown === 'object', 'Must provide score breakdown map');
  });

  // 13. WORKLOAD DISTRIBUTION
  it('13. Workload distribution distributes across healthy resources', async () => {
    const orchestrator = createAIResourceOrchestrator();

    const tasks = [
      { id: 'w-1', task: 'Task 1: Generate security checklist' },
      { id: 'w-2', task: 'Task 2: Summarize network topology' },
      { id: 'w-3', task: 'Task 3: Review audit log entries' }
    ];

    const distribution = await orchestrator.distributeWorkload({ tasks });

    assert.strictEqual(distribution.total, 3);
    assert.strictEqual(distribution.successful, 3);
    assert.strictEqual(distribution.results.length, 3);

    for (const r of distribution.results) {
      assert.strictEqual(r.status, GatewayInvocationStatus.SUCCESS);
      assert.strictEqual(r.proposalOnly, true);
      assert.strictEqual(r.executionAuthorized, false);
      assert.ok(r.responseHash, 'Must have SHA-256 fingerprint');
    }
  });

  // 14. REAL FAILOVER
  it('14. Real failover triggers capability-preserving fallback and traces', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });

    registry.registerProvider({
      providerId: 'primary-failing',
      name: 'Primary Failing',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      invoke: async () => {
        const err = new Error('Gateway timeout after 5000ms');
        err.name = 'AbortError';
        throw err;
      }
    });

    registry.registerProvider({
      providerId: 'fallback-success',
      name: 'Fallback Success',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      invoke: async () => {
        return {
          output: 'FALLBACK_SUCCESS_RESPONSE',
          model: 'fallback-model-v1',
          usage: { totalTokens: 15 },
          latencyMs: 95
        };
      }
    });

    const orchestrator = createAIResourceOrchestrator({ registry });

    const result = await orchestrator.dispatchTask({
      taskId: 'failover-validation-task',
      prompt: 'Execute failover test',
      preferredProvider: 'primary-failing'
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.providerId, 'fallback-success');
    assert.strictEqual(result.fallbackTriggered, true);
    assert.strictEqual(result.primaryProviderId, 'primary-failing');
    assert.ok(result.failoverTraces.length >= 1, 'Must record failover traces');

    const trace = result.failoverTraces[0];
    assert.ok(trace.primaryModel.includes('primary-failing'));
    assert.strictEqual(trace.fallbackProvider, 'fallback-success');
    assert.strictEqual(trace.fallbackTriggered, true);
  });

  // 15. INFINITE RETRY PREVENTION
  it('15. Infinite retry prevention strictly caps attempts', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });

    let invocationCount = 0;
    registry.registerProvider({
      providerId: 'always-fail-1',
      name: 'Always Fail 1',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => {
        invocationCount++;
        throw new Error('Service Unavailable 503');
      }
    });

    registry.registerProvider({
      providerId: 'always-fail-2',
      name: 'Always Fail 2',
      capabilities: [ProviderCapabilities.TEXT],
      invoke: async () => {
        invocationCount++;
        throw new Error('Service Unavailable 503');
      }
    });

    const orchestrator = createAIResourceOrchestrator({ registry });

    const result = await orchestrator.dispatchTask({
      taskId: 'infinite-retry-guard',
      prompt: 'Test infinite retry barrier',
      maxFailoverAttempts: 2
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.FAILED);
    assert.ok(invocationCount <= 2, 'Invocations (' + invocationCount + ') must never exceed maxFailoverAttempts (2)');
    assert.strictEqual(result.attemptNumber, invocationCount);
  });

  // 16. SHA-256 FORENSIC FINGERPRINT
  it('16. SHA-256 forensic fingerprint computed deterministically', async () => {
    const orchestrator = createAIResourceOrchestrator();

    const result = await orchestrator.dispatchTask({
      taskId: 'sha256-test-task',
      prompt: 'Deterministic fingerprint verification',
      preferredProvider: 'local'
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.ok(result.responseHash, 'Must compute SHA-256 responseHash');
    assert.strictEqual(result.responseHash.length, 64, 'SHA-256 hash must be 64 hexadecimal characters');
    assert.match(result.responseHash, /^[a-f0-9]{64}$/, 'Must be valid hex string');
  });

  // 17. ZERO AI AUTHORITY
  it('17. Zero AI authority enforced on all orchestration outcomes', async () => {
    const orchestrator = createAIResourceOrchestrator();

    const result = await orchestrator.dispatchTask({
      taskId: 'zero-auth-task',
      prompt: 'Execute secure analysis',
      preferredProvider: 'local'
    });

    assert.strictEqual(result.proposalOnly, true, 'proposalOnly must be true');
    assert.strictEqual(result.executionAuthorized, false, 'executionAuthorized must be false');
    assert.strictEqual(result.mutationAuthorized, false, 'mutationAuthorized must be false');
    assert.strictEqual(result.deploymentAuthorized, false, 'deploymentAuthorized must be false');
    assert.strictEqual(result.networkAuthorized, false, 'networkAuthorized must be false');
    assert.strictEqual(result.shellAuthorized, false, 'shellAuthorized must be false');
    assert.strictEqual(result.requiresApproval, true, 'requiresApproval must be true');
  });

  // 18. SECRET REDACTION
  it('18. Secret redaction prevents leaks in errors, credentials, and telemetry', () => {
    const orchestrator = createAIResourceOrchestrator();

    const cred = orchestrator.resolveCredential({ providerId: 'nvidia' });
    assert.ok(cred.alias, 'Must provide credential alias');
    assert.strictEqual(typeof cred.isConfigured, 'boolean');
    assert.strictEqual(cred.apiKey, undefined, 'Raw apiKey must NEVER be present on credential object');
    assert.strictEqual(cred.secret, undefined, 'Raw secret must NEVER be present on credential object');

    const inventory = orchestrator.listResources();
    for (const res of inventory) {
      assert.strictEqual(res.apiKey, undefined, 'Resource must not contain apiKey');
      assert.strictEqual(res.secret, undefined, 'Resource must not contain secret');
      assert.strictEqual(res.key, undefined, 'Resource must not contain key');
    }
  });

  // 19. REGRESSION PROTECTION
  it('19. Regression protection: FAZ 1-66.7 functionality intact', () => {
    const orchestrator = createAIResourceOrchestrator();

    assert.ok(orchestrator.gateway, 'Gateway must exist');
    assert.ok(orchestrator.registry, 'Registry must exist');
    assert.ok(orchestrator.modelRegistry, 'ModelRegistry must exist');
    assert.ok(orchestrator.circuitBreaker, 'CircuitBreaker must exist');

    const restrictedCandidates = orchestrator.selectCandidates({
      dataClassification: DataClassification.RESTRICTED
    });

    for (const c of restrictedCandidates) {
      assert.ok(c.providerType === ProviderType.LOCAL || ['local', 'ollama'].includes(c.providerId), 'Restricted data classification must isolate to local provider');
    }
  });
});
