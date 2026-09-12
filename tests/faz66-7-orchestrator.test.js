/**
 * ONLUNET ZEKA - FAZ 66.7 Provider-Agnostic AI Resource Orchestrator Test Suite
 *
 * Requirements:
 * 1. Provider Registry extensibility & multi-provider support
 * 2. Model Discovery & catalog normalization
 * 3. Credential Resolution & Fallback (NVIDIA_DEEPSEEK_API_KEY, NVIDIA_KIMI_API_KEY, NVIDIA_API_KEY)
 * 4. Credential Isolation (Kimi Direct vs NVIDIA Kimi independence, alias only in output)
 * 5. Capability Matching & Task Analysis (Text, Reasoning, Vision, Fast Inference)
 * 6. Provider Health & Model Health tracking (HEALTHY, DEGRADED, UNAVAILABLE)
 * 7. Model-Specific Circuit Breaker (provider:model isolation)
 * 8. Quota / Rate Limit aware routing (QUOTA_EXCEEDED, RATE_LIMITED)
 * 9. Cross-Provider Intelligent Failover (Capability-preserving fallback)
 * 10. Dynamic Workload Distribution (5+ independent tasks)
 * 11. Direct vs Aggregator provider classification
 * 12. Complete Provider Failure Isolation (NVIDIA DOWN, Kimi DOWN, OpenAI Quota Exhausted)
 * 13. Critical Architectural Test: Kimi QUOTA -> NVIDIA TIMEOUT -> Gemini HEALTHY real response
 * 14. Zero AI Authority Guarantee (proposalOnly: true, executionAuthorized: false)
 * 15. Forensic Telemetry & SHA-256 Response Fingerprint
 * 16. Secret Sanitization & Defense against leaks
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js test runner only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

import {
  createAIResourceOrchestrator,
  resolveCredential,
  classifyError,
  ResourceHealthStatus,
  QuotaState,
  ProviderType
} from '../src/orchestration/ai-resource-orchestrator.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createModelRegistry } from '../src/providers/model-registry.js';
import { createProviderGateway, GatewayInvocationStatus, DefaultGatewayAuthorityGuarantee } from '../src/providers/provider-gateway.js';
import { CircuitBreakerState } from '../src/providers/circuit-breaker.js';
import { ProviderCategories, ProviderPriority } from '../src/providers/provider-categories.js';
import { ProviderCapabilities } from '../src/providers/provider-capabilities.js';
import { sanitizeString, sanitizeError } from '../src/providers/credential-sanitizer.js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env');
  } catch (e) {}
}

describe('FAZ 66.7: Provider-Agnostic AI Resource Orchestrator', () => {

  // 1. PROVIDER REGISTRY EXTENSIBILITY
  it('1. Extensible Provider Registry registers all required providers without hardcoding core', () => {
    const orchestrator = createAIResourceOrchestrator();
    const providers = orchestrator.registry.listProviders();
    const providerIds = providers.map(p => p.providerId);

    assert.ok(providerIds.includes('nvidia'), 'nvidia must be registered');
    assert.ok(providerIds.includes('kimi'), 'kimi must be registered');
    assert.ok(providerIds.includes('gemini'), 'gemini must be registered');
    assert.ok(providerIds.includes('groq'), 'groq must be registered');
    assert.ok(providerIds.includes('openrouter'), 'openrouter must be registered');
    assert.ok(providerIds.includes('openai'), 'openai must be registered');
    assert.ok(providerIds.includes('local'), 'local must be registered');

    // Dynamic registration of a custom provider
    orchestrator.registerProvider({
      providerId: 'custom-academic-engine',
      name: 'Custom Academic Engine',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      invoke: async () => ({ output: 'OK' }),
      checkHealth: async () => ({ status: 'AVAILABLE', ready: true })
    });

    const custom = orchestrator.registry.getProvider('custom-academic-engine');
    assert.ok(custom, 'Custom provider must be registered dynamically');
    assert.strictEqual(custom.providerId, 'custom-academic-engine');
  });

  // 2. MODEL DISCOVERY
  it('2. Model discovery returns normalized catalog and registers models into inventory', async () => {
    const orchestrator = createAIResourceOrchestrator();
    const discovered = await orchestrator.discoverProviderModels('nvidia');

    assert.ok(Array.isArray(discovered), 'Discovered models must be an array');
    assert.ok(discovered.length > 0, 'NVIDIA catalog must contain discovered models');

    const discoveredIds = discovered.map(m => m.id);
    assert.ok(discoveredIds.some(id => id.includes('llama') || id.includes('deepseek') || id.includes('vision')),
      'Discovered models must contain catalog models');

    // Check that model registry indexed them
    const model = orchestrator.modelRegistry.getModel('meta/llama-3.2-11b-vision-instruct', { providerId: 'nvidia' });
    assert.ok(model, 'Discovered model must be indexed in model registry');
    assert.strictEqual(model.providerId, 'nvidia');
  });

  // 3. CREDENTIAL RESOLUTION & FALLBACK
  it('3. Resolves credential alias and fallback hierarchy without leaking raw keys', () => {
    // NVIDIA DeepSeek: falls back to NVIDIA_API_KEY if NVIDIA_DEEPSEEK_API_KEY is not set
    const deepseekCred = resolveCredential({ providerId: 'nvidia', modelId: 'deepseek-ai/deepseek-v4-pro-0813' });
    assert.ok(deepseekCred.alias === 'NVIDIA_DEEPSEEK_API_KEY' || deepseekCred.alias === 'NVIDIA_API_KEY');
    assert.strictEqual(typeof deepseekCred.isConfigured, 'boolean');

    // NVIDIA Kimi: resolves NVIDIA_KIMI_API_KEY
    const nvidiaKimiCred = resolveCredential({ providerId: 'nvidia', modelId: 'moonshotai/kimi-k3' });
    assert.ok(nvidiaKimiCred.alias === 'NVIDIA_KIMI_API_KEY' || nvidiaKimiCred.alias === 'NVIDIA_API_KEY');

    // Kimi Direct: resolves KIMI_API_KEY or MOONSHOT_API_KEY (independent of NVIDIA_KIMI_API_KEY)
    const kimiDirectCred = resolveCredential({ providerId: 'kimi', modelId: 'moonshot-v1-8k' });
    assert.ok(kimiDirectCred.alias === 'KIMI_API_KEY' || kimiDirectCred.alias === 'MOONSHOT_API_KEY');

    // Gemini
    const geminiCred = resolveCredential({ providerId: 'gemini', modelId: 'gemini-1.5-flash' });
    assert.ok(geminiCred.alias === 'GEMINI_API_KEY' || geminiCred.alias === 'GOOGLE_API_KEY');

    // Local
    const localCred = resolveCredential({ providerId: 'local' });
    assert.strictEqual(localCred.alias, 'LOCAL_IN_MEMORY');
    assert.strictEqual(localCred.isConfigured, true);
  });

  // 4. CREDENTIAL ISOLATION (KIMI DIRECT vs NVIDIA KIMI)
  it('4. Credential isolation strictly separates Kimi Direct from NVIDIA Kimi', () => {
    const kimiDirect = resolveCredential({ providerId: 'kimi', modelId: 'moonshot-v1-8k' });
    const nvidiaKimi = resolveCredential({ providerId: 'nvidia', modelId: 'moonshotai/kimi-k3' });

    assert.notStrictEqual(kimiDirect.alias, nvidiaKimi.alias, 'Kimi Direct and NVIDIA Kimi must use separate credential aliases');
    assert.ok(kimiDirect.alias.includes('KIMI_API_KEY') || kimiDirect.alias.includes('MOONSHOT'));
    assert.ok(nvidiaKimi.alias.includes('NVIDIA_KIMI_API_KEY') || nvidiaKimi.alias.includes('NVIDIA_API_KEY'));
  });

  // 5. RESOURCE INVENTORY NORMALIZATION
  it('5. Resource inventory normalizes provider/model assets with capabilities and types', () => {
    const orchestrator = createAIResourceOrchestrator();
    const inventory = orchestrator.listResources();

    assert.ok(inventory.length >= 6, 'Inventory must contain resources from registered providers');
    for (const res of inventory) {
      assert.ok(res.resourceId, 'Resource must have resourceId');
      assert.ok(res.providerId, 'Resource must have providerId');
      assert.ok(res.modelId, 'Resource must have modelId');
      assert.ok(res.credentialAlias, 'Resource must have credentialAlias');
      assert.ok(Array.isArray(res.capabilities), 'Resource must have capabilities array');
      assert.ok(['DIRECT', 'AGGREGATOR', 'LOCAL'].includes(res.providerType), 'Resource must have valid providerType');
      assert.ok(['AVAILABLE', 'UNAVAILABLE', 'DEGRADED'].includes(res.availability), 'Resource must have valid availability');
      assert.ok(['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN'].includes(res.health), 'Resource must have valid health');
      assert.ok(['NORMAL', 'QUOTA_EXCEEDED', 'RATE_LIMITED', 'UNKNOWN'].includes(res.quotaState), 'Resource must have valid quotaState');
      assert.ok(['CLOSED', 'OPEN', 'HALF_OPEN'].includes(res.circuitState), 'Resource must have valid circuitState');
    }
  });

  // 6. DIRECT VS AGGREGATOR PROVIDER DISTINCTION
  it('6. Distinguishes Direct Providers from Aggregator / Hosted Providers', () => {
    const orchestrator = createAIResourceOrchestrator();

    const directResources = orchestrator.listResources({ providerType: ProviderType.DIRECT });
    const aggregatorResources = orchestrator.listResources({ providerType: ProviderType.AGGREGATOR });
    const localResources = orchestrator.listResources({ providerType: ProviderType.LOCAL });

    const directProviders = new Set(directResources.map(r => r.providerId));
    const aggregatorProviders = new Set(aggregatorResources.map(r => r.providerId));
    const localProviders = new Set(localResources.map(r => r.providerId));

    assert.ok(directProviders.has('gemini') || directProviders.has('groq') || directProviders.has('kimi') || directProviders.has('openai'),
      'Direct providers must include gemini, groq, kimi, or openai');
    assert.ok(aggregatorProviders.has('nvidia') || aggregatorProviders.has('openrouter'),
      'Aggregator providers must include nvidia or openrouter');
    assert.ok(localProviders.has('local'),
      'Local providers must include local');
  });

  // 7. CAPABILITY-AWARE TASK ROUTING
  it('7. Capability-aware candidate selection filters and ranks models matching requirements', () => {
    const orchestrator = createAIResourceOrchestrator();

    // Vision task requires VISION capability
    const visionCandidates = orchestrator.selectCandidates({
      requiredCapabilities: [ProviderCapabilities.VISION]
    });

    assert.ok(visionCandidates.length > 0, 'Must find candidates supporting VISION');
    for (const cand of visionCandidates) {
      assert.ok(cand.capabilities.includes(ProviderCapabilities.VISION),
        `Candidate ${cand.resourceId} must have VISION capability`);
    }

    // Reasoning task requires REASONING capability
    const reasoningCandidates = orchestrator.selectCandidates({
      requiredCapabilities: [ProviderCapabilities.REASONING]
    });

    assert.ok(reasoningCandidates.length > 0, 'Must find candidates supporting REASONING');
    for (const cand of reasoningCandidates) {
      assert.ok(cand.capabilities.includes(ProviderCapabilities.REASONING),
        `Candidate ${cand.resourceId} must have REASONING capability`);
    }
  });

  // 8. MODEL-SPECIFIC CIRCUIT BREAKER ISOLATION
  it('8. Model-specific circuit breaker trips failing model without blocking other models or providers', () => {
    const orchestrator = createAIResourceOrchestrator();

    const failingModelKey = 'deepseek-ai/deepseek-v4-pro-0813';
    const healthyModelKey = 'meta/llama-3.2-11b-vision-instruct';

    // Record failures for deepseek-v4-pro
    orchestrator.recordFailure('nvidia', failingModelKey, new Error('Inference Timeout'));
    orchestrator.recordFailure('nvidia', failingModelKey, new Error('Inference Timeout'));

    // Failing model circuit must be OPEN
    assert.strictEqual(orchestrator.getCircuitState('nvidia', failingModelKey), CircuitBreakerState.OPEN);
    assert.strictEqual(orchestrator.canExecute('nvidia', failingModelKey), false);

    // Healthy model under same provider must remain CLOSED
    assert.strictEqual(orchestrator.getCircuitState('nvidia', healthyModelKey), CircuitBreakerState.CLOSED);
    assert.strictEqual(orchestrator.canExecute('nvidia', healthyModelKey), true);

    // Other providers must remain CLOSED
    assert.strictEqual(orchestrator.canExecute('gemini'), true);
    assert.strictEqual(orchestrator.canExecute('groq'), true);
    assert.strictEqual(orchestrator.canExecute('local'), true);
  });

  // 9. QUOTA & RATE LIMIT AWARE ROUTING
  it('9. Classifies quota and rate limit errors and routes around quota-exhausted resources', () => {
    // 429 Insufficient Quota
    const quotaErr = new Error('You exceeded your current quota, please check your plan and billing details.');
    quotaErr.status = 429;
    const classifiedQuota = classifyError(quotaErr);
    assert.strictEqual(classifiedQuota.code, 'QUOTA_EXCEEDED');
    assert.strictEqual(classifiedQuota.quotaState, QuotaState.QUOTA_EXCEEDED);

    // 429 Rate Limit (RPM/TPM)
    const rateLimitErr = new Error('Rate limit reached for requests');
    rateLimitErr.status = 429;
    const classifiedRate = classifyError(rateLimitErr);
    assert.strictEqual(classifiedRate.code, 'RATE_LIMITED');
    assert.strictEqual(classifiedRate.quotaState, QuotaState.RATE_LIMITED);

    // Orchestrator marks quota exceeded and excludes from candidates
    const orchestrator = createAIResourceOrchestrator();
    orchestrator.setQuotaState('openai', 'gpt-4o', QuotaState.QUOTA_EXCEEDED);

    const candidates = orchestrator.selectCandidates({ preferredProvider: 'openai' });
    const hasExceeded = candidates.some(c => c.providerId === 'openai' && c.modelId === 'gpt-4o');
    assert.strictEqual(hasExceeded, false, 'Quota-exceeded resource must be excluded from candidate selection');
  });

  // 10. PROVIDER FAILURE ISOLATION: NVIDIA DOWN
  it('10. Provider failure isolation: NVIDIA DOWN does not crash or block other providers', async () => {
    const orchestrator = createAIResourceOrchestrator();

    // Trip NVIDIA provider entirely
    orchestrator.circuitBreaker.recordFailure('nvidia', new Error('Gateway 503'));
    orchestrator.circuitBreaker.recordFailure('nvidia', new Error('Gateway 503'));
    assert.strictEqual(orchestrator.canExecute('nvidia'), false);

    // Local, Gemini, Groq, OpenRouter must execute without interruption
    const res = await orchestrator.dispatchTask({
      prompt: 'Test isolation prompt',
      preferredProvider: 'local'
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.providerId, 'local');
    assert.strictEqual(res.executionAuthorized, false);
    assert.strictEqual(res.proposalOnly, true);
  });

  // 11. PROVIDER FAILURE ISOLATION: KIMI DIRECT DOWN
  it('11. Provider failure isolation: Kimi Direct DOWN does not crash or block NVIDIA or Gemini', async () => {
    const orchestrator = createAIResourceOrchestrator();

    // Trip Kimi provider
    orchestrator.circuitBreaker.recordFailure('kimi', new Error('Connection refused'));
    orchestrator.circuitBreaker.recordFailure('kimi', new Error('Connection refused'));
    assert.strictEqual(orchestrator.canExecute('kimi'), false);

    // System can dispatch to local or other healthy providers
    const res = await orchestrator.dispatchTask({
      prompt: 'Test Kimi isolation prompt',
      preferredProvider: 'local'
    });

    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.providerId, 'local');
  });

  // 12. CRITICAL ARCHITECTURAL TEST: KIMI QUOTA -> NVIDIA TIMEOUT -> GEMINI/LOCAL HEALTHY
  it('12. Critical Architectural Test: Kimi (Quota Exceeded) -> NVIDIA (Timeout) -> Healthy Fallback executes successfully', async () => {
    // Custom registry with simulated behavior
    const registry = createProviderRegistry({ includeBuiltins: false });

    // Kimi Direct throws QUOTA_EXCEEDED
    registry.registerProvider({
      providerId: 'kimi',
      name: 'Kimi Direct',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      invoke: async () => {
        const err = new Error('Insufficient quota: please check your balance');
        err.status = 429;
        throw err;
      }
    });

    // NVIDIA NIM throws TIMEOUT
    registry.registerProvider({
      providerId: 'nvidia',
      name: 'NVIDIA NIM',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      invoke: async () => {
        const err = new Error('The operation was aborted due to timeout');
        err.name = 'AbortError';
        throw err;
      }
    });

    // Gemini/Healthy returns HTTP 200 SUCCESS
    registry.registerProvider({
      providerId: 'gemini',
      name: 'Gemini Direct',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
      invoke: async () => {
        return {
          rawContent: 'ONLUNET_HEALTHY_FALLBACK_SUCCESS',
          output: 'ONLUNET_HEALTHY_FALLBACK_SUCCESS',
          model: 'gemini-1.5-flash',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          latencyMs: 142
        };
      }
    });

    const orchestrator = createAIResourceOrchestrator({ registry });

    // Dispatch with preferredProvider kimi and fallback order kimi -> nvidia -> gemini
    const result = await orchestrator.dispatchTask({
      taskId: 'arch-test-task-1',
      prompt: 'Execute critical architecture validation',
      requiredCapabilities: [ProviderCapabilities.TEXT],
      preferredProvider: 'kimi'
    });

    assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(result.providerId, 'gemini');
    assert.strictEqual(result.fallbackTriggered, true);
    assert.strictEqual(result.primaryProviderId, 'kimi');
    assert.ok(result.attemptedResources.length >= 2, 'Must have attempted at least Kimi and fallback');
    assert.strictEqual(result.proposalOnly, true);
    assert.strictEqual(result.executionAuthorized, false);
    assert.ok(result.responseHash, 'Must compute SHA-256 fingerprint of response');
  });

  // 13. WORKLOAD DISTRIBUTION
  it('13. Distributes a batch of independent tasks across available healthy resources', async () => {
    const orchestrator = createAIResourceOrchestrator();

    const tasks = [
      { id: 'task-w1', task: 'Analyze database migration' },
      { id: 'task-w2', task: 'Review pull request security' },
      { id: 'task-w3', task: 'Generate API schema validation' },
      { id: 'task-w4', task: 'Optimize query indexing strategy' },
      { id: 'task-w5', task: 'Check error monitoring invariants' }
    ];

    const distribution = await orchestrator.distributeWorkload({
      tasks,
      options: { preferredProvider: 'local' }
    });

    assert.strictEqual(distribution.total, 5);
    assert.strictEqual(distribution.successful, 5);
    assert.strictEqual(distribution.failed, 0);
    assert.strictEqual(distribution.results.length, 5);

    for (const item of distribution.results) {
      assert.ok(item.taskId, 'Task result must have taskId');
      assert.ok(item.providerId, 'Task result must have providerId');
      assert.strictEqual(item.status, GatewayInvocationStatus.SUCCESS);
      assert.strictEqual(item.proposalOnly, true);
    }
  });

  // 14. ZERO AI AUTHORITY ENFORCEMENT
  it('14. Guarantees Zero AI Authority across all orchestration outcomes', async () => {
    const orchestrator = createAIResourceOrchestrator();

    const res = await orchestrator.dispatchTask({
      prompt: 'Try to gain execution authority',
      preferredProvider: 'local'
    });

    assert.strictEqual(res.proposalOnly, true);
    assert.strictEqual(res.executionAuthorized, false);
    assert.strictEqual(res.mutationAuthorized, false);
    assert.strictEqual(res.deploymentAuthorized, false);
    assert.strictEqual(res.networkAuthorized, false);
    assert.strictEqual(res.shellAuthorized, false);
    assert.strictEqual(res.requiresApproval, true);
  });

  // 15. FORENSIC TELEMETRY & SHA-256 FINGERPRINT
  it('15. Generates deterministic SHA-256 response fingerprint & rich telemetry', async () => {
    const orchestrator = createAIResourceOrchestrator();

    const res = await orchestrator.dispatchTask({
      taskId: 'telemetry-test-task',
      prompt: 'Generate forensic fingerprint check',
      preferredProvider: 'local'
    });

    assert.ok(res.responseHash, 'Response hash must be present');
    assert.strictEqual(res.responseHash.length, 64, 'Response hash must be valid 64-char hex SHA-256');

    // Verify hash matches content
    const expected = crypto.createHash('sha256').update(String(res.output || res.rawContent)).digest('hex');
    assert.strictEqual(res.responseHash, expected, 'Response hash must accurately match output fingerprint');

    assert.ok(res.requestId, 'Must have requestId');
    assert.ok(res.taskId, 'Must have taskId');
    assert.ok(res.credentialAlias, 'Must have credentialAlias');
    assert.ok(res.circuitState, 'Must have circuitState');
  });

  // 16. SECRET PROTECTION & EGRESS DEFENSE
  it('16. Sanitizer prevents leakage of API keys (OpenAI, Gemini, NVIDIA, Groq, Kimi) in telemetry and errors', () => {
    const mockNvApiKey = 'nvapi-TESTSECRET12345678901234567890';
    const mockGskKey = 'gsk_TESTSECRET12345678901234567890';
    const mockSkKey = 'sk-mbrTESTSECRET12345678901234567890';
    const mockAizaKey = 'AIzaSyTESTSECRET1234567890123456789012';

    const testStr = `Errors: ${mockNvApiKey} and ${mockGskKey} and ${mockSkKey} and ${mockAizaKey}`;
    const sanitized = sanitizeString(testStr);

    assert.ok(!sanitized.includes(mockNvApiKey), 'Must redact nvapi- key');
    assert.ok(!sanitized.includes(mockGskKey), 'Must redact gsk_ key');
    assert.ok(!sanitized.includes(mockSkKey), 'Must redact sk- key');
    assert.ok(!sanitized.includes(mockAizaKey), 'Must redact AIza key');
  });

  // 17. REAL MODEL CERTIFICATION STATUS FORENSIC ACCURACY
  it('17. Accurately reports DeepSeek V4 Pro as DEFERRED / TIMEOUT and NVIDIA Free Model as AVAILABLE', () => {
    const orchestrator = createAIResourceOrchestrator();

    // Inspect known status of models
    const llamaVision = orchestrator.getResource('nvidia', 'meta/llama-3.2-11b-vision-instruct');
    assert.ok(llamaVision, 'Llama Vision model must exist in NVIDIA inventory');
    assert.strictEqual(llamaVision.availability, 'AVAILABLE');

    const deepseekPro = orchestrator.getResource('nvidia', 'deepseek-ai/deepseek-v4-pro-0813');
    assert.ok(deepseekPro, 'DeepSeek V4 Pro model must exist in NVIDIA inventory');
    assert.strictEqual(deepseekPro.health, ResourceHealthStatus.DEGRADED);
    assert.strictEqual(deepseekPro.availability, 'UNAVAILABLE');
  });

  // 18. PROVIDER FAILURE ISOLATION: OPENAI QUOTA EXHAUSTED
  it('18. Provider failure isolation: OpenAI QUOTA EXHAUSTED does not block or impair other providers', async () => {
    const orchestrator = createAIResourceOrchestrator();

    // Mark OpenAI as QUOTA_EXCEEDED
    orchestrator.setQuotaState('openai', 'gpt-4o', QuotaState.QUOTA_EXCEEDED);
    orchestrator.setQuotaState('openai', null, QuotaState.QUOTA_EXCEEDED);

    // Ensure candidate selection excludes OpenAI
    const candidates = orchestrator.selectCandidates({ requiredCapabilities: [ProviderCapabilities.TEXT] });
    const hasOpenAI = candidates.some(c => c.providerId === 'openai');
    assert.strictEqual(hasOpenAI, false, 'OpenAI must be excluded when quota is exhausted');

    // Other providers continue operating normally
    assert.strictEqual(orchestrator.canExecute('local'), true);
    assert.strictEqual(orchestrator.canExecute('gemini'), true);
    assert.strictEqual(orchestrator.canExecute('groq'), true);

    const res = await orchestrator.dispatchTask({
      prompt: 'Execute after OpenAI quota exhaustion',
      preferredProvider: 'local'
    });
    assert.strictEqual(res.status, GatewayInvocationStatus.SUCCESS);
    assert.strictEqual(res.providerId, 'local');
  });

});
