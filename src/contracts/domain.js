/**
 * AI Development OS - Core Domain Contracts & Factory Functions
 * Phase 1 Foundation & Phase 1.1 Hardened Contract & Phase 2 Foundation
 */
import {
  ProjectState,
  JobState,
  TaskState,
  ApprovalState,
  ValidationResult,
  ErrorCodes,
  DecisionStatus,
  ValidProjectTransitions,
  ValidJobTransitions,
  ValidTaskTransitions
} from './constants.js';

function validateRequired(obj, fields, entityName) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] ${entityName} requires field: ${field}`);
    }
  }
}

export function createProject({
  id,
  name,
  description = '',
  status = ProjectState.DISCOVERY,
  blueprintId = null,
  brainId = null,
  requirements = [],
  constraints = [],
  nonGoals = [],
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString()
}) {
  validateRequired({ id, name }, ['id', 'name'], 'Project');
  if (!Object.values(ProjectState).includes(status)) {
    throw new Error(`[${ErrorCodes.INVALID_STATE_TRANSITION}] Invalid Project state: ${status}`);
  }
  return Object.freeze({
    id,
    name,
    description,
    status,
    blueprintId,
    brainId,
    requirements: Object.freeze([...requirements]),
    constraints: Object.freeze([...constraints]),
    nonGoals: Object.freeze([...nonGoals]),
    createdAt,
    updatedAt
  });
}

export function createRequirement({
  id,
  projectId,
  title = '',
  description,
  type = 'FUNCTIONAL',
  source = 'USER',
  priority = 'NORMAL',
  status = 'PROPOSED',
  acceptanceCriteria = [],
  constraints = [],
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString()
}) {
  validateRequired({ id, projectId, description }, ['id', 'projectId', 'description'], 'Requirement');
  return Object.freeze({
    id,
    projectId,
    title,
    description,
    type,
    source,
    priority,
    status,
    acceptanceCriteria: Object.freeze([...acceptanceCriteria]),
    constraints: Object.freeze([...constraints]),
    createdAt,
    updatedAt
  });
}

export function createBlueprint({
  id,
  projectId,
  version = 1,
  purpose,
  scope = [],
  nonGoals = [],
  architecture = {},
  technologyDecisions = {},
  dependencies = [],
  securityRequirements = [],
  databaseRequirements = {},
  apiRequirements = {},
  uiRequirements = {},
  testingRequirements = {},
  deploymentRequirements = {},
  integrationRequirements = [],
  referenceDecisions = [],
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString()
}) {
  validateRequired({ id, projectId, purpose }, ['id', 'projectId', 'purpose'], 'Blueprint');
  return Object.freeze({
    id,
    projectId,
    version,
    purpose,
    scope: Object.freeze([...scope]),
    nonGoals: Object.freeze([...nonGoals]),
    architecture: Object.freeze({ ...architecture }),
    technologyDecisions: Object.freeze({ ...technologyDecisions }),
    dependencies: Object.freeze([...dependencies]),
    securityRequirements: Object.freeze([...securityRequirements]),
    databaseRequirements: Object.freeze({ ...databaseRequirements }),
    apiRequirements: Object.freeze({ ...apiRequirements }),
    uiRequirements: Object.freeze({ ...uiRequirements }),
    testingRequirements: Object.freeze({ ...testingRequirements }),
    deploymentRequirements: Object.freeze({ ...deploymentRequirements }),
    integrationRequirements: Object.freeze([...integrationRequirements]),
    referenceDecisions: Object.freeze([...referenceDecisions]),
    createdAt,
    updatedAt
  });
}

export function createChangeIntent({
  id,
  projectId,
  sourceRequirementId,
  blueprintReferenceId,
  objective,
  requestedBy = 'USER',
  allowedSurfaces = [],
  forbiddenSurfaces = [],
  expectedFiles = [],
  expectedApiChanges = [],
  expectedDatabaseChanges = [],
  expectedDependencies = [],
  expectedConfigChanges = [],
  expectedCommands = [],
  riskLevel = 'LOW',
  approvalRequirement = 'NONE',
  approvalState = ApprovalState.PENDING,
  createdAt = new Date().toISOString()
}) {
  validateRequired(
    { id, projectId, sourceRequirementId, blueprintReferenceId, objective },
    ['id', 'projectId', 'sourceRequirementId', 'blueprintReferenceId', 'objective'],
    'ChangeIntent'
  );

  return Object.freeze({
    id,
    projectId,
    sourceRequirementId,
    blueprintReferenceId,
    objective,
    requestedBy,
    allowedSurfaces: Object.freeze([...allowedSurfaces]),
    forbiddenSurfaces: Object.freeze([...forbiddenSurfaces]),
    expectedFiles: Object.freeze([...expectedFiles]),
    expectedApiChanges: Object.freeze([...expectedApiChanges]),
    expectedDatabaseChanges: Object.freeze([...expectedDatabaseChanges]),
    expectedDependencies: Object.freeze([...expectedDependencies]),
    expectedConfigChanges: Object.freeze([...expectedConfigChanges]),
    expectedCommands: Object.freeze([...expectedCommands]),
    riskLevel,
    approvalRequirement,
    approvalState,
    createdAt
  });
}

export function createWorkflow({
  id,
  projectId,
  name,
  objective,
  steps = [],
  agentRoles = [],
  policies = {},
  acceptanceCriteria = [],
  budgetConstraints = {},
  iterationLimit = 3,
  approvalGates = []
}) {
  validateRequired({ id, projectId, name, objective }, ['id', 'projectId', 'name', 'objective'], 'Workflow');
  return Object.freeze({
    id,
    projectId,
    name,
    objective,
    steps: Object.freeze([...steps]),
    agentRoles: Object.freeze([...agentRoles]),
    policies: Object.freeze({ ...policies }),
    acceptanceCriteria: Object.freeze([...acceptanceCriteria]),
    budgetConstraints: Object.freeze({ ...budgetConstraints }),
    iterationLimit,
    approvalGates: Object.freeze([...approvalGates])
  });
}

export function createJob({
  id,
  projectId,
  workflowId,
  taskIds = [],
  status = JobState.PENDING,
  tenantId = null,
  scopeReference = null,
  workspaceReference = null,
  executionMetadata = {},
  costMetadata = {},
  approvalState = ApprovalState.PENDING,
  checkpointReference = null,
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString()
}) {
  validateRequired({ id, projectId, workflowId }, ['id', 'projectId', 'workflowId'], 'Job');
  if (!Object.values(JobState).includes(status)) {
    throw new Error(`[${ErrorCodes.INVALID_STATE_TRANSITION}] Invalid Job state: ${status}`);
  }
  return Object.freeze({
    id,
    projectId,
    workflowId,
    taskIds: Object.freeze([...taskIds]),
    status,
    tenantId,
    scopeReference: scopeReference ? Object.freeze({ ...scopeReference }) : null,
    workspaceReference,
    executionMetadata: Object.freeze({ ...executionMetadata }),
    costMetadata: Object.freeze({ ...costMetadata }),
    approvalState,
    checkpointReference,
    createdAt,
    updatedAt
  });
}

export function createTask({
  id,
  jobId,
  objective,
  inputs = {},
  expectedOutputs = [],
  acceptanceCriteria = [],
  agentRole = null,
  taskType = 'DEVELOPMENT',
  status = TaskState.PENDING,
  executionReference = null,
  evidenceReferences = [],
  validationReference = null,
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString()
}) {
  validateRequired({ id, jobId, objective }, ['id', 'jobId', 'objective'], 'Task');
  if (!Object.values(TaskState).includes(status)) {
    throw new Error(`[${ErrorCodes.INVALID_STATE_TRANSITION}] Invalid Task state: ${status}`);
  }
  return Object.freeze({
    id,
    jobId,
    objective,
    inputs: Object.freeze({ ...inputs }),
    expectedOutputs: Object.freeze([...expectedOutputs]),
    acceptanceCriteria: Object.freeze([...acceptanceCriteria]),
    agentRole,
    taskType,
    status,
    executionReference,
    evidenceReferences: Object.freeze([...evidenceReferences]),
    validationReference,
    createdAt,
    updatedAt
  });
}

export function createAgent({
  id,
  role,
  capabilities = [],
  permissions = [],
  currentTaskId = null
}) {
  validateRequired({ id, role }, ['id', 'role'], 'Agent');
  return Object.freeze({
    id,
    role,
    capabilities: Object.freeze([...capabilities]),
    permissions: Object.freeze([...permissions]),
    currentTaskId
  });
}

export function createAIRequest({
  id,
  taskId,
  requestedCapabilities = [],
  requestedProvider = null,
  requestedModel = null,
  constraints = {},
  riskLevel = 'LOW',
  budget = {},
  contextRequirements = {},
  toolRequirements = []
}) {
  validateRequired({ id, taskId }, ['id', 'taskId'], 'AIRequest');
  return Object.freeze({
    id,
    taskId,
    requestedCapabilities: Object.freeze([...requestedCapabilities]),
    requestedProvider,
    requestedModel,
    constraints: Object.freeze({ ...constraints }),
    riskLevel,
    budget: Object.freeze({ ...budget }),
    contextRequirements: Object.freeze({ ...contextRequirements }),
    toolRequirements: Object.freeze([...toolRequirements])
  });
}

export function createProvider({
  id,
  name,
  type = 'GENERIC',
  status = 'AVAILABLE',
  credentialRef = null
}) {
  validateRequired({ id, name }, ['id', 'name'], 'Provider');
  return Object.freeze({
    id,
    name,
    type,
    status,
    credentialRef
  });
}

export function createModel({
  id,
  providerId,
  name,
  capabilities = [],
  availabilityStatus = 'AVAILABLE'
}) {
  validateRequired({ id, providerId, name }, ['id', 'providerId', 'name'], 'Model');
  return Object.freeze({
    id,
    providerId,
    name,
    capabilities: Object.freeze([...capabilities]),
    availabilityStatus
  });
}

export function createExecutionPlan({
  id,
  taskId,
  steps = [],
  expectedCommands = [],
  expectedFileChanges = [],
  expectedEvidence = [],
  expectedValidation = [],
  requiredApprovals = [],
  risk = 'LOW'
}) {
  validateRequired({ id, taskId }, ['id', 'taskId'], 'ExecutionPlan');
  return Object.freeze({
    id,
    taskId,
    steps: Object.freeze([...steps]),
    expectedCommands: Object.freeze([...expectedCommands]),
    expectedFileChanges: Object.freeze([...expectedFileChanges]),
    expectedEvidence: Object.freeze([...expectedEvidence]),
    expectedValidation: Object.freeze([...expectedValidation]),
    requiredApprovals: Object.freeze([...requiredApprovals]),
    risk
  });
}

export function createEvidence({
  id,
  source,
  type,
  timestamp = new Date().toISOString(),
  result,
  hashOrRef = null,
  relatedExecutionId = null
}) {
  validateRequired({ id, source, type, result }, ['id', 'source', 'type', 'result'], 'Evidence');
  return Object.freeze({
    id,
    source,
    type,
    timestamp,
    result,
    hashOrRef,
    relatedExecutionId
  });
}

export function createValidation({
  id,
  target,
  acceptanceCriteria = [],
  evidenceReferences = [],
  result = ValidationResult.INCONCLUSIVE,
  failureReason = null,
  validator = 'SYSTEM',
  timestamp = new Date().toISOString()
}) {
  validateRequired({ id, target }, ['id', 'target'], 'Validation');
  if (!Object.values(ValidationResult).includes(result)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid Validation result: ${result}`);
  }
  return Object.freeze({
    id,
    target,
    acceptanceCriteria: Object.freeze([...acceptanceCriteria]),
    evidenceReferences: Object.freeze([...evidenceReferences]),
    result,
    failureReason,
    validator,
    timestamp
  });
}

