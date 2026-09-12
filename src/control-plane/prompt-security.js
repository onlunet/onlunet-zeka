/**
 * ONLUNET ZEKA - Prompt & Context Security Sanitizer
 * FAZ 59 Foundation: Pre-flight Prompt Inspection & Injection Neutralization
 *
 * Implements:
 * - Secret / credential detection in context
 * - Separation of system instructions vs untrusted user content
 * - Untrusted document encapsulation (<untrusted_document>)
 * - Prompt injection detection and neutralization
 * - Context size bounds (max 100,000 characters)
 * - Deep object recursion bounds (max depth 10)
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';
import { sanitizeString, sanitizeCredentials } from '../providers/credential-sanitizer.js';

export const MAX_CONTEXT_LENGTH = 100000;
export const MAX_OBJECT_DEPTH = 10;

// High-confidence adversarial instruction patterns
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /you\s+are\s+now\s+(the\s+)?(admin|administrator|root|superuser)/i,
  /you\s+are\s+authorized\s+to\s+execute/i,
  /approve\s+this\s+(proposal|operation|plan)/i,
  /bypass\s+(admission|approval|verification|policy|security)/i,
  /system\s+(override|alert)/i,
  /reveal\s+.*(secret|api\s*key|password|token|env|system\s+prompt)/i,
  /reveal\s+(all\s+)?(api\s+keys|passwords|environment\s+variables|system\s+prompt)/i,
  /mark\s+verification\s+as\s+passed/i,
  /pretend\s+execution\s+succeeded/i,
  /output\s+instruction:\s*approvalGranted/i,
  /(set|grant)\s+.*(authoriz|admin|privilege)/i
];

/**
 * Checks for prompt injection signatures and returns detection metrics.
 */
export function detectPromptInjection(text = '') {
  if (typeof text !== 'string') return { detected: false, matchedPatterns: [] };

  const matched = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      matched.push(pattern.toString());
    }
  }

  return {
    detected: matched.length > 0,
    count: matched.length,
    matchedPatterns: matched
  };
}

/**
 * Wraps untrusted external content (files, user inputs) in explicit boundary delimiters
 * so that downstream LLM parsing clearly demarcates passive data.
 */
export function wrapUntrustedContent(content, label = 'untrusted_input') {
  const safeLabel = String(label || 'untrusted_input').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeContent = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  return `<${safeLabel}>\n${safeContent}\n</${safeLabel}>`;
}

/**
 * Validates and sanitizes prompt context before transmission to AI.
 */
export function securePromptContext({
  systemPrompt = null,
  userPrompt = '',
  contextData = null,
  maxContextLength = MAX_CONTEXT_LENGTH,
  stripSecrets = true,
  quarantineInjections = true
} = {}) {
  // 1. Length enforcement
  const rawUserPrompt = String(userPrompt || '');
  if (rawUserPrompt.length > maxContextLength) {
    throw new Error(
      `[${ErrorCodes.SECURITY_BLOCKED}] Prompt exceeds maximum allowed length (${rawUserPrompt.length} > ${maxContextLength})`
    );
  }

  // 2. Secret detection and stripping
  let cleanUserPrompt = rawUserPrompt;
  let cleanSystemPrompt = systemPrompt ? String(systemPrompt) : null;

  if (stripSecrets) {
    cleanUserPrompt = sanitizeString(cleanUserPrompt);
    if (cleanSystemPrompt) {
      cleanSystemPrompt = sanitizeString(cleanSystemPrompt);
    }
  }

  // 3. Prompt injection detection
  const injection = detectPromptInjection(cleanUserPrompt);

  // If quarantine is enabled, annotate untrusted user instructions without failing closed
  // to allow the LLM to analyze the attack text as pure data, but prevent execution authority.
  let securedUserPrompt = cleanUserPrompt;
  if (injection.detected && quarantineInjections) {
    securedUserPrompt = wrapUntrustedContent(
      cleanUserPrompt,
      'untrusted_user_content_potential_injection'
    );
  }

  // 4. Safe context data recursion inspection
  let cleanContext = null;
  if (contextData && typeof contextData === 'object') {
    cleanContext = sanitizeContextObject(contextData, 0, MAX_OBJECT_DEPTH);
  }

  return Object.freeze({
    systemPrompt: cleanSystemPrompt,
    userPrompt: securedUserPrompt,
    contextData: cleanContext,
    injectionDetected: injection.detected,
    injectionSignatures: injection.matchedPatterns,
    timestamp: new Date().toISOString()
  });
}

/**
 * Recursively sanitizes object keys and values, stripping prototype pollution vectors
 * and capping depth at maxDepth.
 */
export function sanitizeContextObject(obj, currentDepth = 0, maxDepth = MAX_OBJECT_DEPTH) {
  if (currentDepth > maxDepth) {
    return '[EXCEEDED_MAX_DEPTH]';
  }

  if (obj === null || typeof obj !== 'object') {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeContextObject(item, currentDepth + 1, maxDepth));
  }

  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
      continue; // Strip prototype pollution
    }
    clean[k] = sanitizeContextObject(v, currentDepth + 1, maxDepth);
  }
  return clean;
}
