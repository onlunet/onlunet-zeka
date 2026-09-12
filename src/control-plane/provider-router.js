/**
 * ONLUNET ZEKA - Intelligent Policy-Aware Provider Router
 * FAZ 59 Foundation: Capability Matrix & Multi-Factor Routing Engine
 *
 * Implements capability matching, data classification boundary checks,
 * tenant/workspace scoping, circuit-breaker awareness, and latency optimization.
 *
 * MUTLAK KURAL:
 * ROUTER DECIDES PROVIDER. ROUTER DOES NOT DECIDE AUTHORITY.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';
import { DataClassification, validateDataClassificationPolicy } from './data-classifier.js';

export const ModelCapabilities = Object.freeze({
  REASONING: 'reasoning',
  CODING: 'coding',
  VISION: 'vision',
  STRUCTURED_OUTPUT: 'structured_output',
  LONG_CONTEXT: 'long_context',
  TOOL_USE: 'tool_use',
  JSON_MODE: 'json_mode',
  STREAMING: 'streaming',
  EMBEDDING: 'embedding'
});

export const DefaultProviderCapabilityMatrix = Object.freeze({
  openai: Object.freeze(['reasoning', 'coding', 'structured_output', 'json_mode', 'long_context', 'tool_use', 'streaming']),
  anthropic: Object.freeze(['reasoning', 'coding', 'long_context', 'tool_use', 'vision', 'streaming']),
  google: Object.freeze(['reasoning', 'coding', 'vision', 'long_context', 'structured_output', 'json_mode', 'streaming']),
  custom: Object.freeze(['coding', 'structured_output', 'json_mode', 'streaming']),
  local: Object.freeze(['reasoning', 'coding', 'structured_output', 'json_mode', 'local'])
});

export function createProviderRouter({
  registry = null,
  healthMonitor = null,
  capabilityMatrix = DefaultProviderCapabilityMatrix,
  defaultProvider = 'local'
} = {}) {
  return Object.freeze({
    /**
     * Resolves the optimal provider for an incoming request.
     * Fails closed if capabilities or security policies cannot be met.
     */
    route({
      taskType = 'general',
      requiredCapabilities = [],
      tenantId = null,
      workspaceId = null,
      dataClassification = DataClassification.INTERNAL,
      preferredProviders = [],
      fallbackProviders = [],
      latencyRequirementMs = null,
      budgetRemainingUsd = null
    } = {}) {
      const normalizedReqCaps = requiredCapabilities.map(c => String(c).trim().toLowerCase());

      // 1. Gather Candidate Providers
      let candidates = [];
      if (preferredProviders.length > 0) {
        candidates = [...preferredProviders, ...fallbackProviders];
      } else {
        candidates = ['local', 'custom', 'openai', 'anthropic', 'google'];
      }

      // 2. Filter by Data Classification Boundary
      const policyApproved = [];
      for (const candidate of candidates) {
        const isLocal = candidate === 'local' || candidate === 'local-provider';
        try {
          validateDataClassificationPolicy({
            classification: dataClassification,
            providerId: candidate,
            isLocal
          });
          policyApproved.push(candidate);
        } catch {
          // Excluded by data boundary
        }
      }

      if (policyApproved.length === 0) {
        throw new Error(
          `[${ErrorCodes.SECURITY_BLOCKED}] No available provider satisfies data classification policy '${dataClassification}'`
        );
      }

      // 3. Filter by Required Capabilities
      const capabilityMatches = [];
      for (const candidate of policyApproved) {
        const supported = capabilityMatrix[candidate] || [];
        const hasAll = normalizedReqCaps.every(req => supported.includes(req));
        if (hasAll) {
          capabilityMatches.push(candidate);
        }
      }

      if (capabilityMatches.length === 0) {
        throw new Error(
          `[${ErrorCodes.SECURITY_BLOCKED}] CAPABILITY_MISMATCH: No policy-compliant provider satisfies capabilities [${normalizedReqCaps.join(', ')}]`
        );
      }

      // 4. Filter by Provider Health & Circuit Breaker State
      let selectedProvider = null;
      for (const candidate of capabilityMatches) {
        if (healthMonitor) {
          const health = healthMonitor.getHealth(candidate);
          // Skip offline / unconfigured / circuit-open providers if other candidates exist
          if (health.status === 'OFFLINE' || health.status === 'UNCONFIGURED' || health.circuitState === 'OPEN') {
            continue;
          }
          if (latencyRequirementMs && health.latencyMs > latencyRequirementMs) {
            continue;
          }
        }
        selectedProvider = candidate;
        break;
      }

      // If all healthy options exhausted, fallback to first capability match
      if (!selectedProvider) {
        selectedProvider = capabilityMatches[0] || defaultProvider;
      }

      // Determine secondary fallback
      const fallback = capabilityMatches.find(c => c !== selectedProvider) || 'local';

      return Object.freeze({
        selectedProvider,
        fallbackProvider: fallback,
        dataClassification,
        matchedCapabilities: normalizedReqCaps,
        taskType,
        tenantId,
        workspaceId,
        executionAuthorized: false, // Inviolable guarantee
        requiresHumanApproval: true,
        proposalOnly: true,
        routedAt: new Date().toISOString()
      });
    }
  });
}