export function createApproval({
  id,
  actionType,
  reason,
  riskLevel = 'MEDIUM',
  approver = null,
  approvalState = ApprovalState.PENDING,
  timestamp = new Date().toISOString()
}) {
  validateRequired({ id, actionType, reason }, ['id', 'actionType', 'reason'], 'Approval');
  if (!Object.values(ApprovalState).includes(approvalState)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid Approval state: ${approvalState}`);
  }
  return Object.freeze({
    id,
    actionType,
    reason,
    riskLevel,
    approver,
    approvalState,
    timestamp
  });
}

export function createCheckpoint({
  id,
  entityType,
  entityId,
  stateSnapshotRef,
  reason = 'CONTINUITY_CHECKPOINT',
  validationState = null,
  timestamp = new Date().toISOString()
}) {
  validateRequired({ id, entityType, entityId, stateSnapshotRef }, ['id', 'entityType', 'entityId', 'stateSnapshotRef'], 'Checkpoint');
  return Object.freeze({
    id,
    entityType,
    entityId,
    stateSnapshotRef,
    reason,
    validationState,
    timestamp
  });
}

/**
 * Validates whether a state transition is legal according to domain matrices.
 * Remediation #1: Transition Matrix Enforcement
 */
export function validateStateTransition(entityType, fromState, toState) {
  let matrix;
  if (entityType === 'PROJECT') {
    matrix = ValidProjectTransitions;
  } else if (entityType === 'JOB') {
    matrix = ValidJobTransitions;
  } else if (entityType === 'TASK') {
    matrix = ValidTaskTransitions;
  } else {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Unknown transition entity type: ${entityType}`);
  }

  if (!matrix[fromState]) {
    throw new Error(`[${ErrorCodes.INVALID_STATE_TRANSITION}] Unknown fromState '${fromState}' for ${entityType}`);
  }

  const allowedTransitions = matrix[fromState];
  if (allowedTransitions.length === 0) {
    throw new Error(`[${ErrorCodes.INVALID_STATE_TRANSITION}] Cannot transition from terminal state '${fromState}' for ${entityType}`);
  }

  if (!allowedTransitions.includes(toState)) {
    throw new Error(`[${ErrorCodes.INVALID_STATE_TRANSITION}] Illegal transition from '${fromState}' to '${toState}' for ${entityType}`);
  }

  return true;
}

