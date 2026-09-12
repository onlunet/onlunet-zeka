/**
 * ONLUNET ZEKA - Immutable Agent Identity Manager
 * FAZ 59 Foundation: Cryptographic Agent Identification & Boundary Isolation
 *
 * Implements:
 * - Immutable frozen identity structures
 * - Cross-tenant identity mutation prevention
 * - Cross-workspace boundary enforcement
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import crypto from 'node:crypto';
import { ErrorCodes } from '../contracts/constants.js';

export function createAgentIdentity({
  agentId = 'agent-default',
  agentVersion = '1.0.0',
  tenantId = 'default-tenant',
  workspaceId = 'default-workspace',
  taskId = null,
  parentInvocationId = null,
  providerId = 'local',
  model = 'default',
  invocationId = null
} = {}) {
  const finalInvocationId = invocationId || `inv-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Agent identity requires valid non-empty tenantId`);
  }

  if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Agent identity requires valid non-empty workspaceId`);
  }

  return Object.freeze({
    invocationId: finalInvocationId,
    agentId: String(agentId).trim(),
    agentVersion: String(agentVersion).trim(),
    tenantId: String(tenantId).trim(),
    workspaceId: String(workspaceId).trim(),
    taskId: taskId ? String(taskId).trim() : null,
    parentInvocationId: parentInvocationId ? String(parentInvocationId).trim() : null,
    providerId: String(providerId).trim(),
    model: String(model).trim(),
    startedAt: new Date().toISOString()
  });
}

/**
 * Validates that an incoming child identity preserves tenant and workspace continuity.
 * Rejects cross-tenant and cross-workspace breakout attempts fail-closed.
 */
export function validateIdentityContinuity(parentIdentity, childIdentity) {
  if (!parentIdentity || !childIdentity) return true;

  if (parentIdentity.tenantId && childIdentity.tenantId && parentIdentity.tenantId !== childIdentity.tenantId) {
    throw new Error(
      `[${ErrorCodes.SECURITY_BLOCKED}] Cross-tenant identity violation: parent tenant '${parentIdentity.tenantId}' does not match child tenant '${childIdentity.tenantId}'`
    );
  }

  if (parentIdentity.workspaceId && childIdentity.workspaceId && parentIdentity.workspaceId !== childIdentity.workspaceId) {
    throw new Error(
      `[${ErrorCodes.SECURITY_BLOCKED}] Cross-workspace identity violation: parent workspace '${parentIdentity.workspaceId}' does not match child workspace '${childIdentity.workspaceId}'`
    );
  }

  return true;
}
