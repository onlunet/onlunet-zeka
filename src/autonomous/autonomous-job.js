/**
 * AI Development OS - Autonomous Project Job & State Machine
 * Phase 59 Foundation - Autonomous AI Agency Execution Loop
 *
 * CORE INVARIANTS:
 * 1. DETERMINISTIC STATE MACHINE:
 *    Only valid state transitions defined in ValidAutonomousJobTransitions are allowed.
 *    Invalid transitions fail closed and throw descriptive errors.
 * 2. BOUNDED AUTONOMY & HARD LIMITS:
 *    maxIterations, maxFixAttempts (3), maxProviderCalls, maxTokens, maxCostUsd,
 *    maxElapsedTimeMs, maxFilesChanged, and maxCommandsExecuted are strictly enforced.
 * 3. NO AI AUTHORITY:
 *    Job state transitions are driven by deterministic verification, governance admission,
 *    and system policies. AI claims alone confer zero authority to alter job state.
 * 4. ISOLATION & LINEAGE BINDING:
 *    Tenant ID, Workspace ID, and Job ID are strictly bound. Cross-tenant pollution is blocked.
 * 5. SECRET REDACTION IN EVENTS:
 *    All event payloads and context entries pass through credential sanitization.
 */

import crypto from 'node:crypto';
import { sanitizeCredentials } from '../providers/credential-sanitizer.js';

export const AutonomousJobState = Object.freeze({
  CREATED: 'CREATED',
  QUEUED: 'QUEUED',
  ANALYZING: 'ANALYZING',
  PLANNING: 'PLANNING',
  ARCHITECTING: 'ARCHITECTING',
  IMPLEMENTING: 'IMPLEMENTING',
  EXECUTING: 'EXECUTING',
  TESTING: 'TESTING',
  ANALYZING_FAILURE: 'ANALYZING_FAILURE',
  FIXING: 'FIXING',
  RETESTING: 'RETESTING',
  REVIEWING: 'REVIEWING',
  SECURITY_REVIEW: 'SECURITY_REVIEW',
  VERIFYING: 'VERIFYING',
  READY_FOR_DELIVERY: 'READY_FOR_DELIVERY',
  FAILED: 'FAILED',
  BLOCKED: 'BLOCKED',
  CANCELLED: 'CANCELLED',
  TIMEOUT: 'TIMEOUT',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  POLICY_DENIED: 'POLICY_DENIED',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED'
});

export const AutonomousJobEvent = Object.freeze({
  JOB_CREATED: 'JOB_CREATED',
  PROJECT_ANALYSIS_STARTED: 'PROJECT_ANALYSIS_STARTED',
  PROJECT_ANALYSIS_COMPLETED: 'PROJECT_ANALYSIS_COMPLETED',
  PLAN_CREATED: 'PLAN_CREATED',
  ARCHITECTURE_REVIEW_STARTED: 'ARCHITECTURE_REVIEW_STARTED',
  ARCHITECTURE_REVIEW_COMPLETED: 'ARCHITECTURE_REVIEW_COMPLETED',
  IMPLEMENTATION_STARTED: 'IMPLEMENTATION_STARTED',
  FILES_CHANGED: 'FILES_CHANGED',
  TEST_STARTED: 'TEST_STARTED',
  TEST_FAILED: 'TEST_FAILED',
  FAILURE_ANALYSIS_STARTED: 'FAILURE_ANALYSIS_STARTED',
  FAILURE_ANALYSIS_COMPLETED: 'FAILURE_ANALYSIS_COMPLETED',
  FIX_STARTED: 'FIX_STARTED',
  FIX_APPLIED: 'FIX_APPLIED',
  RETEST_STARTED: 'RETEST_STARTED',
  TEST_PASSED: 'TEST_PASSED',
  SECURITY_REVIEW_STARTED: 'SECURITY_REVIEW_STARTED',
  SECURITY_REVIEW_COMPLETED: 'SECURITY_REVIEW_COMPLETED',
  VERIFICATION_STARTED: 'VERIFICATION_STARTED',
  VERIFICATION_COMPLETED: 'VERIFICATION_COMPLETED',
  DELIVERY_READY: 'DELIVERY_READY',
  JOB_FAILED: 'JOB_FAILED',
  JOB_BLOCKED: 'JOB_BLOCKED',
  JOB_CANCELLED: 'JOB_CANCELLED',
  JOB_RESUMED: 'JOB_RESUMED',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED'
});

