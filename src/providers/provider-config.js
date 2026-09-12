/**
 * ONLUNET ZEKA - Canonical Provider Configuration Schema
 * FAZ 62 Foundation: Credential Reference & Policy Validation
 *
 * Strict Rule: Raw API keys are forbidden in configuration.
 * Only `credentialRef` (e.g. environment variable name or secret vault key) is allowed.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';

export function validateProviderConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Provider configuration must be a non-null object`);
  }

  const { providerId, credentialRef, endpoint } = config;

  if (!providerId || typeof providerId !== 'string' || providerId.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Provider configuration requires providerId`);
  }

  // Reject raw keys passed as values
  for (const [key, val] of Object.entries(config)) {
    if (typeof val === 'string' && (val.startsWith('sk-') || val.startsWith('AIzaSy') || val.startsWith('Bearer '))) {
      throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Raw secret detected in config property '${key}'. Use credentialRef instead.`);
    }
  }

  return Object.freeze({
    providerId: providerId.trim(),
    enabled: config.enabled !== undefined ? Boolean(config.enabled) : true,
    credentialRef: credentialRef ? String(credentialRef).trim() : null,
    endpoint: endpoint ? String(endpoint).trim() : null,
    defaultModel: config.defaultModel ? String(config.defaultModel).trim() : 'default',
    timeoutMs: typeof config.timeoutMs === 'number' ? config.timeoutMs : 15000,
    priority: config.priority || 'PRIMARY',
    capabilities: Object.freeze(Array.isArray(config.capabilities) ? [...config.capabilities] : []),
    validatedAt: new Date().toISOString()
  });
}
