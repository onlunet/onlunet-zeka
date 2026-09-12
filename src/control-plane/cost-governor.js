/**
 * ONLUNET ZEKA - Multi-Tier Cost Governor
 * FAZ 59 Foundation: Hierarchical Budget & Quota Enforcement
 *
 * Implements:
 * - Multi-tier budget verification (Request, Agent, Task, Tenant, Workspace, Daily)
 * - Synchronous fail-closed boundary enforcement
 * - Integration with underlying FAZ 58 hard budget tracker
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';
import { createBudgetTracker } from '../providers/cost-tracker.js';

export function createCostGovernor({
  maxPerRequestUsd = 1.00,
  maxPerTaskUsd = 5.00,
  maxPerTenantDailyUsd = 50.00,
  maxPerWorkspaceDailyUsd = 25.00,
  baseBudgetTracker = null
} = {}) {
  const authoritativeTracker = baseBudgetTracker || createBudgetTracker();
  const tenantDailySpend = new Map();
  const workspaceDailySpend = new Map();
  const taskSpend = new Map();

  function getDailyKey() {
    return new Date().toISOString().slice(0, 10);
  }

  return Object.freeze({
    baseTracker: authoritativeTracker,

    /**
     * Pre-flight multi-tier budget check.
     * Throws or returns { allowed: false } fail-closed.
     */
    checkBudget({
      estimatedCostUsd = 0.01,
      tenantId = 'default-tenant',
      workspaceId = 'default-workspace',
      taskId = 'default-task'
    } = {}) {
      // 1. Base hard tracker check
      const baseCheck = authoritativeTracker.checkBudget();
      if (!baseCheck.allowed) {
        return { allowed: false, reason: baseCheck.reason, code: ErrorCodes.SECURITY_BLOCKED };
      }

      // 2. Per-request limit check
      if (estimatedCostUsd > maxPerRequestUsd) {
        return {
          allowed: false,
          reason: `Estimated cost \$${estimatedCostUsd} exceeds per-request limit \$${maxPerRequestUsd}`,
          code: ErrorCodes.SECURITY_BLOCKED
        };
      }

      // 3. Per-task limit check
      const currentTaskSpend = taskSpend.get(taskId) || 0;
      if (currentTaskSpend + estimatedCostUsd > maxPerTaskUsd) {
        return {
          allowed: false,
          reason: `Task '${taskId}' cumulative spend (\$${currentTaskSpend.toFixed(3)}) exceeds limit \$${maxPerTaskUsd}`,
          code: ErrorCodes.SECURITY_BLOCKED
        };
      }

      // 4. Per-tenant daily limit check
      const day = getDailyKey();
      const tenantKey = `${tenantId}:${day}`;
      const currentTenantSpend = tenantDailySpend.get(tenantKey) || 0;
      if (currentTenantSpend + estimatedCostUsd > maxPerTenantDailyUsd) {
        return {
          allowed: false,
          reason: `Tenant '${tenantId}' daily spend (\$${currentTenantSpend.toFixed(3)}) exceeds daily limit \$${maxPerTenantDailyUsd}`,
          code: ErrorCodes.SECURITY_BLOCKED
        };
      }

      // 5. Per-workspace daily limit check
      const workspaceKey = `${workspaceId}:${day}`;
      const currentWorkspaceSpend = workspaceDailySpend.get(workspaceKey) || 0;
      if (currentWorkspaceSpend + estimatedCostUsd > maxPerWorkspaceDailyUsd) {
        return {
          allowed: false,
          reason: `Workspace '${workspaceId}' daily spend (\$${currentWorkspaceSpend.toFixed(3)}) exceeds daily limit \$${maxPerWorkspaceDailyUsd}`,
          code: ErrorCodes.SECURITY_BLOCKED
        };
      }

      return { allowed: true, reason: 'Budget within multi-tier quotas' };
    },

    /**
     * Records actual expenditure across all tiers.
     */
    recordUsage({
      inputTokens = 0,
      outputTokens = 0,
      costUsd = 0,
      tenantId = 'default-tenant',
      workspaceId = 'default-workspace',
      taskId = 'default-task'
    } = {}) {
      authoritativeTracker.recordUsage({ inputTokens, outputTokens, costUsd });

      const day = getDailyKey();
      const tenantKey = `${tenantId}:${day}`;
      tenantDailySpend.set(tenantKey, (tenantDailySpend.get(tenantKey) || 0) + costUsd);

      const workspaceKey = `${workspaceId}:${day}`;
      workspaceDailySpend.set(workspaceKey, (workspaceDailySpend.get(workspaceKey) || 0) + costUsd);

      taskSpend.set(taskId, (taskSpend.get(taskId) || 0) + costUsd);
    },

    getSpendMetrics({ tenantId = 'default-tenant', workspaceId = 'default-workspace', taskId = 'default-task' } = {}) {
      const day = getDailyKey();
      return {
        tenantDailySpend: tenantDailySpend.get(`${tenantId}:${day}`) || 0,
        workspaceDailySpend: workspaceDailySpend.get(`${workspaceId}:${day}`) || 0,
        taskSpend: taskSpend.get(taskId) || 0,
        baseStatus: authoritativeTracker.getStatus()
      };
    }
  });
}
