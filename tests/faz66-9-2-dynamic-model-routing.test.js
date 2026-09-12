/**
 * ONLUNET ZEKA - FAZ 66.9.2 DYNAMIC MODEL ROUTING REMEDIATION TEST SUITE
 *
 * Enforces:
 * Real Discovery -> Live Certification -> Actual Model Selection
 * Zero Phantom Models | Zero Silent Fallback | Zero Scope Expansion
 *
 * Test A: gemini-1.5-flash is NOT admitted into inventory as LIVE_AVAILABLE or LIVE_CERTIFIED
 * Test B: gemini-3.8-flash discovery result enters runtime inventory under canonical provider ID
 * Test C: Live-certified gemini-3.8-flash is scored and selected without legacy 1.5 blocking
 * Test D: Telemetry accurately exposes requestedModel, actualModel, modelVersion, and isSubstituted
 * Test E: 404 response on requested model strictly prevents false certification
 * Test F: DEFERRED discovery leaves model status as DISCOVERY_UNAVAILABLE / DEFERRED (never LIVE_CERTIFIED)
 * Test G: Provider namespace alignment between 'google' and 'gemini' eliminates cross-lookup misses
 * Test H: API modelVersion matches telemetry output accurately
 * Test I: Orchestrator failover semantics remain preserved when a candidate fails
 * Test J: AUTH_FAILED and QUOTA_EXCEEDED resources are strictly filtered out by scheduler gates
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js test runner only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import crypto from 'node:crypto';
import {
  createAIResourceOrchestrator,
  ModelHealthStatus,
  ModelAvailability,
  QuotaState,
  ProviderType,
  DefaultLiveCertifications
} from '../src/orchestration/ai-resource-orchestrator.js';
import { createGoogleProviderAdapter, createGeminiProviderAdapter } from '../src/providers/google-adapter.js';
import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { createModelRegistry } from '../src/providers/model-registry.js';
import { calculateCost } from '../src/providers/cost-tracker.js';
import { ProviderCapabilities } from '../src/providers/provider-capabilities.js';
import { GatewayInvocationStatus } from '../src/providers/provider-gateway.js';

describe('FAZ 66.9.2: Dynamic Model Routing Remediation', () => {

  // Test A: gemini-1.5-flash is not admitted into inventory as LIVE_AVAILABLE or LIVE_CERTIFIED
  it('Test A: gemini-1.5-flash is not admitted into inventory as LIVE_AVAILABLE or LIVE_CERTIFIED', () => {
    const orchestrator = createAIResourceOrchestrator();
    const inventory = orchestrator.listResources();

    const g15Resources = inventory.filter(r => r.modelId === 'gemini-1.5-flash');
    assert.ok(g15Resources.length > 0, 'gemini-1.5-flash entries should be present in catalog');

    for (const r of g15Resources) {
      assert.notStrictEqual(r.status, ModelAvailability.LIVE_CERTIFIED, '1.5-flash must NOT be LIVE_CERTIFIED');
      assert.notStrictEqual(r.availability, ModelAvailability.LIVE_AVAILABLE, '1.5-flash must NOT be LIVE_AVAILABLE');
      assert.strictEqual(r.liveCertified, false, '1.5-flash liveCertified must be false');
      assert.ok(
        r.status === ModelAvailability.DEFERRED || r.availability === ModelAvailability.UNAVAILABLE,
        '1.5-flash must be marked DEFERRED or UNAVAILABLE'
      );
    }

    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-1.5-flash'), false);
    assert.strictEqual(orchestrator.isModelCertified('google', 'gemini-1.5-flash'), false);
  });

  // Test B: gemini-3.8-flash discovery result enters runtime inventory under canonical provider ID
  it('Test B: gemini-3.8-flash discovery result enters runtime inventory under canonical provider ID', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    const modelRegistry = createModelRegistry();

    registry.registerProvider({
      providerId: 'gemini',
      name: 'Google Gemini Provider Gateway',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT],
      discoverModels: async () => ({
        providerId: 'gemini',
        discoveredAt: new Date().toISOString(),
        source: 'live_api',
        live: true,
        status: 'AVAILABLE',
        models: [
          {
            id: 'gemini-3.8-flash',
            providerId: 'gemini',
            capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT, 'fast_inference'],
            contextWindow: 1048576,
            inputModalities: ['text', 'image'],
            outputModalities: ['text'],
            status: 'AVAILABLE'
          }
        ]
      }),
      invoke: async () => ({ output: 'OK', model: 'gemini-3.8-flash' })
    });

    const orchestrator = createAIResourceOrchestrator({ registry, modelRegistry, initialCertifications: [] });
    const discovered = await orchestrator.discoverProviderModels('gemini');

    assert.ok(Array.isArray(discovered), 'Discovered result must be array');
    assert.strictEqual(discovered.length, 1);
    assert.strictEqual(discovered[0].id, 'gemini-3.8-flash');

    const inventory = orchestrator.listResources();
    const g38 = inventory.find(r => r.modelId === 'gemini-3.8-flash');
    assert.ok(g38, 'gemini-3.8-flash must be found in inventory');
    assert.strictEqual(g38.providerId, 'gemini');
    assert.strictEqual(g38.contextWindow, 1048576);
  });

  // Test C: Live-certified gemini-3.8-flash is scored and selected without being blocked by legacy 1.5 defaults
  it('Test C: Live-certified gemini-3.8-flash is scored and selected without being blocked by legacy 1.5 defaults', () => {
    const orchestrator = createAIResourceOrchestrator();
    const decision = orchestrator.selectBestModel({
      preferredProvider: 'gemini',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    assert.ok(decision.candidates.length > 0, 'Candidates must be found');
    const topCandidate = decision.candidates[0];
    assert.strictEqual(topCandidate.modelId, 'gemini-3.8-flash', 'gemini-3.8-flash should be top-ranked candidate');
    assert.strictEqual(topCandidate.liveCertified, true, 'Top candidate must be liveCertified');

    const g15Candidate = decision.candidates.find(c => c.modelId === 'gemini-1.5-flash');
    if (g15Candidate) {
      assert.ok(topCandidate.score > g15Candidate.score, '3.8-flash must score higher than 1.5-flash');
    }
  });

  // Test D: Telemetry exposes requestedModel, actualModel, modelVersion, and isSubstituted accurately
  it('Test D: Telemetry exposes requestedModel, actualModel, modelVersion, and isSubstituted accurately', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        candidates: [{
          content: { parts: [{ text: JSON.stringify({ rationale: 'Dynamic routing verified' }) }] },
          finishReason: 'STOP'
        }],
        usageMetadata: { promptTokenCount: 15, candidatesTokenCount: 25, totalTokenCount: 40 },
        modelVersion: 'gemini-3.8-flash-v2026'
      }));
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseURL = 'http://127.0.0.1:' + port + '/v1beta';

    try {
      const adapter = createGoogleProviderAdapter({
        baseURL,
        apiKey: 'test-api-key',
        model: 'gemini-3.8-flash'
      });

      const result = await adapter.invoke({
        prompt: 'Test telemetry',
        metadata: { model: 'gemini-3.8-flash' }
      });

      assert.strictEqual(result.requestedModel, 'gemini-3.8-flash');
      assert.strictEqual(result.actualModel, 'gemini-3.8-flash');
      assert.strictEqual(result.modelVersion, 'gemini-3.8-flash-v2026');
      assert.strictEqual(result.isSubstituted, false);
      assert.strictEqual(result.substitutionReason, null);
    } finally {
      server.close();
    }
  });

  // Test E: 404 response on requested model prevents false certification
  it('Test E: 404 response on requested model prevents false certification', () => {
    const orchestrator = createAIResourceOrchestrator({ initialCertifications: [] });

    const result = orchestrator.certifyModelInference('gemini', 'gemini-1.5-flash', {
      requestedModel: 'gemini-1.5-flash',
      actualModel: 'gemini-3.8-flash',
      modelVersion: 'gemini-3.8-flash-001',
      isSubstituted: true,
      substitutionReason: 'MODEL_NOT_FOUND_404_SUBSTITUTION',
      httpStatus: 200,
      output: 'Genuine response from substitute model',
      latencyMs: 1200,
      sha256: crypto.createHash('sha256').update('Genuine response').digest('hex')
    });

    assert.strictEqual(result.live, false, 'Requested model that returned 404 must NOT be certified');
    assert.strictEqual(result.status, ModelAvailability.INFERENCE_FAILED);
    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-1.5-flash'), false);
    assert.strictEqual(orchestrator.isModelCertified('google', 'gemini-1.5-flash'), false);
  });

  // Test F: DEFERRED discovery leaves model status as DISCOVERY_UNAVAILABLE / DEFERRED, never LIVE_CERTIFIED
  it('Test F: DEFERRED discovery leaves model status as DISCOVERY_UNAVAILABLE / DEFERRED, never LIVE_CERTIFIED', async () => {
    const registry = createProviderRegistry({ includeBuiltins: false });
    registry.registerProvider({
      providerId: 'google',
      name: 'Google Gemini Gateway',
      capabilities: [ProviderCapabilities.TEXT],
      discoverModels: async () => ({
        providerId: 'google',
        discoveredAt: new Date().toISOString(),
        source: 'error',
        live: false,
        status: 'DEFERRED',
        reason: 'DISCOVERY_UNAVAILABLE',
        models: []
      }),
      invoke: async () => { throw new Error('Unreachable'); }
    });

    const orchestrator = createAIResourceOrchestrator({ registry, initialCertifications: [] });
    const discovery = await orchestrator.discoverProviderModels('google');

    assert.strictEqual(discovery.status, 'DEFERRED');
    assert.strictEqual(discovery.reason, 'DISCOVERY_UNAVAILABLE');
    assert.strictEqual(discovery.live, false);

    const matrix = orchestrator.getCertificationMatrix();
    for (const m of matrix) {
      assert.notStrictEqual(m.modelState, ModelAvailability.LIVE_CERTIFIED);
      assert.strictEqual(m.liveCertified, false);
    }
  });

  // Test G: Provider namespace alignment between google and gemini eliminates cross-lookup misses
  it('Test G: Provider namespace alignment between google and gemini eliminates cross-lookup misses', () => {
    const modelRegistry = createModelRegistry();
    const gFromGoogle = modelRegistry.getModel('gemini-3.8-flash', 'google');
    const gFromGemini = modelRegistry.getModel('gemini-3.8-flash', 'gemini');

    assert.ok(gFromGoogle, 'Model must be found under google namespace');
    assert.ok(gFromGemini, 'Model must be found under gemini namespace');
    assert.strictEqual(gFromGoogle.id, gFromGemini.id);

    const costGoogle = calculateCost({ providerId: 'google', model: 'gemini-3.8-flash', inputTokens: 1000, outputTokens: 500 });
    const costGemini = calculateCost({ providerId: 'gemini', model: 'gemini-3.8-flash', inputTokens: 1000, outputTokens: 500 });

    assert.ok(costGoogle.estimatedCostUsd > 0);
    assert.strictEqual(costGoogle.estimatedCostUsd, costGemini.estimatedCostUsd);

    const orchestrator = createAIResourceOrchestrator();
    assert.strictEqual(orchestrator.isModelCertified('gemini', 'gemini-3.8-flash'), true);
    assert.strictEqual(orchestrator.isModelCertified('google', 'gemini-3.8-flash'), true);
  });

  // Test H: API modelVersion matches telemetry output
  it('Test H: API modelVersion matches telemetry output', async () => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        candidates: [{
          content: { parts: [{ text: '{"rationale":"Model version check passed"}' }] },
          finishReason: 'STOP'
        }],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
        modelVersion: 'gemini-3.8-flash-preview-2026-03-01'
      }));
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseURL = 'http://127.0.0.1:' + port + '/v1beta';

    try {
      const adapter = createGeminiProviderAdapter({
        baseURL,
        apiKey: 'test-key',
        model: 'gemini-3.8-flash'
      });

      const response = await adapter.invoke({ prompt: 'Version check' });
      assert.strictEqual(response.modelVersion, 'gemini-3.8-flash-preview-2026-03-01');
      assert.strictEqual(response.actualModel, 'gemini-3.8-flash');
      assert.strictEqual(response.isSubstituted, false);
    } finally {
      server.close();
    }
  });

  // Test I: Orchestrator failover semantics remain preserved when a candidate model fails
  it('Test I: Orchestrator failover semantics remain preserved when a candidate model fails', async () => {
    const prevGroqKey = process.env.GROQ_API_KEY;
    process.env.GROQ_API_KEY = 'gsk-test-key';

    try {
      const registry = createProviderRegistry({ includeBuiltins: false });
      let attempts = 0;

      registry.registerProvider({
        providerId: 'gemini',
        name: 'Gemini Primary (Failing)',
        capabilities: [ProviderCapabilities.TEXT],
        priority: 1,
        invoke: async () => {
          attempts++;
          const err = new Error('Model not found (404)');
          err.status = 404;
          err.code = 'NOT_FOUND';
          throw err;
        }
      });

      registry.registerProvider({
        providerId: 'groq',
        name: 'Groq Secondary (Healthy)',
        capabilities: [ProviderCapabilities.TEXT],
        priority: 2,
        invoke: async () => {
          attempts++;
          return {
            output: '{"rationale":"Fallback successful"}',
            rawContent: '{"rationale":"Fallback successful"}',
            model: 'llama-3.3-70b-versatile',
            status: GatewayInvocationStatus.SUCCESS
          };
        }
      });

      const orchestrator = createAIResourceOrchestrator({
        registry,
        initialCertifications: [
          { providerId: 'gemini', modelId: 'gemini-3.8-flash', httpStatus: 200, responseHash: 'h1', live: true },
          { providerId: 'groq', modelId: 'llama-3.3-70b-versatile', httpStatus: 200, responseHash: 'h2', live: true }
        ]
      });

      const result = await orchestrator.dispatchTask({
        prompt: 'Testing failover cascade',
        maxFailoverAttempts: 5,
        requiredCapabilities: [ProviderCapabilities.TEXT]
      });

      assert.strictEqual(result.fallbackTriggered, true, 'Fallback should be triggered');
      assert.ok(result.attemptNumber >= 2, 'Should take at least 2 attempts');
      assert.ok(result.failoverTraces.length >= 1, 'Failover trace should be recorded');
      assert.strictEqual(result.modelId, 'llama-3.3-70b-versatile', 'Secondary model should succeed');
      assert.strictEqual(result.status, GatewayInvocationStatus.SUCCESS);
    } finally {
      if (prevGroqKey !== undefined) {
        process.env.GROQ_API_KEY = prevGroqKey;
      } else {
        delete process.env.GROQ_API_KEY;
      }
    }
  });

  // Test J: AUTH_FAILED and QUOTA_EXCEEDED resources are strictly filtered out by scheduler gates
  it('Test J: AUTH_FAILED and QUOTA_EXCEEDED resources are strictly filtered out by scheduler gates', () => {
    const orchestrator = createAIResourceOrchestrator();

    orchestrator.setHealthState('gemini', 'gemini-3.8-flash', ModelHealthStatus.AUTH_FAILED);

    const decisionAuth = orchestrator.selectBestModel({
      preferredProvider: 'gemini',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    const authRejected = decisionAuth.rejectedModels.find(m => m.modelId === 'gemini-3.8-flash');
    assert.ok(authRejected, 'gemini-3.8-flash must be rejected due to AUTH_FAILED');
    assert.strictEqual(authRejected.failedGate, 'HEALTH_STATUS');

    orchestrator.setHealthState('gemini', 'gemini-3.8-flash', ModelHealthStatus.HEALTHY);
    orchestrator.setQuotaState('gemini', 'gemini-3.8-flash', QuotaState.QUOTA_EXCEEDED);

    const decisionQuota = orchestrator.selectBestModel({
      preferredProvider: 'gemini',
      requiredCapabilities: [ProviderCapabilities.TEXT]
    });

    const quotaRejected = decisionQuota.rejectedModels.find(m => m.modelId === 'gemini-3.8-flash');
    assert.ok(quotaRejected, 'gemini-3.8-flash must be rejected due to QUOTA_STATUS');
    assert.strictEqual(quotaRejected.failedGate, 'QUOTA_STATUS');
  });

});
