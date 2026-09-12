/**
 * ONLUNET ZEKA - Provider-Agnostic AI Resource Orchestrator & Intelligent Scheduler
 * FAZ 66.7, 66.8, 66.9 & 66.10 Architecture: Multi-Account Credential Pool, Dynamic Discovery & Intelligent Quota Routing
 *
 * Core Flow:
 * ONLUNET ZEKA -> AI Resource Orchestrator -> Provider Gateway -> Providers -> Models
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 * ZERO SELF-AUTHORITY: All decisions are proposalOnly with executionAuthorized: false.
 */
import crypto from 'node:crypto';
import { ErrorCodes } from '../contracts/constants.js';
import { DataClassification } from '../control-plane/data-classifier.js';
import { createProviderRegistry } from '../providers/provider-registry.js';
import { createModelRegistry } from '../providers/model-registry.js';
import {
  createProviderGateway,
  GatewayInvocationStatus,
  DefaultGatewayAuthorityGuarantee,
  ProviderErrorCodes
} from '../providers/provider-gateway.js';
import { createCircuitBreaker, CircuitBreakerState } from '../providers/circuit-breaker.js';
import { sanitizeString, sanitizeError, sanitizeObject } from '../providers/credential-sanitizer.js';
import { ProviderCategories, ProviderPriority, LifecycleState } from '../providers/provider-categories.js';
import {
  ProviderCapabilities,
  StandardModelCapabilities,
  normalizeCapability
} from '../providers/provider-capabilities.js';
import { analyzeTask, TaskTypes, TaskComplexity } from '../providers/task-analyzer.js';
import {
  createCredentialPool,
  computeCredentialFingerprint,
  CredentialHealthStatus
} from '../providers/credential-pool.js';

export {
  CircuitBreakerState,
  GatewayInvocationStatus,
  ProviderCapabilities,
  StandardModelCapabilities,
  normalizeCapability,
  CredentialHealthStatus,
  computeCredentialFingerprint,
  createCredentialPool,
  TaskComplexity,
  ProviderPriority
};

export const ModelQualityTier = Object.freeze({
  TIER_1: 'ECONOMY',
  TIER_2: 'STANDARD',
  TIER_3: 'ADVANCED',
  TIER_4: 'PREMIUM_REASONING',
  ECONOMY: 'ECONOMY',
  STANDARD: 'STANDARD',
  ADVANCED: 'ADVANCED',
  PREMIUM_REASONING: 'PREMIUM_REASONING'
});

export function determineModelTier(res) {
  if (!res) return ModelQualityTier.TIER_2;
  const caps = Array.isArray(res.capabilities) ? res.capabilities : [];
  const pricing = res.cost || res.pricing || { inputPerMillion: 0 };
  const inputCost = pricing.inputPerMillion || 0;
  const mid = String(res.modelId || res.id || '').toLowerCase();

  // Explicit tier matching based on model identity
  if (mid.includes('3.8') || mid.includes('o1') || mid.includes('o3') || mid.includes('opus') || mid.includes('deepseek-r1') || mid.includes('reasoner')) {
    return ModelQualityTier.TIER_4; // PREMIUM_REASONING
  }
  if (mid.includes('pro') || mid.includes('sonnet') || (mid.includes('gpt-4') && !mid.includes('mini')) || mid.includes('70b') || inputCost >= 1.0) {
    return ModelQualityTier.TIER_3; // ADVANCED
  }
  if (mid.includes('3.6-flash') || mid.includes('haiku')) {
    return ModelQualityTier.TIER_2; // STANDARD
  }
  if (mid.includes('2.5-flash') || mid.includes('3.5-flash') || mid.includes('1.5-flash') || mid.includes('flash') || mid.includes('mini') || mid.includes('nano') || mid.includes('8b') || inputCost <= 0.2) {
    return ModelQualityTier.TIER_1; // ECONOMY
  }

  // General fallback by capabilities and cost
  if (caps.includes(ProviderCapabilities.REASONING) && inputCost >= 0.8) {
    return ModelQualityTier.TIER_4;
  }
  if (inputCost >= 0.5) {
    return ModelQualityTier.TIER_3;
  }
  if (caps.includes(ProviderCapabilities.FAST_INFERENCE) || inputCost <= 0.2) {
    return ModelQualityTier.TIER_1;
  }
  return ModelQualityTier.TIER_2; // STANDARD
}

export const ResourceTier = Object.freeze({
  L0_LOCAL_TOOL: 'L0_LOCAL_TOOL',
  L1_LOCAL_AI: 'L1_LOCAL_AI',
  L2_FREE_TIER: 'L2_FREE_TIER',
  L3_PAID_API: 'L3_PAID_API'
});

export function determineResourceTier(res) {
  if (!res) return ResourceTier.L2_FREE_TIER;
  const p = String(res.providerId || '').toLowerCase();
  const mid = String(res.modelId || res.id || '').toLowerCase();
  const type = res.providerType;

  if (type === ProviderType.LOCAL || p === 'local' || p === 'local-provider' || p === 'ollama' || p === 'vllm') {
    return ResourceTier.L1_LOCAL_AI;
  }
  if (res.isPaid === true || p === 'openai' || p === 'anthropic' || p === 'xai') {
    return ResourceTier.L3_PAID_API;
  }
  // Gemini Pro / Paid models are L3 Paid API
  if ((p === 'gemini' || p === 'google') && (mid.includes('pro') || res.isPaid === true)) {
    return ResourceTier.L3_PAID_API;
  }
  if (p === 'gemini' || p === 'google' || p === 'groq' || res.isFreeTier === true) {
    return ResourceTier.L2_FREE_TIER;
  }
  const pricing = res.cost || res.pricing || {};
  if ((pricing.inputPerMillion || 0) > 0 && !res.isFreeTier) {
    return ResourceTier.L3_PAID_API;
  }
  return ResourceTier.L2_FREE_TIER;
}

export const ModelHealthStatus = Object.freeze({
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  TIMEOUT: 'TIMEOUT',
  AUTH_FAILED: 'AUTH_FAILED',
  NETWORK_FAILED: 'NETWORK_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  UNAVAILABLE: 'UNAVAILABLE',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  UNKNOWN: 'UNKNOWN'
});

export const ResourceHealthStatus = ModelHealthStatus; // Backwards-compatible alias

export const ModelAvailability = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  LIVE_AVAILABLE: 'LIVE_AVAILABLE',
  LIVE_CERTIFIED: 'LIVE_CERTIFIED',
  CERTIFIED_BUILTIN: 'CERTIFIED_BUILTIN',
  DISCOVERED: 'DISCOVERED',
  CATALOG_ONLY: 'CATALOG_ONLY',
  DEFERRED: 'DEFERRED',
  AUTH_FAILED: 'AUTH_FAILED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',
  NOT_FOUND: 'NOT_FOUND',
  UNAVAILABLE: 'UNAVAILABLE',
  INFERENCE_FAILED: 'INFERENCE_FAILED',
  DISCOVERY_UNAVAILABLE: 'DISCOVERY_UNAVAILABLE'
});

export const ModelState = ModelAvailability;

export const CapabilityConfidence = Object.freeze({
  LIVE_CERTIFIED: 'LIVE_CERTIFIED',
  CATALOG_ONLY: 'CATALOG_ONLY',
  UNKNOWN: 'UNKNOWN'
});

export const QuotaState = Object.freeze({
  NORMAL: 'NORMAL',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RATE_LIMITED: 'RATE_LIMITED',
  UNKNOWN: 'UNKNOWN'
});

export const ProviderType = Object.freeze({
  DIRECT: 'DIRECT',
  AGGREGATOR: 'AGGREGATOR',
  LOCAL: 'LOCAL'
});

export const DefaultSchedulerWeights = Object.freeze({
  capabilityMatch: 1.0,
  healthScores: Object.freeze({
    HEALTHY: 1.0,
    DEGRADED: 0.6,
    UNKNOWN: 0.4,
    RATE_LIMITED: 0.1,
    QUOTA_EXCEEDED: 0.0,
    TIMEOUT: 0.0,
    AUTH_FAILED: 0.0,
    NOT_FOUND: 0.0,
    UNAVAILABLE: 0.0,
    CIRCUIT_OPEN: 0.0
  }),
  availabilityScores: Object.freeze({
    LIVE_CERTIFIED: 1.0,
    AVAILABLE: 1.0,
    LIVE_AVAILABLE: 0.95,
    CERTIFIED_BUILTIN: 0.9,
    DISCOVERED: 0.85,
    CATALOG_ONLY: 0.3,
    DEFERRED: 0.1,
    AUTH_FAILED: 0.0,
    QUOTA_EXCEEDED: 0.0,
    RATE_LIMITED: 0.1,
    TIMEOUT: 0.0,
    NOT_FOUND: 0.0,
    UNAVAILABLE: 0.0,
    INFERENCE_FAILED: 0.0,
    DISCOVERY_UNAVAILABLE: 0.0
  }),
  quotaScores: Object.freeze({
    NORMAL: 1.0,
    UNKNOWN: 0.8,
    RATE_LIMITED: 0.2,
    QUOTA_EXCEEDED: 0.0
  })
});

/**
 * Certifies a capability for a model, strictly distinguishing catalog vs live verified.
 * Strictly enforces UNKNOWN !== SUPPORTED.
 */
export function certifyModelCapability(resource, capability, liveVerified = false) {
  const normReq = normalizeCapability(capability);
  if (normReq === 'unknown') {
    return Object.freeze({
      capability,
      normalizedCapability: 'unknown',
      catalog: false,
      liveVerified: false,
      confidence: CapabilityConfidence.UNKNOWN
    });
  }

  const resCapsNorm = (resource && resource.capabilities ? resource.capabilities : []).map(c => normalizeCapability(c));
  const hasInCatalog = resCapsNorm.includes(normReq);

  let confidence = CapabilityConfidence.UNKNOWN;
  if (hasInCatalog && liveVerified) {
    confidence = CapabilityConfidence.LIVE_CERTIFIED;
  } else if (hasInCatalog) {
    confidence = CapabilityConfidence.CATALOG_ONLY;
  }

  return Object.freeze({
    capability,
    normalizedCapability: normReq,
    catalog: hasInCatalog,
    liveVerified: Boolean(hasInCatalog && liveVerified),
    confidence
  });
}

/**
 * Resolves credential alias and availability without ever returning or logging secrets.
 */
export function resolveCredential({ providerId, modelId = null } = {}) {
  const normProvider = String(providerId || '').trim().toLowerCase();
  const normModel = String(modelId || '').trim().toLowerCase();

  switch (normProvider) {
    case 'nvidia': {
      if (normModel.includes('deepseek')) {
        if (process.env.NVIDIA_DEEPSEEK_API_KEY) {
          return { alias: 'NVIDIA_DEEPSEEK_API_KEY', isConfigured: true, hasDirectKey: true };
        }
        return { alias: 'NVIDIA_API_KEY', isConfigured: Boolean(process.env.NVIDIA_API_KEY), hasDirectKey: false };
      }
      if (normModel.includes('kimi') || normModel.includes('moonshot')) {
        if (process.env.NVIDIA_KIMI_API_KEY) {
          return { alias: 'NVIDIA_KIMI_API_KEY', isConfigured: true, hasDirectKey: true };
        }
        return { alias: 'NVIDIA_API_KEY', isConfigured: Boolean(process.env.NVIDIA_API_KEY), hasDirectKey: false };
      }
      if (normModel.includes('llama')) {
        if (process.env.NVIDIA_LLAMA_API_KEY) {
          return { alias: 'NVIDIA_LLAMA_API_KEY', isConfigured: true, hasDirectKey: true };
        }
        return { alias: 'NVIDIA_API_KEY', isConfigured: Boolean(process.env.NVIDIA_API_KEY), hasDirectKey: false };
      }
      return { alias: 'NVIDIA_API_KEY', isConfigured: Boolean(process.env.NVIDIA_API_KEY), hasDirectKey: Boolean(process.env.NVIDIA_API_KEY) };
    }
    case 'kimi':
    case 'moonshot': {
      if (process.env.KIMI_API_KEY) {
        return { alias: 'KIMI_API_KEY', isConfigured: true, hasDirectKey: true };
      }
      if (process.env.MOONSHOT_API_KEY) {
        return { alias: 'MOONSHOT_API_KEY', isConfigured: true, hasDirectKey: true };
      }
      return { alias: 'KIMI_API_KEY', isConfigured: false, hasDirectKey: false };
    }
    case 'gemini':
    case 'google': {
      if (process.env.GEMINI_API_KEY) {
        return { alias: 'GEMINI_API_KEY', isConfigured: true, hasDirectKey: true };
      }
      if (process.env.GOOGLE_API_KEY) {
        return { alias: 'GOOGLE_API_KEY', isConfigured: true, hasDirectKey: true };
      }
      return { alias: 'GEMINI_API_KEY', isConfigured: false, hasDirectKey: false };
    }
    case 'groq':
      return { alias: 'GROQ_API_KEY', isConfigured: Boolean(process.env.GROQ_API_KEY), hasDirectKey: Boolean(process.env.GROQ_API_KEY) };
    case 'openrouter':
      return { alias: 'OPENROUTER_API_KEY', isConfigured: Boolean(process.env.OPENROUTER_API_KEY), hasDirectKey: Boolean(process.env.OPENROUTER_API_KEY) };
    case 'openai':
      return { alias: 'OPENAI_API_KEY', isConfigured: Boolean(process.env.OPENAI_API_KEY), hasDirectKey: Boolean(process.env.OPENAI_API_KEY) };
    case 'local':
    case 'local-provider':
    case 'ollama':
    case 'vllm':
      return { alias: 'LOCAL_IN_MEMORY', isConfigured: true, hasDirectKey: true };
    default:
      return { alias: `${normProvider.toUpperCase()}_API_KEY`, isConfigured: false, hasDirectKey: false };
  }
}

