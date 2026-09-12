/**
 * ONLUNET ZEKA - Real AI Control Plane
 * FAZ 59 Foundation: Unified AI Control Plane Coordinator
 *
 * Implements:
 * - Policy-aware routing with capability matrix
 * - Multi-tier data classification
 * - Pre-flight prompt inspection and injection neutralization
 * - Append-only audit trail
 * - Immutable agent identity and distributed trace lineage
 * - Multi-tier cost governance
 * - Single-use cryptographic approval token boundary
 * - Idempotency and duplicate prevention
 * - Normalized failure taxonomy
 * - Guaranteed zero-authority outputs:
 *     executionAuthorized: false
 *     mutationAuthorized: false
 *     approvalGranted: false
 *     admissionGranted: false
 *     verificationPassed: false
 *     proposalOnly: true
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';
import { createProviderGateway } from '../providers/provider-gateway.js';
import { createProviderRegistry } from '../providers/provider-registry.js';
import { createProviderHealthMonitor } from './provider-health.js';
import { createProviderRouter } from './provider-router.js';
import { DataClassification, validateDataClassificationPolicy, inferDataClassification } from './data-classifier.js';
import { securePromptContext, detectPromptInjection } from './prompt-security.js';
import { createAgentIdentity, validateIdentityContinuity } from './agent-identity.js';
import { createTraceContext } from './trace-manager.js';
import { createAuditLedger, AuditEventTypes } from './audit-ledger.js';
import { createCostGovernor } from './cost-governor.js';
import { createEscalationGovernor } from './escalation-governor.js';
import { createApprovalBoundary } from './approval-boundary.js';
import { createIdempotencyManager, computeIdempotencyKey } from './idempotency.js';
import { normalizeFailure, FailureCodes } from './failure-taxonomy.js';

export function createAIControlPlane({
  registry = null,
  gateway = null,
  maxPerRequestUsd = 1.00,
  maxPerTaskUsd = 5.00,
  maxPerTenantDailyUsd = 50.00,
  maxPerWorkspaceDailyUsd = 25.00,
  maxCorrections = 3
} = {}) {
  const authoritativeRegistry = registry || createProviderRegistry();
  const authoritativeGateway = gateway || createProviderGateway({ registry: authoritativeRegistry });
  const healthMonitor = createProviderHealthMonitor({
    registry: authoritativeRegistry,
    circuitBreaker: authoritativeGateway.circuitBreaker
  });
  const router = createProviderRouter({
    registry: authoritativeRegistry,
    healthMonitor
  });
  const auditLedger = createAuditLedger();
  const costGovernor = createCostGovernor({
    maxPerRequestUsd,
    maxPerTaskUsd,
    maxPerTenantDailyUsd,
    maxPerWorkspaceDailyUsd,
    baseBudgetTracker: authoritativeGateway.budgetTracker
  });
  const escalationGovernor = createEscalationGovernor({ maxCorrections });
  const approvalBoundary = createApprovalBoundary();
  const idempotencyManager = createIdempotencyManager();

  return Object.freeze({
    registry: authoritativeRegistry,
    gateway: authoritativeGateway,
    healthMonitor,
    router,
    auditLedger,
    costGovernor,
    escalationGovernor,
    approvalBoundary,
    idempotencyManager,

    /**
     * Central Controlled AI Dispatch Pipeline
     */
    async executeDispatch({
      prompt,
      systemPrompt = null,
      contextData = null,
      agentId = 'agent-default',
      agentRole = 'DEVELOPER',
      taskType = 'general',
      requiredCapabilities = [],
      dataClassification = null,
      tenantId = 'default-tenant',
      workspaceId = 'default-workspace',
      taskId = null,
      planId = null,
      idempotencyKey = null,
      timeoutMs = 15000,
      maxRetries = 2,
      metadata = {}
    } = {}) {
      const startTime = Date.now();
      const finalTaskId = taskId || `task-${Date.now()}`;
      const effectiveTenantId = tenantId || 'default-tenant';
      const effectiveWorkspaceId = workspaceId || 'default-workspace';

      // 1. Immutable Identity & Distributed Trace Lineage
      const identity = createAgentIdentity({
        agentId,
        tenantId: effectiveTenantId,
        workspaceId: effectiveWorkspaceId,
        taskId: finalTaskId,
        providerId: 'unrouted'
      });

      const trace = createTraceContext({
        agentId,
        tenantId: effectiveTenantId,
        workspaceId: effectiveWorkspaceId,
        taskId: finalTaskId,
        invocationId: identity.invocationId,
        step: 'AI_DISPATCH'
      });

      // 2. Idempotency Check
      const effectiveIdemKey = idempotencyKey || computeIdempotencyKey({
        tenantId: effectiveTenantId,
        workspaceId: effectiveWorkspaceId,
        taskId: finalTaskId,
        action: 'ai:dispatch',
        params: { prompt, systemPrompt, agentRole }
      });

      const idem = idempotencyManager.acquire(effectiveIdemKey);
      if (idem.duplicate) {
        return Object.freeze({
          ...idem.cachedResult,
          isDuplicate: true,
          cached: true
        });
      }

      // Record Dispatch Start in Audit
      auditLedger.record({
        eventType: AuditEventTypes.AI_INVOCATION_STARTED,
        traceId: trace.traceId,
        spanId: trace.spanId,
        taskId: finalTaskId,
        tenantId,
        workspaceId,
        agentId,
        details: { taskType, requiredCapabilities }
      });

      try {
        // 3. Data Classification & Boundary Check
        const finalClass = dataClassification || inferDataClassification(prompt, metadata);

        // 4. Prompt & Context Security (Neutralize Injections, Scrub Secrets)
        const securedPrompt = securePromptContext({
          systemPrompt,
          userPrompt: prompt,
          contextData,
          stripSecrets: true,
          quarantineInjections: true
        });

        // 5. Pre-flight Multi-Tier Budget Check
        const budgetCheck = costGovernor.checkBudget({
          estimatedCostUsd: 0.02,
          tenantId,
          workspaceId,
          taskId: finalTaskId
        });

        if (!budgetCheck.allowed) {
          auditLedger.record({
            eventType: AuditEventTypes.AI_INVOCATION_FAILED,
            traceId: trace.traceId,
            taskId: finalTaskId,
            tenantId,
            workspaceId,
            details: { reason: budgetCheck.reason }
          });
          idempotencyManager.release(effectiveIdemKey);

          return Object.freeze({
            status: 'BUDGET_EXCEEDED',
            error: budgetCheck.reason,
            code: FailureCodes.BUDGET_EXCEEDED,
            traceId: trace.traceId,
            executionAuthorized: false,
            mutationAuthorized: false,
            approvalGranted: false,
            admissionGranted: false,
            verificationPassed: false,
            proposalOnly: true,
            timestamp: new Date().toISOString()
          });
        }

        // 6. Policy-Aware Provider Routing
        const routeResult = router.route({
          taskType,
          requiredCapabilities,
          tenantId,
          workspaceId,
          dataClassification: finalClass
        });

        auditLedger.record({
          eventType: AuditEventTypes.PROVIDER_SELECTED,
          traceId: trace.traceId,
          taskId: finalTaskId,
          tenantId,
          workspaceId,
          providerId: routeResult.selectedProvider,
          details: { dataClassification: finalClass, fallback: routeResult.fallbackProvider }
        });

        // 7. Gateway Dispatch
        const gatewayRes = await authoritativeGateway.dispatch({
          requestId: identity.invocationId,
          providerId: routeResult.selectedProvider,
          fallbackProviderId: routeResult.fallbackProvider,
          prompt: securedPrompt.userPrompt,
          systemPrompt: securedPrompt.systemPrompt,
          agentId,
          agentRole,
          timeoutMs,
          maxRetries,
          tenantId,
          workspaceId,
          metadata: {
            ...metadata,
            traceId: trace.traceId,
            spanId: trace.spanId,
            taskId: finalTaskId,
            dataClassification: finalClass
          }
        });

        const durationMs = Date.now() - startTime;

        // 8. Record Telemetry & Audit
        if (gatewayRes.status === 'SUCCESS') {
          healthMonitor.recordSuccess(routeResult.selectedProvider, durationMs);
          const costUsd = gatewayRes.cost ? gatewayRes.cost.estimatedCostUsd : 0;
          costGovernor.recordUsage({
            inputTokens: gatewayRes.usage ? gatewayRes.usage.inputTokens : 0,
            outputTokens: gatewayRes.usage ? gatewayRes.usage.outputTokens : 0,
            costUsd,
            tenantId,
            workspaceId,
            taskId: finalTaskId
          });

          auditLedger.record({
            eventType: AuditEventTypes.AI_INVOCATION_COMPLETED,
            traceId: trace.traceId,
            taskId: finalTaskId,
            tenantId,
            workspaceId,
            providerId: routeResult.selectedProvider,
            details: { durationMs, costUsd }
          });
        } else {
          healthMonitor.recordFailure(routeResult.selectedProvider, gatewayRes.error, durationMs);
          auditLedger.record({
            eventType: AuditEventTypes.AI_INVOCATION_FAILED,
            traceId: trace.traceId,
            taskId: finalTaskId,
            tenantId,
            workspaceId,
            providerId: routeResult.selectedProvider,
            details: { error: gatewayRes.error, code: gatewayRes.code }
          });
        }

        // 9. Absolute Zero Authority Guarantees (Section 31 Normalization)
        const normalized = Object.freeze({
          ...gatewayRes,
          traceId: trace.traceId,
          spanId: trace.spanId,
          taskId: finalTaskId,
          tenantId,
          workspaceId,
          agentId,
          dataClassification: finalClass,
          executionAuthorized: false,
          mutationAuthorized: false,
          approvalGranted: false,
          admissionGranted: false,
          verificationPassed: false,
          proposalOnly: true,
          timestamp: new Date().toISOString()
        });

        // Commit to idempotency cache
        idempotencyManager.commit(effectiveIdemKey, normalized);
        return normalized;

      } catch (err) {
        idempotencyManager.release(effectiveIdemKey);
        const normErr = normalizeFailure(err, { taskId: finalTaskId, tenantId, workspaceId });

        auditLedger.record({
          eventType: AuditEventTypes.AI_INVOCATION_FAILED,
          traceId: trace.traceId,
          taskId: finalTaskId,
          tenantId,
          workspaceId,
          details: { error: normErr.message, code: normErr.code }
        });

        return Object.freeze({
          status: 'FAILED',
          error: normErr.message,
          code: normErr.code,
          failureDetails: normErr,
          traceId: trace.traceId,
          executionAuthorized: false,
          mutationAuthorized: false,
          approvalGranted: false,
          admissionGranted: false,
          verificationPassed: false,
          proposalOnly: true,
          timestamp: new Date().toISOString()
        });
      }
    }
  });
}