export const ValidAutonomousJobTransitions = Object.freeze({
  [AutonomousJobState.CREATED]: Object.freeze([
    AutonomousJobState.QUEUED,
    AutonomousJobState.ANALYZING,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.FAILED,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.POLICY_DENIED
  ]),
  [AutonomousJobState.QUEUED]: Object.freeze([
    AutonomousJobState.ANALYZING,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.FAILED,
    AutonomousJobState.BLOCKED
  ]),
  [AutonomousJobState.ANALYZING]: Object.freeze([
    AutonomousJobState.PLANNING,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.FAILED,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.TIMEOUT,
    AutonomousJobState.BUDGET_EXCEEDED
  ]),
  [AutonomousJobState.PLANNING]: Object.freeze([
    AutonomousJobState.ARCHITECTING,
    AutonomousJobState.IMPLEMENTING,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.FAILED,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.TIMEOUT,
    AutonomousJobState.BUDGET_EXCEEDED
  ]),
  [AutonomousJobState.ARCHITECTING]: Object.freeze([
    AutonomousJobState.PLANNING,
    AutonomousJobState.IMPLEMENTING,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.FAILED,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.TIMEOUT,
    AutonomousJobState.BUDGET_EXCEEDED
  ]),
  [AutonomousJobState.IMPLEMENTING]: Object.freeze([
    AutonomousJobState.EXECUTING,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.FAILED,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.TIMEOUT,
    AutonomousJobState.BUDGET_EXCEEDED,
    AutonomousJobState.POLICY_DENIED
  ]),
  [AutonomousJobState.EXECUTING]: Object.freeze([
    AutonomousJobState.TESTING,
    AutonomousJobState.ANALYZING_FAILURE,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.FAILED,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.TIMEOUT,
    AutonomousJobState.BUDGET_EXCEEDED,
    AutonomousJobState.POLICY_DENIED
  ]),
  [AutonomousJobState.TESTING]: Object.freeze([
    AutonomousJobState.REVIEWING,
    AutonomousJobState.ANALYZING_FAILURE,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.FAILED,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.TIMEOUT,
    AutonomousJobState.BUDGET_EXCEEDED
  ]),
  [AutonomousJobState.ANALYZING_FAILURE]: Object.freeze([
    AutonomousJobState.FIXING,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.FAILED,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.TIMEOUT,
    AutonomousJobState.BUDGET_EXCEEDED
  ]),
  [AutonomousJobState.FIXING]: Object.freeze([
    AutonomousJobState.EXECUTING,
    AutonomousJobState.RETESTING,
    AutonomousJobState.ANALYZING_FAILURE,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.FAILED,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.TIMEOUT,
    AutonomousJobState.BUDGET_EXCEEDED,
    AutonomousJobState.POLICY_DENIED
  ]),
  [AutonomousJobState.RETESTING]: Object.freeze([
    AutonomousJobState.REVIEWING,
    AutonomousJobState.TESTING,
    AutonomousJobState.ANALYZING_FAILURE,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.FAILED,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.TIMEOUT,
    AutonomousJobState.BUDGET_EXCEEDED
  ]),
  [AutonomousJobState.REVIEWING]: Object.freeze([
    AutonomousJobState.SECURITY_REVIEW,
    AutonomousJobState.FIXING,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.FAILED,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.TIMEOUT,
    AutonomousJobState.BUDGET_EXCEEDED
  ]),
  [AutonomousJobState.SECURITY_REVIEW]: Object.freeze([
    AutonomousJobState.VERIFYING,
    AutonomousJobState.FIXING,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.FAILED,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.POLICY_DENIED,
    AutonomousJobState.TIMEOUT,
    AutonomousJobState.BUDGET_EXCEEDED
  ]),
  [AutonomousJobState.VERIFYING]: Object.freeze([
    AutonomousJobState.READY_FOR_DELIVERY,
    AutonomousJobState.ANALYZING_FAILURE,
    AutonomousJobState.VERIFICATION_FAILED,
    AutonomousJobState.BLOCKED,
    AutonomousJobState.FAILED,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.TIMEOUT,
    AutonomousJobState.BUDGET_EXCEEDED
  ]),
  [AutonomousJobState.BLOCKED]: Object.freeze([
    AutonomousJobState.ANALYZING,
    AutonomousJobState.PLANNING,
    AutonomousJobState.IMPLEMENTING,
    AutonomousJobState.EXECUTING,
    AutonomousJobState.TESTING,
    AutonomousJobState.FIXING,
    AutonomousJobState.VERIFYING,
    AutonomousJobState.CANCELLED,
    AutonomousJobState.FAILED
  ]),
  // Terminal states (zero outgoing transitions)
  [AutonomousJobState.READY_FOR_DELIVERY]: Object.freeze([]),
  [AutonomousJobState.FAILED]: Object.freeze([]),
  [AutonomousJobState.CANCELLED]: Object.freeze([]),
  [AutonomousJobState.TIMEOUT]: Object.freeze([]),
  [AutonomousJobState.BUDGET_EXCEEDED]: Object.freeze([]),
  [AutonomousJobState.POLICY_DENIED]: Object.freeze([]),
  [AutonomousJobState.VERIFICATION_FAILED]: Object.freeze([])
});

