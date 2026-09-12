/**
 * AI Development OS - Foundation Package Entrypoint
 * Phase 1 through Phase 16 Foundation Contracts, Controlled Execution & File Mutation Boundaries
 */
export * from './contracts/constants.js';
export * from './contracts/domain.js';
export * from './contracts/orchestration.js';
export * from './contracts/orchestrator.js';
export * from './contracts/execution-plan.js';
export * from './contracts/execution-semantics.js';
export * from './contracts/preflight.js';
export * from './contracts/handoff.js';
export * from './contracts/runtime-boundary.js';
export * from './contracts/execution-authorization.js';
export * from './contracts/controlled-execution.js';
export * from './contracts/file-mutation.js';
export * from './contracts/job-engine.js';
export * from './contracts/work-unit.js';
export * from './contracts/autonomous-policy.js';
export * from './contracts/ai-proposal.js';
export * from './contracts/agent-registry.js';
export * from './contracts/task-routing.js';
export * from './contracts/agent-proposal.js';
export * from './contracts/provider-invocation.js';
export * from './contracts/multi-agent-orchestration.js';
export * from './contracts/proposal-review.js';
export * from './contracts/approval-admission.js';
export * from './contracts/execution-bridge.js';
export * from './contracts/execution-verification.js';
export * from './contracts/project-verification.js';
export * from './contracts/self-correction.js';
export * from './policies/policies.js';
export * from './providers/credential-sanitizer.js';
export * from './providers/cost-tracker.js';
export * from './providers/local-adapter.js';
export * from './providers/openai-adapter.js';
export * from './providers/anthropic-adapter.js';
export * from './providers/google-adapter.js';
export * from './providers/custom-adapter.js';
export * from './providers/provider-registry.js';
export * from './providers/provider-gateway.js';
export * from './orchestration/multi-agent-executor.js';
export * from './interfaces/core.js';

export * from './providers/circuit-breaker.js';
export * from './providers/mock-providers.js';
export * from './orchestration/context-builder.js';
export * from './orchestration/conflict-resolver.js';

// FAZ 58 Section 51 Public API & Aliases
export { createProviderGateway as createAIProviderGateway } from './providers/provider-gateway.js';
export { createMultiAgentExecutor as createMultiAgentOrchestrator } from './orchestration/multi-agent-executor.js';
export { aggregateAndReviewProposals as aggregateAgentProposals } from './contracts/proposal-review.js';

export function createAgentInvocation({
  agentId,
  role,
  providerId = 'local',
  prompt,
  systemPrompt = null,
  context = null,
  timeoutMs = 15000,
  metadata = {}
} = {}) {
  return Object.freeze({
    agentId: String(agentId || 'agent-default').trim(),
    role: String(role || 'DEVELOPER').trim(),
    providerId: String(providerId || 'local').trim(),
    prompt: String(prompt || '').trim(),
    systemPrompt: systemPrompt ? String(systemPrompt).trim() : null,
    context: context && typeof context === 'object' ? Object.freeze({ ...context }) : null,
    timeoutMs,
    metadata: Object.freeze({ ...metadata }),
    createdAt: new Date().toISOString()
  });
}

export function createProviderAdapter({
  id,
  name,
  model = 'custom-model',
  capabilities = [],
  invoke,
  checkHealth = null,
  metadata = {}
} = {}) {
  if (!id || typeof id !== 'string') throw new Error('Provider adapter requires id string');
  if (typeof invoke !== 'function') throw new Error('Provider adapter requires invoke function');
  return Object.freeze({
    id: id.trim(),
    providerId: id.trim(),
    name: String(name || id).trim(),
    model: String(model || 'custom-model').trim(),
    capabilities: Object.freeze([...capabilities]),
    invoke,
    checkHealth: checkHealth || (async () => ({ status: 'AVAILABLE', providerId: id.trim(), ready: true })),
    metadata: Object.freeze({ ...metadata })
  });
}

// FAZ 59 Autonomous AI Agency Execution Loop
export * from './autonomous/autonomous-job.js';
export * from './autonomous/project-analyzer.js';
export {
  analyzeTestFailure,
  classifyFailureEvidence,
  TestFailureCategory
} from './autonomous/failure-analyzer.js';
export * from './autonomous/auto-repair-controller.js';
export * from './autonomous/autonomous-loop-engine.js';

// FAZ 59 Real AI Control Plane
export * from './control-plane/index.js';

// FAZ 66.7 Provider-Agnostic AI Resource Orchestrator
export * from './orchestration/ai-resource-orchestrator.js';

// Autonomous Project Generator
export * from './autonomous/project-generator.js';
