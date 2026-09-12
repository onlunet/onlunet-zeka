/**
 * AI Development OS - Domain Constants & Enums
 * Phase 1 Foundation & Phase 1.1 Hardened Contract & Phase 2 Foundation
 */

export const ProjectState = Object.freeze({
  DISCOVERY: 'DISCOVERY',
  BLUEPRINTING: 'BLUEPRINTING',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  BLOCKED: 'BLOCKED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
});

export const JobState = Object.freeze({
  PENDING: 'PENDING',
  READY: 'READY',
  RUNNING: 'RUNNING',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  VALIDATING: 'VALIDATING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
});

export const TaskState = Object.freeze({
  PENDING: 'PENDING',
  READY: 'READY',
  RUNNING: 'RUNNING',
  WAITING: 'WAITING',
  VALIDATING: 'VALIDATING',
  COMPLETED: 'COMPLETED',
  BLOCKED: 'BLOCKED',
  FAILED: 'FAILED'
});

export const ApprovalState = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
});

export const ValidationResult = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  INCONCLUSIVE: 'INCONCLUSIVE'
});

export const ScopeDecision = Object.freeze({
  PASS: 'PASS',
  SCOPE_VIOLATION: 'SCOPE_VIOLATION',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED'
});

export const ChangeSurfaces = Object.freeze({
  FILES: 'FILES',
  API: 'API',
  DATABASE: 'DATABASE',
  DEPENDENCIES: 'DEPENDENCIES',
  CONFIG: 'CONFIG',
  ENVIRONMENT: 'ENVIRONMENT',
  COMMANDS: 'COMMANDS',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  UI: 'UI',
  BEHAVIOR: 'BEHAVIOR',
  SECURITY: 'SECURITY',
  GENERATED_FILES: 'GENERATED_FILES'
});

export const AgentRoles = Object.freeze({
  ARCHITECT: 'Architect',
  DEVELOPER: 'Developer',
  FRONTEND: 'Frontend',
  BACKEND: 'Backend',
  DATABASE: 'Database',
  SECURITY: 'Security',
  TEST: 'Test',
  QA: 'QA',
  REVIEWER: 'Reviewer',
  DOCUMENTATION: 'Documentation',
  DEPENDENCY: 'Dependency',
  RESEARCH: 'Research',
  UX: 'UX',
  SEO: 'SEO',
  DEPLOYMENT: 'Deployment'
});

export const DecisionStatus = Object.freeze({
  DECIDED: 'DECIDED',
  SUPERSEDED: 'SUPERSEDED',
  REJECTED: 'REJECTED',
  DEFERRED: 'DEFERRED'
});

export const ErrorCodes = Object.freeze({
  INVALID_CONTRACT: 'INVALID_CONTRACT',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  SCOPE_VIOLATION: 'SCOPE_VIOLATION',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  SECURITY_BLOCKED: 'SECURITY_BLOCKED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_VERIFIED: 'NOT_VERIFIED'
});

/**
 * Valid state transition matrices
 * Remediation #1: Real State Transition Matrix & Terminal State Enforcement
 */
export const ValidProjectTransitions = Object.freeze({
  [ProjectState.DISCOVERY]: Object.freeze([ProjectState.BLUEPRINTING, ProjectState.CANCELLED]),
  [ProjectState.BLUEPRINTING]: Object.freeze([ProjectState.ACTIVE, ProjectState.CANCELLED]),
  [ProjectState.ACTIVE]: Object.freeze([ProjectState.PAUSED, ProjectState.BLOCKED, ProjectState.COMPLETED, ProjectState.CANCELLED]),
  [ProjectState.PAUSED]: Object.freeze([ProjectState.ACTIVE, ProjectState.CANCELLED]),
  [ProjectState.BLOCKED]: Object.freeze([ProjectState.ACTIVE, ProjectState.CANCELLED]),
  [ProjectState.COMPLETED]: Object.freeze([]), // Terminal state
  [ProjectState.CANCELLED]: Object.freeze([])  // Terminal state
});

export const ValidJobTransitions = Object.freeze({
  [JobState.PENDING]: Object.freeze([JobState.READY, JobState.CANCELLED]),
  [JobState.READY]: Object.freeze([JobState.RUNNING, JobState.CANCELLED]),
  [JobState.RUNNING]: Object.freeze([JobState.APPROVAL_REQUIRED, JobState.VALIDATING, JobState.FAILED, JobState.CANCELLED]),
  [JobState.APPROVAL_REQUIRED]: Object.freeze([JobState.RUNNING, JobState.CANCELLED]),
  [JobState.VALIDATING]: Object.freeze([JobState.COMPLETED, JobState.FAILED]),
  [JobState.COMPLETED]: Object.freeze([]), // Terminal state
  [JobState.FAILED]: Object.freeze([]),    // Terminal state
  [JobState.CANCELLED]: Object.freeze([])  // Terminal state
});

export const ValidTaskTransitions = Object.freeze({
  [TaskState.PENDING]: Object.freeze([TaskState.READY, TaskState.RUNNING, TaskState.BLOCKED, TaskState.FAILED]),
  [TaskState.READY]: Object.freeze([TaskState.RUNNING, TaskState.BLOCKED, TaskState.FAILED]),
  [TaskState.RUNNING]: Object.freeze([TaskState.WAITING, TaskState.VALIDATING, TaskState.BLOCKED, TaskState.FAILED]),
  [TaskState.WAITING]: Object.freeze([TaskState.RUNNING, TaskState.BLOCKED, TaskState.FAILED]),
  [TaskState.VALIDATING]: Object.freeze([TaskState.COMPLETED, TaskState.FAILED, TaskState.BLOCKED]),
  [TaskState.BLOCKED]: Object.freeze([TaskState.READY, TaskState.RUNNING, TaskState.FAILED]),
  [TaskState.COMPLETED]: Object.freeze([]), // Terminal state
  [TaskState.FAILED]: Object.freeze([])     // Terminal state
});

/**
 * FAZ 40: Work Unit Constants
 */
export const WorkUnitStatus = Object.freeze({
  PENDING: 'PENDING',
  ADMITTED: 'ADMITTED',
  EXECUTING: 'EXECUTING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  DENIED: 'DENIED'
});

export const WorkUnitActionType = Object.freeze({
  COMMAND: 'COMMAND',
  MUTATION: 'MUTATION'
});

