/**
 * ONLUNET ZEKA - Multi-Account Credential Pool & Intelligent Quota Management
 * FAZ 66.10 Architecture: Multi-Account Credential Rotation, Health Tracking, Cooldown & Quota Isolation
 *
 * Implements:
 * - Decoupled Credential Identity (gemini-account-01, gemini-account-02...)
 * - Non-reversible cryptographic SHA-256 fingerprinting (Zero Secret Exposure)
 * - Fine-grained health states (HEALTHY, DEGRADED, RATE_LIMITED, QUOTA_EXCEEDED, AUTH_FAILED, TIMEOUT, COOLDOWN, DISABLED)
 * - Provider-aware, cooldown-aware, concurrency-safe credential rotation
 * - Zero Quota Circumvention: Operates strictly within user-authorized accounts without policy bypass
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js crypto only.
 */
import crypto from 'node:crypto';
import { sanitizeString } from './credential-sanitizer.js';

export const CredentialHealthStatus = Object.freeze({
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  AUTH_FAILED: 'AUTH_FAILED',
  NETWORK_FAILED: 'NETWORK_FAILED',
  TIMEOUT: 'TIMEOUT',
  COOLDOWN: 'COOLDOWN',
  DISABLED: 'DISABLED'
});

/**
 * Computes non-secret, non-reversible SHA-256 fingerprint prefix for telemetry
 */
export function computeCredentialFingerprint(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') return null;
  return crypto.createHash('sha256').update(apiKey.trim()).digest('hex').slice(0, 12);
}

/**
 * Creates the Multi-Account Credential Pool
 */
