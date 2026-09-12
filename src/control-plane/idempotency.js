/**
 * ONLUNET ZEKA - Idempotency & De-duplication Engine
 * FAZ 59 Foundation: Duplicate Execution, Mutation & Billing Defense
 *
 * Implements:
 * - Deterministic request signature calculation (SHA-256)
 * - Safe concurrency: in-progress request locking
 * - Cached response replay without duplicate billing or execution
 * - Time-to-live (TTL) expiration
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import crypto from 'node:crypto';

export function computeIdempotencyKey({
  tenantId = 'default-tenant',
  workspaceId = 'default-workspace',
  taskId = 'default-task',
  action = 'ai:dispatch',
  params = {}
} = {}) {
  const hash = crypto.createHash('sha256');
  hash.update(String(tenantId));
  hash.update(String(workspaceId));
  hash.update(String(taskId));
  hash.update(String(action));
  hash.update(JSON.stringify(params));
  return hash.digest('hex');
}

export function createIdempotencyManager({ ttlMs = 300000 } = {}) {
  const store = new Map();

  function cleanup() {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.expiresAt) {
        store.delete(key);
      }
    }
  }

  return Object.freeze({
    /**
     * Attempts to acquire an execution lock for the given idempotency key.
     * If already completed, returns { duplicate: true, cachedResult: ... }.
     * If currently in progress, returns { inProgress: true }.
     * Otherwise returns { acquired: true }.
     */
    acquire(key) {
      cleanup();
      const existing = store.get(key);
      if (existing) {
        if (existing.status === 'IN_PROGRESS') {
          return { inProgress: true, key };
        }
        if (existing.status === 'COMPLETED') {
          return {
            duplicate: true,
            key,
            cachedResult: existing.result,
            completedAt: existing.completedAt
          };
        }
      }

      store.set(key, {
        status: 'IN_PROGRESS',
        startedAt: Date.now(),
        expiresAt: Date.now() + ttlMs
      });

      return { acquired: true, key };
    },

    /**
     * Commits the completed result to the cache.
     */
    commit(key, result) {
      const existing = store.get(key);
      if (existing) {
        existing.status = 'COMPLETED';
        existing.result = result;
        existing.completedAt = new Date().toISOString();
      }
    },

    /**
     * Releases or deletes the lock in case of an abort or error.
     */
    release(key) {
      store.delete(key);
    },

    has(key) {
      return store.has(key);
    }
  });
}
