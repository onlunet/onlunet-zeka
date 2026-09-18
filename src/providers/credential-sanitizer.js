/**
 * ONLUNET ZEKA - AI Provider Gateway Credential Sanitizer
 * FAZ 58 Foundation: Strict Credential & Secret Isolation
 *
 * Scans, detects, and redacts sensitive API keys, authorization headers,
 * tokens, and secrets from strings, objects, error messages, and network logs.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */

const REDACTED_MARKER = '***REDACTED***';

// Regular expressions to detect common API key formats and sensitive tokens
const SECRET_REGEX_PATTERNS = [
  // OpenAI API Key
  /\bsk-[A-Za-z0-9_-]{20,}\b/g,
  // Anthropic API Key
  /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,
  // Google AI Studio / Gemini API Key
  /\bAIza[0-9A-Za-z\-_]{35}\b/g,
  // Generic Bearer tokens
  /\bBearer\s+[A-Za-z0-9._~+/-]{10,}=*\b/gi,
  // NVIDIA Build API Key
  /\bnvapi-[A-Za-z0-9_-]{20,}\b/g,
  // Groq API Key
  /\bgsk_[A-Za-z0-9_-]{20,}\b/g,
  // Generic private keys
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[^-]+-----END [A-Z ]+ PRIVATE KEY-----/gs,
  // Generic password/secret assignment patterns in strings
  /(?:api[_-]?key|secret|password|token|access[_-]?token)["']?\s*[:=]\s*["']?([A-Za-z0-9._~+/-]{8,})["']?/gi
];

const SENSITIVE_KEY_PATTERN = /^(api[_-]?key|secret|password|token|auth|authorization|private[_-]?key|access[_-]?token|refresh[_-]?token|jwt[_-]?secret|database[_-]?url|supabase[_-]?key)$/i;

/**
 * Redacts known sensitive patterns from a string.
 */
export function sanitizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }
  let result = str;

  // 1. OpenAI Keys
  result = result.replace(/\bsk-[A-Za-z0-9_-]{20,}\b/g, REDACTED_MARKER);

  // 2. Anthropic Keys
  result = result.replace(/\bsk-ant-[A-Za-z0-9_-]{20,}\b/g, REDACTED_MARKER);

  // 3. Google Keys & URL Query Keys
  result = result.replace(/\bAIza[0-9A-Za-z\-_]{30,45}\b/g, REDACTED_MARKER);
  result = result.replace(/\bMOCK_GEMINI_KEY_[0-9A-Za-z\-_]+\b/g, REDACTED_MARKER);
  result = result.replace(/([?&](?:key|api[_-]?key)=)[^&\s"']+/gi, `$1${REDACTED_MARKER}`);

  // 4. Supabase Keys
  result = result.replace(/\bsb[pa]_[A-Za-z0-9_-]{20,}\b/g, REDACTED_MARKER);

  // 4b. NVIDIA Build Keys
  result = result.replace(/\bnvapi-[A-Za-z0-9_-]{20,}\b/g, REDACTED_MARKER);

  // 4c. Groq Keys
  result = result.replace(/\bgsk_[A-Za-z0-9_-]{20,}\b/g, REDACTED_MARKER);

  // 5. JWT Tokens (header.payload.signature starting with eyJ)
  result = result.replace(/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, REDACTED_MARKER);

  // 6. Database Connection Strings (postgres, mysql, mongodb, redis with user:pass)
  result = result.replace(/((?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s"']+):([^@\s"']+)@/gi, `$1:${REDACTED_MARKER}@`);

  // 7. Bearer Tokens
  result = result.replace(/\bBearer\s+[A-Za-z0-9._~+/-]{10,}=*\b/gi, `Bearer ${REDACTED_MARKER}`);

  // 8. Private Keys
  result = result.replace(/-----BEGIN [A-Z ]+ PRIVATE KEY-----[^-]+-----END [A-Z ]+ PRIVATE KEY-----/gs, REDACTED_MARKER);

  // 9. Generic key assignments
  result = result.replace(/(api[_-]?key|secret|password|token|access[_-]?token)(["']?\s*[:=]\s*["']?)[A-Za-z0-9._~+/-]{8,}(["']?)/gi, `$1$2${REDACTED_MARKER}$3`);

  return result;
}

/**
 * Deeply sanitizes an object or array, masking values associated with sensitive keys
 * and scrubbing sensitive patterns from string values. Prevents prototype pollution and handles circular references.
 */
export function sanitizeObject(obj, seen = new WeakSet()) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // Prevent infinite loops on circular references
  if (seen.has(obj)) {
    return '[Circular Reference]';
  }
  seen.add(obj);

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, seen));
  }

  // Handle Error instances specially
  if (obj instanceof Error) {
    return sanitizeError(obj);
  }

  const sanitized = Object.create(null);

  for (const key of Object.keys(obj)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    const val = obj[key];
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = REDACTED_MARKER;
    } else if (typeof val === 'string') {
      sanitized[key] = sanitizeString(val);
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeObject(val, seen);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

/**
 * Sanitizes HTTP headers by masking authorization, api-key, and x-api-key values.
 */
export function sanitizeHeaders(headers = {}) {
  if (!headers || typeof headers !== 'object') return {};
  const cleaned = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (
      lower === 'authorization' ||
      lower === 'x-api-key' ||
      lower === 'api-key' ||
      lower.includes('key') ||
      lower.includes('token') ||
      lower.includes('secret')
    ) {
      cleaned[key] = REDACTED_MARKER;
    } else {
      cleaned[key] = typeof value === 'string' ? sanitizeString(value) : value;
    }
  }
  return cleaned;
}

/**
 * Sanitizes an error object, redacting secrets from message and stack trace.
 */
export function sanitizeError(err) {
  if (!err) return null;
  const message = typeof err.message === 'string' ? sanitizeString(err.message) : 'Unknown error';
  const stack = typeof err.stack === 'string' ? sanitizeString(err.stack) : undefined;
  const code = err.code || 'ERROR';

  const cleaned = new Error(message);
  cleaned.name = err.name || 'Error';
  cleaned.code = (err.name === 'AbortError' || err.code === 'TIMEOUT') ? 'TIMEOUT' : (err.code || 'ERROR');
  if (err.status) cleaned.status = err.status;
  if (err.retryAfter) cleaned.retryAfter = err.retryAfter;
  if (stack) {
    cleaned.stack = stack;
  }
  if (err.cause) {
    cleaned.cause = sanitizeCredentials(err.cause);
  }
  return cleaned;
}

/**
 * Redacts internal filesystem paths from strings to prevent server path disclosure.
 */
export function sanitizeFilePath(str) {
  if (typeof str !== 'string') return str;
  // Redact Windows absolute paths (e.g. C:\Users\... or D:\Antigravity\...)
  let result = str.replace(/[a-zA-Z]:\\[^\s"',;>)]+/g, '[REDACTED_PATH]');
  // Redact Unix absolute paths (e.g. /home/... or /Users/... or /etc/...)
  result = result.replace(/\/(?:home|Users|etc|var|tmp|private)\/[^\s"',;>)]+/g, '[REDACTED_PATH]');
  return result;
}

/**
 * Universal credential sanitizer accepting any input type (string, object, error, primitive).
 */
export function sanitizeCredentials(val) {
  if (typeof val === 'string') return sanitizeString(val);
  if (val instanceof Error) return sanitizeError(val);
  if (val && typeof val === 'object') return sanitizeObject(val);
  return val;
}
