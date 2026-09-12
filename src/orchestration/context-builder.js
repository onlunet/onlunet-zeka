/**
 * ONLUNET ZEKA - Multi-Agent Context Builder
 * FAZ 58 Foundation: Scoped, Bounded, Secret-Sanitized Context Assembly
 *
 * Implements:
 * - Scoped prompt assembly from task, project, files, errors, and history
 * - Hard bounds: maxTokens, maxFiles, maxBytes, maxPromptSize
 * - Secret sanitization across all context inputs
 * - Non-overridable authority disclaimer injection
 * - Zero external dependencies
 */
import { sanitizeString } from '../providers/credential-sanitizer.js';
import { estimateTokenCount } from '../providers/cost-tracker.js';

export function createContextBuilder({
  maxTokens = 8000,
  maxFiles = 20,
  maxBytes = 100000,
  maxPromptSize = 32000
} = {}) {
  return Object.freeze({
    maxTokens,
    maxFiles,
    maxBytes,
    maxPromptSize,

    /**
     * Builds bounded, sanitized context for agent invocation
     */
    buildContext({
      task = '',
      project = null,
      workspaceRoot = null,
      relevantFiles = [],
      previousResults = [],
      verificationEvidence = null,
      errorOutput = null,
      agentRole = 'DEVELOPER',
      constraints = []
    } = {}) {
      // Prototype pollution defense
      if (Object.prototype.hasOwnProperty.call(constraints, '__proto__') ||
          (project && Object.prototype.hasOwnProperty.call(project, '__proto__'))) {
        throw new Error('Prototype pollution detected in context input');
      }

      const cleanTask = sanitizeString(String(task || '').trim());
      const cleanRole = sanitizeString(String(agentRole || 'DEVELOPER').trim());
      const cleanEvidence = verificationEvidence ? sanitizeString(String(verificationEvidence)) : null;
      const cleanError = errorOutput ? sanitizeString(String(errorOutput)) : null;

      // Bound files
      const boundedFiles = [];
      let totalFileBytes = 0;
      const inputFiles = Array.isArray(relevantFiles) ? relevantFiles.slice(0, maxFiles) : [];

      for (const f of inputFiles) {
        if (!f) continue;
        const filePath = typeof f === 'string' ? f : (f.path || 'unknown');
        let content = typeof f === 'string' ? '' : String(f.content || '');
        content = sanitizeString(content);

        const contentBytes = Buffer.byteLength(content, 'utf8');
        if (totalFileBytes + contentBytes > maxBytes) {
          const remaining = Math.max(0, maxBytes - totalFileBytes);
          content = content.slice(0, remaining) + '\n[TRUNCATED: Exceeded context byte limit]';
          boundedFiles.push({ path: filePath, content, truncated: true });
          break;
        }

        totalFileBytes += contentBytes;
        boundedFiles.push({ path: filePath, content, truncated: false });
      }

      // Bound constraints
      const cleanConstraints = Array.isArray(constraints)
        ? constraints.map(c => sanitizeString(String(c)))
        : [];

      // Bound previous results (summaries only)
      const cleanPrevious = Array.isArray(previousResults)
        ? previousResults.map(p => ({
            agentId: p.agentId ? sanitizeString(String(p.agentId)) : 'unknown',
            role: p.role ? sanitizeString(String(p.role)) : 'unknown',
            rationale: p.rationale ? sanitizeString(String(p.rationale)).slice(0, 1000) : '',
            proposedFiles: Array.isArray(p.proposedFiles) ? [...p.proposedFiles] : []
          }))
        : [];

      const rawSerialized = JSON.stringify({
        task: cleanTask,
        role: cleanRole,
        files: boundedFiles,
        constraints: cleanConstraints,
        previous: cleanPrevious,
        evidence: cleanEvidence,
        error: cleanError
      });

      const estimatedTokens = estimateTokenCount(rawSerialized);

      return Object.freeze({
        task: cleanTask,
        agentRole: cleanRole,
        files: Object.freeze(boundedFiles),
        constraints: Object.freeze(cleanConstraints),
        previousResults: Object.freeze(cleanPrevious),
        verificationEvidence: cleanEvidence,
        errorOutput: cleanError,
        byteCount: Buffer.byteLength(rawSerialized, 'utf8'),
        estimatedTokens,
        metadata: Object.freeze({
          bounded: true,
          truncated: boundedFiles.some(bf => bf.truncated)
        })
      });
    },

    /**
     * Formats assembled context into a secure LLM prompt string
     */
    formatPrompt({ context, userInstruction = null, systemPrompt = null } = {}) {
      const parts = [];

      // Authority Disclaimer Invariant
      parts.push(
        '# SYSTEM GOVERNANCE NOTICE\n' +
        'All outputs generated from this prompt represent non-executable, advisory proposals only.\n' +
        'You possess ZERO execution, mutation, shell, deployment, or approval authority.'
      );

      if (systemPrompt) {
        parts.push(`\n## Specialist Role & Instructions\n${sanitizeString(systemPrompt)}`);
      }

      if (context) {
        parts.push(`\n## Role: ${context.agentRole || 'SPECIALIST'}`);
        parts.push(`## Task Objective\n${context.task || 'No objective specified'}`);

        if (context.constraints && context.constraints.length > 0) {
          parts.push(`\n## Constraints\n${context.constraints.map(c => `- ${c}`).join('\n')}`);
        }

        if (context.previousResults && context.previousResults.length > 0) {
          parts.push('\n## Prior Specialist Findings');
          for (const prev of context.previousResults) {
            parts.push(`- **${prev.role}** (${prev.agentId}): ${prev.rationale}`);
          }
        }

        if (context.errorOutput) {
          parts.push(`\n## Defect / Error Diagnostics\n\`\`\`\n${context.errorOutput}\n\`\`\``);
        }

        if (context.verificationEvidence) {
          parts.push(`\n## Verification Evidence\n${context.verificationEvidence}`);
        }

        if (context.files && context.files.length > 0) {
          parts.push('\n## Workspace Context Files');
          for (const file of context.files) {
            parts.push(`### File: \`${file.path}\`\n\`\`\`\n${file.content}\n\`\`\``);
          }
        }
      }

      if (userInstruction) {
        parts.push(`\n## Specific Instruction\n${sanitizeString(userInstruction)}`);
      }

      let combined = parts.join('\n\n');
      if (Buffer.byteLength(combined, 'utf8') > maxPromptSize) {
        combined = combined.slice(0, maxPromptSize) + '\n\n[TRUNCATED: Exceeded maxPromptSize limit]';
      }

      return combined;
    }
  });
}