export const DEFAULT_AUTONOMOUS_LIMITS = Object.freeze({
  maxIterations: 10,
  maxFixAttempts: 3,
  maxProviderCalls: 25,
  maxTokens: 100000,
  maxCostUsd: 5.0,
  maxElapsedTimeMs: 300000, // 5 minutes
  maxFilesChanged: 20,
  maxCommandsExecuted: 20
});

function hasPrototypePollution(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
      Object.prototype.hasOwnProperty.call(obj, 'prototype')) {
    return true;
  }
  return false;
}

export class AutonomousJob {
  constructor({
    jobId = null,
    tenantId = 'default-tenant',
    workspaceId = 'default-workspace',
    userRequest = '',
    idempotencyKey = null,
    limits = {},
    status = AutonomousJobState.CREATED,
    phase = 'INIT',
    attempt = 0,
    createdAt = null,
    updatedAt = null,
    metrics = null,
    context = null
  } = {}) {
    if (hasPrototypePollution(limits) || hasPrototypePollution(metrics) || hasPrototypePollution(context)) {
      throw new Error('Prototype pollution detected in AutonomousJob parameters');
    }

    this.jobId = String(jobId || `job-${crypto.randomUUID()}`).trim();
    this.tenantId = String(tenantId || 'default-tenant').trim();
    this.workspaceId = String(workspaceId || 'default-workspace').trim();
    this.userRequest = String(userRequest || '').trim();
    this.idempotencyKey = idempotencyKey ? String(idempotencyKey).trim() : null;

    if (!Object.values(AutonomousJobState).includes(status)) {
      throw new Error(`Invalid initial AutonomousJobState: '${status}'`);
    }

    this.status = status;
    this.phase = String(phase || 'INIT').trim();
    this.attempt = Number.isInteger(attempt) ? attempt : 0;
    this.createdAt = createdAt || new Date().toISOString();
    this.updatedAt = updatedAt || this.createdAt;
    this.startedAt = Date.now();

    this.limits = Object.freeze({
      ...DEFAULT_AUTONOMOUS_LIMITS,
      ...limits
    });

    this.metrics = {
      iterations: metrics?.iterations || 0,
      fixAttempts: metrics?.fixAttempts || 0,
      providerCalls: metrics?.providerCalls || 0,
      tokensUsed: metrics?.tokensUsed || 0,
      costUsd: metrics?.costUsd || 0.0,
      elapsedTimeMs: metrics?.elapsedTimeMs || 0,
      filesChanged: Array.isArray(metrics?.filesChanged) ? [...metrics.filesChanged] : [],
      commandsExecuted: metrics?.commandsExecuted || 0
    };

    this.context = {
      projectContext: context?.projectContext || null,
      plan: context?.plan || null,
      architectureDecisions: Array.isArray(context?.architectureDecisions) ? [...context.architectureDecisions] : [],
      agentProposals: Array.isArray(context?.agentProposals) ? [...context.agentProposals] : [],
      acceptedChanges: Array.isArray(context?.acceptedChanges) ? [...context.acceptedChanges] : [],
      rejectedChanges: Array.isArray(context?.rejectedChanges) ? [...context.rejectedChanges] : [],
      testEvidence: Array.isArray(context?.testEvidence) ? [...context.testEvidence] : [],
      failureHistory: Array.isArray(context?.failureHistory) ? [...context.failureHistory] : [],
      fixes: Array.isArray(context?.fixes) ? [...context.fixes] : [],
      reviewFindings: Array.isArray(context?.reviewFindings) ? [...context.reviewFindings] : [],
      finalVerification: context?.finalVerification || null,
      deliveryPackage: context?.deliveryPackage || null
    };

    this._eventListeners = new Set();
    this._eventLog = [];
    this._abortController = new AbortController();

    // Log creation event
    this.emitEvent(AutonomousJobEvent.JOB_CREATED, {
      jobId: this.jobId,
      tenantId: this.tenantId,
      workspaceId: this.workspaceId,
      status: this.status
    });
  }

