/**
 * ONLUNET ZEKA - Provider Categories, Priority & Lifecycle States
 * FAZ 62 Foundation: Multi-Provider Classification
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */

export const ProviderCategories = Object.freeze({
  DIRECT: 'DIRECT',
  AGGREGATOR: 'AGGREGATOR',
  INFERENCE: 'INFERENCE',
  LOCAL: 'LOCAL',
  CUSTOM: 'CUSTOM'
});

export const ProviderPriority = Object.freeze({
  PRIMARY: 'PRIMARY',
  SECONDARY: 'SECONDARY',
  FALLBACK: 'FALLBACK',
  DISABLED: 'DISABLED'
});

export const LifecycleState = Object.freeze({
  CONFIGURED: 'CONFIGURED',
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  AVAILABLE: 'AVAILABLE',
  UNAVAILABLE: 'UNAVAILABLE',
  AUTH_FAILED: 'AUTH_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  DISABLED: 'DISABLED'
});

export const CostConfidence = Object.freeze({
  KNOWN: 'KNOWN',
  ESTIMATED: 'ESTIMATED',
  NOT_REPORTED: 'NOT_REPORTED',
  UNKNOWN: 'UNKNOWN'
});
