/**
 * ONLUNET ZEKA - Universal Provider & Model Intelligent Routing Engine
 * FAZ 62 Foundation + FAZ 63 Intelligent Multi-Factor Routing & Explanation
 *
 * Routing Decision Chain:
 * Task -> Required Capabilities -> Security Boundary -> Budget -> Availability (Circuit Breaker)
 * -> Weighted Multi-Factor Scoring -> Model Selection -> Routing Explanation
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 * ZERO SELF-AUTHORITY: All routing decisions remain proposalOnly with executionAuthorized: false.
 */
import { ErrorCodes } from '../contracts/constants.js';
import { DataClassification } from '../control-plane/data-classifier.js';
import { ProviderCategories, ProviderPriority, LifecycleState } from './provider-categories.js';
import { analyzeTask, TaskTypes, TaskComplexity, QualityRequirement, LatencyRequirement, CostSensitivity } from './task-analyzer.js';

export function createRoutingEngine({
  registry,
  modelRegistry = null,
  circuitBreaker = null,
  telemetry = null
} = {}) {
  if (!registry) {
    throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] Routing engine requires provider registry');
  }

  return Object.freeze({
    registry,
    modelRegistry,
    circuitBreaker,
    telemetry,

    /**
     * Resolves optimal provider and model based on multi-factor policy
     */
    route({
      task = null,
      taskType = null,
      requiredCapabilities = [],
      dataClassification = DataClassification.INTERNAL,
      preferredProvider = null,
      preferredModel = null,
      tenantId = null,
      workspaceId = null,
      budget = null,
      maxCostUsd = null,
      latencyTarget = null,
      qualityTarget = null
    } = {}) {
      // Prototype pollution defense (Phase 63.31)
      if (task && typeof task === 'object' && ('__proto__' in task || 'constructor' in task)) {
        delete task['__proto__'];
        delete task['constructor'];
      }

      // 1. Task Analysis & Requirements Extraction (Phase 63.7 - 63.9)
      const effectiveBudget = (typeof budget === 'number') ? budget : ((typeof maxCostUsd === 'number') ? maxCostUsd : null);

      let analyzed = null;
      if (task) {
        analyzed = analyzeTask({
          task,
          tenantId,
          workspaceId,
          dataClassification,
          budget: effectiveBudget,
          latencyTarget,
          qualityTarget,
          requiredCapabilities
        });
      }

      const effectiveTaskType = (analyzed && analyzed.taskType) ? analyzed.taskType : (taskType || TaskTypes.GENERAL_QA);
      const effectiveClassification = (analyzed && analyzed.dataClassification) ? analyzed.dataClassification : (dataClassification || DataClassification.INTERNAL);
      const normClass = String(effectiveClassification).toUpperCase();
      
      const mergedCapabilities = new Set(Array.isArray(requiredCapabilities) ? requiredCapabilities : [requiredCapabilities].filter(Boolean));
      if (analyzed && analyzed.requiredCapabilities) {
        for (const c of analyzed.requiredCapabilities) mergedCapabilities.add(c);
      }
      const capabilities = Array.from(mergedCapabilities);

      const effectiveQuality = (analyzed && analyzed.qualityRequirement) ? analyzed.qualityRequirement : (qualityTarget || QualityRequirement.MEDIUM);
      const effectiveLatency = (analyzed && analyzed.latencyRequirement) ? analyzed.latencyRequirement : (latencyTarget || LatencyRequirement.STANDARD);
      const effectiveCostSensitivity = (analyzed && analyzed.costSensitivity) ? analyzed.costSensitivity : CostSensitivity.MEDIUM;

      const reasons = [];
      const rejectedCandidates = [];

      // Budget hard check: Budget = 0 fails closed (Phase 63.14)
      if (effectiveBudget !== null && effectiveBudget <= 0) {
        const err = new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] Budget is 0 or negative; routing blocked fail-closed');
        err.code = 'BUDGET_EXCEEDED';
        throw err;
      }

      // 2. Gather all registered providers
      const allEntries = registry.listProviders ? registry.listProviders({ tenantId, workspaceId }) : [];
      if (allEntries.length === 0) {
        throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] No registered providers available in current context');
      }

      // 3. Security Boundary Filter (Hard Gate - Phase 63.12 & 63.13)
      const isRestrictedOrSecret = normClass === DataClassification.SECRET ||
                                   normClass === DataClassification.RESTRICTED ||
                                   normClass === 'CRITICAL';

      const securityEligible = [];
      for (const entry of allEntries) {
        const isLocal = entry.isLocal ||
                        entry.category === ProviderCategories.LOCAL ||
                        entry.providerId === 'local' ||
                        entry.providerId === 'local-provider' ||
                        entry.providerId === 'ollama' ||
                        entry.providerId === 'vllm' ||
                        entry.providerId === 'test-mock';

        if (isRestrictedOrSecret && !isLocal) {
          rejectedCandidates.push({
            provider: entry.providerId,
            reason: `Cloud provider prohibited for ${normClass} data classification`
          });
        } else {
          securityEligible.push(entry);
        }
      }

      if (securityEligible.length === 0) {
        const err = new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] No eligible providers permitted for data classification ' + normClass);
        err.code = 'NO_ELIGIBLE_PROVIDER';
        throw err;
      }
      reasons.push(`Data classification ${normClass} permitted for ${securityEligible.length} candidate(s)`);

      // 4. Capability Filter (Hard Gate - Phase 63.10)
      const capabilityEligible = [];
      for (const entry of securityEligible) {
        const adapter = entry.adapter || entry;
        const adapterCaps = adapter.capabilities || entry.capabilities || [];
        const missing = capabilities.filter(cap => !adapterCaps.includes(cap));

        if (missing.length > 0) {
          rejectedCandidates.push({
            provider: entry.providerId,
            reason: `Missing required capabilities: [${missing.join(', ')}]`
          });
        } else {
          capabilityEligible.push(entry);
        }
      }

      if (capabilityEligible.length === 0) {
        const err = new Error('[CAPABILITY_UNSUPPORTED] No provider supports all requested capabilities: [' + capabilities.join(', ') + ']');
        err.code = 'CAPABILITY_UNSUPPORTED';
        throw err;
      }
      reasons.push(`All requested capabilities [${capabilities.join(', ')}] satisfied by ${capabilityEligible.length} provider(s)`);

      // 5. Circuit Breaker Availability Filter (Hard Gate)
      const availableCandidates = [];
      for (const entry of capabilityEligible) {
        if (circuitBreaker && typeof circuitBreaker.canExecute === 'function') {
          if (!circuitBreaker.canExecute(entry.providerId)) {
            rejectedCandidates.push({
              provider: entry.providerId,
              reason: 'Circuit breaker is OPEN (tripped due to consecutive failures)'
            });
            continue;
          }
        }
        availableCandidates.push(entry);
      }

      const pool = availableCandidates.length > 0 ? availableCandidates : capabilityEligible;
      if (availableCandidates.length > 0) {
        reasons.push(`Circuit breaker status verified: ${availableCandidates.length} healthy candidate(s)`);
      }

      // 6. Weighted Multi-Factor Scoring (Phase 63.11)
      const scoredCandidates = pool.map(entry => {
        let score = 0;
        const details = {};

        // A. Priority score
        const prio = entry.priority || ProviderPriority.SECONDARY;
        let pScore = 20;
        if (prio === ProviderPriority.PRIMARY) pScore = 30;
        else if (prio === ProviderPriority.FALLBACK) pScore = 10;
        score += pScore;
        details.priorityScore = pScore;

        // B. Cost score (higher score for lower cost when cost-sensitive)
        let cScore = 20;
        const isLocal = entry.isLocal || entry.category === ProviderCategories.LOCAL;
        if (isLocal) {
          cScore = (effectiveCostSensitivity === CostSensitivity.HIGH) ? 35 : 25;
        } else {
          cScore = (effectiveCostSensitivity === CostSensitivity.HIGH) ? 10 : 20;
        }
        score += cScore;
        details.costScore = cScore;

        // C. Latency score (Groq or local favored for low latency)
        let lScore = 15;
        if (effectiveLatency === LatencyRequirement.LOW) {
          if (entry.providerId === 'groq' || isLocal) {
            lScore = 30;
          } else {
            lScore = 10;
          }
        }
        score += lScore;
        details.latencyScore = lScore;

        // D. Quality / Reasoning match
        let qScore = 15;
        const adapter = entry.adapter || entry;
        const caps = adapter.capabilities || entry.capabilities || [];
        if (effectiveQuality === QualityRequirement.CRITICAL || effectiveQuality === QualityRequirement.HIGH) {
          if (caps.includes('REASONING')) qScore += 15;
        }
        score += qScore;
        details.qualityScore = qScore;

        return {
          entry,
          score,
          details
        };
      });

      scoredCandidates.sort((a, b) => b.score - a.score);

      // 7. Preferred Provider Evaluation
      let selectedEntry = null;
      let selectionScoreDetails = null;

      if (preferredProvider) {
        const preferredMatch = scoredCandidates.find(c => c.entry.providerId === preferredProvider);
        if (preferredMatch) {
          selectedEntry = preferredMatch.entry;
          selectionScoreDetails = preferredMatch.details;
          reasons.push(`Preferred provider '${preferredProvider}' honored per request policy`);
        } else {
          rejectedCandidates.push({
            provider: preferredProvider,
            reason: 'Preferred provider does not satisfy security, capability or health criteria'
          });
        }
      }

      if (!selectedEntry) {
        selectedEntry = scoredCandidates[0].entry;
        selectionScoreDetails = scoredCandidates[0].details;
        reasons.push(`Selected top-ranked candidate '${selectedEntry.providerId}' via weighted multi-factor scoring (Score: ${scoredCandidates[0].score})`);
      }

      // Record why other scored candidates were not selected
      for (const sc of scoredCandidates) {
        if (sc.entry.providerId !== selectedEntry.providerId) {
          rejectedCandidates.push({
            provider: sc.entry.providerId,
            reason: `Lower composite routing score (${sc.score} vs ${scoredCandidates[0].score})`
          });
        }
      }

      // 8. Model Selection (Phase 63.18)
      let selectedModel = preferredModel || (selectedEntry.adapter ? selectedEntry.adapter.model : selectedEntry.model);
      if (modelRegistry) {
        const providerModels = modelRegistry.listModels ? modelRegistry.listModels({ providerId: selectedEntry.providerId }) : [];
        if (providerModels.length > 0) {
          // If reasoning is required and model supports it, pick reasoning model
          if (capabilities.includes('REASONING')) {
            const reasoningModel = providerModels.find(m => m.capabilities && m.capabilities.includes('REASONING'));
            if (reasoningModel) {
              selectedModel = reasoningModel.id;
              reasons.push(`Selected model '${selectedModel}' matching REASONING capability requirement`);
            }
          }
          if (!selectedModel) {
            selectedModel = providerModels[0].id;
          }
        }
      }
      if (!selectedModel) {
        selectedModel = 'default-model';
      }

      // 9. Fallback Provider Designation (Security Boundary Guaranteed - Phase 63.23)
      const fallbackCandidates = pool.filter(e => e.providerId !== selectedEntry.providerId);
      const fallbackProvider = fallbackCandidates.length > 0 ? fallbackCandidates[0].providerId : null;
      if (fallbackProvider) {
        reasons.push(`Fallback provider designated: '${fallbackProvider}' within matching security boundary`);
      }

      const decision = Object.freeze({
        selectedProvider: selectedEntry.providerId,
        selectedModel,
        fallbackProvider,
        category: selectedEntry.category || (selectedEntry.isLocal ? ProviderCategories.LOCAL : ProviderCategories.DIRECT),
        dataClassification: normClass,
        matchedCapabilities: [...capabilities],
        securityStatus: 'PERMITTED',
        taskType: effectiveTaskType,
        complexity: analyzed ? analyzed.complexity : TaskComplexity.LOW,
        qualityRequirement: effectiveQuality,
        latencyRequirement: effectiveLatency,
        costSensitivity: effectiveCostSensitivity,
        reasons: Object.freeze([...reasons]),
        rejectedCandidates: Object.freeze([...rejectedCandidates]),
        scoring: selectionScoreDetails ? Object.freeze({ ...selectionScoreDetails }) : null,
        proposalOnly: true,
        executionAuthorized: false,
        timestamp: new Date().toISOString()
      });

      // Record in telemetry if configured
      if (telemetry && typeof telemetry.record === 'function') {
        telemetry.record({
          taskType: effectiveTaskType,
          selectedProvider: decision.selectedProvider,
          selectedModel: decision.selectedModel,
          routingScore: scoredCandidates[0] ? scoredCandidates[0].score : null,
          selectionReason: reasons.join('; '),
          rejectedProviders: rejectedCandidates,
          fallback: fallbackProvider,
          tenantId,
          workspaceId
        });
      }

      return decision;
    }
  });
}
