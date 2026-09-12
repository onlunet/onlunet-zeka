/**
 * ONLUNET ZEKA — Design System Token & CSS Variable System
 * FAZ 72: Centralized Token Extraction, Categorization, Validation & Safe Replacement
 *
 * GUARANTEES:
 * 1. Zero External Dependencies: Pure Node.js string & regex operations.
 * 2. Stale Proposal Detection: Rejects mutation if the current CSS variable value
 *    does not strictly match the expected 'before' value (STALE_PROPOSAL).
 * 3. Categorized Token Taxonomy: Colors, Spacing, Radius, Typography, Shadows, Effects, Layout.
 * 4. Deterministic & Non-Destructive: Preserves comments, indentation, and surrounding CSS rules.
 */

import { VisualErrorCodes } from './visual-intelligence.js';

/**
 * Extended error codes for FAZ 72 refactoring operations
 */
export const RefactoringErrorCodes = Object.freeze({
  STALE_PROPOSAL: 'STALE_PROPOSAL',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN_OPERATION: 'FORBIDDEN_OPERATION',
  INVALID_PROPOSAL: 'INVALID_PROPOSAL',
  REGRESSION_DETECTED: 'REGRESSION_DETECTED',
  PATCH_FAILED: 'PATCH_FAILED',
  ROLLBACK_FAILED: 'ROLLBACK_FAILED',
  ...VisualErrorCodes
});

/**
 * Extracts all CSS variable declarations from raw CSS text
 *
 * @param {string} cssText
 * @returns {Array<Object>} Extracted token records
 */
export function extractTokensFromCss(cssText) {
  if (!cssText || typeof cssText !== 'string') {
    return [];
  }

  const tokenRegex = /(--[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  const tokens = [];
  let match;

  while ((match = tokenRegex.exec(cssText)) !== null) {
    const name = match[1].trim();
    const value = match[2].trim();
    tokens.push({
      name,
      value,
      declaration: match[0],
      index: match.index
    });
  }

  return tokens;
}

/**
 * Categorizes extracted tokens into standard Design Token groups
 *
 * @param {Array<Object>} tokens
 * @returns {Object} Grouped token taxonomy
 */
export function categorizeTokens(tokens = []) {
  const categories = {
    colors: {},
    spacing: {},
    radius: {},
    typography: {},
    shadows: {},
    effects: {},
    layout: {}
  };

  for (const token of tokens) {
    const nameLower = token.name.toLowerCase();
    const val = token.value;

    if (nameLower.includes('radius') || nameLower.includes('round')) {
      categories.radius[token.name] = val;
    } else if (nameLower.includes('shadow') || nameLower.includes('elevation')) {
      categories.shadows[token.name] = val;
    } else if (nameLower.includes('glow') || nameLower.includes('blur') || nameLower.includes('gradient') || nameLower.includes('transition')) {
      categories.effects[token.name] = val;
    } else if (nameLower.includes('font') || nameLower.includes('line-height') || nameLower.includes('letter-spacing') || nameLower.includes('text-size')) {
      categories.typography[token.name] = val;
    } else if (nameLower.includes('space') || nameLower.includes('gap') || nameLower.includes('padding') || nameLower.includes('margin')) {
      categories.spacing[token.name] = val;
    } else if (
      nameLower.includes('color') ||
      nameLower.includes('bg') ||
      nameLower.includes('text') ||
      nameLower.includes('border') ||
      nameLower.includes('primary') ||
      nameLower.includes('accent') ||
      nameLower.includes('surface') ||
      nameLower.includes('canvas') ||
      val.startsWith('#') ||
      val.startsWith('rgb') ||
      val.startsWith('hsl')
    ) {
      categories.colors[token.name] = val;
    } else {
      categories.layout[token.name] = val;
    }
  }

  return Object.freeze({
    colors: Object.freeze(categories.colors),
    spacing: Object.freeze(categories.spacing),
    radius: Object.freeze(categories.radius),
    typography: Object.freeze(categories.typography),
    shadows: Object.freeze(categories.shadows),
    effects: Object.freeze(categories.effects),
    layout: Object.freeze(categories.layout)
  });
}

/**
 * Verifies if a specific token in the CSS currently matches the expected 'before' value
 *
 * @param {string} cssText
 * @param {string} tokenName
 * @param {string} expectedBefore
 * @returns {{ matches: boolean, currentValue: string | null }}
 */
export function verifyTokenMatches(cssText, tokenName, expectedBefore) {
  if (!cssText || !tokenName) {
    return { matches: false, currentValue: null };
  }

  const cleanName = tokenName.trim();
  const escapedName = cleanName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`${escapedName}\\s*:\\s*([^;]+);`);
  const match = cssText.match(regex);

  if (!match) {
    return { matches: false, currentValue: null };
  }

  const currentValue = match[1].trim();
  const cleanExpected = expectedBefore ? String(expectedBefore).trim() : '';

  return {
    matches: currentValue === cleanExpected,
    currentValue
  };
}

/**
 * Safely applies token updates to CSS text with strict stale proposal verification
 *
 * @param {string} cssText
 * @param {Array<Object>} tokenUpdates - Array of { target, before, after }
 * @returns {{ updatedCss: string, appliedCount: number, appliedChanges: Array<Object> }}
 */
export function applyTokenUpdatesToCss(cssText, tokenUpdates = []) {
  if (!cssText || typeof cssText !== 'string') {
    throw new Error(`[${RefactoringErrorCodes.INVALID_ARGUMENT}] cssText must be a non-empty string`);
  }
  if (!Array.isArray(tokenUpdates) || tokenUpdates.length === 0) {
    return { updatedCss: cssText, appliedCount: 0, appliedChanges: [] };
  }

  // 1. Preflight: Check all token updates for stale state before mutating any content
  for (const update of tokenUpdates) {
    const target = update.target ? String(update.target).trim() : '';
    const before = update.before !== undefined ? String(update.before).trim() : null;

    if (!target.startsWith('--')) {
      throw new Error(`[${RefactoringErrorCodes.FORBIDDEN_OPERATION}] Invalid design token '${target}'. Tokens must start with '--'`);
    }

    const verification = verifyTokenMatches(cssText, target, before);
    if (!verification.matches) {
      throw new Error(
        `[${RefactoringErrorCodes.STALE_PROPOSAL}] Token '${target}' current value '${verification.currentValue}' does not match expected before value '${before}'`
      );
    }
  }

  // 2. Apply all verified token replacements atomically
  let updatedCss = cssText;
  const appliedChanges = [];

  for (const update of tokenUpdates) {
    const target = update.target.trim();
    const after = String(update.after).trim();
    const escapedTarget = target.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const replaceRegex = new RegExp(`(${escapedTarget}\\s*:\\s*)([^;]+)(;)`);

    updatedCss = updatedCss.replace(replaceRegex, `$1${after}$3`);
    appliedChanges.push({
      target,
      before: update.before,
      after,
      appliedAt: new Date().toISOString()
    });
  }

  return {
    updatedCss,
    appliedCount: appliedChanges.length,
    appliedChanges: Object.freeze(appliedChanges)
  };
}
