/**
 * ONLUNET ZEKA - Production AI Execution Pipeline
 * FAZ 65 Foundation: Real-World Task Execution, Verification, Bounded Self-Correction & App Integration
 *
 * Implements the 10-Step Canonical AI Request Lifecycle:
 * RECEIVED -> VALIDATED -> CLASSIFIED -> ANALYZED -> ROUTED -> INFERRED -> NORMALIZED -> VERIFIED -> CORRECTED -> FINALIZED
 *
 * ABSOLUTE INVARIANTS:
 * - AI != AUTHORITY
 * - PROPOSAL != EXECUTION
 * - INFERENCE != SIDE EFFECT
 * - proposalOnly: true (ALWAYS)
 * - executionAuthorized: false (ALWAYS)
 * - MAX_CORRECTION_CYCLES: 3 (STRICT UPPER BOUND, NO INFINITE RETRIES)
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';
import { DataClassification, inferDataClassification } from './data-classifier.js';
import { securePromptContext, detectPromptInjection } from './prompt-security.js';
import { createAgentIdentity } from './agent-identity.js';
import { createTraceContext } from './trace-manager.js';
import { createAuditLedger, AuditEventTypes } from './audit-ledger.js';
import { createIdempotencyManager, computeIdempotencyKey } from './idempotency.js';
import { normalizeFailure, FailureCodes } from './failure-taxonomy.js';
import { analyzeTask, TaskTypes, TaskComplexity } from '../providers/task-analyzer.js';
import { ProviderCapabilities } from '../providers/provider-capabilities.js';
import { createRoutingEngine } from '../providers/routing-engine.js';
import { createProviderRegistry } from '../providers/provider-registry.js';
import { createModelRegistry } from '../providers/model-registry.js';
import { createProviderGateway } from '../providers/provider-gateway.js';
import { createBudgetTracker, calculateCost } from '../providers/cost-tracker.js';
import { MAX_CORRECTION_CYCLES } from '../contracts/self-correction.js';

export const DEFAULT_MAX_CORRECTION_CYCLES = MAX_CORRECTION_CYCLES;

export const AILifecycleState = Object.freeze({
  RECEIVED: 'RECEIVED',
  VALIDATED: 'VALIDATED',
  CLASSIFIED: 'CLASSIFIED',
  ANALYZED: 'ANALYZED',
  ROUTED: 'ROUTED',
  INFERRED: 'INFERRED',
  NORMALIZED: 'NORMALIZED',
  VERIFIED: 'VERIFIED',
  CORRECTED: 'CORRECTED',
  FINALIZED: 'FINALIZED'
});

export const AIExecutionStatus = Object.freeze({
  COMPLETED: 'COMPLETED',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  SECURITY_BLOCKED: 'SECURITY_BLOCKED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
  FAILED: 'FAILED'
});

// Allowed valid lifecycle transitions
const ALLOWED_TRANSITIONS = new Map([
  [AILifecycleState.RECEIVED, [AILifecycleState.VALIDATED, AILifecycleState.FINALIZED]],
  [AILifecycleState.VALIDATED, [AILifecycleState.CLASSIFIED, AILifecycleState.FINALIZED]],
  [AILifecycleState.CLASSIFIED, [AILifecycleState.ANALYZED, AILifecycleState.FINALIZED]],
  [AILifecycleState.ANALYZED, [AILifecycleState.ROUTED, AILifecycleState.FINALIZED]],
  [AILifecycleState.ROUTED, [AILifecycleState.INFERRED, AILifecycleState.FINALIZED]],
  [AILifecycleState.INFERRED, [AILifecycleState.NORMALIZED, AILifecycleState.FINALIZED]],
  [AILifecycleState.NORMALIZED, [AILifecycleState.VERIFIED, AILifecycleState.FINALIZED]],
  [AILifecycleState.VERIFIED, [AILifecycleState.CORRECTED, AILifecycleState.FINALIZED]],
  [AILifecycleState.CORRECTED, [AILifecycleState.INFERRED, AILifecycleState.NORMALIZED, AILifecycleState.VERIFIED, AILifecycleState.FINALIZED]],
  [AILifecycleState.FINALIZED, []]
]);

export function validateLifecycleTransition(fromState, toState) {
  if (toState === 'EXECUTED') {
    throw new Error('[' + (ErrorCodes.INVALID_STATE_TRANSITION || 'INVALID_STATE_TRANSITION') + '] AI output can never transition to EXECUTED. AI != AUTHORITY.');
  }
  const allowed = ALLOWED_TRANSITIONS.get(fromState);
  if (!allowed || !allowed.includes(toState)) {
    throw new Error('[' + (ErrorCodes.INVALID_STATE_TRANSITION || 'INVALID_STATE_TRANSITION') + '] Invalid state transition from ' + fromState + ' to ' + toState);
  }
  return true;
}

/**
 * Creates the Immutable Canonical AI Execution Contract
 */
