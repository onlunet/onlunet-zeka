/**
 * AI Development OS - Test Failure & Root Cause Analyzer
 * Phase 59 Foundation - Autonomous AI Agency Execution Loop
 *
 * CORE INVARIANTS:
 * 1. REAL EXECUTION EVIDENCE:
 *    Diagnosis is derived directly from captured exit code, stdout, stderr,
 *    and stack traces.
 * 2. CONFIDENCE != AUTHORITY:
 *    Confidence rating is descriptive metadata only and confers zero authority to alter
 *    code, bypass tests, or declare verification success.
 * 3. TARGETED IDENTIFICATION:
 *    Pinpoints specific failing files, lines, and assertion mismatches to enable minimal,
 *    bounded repairs rather than shotgun edits.
 * 4. SECRET REDACTION:
 *    All error snippets, outputs, and recommendations are scrubbed for credentials.
 */

import crypto from 'node:crypto';
import { DefaultProposalAuthorityGuarantee } from '../contracts/agent-proposal.js';
import { AgentRoles, ErrorCodes } from '../contracts/constants.js';
import { sanitizeCredentials } from '../providers/credential-sanitizer.js';

export const FailureCategory = Object.freeze({
  ASSERTION_FAILURE: 'ASSERTION_FAILURE',
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  MODULE_NOT_FOUND: 'MODULE_NOT_FOUND',
  RUNTIME_EXCEPTION: 'RUNTIME_EXCEPTION',
  TIMEOUT: 'TIMEOUT',
  COMPILATION_ERROR: 'COMPILATION_ERROR',
  UNKNOWN: 'UNKNOWN'
});
export const TestFailureCategory = FailureCategory;

function hasPrototypePollution(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
      Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
      Object.prototype.hasOwnProperty.call(obj, 'prototype')) {
    return true;
  }
  return false;
}

/**
 * Heuristically parses stderr and stdout to identify the failure type and root cause.
 */
export function classifyFailureEvidence(output = '') {
  const text = String(output || '');

  if (/SyntaxError|Unexpected token|Unexpected identifier/i.test(text)) {
    return {
      type: FailureCategory.SYNTAX_ERROR,
      confidence: 0.95,
      hint: 'Syntax error encountered in code'
    };
  }

  if (/Cannot find module|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/i.test(text)) {
    return {
      type: FailureCategory.MODULE_NOT_FOUND,
      confidence: 0.9,
      hint: 'Module or file import resolution failed'
    };
  }

  if (/AssertionError|ERR_ASSERTION|assert|expected.*to equal|Expected|StrictEqual/i.test(text)) {
    return {
      type: FailureCategory.ASSERTION_FAILURE,
      confidence: 0.85,
      hint: 'Test assertion failed: actual value did not match expected invariant'
    };
  }

  if (/ETIMEDOUT|timed out|timeout of .* exceeded/i.test(text)) {
    return {
      type: FailureCategory.TIMEOUT,
      confidence: 0.9,
      hint: 'Operation timed out during test execution'
    };
  }

  if (/TypeError|ReferenceError|RangeError/i.test(text)) {
    return {
      type: FailureCategory.RUNTIME_EXCEPTION,
      confidence: 0.85,
      hint: 'Uncaught runtime exception occurred during execution'
    };
  }

  return {
    type: FailureCategory.UNKNOWN,
    confidence: 0.5,
    hint: 'Execution exited with non-zero status or unknown failure pattern'
  };
}

/**
 * Analyzes test failure evidence to produce an actionable diagnosis.
 */
export async function analyzeTestFailure({
  testResult,
  changedFiles = [],
  workspaceRoot = null,
  failureHistory = [],
  providerGateway = null,
  timeoutMs = 15000
} = {}) {
  if (!testResult || typeof testResult !== 'object') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Missing or invalid testResult for failure analysis`);
  }

  if (hasPrototypePollution(arguments[0])) {
    throw new Error(`[${ErrorCodes.SECURITY_BLOCKED}] Prototype pollution detected in analyzeTestFailure`);
  }

  const exitCode = typeof testResult.exitCode === 'number' ? testResult.exitCode : 1;
  const stdout = String(testResult.stdout || '');
  const stderr = String(testResult.stderr || '');
  const combinedOutput = `${stderr}\n${stdout}`.trim();

  const classification = classifyFailureEvidence(combinedOutput);

  // Extract affected files from changed files and output mentions
  const detectedFiles = new Set(Array.isArray(changedFiles) ? changedFiles : []);
  const fileRegex = /([a-zA-Z0-9_\-./\\]+\.(?:js|json|ts|mjs|cjs))/g;
  let match;
  while ((match = fileRegex.exec(combinedOutput)) !== null) {
    const candidate = match[1].replace(/\\/g, '/');
    if (!candidate.includes('node_modules') && (candidate.startsWith('src/') || candidate.startsWith('tests/'))) {
      detectedFiles.add(candidate);
    }
  }

  const affectedFiles = Object.freeze(Array.from(detectedFiles));

  // Determine root cause description
  let rootCause = classification.hint;
  const lines = combinedOutput.split('\n').map(l => l.trim()).filter(Boolean);
  const errorLine = lines.find(l => /error|fail|exception/i.test(l)) || lines[0] || 'Unknown error occurred';
  if (errorLine) {
    rootCause = `${classification.hint}: ${errorLine}`.slice(0, 300);
  }

  let recommendedFix = `Inspect affected files [${affectedFiles.join(', ')}] and resolve ${classification.type}`;
  let aiConfidence = classification.confidence;

  // Optional AI Provider Reasoning (Proposal only, zero authority)
  if (providerGateway && typeof providerGateway.invoke === 'function') {
    try {
      const prompt = `Analyze this test failure and propose a minimal fix.\nExit Code: ${exitCode}\nFailure Type: ${classification.type}\nAffected Files: ${affectedFiles.join(', ')}\nError Output Snippet:\n${combinedOutput.slice(0, 2000)}`;

      const aiResponse = await providerGateway.invoke({
        role: AgentRoles.REVIEWER,
        prompt,
        systemPrompt: 'You are a specialist failure analysis and debugging agent. Identify the exact root cause and minimal bounded patch. Return structured JSON with rootCause, affectedFiles, and recommendedFix.',
        timeoutMs
      });

      if (aiResponse && aiResponse.success && aiResponse.content) {
        rootCause = `[AI-Diagnosed] ${aiResponse.content.slice(0, 400)}`;
        recommendedFix = `Address diagnosed issue: ${aiResponse.content.slice(0, 300)}`;
        aiConfidence = 0.9;
      }
    } catch (err) {
      // Fall back safely to rule-based classification
    }
  }

  const snippet = combinedOutput.slice(0, 1000);

  return Object.freeze({
    diagnosisId: `diag-${crypto.randomUUID()}`,
    failureType: classification.type,
    rootCause: sanitizeCredentials(rootCause),
    affectedFiles,
    recommendedFix: sanitizeCredentials(recommendedFix),
    confidence: aiConfidence,
    exitCode,
    rawEvidenceSnippet: sanitizeCredentials(snippet),
    timestamp: new Date().toISOString(),
    authorityGuarantee: DefaultProposalAuthorityGuarantee
  });
}