export function createStateTransition({
  entityType = 'PROJECT',
  fromState,
  toState,
  actor,
  reason,
  timestamp = new Date().toISOString(),
  evidenceRef = null
}) {
  validateRequired({ fromState, toState, actor, reason }, ['fromState', 'toState', 'actor', 'reason'], 'StateTransition');
  validateStateTransition(entityType, fromState, toState);

  return Object.freeze({
    entityType,
    fromState,
    toState,
    actor,
    reason,
    timestamp,
    evidenceRef
  });
}

export function createDecision({
  id,
  projectId,
  topic,
  chosenOption,
  alternatives = [],
  reason,
  status = DecisionStatus.DECIDED,
  supersedesId = null,
  supersededById = null,
  timestamp = new Date().toISOString()
}) {
  validateRequired({ id, projectId, topic, chosenOption, reason }, ['id', 'projectId', 'topic', 'chosenOption', 'reason'], 'Decision');
  if (!Object.values(DecisionStatus).includes(status)) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Invalid Decision status: ${status}`);
  }
  return Object.freeze({
    id,
    projectId,
    topic,
    chosenOption,
    alternatives: Object.freeze([...alternatives]),
    reason,
    status,
    supersedesId,
    supersededById,
    timestamp
  });
}

/**
 * In-Memory Decision Ledger Interface (FAZ 2 Domain Core)
 * Ensures decision traceability, queryability, and superseding support
 */
export function createDecisionLedger({ projectId }) {
  validateRequired({ projectId }, ['projectId'], 'DecisionLedger');
  const decisions = new Map();

  return Object.freeze({
    projectId,
    addDecision(decision) {
      if (!decision || decision.projectId !== this.projectId) {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Decision does not belong to Project ${this.projectId}`);
      }
      if (decisions.has(decision.id)) {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Decision with ID ${decision.id} already exists`);
      }
      decisions.set(decision.id, decision);
      return decision;
    },
    getDecision(id) {
      return decisions.get(id) || null;
    },
    getAllDecisions() {
      return Object.freeze([...decisions.values()]);
    },
    getActiveDecisions() {
      return Object.freeze([...decisions.values()].filter(d => d.status === DecisionStatus.DECIDED));
    }
  });
}

/**
 * AuditRecord Factory with Strict Privacy & AI Provenance
 * Remediation #4 & Remediation #5:
 * - Explicit Requested / Actual / Fallback provenance
 * - Explicit rejection of rawPrompt, rawResponse, fullPrompt, fullResponse
 */
export function createAuditRecord({
  id,
  timestamp = new Date().toISOString(),
  actor,
  projectId,
  jobId = null,
  taskId = null,
  agentRole = null,
  action,
  // AI Provenance (Remediation #4)
  requestedProvider = null,
  requestedModel = null,
  actualProvider = null,
  actualModel = null,
  fallbackUsed = false,
  fallbackProvider = null,
  fallbackModel = null,
  // Legacy / Direct provider tracking
  providerId = null,
  modelId = null,
  // Execution metadata
  tokenUsage = null,
  cost = null,
  latencyMs = null,
  evidenceId = null,
  decisionId = null,
  result,
  // Forbidden raw properties test
  ...rest
}) {
  validateRequired({ id, actor, projectId, action, result }, ['id', 'actor', 'projectId', 'action', 'result'], 'AuditRecord');

  // Remediation #5: Forbid raw AI content carriers
  const forbiddenRawFields = ['rawPrompt', 'rawResponse', 'fullPrompt', 'fullResponse'];
  for (const field of forbiddenRawFields) {
    if (rest[field] !== undefined) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] AuditRecord strictly forbids raw AI content carrier field: ${field}`);
    }
  }

  return Object.freeze({
    id,
    timestamp,
    actor,
    projectId,
    jobId,
    taskId,
    agentRole,
    action,
    requestedProvider,
    requestedModel,
    actualProvider: actualProvider || providerId,
    actualModel: actualModel || modelId,
    fallbackUsed,
    fallbackProvider,
    fallbackModel,
    tokenUsage: tokenUsage ? Object.freeze({ ...tokenUsage }) : null,
    cost,
    latencyMs,
    evidenceId,
    decisionId,
    result
  });
}

