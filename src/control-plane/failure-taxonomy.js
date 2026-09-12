/**
 * ONLUNET ZEKA - Failure Taxonomy & Error Normalizer
 * FAZ 59 Foundation: Standardized Error Classification for AI Control Plane
 *
 * Implements 15 normalized failure classes with retryability,
 * fallback permission, security relevance, and user visibility attributes.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */

export const FailureCodes = Object.freeze({
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  CAPABILITY_MISMATCH: 'CAPABILITY_MISMATCH',
  CONTENT_POLICY: 'CONTENT_POLICY',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
  SECURITY_BLOCKED: 'SECURITY_BLOCKED',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  CREDENTIALS_UNCONFIGURED: 'CREDENTIALS_UNCONFIGURED'
});

export const FailureTaxonomy = Object.freeze({
  [FailureCodes.AUTHENTICATION_ERROR]: Object.freeze({
    code: FailureCodes.AUTHENTICATION_ERROR,
    retryable: false,
    fallbackAllowed: true,
    securityRelevant: true,
    userVisible: true,
    description: 'Upstream provider rejected credentials (401 / Invalid API Key).'
  }),
  [FailureCodes.AUTHORIZATION_ERROR]: Object.freeze({
    code: FailureCodes.AUTHORIZATION_ERROR,
    retryable: false,
    fallbackAllowed: false,
    securityRelevant: true,
    userVisible: true,
    description: 'Access to model or feature is forbidden (403 / Permission Denied).'
  }),
  [FailureCodes.RATE_LIMIT]: Object.freeze({
    code: FailureCodes.RATE_LIMIT,
    retryable: true,
    fallbackAllowed: true,
    securityRelevant: false,
    userVisible: true,
    description: 'Provider throughput rate limit or token quota reached (429).'
  }),
  [FailureCodes.TIMEOUT]: Object.freeze({
    code: FailureCodes.TIMEOUT,
    retryable: true,
    fallbackAllowed: true,
    securityRelevant: false,
    userVisible: true,
    description: 'Request exceeded hard socket deadline or AbortSignal timeout.'
  }),
  [FailureCodes.NETWORK_ERROR]: Object.freeze({
    code: FailureCodes.NETWORK_ERROR,
    retryable: true,
    fallbackAllowed: true,
    securityRelevant: false,
    userVisible: true,
    description: 'TCP connection reset, DNS lookup failure, or broken pipe.'
  }),
  [FailureCodes.INVALID_REQUEST]: Object.freeze({
    code: FailureCodes.INVALID_REQUEST,
    retryable: false,
    fallbackAllowed: false,
    securityRelevant: false,
    userVisible: true,
    description: 'Client sent invalid payload, unsupported parameters, or bad schema (400).'
  }),
  [FailureCodes.MODEL_UNAVAILABLE]: Object.freeze({
    code: FailureCodes.MODEL_UNAVAILABLE,
    retryable: false,
    fallbackAllowed: true,
    securityRelevant: false,
    userVisible: true,
    description: 'Requested AI model ID is retired, unlisted, or decommissioned.'
  }),
  [FailureCodes.CAPABILITY_MISMATCH]: Object.freeze({
    code: FailureCodes.CAPABILITY_MISMATCH,
    retryable: false,
    fallbackAllowed: true,
    securityRelevant: false,
    userVisible: true,
    description: 'No registered provider satisfies the agent required capabilities.'
  }),
  [FailureCodes.CONTENT_POLICY]: Object.freeze({
    code: FailureCodes.CONTENT_POLICY,
    retryable: false,
    fallbackAllowed: false,
    securityRelevant: true,
    userVisible: true,
    description: 'Upstream safety filter or internal content policy violation.'
  }),
  [FailureCodes.PROVIDER_ERROR]: Object.freeze({
    code: FailureCodes.PROVIDER_ERROR,
    retryable: true,
    fallbackAllowed: true,
    securityRelevant: false,
    userVisible: true,
    description: 'Upstream server crash, gateway timeout, or 5xx outage.'
  }),
  [FailureCodes.MALFORMED_RESPONSE]: Object.freeze({
    code: FailureCodes.MALFORMED_RESPONSE,
    retryable: true,
    fallbackAllowed: true,
    securityRelevant: true,
    userVisible: true,
    description: 'Upstream returned invalid JSON, truncated bytes, or corrupted schema.'
  }),
  [FailureCodes.SECURITY_BLOCKED]: Object.freeze({
    code: FailureCodes.SECURITY_BLOCKED,
    retryable: false,
    fallbackAllowed: false,
    securityRelevant: true,
    userVisible: true,
    description: 'Operation rejected by security policy (SSRF, injection, privilege escalation).'
  }),
  [FailureCodes.BUDGET_EXCEEDED]: Object.freeze({
    code: FailureCodes.BUDGET_EXCEEDED,
    retryable: false,
    fallbackAllowed: false,
    securityRelevant: true,
    userVisible: true,
    description: 'Cost, token, call, or time budget limit exceeded.'
  }),
  [FailureCodes.CIRCUIT_OPEN]: Object.freeze({
    code: FailureCodes.CIRCUIT_OPEN,
    retryable: false,
    fallbackAllowed: true,
    securityRelevant: false,
    userVisible: true,
    description: 'Circuit breaker is OPEN due to repeated upstream failures.'
  }),
  [FailureCodes.CREDENTIALS_UNCONFIGURED]: Object.freeze({
    code: FailureCodes.CREDENTIALS_UNCONFIGURED,
    retryable: false,
    fallbackAllowed: true,
    securityRelevant: false,
    userVisible: true,
    description: 'API key or auth token not configured in environment (Honest audit state).'
  })
});

