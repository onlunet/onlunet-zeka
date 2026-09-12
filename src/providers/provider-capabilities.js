/**
 * ONLUNET ZEKA - Canonical Provider Capabilities
 * FAZ 62 Foundation: Standardized Modality & Feature Capability Matrix
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */

export const ProviderCapabilities = Object.freeze({
  TEXT: 'TEXT',
  STRUCTURED_OUTPUT: 'STRUCTURED_OUTPUT',
  VISION: 'VISION',
  AUDIO: 'AUDIO',
  EMBEDDING: 'EMBEDDING',
  TOOL_USE: 'TOOL_USE',
  REASONING: 'REASONING',
  STREAMING: 'STREAMING',
  LONG_CONTEXT: 'LONG_CONTEXT',
  JSON_MODE: 'JSON_MODE',
  // Backward-compatibility aliases
  CODE_GENERATION: 'CODE_GENERATION',
  CODE_REVIEW: 'CODE_REVIEW',
  LOCAL: 'LOCAL',
  FAST_INFERENCE: 'FAST_INFERENCE'
});

// FAZ 66.8 Standardized Model Capabilities (12 Canonical Keys)
export const StandardModelCapabilities = Object.freeze({
  TEXT_GENERATION: 'text_generation',
  REASONING: 'reasoning',
  CODING: 'coding',
  STRUCTURED_OUTPUT: 'structured_output',
  JSON: 'json',
  TOOL_CALLING: 'tool_calling',
  VISION: 'vision',
  IMAGE_INPUT: 'image_input',
  LONG_CONTEXT: 'long_context',
  MULTILINGUAL: 'multilingual',
  EMBEDDING: 'embedding',
  MODERATION: 'moderation'
});

/**
 * Normalizes any capability string (legacy uppercase or modern snake_case) to standard form.
 * Returns 'unknown' if not recognized.
 */
export function normalizeCapability(cap) {
  if (!cap || typeof cap !== 'string') return 'unknown';
  const c = cap.trim().toLowerCase();
  if (c === 'text' || c === 'text_generation') return StandardModelCapabilities.TEXT_GENERATION;
  if (c === 'reasoning') return StandardModelCapabilities.REASONING;
  if (c === 'coding' || c === 'code_generation' || c === 'code_review') return StandardModelCapabilities.CODING;
  if (c === 'structured_output') return StandardModelCapabilities.STRUCTURED_OUTPUT;
  if (c === 'json' || c === 'json_mode') return StandardModelCapabilities.JSON;
  if (c === 'tool_calling' || c === 'tool_use' || c === 'tools') return StandardModelCapabilities.TOOL_CALLING;
  if (c === 'vision') return StandardModelCapabilities.VISION;
  if (c === 'image_input' || c === 'image') return StandardModelCapabilities.IMAGE_INPUT;
  if (c === 'long_context') return StandardModelCapabilities.LONG_CONTEXT;
  if (c === 'multilingual') return StandardModelCapabilities.MULTILINGUAL;
  if (c === 'embedding') return StandardModelCapabilities.EMBEDDING;
  if (c === 'moderation') return StandardModelCapabilities.MODERATION;
  if (c === 'fast_inference') return 'fast_inference';
  if (c === 'local') return 'local';
  return 'unknown';
}

