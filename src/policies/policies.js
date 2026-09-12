/**
 * AI Development OS - Policy Abstractions
 * Phase 1 Foundation Contract
 */
import { ScopeDecision, ChangeSurfaces, ErrorCodes } from '../contracts/constants.js';

export function createScopePolicy({
  allowedSurfaces = [],
  forbiddenSurfaces = [],
  expectedFiles = [],
  allowedFiles = []
}) {
  return Object.freeze({
    type: 'SCOPE_POLICY',
    allowedSurfaces: Object.freeze([...allowedSurfaces]),
    forbiddenSurfaces: Object.freeze([...forbiddenSurfaces]),
    expectedFiles: Object.freeze([...expectedFiles]),
    allowedFiles: Object.freeze([...allowedFiles]),

    evaluateChange({ surface, targetFile = null }) {
      if (!Object.values(ChangeSurfaces).includes(surface)) {
        return {
          decision: ScopeDecision.SCOPE_VIOLATION,
          reason: `Unknown surface: ${surface}`
        };
      }
      if (this.forbiddenSurfaces.includes(surface)) {
        return {
          decision: ScopeDecision.SCOPE_VIOLATION,
          reason: `Surface ${surface} is explicitly forbidden by Scope Policy`
        };
      }
      if (!this.allowedSurfaces.includes(surface)) {
        return {
          decision: ScopeDecision.APPROVAL_REQUIRED,
          reason: `Surface ${surface} is not in allowed surfaces, approval required`
        };
      }
      if (surface === ChangeSurfaces.FILES && targetFile) {
        const isExpected = this.expectedFiles.includes(targetFile);
        const isAllowed = this.allowedFiles.includes(targetFile);
        if (!isExpected && !isAllowed) {
          return {
            decision: ScopeDecision.APPROVAL_REQUIRED,
            reason: `Target file ${targetFile} is not in expected/allowed list`
          };
        }
      }
      return {
        decision: ScopeDecision.PASS,
        reason: 'Change is compliant with Scope Policy'
      };
    }
  });
}

export function createExecutionPolicy({
  allowedCommands = [],
  allowedWorkingDirectories = [],
  allowNetwork = false,
  allowPrivilegeEscalation = false
}) {
  return Object.freeze({
    type: 'EXECUTION_POLICY',
    allowedCommands: Object.freeze([...allowedCommands]),
    allowedWorkingDirectories: Object.freeze([...allowedWorkingDirectories]),
    allowNetwork,
    allowPrivilegeEscalation,

    evaluateCommand({ executable, args = [], workingDirectory, requiresNetwork = false, isPrivileged = false }) {
      if (isPrivileged && !this.allowPrivilegeEscalation) {
        return {
          allowed: false,
          code: ErrorCodes.SECURITY_BLOCKED,
          reason: 'Privilege escalation is forbidden by Execution Policy'
        };
      }
      if (requiresNetwork && !this.allowNetwork) {
        return {
          allowed: false,
          code: ErrorCodes.SECURITY_BLOCKED,
          reason: 'Network access is forbidden by Execution Policy'
        };
      }
      if (workingDirectory && this.allowedWorkingDirectories.length > 0) {
        const isDirAllowed = this.allowedWorkingDirectories.some(dir => workingDirectory.startsWith(dir));
        if (!isDirAllowed) {
          return {
            allowed: false,
            code: ErrorCodes.SECURITY_BLOCKED,
            reason: `Working directory ${workingDirectory} is outside allowed boundary`
          };
        }
      }
      if (this.allowedCommands.length > 0 && !this.allowedCommands.includes(executable)) {
        return {
          allowed: false,
          code: ErrorCodes.APPROVAL_REQUIRED,
          reason: `Executable ${executable} requires explicit user approval`
        };
      }
      return {
        allowed: true,
        reason: 'Command execution is compliant with Execution Policy'
      };
    }
  });
}

export function createSecurityPolicy({
  allowSecretExposure = false,
  allowExternalSystemWrite = false,
  enforceRedaction = true
}) {
  return Object.freeze({
    type: 'SECURITY_POLICY',
    allowSecretExposure,
    allowExternalSystemWrite,
    enforceRedaction,

    evaluateAction({ actionType, hasSecrets = false, isExternalWrite = false }) {
      if (hasSecrets && !this.allowSecretExposure) {
        return {
          allowed: false,
          code: ErrorCodes.SECURITY_BLOCKED,
          reason: 'Action would expose unredacted secrets, blocked by Security Policy'
        };
      }
      if (isExternalWrite && !this.allowExternalSystemWrite) {
        return {
          allowed: false,
          code: ErrorCodes.SECURITY_BLOCKED,
          reason: 'Writing outside project boundary is blocked by default Security Policy'
        };
      }
      return {
        allowed: true,
        reason: 'Action conforms to Security Policy'
      };
    }
  });
}

export function createApprovalPolicy({
  mandatoryApprovalActions = [
    'ARCHITECTURE_CHANGE',
    'DATABASE_MIGRATION',
    'MAJOR_DEPENDENCY',
    'DESTRUCTIVE_OPERATION',
    'GIT_PUSH',
    'EXTERNAL_INTEGRATION'
  ]
}) {
  return Object.freeze({
    type: 'APPROVAL_POLICY',
    mandatoryApprovalActions: Object.freeze([...mandatoryApprovalActions]),

    isApprovalRequired({ actionType, riskLevel = 'LOW' }) {
      if (this.mandatoryApprovalActions.includes(actionType)) {
        return {
          required: true,
          reason: `Action ${actionType} is in mandatory user approval list`
        };
      }
      if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
        return {
          required: true,
          reason: `Risk level ${riskLevel} mandates user approval`
        };
      }
      return {
        required: false,
        reason: 'No explicit approval gate required'
      };
    }
  });
}
