/**
 * ONLUNET ZEKA - Tool Calling & Function Calling Boundary
 * FAZ 62 Foundation: Tool Proposal Invariant (Zero Execution Authority)
 *
 * Strict Axiom: Tool call by AI is strictly PROPOSED.
 * AI has ZERO authority to execute tools directly.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';

export function createToolProposal({
  toolName,
  parameters = {},
  agentId = 'agent-default',
  taskId = 'task-default',
  rationale = ''
} = {}) {
  if (!toolName || typeof toolName !== 'string' || toolName.trim() === '') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Tool proposal requires non-empty toolName`);
  }

  return Object.freeze({
    type: 'TOOL_PROPOSAL',
    toolName: toolName.trim(),
    parameters: Object.freeze({ ...parameters }),
    agentId,
    taskId,
    rationale: String(rationale),
    executionAuthorized: false,
    proposalOnly: true,
    status: 'PROPOSED',
    proposedAt: new Date().toISOString()
  });
}