export function createProjectBrain({
  projectId,
  requirements = [],
  blueprint = null,
  decisions = [],
  decisionHistory = [],
  currentPhase = 'DISCOVERY',
  completedWork = [],
  knownBugs = [],
  constraints = [],
  dependencies = [],
  dbContracts = {},
  apiContracts = {},
  uiRules = {},
  securityRules = [],
  aiHistoryRef = null,
  lessonsLearned = []
}) {
  validateRequired({ projectId }, ['projectId'], 'ProjectBrain');

  // Verify that associated entities belong strictly to this projectId
  for (const req of requirements) {
    if (req.projectId && req.projectId !== projectId) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Cross-project requirement contamination in Brain: ${req.projectId} vs ${projectId}`);
    }
  }
  if (blueprint && blueprint.projectId && blueprint.projectId !== projectId) {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Cross-project blueprint contamination in Brain: ${blueprint.projectId} vs ${projectId}`);
  }
  for (const dec of decisions) {
    if (dec.projectId && dec.projectId !== projectId) {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Cross-project decision contamination in Brain: ${dec.projectId} vs ${projectId}`);
    }
  }

  return Object.freeze({
    projectId,
    requirements: Object.freeze([...requirements]),
    blueprint,
    decisions: Object.freeze([...decisions]),
    decisionHistory: Object.freeze([...decisionHistory]),
    currentPhase,
    completedWork: Object.freeze([...completedWork]),
    knownBugs: Object.freeze([...knownBugs]),
    constraints: Object.freeze([...constraints]),
    dependencies: Object.freeze([...dependencies]),
    dbContracts: Object.freeze({ ...dbContracts }),
    apiContracts: Object.freeze({ ...apiContracts }),
    uiRules: Object.freeze({ ...uiRules }),
    securityRules: Object.freeze([...securityRules]),
    aiHistoryRef,
    lessonsLearned: Object.freeze([...lessonsLearned])
  });
}
