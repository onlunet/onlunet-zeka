/**
 * ONLUNET ZEKA - Cryptographic Approval Token Boundary
 * FAZ 59 Foundation: Anti-Replay & Scope-Bound Approval Enforcement
 *
 * Implements:
 * - HMAC-signed immutable approval tokens
 * - Strict binding to (tenantId, workspaceId, taskId, planId, scope)
 * - Single-use consumption check (prevents replay attacks)
 * - Expiry deadlines
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import crypto from 'node:crypto';
import { ErrorCodes } from '../contracts/constants.js';

const DEFAULT_SECRET = crypto.randomBytes(32).toString('hex');

export function createApprovalBoundary({ secret = DEFAULT_SECRET } = {}) {
  const consumedTokens = new Set();

  function generateSignature(payload) {
    return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  return Object.freeze({
    /**
     * Issues an approval token bound to explicit scope and task identities.
     */
    issueApprovalToken({
      taskId,
      planId,
      workspaceId,
      tenantId,
      scope = 'mutation:execute',
      approverId = 'human-approver',
      ttlMs = 3600000 // 1 hour
    } = {}) {
      if (!taskId) throw new Error('taskId is required to issue approval token');
      if (!planId) throw new Error('planId is required to issue approval token');
      if (!workspaceId) throw new Error('workspaceId is required to issue approval token');
      if (!tenantId) throw new Error('tenantId is required to issue approval token');

      const tokenId = `appr-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const expiresAt = Date.now() + ttlMs;

      const payload = {
        tokenId,
        taskId: String(taskId).trim(),
        planId: String(planId).trim(),
        workspaceId: String(workspaceId).trim(),
        tenantId: String(tenantId).trim(),
        scope: String(scope).trim(),
        approverId: String(approverId).trim(),
        issuedAt: Date.now(),
        expiresAt
      };

      const signature = generateSignature(payload);

      return Object.freeze({
        ...payload,
        signature,
        tokenString: Buffer.from(JSON.stringify({ ...payload, signature })).toString('base64url')
      });
    },

    /**
     * Verifies and consumes the approval token.
     * Prevents replay attacks, scope mismatch, and cross-task reuse.
     */
    consumeApprovalToken(tokenInput, context = {}) {
      if (!tokenInput) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Missing mandatory approval token`);
      }

      let parsed = null;
      if (typeof tokenInput === 'string') {
        try {
          parsed = JSON.parse(Buffer.from(tokenInput, 'base64url').toString('utf8'));
        } catch {
          throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Invalid approval token encoding`);
        }
      } else if (typeof tokenInput === 'object') {
        parsed = tokenInput;
      }

      if (!parsed || !parsed.tokenId || !parsed.signature) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Malformed approval token structure`);
      }

      // 1. Check if token was already consumed (Anti-Replay)
      if (consumedTokens.has(parsed.tokenId)) {
        throw new Error(
          `[${ErrorCodes.SECURITY_BLOCKED}] Approval token '${parsed.tokenId}' has already been consumed (Replay attack blocked)`
        );
      }

      // 2. Validate cryptographic signature
      const { signature, tokenString, ...payload } = parsed;
      const expectedSig = generateSignature(payload);
      if (signature !== expectedSig) {
        throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Approval token cryptographic signature mismatch`);
      }

      // 3. Expiration Check
      if (Date.now() > parsed.expiresAt) {
        throw new Error(
          `[${ErrorCodes.SECURITY_BLOCKED}] Approval token '${parsed.tokenId}' has expired at ${new Date(parsed.expiresAt).toISOString()}`
        );
      }

      // 4. Strict Identity and Scope Context Validation
      if (context.taskId && parsed.taskId !== context.taskId) {
        throw new Error(
          `[${ErrorCodes.SECURITY_BLOCKED}] Approval token taskId '${parsed.taskId}' does not match context taskId '${context.taskId}'`
        );
      }

      if (context.planId && parsed.planId !== context.planId) {
        throw new Error(
          `[${ErrorCodes.SECURITY_BLOCKED}] Approval token planId '${parsed.planId}' does not match context planId '${context.planId}'`
        );
      }

      if (context.tenantId && parsed.tenantId !== context.tenantId) {
        throw new Error(
          `[${ErrorCodes.SECURITY_BLOCKED}] Approval token tenantId '${parsed.tenantId}' does not match context tenantId '${context.tenantId}'`
        );
      }

      if (context.workspaceId && parsed.workspaceId !== context.workspaceId) {
        throw new Error(
          `[${ErrorCodes.SECURITY_BLOCKED}] Approval token workspaceId '${parsed.workspaceId}' does not match context workspaceId '${context.workspaceId}'`
        );
      }

      if (context.scope && parsed.scope !== context.scope) {
        throw new Error(
          `[${ErrorCodes.SECURITY_BLOCKED}] Approval token scope '${parsed.scope}' does not match context scope '${context.scope}'`
        );
      }

      // Mark token as consumed
      consumedTokens.add(parsed.tokenId);

      return Object.freeze({
        valid: true,
        consumed: true,
        tokenId: parsed.tokenId,
        taskId: parsed.taskId,
        planId: parsed.planId,
        approverId: parsed.approverId,
        consumedAt: new Date().toISOString()
      });
    }
  });
}