  get isTerminal() {
    const allowed = ValidAutonomousJobTransitions[this.status];
    return Array.isArray(allowed) && allowed.length === 0;
  }

  get abortSignal() {
    return this._abortController.signal;
  }

  transitionTo(nextState, reason = null) {
    if (!Object.values(AutonomousJobState).includes(nextState)) {
      throw new Error(`Unknown state: '${nextState}'`);
    }

    if (this.status === nextState) {
      return this.status;
    }

    const allowed = ValidAutonomousJobTransitions[this.status] || [];
    if (!allowed.includes(nextState)) {
      throw new Error(
        `Invalid state transition: Cannot transition from '${this.status}' to '${nextState}'. ` +
        `Allowed transitions: [${allowed.join(', ')}]`
      );
    }

    const previousState = this.status;
    this.status = nextState;
    this.phase = nextState;
    this.updatedAt = new Date().toISOString();

    const eventName = nextState === AutonomousJobState.READY_FOR_DELIVERY
      ? AutonomousJobEvent.DELIVERY_READY
      : nextState === AutonomousJobState.CANCELLED
      ? AutonomousJobEvent.JOB_CANCELLED
      : nextState === AutonomousJobState.BLOCKED
      ? AutonomousJobEvent.JOB_BLOCKED
      : nextState === AutonomousJobState.FAILED
      ? AutonomousJobEvent.JOB_FAILED
      : `STATE_${nextState}`;

    this.emitEvent(eventName, {
      previousState,
      currentState: nextState,
      reason: reason ? String(reason) : null
    });

    return this.status;
  }

  checkBounds() {
    this.metrics.elapsedTimeMs = Date.now() - this.startedAt;

    if (this.metrics.elapsedTimeMs > this.limits.maxElapsedTimeMs) {
      this.emitEvent(AutonomousJobEvent.LIMIT_EXCEEDED, {
        limit: 'maxElapsedTimeMs',
        current: this.metrics.elapsedTimeMs,
        max: this.limits.maxElapsedTimeMs
      });
      this.transitionTo(AutonomousJobState.TIMEOUT, 'Execution time limit exceeded');
      return false;
    }

    if (this.metrics.costUsd > this.limits.maxCostUsd) {
      this.emitEvent(AutonomousJobEvent.LIMIT_EXCEEDED, {
        limit: 'maxCostUsd',
        current: this.metrics.costUsd,
        max: this.limits.maxCostUsd
      });
      this.transitionTo(AutonomousJobState.BUDGET_EXCEEDED, 'Cost budget exceeded');
      return false;
    }

    if (this.metrics.tokensUsed > this.limits.maxTokens) {
      this.emitEvent(AutonomousJobEvent.LIMIT_EXCEEDED, {
        limit: 'maxTokens',
        current: this.metrics.tokensUsed,
        max: this.limits.maxTokens
      });
      this.transitionTo(AutonomousJobState.BUDGET_EXCEEDED, 'Token limit exceeded');
      return false;
    }

    if (this.metrics.providerCalls > this.limits.maxProviderCalls) {
      this.emitEvent(AutonomousJobEvent.LIMIT_EXCEEDED, {
        limit: 'maxProviderCalls',
        current: this.metrics.providerCalls,
        max: this.limits.maxProviderCalls
      });
      this.transitionTo(AutonomousJobState.BLOCKED, 'Maximum provider call limit reached');
      return false;
    }

    if (this.metrics.iterations > this.limits.maxIterations) {
      this.emitEvent(AutonomousJobEvent.LIMIT_EXCEEDED, {
        limit: 'maxIterations',
        current: this.metrics.iterations,
        max: this.limits.maxIterations
      });
      this.transitionTo(AutonomousJobState.BLOCKED, 'Maximum iterations reached');
      return false;
    }

    if (this.metrics.fixAttempts > this.limits.maxFixAttempts) {
      this.emitEvent(AutonomousJobEvent.LIMIT_EXCEEDED, {
        limit: 'maxFixAttempts',
        current: this.metrics.fixAttempts,
        max: this.limits.maxFixAttempts
      });
      this.transitionTo(AutonomousJobState.BLOCKED, 'Maximum fix attempts (3) exceeded');
      return false;
    }

    if (this.metrics.filesChanged.length > this.limits.maxFilesChanged) {
      this.emitEvent(AutonomousJobEvent.LIMIT_EXCEEDED, {
        limit: 'maxFilesChanged',
        current: this.metrics.filesChanged.length,
        max: this.limits.maxFilesChanged
      });
      this.transitionTo(AutonomousJobState.BLOCKED, 'Maximum files changed limit reached');
      return false;
    }

    if (this.metrics.commandsExecuted > this.limits.maxCommandsExecuted) {
      this.emitEvent(AutonomousJobEvent.LIMIT_EXCEEDED, {
        limit: 'maxCommandsExecuted',
        current: this.metrics.commandsExecuted,
        max: this.limits.maxCommandsExecuted
      });
      this.transitionTo(AutonomousJobState.BLOCKED, 'Maximum commands executed limit reached');
      return false;
    }

    return true;
  }

