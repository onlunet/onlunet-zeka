/**
 * ONLUNET ZEKA - Escalation & Self-Correction Governor
 * FAZ 59 Foundation: Deterministic Self-Correction Bounds & Human Escalation
 *
 * Implements:
 * - MAX_CORRECTIONS = 3 hard boundary
 * - Rejection of AI-generated self-approval / self-verification
 * - Mandatory HUMAN_REQUIRED escalation triggers
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';

export const MAX_CORRECTIONS = 3;

export const EscalationReasons = Object.freeze({
  SECURITY_CONFLICT: 'SECURITY_CONFLICT',
  AUTHORITY_AMBIGUITY: 'AUTHORITY_AMBIGUITY',
  RESTRICTED_DATA_ACCESS: 'RESTRICTED_DATA_ACCESS',
  HIGH_RISK_MUTATION: 'HIGH_RISK_MUTATION',
  POLICY_CONFLICT: 'POLICY_CONFLICT',
  BUDGET_ANOMALY: 'BUDGET_ANOMALY',
  PROVIDER_TRUST_VIOLATION: 'PROVIDER_TRUST_VIOLATION',
  VERIFICATION_EXHAUSTION: 'VERIFICATION_EXHAUSTION',
  CRITICAL_AGENT_DISAGREEMENT: 'CRITICAL_AGENT_DISAGREEMENT'
});

export function createEscalationGovernor({ maxCorrections = MAX_CORRECTIONS } = {}) {
  const correctionCounters = new Map();

  return Object.freeze({
    /**
     * Evaluates whether self-correction can proceed.
     * Can ONLY be initiated by deterministic verification results, never by AI text.
     */
    canAttemptCorrection({ taskId, verificationResult }) {
      if (!taskId) throw new Error('taskId is required for correction tracking');

      // AI cannot trigger self-correction by claiming "fix" or "retry"
      if (!verificationResult || typeof verificationResult !== 'object') {
        return {
          allowed: false,
          reason: 'Self-correction requires verified deterministic test results.',
          escalate: true,
          escalationReason: EscalationReasons.AUTHORITY_AMBIGUITY
        };
      }

      // If verification already passed, no correction needed
      if (verificationResult.passed === true || verificationResult.verificationPassed === true) {
        return { allowed: false, reason: 'Verification already passed; correction not required.' };
      }

      const count = correctionCounters.get(taskId) || 0;
      if (count >= maxCorrections) {
        return {
          allowed: false,
          reason: `Task exceeded maximum self-correction limit (${count}/${maxCorrections})`,
          escalate: true,
          escalationReason: EscalationReasons.VERIFICATION_EXHAUSTION
        };
      }

      correctionCounters.set(taskId, count + 1);
      return {
        allowed: true,
        currentAttempt: count + 1,
        maxCorrections,
        remainingAttempts: maxCorrections - (count + 1)
      };
    },

    /**
     * Checks whether an operation requires immediate human intervention.
     */
    checkHumanEscalation({
      isSecurityConflict = false,
      isRestrictedData = false,
      hasBudgetAnomaly = false,
      isHighRisk = false,
      agentConflictUnresolved = false,
      authorityAmbiguity = false
    } = {}) {
      const triggers = [];
      if (isSecurityConflict) triggers.push(EscalationReasons.SECURITY_CONFLICT);
      if (isRestrictedData) triggers.push(EscalationReasons.RESTRICTED_DATA_ACCESS);
      if (hasBudgetAnomaly) triggers.push(EscalationReasons.BUDGET_ANOMALY);
      if (isHighRisk) triggers.push(EscalationReasons.HIGH_RISK_MUTATION);
      if (agentConflictUnresolved) triggers.push(EscalationReasons.CRITICAL_AGENT_DISAGREEMENT);
      if (authorityAmbiguity) triggers.push(EscalationReasons.AUTHORITY_AMBIGUITY);

      if (triggers.length > 0) {
        return Object.freeze({
          humanRequired: true,
          status: 'HUMAN_REQUIRED',
          triggers: Object.freeze(triggers),
          executionAuthorized: false,
          requiresExplicitHumanApproval: true,
          timestamp: new Date().toISOString()
        });
      }

      return Object.freeze({
        humanRequired: false,
        status: 'AUTOMATED_ALLOWED',
        executionAuthorized: false // Invariant: AI never authorizes
      });
    },

    getCorrectionCount(taskId) {
      return correctionCounters.get(taskId) || 0;
    }
  });
}