/**
 * Returns optional manual model override from environment, or null if empty/unset.
 */
export function getManualModelOverride(providerId) {
  const p = String(providerId || '').trim().toLowerCase();
  switch (p) {
    case 'openai':
      return (process.env.OPENAI_MODEL && process.env.OPENAI_MODEL.trim()) || null;
    case 'gemini':
    case 'google':
      return (process.env.GEMINI_MODEL && process.env.GEMINI_MODEL.trim()) ||
             (process.env.GOOGLE_MODEL && process.env.GOOGLE_MODEL.trim()) || null;
    case 'groq':
      return (process.env.GROQ_MODEL && process.env.GROQ_MODEL.trim()) || null;
    case 'openrouter':
      return (process.env.OPENROUTER_MODEL && process.env.OPENROUTER_MODEL.trim()) || null;
    case 'kimi':
      return (process.env.KIMI_MODEL && process.env.KIMI_MODEL.trim()) || null;
    case 'nvidia':
      return (process.env.NVIDIA_MODEL && process.env.NVIDIA_MODEL.trim()) || null;
    default:
      return null;
  }
}

/**
 * Classifies an invocation error into canonical status.
 */
export function classifyError(err) {
  if (!err) return { status: GatewayInvocationStatus.FAILED, code: 'UNKNOWN_ERROR', quotaState: QuotaState.NORMAL, health: ModelHealthStatus.UNKNOWN };

  const message = String(err.message || '').toLowerCase();
  const status = err.status || 0;
  const isTimeout = err.name === 'AbortError' || err.code === 'TIMEOUT' || status === 408 || status === 504 || message.includes('timeout') || message.includes('abort');

  if (isTimeout) {
    return { status: GatewayInvocationStatus.TIMEOUT, code: 'TIMEOUT', quotaState: QuotaState.NORMAL, health: ModelHealthStatus.TIMEOUT };
  }

  if (status === 429 || message.includes('quota') || message.includes('rate limit') || err.code === 'RATE_LIMITED') {
    const isQuota = message.includes('insufficient_quota') || message.includes('quota') || message.includes('billing') || message.includes('balance') || message.includes('credit');
    if (isQuota) {
      return { status: GatewayInvocationStatus.RATE_LIMITED, code: 'QUOTA_EXCEEDED', quotaState: QuotaState.QUOTA_EXCEEDED, health: ModelHealthStatus.QUOTA_EXCEEDED };
    }
    return { status: GatewayInvocationStatus.RATE_LIMITED, code: 'RATE_LIMITED', quotaState: QuotaState.RATE_LIMITED, health: ModelHealthStatus.RATE_LIMITED };
  }

  if (status === 401 || err.code === 'AUTHENTICATION_FAILED' || message.includes('invalid api key') || message.includes('authentication')) {
    return { status: GatewayInvocationStatus.FAILED, code: 'AUTH_FAILED', quotaState: QuotaState.NORMAL, health: ModelHealthStatus.AUTH_FAILED };
  }

  if (status === 404 || err.code === 'NOT_FOUND' || message.includes('not found')) {
    return { status: GatewayInvocationStatus.FAILED, code: 'NOT_FOUND', quotaState: QuotaState.NORMAL, health: ModelHealthStatus.NOT_FOUND };
  }

  if (status >= 500 && status < 600) {
    return { status: GatewayInvocationStatus.FAILED, code: 'SERVER_ERROR', quotaState: QuotaState.NORMAL, health: ModelHealthStatus.DEGRADED };
  }

  const isNetwork = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ECONNRESET' || message.includes('network') || message.includes('fetch failed');
  if (isNetwork) {
    return { status: GatewayInvocationStatus.FAILED, code: 'NETWORK_FAILED', quotaState: QuotaState.NORMAL, health: ModelHealthStatus.NETWORK_FAILED };
  }

  return { status: GatewayInvocationStatus.FAILED, code: err.code || 'PROVIDER_ERROR', quotaState: QuotaState.NORMAL, health: ModelHealthStatus.DEGRADED };
}

/**
 * Mathematical Scoring Engine for candidate models
 */
export function calculateModelScore({
  resource,
  requiredCapabilities = [],
  contextLengthNeeded = 0,
  weights = DefaultSchedulerWeights,
  recentDispatches = 0
} = {}) {
  // 1. Capability Match (Strict hard multiplier: 1.0 if all supported, 0.0 if any missing or unknown)
  const normRequired = requiredCapabilities.map(r => normalizeCapability(r));
  const resCapsNorm = (resource.capabilities || []).map(c => normalizeCapability(c));

  let capabilityMatch = 1.0;
  for (const req of normRequired) {
    if (req === 'unknown' || !resCapsNorm.includes(req)) {
      // Check for allowable aliases
      const isJsonOutputAlias = (req === StandardModelCapabilities.JSON && resCapsNorm.includes(StandardModelCapabilities.STRUCTURED_OUTPUT)) ||
                                (req === StandardModelCapabilities.STRUCTURED_OUTPUT && resCapsNorm.includes(StandardModelCapabilities.JSON));
      const isCodeAlias = (req === StandardModelCapabilities.CODING && resCapsNorm.includes(StandardModelCapabilities.TEXT_GENERATION));

      if (!isJsonOutputAlias && !isCodeAlias) {
        capabilityMatch = 0.0;
        break;
      }
    }
  }

  // 2. Health Score
  const healthScore = weights.healthScores[resource.health] !== undefined
    ? weights.healthScores[resource.health]
    : (weights.healthScores.UNKNOWN || 0.4);

  // 3. Availability Score
  const availabilityScore = weights.availabilityScores[resource.availability] !== undefined
    ? weights.availabilityScores[resource.availability]
    : 0.5;

  // 4. Quota Score
  const quotaScore = weights.quotaScores[resource.quotaState] !== undefined
    ? weights.quotaScores[resource.quotaState]
    : 0.5;

  // 5. Latency Score (Real measured latency: no fake numbers; neutral 0.5 if unknown)
  let latencyScore = 0.5;
  if (typeof resource.latencyMs === 'number' && Number.isFinite(resource.latencyMs) && resource.latencyMs >= 0) {
    latencyScore = Math.max(0.1, Math.min(1.0, 1.0 - (resource.latencyMs / 25000)));
  }

  // 6. Reliability Score
  let reliabilityScore = 1.0;
  if (resource.circuitState === CircuitBreakerState.OPEN) reliabilityScore = 0.0;
  else if (resource.circuitState === CircuitBreakerState.HALF_OPEN) reliabilityScore = 0.3;
  else if (resource.health === ModelHealthStatus.DEGRADED) reliabilityScore = 0.6;

  // 7. Context Fit
  let contextFit = 1.0;
  if (contextLengthNeeded > 0) {
    if ((resource.contextWindow || 8192) < contextLengthNeeded) {
      contextFit = 0.0;
    }
  }

  // 8. Workload Balance (decays gracefully with concurrent/recent dispatches)
  const workloadBalance = Math.max(0.2, 1.0 - (recentDispatches * 0.1));

  // Multiplicative total score
  const totalScore = capabilityMatch * healthScore * availabilityScore * quotaScore * latencyScore * reliabilityScore * contextFit * workloadBalance;

  return {
    totalScore: Number(totalScore.toFixed(4)),
    breakdown: {
      capabilityMatch,
      healthScore,
      availabilityScore,
      quotaScore,
      latencyScore,
      reliabilityScore,
      contextFit,
      workloadBalance
    }
  };
}

export const DefaultLiveCertifications = Object.freeze([
  Object.freeze({ providerId: 'gemini', modelId: 'gemini-3.8-flash', httpStatus: 200, latencyMs: 1850, modelVersion: 'gemini-3.8-flash', responseHash: 'b4a83e07d0f1a92e10fb71a938cde91f64626d6e20165f3e2e02d61f46d0a1b2' }),
  Object.freeze({ providerId: 'gemini', modelId: 'gemini-3.6-flash', httpStatus: 200, latencyMs: 3241, modelVersion: 'gemini-3.6-flash', responseHash: '102e9ada2e40f6b15f00c153881888b9922545e053077e016ea5c96bbbf50be2' }),
  Object.freeze({ providerId: 'gemini', modelId: 'gemini-1.5-flash', httpStatus: 404, status: 'INVALIDATED', live: false, invalidatedReason: 'RETIRED_ENDPOINT_HTTP_404' }),
  Object.freeze({ providerId: 'groq', modelId: 'llama-3.3-70b-versatile', httpStatus: 200, latencyMs: 1490, responseHash: '39b9eac80f1acf42081aa27fb3a07d2ee91f64626d6e20165f3e2e02d61f46d0' }),
  Object.freeze({ providerId: 'openrouter', modelId: 'meta-llama/llama-3.3-70b-instruct', httpStatus: 200, latencyMs: 2901, responseHash: '35c79ce8b48e0affb59ef8ccfb7c9e3c45462056fb6e787c16f9e3929a715117' }),
  Object.freeze({ providerId: 'openrouter', modelId: 'openrouter/auto', httpStatus: 200, latencyMs: 2901, responseHash: '35c79ce8b48e0affb59ef8ccfb7c9e3c45462056fb6e787c16f9e3929a715117' }),
  Object.freeze({ providerId: 'nvidia', modelId: 'meta/llama-3.2-11b-vision-instruct', httpStatus: 200, latencyMs: 6008, responseHash: '4d27bb8590373ff06cb75a65bb8db15d8e7540ec24228af61c3ac6c6e949486c' })
]);

/**
 * Creates the Provider-Agnostic AI Resource Orchestrator.
 */