  recordProviderUsage({ tokens = 0, costUsd = 0.0 } = {}) {
    this.metrics.providerCalls += 1;
    this.metrics.tokensUsed += Math.max(0, Number(tokens) || 0);
    this.metrics.costUsd += Math.max(0, Number(costUsd) || 0.0);
    this.checkBounds();
  }

  recordCommandExecution(command) {
    this.metrics.commandsExecuted += 1;
    this.checkBounds();
  }

  recordFileMutation(filePath) {
    if (filePath && !this.metrics.filesChanged.includes(filePath)) {
      this.metrics.filesChanged.push(filePath);
      this.emitEvent(AutonomousJobEvent.FILES_CHANGED, {
        files: [...this.metrics.filesChanged]
      });
    }
    this.checkBounds();
  }

  recordFixAttempt() {
    this.metrics.fixAttempts += 1;
    this.attempt = this.metrics.fixAttempts;
    this.checkBounds();
  }

  recordIteration() {
    this.metrics.iterations += 1;
    this.checkBounds();
  }

  emitEvent(type, data = {}) {
    const sanitizedData = sanitizeCredentials(data);
    const event = Object.freeze({
      eventId: `evt-${crypto.randomUUID()}`,
      jobId: this.jobId,
      tenantId: this.tenantId,
      workspaceId: this.workspaceId,
      type: String(type),
      phase: this.phase,
      status: this.status,
      timestamp: new Date().toISOString(),
      data: sanitizedData
    });

    this._eventLog.push(event);

    for (const listener of this._eventListeners) {
      try {
        listener(event);
      } catch (err) {
        // Suppress listener side effects
      }
    }

    return event;
  }

  subscribe(listener) {
    if (typeof listener === 'function') {
      this._eventListeners.add(listener);
      return () => this._eventListeners.delete(listener);
    }
    return () => {};
  }

  getEvents() {
    return Object.freeze([...this._eventLog]);
  }

  cancel(reason = 'User requested cancellation') {
    if (this.isTerminal) {
      return this.status;
    }
    this._abortController.abort(reason);
    return this.transitionTo(AutonomousJobState.CANCELLED, reason);
  }

  resume(targetState = AutonomousJobState.ANALYZING) {
    if (this.status !== AutonomousJobState.BLOCKED) {
      throw new Error(`Cannot resume job in '${this.status}' state. Only BLOCKED jobs can be resumed`);
    }
    this.emitEvent(AutonomousJobEvent.JOB_RESUMED, { resumedTo: targetState });
    return this.transitionTo(targetState, 'Job explicitly resumed by operator');
  }

  toJSON() {
    return {
      jobId: this.jobId,
      tenantId: this.tenantId,
      workspaceId: this.workspaceId,
      userRequest: this.userRequest,
      idempotencyKey: this.idempotencyKey,
      status: this.status,
      phase: this.phase,
      attempt: this.attempt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      limits: { ...this.limits },
      metrics: {
        ...this.metrics,
        filesChanged: [...this.metrics.filesChanged]
      },
      context: sanitizeCredentials(this.context),
      eventCount: this._eventLog.length
    };
  }

  static fromJSON(json) {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON input for AutonomousJob.fromJSON');
    }
    const job = new AutonomousJob({
      jobId: json.jobId,
      tenantId: json.tenantId,
      workspaceId: json.workspaceId,
      userRequest: json.userRequest,
      idempotencyKey: json.idempotencyKey,
      limits: json.limits,
      status: json.status,
      phase: json.phase,
      attempt: json.attempt,
      createdAt: json.createdAt,
      updatedAt: json.updatedAt,
      metrics: json.metrics,
      context: json.context
    });
    return job;
  }
}

export function createAutonomousJob(options = {}) {
  return new AutonomousJob(options);
}
