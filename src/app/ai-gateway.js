/**
 * ONLUNET ZEKA - Application Layer: AI Gateway & Provider Foundation
 * Phase 13 Foundation
 *
 * Implements:
 * - Provider adapter boundary (using createProviderAdapterInterface semantics)
 * - Safe prompt ingestion without leaking secrets or direct execution access
 * - Declarative structured plan proposal extraction (Intent -> Analysis -> Plan)
 * - No direct process execution, no arbitrary fs access
 */
import { ErrorCodes } from '../contracts/constants.js';
import { createProjectGenerator } from '../autonomous/project-generator.js';

export function createAIGateway({ providerAdapter }) {
  if (!providerAdapter || typeof providerAdapter.chat !== 'function') {
    throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] AIGateway requires providerAdapter with chat() function`);
  }

  return Object.freeze({
    providerId: providerAdapter.providerId || 'mock-provider',

    /**
     * Ingests natural language task and workspace context, returning declarative plan proposal.
     */
    async analyzeAndPlan({ taskPrompt, workspaceSummary = {}, advisoryContext = null }) {
      if (!taskPrompt || typeof taskPrompt !== 'string' || taskPrompt.trim() === '') {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] taskPrompt is required`);
      }

      const promptPayload = {
        task: taskPrompt.trim(),
        workspace: {
          name: workspaceSummary.name || 'default',
          rootPath: workspaceSummary.rootPath || process.cwd()
        },
        ...(advisoryContext ? { advisoryContext } : {})
      };

      const response = await providerAdapter.chat(promptPayload);

      // Validate response structure
      if (!response || typeof response !== 'object') {
        throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Provider returned invalid response`);
      }

      return Object.freeze({
        intent: response.intent || taskPrompt,
        analysis: response.analysis || 'Analysis complete',
        proposedCommands: Object.freeze([...(response.proposedCommands || [])]),
        proposedFileChanges: Object.freeze([...(response.proposedFileChanges || [])]),
        proposedFileMutations: Object.freeze([...(response.proposedFileMutations || [])].map(m => Object.freeze({
          file: m.file,
          content: m.content !== undefined ? m.content : '',
          expectedState: m.expectedState !== undefined ? m.expectedState : null
        }))),
        riskLevel: response.riskLevel || 'LOW',
        requiresApproval: response.requiresApproval !== undefined ? response.requiresApproval : false
      });
    }
  });
}

/**
 * Built-in Standard Declarative Provider for local standalone operation.
 */
export function createStandardLocalProvider({
  planResolver = null
} = {}) {
  const defaultResolver = async (prompt) => {
    const text = (prompt.task || '').trim();
    const isProjectTask = /(proje|project|üret|create|generate|scaffold|oluştur|yap|app|api)/i.test(text);

    if (isProjectTask) {
      const generator = createProjectGenerator();
      const synthesis = await generator.synthesizeProject({
        prompt: text,
        targetDirectory: prompt.targetDirectory || 'generated-project'
      });
      const root = prompt.workspace?.rootPath || process.cwd();
      const plan = generator.createProjectPlan({ synthesis, workspaceRoot: root });

      return {
        intent: text,
        analysis: `Otonom Proje Tasarlandı: '${synthesis.projectName}' (${synthesis.projectType}). ${synthesis.files.length} dosya ve otomatik test paketi hazırlandı.`,
        proposedCommands: plan.expectedCommands,
        proposedFileChanges: plan.expectedFileChanges,
        proposedFileMutations: plan.authoritativeFileMutations,
        riskLevel: 'LOW',
        requiresApproval: true
      };
    }

    return {
      intent: prompt.task,
      analysis: `Analyzed task '${prompt.task}' against workspace '${prompt.workspace?.name}'`,
      proposedCommands: ['node --version'],
      proposedFileChanges: [],
      proposedFileMutations: [],
      riskLevel: 'LOW',
      requiresApproval: false
    };
  };

  const activeResolver = planResolver || defaultResolver;

  return Object.freeze({
    providerId: 'onlunet-standard-local',
    name: 'ONLUNET Local Autonomous Engine',
    async checkHealth() {
      return { status: 'READY', latencyMs: 0 };
    },
    async getQuota() {
      return { rpm: null, tpm: null, remaining: null };
    },
    async chat(promptPayload) {
      return activeResolver(promptPayload);
    }
  });
}

