/**
 * ONLUNET ZEKA - AI Provider Gateway Local Adapter
 * FAZ 58 Foundation: Deterministic In-Memory Provider Adapter
 *
 * Provides a fast, deterministic, zero-network adapter for unit tests,
 * CI pipelines, and offline evaluation.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';
import { ProviderCapabilities } from './provider-gateway.js';

export function createLocalProviderAdapter({
  providerId = 'local-provider',
  name = 'ONLUNET Local Deterministic Engine',
  model = 'local-deterministic-v1',
  defaultResponseHandler = null,
  latencyMs = 0,
  simulateError = null,
  simulateRateLimit = false,
  simulateTimeout = false,
  rateLimitResetSeconds = 2
} = {}) {
  let callCount = 0;

  const capabilities = Object.freeze([
    ProviderCapabilities.TEXT,
    ProviderCapabilities.STRUCTURED_OUTPUT,
    ProviderCapabilities.LOCAL
  ]);

  return Object.freeze({
    providerId,
    name,
    model: String(model).trim(),
    isLocal: true,
    capabilities,

    get callCount() {
      return callCount;
    },

    async checkHealth() {
      if (simulateError) {
        return { status: 'UNHEALTHY', latencyMs: 0, error: simulateError };
      }
      return { status: 'HEALTHY', latencyMs: 0 };
    },

    healthCheck() {
      return this.checkHealth();
    },

    async discoverModels() {
      return Object.freeze({
        providerId,
        discoveredAt: new Date().toISOString(),
        source: 'local_engine',
        live: true,
        models: Object.freeze([
          Object.freeze({
            id: String(model).trim(),
            providerId,
            capabilities,
            contextWindow: 32768,
            inputModalities: Object.freeze(['text']),
            outputModalities: Object.freeze(['text']),
            status: 'AVAILABLE',
            rawMetadata: { local: true, deterministic: true }
          })
        ])
      });
    },

    /**
     * Standard Invocation Interface
     */
    async invoke({
      prompt,
      agentRole = 'DEVELOPER',
      constraints = {},
      metadata = {},
      signal = null
    } = {}) {
      callCount += 1;

      if (simulateTimeout) {
        await new Promise((_, reject) => {
          const timeout = setTimeout(() => reject(new Error('Simulated provider timeout')), 200);
          if (signal) {
            signal.addEventListener('abort', () => {
              clearTimeout(timeout);
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        });
      }

      if (signal && signal.aborted) {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      }

      if (simulateRateLimit) {
        const err = new Error('Simulated rate limit exceeded (HTTP 429)');
        err.status = 429;
        err.retryAfter = rateLimitResetSeconds;
        throw err;
      }

      if (simulateError) {
        const err = new Error(typeof simulateError === 'string' ? simulateError : 'Simulated local provider error');
        err.code = ErrorCodes.EXECUTION_FAILED;
        throw err;
      }

      if (latencyMs > 0) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, latencyMs);
          if (signal) {
            if (signal.aborted) {
              clearTimeout(timer);
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              return reject(err);
            }
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            }, { once: true });
          }
        });
      }

      if (typeof defaultResponseHandler === 'function') {
        const custom = await defaultResponseHandler({ prompt, agentRole, constraints, metadata });
        return custom;
      }

      // Default deterministic structured proposal response
      const objective = typeof prompt === 'string' ? prompt : (prompt && prompt.task ? prompt.task : 'Deterministic task');
      
      const defaultPayload = {
        rationale: `Deterministic specialist analysis by ${agentRole} for objective: ${objective}`,
        operations: [
          {
            type: 'CREATE',
            target: `src/generated/${agentRole.toLowerCase()}-output.js`,
            description: `Generated change by ${agentRole}`
          }
        ],
        proposedFiles: [`src/generated/${agentRole.toLowerCase()}-output.js`],
        proposedTests: [`tests/generated/${agentRole.toLowerCase()}-output.test.js`],
        risks: [
          {
            level: 'LOW',
            description: 'Minimal risk deterministic mock operation'
          }
        ],
        assumptions: [
          'Preflight policies verified by host',
          'Target workspace directory exists'
        ],
        model: 'local-mock',
        usage: {
          inputTokens: Math.ceil(objective.length / 4) + 10,
          outputTokens: 45,
          totalTokens: Math.ceil(objective.length / 4) + 55
        },
        output: `Deterministic specialist analysis by ${agentRole} for objective: ${objective}`
      };

      return defaultPayload;
    },

    /**
     * Backward-compatibility wrapper for chat()
     */
    async chat(promptPayload) {
      const promptText = promptPayload && promptPayload.task ? promptPayload.task : JSON.stringify(promptPayload);
      const res = await this.invoke({ prompt: promptText });
      return {
        intent: promptPayload.task || 'Deterministic Intent',
        analysis: res.rationale || 'Analysis complete',
        proposedCommands: ['node --version'],
        proposedFileChanges: res.proposedFiles || [],
        proposedFileMutations: (res.operations || []).map(op => ({
          file: op.target,
          content: `// Auto-generated by ${this.providerId}`,
          expectedState: null
        })),
        riskLevel: 'LOW',
        requiresApproval: false
      };
    },

    /**
     * Backward-compatibility wrapper for generate()
     */
    async generate(prompt) {
      return this.invoke({ prompt });
    }
  });
}
