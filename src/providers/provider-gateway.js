/**
 * ONLUNET ZEKA - Real AI Provider Gateway
 * FAZ 58 Foundation: Resilient, Audited Outbound Provider Dispatcher
 *
 * Implements:
 * - Hard timeout via AbortController
 * - Bounded transport retries (max 2) with backoff / 429 retry-after
 * - Provider fallback cascading
 * - Circuit breaker (CLOSED, OPEN, HALF_OPEN)
 * - Budget enforcement
 * - Strict credential sanitization
 * - Normalized ProviderInvocationResult with guaranteed executionAuthorized: false
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';
import { sanitizeString, sanitizeError } from './credential-sanitizer.js';
import { createProviderRegistry } from './provider-registry.js';
import { createBudgetTracker } from './cost-tracker.js';
import { createCircuitBreaker, CircuitBreakerState } from './circuit-breaker.js';

export { CircuitBreakerState };

export const GatewayInvocationStatus = Object.freeze({
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  REJECTED: 'REJECTED'
});

export const ProviderCapabilities = Object.freeze({
  TEXT: 'TEXT',
  STRUCTURED_OUTPUT: 'STRUCTURED_OUTPUT',
  LONG_CONTEXT: 'LONG_CONTEXT',
  CODE_GENERATION: 'CODE_GENERATION',
  CODE_REVIEW: 'CODE_REVIEW',
  VISION: 'VISION',
  TOOL_CALLING: 'TOOL_CALLING',
  TOOL_USE: 'TOOL_USE',
  STREAMING: 'STREAMING',
  JSON_MODE: 'JSON_MODE',
  REASONING: 'REASONING',
  FAST_INFERENCE: 'FAST_INFERENCE',
  LOCAL: 'LOCAL'
});

export const ProviderErrorCodes = Object.freeze({
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_TIMEOUT: 'PROVIDER_TIMEOUT',
  PROVIDER_AUTH_ERROR: 'PROVIDER_AUTH_ERROR',
  PROVIDER_RATE_LIMITED: 'PROVIDER_RATE_LIMITED',
  PROVIDER_BAD_REQUEST: 'PROVIDER_BAD_REQUEST',
  PROVIDER_INVALID_RESPONSE: 'PROVIDER_INVALID_RESPONSE',
  PROVIDER_SCHEMA_ERROR: 'PROVIDER_SCHEMA_ERROR',
  PROVIDER_SERVER_ERROR: 'PROVIDER_SERVER_ERROR',
  PROVIDER_CIRCUIT_OPEN: 'PROVIDER_CIRCUIT_OPEN',
  PROVIDER_UNKNOWN_ERROR: 'PROVIDER_UNKNOWN_ERROR'
});

export const ProviderHealthStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  DEGRADED: 'DEGRADED',
  UNAVAILABLE: 'UNAVAILABLE',
  UNKNOWN: 'UNKNOWN'
});

export const ObservabilityEvents = Object.freeze({
  AI_INVOCATION_STARTED: 'AI_INVOCATION_STARTED',
  AI_INVOCATION_COMPLETED: 'AI_INVOCATION_COMPLETED',
  AI_INVOCATION_FAILED: 'AI_INVOCATION_FAILED',
  AI_PROVIDER_SELECTED: 'AI_PROVIDER_SELECTED',
  AI_PROVIDER_FALLBACK: 'AI_PROVIDER_FALLBACK',
  AI_PROVIDER_CIRCUIT_OPENED: 'AI_PROVIDER_CIRCUIT_OPENED',
  AI_PROVIDER_CIRCUIT_CLOSED: 'AI_PROVIDER_CIRCUIT_CLOSED',
  AI_PROPOSAL_CREATED: 'AI_PROPOSAL_CREATED',
  AI_PROPOSAL_REJECTED: 'AI_PROPOSAL_REJECTED',
  AI_PROPOSAL_CONFLICT: 'AI_PROPOSAL_CONFLICT',
  AI_ORCHESTRATION_STARTED: 'AI_ORCHESTRATION_STARTED',
  AI_ORCHESTRATION_COMPLETED: 'AI_ORCHESTRATION_COMPLETED',
  AI_ORCHESTRATION_FAILED: 'AI_ORCHESTRATION_FAILED'
});

export const DefaultGatewayAuthorityGuarantee = Object.freeze({
  executionAuthorized: false,
  mutationAuthorized: false,
  deploymentAuthorized: false,
  networkAuthorized: false,
  shellAuthorized: false,
  proposalOnly: true,
  requiresApproval: true
});

/**
 * Declarative model routing helper based on role and capability requirements.
 */