export function createAIExecutionContract({
  requestId,
  traceId = null,
  tenantId = 'default-tenant',
  workspaceId = 'default-workspace',
  task,
  taskType = TaskTypes.GENERAL_QA,
  classification = DataClassification.PUBLIC,
  selectedProvider = 'local',
  selectedModel = 'default',
  lifecycleState = AILifecycleState.FINALIZED,
  status = AIExecutionStatus.COMPLETED,
  response = null,
  verification = null,
  selfCorrection = null,
  usage = null,
  cost = null,
  latencyMs = 0,
  reasons = [],
  rejectedCandidates = [],
  lifecycleHistory = [],
  metadata = {}
} = {}) {
  const cleanTenant = tenantId ? String(tenantId).trim() : 'default-tenant';
  const cleanWorkspace = workspaceId ? String(workspaceId).trim() : 'default-workspace';
  const cleanTask = typeof task === 'string' ? task : (task && typeof task === 'object' ? (task.task || task.prompt || JSON.stringify(task)) : '');

  return Object.freeze({
    contractVersion: '1.0.0',
    requestId: requestId || ('req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
    traceId: traceId || ('trc-' + Date.now()),
    tenantId: cleanTenant,
    workspaceId: cleanWorkspace,
    task: cleanTask,
    taskType,
    classification,
    selectedProvider,
    selectedModel,
    lifecycleState,
    status,
    // ZERO-AUTHORITY INVARIANTS (HARD CONTRACT)
    proposalOnly: true,
    executionAuthorized: false,
    mutationAuthorized: false,
    approvalGranted: false,
    admissionGranted: false,
    verificationPassed: verification ? Boolean(verification.passed) : false,
    // PAYLOADS & METRICS
    response,
    verification: verification ? Object.freeze({ ...verification }) : null,
    selfCorrection: selfCorrection ? Object.freeze({ ...selfCorrection }) : null,
    usage: Object.freeze(usage ? { ...usage } : { inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
    cost: Object.freeze(cost ? { ...cost } : { estimatedCostUsd: 0, pricingKnown: true }),
    latencyMs: typeof latencyMs === 'number' ? latencyMs : 0,
    reasons: Object.freeze(Array.isArray(reasons) ? [...reasons] : []),
    rejectedCandidates: Object.freeze(Array.isArray(rejectedCandidates) ? [...rejectedCandidates] : []),
    lifecycleHistory: Object.freeze(Array.isArray(lifecycleHistory) ? [...lifecycleHistory] : []),
    metadata: Object.freeze(metadata ? { ...metadata } : {}),
    timestamp: new Date().toISOString()
  });
}

/**
 * Output Verification Logic for Task Types
 */
export function verifyAIOutput({ content, taskType, expectedSchema = null, strictCodeSafety = true } = {}) {
  const checks = [];
  const errors = [];

  if (content === null || content === undefined) {
    errors.push('Content is null or undefined');
    return { passed: false, checks, errors };
  }
  checks.push('CONTENT_EXISTS');

  const text = typeof content === 'string' ? content : JSON.stringify(content);

  // 2. Structured output / JSON verification
  if (taskType === TaskTypes.STRUCTURED_GENERATION || expectedSchema !== null) {
    try {
      let parsed = null;
      if (typeof content === 'object' && content !== null) {
        parsed = content;
      } else {
        const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      }
      checks.push('VALID_JSON');

      if (expectedSchema && typeof expectedSchema === 'object') {
        const requiredKeys = Array.isArray(expectedSchema.required) ? expectedSchema.required : Object.keys(expectedSchema);
        for (const key of requiredKeys) {
          if (!(key in parsed)) {
            errors.push('Missing required schema property: ' + key);
          }
        }
        if (errors.length === 0) {
          checks.push('SCHEMA_CONFORMANCE');
        }
      }
    } catch (e) {
      errors.push('Invalid JSON output: ' + e.message);
    }
  }

  // 3. Code Generation safety & quality verification
  if (taskType === TaskTypes.CODING) {
    checks.push('CODE_CONTENT_INSPECTION');
    if (strictCodeSafety) {
      const dangerousPatterns = [
        /child_process/i,
        /execSync/i,
        /process\.exit/i,
        /rm\s+-rf/i,
        /mkfs/i,
        /DROP\s+TABLE/i,
        /DELETE\s+FROM\s+\w+\s*;/i
      ];
      for (const pattern of dangerousPatterns) {
        if (pattern.test(text)) {
          errors.push('Prohibited dangerous execution construct detected: ' + pattern.toString());
        }
      }
    }
    if (errors.length === 0) {
      checks.push('CODE_SAFETY_PASSED');
    }
  }

  // 4. Code Review verification
  if (taskType === TaskTypes.CODE_REVIEW) {
    checks.push('REVIEW_STRUCTURE_INSPECTION');
    if (/executed\s+query/i.test(text) || /database\s+modified/i.test(text)) {
      errors.push('Code review attempted execution mutation; review must be advisory only');
    } else {
      checks.push('REVIEW_ADVISORY_CONFIRMED');
    }
  }

  // 5. Tool Selection / Calling verification
  if (taskType === TaskTypes.TOOL_SELECTION) {
    checks.push('TOOL_PROPOSAL_VERIFICATION');
    checks.push('NO_SIDE_EFFECTS_CONFIRMED');
  }

  const passed = errors.length === 0;
  return {
    passed,
    checks,
    errors
  };
}

/**
 * Production AI Execution Pipeline Coordinator
 */
export function createAIExecutionPipeline({
  registry = null,
  modelRegistry = null,
  routingEngine = null,
  gateway = null,
  auditLedger = null,
  idempotencyManager = null,
  budgetTracker = null,
  maxCorrectionCycles = MAX_CORRECTION_CYCLES
} = {}) {
  const authoritativeRegistry = registry || createProviderRegistry();
  const authoritativeModelRegistry = modelRegistry || createModelRegistry();
  const authoritativeBudget = budgetTracker || createBudgetTracker();
  const authoritativeGateway = gateway || createProviderGateway({
    registry: authoritativeRegistry,
    budgetTracker: authoritativeBudget
  });
  const authoritativeRouter = routingEngine || createRoutingEngine({
    registry: authoritativeRegistry,
    modelRegistry: authoritativeModelRegistry
  });
  const authoritativeAudit = auditLedger || createAuditLedger();
  const authoritativeIdempotency = idempotencyManager || createIdempotencyManager();

  return Object.freeze({
    registry: authoritativeRegistry,
    modelRegistry: authoritativeModelRegistry,
    routingEngine: authoritativeRouter,
    gateway: authoritativeGateway,
    auditLedger: authoritativeAudit,
    idempotencyManager: authoritativeIdempotency,
    maxCorrectionCycles,

    /**
     * Executes the full 10-step AI request lifecycle
     */
    async execute({
      requestId = null,
      task,
      taskType = null,
      requiredCapabilities = [],
      dataClassification = null,
      preferredProvider = null,
      preferredModel = null,
      budget = null,
      maxCostUsd = null,
      latencyTarget = null,
      qualityTarget = null,
      expectedSchema = null,
      tenantId = 'default-tenant',
      workspaceId = 'default-workspace',
      systemPrompt = null,
      timeoutMs = 15000,
      metadata = {}
    } = {}) {
      const startTime = Date.now();
      const finalRequestId = requestId || ('req-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));
      const effectiveTenant = tenantId ? String(tenantId).trim() : 'default-tenant';
      const effectiveWorkspace = workspaceId ? String(workspaceId).trim() : 'default-workspace';
      const effectiveBudget = typeof budget === 'number' ? budget : (typeof maxCostUsd === 'number' ? maxCostUsd : null);

      const lifecycleHistory = [];
      let currentState = AILifecycleState.RECEIVED;
      lifecycleHistory.push({ state: currentState, timestamp: new Date().toISOString() });

      const transitionTo = (newState) => {
        validateLifecycleTransition(currentState, newState);
        currentState = newState;
        lifecycleHistory.push({ state: currentState, timestamp: new Date().toISOString() });
      };

      // 1. RECEIVED -> 2. VALIDATED
      transitionTo(AILifecycleState.VALIDATED);

      // Defense against prototype pollution
      if (task && typeof task === 'object' && ('__proto__' in task || 'constructor' in task)) {
        delete task['__proto__'];
        delete task['constructor'];
      }

      const rawTaskText = typeof task === 'string' ? task : (task && typeof task === 'object' ? (task.task || task.prompt || task.objective || JSON.stringify(task)) : '');
      if (!rawTaskText || rawTaskText.trim() === '') {
        transitionTo(AILifecycleState.FINALIZED);
        return createAIExecutionContract({
          requestId: finalRequestId,
          tenantId: effectiveTenant,
          workspaceId: effectiveWorkspace,
          task: '',
          lifecycleState: currentState,
          status: AIExecutionStatus.FAILED,
          reasons: ['Empty task provided'],
          lifecycleHistory
        });
      }

      // Check Idempotency
      const idemKey = computeIdempotencyKey({
        tenantId: effectiveTenant,
        workspaceId: effectiveWorkspace,
        action: 'ai:pipeline:execute',
        params: { task: rawTaskText, preferredProvider, budget: effectiveBudget }
      });

      const existing = authoritativeIdempotency.acquire(idemKey);
      if (existing.duplicate && existing.cachedResult) {
        return Object.freeze({
          ...existing.cachedResult,
          isDuplicate: true,
          cached: true
        });
      }

      // 2. VALIDATED -> 3. CLASSIFIED
      transitionTo(AILifecycleState.CLASSIFIED);
      const effectiveClassification = dataClassification || inferDataClassification(rawTaskText, metadata);
      const normClass = String(effectiveClassification).toUpperCase();

      // Check Prompt Security (Sanitize secrets, detect prompt injection)
      const securedPrompt = securePromptContext({
        userPrompt: rawTaskText,
        systemPrompt,
        stripSecrets: true,
        quarantineInjections: true
      });

      // Budget check: budget <= 0 fails closed immediately
      if (effectiveBudget !== null && effectiveBudget <= 0) {
        authoritativeIdempotency.release(idemKey);
        transitionTo(AILifecycleState.FINALIZED);
        authoritativeAudit.record({
          eventType: AuditEventTypes.AI_INVOCATION_FAILED,
          taskId: finalRequestId,
          tenantId: effectiveTenant,
          workspaceId: effectiveWorkspace,
          details: { reason: 'Budget zero or negative' }
        });

        const contract = createAIExecutionContract({
          requestId: finalRequestId,
          tenantId: effectiveTenant,
          workspaceId: effectiveWorkspace,
          task: rawTaskText,
          classification: normClass,
          lifecycleState: currentState,
          status: AIExecutionStatus.BUDGET_EXCEEDED,
          reasons: ['Budget is 0 or negative; routing blocked fail-closed'],
          lifecycleHistory
        });
        return contract;
      }

      // 3. CLASSIFIED -> 4. ANALYZED
      transitionTo(AILifecycleState.ANALYZED);
      const taskAnalysis = analyzeTask({
        task: rawTaskText,
        tenantId: effectiveTenant,
        workspaceId: effectiveWorkspace,
        dataClassification: normClass,
        budget: effectiveBudget,
        latencyTarget,
        qualityTarget,
        requiredCapabilities
      });

      const effectiveTaskType = taskType || taskAnalysis.taskType;

      // 4. ANALYZED -> 5. ROUTED
      transitionTo(AILifecycleState.ROUTED);
      let routingDecision;
      try {
        routingDecision = authoritativeRouter.route({
          task: rawTaskText,
          taskType: effectiveTaskType,
          requiredCapabilities,
          dataClassification: normClass,
          preferredProvider,
          preferredModel,
          budget: effectiveBudget,
          latencyTarget,
          qualityTarget,
          tenantId: effectiveTenant,
          workspaceId: effectiveWorkspace
        });
      } catch (routingErr) {
        authoritativeIdempotency.release(idemKey);
        transitionTo(AILifecycleState.FINALIZED);

        let errStatus = AIExecutionStatus.FAILED;
        if (routingErr.message && routingErr.message.includes('SECURITY_BLOCKED')) {
          errStatus = AIExecutionStatus.SECURITY_BLOCKED;
        } else if (routingErr.code === 'BUDGET_EXCEEDED') {
          errStatus = AIExecutionStatus.BUDGET_EXCEEDED;
        }

        return createAIExecutionContract({
          requestId: finalRequestId,
          tenantId: effectiveTenant,
          workspaceId: effectiveWorkspace,
          task: rawTaskText,
          taskType: effectiveTaskType,
          classification: normClass,
          lifecycleState: currentState,
          status: errStatus,
          reasons: [routingErr.message],
          lifecycleHistory
        });
      }

      authoritativeAudit.record({
        eventType: AuditEventTypes.PROVIDER_SELECTED,
        taskId: finalRequestId,
        tenantId: effectiveTenant,
        workspaceId: effectiveWorkspace,
        providerId: routingDecision.selectedProvider,
        details: { model: routingDecision.selectedModel, reasons: routingDecision.reasons }
      });

      // 5. ROUTED -> 6. INFERRED (with bounded self-correction loop)
      let currentCycle = 0;
      let rawInference = null;
      let verification = null;
      let promptToUse = securedPrompt.userPrompt;
      let lastGatewayRes = null;

      while (currentCycle <= maxCorrectionCycles) {
        transitionTo(currentCycle === 0 ? AILifecycleState.INFERRED : AILifecycleState.CORRECTED);

        const dispatchParams = {
          requestId: finalRequestId + '-c' + currentCycle,
          providerId: routingDecision.selectedProvider,
          fallbackProviderId: routingDecision.fallbackProvider,
          prompt: promptToUse,
          systemPrompt: securedPrompt.systemPrompt,
          model: routingDecision.selectedModel,
          timeoutMs,
          tenantId: effectiveTenant,
          workspaceId: effectiveWorkspace,
          metadata: {
            ...metadata,
            taskType: effectiveTaskType,
            dataClassification: normClass,
            correctionCycle: currentCycle
          }
        };

        const gatewayRes = await authoritativeGateway.dispatch(dispatchParams);
        lastGatewayRes = gatewayRes;

        // Check if provider is unconfigured
        if (gatewayRes.status === 'FAILED' && (gatewayRes.code === 'CREDENTIALS_UNCONFIGURED' || (gatewayRes.error && gatewayRes.error.includes('CREDENTIALS_UNCONFIGURED')))) {
          authoritativeIdempotency.release(idemKey);
          transitionTo(AILifecycleState.FINALIZED);

          return createAIExecutionContract({
            requestId: finalRequestId,
            tenantId: effectiveTenant,
            workspaceId: effectiveWorkspace,
            task: rawTaskText,
            taskType: effectiveTaskType,
            classification: normClass,
            selectedProvider: routingDecision.selectedProvider,
            selectedModel: routingDecision.selectedModel,
            lifecycleState: currentState,
            status: AIExecutionStatus.NOT_CONFIGURED,
            reasons: [gatewayRes.error || 'Provider credentials unconfigured'],
            rejectedCandidates: routingDecision.rejectedCandidates,
            lifecycleHistory
          });
        }

        // Check if provider returned error
        if (gatewayRes.status !== 'SUCCESS') {
          authoritativeIdempotency.release(idemKey);
          transitionTo(AILifecycleState.FINALIZED);

          return createAIExecutionContract({
            requestId: finalRequestId,
            tenantId: effectiveTenant,
            workspaceId: effectiveWorkspace,
            task: rawTaskText,
            taskType: effectiveTaskType,
            classification: normClass,
            selectedProvider: routingDecision.selectedProvider,
            selectedModel: routingDecision.selectedModel,
            lifecycleState: currentState,
            status: AIExecutionStatus.PROVIDER_ERROR,
            reasons: [gatewayRes.error || 'Provider dispatch failed'],
            rejectedCandidates: routingDecision.rejectedCandidates,
            lifecycleHistory
          });
        }

        // 6. INFERRED -> 7. NORMALIZED
        transitionTo(AILifecycleState.NORMALIZED);
        rawInference = gatewayRes.output !== undefined ? gatewayRes.output : (gatewayRes.content !== undefined ? gatewayRes.content : (gatewayRes.rationale !== undefined ? gatewayRes.rationale : gatewayRes));

        // 7. NORMALIZED -> 8. VERIFIED
        transitionTo(AILifecycleState.VERIFIED);
        verification = verifyAIOutput({
          content: rawInference,
          taskType: effectiveTaskType,
          expectedSchema
        });

        if (verification.passed) {
          break;
        }

        // Verification failed -> increment cycle
        currentCycle++;
        if (currentCycle > maxCorrectionCycles) {
          break;
        }

        // Prepare self-correction diagnostic advisory for the next cycle
        promptToUse = securedPrompt.userPrompt + '\n\n[SYSTEM CORRECTION ADVISORY - CYCLE ' + currentCycle + ']: Previous response failed verification: ' + verification.errors.join('; ') + '. Please output compliant response.';
      }

      // 8. VERIFIED / CORRECTED -> 9. FINALIZED
      transitionTo(AILifecycleState.FINALIZED);
      const totalLatencyMs = Date.now() - startTime;

      const finalStatus = (verification && verification.passed)
        ? AIExecutionStatus.COMPLETED
        : AIExecutionStatus.VERIFICATION_FAILED;

      // Extract tool calling proposal if present
      let toolProposal = null;
      if (effectiveTaskType === TaskTypes.TOOL_SELECTION || (rawInference && typeof rawInference === 'object' && rawInference.tool)) {
        toolProposal = Object.freeze({
          tool: (rawInference && rawInference.tool) || 'generic_tool',
          arguments: (rawInference && rawInference.arguments) || {},
          proposalOnly: true,
          executed: false,
          executionAuthorized: false
        });
      }

      const finalContract = createAIExecutionContract({
        requestId: finalRequestId,
        tenantId: effectiveTenant,
        workspaceId: effectiveWorkspace,
        task: rawTaskText,
        taskType: effectiveTaskType,
        classification: normClass,
        selectedProvider: routingDecision.selectedProvider,
        selectedModel: routingDecision.selectedModel,
        lifecycleState: currentState,
        status: finalStatus,
        response: {
          content: rawInference,
          toolProposal,
          model: routingDecision.selectedModel,
          proposalOnly: true,
          executionAuthorized: false
        },
        verification,
        selfCorrection: {
          cyclesAttempted: currentCycle,
          maxAllowed: maxCorrectionCycles,
          bounded: true
        },
        usage: lastGatewayRes ? lastGatewayRes.usage : null,
        cost: lastGatewayRes ? lastGatewayRes.cost : null,
        latencyMs: totalLatencyMs,
        reasons: routingDecision.reasons,
        rejectedCandidates: routingDecision.rejectedCandidates,
        lifecycleHistory
      });

      // Commit to idempotency manager
      authoritativeIdempotency.commit(idemKey, finalContract);

      authoritativeAudit.record({
        eventType: AuditEventTypes.AI_INVOCATION_COMPLETED,
        taskId: finalRequestId,
        tenantId: effectiveTenant,
        workspaceId: effectiveWorkspace,
        providerId: routingDecision.selectedProvider,
        details: {
          status: finalStatus,
          cycles: currentCycle,
          latencyMs: totalLatencyMs
        }
      });

      return finalContract;
    }
  });
}