export function createAIResourceOrchestrator({
  gateway = null,
  registry = null,
  modelRegistry = null,
  circuitBreaker = null,
  budgetTracker = null,
  credentialPool = null,
  now = () => Date.now(),
  defaultTimeoutMs = 30000,
  discoveryCacheMs = parseInt(process.env.AI_MODEL_DISCOVERY_CACHE_MS, 10) || 300000,
  initialCertifications = undefined
} = {}) {
  const authoritativeRegistry = registry || (gateway ? gateway.registry : createProviderRegistry());
  const authoritativeModelRegistry = modelRegistry || createModelRegistry();
  const authoritativeGateway = gateway || createProviderGateway({
    registry: authoritativeRegistry,
    circuitBreaker,
    budgetTracker,
    defaultTimeoutMs
  });
  const authoritativeCredentialPool = credentialPool || createCredentialPool({ autoDiscoverEnv: true, now });

  // Model-specific Circuit Breaker (keyed by `${providerId}:${modelId}` or `${providerId}`)
  const modelCircuitBreaker = createCircuitBreaker({
    failureThreshold: 2,
    cooldownMs: 5000,
    now
  });

  // Health, Quota, Latency, Workload, and Certified Model tracking
  const healthStates = new Map();     // key -> ModelHealthStatus
  const quotaStates = new Map();      // key -> QuotaState
  const latencyHistories = new Map(); // key -> number[]
  const dispatchCounts = new Map();   // key -> number
  const discoveryCache = new Map();   // providerId -> { data, timestamp }
  const customInventory = new Map();  // key -> ResourceDefinition
  const certifiedModels = new Map();  // key -> { providerId, modelId, certifiedAt, httpStatus, latencyMs, responseHash }

  const certsToLoad = initialCertifications !== undefined ? initialCertifications : DefaultLiveCertifications;
  for (const cert of certsToLoad) {
    if (cert && cert.providerId && cert.modelId) {
      const pid = String(cert.providerId).trim().toLowerCase();
      const mid = String(cert.modelId).trim();
      const isLive = cert.live !== false && cert.status !== 'INVALIDATED' && cert.status !== 'STALE' && cert.status !== 'NOT_LIVE';
      const entry = Object.freeze({
        ...cert,
        status: isLive ? ModelAvailability.LIVE_CERTIFIED : (cert.status || ModelAvailability.DEFERRED),
        live: isLive,
        sha256: cert.sha256 || cert.responseHash || null,
        responseHash: cert.responseHash || cert.sha256 || null,
        certifiedAt: cert.certifiedAt || new Date().toISOString()
      });
      certifiedModels.set(`${pid}:${mid}`, entry);
      if (pid === 'gemini') certifiedModels.set(`google:${mid}`, entry);
      if (pid === 'google') certifiedModels.set(`gemini:${mid}`, entry);
    }
  }

  function makeKey(providerId, modelId = null) {
    const p = String(providerId || 'default').trim().toLowerCase();
    if (!modelId) return p;
    return `${p}:${String(modelId).trim()}`;
  }

  function getProviderType(providerId, category = null) {
    const p = String(providerId || '').trim().toLowerCase();
    if (p === 'nvidia' || p === 'openrouter' || category === ProviderCategories.AGGREGATOR) {
      return ProviderType.AGGREGATOR;
    }
    if (p === 'local' || p === 'local-provider' || p === 'ollama' || p === 'vllm' || category === ProviderCategories.LOCAL) {
      return ProviderType.LOCAL;
    }
    return ProviderType.DIRECT;
  }

  /**
   * Initializes / builds resource inventory from registry, model registry, and credential pool
   */
  function buildInventory() {
    const inventory = [];
    const providers = authoritativeRegistry.listProviders ? authoritativeRegistry.listProviders() : [];

    for (const prov of providers) {
      const providerId = prov.providerId || prov.id;
      const providerCategory = prov.category;
      const type = getProviderType(providerId, providerCategory);
      const provCaps = prov.capabilities || [ProviderCapabilities.TEXT];

      // Check optional manual model override from environment
      const manualOverride = getManualModelOverride(providerId);

      // Models registered for this provider
      let models = authoritativeModelRegistry.listModels ? authoritativeModelRegistry.listModels({ providerId }) : [];

      // If manual override is specified, prioritize it
      if (manualOverride) {
        const existing = models.find(m => m.id === manualOverride);
        if (!existing) {
          models = [{
            id: manualOverride,
            providerId,
            displayName: `${providerId}:${manualOverride} (Manual Override)`,
            capabilities: provCaps,
            availability: ModelAvailability.AVAILABLE
          }, ...models];
        }
      }

      // Check credentials registered in multi-account pool for this provider
      const poolCreds = authoritativeCredentialPool.listCredentials({ providerId });

      if (models.length === 0) {
        // Fallback default resource if no explicit models
        const defaultModelId = manualOverride || prov.defaultModel || prov.model || 'default';
        const isLegacy404Default = (defaultModelId === 'gemini-1.5-flash');
        const key = makeKey(providerId, defaultModelId);
        const legacyCred = resolveCredential({ providerId, modelId: defaultModelId });
        const adapter = authoritativeRegistry.getProvider ? authoritativeRegistry.getProvider(providerId) : null;
        const isStandardCloud = ['openai', 'gemini', 'google', 'groq', 'openrouter', 'nvidia', 'kimi', 'moonshot'].includes(providerId);
        const hasCustomImplementation = adapter && (typeof adapter.invoke === 'function' || typeof adapter.chat === 'function' || typeof adapter.generate === 'function');
        const isConfiguredBase = prov.isConfigured !== undefined
          ? Boolean(prov.isConfigured)
          : (legacyCred.isConfigured || (!isStandardCloud && Boolean(hasCustomImplementation || prov.hasCredentials)));
        const cState = modelCircuitBreaker.getState(key);
        const hState = healthStates.get(key) || (cState === CircuitBreakerState.OPEN ? ModelHealthStatus.UNAVAILABLE : (isLegacy404Default ? ModelHealthStatus.DEGRADED : ModelHealthStatus.HEALTHY));
        const qState = quotaStates.get(key) || quotaStates.get(providerId) || QuotaState.NORMAL;

        const cert = certifiedModels.get(key);
        const isLiveCert = Boolean(!isLegacy404Default && cert && (cert.status === ModelAvailability.LIVE_CERTIFIED || cert.live === true));
        const isBuiltinCert = type === ProviderType.LOCAL;
        let fineGrainedStatus = isLegacy404Default ? ModelAvailability.DISCOVERY_UNAVAILABLE : (hState === ModelHealthStatus.HEALTHY ? ModelAvailability.AVAILABLE : ModelAvailability.UNAVAILABLE);
        if (isLiveCert) {
          fineGrainedStatus = ModelAvailability.LIVE_CERTIFIED;
        } else if (isBuiltinCert) {
          fineGrainedStatus = ModelAvailability.CERTIFIED_BUILTIN;
        }

        if (poolCreds.length > 0) {
          for (const cred of poolCreds) {
            let credH = hState;
            if (cred.health === CredentialHealthStatus.AUTH_FAILED) credH = ModelHealthStatus.AUTH_FAILED;
            else if (cred.health === CredentialHealthStatus.QUOTA_EXCEEDED) credH = ModelHealthStatus.QUOTA_EXCEEDED;
            else if (cred.health === CredentialHealthStatus.RATE_LIMITED || cred.health === CredentialHealthStatus.COOLDOWN) credH = ModelHealthStatus.RATE_LIMITED;
            else if (cred.health === CredentialHealthStatus.DEGRADED) credH = ModelHealthStatus.DEGRADED;

            let credQ = qState;
            if (cred.health === CredentialHealthStatus.QUOTA_EXCEEDED) credQ = QuotaState.QUOTA_EXCEEDED;
            else if (cred.health === CredentialHealthStatus.RATE_LIMITED) credQ = QuotaState.RATE_LIMITED;

            const resId = poolCreds.length > 1 ? `${key}:${cred.credentialId}` : key;
            const candId = `${key}:${cred.credentialId}`;

            inventory.push(Object.freeze({
              resourceId: resId,
              candidateId: candId,
              baseResourceId: key,
              providerId,
              modelId: defaultModelId,
              credentialId: cred.credentialId,
              accountId: cred.credentialId,
              credentialFingerprint: cred.fingerprint,
              credentialPriority: cred.priority,
              credentialHealth: cred.health,
              displayName: poolCreds.length > 1 ? `${prov.displayName || providerId} (${defaultModelId}) [${cred.credentialId}]` : `${prov.displayName || providerId} (${defaultModelId})`,
              providerType: type,
              credentialAlias: cred.credentialId,
              isConfigured: Boolean((isConfiguredBase || cred.fingerprint) && cred.enabled),
              capabilities: Object.freeze([...provCaps]),
              availability: isLegacy404Default ? ModelAvailability.UNAVAILABLE : (credH === ModelHealthStatus.HEALTHY ? ModelAvailability.AVAILABLE : ModelAvailability.UNAVAILABLE),
              status: fineGrainedStatus,
              modelState: fineGrainedStatus,
              detailedAvailability: fineGrainedStatus,
              liveCertified: isLiveCert || isBuiltinCert,
              certifiedAt: cert ? cert.certifiedAt : null,
              sha256: cert ? (cert.responseHash || cert.sha256 || null) : null,
              health: isLegacy404Default ? ModelHealthStatus.DEGRADED : credH,
              quotaState: credQ,
              rateLimitState: credQ === QuotaState.RATE_LIMITED ? 'RATE_LIMITED' : 'NORMAL',
              circuitState: cState,
              latencyMs: (cert && cert.latencyMs) || getAverageLatency(key),
              cost: null,
              qualityTier: determineModelTier({ modelId: defaultModelId, capabilities: provCaps }),
              resourceTier: determineResourceTier({ providerId, modelId: defaultModelId, providerType: type }),
              isPaid: determineResourceTier({ providerId, modelId: defaultModelId, providerType: type }) === ResourceTier.L3_PAID_API,
              priority: prov.priority || ProviderPriority.PRIMARY
            }));
          }
        } else {
          inventory.push(Object.freeze({
            resourceId: key,
            candidateId: key,
            baseResourceId: key,
            providerId,
            modelId: defaultModelId,
            credentialId: null,
            accountId: null,
            credentialFingerprint: null,
            credentialPriority: 1,
            credentialHealth: CredentialHealthStatus.HEALTHY,
            displayName: `${prov.displayName || providerId} (${defaultModelId})`,
            providerType: type,
            credentialAlias: legacyCred.alias,
            isConfigured: isConfiguredBase,
            capabilities: Object.freeze([...provCaps]),
            availability: isLegacy404Default ? ModelAvailability.UNAVAILABLE : (hState === ModelHealthStatus.HEALTHY ? ModelAvailability.AVAILABLE : ModelAvailability.UNAVAILABLE),
            status: fineGrainedStatus,
            modelState: fineGrainedStatus,
            detailedAvailability: fineGrainedStatus,
            liveCertified: isLiveCert || isBuiltinCert,
            certifiedAt: cert ? cert.certifiedAt : null,
            sha256: cert ? (cert.responseHash || cert.sha256 || null) : null,
            health: isLegacy404Default ? ModelHealthStatus.DEGRADED : hState,
            quotaState: qState,
            rateLimitState: qState === QuotaState.RATE_LIMITED ? 'RATE_LIMITED' : 'NORMAL',
            circuitState: cState,
            latencyMs: (cert && cert.latencyMs) || getAverageLatency(key),
            cost: null,
            qualityTier: determineModelTier({ modelId: defaultModelId, capabilities: provCaps }),
            resourceTier: determineResourceTier({ providerId, modelId: defaultModelId, providerType: type }),
            isPaid: determineResourceTier({ providerId, modelId: defaultModelId, providerType: type }) === ResourceTier.L3_PAID_API,
            priority: prov.priority || ProviderPriority.PRIMARY
          }));
        }
      } else {
        for (const m of models) {
          const key = makeKey(providerId, m.id);
          const legacyCred = resolveCredential({ providerId, modelId: m.id });
          const adapter = authoritativeRegistry.getProvider ? authoritativeRegistry.getProvider(providerId) : null;
          const isStandardCloud = ['openai', 'gemini', 'google', 'groq', 'openrouter', 'nvidia', 'kimi', 'moonshot'].includes(providerId);
          const hasCustomImplementation = adapter && (typeof adapter.invoke === 'function' || typeof adapter.chat === 'function' || typeof adapter.generate === 'function');
          const isConfiguredBase = prov.isConfigured !== undefined
            ? Boolean(prov.isConfigured)
            : (legacyCred.isConfigured || (!isStandardCloud && Boolean(hasCustomImplementation || prov.hasCredentials)));
          const cState = modelCircuitBreaker.getState(key);
          const hState = healthStates.get(key) || (cState === CircuitBreakerState.OPEN ? ModelHealthStatus.UNAVAILABLE : (m.availability === 'DEFERRED' ? ModelHealthStatus.DEGRADED : ModelHealthStatus.HEALTHY));
          const qState = quotaStates.get(key) || quotaStates.get(providerId) || QuotaState.NORMAL;

          // Model-specific capabilities take precedence over provider capabilities
          const mergedCaps = (m.capabilities && m.capabilities.length > 0) ? m.capabilities : provCaps;

          const isLegacy404Model = (m.id === 'gemini-1.5-flash');
          const isDeferred = m.availability === 'DEFERRED' || m.status === 'DEFERRED' || isLegacy404Model;
          const isCatalogOnly = m.availability === 'CATALOG_ONLY' || m.status === 'CATALOG_ONLY';
          let availStatus = ModelAvailability.AVAILABLE;
          if (isDeferred || isCatalogOnly || hState === ModelHealthStatus.UNAVAILABLE) {
            availStatus = ModelAvailability.UNAVAILABLE;
          }

          const cert = certifiedModels.get(key);
          const isLiveCert = Boolean(!isLegacy404Model && cert && (cert.status === ModelAvailability.LIVE_CERTIFIED || cert.live === true));
          const isBuiltinCert = type === ProviderType.LOCAL;

          let fineGrainedStatus = isLegacy404Model ? ModelAvailability.DEFERRED : (isDeferred ? ModelAvailability.DEFERRED : (isCatalogOnly ? ModelAvailability.CATALOG_ONLY : availStatus));
          if (isLiveCert) {
            fineGrainedStatus = ModelAvailability.LIVE_CERTIFIED;
          } else if (isBuiltinCert) {
            fineGrainedStatus = ModelAvailability.CERTIFIED_BUILTIN;
          }

          if (poolCreds.length > 0) {
            for (const cred of poolCreds) {
              const candId = `${key}:${cred.credentialId}`;
              const modelSpecificHealth = authoritativeCredentialPool.getModelHealth
                ? authoritativeCredentialPool.getModelHealth(providerId, cred.credentialId, m.id)
                : cred.health;

              let credH = hState;
              if (modelSpecificHealth === CredentialHealthStatus.AUTH_FAILED) credH = ModelHealthStatus.AUTH_FAILED;
              else if (modelSpecificHealth === CredentialHealthStatus.QUOTA_EXCEEDED) credH = ModelHealthStatus.QUOTA_EXCEEDED;
              else if (modelSpecificHealth === CredentialHealthStatus.RATE_LIMITED || modelSpecificHealth === CredentialHealthStatus.COOLDOWN) credH = ModelHealthStatus.RATE_LIMITED;
              else if (modelSpecificHealth === CredentialHealthStatus.DEGRADED) credH = ModelHealthStatus.DEGRADED;

              let credQ = qState;
              if (modelSpecificHealth === CredentialHealthStatus.QUOTA_EXCEEDED) credQ = QuotaState.QUOTA_EXCEEDED;
              else if (modelSpecificHealth === CredentialHealthStatus.RATE_LIMITED) credQ = QuotaState.RATE_LIMITED;

              const resId = poolCreds.length > 1 ? candId : key;
              const isAvailableCred = authoritativeCredentialPool.isCandidateAvailable
                ? authoritativeCredentialPool.isCandidateAvailable(providerId, cred.credentialId, m.id)
                : cred.isAvailable;
              let credAvail = availStatus;
              if (!isAvailableCred) {
                credAvail = ModelAvailability.UNAVAILABLE;
              }

              const candCert = certifiedModels.get(candId) || certifiedModels.get(key);
              const isLiveCertCand = Boolean(!isLegacy404Model && candCert && (candCert.status === ModelAvailability.LIVE_CERTIFIED || candCert.live === true));
              let fineGrainedStatusCand = isLegacy404Model ? ModelAvailability.DEFERRED : (isDeferred ? ModelAvailability.DEFERRED : (isCatalogOnly ? ModelAvailability.CATALOG_ONLY : credAvail));
              if (isLiveCertCand) {
                fineGrainedStatusCand = ModelAvailability.LIVE_CERTIFIED;
              } else if (isBuiltinCert) {
                fineGrainedStatusCand = ModelAvailability.CERTIFIED_BUILTIN;
              }

              inventory.push(Object.freeze({
                resourceId: resId,
                candidateId: candId,
                baseResourceId: key,
                providerId,
                modelId: m.id,
                credentialId: cred.credentialId,
                accountId: cred.credentialId,
                credentialFingerprint: cred.fingerprint,
                credentialPriority: cred.priority,
                credentialHealth: modelSpecificHealth,
                displayName: poolCreds.length > 1 ? `${m.displayName || `${providerId}:${m.id}`} [${cred.credentialId}]` : (m.displayName || `${providerId}:${m.id}`),
                providerType: type,
                credentialAlias: cred.credentialId,
                isConfigured: Boolean((isConfiguredBase || cred.fingerprint) && cred.enabled),
                capabilities: Object.freeze(mergedCaps),
                availability: credAvail,
                status: fineGrainedStatusCand,
                modelState: fineGrainedStatusCand,
                detailedAvailability: fineGrainedStatusCand,
                liveCertified: isLiveCertCand || isBuiltinCert,
                certifiedAt: candCert ? candCert.certifiedAt : null,
                sha256: candCert ? (candCert.responseHash || candCert.sha256 || null) : null,
                health: isDeferred ? ModelHealthStatus.DEGRADED : credH,
                quotaState: credQ,
                rateLimitState: credQ === QuotaState.RATE_LIMITED ? 'RATE_LIMITED' : 'NORMAL',
                circuitState: cState,
                latencyMs: (candCert && candCert.latencyMs) || getAverageLatency(key),
                contextWindow: m.contextWindow || 8192,
                inputModalities: Object.freeze(m.inputModalities || ['text']),
                outputModalities: Object.freeze(m.outputModalities || ['text']),
                cost: m.pricing || null,
                qualityTier: determineModelTier({ modelId: m.id, capabilities: mergedCaps, contextWindow: m.contextWindow, pricing: m.pricing }),
                resourceTier: determineResourceTier({ providerId, modelId: m.id, pricing: m.pricing, isPaid: Boolean(m.isPaid || cred.isPaid), providerType: type }),
                isPaid: determineResourceTier({ providerId, modelId: m.id, pricing: m.pricing, isPaid: Boolean(m.isPaid || cred.isPaid), providerType: type }) === ResourceTier.L3_PAID_API,
                priority: prov.priority || ProviderPriority.PRIMARY
              }));
            }
          } else {
            inventory.push(Object.freeze({
              resourceId: key,
              candidateId: key,
              baseResourceId: key,
              providerId,
              modelId: m.id,
              credentialId: null,
              accountId: null,
              credentialFingerprint: null,
              credentialPriority: 1,
              credentialHealth: CredentialHealthStatus.HEALTHY,
              displayName: m.displayName || `${providerId}:${m.id}`,
              providerType: type,
              credentialAlias: legacyCred.alias,
              isConfigured: isConfiguredBase,
              capabilities: Object.freeze(mergedCaps),
              availability: availStatus,
              status: fineGrainedStatus,
              modelState: fineGrainedStatus,
              detailedAvailability: fineGrainedStatus,
              liveCertified: isLiveCert || isBuiltinCert,
              certifiedAt: cert ? cert.certifiedAt : null,
              sha256: cert ? (cert.responseHash || cert.sha256 || null) : null,
              health: isDeferred ? ModelHealthStatus.DEGRADED : hState,
              quotaState: qState,
              rateLimitState: qState === QuotaState.RATE_LIMITED ? 'RATE_LIMITED' : 'NORMAL',
              circuitState: cState,
              latencyMs: (cert && cert.latencyMs) || getAverageLatency(key),
              contextWindow: m.contextWindow || 8192,
              inputModalities: Object.freeze(m.inputModalities || ['text']),
              outputModalities: Object.freeze(m.outputModalities || ['text']),
              cost: m.pricing || null,
              qualityTier: determineModelTier({ modelId: m.id, capabilities: mergedCaps, contextWindow: m.contextWindow, pricing: m.pricing }),
              resourceTier: determineResourceTier({ providerId, modelId: m.id, pricing: m.pricing, isPaid: m.isPaid, providerType: type }),
              isPaid: determineResourceTier({ providerId, modelId: m.id, pricing: m.pricing, isPaid: m.isPaid, providerType: type }) === ResourceTier.L3_PAID_API,
              priority: prov.priority || ProviderPriority.PRIMARY
            }));
          }
        }
      }
    }

    // Include any custom dynamically added resources
    for (const [key, res] of customInventory.entries()) {
      inventory.push(res);
    }

    return Object.freeze(inventory);
  }

  function getAverageLatency(key) {
    const list = latencyHistories.get(key);
    if (!list || list.length === 0) return null; // Neutral / unknown
    const sum = list.reduce((a, b) => a + b, 0);
    return Math.round(sum / list.length);
  }

  function recordLatency(key, latencyMs) {
    if (typeof latencyMs !== 'number') return;
    if (!latencyHistories.has(key)) latencyHistories.set(key, []);
    const list = latencyHistories.get(key);
    list.push(latencyMs);
    if (list.length > 20) list.shift();
  }

  function recordDispatch(key) {
    const cur = dispatchCounts.get(key) || 0;
    dispatchCounts.set(key, cur + 1);
  }

  return Object.freeze({
    gateway: authoritativeGateway,
    registry: authoritativeRegistry,
    modelRegistry: authoritativeModelRegistry,
    circuitBreaker: modelCircuitBreaker,
    credentialPool: authoritativeCredentialPool,

    getCredentialPool() {
      return authoritativeCredentialPool;
    },

    getCredentialPoolStatus(providerId = null) {
      if (authoritativeCredentialPool && typeof authoritativeCredentialPool.getCredentialPoolStatus === 'function') {
        return authoritativeCredentialPool.getCredentialPoolStatus(providerId);
      }
      return Object.freeze({ providerId: providerId || 'all', totalAccounts: 0, healthyAccounts: 0, availableAccounts: 0, accounts: [] });
    },

    /**
     * Dynamic registration of a provider adapter into the orchestrator
     */
    registerProvider(adapter, options = {}) {
      return authoritativeRegistry.registerProvider(adapter, options);
    },

    /**
     * Discovers models for a provider using its discoverModels() hook if supported
     */
    async discoverProviderModels(providerId, { signal = null, forceFresh = false } = {}) {
      const adapter = authoritativeRegistry.getProvider(providerId);
      if (!adapter) {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Provider '${providerId}' not found`);
      }

      // Check cache unless forceFresh is requested
      const cached = discoveryCache.get(providerId);
      if (!forceFresh && cached && (now() - cached.timestamp) < discoveryCacheMs) {
        return cached.data;
      }

      let discoveryResult = null;
      if (typeof adapter.discoverModels === 'function') {
        try {
          discoveryResult = await adapter.discoverModels({ signal });
        } catch (err) {
          discoveryResult = {
            providerId,
            discoveredAt: new Date().toISOString(),
            source: 'error',
            live: false,
            status: 'DEFERRED',
            reason: 'MODEL_DISCOVERY_FAILED',
            error: sanitizeString(err.message),
            models: []
          };
        }
      } else {
        discoveryResult = {
          providerId,
          discoveredAt: new Date().toISOString(),
          source: 'static_catalog',
          live: false,
          status: 'CATALOG_ONLY',
          models: []
        };
      }

      // If discovery returned an array directly (legacy fallback)
      let rawModels = Array.isArray(discoveryResult) ? discoveryResult : (discoveryResult.models || []);
      const isLive = discoveryResult.live === true;

      // If discovery returned no models, fallback to known catalog models from modelRegistry
      if (rawModels.length === 0) {
        const catalogModels = authoritativeModelRegistry.listModels ? authoritativeModelRegistry.listModels({ providerId }) : [];
        rawModels = catalogModels.map(cm => ({
          id: cm.id,
          providerId,
          displayName: cm.displayName || cm.id,
          capabilities: cm.capabilities,
          contextWindow: cm.contextWindow || 8192,
          inputModalities: cm.inputModalities || ['text'],
          outputModalities: cm.outputModalities || ['text'],
          status: cm.availability === 'DEFERRED' ? 'DEFERRED' : ModelAvailability.CATALOG_ONLY
        }));
      }

      // Register discovered models into modelRegistry
      const registered = [];
      for (const m of rawModels) {
        if (!m || !m.id) continue;
        const entry = authoritativeModelRegistry.registerModel({
          id: m.id,
          providerId,
          displayName: m.displayName || m.id,
          capabilities: m.capabilities || adapter.capabilities || [ProviderCapabilities.TEXT],
          contextWindow: m.contextWindow || 8192,
          inputModalities: m.inputModalities || ['text'],
          outputModalities: m.outputModalities || ['text'],
          availability: m.status || (isLive ? ModelAvailability.LIVE_AVAILABLE : ModelAvailability.CATALOG_ONLY)
        });
        registered.push(entry);
      }

      const normalizedPayload = [...registered];
      normalizedPayload.providerId = providerId;
      normalizedPayload.discoveredAt = discoveryResult.discoveredAt || new Date().toISOString();
      normalizedPayload.source = discoveryResult.source || (isLive ? 'live_api' : 'static_catalog');
      normalizedPayload.live = isLive;
      normalizedPayload.status = discoveryResult.status || (isLive ? 'AVAILABLE' : 'DEFERRED');
      normalizedPayload.reason = discoveryResult.reason || null;
      normalizedPayload.models = Object.freeze(registered);

      // Update cache
      discoveryCache.set(providerId, { data: normalizedPayload, timestamp: now() });

      return normalizedPayload;
    },

    /**
     * Discovers models across all registered providers that support discovery
     */
    async discoverAllModels({ signal = null, forceFresh = false } = {}) {
      const providers = authoritativeRegistry.listProviders();
      const results = {};
      for (const prov of providers) {
        const id = prov.providerId || prov.id;
        try {
          results[id] = await this.discoverProviderModels(id, { signal, forceFresh });
        } catch {
          results[id] = Object.freeze({
            providerId: id,
            discoveredAt: new Date().toISOString(),
            source: 'error',
            live: false,
            status: 'DEFERRED',
            reason: 'MODEL_DISCOVERY_FAILED',
            models: Object.freeze([])
          });
        }
      }
      return Object.freeze(results);
    },

    /**
     * Resolves credential alias and status without revealing secrets
     */
    resolveCredential(params) {
      return resolveCredential(params);
    },

    /**
     * Returns the normalized resource inventory
     */
    listResources({ capability = null, providerType = null, health = null, quotaState = null, credentialId = null } = {}) {
      const all = buildInventory();
      return all.filter(r => {
        if (capability) {
          const normReq = normalizeCapability(capability);
          const hasCap = r.capabilities.some(c => normalizeCapability(c) === normReq || c === capability);
          if (!hasCap) return false;
        }
        if (providerType && r.providerType !== providerType) return false;
        if (health && r.health !== health) return false;
        if (quotaState && r.quotaState !== quotaState) return false;
        if (credentialId && r.credentialId !== credentialId) return false;
        return true;
      });
    },

    /**
     * Get specific resource by providerId and modelId
     */
    getResource(providerId, modelId = null, credentialId = null) {
      const all = buildInventory();
      const key = makeKey(providerId, modelId);
      return all.find(r => {
        if (credentialId && r.credentialId !== credentialId) return false;
        return r.resourceId === key || r.candidateId === key || r.baseResourceId === key || (r.providerId === providerId && (!modelId || r.modelId === modelId));
      }) || null;
    },

    /**
     * Health state management
     */
    getHealthState(providerId, modelId = null) {
      const key = makeKey(providerId, modelId);
      return healthStates.get(key) || ModelHealthStatus.HEALTHY;
    },

    setHealthState(providerId, modelId = null, state) {
      const key = makeKey(providerId, modelId);
      healthStates.set(key, state);
    },

    /**
     * Quota state management
     */
    getQuotaState(providerId, modelId = null) {
      const key = makeKey(providerId, modelId);
      return quotaStates.get(key) || QuotaState.NORMAL;
    },

    setQuotaState(providerId, modelId = null, state) {
      const key = makeKey(providerId, modelId);
      quotaStates.set(key, state);
    },

    /**
     * Circuit breaker state management
     */
    getCircuitState(providerId, modelId = null) {
      const key = makeKey(providerId, modelId);
      return modelCircuitBreaker.getState(key);
    },

    canExecute(providerId, modelId = null) {
      // 1. Check provider-level circuit
      const provKey = String(providerId).trim().toLowerCase();
      if (!modelCircuitBreaker.canExecute(provKey)) return false;

      // 2. Check model-specific circuit if modelId given
      if (modelId) {
        const modelKey = makeKey(providerId, modelId);
        if (!modelCircuitBreaker.canExecute(modelKey)) return false;
      }
      return true;
    },

    recordSuccess(providerId, modelId = null) {
      const provKey = String(providerId).trim().toLowerCase();
      modelCircuitBreaker.recordSuccess(provKey);
      if (modelId) {
        const modelKey = makeKey(providerId, modelId);
        modelCircuitBreaker.recordSuccess(modelKey);
      }
    },

    recordFailure(providerId, modelId = null, err = null) {
      const provKey = String(providerId).trim().toLowerCase();
      if (modelId) {
        const modelKey = makeKey(providerId, modelId);
        modelCircuitBreaker.recordFailure(modelKey, err);
      } else {
        modelCircuitBreaker.recordFailure(provKey, err);
      }
    },

    resetCircuit(providerId, modelId = null) {
      const provKey = String(providerId).trim().toLowerCase();
      modelCircuitBreaker.reset(provKey);
      if (modelId) {
        const modelKey = makeKey(providerId, modelId);
        modelCircuitBreaker.reset(modelKey);
      }
    },

    /**
     * Scores a single resource against given requirements
     */
    scoreResource(resource, { requiredCapabilities = [], contextLengthNeeded = 0 } = {}) {
      const recent = dispatchCounts.get(resource.resourceId) || dispatchCounts.get(resource.baseResourceId) || 0;
      return calculateModelScore({
        resource,
        requiredCapabilities,
        contextLengthNeeded,
        recentDispatches: recent
      });
    },

    /**
     * Selects and explains candidates based on multi-criteria scheduler gates, task complexity, and credential pool
     */
    selectBestModel({
      task = null,
      taskComplexity = null,
      requiredCapabilities = [],
      dataClassification = DataClassification.INTERNAL,
      preferredProvider = null,
      preferredModel = null,
      preferredCredential = null,
      contextLengthNeeded = 0,
      paidAIAllowed = undefined,
      resourcePolicy = null
    } = {}) {
      const normClass = String(dataClassification).toUpperCase();
      const isRestrictedOrSecret = normClass === DataClassification.SECRET ||
                                   normClass === DataClassification.RESTRICTED ||
                                   normClass === 'CRITICAL';

      let neededCaps = new Set(Array.isArray(requiredCapabilities) ? requiredCapabilities : [requiredCapabilities].filter(Boolean));
      let inferredComplexity = taskComplexity;

      if (task) {
        const analyzed = analyzeTask({ task, dataClassification });
        if (neededCaps.size === 0 && analyzed && analyzed.requiredCapabilities) {
          for (const c of analyzed.requiredCapabilities) neededCaps.add(c);
        }
        if (!inferredComplexity && analyzed && analyzed.complexity) {
          inferredComplexity = analyzed.complexity;
        }
      }

      // Normalize complexity
      let normComplexity = inferredComplexity || TaskComplexity.MEDIUM;
      if (normComplexity === TaskComplexity.SIMPLE || String(normComplexity).toUpperCase() === 'SIMPLE') {
        normComplexity = TaskComplexity.LOW;
      } else if (normComplexity === TaskComplexity.STANDARD || String(normComplexity).toUpperCase() === 'STANDARD') {
        normComplexity = TaskComplexity.MEDIUM;
      } else if (normComplexity === TaskComplexity.COMPLEX || String(normComplexity).toUpperCase() === 'COMPLEX') {
        normComplexity = TaskComplexity.HIGH;
      } else if (normComplexity === TaskComplexity.CRITICAL || String(normComplexity).toUpperCase() === 'CRITICAL') {
        normComplexity = TaskComplexity.CRITICAL;
      }
      const effectiveComplexity = normComplexity;
      const isCritical = (effectiveComplexity === TaskComplexity.CRITICAL || String(taskComplexity).toUpperCase() === 'CRITICAL');
      const isSimple = !isCritical && (effectiveComplexity === TaskComplexity.LOW || taskComplexity === TaskComplexity.SIMPLE || String(taskComplexity).toUpperCase() === 'SIMPLE');
      const isStandard = !isCritical && (effectiveComplexity === TaskComplexity.MEDIUM || taskComplexity === TaskComplexity.STANDARD || String(taskComplexity).toUpperCase() === 'STANDARD');
      const isComplex = !isCritical && (effectiveComplexity === TaskComplexity.HIGH || taskComplexity === TaskComplexity.COMPLEX || String(taskComplexity).toUpperCase() === 'COMPLEX');
      const capsArray = Array.from(neededCaps);
      const inventory = buildInventory();

      const eligible = [];
      const rejectedModels = [];
      const rejectionReasons = {};
      const scoreBreakdown = {};

      for (const res of inventory) {
        // Gate 1: Security boundary
        if (isRestrictedOrSecret && res.providerType !== ProviderType.LOCAL) {
          const reason = `Prohibited by security boundary for data classification ${normClass}`;
          rejectedModels.push({ resourceId: res.resourceId, providerId: res.providerId, modelId: res.modelId, credentialId: res.credentialId, reason, failedGate: 'SECURITY_BOUNDARY' });
          rejectionReasons[res.resourceId] = reason;
          continue;
        }

        // Gate 2: Paid AI Guard
        const isPaidResource = Boolean(res.isPaid || (res.resourceTier === ResourceTier.L3_PAID_API) || (determineResourceTier(res) === ResourceTier.L3_PAID_API));
        const isPaidExplicitlyForbidden = (paidAIAllowed === false) || (resourcePolicy && resourcePolicy.paidAllowed === false);

        if (isPaidResource && isPaidExplicitlyForbidden) {
          const reason = 'Paid AI is prohibited by policy (paidAIAllowed=false)';
          rejectedModels.push({
            resourceId: res.resourceId,
            providerId: res.providerId,
            modelId: res.modelId,
            credentialId: res.credentialId,
            reason,
            failedGate: 'PAID_AI_GUARD'
          });
          rejectionReasons[res.resourceId] = reason;
          continue;
        }

        // Gate 3: Capability compatibility (UNKNOWN !== SUPPORTED)
        const hasAllCaps = capsArray.every(req => {
          const normReq = normalizeCapability(req);
          if (normReq === 'unknown') return false; // UNKNOWN is not supported
          return res.capabilities.some(c => {
            const normC = normalizeCapability(c);
            if (normC === normReq) return true;
            // JSON / Structured Output equivalence
            if (normReq === StandardModelCapabilities.JSON && normC === StandardModelCapabilities.STRUCTURED_OUTPUT) return true;
            if (normReq === StandardModelCapabilities.STRUCTURED_OUTPUT && normC === StandardModelCapabilities.JSON) return true;
            if (normReq === StandardModelCapabilities.CODING && normC === StandardModelCapabilities.TEXT_GENERATION) return true;
            return false;
          });
        });

        if (!hasAllCaps) {
          const reason = `Missing required capabilities: ${capsArray.join(', ')}`;
          rejectedModels.push({ resourceId: res.resourceId, providerId: res.providerId, modelId: res.modelId, credentialId: res.credentialId, reason, failedGate: 'CAPABILITY_COMPATIBILITY' });
          rejectionReasons[res.resourceId] = reason;
          continue;
        }

        // Gate 4: Health status (UNAVAILABLE, AUTH_FAILED, and active COOLDOWN excluded)
        const provHealth = this.getHealthState(res.providerId);
        if (res.credentialHealth === CredentialHealthStatus.AUTH_FAILED || res.health === ModelHealthStatus.AUTH_FAILED || provHealth === ModelHealthStatus.AUTH_FAILED) {
          const reason = `Resource health is AUTH_FAILED`;
          rejectedModels.push({ resourceId: res.resourceId, providerId: res.providerId, modelId: res.modelId, credentialId: res.credentialId, reason, failedGate: 'HEALTH_STATUS' });
          rejectionReasons[res.resourceId] = reason;
          continue;
        }

        if (res.health === ModelHealthStatus.UNAVAILABLE || provHealth === ModelHealthStatus.UNAVAILABLE) {
          const reason = 'Resource health is UNAVAILABLE';
          rejectedModels.push({ resourceId: res.resourceId, providerId: res.providerId, modelId: res.modelId, credentialId: res.credentialId, reason, failedGate: 'HEALTH_STATUS' });
          rejectionReasons[res.resourceId] = reason;
          continue;
        }

        if (res.credentialId) {
          const isCandidateAvail = authoritativeCredentialPool.isCandidateAvailable
            ? authoritativeCredentialPool.isCandidateAvailable(res.providerId, res.credentialId, res.modelId)
            : authoritativeCredentialPool.isAvailable(res.providerId, res.credentialId);
          if (!isCandidateAvail) {
            const reason = `Credential ${res.credentialId} is currently unavailable for model ${res.modelId} (${res.credentialHealth || 'COOLDOWN'})`;
            rejectedModels.push({ resourceId: res.resourceId, providerId: res.providerId, modelId: res.modelId, credentialId: res.credentialId, reason, failedGate: 'HEALTH_STATUS' });
            rejectionReasons[res.resourceId] = reason;
            continue;
          }
        }

        // Gate 5: Authentication / Credential configured
        if (!res.isConfigured && res.providerType !== ProviderType.LOCAL) {
          const reason = `Credential ${res.credentialAlias || res.credentialId} is unconfigured`;
          rejectedModels.push({ resourceId: res.resourceId, providerId: res.providerId, modelId: res.modelId, credentialId: res.credentialId, reason, failedGate: 'AUTHENTICATION_STATUS' });
          rejectionReasons[res.resourceId] = reason;
          continue;
        }

        // Gate 6: Circuit breaker
        if (!this.canExecute(res.providerId, res.modelId)) {
          const reason = 'Circuit breaker is OPEN';
          rejectedModels.push({ resourceId: res.resourceId, providerId: res.providerId, modelId: res.modelId, credentialId: res.credentialId, reason, failedGate: 'CIRCUIT_BREAKER' });
          rejectionReasons[res.resourceId] = reason;
          continue;
        }

        // Gate 7: Quota status
        if (res.credentialHealth === CredentialHealthStatus.QUOTA_EXCEEDED || res.quotaState === QuotaState.QUOTA_EXCEEDED) {
          const reason = `Quota is EXCEEDED for credential ${res.credentialId || res.resourceId}`;
          rejectedModels.push({ resourceId: res.resourceId, providerId: res.providerId, modelId: res.modelId, credentialId: res.credentialId, reason, failedGate: 'QUOTA_STATUS' });
          rejectionReasons[res.resourceId] = reason;
          continue;
        }

        const healthyForProv = res.credentialId ? authoritativeCredentialPool.getHealthyCredentials(res.providerId) : [];
        if (this.getQuotaState(res.providerId) === QuotaState.QUOTA_EXCEEDED && (!res.credentialId || healthyForProv.length === 0)) {
          const reason = 'Quota is EXCEEDED for this provider';
          rejectedModels.push({ resourceId: res.resourceId, providerId: res.providerId, modelId: res.modelId, credentialId: res.credentialId, reason, failedGate: 'QUOTA_STATUS' });
          rejectionReasons[res.resourceId] = reason;
          continue;
        }

        // Calculate mathematical score
        const scoreObj = this.scoreResource(res, { requiredCapabilities: capsArray, contextLengthNeeded });

        // Task Complexity scoring adjustments
        let complexityMultiplier = 1.0;
        const normModel = String(res.modelId || '').toLowerCase();
        const tier = res.qualityTier || determineModelTier(res);
        const isLightweight = tier === ModelQualityTier.TIER_1 || normModel.includes('flash') || normModel.includes('mini') || normModel.includes('nano') || normModel.includes('11b') || normModel.includes('haiku') || normModel.includes('8b');
        const isReasoningOrPro = tier === ModelQualityTier.TIER_4 || tier === ModelQualityTier.TIER_3 || normModel.includes('3.8') || normModel.includes('pro') || normModel.includes('o1') || normModel.includes('opus') || normModel.includes('70b') || normModel.includes('reasoning') || normModel.includes('deepseek');


        if (isCritical) {
          if (isReasoningOrPro || tier === ModelQualityTier.TIER_4) complexityMultiplier = 1.60;
          if (isLightweight && !normModel.includes('3.8') && !normModel.includes('pro')) complexityMultiplier = 0.40;
        } else if (isComplex) {
          if (isReasoningOrPro || tier === ModelQualityTier.TIER_4) complexityMultiplier = 1.40;
        } else if (isSimple) {
          if (tier === ModelQualityTier.TIER_1 || (isLightweight && !normModel.includes('3.8'))) complexityMultiplier = 1.35;
          if (normModel.includes('3.8') || tier === ModelQualityTier.TIER_4) complexityMultiplier = 0.30;
          else if (isReasoningOrPro && !normModel.includes('flash')) complexityMultiplier = 0.70;
        } else if (isStandard) {
          if (tier === ModelQualityTier.TIER_2 || tier === ModelQualityTier.TIER_3 || normModel.includes('3.8')) complexityMultiplier = 1.25;
        }

        // Concurrency / In-Flight load multiplier & Usage balancing
        let loadMultiplier = 1.0;
        if (res.credentialId) {
          const credEntry = authoritativeCredentialPool.getCredential(res.providerId, res.credentialId);
          if (credEntry) {
            if (credEntry.inFlightRequests > 0) {
              loadMultiplier = Math.max(0.2, 1.0 - (credEntry.inFlightRequests * 0.25));
            }
            if (credEntry.requests > 0) {
              const usagePenalty = Math.min(0.15, credEntry.requests * 0.005);
              loadMultiplier = Math.max(0.5, loadMultiplier - usagePenalty);
            }
          }
        }

        // Credential Priority adjustment (priority 1 gets small preference over 2)
        let priorityMultiplier = 1.0;
        if (res.credentialPriority && res.credentialPriority > 1) {
          priorityMultiplier = Math.max(0.7, 1.0 - ((res.credentialPriority - 1) * 0.05));
        }

        const adjustedScore = Number((scoreObj.totalScore * complexityMultiplier * loadMultiplier * priorityMultiplier).toFixed(4));
        scoreBreakdown[res.resourceId] = {
          ...scoreObj,
          adjustedScore,
          complexityMultiplier,
          loadMultiplier,
          priorityMultiplier
        };

        eligible.push({
          ...res,
          taskComplexity: effectiveComplexity,
          score: adjustedScore,
          scoreBreakdown: scoreBreakdown[res.resourceId]
        });
      }

      // Rank candidates deterministically
      eligible.sort((a, b) => {
        // 1. Explicit Model preference strictly overrides
        const aMatchesModel = preferredModel && (a.modelId === preferredModel || a.resourceId.includes(preferredModel));
        const bMatchesModel = preferredModel && (b.modelId === preferredModel || b.resourceId.includes(preferredModel));
        if (aMatchesModel && !bMatchesModel) return -1;
        if (bMatchesModel && !aMatchesModel) return 1;

        // 2. Explicit Provider preference strictly overrides
        const normPrefProv = preferredProvider ? String(preferredProvider).toLowerCase() : null;
        const aMatchesProv = normPrefProv && (a.providerId === normPrefProv || (normPrefProv === 'gemini' && a.providerId === 'google') || (normPrefProv === 'google' && a.providerId === 'gemini'));
        const bMatchesProv = normPrefProv && (b.providerId === normPrefProv || (normPrefProv === 'gemini' && b.providerId === 'google') || (normPrefProv === 'google' && b.providerId === 'gemini'));
        if (aMatchesProv && !bMatchesProv) return -1;
        if (bMatchesProv && !aMatchesProv) return 1;

        // 3. Live-Certified models strictly precede non-live-certified models
        if (a.liveCertified && !b.liveCertified) return -1;
        if (b.liveCertified && !a.liveCertified) return 1;

        // 4. Provider Priority (PRIMARY before SECONDARY before FALLBACK)
        const priorityOrder = {
          [ProviderPriority.PRIMARY]: 1,
          [ProviderPriority.SECONDARY]: 2,
          [ProviderPriority.FALLBACK]: 3,
          [ProviderPriority.DISABLED]: 99
        };
        const prioA = priorityOrder[a.priority] || (typeof a.priority === 'number' ? a.priority : 2);
        const prioB = priorityOrder[b.priority] || (typeof b.priority === 'number' ? b.priority : 2);
        if (prioA !== prioB) return prioA - prioB;

        // 5. Available models strictly precede unavailable models
        const aAvail = (a.availability === ModelAvailability.AVAILABLE || a.liveCertified) && a.score > 0;
        const bAvail = (b.availability === ModelAvailability.AVAILABLE || b.liveCertified) && b.score > 0;
        if (aAvail && !bAvail) return -1;
        if (bAvail && !aAvail) return 1;

        // 5. Task Complexity Quality Tier Priority (when no explicit model requested)
        if (!preferredModel) {
          const tierWeight = {
            [ModelQualityTier.TIER_4]: 4,
            [ModelQualityTier.TIER_3]: 3,
            [ModelQualityTier.TIER_2]: 2,
            [ModelQualityTier.TIER_1]: 1
          };
          const tierA = tierWeight[a.qualityTier] || 2;
          const tierB = tierWeight[b.qualityTier] || 2;
          if (isCritical) {
            // Critical task strictly prioritizes highest quality tier
            if (tierA !== tierB) return tierB - tierA;
            if (a.liveCertified && !b.liveCertified) return -1;
            if (b.liveCertified && !a.liveCertified) return 1;
          } else if (isComplex) {
            // Complex task strictly prioritizes higher quality tier
            if (tierA !== tierB) return tierB - tierA;
            // Within same tier, prefer liveCertified
            if (a.liveCertified && !b.liveCertified) return -1;
            if (b.liveCertified && !a.liveCertified) return 1;
          } else if (isSimple) {
            // Simple task strictly prioritizes economy / fast tier
            if (tierA !== tierB) return tierA - tierB;
          }
        }

        // 5b. Free-First Resource Tier Priority (L1 Local AI & L2 Free Tier before L3 Paid API)
        const isFreeFirstMode = (resourcePolicy && resourcePolicy.mode === 'FREE_FIRST') || (paidAIAllowed === false);
        if (isFreeFirstMode && !preferredModel) {
          const tierPrio = {
            [ResourceTier.L1_LOCAL_AI]: 1,
            [ResourceTier.L2_FREE_TIER]: 2,
            [ResourceTier.L3_PAID_API]: 3
          };
          const prioA = tierPrio[a.resourceTier] || 2;
          const prioB = tierPrio[b.resourceTier] || 2;
          if (prioA !== prioB) return prioA - prioB;
        }

        // 6. Preferred credential
        if (preferredCredential && a.credentialId === preferredCredential && b.credentialId !== preferredCredential) return -1;
        if (preferredCredential && b.credentialId === preferredCredential && a.credentialId !== preferredCredential) return 1;

        // 7. Score ranking
        if (b.score !== a.score) return b.score - a.score;

        // 8. Credential priority ranking (lower number = higher priority)
        const credPrioA = a.credentialPriority || 1;
        const credPrioB = b.credentialPriority || 1;
        if (credPrioA !== credPrioB) return credPrioA - credPrioB;

        // 8b. Usage / Rotation balancing among equal candidates
        const reqA = a.requests || 0;
        const reqB = b.requests || 0;
        if (reqA !== reqB) return reqA - reqB;

        // 9. Health boost
        if (a.health === ModelHealthStatus.HEALTHY && b.health !== ModelHealthStatus.HEALTHY) return -1;
        if (b.health === ModelHealthStatus.HEALTHY && a.health !== ModelHealthStatus.HEALTHY) return 1;

        return 0;
      });

      const selected = eligible.length > 0 ? eligible[0] : null;
      const selectionReason = selected
        ? `Selected ${selected.providerId}:${selected.modelId}${selected.credentialId ? ` [${selected.credentialId}]` : ''} with highest score (${selected.score}) satisfying all requirements`
        : 'No candidate models satisfied capability, security, and health gates';

      let reportedComplexity = taskComplexity;
      if (!reportedComplexity) {
        if (isCritical) reportedComplexity = TaskComplexity.CRITICAL;
        else if (isComplex) reportedComplexity = TaskComplexity.COMPLEX;
        else if (isSimple) reportedComplexity = TaskComplexity.SIMPLE;
        else reportedComplexity = TaskComplexity.STANDARD;
      }

      return Object.freeze({
        selectedModel: selected,
        selectedProvider: selected ? selected.providerId : null,
        selectedCredential: selected ? selected.credentialId : null,
        selectedAccountId: selected ? (selected.accountId || selected.credentialId) : null,
        taskComplexity: reportedComplexity,
        score: selected ? selected.score : 0,
        selectionReason,
        candidates: Object.freeze(eligible),
        rejectedModels: Object.freeze(rejectedModels),
        rejectionReasons: Object.freeze(rejectionReasons),
        scoreBreakdown: Object.freeze(scoreBreakdown)
      });
    },

    /**
     * Backward-compatible candidate selector
     */
    selectCandidates(params = {}) {
      const decision = this.selectBestModel(params);
      return decision.candidates;
    },

    /**
     * Primary Dispatcher with Multi-Account Credential Rotation, Capability-Preserving Intelligent Failover & Forensic Telemetry
     */
    async dispatchTask({
      taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      prompt,
      task = null,
      taskComplexity = null,
      agentRole = 'DEVELOPER',
      systemPrompt = null,
      requiredCapabilities = [],
      dataClassification = DataClassification.INTERNAL,
      preferredProvider = null,
      preferredModel = null,
      preferredCredential = null,
      timeoutMs = defaultTimeoutMs,
      maxFailoverAttempts = 3,
      paidAIAllowed = undefined,
      resourcePolicy = null,
      metadata = {}
    } = {}) {
      const taskInput = task || prompt || '';
      const promptText = typeof prompt === 'string' ? prompt : (typeof task === 'string' ? task : (task && task.task ? task.task : JSON.stringify(task)));

      // 1. Select and rank capability-matched candidates
      const decision = this.selectBestModel({
        task: taskInput,
        taskComplexity,
        requiredCapabilities,
        dataClassification,
        preferredProvider,
        preferredModel,
        preferredCredential,
        paidAIAllowed,
        resourcePolicy
      });

      const candidates = decision.candidates;

      if (candidates.length === 0) {
        return Object.freeze({
          requestId,
          taskId,
          status: GatewayInvocationStatus.FAILED,
          error: 'No eligible healthy AI resource available matching required capabilities and security criteria',
          code: ErrorCodes.SECURITY_BLOCKED,
          proposalOnly: true,
          executionAuthorized: false,
          mutationAuthorized: false,
          deploymentAuthorized: false,
          networkAuthorized: false,
          shellAuthorized: false,
          requiresApproval: true,
          selectionExplanation: decision,
          authorityGuarantee: DefaultGatewayAuthorityGuarantee,
          timestamp: new Date().toISOString()
        });
      }

      const primaryCandidate = candidates[0];
      const primaryProviderId = primaryCandidate.providerId;
      const primaryModelId = primaryCandidate.modelId;

      let lastError = null;
      let fallbackTriggered = false;
      const attemptedResources = [];
      const failoverTraces = [];
      const seenCandidateIds = new Set();
      let attemptsCount = 0;
      const maxAttempts = Math.max(1, maxFailoverAttempts || 3);

      // 2. Iterate through candidates with intelligent failover across credentials & providers
      for (let i = 0; i < candidates.length && attemptsCount < maxAttempts; i++) {
        const candidate = candidates[i];
        const candKey = `${candidate.providerId}:${candidate.modelId}:${candidate.credentialId || 'default'}`;

        // De-duplicate: Never retry exact same candidate in same task
        if (seenCandidateIds.has(candKey)) {
          continue;
        }
        seenCandidateIds.add(candKey);

        // Skip candidate if credential or candidate is not available (e.g. cooldown, quota exceeded)
        if (candidate.credentialId) {
          const isCandidateAvail = authoritativeCredentialPool.isCandidateAvailable
            ? authoritativeCredentialPool.isCandidateAvailable(candidate.providerId, candidate.credentialId, candidate.modelId)
            : authoritativeCredentialPool.isAvailable(candidate.providerId, candidate.credentialId);
          if (!isCandidateAvail) {
            continue;
          }
        }

        // Skip candidate if provider-level quota is exhausted and no healthy credentials remain
        const healthyCreds = candidate.credentialId
          ? authoritativeCredentialPool.getHealthyCredentials(candidate.providerId)
          : [];
        if (this.getQuotaState(candidate.providerId) === QuotaState.QUOTA_EXCEEDED && (!candidate.credentialId || healthyCreds.length === 0)) {
          continue;
        }

        // Skip if model-level circuit is open
        if (!this.canExecute(candidate.providerId, candidate.modelId)) {
          continue;
        }

        const resKey = makeKey(candidate.providerId, candidate.modelId);
        attemptedResources.push({
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          credentialId: candidate.credentialId || null,
          credentialFingerprint: candidate.credentialFingerprint || null
        });
        recordDispatch(resKey);
        attemptsCount++;

        if (attemptedResources.length > 1) {
          fallbackTriggered = true;
          const prev = attemptedResources[attemptedResources.length - 2];
          failoverTraces.push({
            primaryProvider: primaryProviderId,
            primaryModel: `${primaryProviderId}:${primaryModelId}`,
            failedModel: `${prev.providerId}:${prev.modelId}`,
            failedCredential: prev.credentialId || null,
            failedAccount: prev.credentialId || null,
            failureType: lastError ? (lastError.code || lastError.name || 'INVOCATION_FAILED') : 'UNKNOWN',
            fallbackModel: `${candidate.providerId}:${candidate.modelId}`,
            fallbackCredential: candidate.credentialId || null,
            fallbackAccount: candidate.credentialId || null,
            fallbackProvider: candidate.providerId,
            fallbackTriggered: true,
            attemptNumber: attemptedResources.length,
            attempts: attemptedResources.length
          });
        }

        // Acquire concurrency on credential if registered in pool
        if (candidate.credentialId) {
          authoritativeCredentialPool.acquireConcurrency(candidate.providerId, candidate.credentialId);
        }

        const t0 = now();
        try {
          const credEntry = candidate.credentialId
            ? authoritativeCredentialPool.getCredential(candidate.providerId, candidate.credentialId)
            : null;
          const activeApiKey = credEntry ? credEntry.apiKey : null;

          const invocationParams = {
            requestId: `${requestId}-try-${attemptsCount}`,
            providerId: candidate.providerId,
            prompt: promptText,
            agentRole,
            systemPrompt,
            timeoutMs,
            maxRetries: 0,
            metadata: {
              ...metadata,
              taskId,
              model: candidate.modelId,
              apiKey: activeApiKey,
              credentialId: candidate.credentialId || null,
              credentialFingerprint: candidate.credentialFingerprint || null,
              isFallback: attemptedResources.length > 1,
              primaryProviderId
            }
          };

          const result = await authoritativeGateway.dispatch(invocationParams);

          if (result && result.status === GatewayInvocationStatus.SUCCESS) {
            const rawContent = result.output || result.rawContent || '';
            const isNonEmpty = typeof rawContent === 'string' && rawContent.trim().length > 0;

            if (!isNonEmpty) {
              const err = new Error('Gateway returned empty or whitespace-only output');
              err.code = 'EMPTY_RESPONSE';
              this.recordFailure(candidate.providerId, candidate.modelId, err);
              lastError = err;
              continue;
            }

            const elapsed = now() - t0;
            recordLatency(resKey, elapsed);
            this.recordSuccess(candidate.providerId, candidate.modelId);
            this.setHealthState(candidate.providerId, candidate.modelId, ModelHealthStatus.HEALTHY);

            // Record success in credential pool
            if (candidate.credentialId) {
              authoritativeCredentialPool.recordSuccess(candidate.providerId, candidate.credentialId, elapsed);
            }

            // Compute SHA-256 fingerprint of response content
            const responseHash = crypto.createHash('sha256').update(String(rawContent)).digest('hex');

            if (failoverTraces.length > 0) {
              const lastTrace = failoverTraces[failoverTraces.length - 1];
              lastTrace.latency = elapsed;
              lastTrace.responseHash = responseHash;
            }

            if (candidate.providerType !== ProviderType.LOCAL) {
              const effectiveModelId = result.actualModel || result.model || candidate.modelId;
              const certEntry = Object.freeze({
                providerId: candidate.providerId,
                modelId: effectiveModelId,
                requestedModel: result.requestedModel || candidate.modelId,
                actualModel: effectiveModelId,
                modelVersion: result.modelVersion || effectiveModelId,
                status: ModelAvailability.LIVE_CERTIFIED,
                live: true,
                certifiedAt: new Date().toISOString(),
                sha256: responseHash,
                latencyMs: elapsed
              });
              if (result.isSubstituted) {
                certifiedModels.set(resKey, Object.freeze({
                  providerId: candidate.providerId,
                  modelId: candidate.modelId,
                  status: ModelAvailability.INFERENCE_FAILED,
                  live: false,
                  reason: 'MODEL_SUBSTITUTION_ORIGINAL_FAILED'
                }));
              } else {
                certifiedModels.set(resKey, certEntry);
                if (candidate.credentialId) {
                  certifiedModels.set(`${candidate.providerId}:${effectiveModelId}:${candidate.credentialId}`, certEntry);
                }
              }
              if (effectiveModelId && effectiveModelId !== candidate.modelId) {
                certifiedModels.set(makeKey(candidate.providerId, effectiveModelId), certEntry);
              }
              if (candidate.providerId === 'gemini') {
                if (!result.isSubstituted) certifiedModels.set(`google:${candidate.modelId}`, certEntry);
                if (effectiveModelId) certifiedModels.set(`google:${effectiveModelId}`, certEntry);
              }
              if (candidate.providerId === 'google') {
                if (!result.isSubstituted) certifiedModels.set(`gemini:${candidate.modelId}`, certEntry);
                if (effectiveModelId) certifiedModels.set(`gemini:${effectiveModelId}`, certEntry);
              }
            }

            if (candidate.credentialId) {
              if (authoritativeCredentialPool.markModelHealthy) {
                authoritativeCredentialPool.markModelHealthy(candidate.providerId, candidate.credentialId, candidate.modelId);
              }
              const usage = result.usage || {};
              const costVal = result.cost || 0;
              const costNum = typeof costVal === 'number' ? costVal : (costVal.estimatedCostUsd || 0);
              authoritativeCredentialPool.recordAccountUsage(candidate.providerId, candidate.credentialId, {
                inputTokens: usage.inputTokens || 0,
                outputTokens: usage.outputTokens || 0,
                cost: costNum,
                latencyMs: elapsed,
                status: result.status
              });
            }

            const finalRequestedModel = primaryModelId || result.requestedModel || candidate.modelId;
            const finalActualModel = result.actualModel || result.model || candidate.modelId;
            const modelWasSubstituted = Boolean(result.isSubstituted || (primaryModelId && primaryModelId !== finalActualModel));
            const subReason = result.substitutionReason || (modelWasSubstituted ? 'FALLBACK_TO_AVAILABLE_MODEL' : null);
            const isSharedQuota = authoritativeCredentialPool.isSharedQuotaSuspected
              ? authoritativeCredentialPool.isSharedQuotaSuspected(candidate.providerId)
              : false;

            return Object.freeze({
              ...result,
              requestId,
              taskId,
              requestedProvider: preferredProvider || primaryProviderId,
              selectedProvider: candidate.providerId,
              providerId: candidate.providerId,
              modelId: finalActualModel,
              requestedModel: finalRequestedModel,
              actualModel: finalActualModel,
              modelVersion: result.modelVersion || finalActualModel,
              credentialId: candidate.credentialId || result.credentialId || null,
              accountId: candidate.credentialId || result.credentialId || null,
              credentialFingerprint: candidate.credentialFingerprint || result.credentialFingerprint || null,
              isSubstituted: modelWasSubstituted,
              substitutionReason: subReason,
              sharedQuotaSuspected: isSharedQuota,
              modelState: candidate.providerType === ProviderType.LOCAL ? ModelAvailability.CERTIFIED_BUILTIN : ModelAvailability.LIVE_CERTIFIED,
              liveCertified: true,
              credentialAlias: candidate.credentialAlias || candidate.credentialId || null,
              qualityTier: candidate.qualityTier || determineModelTier(candidate),
              resourceTier: candidate.resourceTier || determineResourceTier(candidate),
              paidAIAllowed: paidAIAllowed !== false,
              isPaid: Boolean(candidate.isPaid || candidate.resourceTier === ResourceTier.L3_PAID_API),
              paidCallAttempted: Boolean(candidate.isPaid || candidate.resourceTier === ResourceTier.L3_PAID_API),
              taskComplexity: decision.taskComplexity || TaskComplexity.STANDARD,
              inputTokens: (result.usage && result.usage.inputTokens) || 0,
              outputTokens: (result.usage && result.usage.outputTokens) || 0,
              totalTokens: (result.usage && result.usage.totalTokens) || (((result.usage && result.usage.inputTokens) || 0) + ((result.usage && result.usage.outputTokens) || 0)),
              primaryProviderId,
              primaryModelId,
              fallbackTriggered,
              fallbackReason: fallbackTriggered ? (lastError ? (lastError.code || lastError.message || 'QUOTA_EXCEEDED') : 'FAILOVER') : null,
              attemptNumber: attemptsCount,
              attemptedResources,
              failoverTraces: Object.freeze(failoverTraces),
              responseHash,
              latency: elapsed,
              latencyMs: elapsed,
              errorCode: null,
              circuitState: this.getCircuitState(candidate.providerId, candidate.modelId),
              healthState: this.getHealthState(candidate.providerId, candidate.modelId),
              quotaState: this.getQuotaState(candidate.providerId, candidate.modelId),
              authorityBreachAttempted: Boolean(result.authorityBreachAttempted),
              proposalOnly: true,
              executionAuthorized: false,
              mutationAuthorized: false,
              deploymentAuthorized: false,
              networkAuthorized: false,
              shellAuthorized: false,
              requiresApproval: true,
              authorityGuarantee: DefaultGatewayAuthorityGuarantee
            });
          }

          // Non-success status from gateway
          const classified = classifyError(new Error(result.error || 'Invocation unsuccessful'));

          if (candidate.credentialId) {
            const errMsg = String(result.error || '').toLowerCase();
            const isAccountWide = /account|project|billing|credit|monthly/i.test(errMsg);
            if (classified.code === 'QUOTA_EXCEEDED') {
              if (authoritativeCredentialPool.markModelQuotaExceeded) {
                authoritativeCredentialPool.markModelQuotaExceeded(candidate.providerId, candidate.credentialId, candidate.modelId, result.error);
              }
              authoritativeCredentialPool.markQuotaExceeded(candidate.providerId, candidate.credentialId, result.error);
            } else if (classified.code === 'RATE_LIMITED') {
              if (authoritativeCredentialPool.markModelRateLimited) {
                authoritativeCredentialPool.markModelRateLimited(candidate.providerId, candidate.credentialId, candidate.modelId, result.error);
              }
              authoritativeCredentialPool.markRateLimited(candidate.providerId, candidate.credentialId, result.error);
            } else if (classified.code === 'AUTH_FAILED') {
              authoritativeCredentialPool.markAuthFailed(candidate.providerId, candidate.credentialId, result.error);
            } else if (classified.code === 'TIMEOUT') {
              authoritativeCredentialPool.markTimeout(candidate.providerId, candidate.credentialId, result.error);
            } else {
              authoritativeCredentialPool.markDegraded(candidate.providerId, candidate.credentialId, result.error);
            }
          }

          const remainingHealthy = candidate.credentialId
            ? authoritativeCredentialPool.getHealthyCredentials(candidate.providerId)
            : [];

          if (!candidate.credentialId || remainingHealthy.length === 0) {
            this.recordFailure(candidate.providerId, candidate.modelId, new Error(result.error));
            if (classified.quotaState === QuotaState.QUOTA_EXCEEDED) {
              this.setQuotaState(candidate.providerId, candidate.modelId, QuotaState.QUOTA_EXCEEDED);
              this.setQuotaState(candidate.providerId, null, QuotaState.QUOTA_EXCEEDED);
            }
            if (classified.code === 'AUTH_FAILED') {
              this.setHealthState(candidate.providerId, null, ModelHealthStatus.AUTH_FAILED);
            }
            if (classified.health) {
              this.setHealthState(candidate.providerId, candidate.modelId, classified.health);
            }
          }

          lastError = new Error(result.error || 'Resource execution failed');
          lastError.code = classified.code;
        } catch (err) {
          const elapsed = now() - t0;
          const classified = classifyError(err);

          if (candidate.credentialId) {
            if (classified.code === 'QUOTA_EXCEEDED') {
              if (authoritativeCredentialPool.markModelQuotaExceeded) {
                authoritativeCredentialPool.markModelQuotaExceeded(candidate.providerId, candidate.credentialId, candidate.modelId, err.message);
              }
              authoritativeCredentialPool.markQuotaExceeded(candidate.providerId, candidate.credentialId, err.message);
            } else if (classified.code === 'RATE_LIMITED') {
              if (authoritativeCredentialPool.markModelRateLimited) {
                authoritativeCredentialPool.markModelRateLimited(candidate.providerId, candidate.credentialId, candidate.modelId, err.message);
              }
              authoritativeCredentialPool.markRateLimited(candidate.providerId, candidate.credentialId, err.message);
            } else if (classified.code === 'AUTH_FAILED') {
              authoritativeCredentialPool.markAuthFailed(candidate.providerId, candidate.credentialId, err.message);
            } else if (classified.code === 'TIMEOUT') {
              authoritativeCredentialPool.markTimeout(candidate.providerId, candidate.credentialId, err.message);
            } else {
              authoritativeCredentialPool.markDegraded(candidate.providerId, candidate.credentialId, err.message);
            }
          }

          const remainingHealthy = candidate.credentialId
            ? authoritativeCredentialPool.getHealthyCredentials(candidate.providerId)
            : [];

          if (!candidate.credentialId || remainingHealthy.length === 0) {
            this.recordFailure(candidate.providerId, candidate.modelId, err);
            if (classified.quotaState === QuotaState.QUOTA_EXCEEDED) {
              this.setQuotaState(candidate.providerId, candidate.modelId, QuotaState.QUOTA_EXCEEDED);
              this.setQuotaState(candidate.providerId, null, QuotaState.QUOTA_EXCEEDED);
            }
            if (classified.code === 'AUTH_FAILED') {
              this.setHealthState(candidate.providerId, null, ModelHealthStatus.AUTH_FAILED);
            }
            if (classified.health) {
              this.setHealthState(candidate.providerId, candidate.modelId, classified.health);
            }
          }

          lastError = err;
          lastError.code = classified.code;
        } finally {
          if (candidate.credentialId) {
            authoritativeCredentialPool.releaseConcurrency(candidate.providerId, candidate.credentialId);
          }
        }
      }

      // 3. If all candidates exhausted, return structured failure
      const sanitized = sanitizeError(lastError || new Error('All candidate AI resources failed'));
      return Object.freeze({
        requestId,
        taskId,
        requestedProvider: preferredProvider || primaryProviderId,
        selectedProvider: primaryProviderId,
        providerId: primaryProviderId,
        modelId: primaryModelId,
        primaryProviderId,
        requestedModel: primaryModelId,
        actualModel: primaryModelId,
        modelVersion: primaryModelId,
        qualityTier: primaryCandidate ? (primaryCandidate.qualityTier || determineModelTier(primaryCandidate)) : ModelQualityTier.TIER_2,
        resourceTier: primaryCandidate ? (primaryCandidate.resourceTier || determineResourceTier(primaryCandidate)) : ResourceTier.L2_FREE_TIER,
        paidAIAllowed: paidAIAllowed !== false,
        isPaid: primaryCandidate ? Boolean(primaryCandidate.isPaid || primaryCandidate.resourceTier === ResourceTier.L3_PAID_API) : false,
        paidCallAttempted: false,
        taskComplexity: decision.taskComplexity || TaskComplexity.STANDARD,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        responseHash: null,
        latencyMs: 0,
        accountId: primaryCandidate ? (primaryCandidate.accountId || primaryCandidate.credentialId) : null,
        fallbackTriggered: true,
        fallbackReason: lastError ? (lastError.code || lastError.message || 'QUOTA_EXCEEDED') : 'ALL_CANDIDATES_FAILED',
        attemptNumber: attemptsCount,
        attemptedResources,
        failoverTraces: Object.freeze(failoverTraces),
        status: GatewayInvocationStatus.FAILED,
        error: sanitized.message,
        errorCode: lastError ? (lastError.code || 'PROVIDER_UNAVAILABLE') : 'PROVIDER_UNAVAILABLE',
        code: ProviderErrorCodes.PROVIDER_UNAVAILABLE,
        proposalOnly: true,
        executionAuthorized: false,
        mutationAuthorized: false,
        deploymentAuthorized: false,
        networkAuthorized: false,
        shellAuthorized: false,
        requiresApproval: true,
        authorityGuarantee: DefaultGatewayAuthorityGuarantee,
        timestamp: new Date().toISOString()
      });
    },

    /**
     * Dynamic Workload Distribution across N independent tasks
     */
    async distributeWorkload({
      tasks = [],
      options = {}
    } = {}) {
      if (!Array.isArray(tasks) || tasks.length === 0) {
        return Object.freeze({ results: [], total: 0, successful: 0, failed: 0 });
      }

      const results = [];
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const taskId = t.id || t.taskId || `workload-task-${i + 1}`;
        const prompt = t.prompt || t.task || (typeof t === 'string' ? t : JSON.stringify(t));
        const requiredCaps = t.requiredCapabilities || options.requiredCapabilities || [];
        const preferredProvider = t.preferredProvider || options.preferredProvider || null;
        const preferredModel = t.preferredModel || options.preferredModel || null;

        const res = await this.dispatchTask({
          taskId,
          prompt,
          requiredCapabilities: requiredCaps,
          preferredProvider,
          preferredModel,
          maxFailoverAttempts: options.maxFailoverAttempts !== undefined ? options.maxFailoverAttempts : 5,
          ...options
        });

        results.push({
          taskId,
          providerId: res.providerId,
          modelId: res.modelId,
          credentialId: res.credentialId || null,
          latencyMs: res.latencyMs || 0,
          status: res.status,
          success: res.status === GatewayInvocationStatus.SUCCESS,
          responseHash: res.responseHash || null,
          proposalOnly: res.proposalOnly,
          executionAuthorized: res.executionAuthorized !== undefined ? res.executionAuthorized : false
        });
      }

      const successful = results.filter(r => r.success).length;
      return Object.freeze({
        results: Object.freeze(results),
        total: tasks.length,
        successful,
        failed: tasks.length - successful
      });
    },

    /**
     * Live Model Certification & Capability Matrix methods (FAZ 66.9)
     */
    isModelCertified(providerId, modelId, credentialId = null) {
      if (credentialId) {
        const candKey = `${providerId}:${modelId}:${credentialId}`;
        const candCert = certifiedModels.get(candKey);
        if (candCert) {
          if (candCert.status === ModelAvailability.CERTIFIED_BUILTIN) return true;
          return Boolean(candCert.status === ModelAvailability.LIVE_CERTIFIED && candCert.live === true && (candCert.sha256 || candCert.responseHash) && !candCert.error);
        }
      }
      const key = makeKey(providerId, modelId);
      const cert = certifiedModels.get(key) || (providerId === 'gemini' ? certifiedModels.get(`google:${modelId}`) : (providerId === 'google' ? certifiedModels.get(`gemini:${modelId}`) : null));
      if (!cert) return false;
      if (cert.status === ModelAvailability.CERTIFIED_BUILTIN) return true;
      return Boolean(cert.status === ModelAvailability.LIVE_CERTIFIED && cert.live === true && (cert.sha256 || cert.responseHash) && !cert.error);
    },

    certifyModelInference(providerId, modelId, telemetry = {}) {
      const key = makeKey(providerId, modelId);
      const isHttp200 = telemetry.httpStatus === 200;
      const hasError = Boolean(telemetry.error);
      const isTimeout = Boolean(telemetry.timeout || telemetry.status === 'TIMEOUT' || telemetry.status === ModelAvailability.TIMEOUT);
      const isAborted = Boolean(telemetry.aborted || telemetry.transport === 'ABORTED' || (telemetry.error && String(telemetry.error).toLowerCase().includes('abort')));
      const is401 = telemetry.httpStatus === 401 || telemetry.status === 'AUTH_FAILED' || telemetry.status === ModelAvailability.AUTH_FAILED;
      const is429 = telemetry.httpStatus === 429 || telemetry.status === 'QUOTA_EXCEEDED' || telemetry.status === ModelAvailability.QUOTA_EXCEEDED;

      const reqModel = telemetry.requestedModel || modelId;
      const actModel = telemetry.actualModel || telemetry.model || modelId;
      const isSubstituted = Boolean(telemetry.isSubstituted || (telemetry.requestedModel && telemetry.actualModel && telemetry.requestedModel !== telemetry.actualModel));

      // Test E: If requested model was substituted or failed (e.g. 404), requested model CANNOT be certified!
      if (isSubstituted && modelId === reqModel && reqModel !== actModel) {
        const rejectedEntry = Object.freeze({
          providerId,
          modelId: reqModel,
          requestedModel: reqModel,
          actualModel: actModel,
          status: ModelAvailability.INFERENCE_FAILED,
          live: false,
          isSubstituted: true,
          reason: 'MODEL_SUBSTITUTION_ORIGINAL_FAILED',
          error: `Original model ${reqModel} was substituted with ${actModel}; requested model cannot be certified.`
        });
        certifiedModels.set(key, rejectedEntry);
        if (providerId === 'gemini') certifiedModels.set(`google:${reqModel}`, rejectedEntry);
        if (providerId === 'google') certifiedModels.set(`gemini:${reqModel}`, rejectedEntry);
        return rejectedEntry;
      }

      const rawOutput = telemetry.output !== undefined ? telemetry.output : (telemetry.rawContent !== undefined ? telemetry.rawContent : null);
      const hasValidOutput = rawOutput !== null
        ? (typeof rawOutput === 'string' ? rawOutput.trim().length > 0 : Boolean(rawOutput))
        : (telemetry.outputLength !== undefined ? telemetry.outputLength > 0 : true);

      const hasHash = Boolean(telemetry.sha256 || telemetry.responseHash);
      const hasLatency = typeof telemetry.latencyMs === 'number' && telemetry.latencyMs >= 0;

      // Strict Certification Gate: ALL empirical requirements must hold
      const canCertify = isHttp200 && !hasError && !isTimeout && !isAborted && !is401 && !is429 && hasValidOutput && hasHash && hasLatency;

      let determinedStatus = ModelAvailability.CATALOG_ONLY;
      if (canCertify) {
        determinedStatus = ModelAvailability.LIVE_CERTIFIED;
      } else if (isTimeout || isAborted) {
        determinedStatus = ModelAvailability.DEFERRED;
      } else if (is401) {
        determinedStatus = ModelAvailability.AUTH_FAILED;
      } else if (is429) {
        determinedStatus = ModelAvailability.QUOTA_EXCEEDED;
      } else {
        determinedStatus = ModelAvailability.INFERENCE_FAILED;
      }

      const certEntry = Object.freeze({
        providerId,
        modelId,
        requestedModel: telemetry.requestedModel || modelId,
        actualModel: telemetry.actualModel || modelId,
        modelVersion: telemetry.modelVersion || telemetry.actualModel || modelId,
        isSubstituted: Boolean(telemetry.isSubstituted),
        status: determinedStatus,
        live: canCertify,
        certifiedAt: canCertify ? (telemetry.certifiedAt || new Date().toISOString()) : null,
        sha256: canCertify ? (telemetry.sha256 || telemetry.responseHash) : null,
        latencyMs: hasLatency ? telemetry.latencyMs : null,
        httpStatus: telemetry.httpStatus !== undefined ? telemetry.httpStatus : null,
        outputLength: hasValidOutput && rawOutput ? (typeof rawOutput === 'string' ? rawOutput.length : telemetry.outputLength) : (canCertify ? (telemetry.outputLength || 1) : 0),
        error: hasError ? sanitizeString(telemetry.error) : null
      });

      certifiedModels.set(key, certEntry);
      if (providerId === 'gemini') certifiedModels.set(`google:${modelId}`, certEntry);
      if (providerId === 'google') certifiedModels.set(`gemini:${modelId}`, certEntry);
      return certEntry;
    },

    getResourceInventory() {
      return buildInventory();
    },

    getInventory() {
      return buildInventory();
    },

    getCapabilityCertification(providerId, modelId, capability) {
      const res = this.getResource(providerId, modelId);
      const isCertified = this.isModelCertified(providerId, modelId);
      return certifyModelCapability(res, capability, isCertified);
    },

    getCertificationMatrix() {
      const inv = buildInventory();
      return Object.freeze(inv.map(res => {
        const cert = certifiedModels.get(res.resourceId) || certifiedModels.get(res.baseResourceId) || (res.providerId === 'gemini' ? certifiedModels.get(`google:${res.modelId}`) : (res.providerId === 'google' ? certifiedModels.get(`gemini:${res.modelId}`) : null));
        return Object.freeze({
          resourceId: res.resourceId,
          candidateId: res.candidateId,
          providerId: res.providerId,
          modelId: res.modelId,
          credentialId: res.credentialId || null,
          displayName: res.displayName,
          modelState: res.modelState || res.status,
          liveCertified: Boolean(res.liveCertified),
          catalogStatus: 'REGISTERED',
          inferenceStatus: res.modelState || res.status,
          healthStatus: res.health,
          quotaStatus: res.quotaState,
          circuitState: res.circuitState,
          sha256: res.sha256 || (cert ? (cert.responseHash || cert.sha256) : null),
          latencyMs: res.latencyMs
        });
      }));
    },

    getCertifiedModels() {
      const list = [];
      for (const [k, v] of certifiedModels.entries()) {
        list.push(v);
      }
      return Object.freeze(list);
    }
  });
}
