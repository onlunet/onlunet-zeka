/**
 * ONLUNET ZEKA — Structured Design Proposal Engine
 * FAZ 72: Declarative, Validatable, and Non-Executing Visual Design Proposals
 *
 * GUARANTEES:
 * 1. STRICT INVARIANT: proposalOnly = true, executionAuthorized = false ALWAYS.
 *    Proposals can NEVER authorize or execute themselves.
 * 2. Whitelisted Change Types ONLY: design_token_update, css_variable_update,
 *    color_token_update, radius_token_update, spacing_token_update,
 *    typography_token_update, shadow_token_update.
 * 3. Blacklist Guard: Arbitrary shell execution, arbitrary JS/HTML rewrites,
 *    arbitrary file deletions, dependency installations are strictly forbidden and rejected.
 * 4. Structured & Deterministic: Normalized schema with explicit expected impact and priority.
 */

import { RefactoringErrorCodes } from './visual-token-system.js';

/**
 * Whitelist of safe, atomic design change types permitted in FAZ 72
 */
export const ALLOWED_CHANGE_TYPES = Object.freeze([
  'design_token_update',
  'css_variable_update',
  'color_token_update',
  'radius_token_update',
  'spacing_token_update',
  'typography_token_update',
  'shadow_token_update'
]);

/**
 * Blacklist of strictly forbidden operations in visual refactoring
 */
export const FORBIDDEN_OPERATIONS = Object.freeze([
  'execute_command',
  'shell_execution',
  'arbitrary_file_write',
  'file_deletion',
  'package_install',
  'arbitrary_html_rewrite',
  'arbitrary_js_rewrite',
  'dependency_update',
  'npm_install'
]);

/**
 * Proposal Priority Levels
 */
export const ProposalPriority = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
});

/**
 * Validates a structured design proposal against all FAZ 72 safety rules
 *
 * @param {Object} proposal
 * @returns {boolean} True if valid; throws otherwise fail-closed
 */
export function validateDesignProposal(proposal) {
  if (!proposal || typeof proposal !== 'object') {
    throw new Error(`[${RefactoringErrorCodes.INVALID_PROPOSAL}] Proposal must be a non-null object`);
  }

  // Mandatory fields
  const requiredFields = ['proposalId', 'category', 'issue', 'changes'];
  for (const field of requiredFields) {
    if (!proposal[field]) {
      throw new Error(`[${RefactoringErrorCodes.INVALID_PROPOSAL}] Missing required proposal field: '${field}'`);
    }
  }

  // Strict Authority Invariants: MUST NOT be self-authorized
  if (proposal.proposalOnly !== true) {
    throw new Error(`[${RefactoringErrorCodes.UNAUTHORIZED}] Proposal invariant violated: proposalOnly must be true`);
  }
  if (proposal.executionAuthorized !== false) {
    throw new Error(`[${RefactoringErrorCodes.UNAUTHORIZED}] Proposal invariant violated: executionAuthorized must be false`);
  }

  // Changes must be a non-empty array
  if (!Array.isArray(proposal.changes) || proposal.changes.length === 0) {
    throw new Error(`[${RefactoringErrorCodes.INVALID_PROPOSAL}] Proposal changes must be a non-empty array`);
  }

  // Inspect each change
  for (const [idx, change] of proposal.changes.entries()) {
    if (!change || typeof change !== 'object') {
      throw new Error(`[${RefactoringErrorCodes.INVALID_PROPOSAL}] Change at index ${idx} must be an object`);
    }

    const type = String(change.type || '').trim().toLowerCase();

    // Check for forbidden operations
    for (const forbidden of FORBIDDEN_OPERATIONS) {
      if (type.includes(forbidden) || change.command || change.script) {
        throw new Error(`[${RefactoringErrorCodes.FORBIDDEN_OPERATION}] Operation '${type}' is strictly forbidden in visual refactoring`);
      }
    }

    // Check whitelist
    if (!ALLOWED_CHANGE_TYPES.includes(type)) {
      throw new Error(`[${RefactoringErrorCodes.FORBIDDEN_OPERATION}] Change type '${type}' is not permitted. Allowed: ${ALLOWED_CHANGE_TYPES.join(', ')}`);
    }

    // Validate target design token
    const target = String(change.target || '').trim();
    if (!target.startsWith('--')) {
      throw new Error(`[${RefactoringErrorCodes.FORBIDDEN_OPERATION}] Target '${target}' is not a valid CSS token. Tokens must start with '--'`);
    }

    if (change.before === undefined || change.after === undefined) {
      throw new Error(`[${RefactoringErrorCodes.INVALID_PROPOSAL}] Change on '${target}' must specify both 'before' and 'after' values`);
    }
  }

  return true;
}

/**
 * Creates an immutable, normalized Design Proposal
 *
 * @param {Object} params
 * @returns {Object} Frozen design proposal
 */
export function createDesignProposal(params = {}) {
  if (params && params.executionAuthorized === true) {
    throw new Error(`[${RefactoringErrorCodes.UNAUTHORIZED}] Proposals cannot be created with executionAuthorized=true. Authorization must be granted by an authoritative boundary.`);
  }
  if (params && params.proposalOnly === false) {
    throw new Error(`[${RefactoringErrorCodes.UNAUTHORIZED}] Proposals cannot be created with proposalOnly=false.`);
  }

  const {
    proposalId = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    projectId = 'default',
    sourceAnalysisId = null,
    category = 'colorSystem',
    issue = 'Görsel Tasarım İyileştirme Önerisi',
    rationale = '',
    priority = ProposalPriority.MEDIUM,
    targetFilePath = 'src/app/public/index.html',
    changes = [],
    expectedImpact = {}
  } = params;

  const normalizedChanges = changes.map(c => Object.freeze({
    type: String(c.type || 'design_token_update').trim().toLowerCase(),
    target: String(c.target || '').trim(),
    before: c.before !== undefined ? String(c.before).trim() : '',
    after: c.after !== undefined ? String(c.after).trim() : '',
    reason: c.reason ? String(c.reason).trim() : '',
    risk: ['low', 'medium', 'high'].includes(c.risk) ? c.risk : 'low'
  }));

  const validPriority = Object.values(ProposalPriority).includes(priority)
    ? priority
    : ProposalPriority.MEDIUM;

  const proposal = {
    proposalId: String(proposalId).trim(),
    projectId: String(projectId).trim(),
    sourceAnalysisId: sourceAnalysisId ? String(sourceAnalysisId).trim() : null,
    category: String(category).trim(),
    issue: String(issue).trim(),
    rationale: String(rationale).trim(),
    priority: validPriority,
    targetFilePath: String(targetFilePath).trim(),
    changes: Object.freeze(normalizedChanges),
    expectedImpact: Object.freeze({
      visualScore: expectedImpact.visualScore || '+0',
      contrast: expectedImpact.contrast || 'neutral',
      aiTemplateRisk: expectedImpact.aiTemplateRisk || '-0',
      ...expectedImpact
    }),
    createdAt: new Date().toISOString(),
    proposalOnly: true, // HARD INVARIANT
    executionAuthorized: false // HARD INVARIANT
  };

  validateDesignProposal(proposal);
  return Object.freeze(proposal);
}