/**
 * Normalizes any Error or error-like object into a standardized FailureTaxonomy entry.
 */
export function normalizeFailure(err, context = {}) {
  if (!err) {
    return {
      code: FailureCodes.PROVIDER_ERROR,
      ...FailureTaxonomy[FailureCodes.PROVIDER_ERROR],
      message: 'Unknown failure occurred',
      timestamp: new Date().toISOString()
    };
  }

  const rawCode = err.code || '';
  const rawStatus = err.status || (err.response && err.response.status) || 0;
  const rawMessage = typeof err.message === 'string' ? err.message : String(err);
  const lowerMsg = rawMessage.toLowerCase();

  let code = FailureCodes.PROVIDER_ERROR;

  if (rawCode === 'CREDENTIALS_UNCONFIGURED' || lowerMsg.includes('unconfigured') || lowerMsg.includes('missing api key')) {
    code = FailureCodes.CREDENTIALS_UNCONFIGURED;
  } else if (rawCode === 'CIRCUIT_BREAKER_OPEN' || rawCode === 'PROVIDER_CIRCUIT_OPEN' || lowerMsg.includes('circuit breaker is open')) {
    code = FailureCodes.CIRCUIT_OPEN;
  } else if (rawCode === 'BUDGET_EXCEEDED' || lowerMsg.includes('budget exceeded') || lowerMsg.includes('budget exhausted')) {
    code = FailureCodes.BUDGET_EXCEEDED;
  } else if (rawCode === 'SECURITY_BLOCKED' || lowerMsg.includes('[security_blocked]') || lowerMsg.includes('blocked by policy')) {
    code = FailureCodes.SECURITY_BLOCKED;
  } else if (rawCode === 'CAPABILITY_MISMATCH' || lowerMsg.includes('capability mismatch') || lowerMsg.includes('unsupported capability')) {
    code = FailureCodes.CAPABILITY_MISMATCH;
  } else if (rawCode === 'TIMEOUT' || err.name === 'AbortError' || lowerMsg.includes('timeout') || lowerMsg.includes('aborted')) {
    code = FailureCodes.TIMEOUT;
  } else if (rawStatus === 401 || lowerMsg.includes('unauthorized') || lowerMsg.includes('invalid api key')) {
    code = FailureCodes.AUTHENTICATION_ERROR;
  } else if (rawStatus === 403 || lowerMsg.includes('forbidden') || lowerMsg.includes('access denied')) {
    code = FailureCodes.AUTHORIZATION_ERROR;
  } else if (rawStatus === 429 || rawCode === 'RATE_LIMITED' || lowerMsg.includes('rate limit')) {
    code = FailureCodes.RATE_LIMIT;
  } else if (rawCode === 'PROVIDER_INVALID_RESPONSE' || lowerMsg.includes('malformed') || lowerMsg.includes('syntaxerror') || lowerMsg.includes('unexpected token')) {
    code = FailureCodes.MALFORMED_RESPONSE;
  } else if (rawStatus === 400 || rawCode === 'INVALID_REQUEST' || lowerMsg.includes('bad request')) {
    code = FailureCodes.INVALID_REQUEST;
  } else if (lowerMsg.includes('econnrefused') || lowerMsg.includes('enotfound') || lowerMsg.includes('network') || lowerMsg.includes('fetch failed')) {
    code = FailureCodes.NETWORK_ERROR;
  } else if (FailureTaxonomy[rawCode]) {
    code = rawCode;
  }

  const meta = FailureTaxonomy[code] || FailureTaxonomy[FailureCodes.PROVIDER_ERROR];

  return Object.freeze({
    code,
    retryable: meta.retryable,
    fallbackAllowed: meta.fallbackAllowed,
    securityRelevant: meta.securityRelevant,
    userVisible: meta.userVisible,
    description: meta.description,
    message: rawMessage,
    context: Object.freeze({ ...context }),
    timestamp: new Date().toISOString()
  });
}