export function resolveProviderForRole(role, { preferredProviders = [], fallbackProviders = [] } = {}, registry = null) {
  const normalizedRole = String(role || 'DEVELOPER').trim().toUpperCase();
  const candidates = [...preferredProviders, ...fallbackProviders];

  if (candidates.length === 0) {
    if (normalizedRole === 'ARCHITECT' || normalizedRole === 'SECURITY') {
      return 'anthropic';
    }
    if (normalizedRole === 'DEVELOPER' || normalizedRole === 'DEBUGGER') {
      return 'openai';
    }
    return 'local';
  }

  if (registry) {
    for (const candidate of candidates) {
      if (registry.has(candidate)) {
        return candidate;
      }
    }
  }

  return candidates[0] || 'local';
}

export function createProviderGateway({
  registry = null,
  defaultTimeoutMs = 15000,
  defaultMaxRetries = 2,
  budgetTracker = null,
  circuitBreaker = null
} = {}) {
  const authoritativeRegistry = registry || createProviderRegistry();
  const authoritativeBudget = budgetTracker || createBudgetTracker();
  const authoritativeCircuitBreaker = circuitBreaker || createCircuitBreaker({ failureThreshold: 3, cooldownMs: 5000 });

  return Object.freeze({
    registry: authoritativeRegistry,
    budgetTracker: authoritativeBudget,
    circuitBreaker: authoritativeCircuitBreaker,

    invoke(params = {}) {
      return this.dispatch(params);
    },

    getProvider(providerId, context = {}) {
      return authoritativeRegistry.getProvider(providerId, context);
    },

    listProviders(context = {}) {
      return authoritativeRegistry.listProviders(context);
    },

    async checkHealth(providerId) {
      const adapter = authoritativeRegistry.getProvider(providerId);
      if (typeof adapter.checkHealth === 'function') {
        const res = await adapter.checkHealth();
        return { providerId, ...res };
      }
      return { status: ProviderHealthStatus.AVAILABLE, providerId, ready: true };
    },

    /**
     * Central Dispatcher for AI Invocations
     */
    async dispatch({
      requestId = `req-gw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      providerId = 'local',
      fallbackProviderId = null,
      prompt,
      agentId = 'agent-default',
      agentRole = 'DEVELOPER',
      systemPrompt = null,
      constraints = {},
      metadata = {},
      timeoutMs = defaultTimeoutMs,
      maxRetries = defaultMaxRetries,
      retryDelayMs = 200,
      tenantId = null,
      workspaceId = null,
      budgetTracker = null
    } = {}) {
      const activeBudget = budgetTracker || authoritativeBudget;
      const correlationId = (metadata && metadata.correlationId) ? metadata.correlationId : requestId;
      const taskId = (metadata && metadata.taskId) ? metadata.taskId : null;

      // 1. Budget Verification Pre-flight
      const budgetCheck = activeBudget.checkBudget();
      if (!budgetCheck.allowed) {
        return Object.freeze({
          requestId,
          correlationId,
          taskId,
          tenantId,
          workspaceId,
          provider: providerId,
          providerId,
          agentId,
          agentRole,
          status: GatewayInvocationStatus.BUDGET_EXCEEDED,
          executionAuthorized: false,
          mutationAuthorized: false,
          deploymentAuthorized: false,
          networkAuthorized: false,
          shellAuthorized: false,
          approvalGranted: false,
          admissionGranted: false,
          verificationPassed: false,
          error: budgetCheck.reason,
          code: ErrorCodes.SECURITY_BLOCKED,
          authorityGuarantee: DefaultGatewayAuthorityGuarantee,
          timestamp: new Date().toISOString()
        });
      }

      // 2. Circuit Breaker Pre-flight Check
      let effectiveProviderId = providerId;
      if (!authoritativeCircuitBreaker.canExecute(providerId)) {
        if (fallbackProviderId && authoritativeCircuitBreaker.canExecute(fallbackProviderId)) {
          effectiveProviderId = fallbackProviderId;
        } else {
          return Object.freeze({
            requestId,
            correlationId,
            taskId,
            tenantId,
            workspaceId,
            provider: providerId,
            providerId,
            agentId,
            agentRole,
            status: GatewayInvocationStatus.CIRCUIT_OPEN,
            proposalOnly: true,
            executionAuthorized: false,
            mutationAuthorized: false,
            deploymentAuthorized: false,
            networkAuthorized: false,
            shellAuthorized: false,
            approvalGranted: false,
            admissionGranted: false,
            verificationPassed: false,
            error: `Circuit breaker is OPEN for provider '${providerId}'. Invocation blocked fail-closed.`,
            code: ProviderErrorCodes.PROVIDER_CIRCUIT_OPEN,
            authorityGuarantee: DefaultGatewayAuthorityGuarantee,
            timestamp: new Date().toISOString()
          });
        }
      }

      // 3. Dispatch with Retry and Fallback
      let result = null;
      let primaryError = null;

      try {
        result = await this._executeWithRetry({
          requestId,
          targetProviderId: effectiveProviderId,
          prompt,
          agentRole,
          systemPrompt,
          constraints,
          metadata,
          timeoutMs,
          maxRetries,
          retryDelayMs,
          tenantId,
          workspaceId
        });
        authoritativeCircuitBreaker.recordSuccess(effectiveProviderId);
      } catch (err) {
        primaryError = err;
        authoritativeCircuitBreaker.recordFailure(effectiveProviderId, err);
      }

      // 4. Fallback Provider Trigger
      if ((!result || result.status !== GatewayInvocationStatus.SUCCESS) && fallbackProviderId && fallbackProviderId !== effectiveProviderId) {
        if (authoritativeCircuitBreaker.canExecute(fallbackProviderId)) {
          try {
            result = await this._executeWithRetry({
              requestId: `${requestId}-fallback`,
              targetProviderId: fallbackProviderId,
              prompt,
              agentRole,
              systemPrompt,
              constraints,
              metadata: { ...metadata, isFallback: true, primaryError: primaryError ? primaryError.message : null },
              timeoutMs,
              maxRetries: 1, // Limited retries for fallback
              retryDelayMs,
              tenantId,
              workspaceId
            });
            if (result && result.status === GatewayInvocationStatus.SUCCESS) {
              authoritativeCircuitBreaker.recordSuccess(fallbackProviderId);
              result = {
                ...result,
                primaryProviderId: effectiveProviderId,
                fallbackTriggered: true
              };
            }
          } catch (fallbackErr) {
            authoritativeCircuitBreaker.recordFailure(fallbackProviderId, fallbackErr);
            primaryError = primaryError || fallbackErr;
          }
        }
      }

      if (!result) {
        const cleaned = sanitizeError(primaryError || new Error('Provider invocation failed'));
        const isTimeout = primaryError && (
          primaryError.code === 'TIMEOUT' ||
          primaryError.name === 'AbortError' ||
          (typeof primaryError.message === 'string' && (
            primaryError.message.toLowerCase().includes('timeout') ||
            primaryError.message.toLowerCase().includes('abort')
          ))
        );
        return Object.freeze({
          requestId,
          correlationId,
          taskId,
          tenantId,
          workspaceId,
          provider: effectiveProviderId,
          providerId: effectiveProviderId,
          agentId,
          agentRole,
          status: isTimeout ? GatewayInvocationStatus.TIMEOUT : GatewayInvocationStatus.FAILED,
          attempts: (primaryError && primaryError.attempts) || 1,
          proposalOnly: true,
          executionAuthorized: false,
          mutationAuthorized: false,
          deploymentAuthorized: false,
          networkAuthorized: false,
          shellAuthorized: false,
          approvalGranted: false,
          admissionGranted: false,
          verificationPassed: false,
          error: cleaned.message,
          code: isTimeout ? ProviderErrorCodes.PROVIDER_TIMEOUT : (primaryError && primaryError.code ? primaryError.code : ProviderErrorCodes.PROVIDER_UNKNOWN_ERROR),
          authorityGuarantee: DefaultGatewayAuthorityGuarantee,
          timestamp: new Date().toISOString()
        });
      }

      // 5. Record Usage in Budget
      if (result.usage) {
        activeBudget.recordUsage({
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd: result.cost ? result.cost.estimatedCostUsd : 0
        });
      }

      // 6. Return Normalized Result with absolute zero authority guarantee
      return Object.freeze({
        ...result,
        correlationId,
        taskId,
        tenantId,
        workspaceId,
        agentId,
        agentRole,
        authorityBreachAttempted: Boolean(result.authorityBreachAttempted),
        proposalOnly: true,
        executionAuthorized: false,
        mutationAuthorized: false,
        deploymentAuthorized: false,
        networkAuthorized: false,
        shellAuthorized: false,
        approvalGranted: false,
        admissionGranted: false,
        verificationPassed: false,
        authorityGuarantee: DefaultGatewayAuthorityGuarantee,
        timestamp: new Date().toISOString()
      });
    },

    /**
     * Internal: Executes provider call with bounded transport retries
     */
    async _executeWithRetry({
      requestId,
      targetProviderId,
      prompt,
      agentRole,
      systemPrompt,
      constraints,
      metadata,
      timeoutMs,
      maxRetries,
      retryDelayMs,
      tenantId,
      workspaceId
    }) {
      const adapter = authoritativeRegistry.getProvider(targetProviderId, { tenantId, workspaceId });
      let attempts = 0;
      let lastError = null;

      const effectiveTimeout = (typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0)
        ? Math.min(timeoutMs, 120000)
        : 15000;

      while (attempts <= maxRetries) {
        attempts += 1;
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), effectiveTimeout);

        try {
          let rawOutput = null;
          if (typeof adapter.invoke === 'function') {
            rawOutput = await adapter.invoke({
              prompt,
              agentRole,
              systemPrompt,
              constraints,
              metadata,
              signal: controller.signal
            });
          } else if (typeof adapter.generate === 'function') {
            rawOutput = await adapter.generate(prompt);
          } else if (typeof adapter.chat === 'function') {
            rawOutput = await adapter.chat({ task: prompt });
          }

          clearTimeout(timeoutHandle);

          // Success: parse and normalize output
          return this._normalizeResponse({
            requestId,
            providerId: targetProviderId,
            adapter,
            rawOutput,
            attempts
          });
        } catch (err) {
          clearTimeout(timeoutHandle);
          lastError = err;

          const isAbort = err.name === 'AbortError' || err.code === 'TIMEOUT';
          const isRateLimit = err.status === 429 || err.code === 'RATE_LIMITED';
          const isServerError = err.status >= 500 && err.status < 600;

          // Non-retriable: client errors (400, 401, 403, 404), unconfigured credentials, or security blocks
          if (err.code === 'CREDENTIALS_UNCONFIGURED' || (err.status >= 400 && err.status < 500 && err.status !== 429)) {
            break;
          }

          // If retries remain and error is transient
          if (attempts <= maxRetries && (isAbort || isRateLimit || isServerError || err.name === 'FetchError')) {
            let delay = retryDelayMs * Math.pow(2, attempts - 1);
            if (isRateLimit && err.retryAfter) {
              delay = Math.min(err.retryAfter * 1000, 5000);
            }
            await new Promise(r => setTimeout(r, delay));
            continue;
          }

          break;
        }
      }

      // Propagate sanitized failure
      const sanitized = sanitizeError(lastError || new Error(`Provider '${targetProviderId}' failed after ${attempts} attempts`));
      sanitized.attempts = attempts;
      throw sanitized;
    },

    /**
     * Internal: Normalizes raw AI output into safe structured contract
     */
    _normalizeResponse({ requestId, providerId, adapter, rawOutput, attempts }) {
      if (!rawOutput || typeof rawOutput !== 'object') {
        throw new Error(`Invalid non-object response from provider '${providerId}'`);
      }

      // Check for illegal authority escalation attempts by provider
      const authorityBreachAttempted = Boolean(
        rawOutput.executionAuthorized === true ||
        rawOutput.proposalOnly === false ||
        rawOutput.mutationAuthorized === true ||
        rawOutput.deploymentAuthorized === true ||
        rawOutput.networkAuthorized === true ||
        rawOutput.shellAuthorized === true
      );

      // Strip any malicious authority escalation in output
      const cleanContent = typeof rawOutput.rawContent === 'string' ? sanitizeString(rawOutput.rawContent) : '';
      const rationale = typeof rawOutput.rationale === 'string' ? sanitizeString(rawOutput.rationale) : '';

      const rawCost = rawOutput.cost;
      const canonicalCost = rawCost ? Object.freeze({
        ...rawCost,
        amount: rawCost.amount !== undefined ? rawCost.amount : (rawCost.estimatedCostUsd !== null && rawCost.estimatedCostUsd !== undefined ? rawCost.estimatedCostUsd : 0),
        currency: rawCost.currency || 'USD',
        source: rawCost.source || (rawCost.pricingKnown ? 'calculated' : 'estimated')
      }) : Object.freeze({
        amount: 0,
        currency: 'USD',
        source: 'unreported',
        estimatedCostUsd: 0
      });

      return {
        requestId,
        provider: providerId,
        providerId,
        model: rawOutput.model || adapter.model || 'unknown',
        status: GatewayInvocationStatus.SUCCESS,
        rationale,
        authorityBreachAttempted,
        output: rawOutput.output !== undefined ? rawOutput.output : (cleanContent || rationale),
        operations: Array.isArray(rawOutput.operations) ? rawOutput.operations : [],
        proposedFiles: Array.isArray(rawOutput.proposedFiles) ? rawOutput.proposedFiles : [],
        proposedTests: Array.isArray(rawOutput.proposedTests) ? rawOutput.proposedTests : [],
        risks: Array.isArray(rawOutput.risks) ? rawOutput.risks : [],
        assumptions: Array.isArray(rawOutput.assumptions) ? rawOutput.assumptions : [],
        usage: rawOutput.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: canonicalCost,
        latencyMs: rawOutput.latencyMs || 0,
        finishReason: rawOutput.finishReason || 'stop',
        attempts,
        rawContent: cleanContent,
        requestedModel: rawOutput.requestedModel || null,
        actualModel: rawOutput.actualModel || null,
        modelVersion: rawOutput.modelVersion || null,
        isSubstituted: rawOutput.isSubstituted !== undefined ? Boolean(rawOutput.isSubstituted) : false,
        substitutionReason: rawOutput.substitutionReason || null,
        accountId: rawOutput.accountId || null
      };
    }
  });
}

/**
 * Normalizes any provider or gateway completion response into the canonical Phase 61 format
 */
export function normalizeCanonicalResponse(response, { traceId = null } = {}) {
  if (!response || typeof response !== 'object') return null;
  return Object.freeze({
    provider: response.provider || response.providerId || 'unknown',
    model: response.model || 'unknown',
    requestId: response.requestId || null,
    traceId: response.traceId || traceId || null,
    status: response.status || 'UNKNOWN',
    output: response.output || '',
    usage: {
      inputTokens: response.usage ? (response.usage.inputTokens || 0) : 0,
      outputTokens: response.usage ? (response.usage.outputTokens || 0) : 0,
      totalTokens: response.usage ? (response.usage.totalTokens || 0) : 0
    },
    cost: {
      amount: response.cost ? (response.cost.amount !== undefined ? response.cost.amount : (response.cost.estimatedCostUsd || 0)) : 0,
      currency: response.cost ? (response.cost.currency || 'USD') : 'USD',
      source: response.cost ? (response.cost.source || 'unreported') : 'unreported'
    },
    latencyMs: response.latencyMs || 0,
    finishReason: response.finishReason || 'stop',
    executionAuthorized: false,
    proposalOnly: true
  });
}

export const createAIProviderGateway = createProviderGateway;
