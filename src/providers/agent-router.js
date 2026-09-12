/**
 * ONLUNET ZEKA - Multi-Agent Live Router
 * FAZ 63 Foundation: Role-Based Agent Routing & Orchestration Boundary
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 * ZERO SELF-AUTHORITY: All outputs remain proposalOnly with executionAuthorized: false.
 */
import { ProviderCapabilities } from './provider-capabilities.js';
import { QualityRequirement } from './task-analyzer.js';

export const AgentRoles = Object.freeze({
  ANALYSIS: 'ANALYSIS',
  VERIFICATION: 'VERIFICATION',
  SYNTHESIS: 'SYNTHESIS',
  DEVELOPER: 'DEVELOPER',
  SECURITY_AUDITOR: 'SECURITY_AUDITOR'
});

export const AGENT_ROLE_REQUIREMENTS = Object.freeze({
  [AgentRoles.ANALYSIS]: Object.freeze({
    capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING],
    qualityTarget: QualityRequirement.HIGH
  }),
  [AgentRoles.VERIFICATION]: Object.freeze({
    capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING, ProviderCapabilities.STRUCTURED_OUTPUT],
    qualityTarget: QualityRequirement.CRITICAL
  }),
  [AgentRoles.SYNTHESIS]: Object.freeze({
    capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT],
    qualityTarget: QualityRequirement.HIGH
  }),
  [AgentRoles.DEVELOPER]: Object.freeze({
    capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT],
    qualityTarget: QualityRequirement.MEDIUM
  }),
  [AgentRoles.SECURITY_AUDITOR]: Object.freeze({
    capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING, ProviderCapabilities.STRUCTURED_OUTPUT],
    qualityTarget: QualityRequirement.CRITICAL
  })
});

export function createAgentRouter({ routingEngine, taskAnalyzer = null } = {}) {
  if (!routingEngine || typeof routingEngine.route !== 'function') {
    throw new Error('createAgentRouter requires a valid routingEngine instance');
  }

  return Object.freeze({
    routeAgent({
      agentRole = AgentRoles.DEVELOPER,
      task,
      tenantId = null,
      workspaceId = null,
      dataClassification = null,
      budget = null,
      preferredProvider = null
    } = {}) {
      const roleConfig = AGENT_ROLE_REQUIREMENTS[agentRole.toUpperCase()] || {
        capabilities: [ProviderCapabilities.TEXT],
        qualityTarget: QualityRequirement.MEDIUM
      };

      const routingDecision = routingEngine.route({
        task,
        tenantId,
        workspaceId,
        dataClassification,
        budget,
        preferredProvider,
        requiredCapabilities: roleConfig.capabilities,
        qualityTarget: roleConfig.qualityTarget
      });

      return Object.freeze({
        agentRole: agentRole.toUpperCase(),
        routingDecision,
        proposalOnly: true,
        executionAuthorized: false,
        timestamp: new Date().toISOString()
      });
    },

    routePipeline({
      roles = [AgentRoles.ANALYSIS, AgentRoles.VERIFICATION, AgentRoles.SYNTHESIS],
      task,
      tenantId = null,
      workspaceId = null,
      dataClassification = null,
      budget = null
    } = {}) {
      const pipelineDecisions = [];

      for (const role of roles) {
        const decision = this.routeAgent({
          agentRole: role,
          task,
          tenantId,
          workspaceId,
          dataClassification,
          budget
        });
        pipelineDecisions.push(decision);
      }

      return Object.freeze({
        pipeline: Object.freeze(pipelineDecisions),
        totalAgents: pipelineDecisions.length,
        tenantId,
        workspaceId,
        proposalOnly: true,
        executionAuthorized: false,
        timestamp: new Date().toISOString()
      });
    }
  });
}