export function createCredentialPool({
  autoDiscoverEnv = true,
  defaultCooldownMs = 15000,
  defaultMaxConcurrent = 5,
  now = () => Date.now()
} = {}) {
  // Key format: `${normProvider}:${normCredentialId}`
  const pool = new Map();
  const recentRateLimits = []; // { providerId, credentialId, timestamp }

  function makeKey(providerId, credentialId) {
    const p = String(providerId || 'default').trim().toLowerCase();
    const c = String(credentialId || 'primary').trim();
    return `${p}:${c}`;
  }

  function registerCredential({
    providerId,
    credentialId,
    apiKey,
    priority = 1,
    maxConcurrentRequests = defaultMaxConcurrent,
    isPaid = false,
    metadata = {}
  }) {
    if (!providerId || typeof providerId !== 'string') {
      throw new Error('Credential registration requires non-empty providerId');
    }
    if (!credentialId || typeof credentialId !== 'string') {
      throw new Error('Credential registration requires non-empty credentialId');
    }
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new Error('Credential registration requires non-empty apiKey');
    }

    const normProvider = String(providerId).trim().toLowerCase();
    const cleanId = String(credentialId).trim();
    const rawKey = apiKey.trim();
    const fingerprint = computeCredentialFingerprint(rawKey);

    const entry = {
      providerId: normProvider,
      credentialId: cleanId,
      accountId: cleanId,
      apiKey: rawKey,
      fingerprint,
      priority: Number(priority) || 1,
      maxConcurrentRequests: Math.max(1, Number(maxConcurrentRequests) || defaultMaxConcurrent),
      inFlightRequests: 0,
      isPaid: Boolean(isPaid),
      health: CredentialHealthStatus.HEALTHY,
      healthReason: null,
      cooldownUntil: 0,
      modelHealth: new Map(),
      enabled: true,
      dispatchCount: 0,
      requests: 0,
      tokens: { input: 0, output: 0, total: 0 },
      estimatedCost: 0,
      successCount: 0,
      failureCount: 0,
      rateLimitCount: 0,
      quotaExceededCount: 0,
      consecutiveFailures: 0,
      lastDispatchAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastUsedAt: null,
      lastLatencyMs: null,
      averageLatency: 0,
      quotaRemaining: 'UNKNOWN',
      metadata: { ...metadata },
      registeredAt: new Date(now()).toISOString()
    };

    const key = makeKey(normProvider, cleanId);
    pool.set(key, entry);

    // Cross-alias for google <-> gemini
    if (normProvider === 'gemini') {
      pool.set(makeKey('google', cleanId), entry);
    } else if (normProvider === 'google') {
      pool.set(makeKey('gemini', cleanId), entry);
    }

    return Object.freeze({
      providerId: normProvider,
      credentialId: cleanId,
      accountId: cleanId,
      fingerprint,
      priority: entry.priority,
      maxConcurrentRequests: entry.maxConcurrentRequests,
      health: entry.health,
      enabled: entry.enabled
    });
  }

  function removeCredential(providerId, credentialId) {
    const key = makeKey(providerId, credentialId);
    const deleted = pool.delete(key);
    const p = String(providerId).toLowerCase();
    if (p === 'gemini') pool.delete(makeKey('google', credentialId));
    if (p === 'google') pool.delete(makeKey('gemini', credentialId));
    return deleted;
  }

  function getCredential(providerId, credentialId) {
    const key = makeKey(providerId, credentialId);
    const entry = pool.get(key);
    if (!entry) return null;

    // Check cooldown expiry dynamically
    checkCooldownExpiry(entry);

    return entry;
  }

  function checkCooldownExpiry(entry) {
    if (!entry) return;
    if (entry.health === CredentialHealthStatus.COOLDOWN || entry.health === CredentialHealthStatus.RATE_LIMITED) {
      if (entry.cooldownUntil && now() >= entry.cooldownUntil) {
        entry.health = CredentialHealthStatus.HEALTHY;
        entry.healthReason = 'COOLDOWN_EXPIRED';
        entry.cooldownUntil = 0;
      }
    }
  }

  function isAvailable(providerId, credentialId) {
    const entry = getCredential(providerId, credentialId);
    if (!entry || !entry.enabled) return false;
    if (entry.health === CredentialHealthStatus.AUTH_FAILED) return false;
    if (entry.health === CredentialHealthStatus.QUOTA_EXCEEDED) return false;
    if (entry.health === CredentialHealthStatus.DISABLED) return false;
    if (entry.health === CredentialHealthStatus.COOLDOWN || entry.health === CredentialHealthStatus.RATE_LIMITED) {
      return now() >= (entry.cooldownUntil || 0);
    }
    if (entry.inFlightRequests >= entry.maxConcurrentRequests) return false;
    return true;
  }

  function listCredentials({ providerId = null, includeSecrets = false } = {}) {
    const normProvider = providerId ? String(providerId).trim().toLowerCase() : null;
    const seen = new Set();
    const result = [];

    for (const [key, entry] of pool.entries()) {
      checkCooldownExpiry(entry);
      if (normProvider) {
        const matchesDirect = entry.providerId === normProvider;
        const matchesAlias = (normProvider === 'google' && entry.providerId === 'gemini') || (normProvider === 'gemini' && entry.providerId === 'google');
        if (!matchesDirect && !matchesAlias) continue;
      }
      
      const effectiveProvider = normProvider || entry.providerId;
      const uniqueKey = `${effectiveProvider}:${entry.credentialId}`;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);

      const safeObj = {
        providerId: effectiveProvider,
        credentialId: entry.credentialId,
        accountId: entry.credentialId,
        fingerprint: entry.fingerprint,
        priority: entry.priority,
        maxConcurrentRequests: entry.maxConcurrentRequests,
        inFlightRequests: entry.inFlightRequests,
        health: entry.health,
        healthReason: entry.healthReason,
        cooldownUntil: entry.cooldownUntil,
        enabled: entry.enabled,
        dispatchCount: entry.dispatchCount,
        requests: entry.requests,
        tokens: { ...entry.tokens },
        estimatedCost: entry.estimatedCost,
        lastUsedAt: entry.lastUsedAt,
        successCount: entry.successCount,
        failureCount: entry.failureCount,
        rateLimitCount: entry.rateLimitCount,
        quotaExceededCount: entry.quotaExceededCount,
        lastLatencyMs: entry.lastLatencyMs,
        averageLatency: entry.averageLatency,
        quotaRemaining: entry.quotaRemaining,
        isPaid: Boolean(entry.isPaid),
        isAvailable: isAvailable(entry.providerId, entry.credentialId)
      };

      if (includeSecrets) {
        safeObj.apiKey = entry.apiKey;
      }

      result.push(Object.freeze(safeObj));
    }

    return Object.freeze(result);
  }

  function getHealthyCredentials(providerId) {
    return listCredentials({ providerId }).filter(c => c.isAvailable);
  }

  function markHealthy(providerId, credentialId) {
    const entry = getCredential(providerId, credentialId);
    if (!entry) return false;
    entry.health = CredentialHealthStatus.HEALTHY;
    entry.healthReason = null;
    entry.cooldownUntil = 0;
    entry.consecutiveFailures = 0;
    return true;
  }

  function markRateLimited(providerId, credentialId, { retryAfterMs = null, cooldownMs = defaultCooldownMs } = {}) {
    const entry = getCredential(providerId, credentialId);
    if (!entry) return false;

    const duration = (typeof retryAfterMs === 'number' && retryAfterMs > 0)
      ? retryAfterMs
      : (typeof cooldownMs === 'number' && cooldownMs > 0 ? cooldownMs : defaultCooldownMs);

    entry.health = CredentialHealthStatus.RATE_LIMITED;
    entry.healthReason = 'RATE_LIMITED_HTTP_429';
    entry.cooldownUntil = now() + duration;
    entry.failureCount += 1;
    entry.rateLimitCount = (entry.rateLimitCount || 0) + 1;
    entry.consecutiveFailures += 1;
    entry.lastFailureAt = new Date(now()).toISOString();
    return true;
  }

  function markQuotaExceeded(providerId, credentialId) {
    const entry = getCredential(providerId, credentialId);
    if (!entry) return false;
    entry.health = CredentialHealthStatus.QUOTA_EXCEEDED;
    entry.healthReason = 'QUOTA_EXHAUSTED';
    entry.cooldownUntil = now() + (defaultCooldownMs * 4);
    entry.failureCount += 1;
    entry.quotaExceededCount = (entry.quotaExceededCount || 0) + 1;
    entry.consecutiveFailures += 1;
    entry.lastFailureAt = new Date(now()).toISOString();
    return true;
  }

  function markNetworkFailed(providerId, credentialId, reason = null) {
    const entry = getCredential(providerId, credentialId);
    if (!entry) return false;
    entry.health = CredentialHealthStatus.NETWORK_FAILED;
    entry.healthReason = reason ? String(reason) : 'NETWORK_FAILED';
    entry.cooldownUntil = now() + Math.min(defaultCooldownMs, 10000);
    entry.failureCount += 1;
    entry.consecutiveFailures += 1;
    entry.lastFailureAt = new Date(now()).toISOString();
    return true;
  }

  function markAuthFailed(providerId, credentialId) {
    const entry = getCredential(providerId, credentialId);
    if (!entry) return false;
    entry.health = CredentialHealthStatus.AUTH_FAILED;
    entry.healthReason = 'AUTHENTICATION_FAILED_HTTP_401';
    entry.failureCount += 1;
    entry.consecutiveFailures += 1;
    entry.lastFailureAt = new Date(now()).toISOString();
    return true;
  }

  function markTimeout(providerId, credentialId, reason = null) {
    const entry = getCredential(providerId, credentialId);
    if (!entry) return false;
    entry.failureCount += 1;
    entry.consecutiveFailures += 1;
    entry.lastFailureAt = new Date(now()).toISOString();
    entry.health = CredentialHealthStatus.TIMEOUT;
    entry.healthReason = reason ? String(reason) : 'TRANSIENT_TIMEOUT';
    entry.cooldownUntil = now() + Math.min(defaultCooldownMs, 10000);
    return true;
  }

  function markDegraded(providerId, credentialId, reason = null) {
    const entry = getCredential(providerId, credentialId);
    if (!entry) return false;
    entry.health = CredentialHealthStatus.DEGRADED;
    entry.healthReason = reason ? String(reason) : 'DEGRADED';
    entry.failureCount += 1;
    entry.lastFailureAt = new Date(now()).toISOString();
    return true;
  }

  function enterCooldown(providerId, credentialId, cooldownMs = defaultCooldownMs) {
    const entry = getCredential(providerId, credentialId);
    if (!entry) return false;
    const duration = Math.max(1000, Number(cooldownMs) || defaultCooldownMs);
    entry.health = CredentialHealthStatus.COOLDOWN;
    entry.healthReason = 'MANUAL_COOLDOWN';
    entry.cooldownUntil = now() + duration;
    return true;
  }

  function markModelHealth(providerId, credentialId, modelId, health, reason = null, options = {}) {
    const entry = getCredential(providerId, credentialId);
    if (!entry || !modelId) return false;
    const cleanModel = String(modelId).trim();
    const duration = (options && typeof options.cooldownMs === 'number' && options.cooldownMs > 0)
      ? options.cooldownMs
      : defaultCooldownMs;
    const cooldownUntil = (health === CredentialHealthStatus.RATE_LIMITED || health === CredentialHealthStatus.COOLDOWN)
      ? now() + duration
      : (health === CredentialHealthStatus.QUOTA_EXCEEDED ? now() + (defaultCooldownMs * 4) : 0);

    if (health === CredentialHealthStatus.RATE_LIMITED) {
      recentRateLimits.push({ providerId: String(providerId).toLowerCase(), credentialId: entry.credentialId, timestamp: now() });
      entry.rateLimitCount = (entry.rateLimitCount || 0) + 1;
    } else if (health === CredentialHealthStatus.QUOTA_EXCEEDED) {
      recentRateLimits.push({ providerId: String(providerId).toLowerCase(), credentialId: entry.credentialId, timestamp: now() });
      entry.quotaExceededCount = (entry.quotaExceededCount || 0) + 1;
    }

    entry.modelHealth.set(cleanModel, Object.freeze({
      modelId: cleanModel,
      health,
      reason: reason || null,
      cooldownUntil,
      updatedAt: new Date(now()).toISOString()
    }));
    return true;
  }

  function markModelRateLimited(providerId, credentialId, modelId, reason = null, cooldownMs = defaultCooldownMs) {
    return markModelHealth(providerId, credentialId, modelId, CredentialHealthStatus.RATE_LIMITED, reason || 'RATE_LIMITED_429', { cooldownMs });
  }

  function markModelQuotaExceeded(providerId, credentialId, modelId, reason = null) {
    return markModelHealth(providerId, credentialId, modelId, CredentialHealthStatus.QUOTA_EXCEEDED, reason || 'QUOTA_EXCEEDED_429');
  }

  function markModelHealthy(providerId, credentialId, modelId) {
    return markModelHealth(providerId, credentialId, modelId, CredentialHealthStatus.HEALTHY, null);
  }

  function getModelHealth(providerId, credentialId, modelId) {
    const entry = getCredential(providerId, credentialId);
    if (!entry) return CredentialHealthStatus.DISABLED;

    // 1. Account-level terminal states isolate all models for this account
    if (entry.health === CredentialHealthStatus.AUTH_FAILED) return CredentialHealthStatus.AUTH_FAILED;
    if (entry.health === CredentialHealthStatus.DISABLED) return CredentialHealthStatus.DISABLED;
    if (entry.health === CredentialHealthStatus.QUOTA_EXCEEDED) return CredentialHealthStatus.QUOTA_EXCEEDED;

    // 2. Model-specific health check
    if (modelId && entry.modelHealth && entry.modelHealth.has(String(modelId).trim())) {
      const mh = entry.modelHealth.get(String(modelId).trim());
      if (mh.cooldownUntil && mh.cooldownUntil > now()) {
        return mh.health;
      }
      if (mh.health === CredentialHealthStatus.AUTH_FAILED || mh.health === CredentialHealthStatus.QUOTA_EXCEEDED) {
        return mh.health;
      }
      return CredentialHealthStatus.HEALTHY;
    }

    // 3. Fallback: If a specific model is queried and entry.modelHealth tracks other models, this model is healthy
    if (modelId && entry.modelHealth && entry.modelHealth.size > 0) {
      return CredentialHealthStatus.HEALTHY;
    }

    // 4. Fallback to entry health if whole credential was marked in cooldown/rate-limited
    if (entry.cooldownUntil && entry.cooldownUntil > now()) {
      return entry.health;
    }
    return entry.health;
  }

  function isCandidateAvailable(providerId, credentialId, modelId) {
    const entry = getCredential(providerId, credentialId);
    if (!entry || !entry.enabled) return false;
    const h = getModelHealth(providerId, credentialId, modelId);
    if (h === CredentialHealthStatus.AUTH_FAILED || h === CredentialHealthStatus.QUOTA_EXCEEDED || h === CredentialHealthStatus.DISABLED) {
      return false;
    }
    if (h === CredentialHealthStatus.RATE_LIMITED || h === CredentialHealthStatus.COOLDOWN) {
      return false;
    }
    return true;
  }

  function isSharedQuotaSuspected(providerId) {
    const p = String(providerId).toLowerCase();
    const cutoff = now() - 60000;
    const active = recentRateLimits.filter(r => (r.providerId === p || (p === 'gemini' && r.providerId === 'google') || (p === 'google' && r.providerId === 'gemini')) && r.timestamp >= cutoff);
    const uniqueAccounts = new Set(active.map(r => r.credentialId));
    return uniqueAccounts.size >= 2;
  }

  function acquireConcurrency(providerId, credentialId) {
    const entry = getCredential(providerId, credentialId);
    if (!entry || !isAvailable(providerId, credentialId)) return false;
    entry.inFlightRequests += 1;
    entry.dispatchCount += 1;
    entry.lastDispatchAt = new Date(now()).toISOString();
    return true;
  }

  function releaseConcurrency(providerId, credentialId) {
    const entry = getCredential(providerId, credentialId);
    if (!entry) return false;
    entry.inFlightRequests = Math.max(0, entry.inFlightRequests - 1);
    return true;
  }

  function recordSuccess(providerId, credentialId, latencyMs = null) {
    const entry = getCredential(providerId, credentialId);
    if (!entry) return false;
    entry.successCount += 1;
    entry.consecutiveFailures = 0;
    entry.lastSuccessAt = new Date(now()).toISOString();
    if (typeof latencyMs === 'number' && latencyMs >= 0) {
      entry.lastLatencyMs = latencyMs;
    }
    if (entry.health === CredentialHealthStatus.DEGRADED || entry.health === CredentialHealthStatus.TIMEOUT) {
      entry.health = CredentialHealthStatus.HEALTHY;
      entry.healthReason = null;
    }
    return true;
  }

  function recordAccountUsage(providerId, credentialId, { inputTokens = 0, outputTokens = 0, cost = 0, latencyMs = 0, status = 'SUCCESS' } = {}) {
    const entry = getCredential(providerId, credentialId);
    if (!entry) return false;
    entry.requests += 1;
    entry.lastUsedAt = new Date(now()).toISOString();
    const inTok = Number(inputTokens) || 0;
    const outTok = Number(outputTokens) || 0;
    entry.tokens.input += inTok;
    entry.tokens.output += outTok;
    entry.tokens.total += (inTok + outTok);
    entry.estimatedCost += (Number(cost) || 0);
    if (typeof latencyMs === 'number' && latencyMs > 0) {
      entry.averageLatency = entry.averageLatency === 0
        ? latencyMs
        : Number(((entry.averageLatency * 0.7) + (latencyMs * 0.3)).toFixed(2));
    }
    return true;
  }

  function getAccountStats(providerId, credentialId = null) {
    if (credentialId) {
      const entry = getCredential(providerId, credentialId);
      if (!entry) return null;
      return Object.freeze({
        providerId: entry.providerId,
        credentialId: entry.credentialId,
        accountId: entry.credentialId,
        requests: entry.requests,
        tokens: { ...entry.tokens },
        estimatedCost: entry.estimatedCost,
        lastUsedAt: entry.lastUsedAt,
        successCount: entry.successCount,
        failureCount: entry.failureCount,
        rateLimitCount: entry.rateLimitCount,
        quotaExceededCount: entry.quotaExceededCount,
        averageLatency: entry.averageLatency,
        quotaRemaining: entry.quotaRemaining,
        health: entry.health,
        isAvailable: isAvailable(entry.providerId, entry.credentialId)
      });
    }

    const creds = listCredentials({ providerId });
    return creds.map(c => getAccountStats(providerId, c.credentialId));
  }

  function getCredentialPoolStatus(providerId = null) {
    const normProv = providerId ? String(providerId).trim().toLowerCase() : null;
    const accounts = [];
    const seenCredKeys = new Set();

    for (const [key, entry] of pool.entries()) {
      if (normProv && entry.providerId !== normProv && !(normProv === 'gemini' && entry.providerId === 'google') && !(normProv === 'google' && entry.providerId === 'gemini')) {
        continue;
      }
      const credKey = `${entry.providerId}:${entry.credentialId}`;
      if (seenCredKeys.has(credKey)) continue;
      seenCredKeys.add(credKey);

      checkCooldownExpiry(entry);

      const isAvail = isAvailable(entry.providerId, entry.credentialId);
      const cooldownActive = entry.health === CredentialHealthStatus.COOLDOWN || (entry.cooldownUntil && now() < entry.cooldownUntil);
      const cooldownRemainingMs = cooldownActive ? Math.max(0, entry.cooldownUntil - now()) : 0;

      const modelsStatus = {};
      if (entry.modelHealth) {
        for (const [mId, mHealth] of entry.modelHealth.entries()) {
          modelsStatus[mId] = {
            health: mHealth.health,
            isAvailable: isCandidateAvailable(entry.providerId, entry.credentialId, mId),
            lastError: mHealth.reason || null
          };
        }
      }

      accounts.push(Object.freeze({
        accountId: entry.credentialId,
        credentialId: entry.credentialId,
        providerId: entry.providerId,
        fingerprint: entry.fingerprint,
        health: entry.health,
        healthReason: entry.healthReason,
        isAvailable: isAvail,
        requests: entry.requests,
        dispatchCount: entry.dispatchCount,
        tokens: { ...entry.tokens },
        estimatedCost: entry.estimatedCost,
        quota: entry.health === CredentialHealthStatus.QUOTA_EXCEEDED ? 'EXHAUSTED' : 'AVAILABLE',
        quotaRemaining: entry.quotaRemaining,
        cooldownActive: Boolean(cooldownActive),
        cooldownRemainingMs,
        latency: entry.lastLatencyMs ? `${(entry.lastLatencyMs / 1000).toFixed(2)}s` : 'N/A',
        averageLatency: entry.averageLatency,
        lastLatencyMs: entry.lastLatencyMs,
        successCount: entry.successCount,
        failureCount: entry.failureCount,
        rateLimitCount: entry.rateLimitCount,
        quotaExceededCount: entry.quotaExceededCount,
        models: modelsStatus
      }));
    }

    return Object.freeze({
      providerId: normProv || 'all',
      totalAccounts: accounts.length,
      healthyAccounts: accounts.filter(a => a.health === CredentialHealthStatus.HEALTHY).length,
      availableAccounts: accounts.filter(a => a.isAvailable).length,
      accounts: Object.freeze(accounts)
    });
  }

  // Automatically scan process.env for multiple credentials if enabled
  if (autoDiscoverEnv && typeof process !== 'undefined' && process.env) {
    if (typeof process.loadEnvFile === 'function') {
      try { process.loadEnvFile('.env'); } catch {}
    }

    const envKeys = Object.keys(process.env);

    // 1. Scan for multi-account pattern: GEMINI_ACCOUNT_XX_API_KEY / GEMINI_ACCOUNT_XX_KEY / GEMINI_API_KEY_XX
    const geminiAccounts = [];
    for (const key of envKeys) {
      const m1 = key.match(/^GEMINI_ACCOUNT_([0-9A-Za-z_-]+)_API_KEY$/i);
      const m2 = key.match(/^GEMINI_API_KEY_([0-9A-Za-z_-]+)$/i);
      const m3 = key.match(/^GOOGLE_API_KEY_([0-9A-Za-z_-]+)$/i);
      const m4 = key.match(/^GEMINI_ACCOUNT_([0-9A-Za-z_-]+)_KEY$/i);
      const m5 = key.match(/^GEMINI_ACCOUNT_([0-9A-Za-z_-]+)$/i);
      const m6 = key.match(/^GOOGLE_ACCOUNT_([0-9A-Za-z_-]+)_API_KEY$/i);

      const m = m1 || m2 || m3 || m4 || m5 || m6;
      if (m) {
        const rawPart = m[1].toLowerCase();
        const accId = `gemini-account-${rawPart}`;
        geminiAccounts.push({ id: accId, key: process.env[key], rawPart });
      }
    }

    // Natural sort: numeric sort if both are numbers (account-2 before account-10)
    geminiAccounts.sort((a, b) => {
      const numA = parseInt(a.rawPart, 10);
      const numB = parseInt(b.rawPart, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.id.localeCompare(b.id);
    });

    if (geminiAccounts.length > 0) {
      for (let i = 0; i < geminiAccounts.length; i++) {
        const acc = geminiAccounts[i];
        if (acc.key && acc.key.trim() !== '') {
          registerCredential({
            providerId: 'gemini',
            credentialId: acc.id,
            apiKey: acc.key,
            priority: i + 1
          });
        }
      }
    } else {
      // Fallback to legacy single key as gemini-account-01 and gemini-account-1
      const legacyGemini = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (legacyGemini && legacyGemini.trim() !== '') {
        registerCredential({
          providerId: 'gemini',
          credentialId: 'gemini-account-01',
          apiKey: legacyGemini,
          priority: 1
        });
        const regEntry = pool.get(makeKey('gemini', 'gemini-account-01'));
        if (regEntry) {
          pool.set(makeKey('gemini', 'gemini-account-1'), regEntry);
          pool.set(makeKey('gemini', 'gemini-account-default'), regEntry);
          pool.set(makeKey('google', 'gemini-account-1'), regEntry);
          pool.set(makeKey('google', 'gemini-account-default'), regEntry);
        }
      }
    }

    // 2. Scan other providers if present
    if (process.env.GROQ_API_KEY) {
      registerCredential({
        providerId: 'groq',
        credentialId: 'groq-account-01',
        apiKey: process.env.GROQ_API_KEY,
        priority: 1
      });
    }
    if (process.env.OPENROUTER_API_KEY) {
      registerCredential({
        providerId: 'openrouter',
        credentialId: 'openrouter-account-01',
        apiKey: process.env.OPENROUTER_API_KEY,
        priority: 1
      });
    }
    if (process.env.OPENAI_API_KEY) {
      registerCredential({
        providerId: 'openai',
        credentialId: 'openai-account-01',
        apiKey: process.env.OPENAI_API_KEY,
        priority: 1
      });
    }
    if (process.env.NVIDIA_API_KEY) {
      registerCredential({
        providerId: 'nvidia',
        credentialId: 'nvidia-account-01',
        apiKey: process.env.NVIDIA_API_KEY,
        priority: 1
      });
    }
    if (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY) {
      registerCredential({
        providerId: 'kimi',
        credentialId: 'kimi-account-01',
        apiKey: process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY,
        priority: 1
      });
    }
  }

  return Object.freeze({
    registerCredential,
    removeCredential,
    getCredential,
    listCredentials,
    getHealthyCredentials,
    markHealthy,
    markRateLimited,
    markQuotaExceeded,
    markAuthFailed,
    markNetworkFailed,
    markTimeout,
    markDegraded,
    enterCooldown,
    isAvailable,
    acquireConcurrency,
    releaseConcurrency,
    recordSuccess,
    recordAccountUsage,
    getAccountStats,
    getCredentialPoolStatus,
    markModelHealth,
    markModelRateLimited,
    markModelQuotaExceeded,
    markModelHealthy,
    getModelHealth,
    isCandidateAvailable,
    isSharedQuotaSuspected,
    count() {
      return pool.size;
    }
  });
}
