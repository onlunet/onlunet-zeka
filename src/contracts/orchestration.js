/**
 * AI Development OS - Orchestration Contract Foundation
 * Phase 2 - Pure Descriptive Orchestration Model (Zero Execution, Zero AI, Zero DB)
 */
import { ErrorCodes, AgentRoles } from './constants.js';

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

/**
 * Descriptive orchestration plan linking Workflow, Tasks, Agent assignments,
 * execution ordering, dependency graphs, approval gates, and validation criteria.
 */
export function createOrchestrationPlan({
  id,
  workflowId,
  projectId,
  tasks = [],
  taskDependencies = {},
  agentAssignments = {},
  approvalGates = [],
  validationCriteria = {},
  metadata = {}
}) {
  validateRequired({ id, workflowId, projectId }, ['id', 'workflowId', 'projectId'], 'OrchestrationPlan');

  // Validate tasks array
  if (!Array.isArray(tasks)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] OrchestrationPlan tasks must be an array`);
  }

  // Validate agent assignments conform to official roles if specified
  const validRoles = Object.values(AgentRoles);
  for (const [taskId, role] of Object.entries(agentAssignments)) {
    if (!validRoles.includes(role)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid agent role '${role}' for task '${taskId}'`);
    }
  }

  // Validate dependency references exist in tasks list
  const taskIds = new Set(tasks.map(t => typeof t === 'string' ? t : t.id));
  for (const [taskId, deps] of Object.entries(taskDependencies)) {
    if (!taskIds.has(taskId)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Dependency defined for unknown task: ${taskId}`);
    }
    if (Array.isArray(deps)) {
      for (const dep of deps) {
        if (!taskIds.has(dep)) {
          throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Task '${taskId}' depends on unknown task: ${dep}`);
        }
        if (dep === taskId) {
          throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Circular self-dependency detected for task: ${taskId}`);
        }
      }
    }
  }

  return Object.freeze({
    id,
    workflowId,
    projectId,
    tasks: Object.freeze([...tasks]),
    taskDependencies: Object.freeze(
      Object.fromEntries(
        Object.entries(taskDependencies).map(([k, v]) => [k, Object.freeze([...v])])
      )
    ),
    agentAssignments: Object.freeze({ ...agentAssignments }),
    approvalGates: Object.freeze([...approvalGates]),
    validationCriteria: Object.freeze({ ...validationCriteria }),
    metadata: Object.freeze({ ...metadata })
  });
}

/**
 * Pure helper to compute topological task execution order based on dependencies.
 * Zero side effect, pure descriptive validation.
 */
export function resolveExecutionOrder(orchestrationPlan) {
  if (!orchestrationPlan || !orchestrationPlan.tasks) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] resolveExecutionOrder requires valid OrchestrationPlan`);
  }

  const taskIds = orchestrationPlan.tasks.map(t => typeof t === 'string' ? t : t.id);
  const deps = orchestrationPlan.taskDependencies || {};

  const visited = new Set();
  const visiting = new Set();
  const order = [];

  function visit(taskId) {
    if (visiting.has(taskId)) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Circular dependency detected involving task: ${taskId}`);
    }
    if (!visited.has(taskId)) {
      visiting.add(taskId);
      const taskDeps = deps[taskId] || [];
      for (const dep of taskDeps) {
        visit(dep);
      }
      visiting.delete(taskId);
      visited.add(taskId);
      order.push(taskId);
    }
  }

  for (const taskId of taskIds) {
    if (!visited.has(taskId)) {
      visit(taskId);
    }
  }

  return Object.freeze(order);
}
