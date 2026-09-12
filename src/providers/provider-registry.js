/**
 * ONLUNET ZEKA - Universal AI Provider Registry 2.0
 * FAZ 62 Architecture: 10+ Provider Catalog, Extensible Plugin Registration & Metadata
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';
import { createLocalProviderAdapter } from './local-adapter.js';
import { createOpenAIProviderAdapter } from './openai-adapter.js';
import { createAnthropicProviderAdapter } from './anthropic-adapter.js';
import { createGoogleProviderAdapter, createGeminiProviderAdapter } from './google-adapter.js';
import { createCustomProviderAdapter } from './custom-adapter.js';

// FAZ 62 Extended Adapters
import { createXAIProviderAdapter } from './xai-adapter.js';
import { createMistralProviderAdapter } from './mistral-adapter.js';
import { createDeepSeekProviderAdapter } from './deepseek-adapter.js';
import { createGroqProviderAdapter } from './groq-adapter.js';
import { createOpenRouterProviderAdapter } from './openrouter-adapter.js';
import { createOllamaProviderAdapter } from './ollama-adapter.js';
import { createVLLMProviderAdapter } from './vllm-adapter.js';
import { createNvidiaProviderAdapter } from './nvidia-adapter.js';
import { createKimiProviderAdapter } from './kimi-adapter.js';

import { ProviderCategories, ProviderPriority } from './provider-categories.js';
import { ProviderCapabilities } from './provider-capabilities.js';

export function createProviderRegistry({
  includeBuiltins = true,
  customProviders = []
} = {}) {
  const providers = new Map();

  function register(adapter, {
    tenantId = null,
    workspaceId = null,
    category = null,
    priority = null,
    enabled = true,
    securityClass = 'STANDARD'
  } = {}) {
    if (!adapter || typeof adapter !== 'object') {
      throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] Provider adapter must be a non-null object');
    }

    const providerId = adapter.providerId || adapter.id;
    if (!providerId || typeof providerId !== 'string' || providerId.trim() === '') {
      throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] Provider adapter requires non-empty providerId');
    }

    const cleanId = providerId.trim();

    if (cleanId === '__proto__' || cleanId === 'constructor' || cleanId === 'prototype') {
      throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + '] Invalid providerId');
    }

    if (providers.has(cleanId)) {
      throw new Error('[' + ErrorCodes.INVALID_CONTRACT + "] Provider '" + cleanId + "' is already registered");
    }

    if (
      typeof adapter.invoke !== 'function' &&
      typeof adapter.chat !== 'function' &&
      typeof adapter.generate !== 'function' &&
      typeof adapter.complete !== 'function'
    ) {
      throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] Provider adapter must implement invoke(), chat(), or generate()');
    }

    const inferredCategory = category || adapter.category || (adapter.isLocal ? ProviderCategories.LOCAL : ProviderCategories.DIRECT);
    const caps = Array.isArray(adapter.capabilities) ? [...adapter.capabilities] : [];

    const entry = {
      adapter,
      providerId: cleanId,
      id: cleanId,
      name: adapter.name || adapter.displayName || cleanId,
      displayName: adapter.name || adapter.displayName || cleanId,
      category: inferredCategory,
      priority: priority !== null ? priority : (adapter.priority !== undefined ? adapter.priority : ProviderPriority.PRIMARY),
      enabled: Boolean(enabled),
      securityClass,
      model: adapter.model || adapter.defaultModel || 'unknown',
      defaultModel: adapter.defaultModel || adapter.model || 'unknown',
      isLocal: Boolean(adapter.isLocal || inferredCategory === ProviderCategories.LOCAL),
      hasCredentials: Boolean(adapter.hasCredentials || adapter.isLocal || inferredCategory === ProviderCategories.LOCAL),
      capabilities: Object.freeze(caps),
      supportsStreaming: caps.includes(ProviderCapabilities.STREAMING),
      supportsStructuredOutput: caps.includes(ProviderCapabilities.STRUCTURED_OUTPUT),
      supportsVision: caps.includes(ProviderCapabilities.VISION),
      supportsTools: caps.includes(ProviderCapabilities.TOOL_USE),
      supportsReasoning: caps.includes(ProviderCapabilities.REASONING),
      tenantId: tenantId ? String(tenantId).trim() : null,
      workspaceId: workspaceId ? String(workspaceId).trim() : null,
      registeredAt: new Date().toISOString()
    };

    providers.set(cleanId, entry);
    return entry;
  }

  // Pre-populate 10+ standard builtins if requested
  if (includeBuiltins) {
    // 1. Local Deterministic Provider (Built-in offline engine)
    register(createLocalProviderAdapter({ providerId: 'local' }), { category: ProviderCategories.LOCAL, priority: ProviderPriority.PRIMARY });
    register(createLocalProviderAdapter({ providerId: 'local-provider' }), { category: ProviderCategories.LOCAL, priority: ProviderPriority.SECONDARY });

    // 2. Direct Cloud Providers
    register(createOpenAIProviderAdapter(), { category: ProviderCategories.DIRECT, priority: ProviderPriority.PRIMARY });
    register(createAnthropicProviderAdapter(), { category: ProviderCategories.DIRECT, priority: ProviderPriority.PRIMARY });
    register(createGoogleProviderAdapter({ providerId: 'google' }), { category: ProviderCategories.DIRECT, priority: ProviderPriority.PRIMARY });
    register(createGeminiProviderAdapter({ providerId: 'gemini' }), { category: ProviderCategories.DIRECT, priority: ProviderPriority.PRIMARY });
    register(createXAIProviderAdapter(), { category: ProviderCategories.DIRECT, priority: ProviderPriority.SECONDARY });
    register(createMistralProviderAdapter(), { category: ProviderCategories.DIRECT, priority: ProviderPriority.SECONDARY });
    register(createDeepSeekProviderAdapter(), { category: ProviderCategories.DIRECT, priority: ProviderPriority.SECONDARY });
    register(createKimiProviderAdapter({ providerId: 'kimi' }), { category: ProviderCategories.DIRECT, priority: ProviderPriority.PRIMARY });

    // 3. Fast Inference & Aggregator Providers
    register(createGroqProviderAdapter(), { category: ProviderCategories.INFERENCE, priority: ProviderPriority.PRIMARY });
    register(createNvidiaProviderAdapter(), { category: ProviderCategories.INFERENCE, priority: ProviderPriority.SECONDARY });
    register(createOpenRouterProviderAdapter(), { category: ProviderCategories.AGGREGATOR, priority: ProviderPriority.SECONDARY });

    // 4. Local / Self-Hosted Engines
    register(createOllamaProviderAdapter(), { category: ProviderCategories.LOCAL, priority: ProviderPriority.PRIMARY });
    register(createVLLMProviderAdapter(), { category: ProviderCategories.CUSTOM, priority: ProviderPriority.SECONDARY });
    register(createCustomProviderAdapter({ providerId: 'custom' }), { category: ProviderCategories.CUSTOM, priority: ProviderPriority.FALLBACK });
  }

  for (const custom of customProviders) {
    if (custom.adapter) {
      register(custom.adapter, { tenantId: custom.tenantId, workspaceId: custom.workspaceId, category: custom.category, priority: custom.priority });
    } else {
      register(custom, { tenantId: custom.tenantId, workspaceId: custom.workspaceId, category: custom.category, priority: custom.priority });
    }
  }

  return Object.freeze({
    register,
    registerProvider: register, // Extension point alias

    getProvider(providerId, { tenantId = null, workspaceId = null } = {}) {
      if (!providerId || typeof providerId !== 'string') {
        throw new Error('[' + ErrorCodes.INVALID_CONTRACT + '] providerId is required');
      }

      const cleanId = providerId.trim();
      const lookupId = (cleanId === 'gemini' && !providers.has('gemini') && providers.has('google')) ? 'google' : cleanId;
      const entry = providers.get(lookupId);
      if (!entry) {
        throw new Error('[' + ErrorCodes.INVALID_CONTRACT + "] Provider '" + cleanId + "' is not registered");
      }

      // Tenant isolation check
      if (entry.tenantId !== null && entry.tenantId !== tenantId) {
        throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + "] Provider tenant '" + entry.tenantId + "' does not match caller tenant '" + (tenantId || 'unspecified') + "'");
      }

      // Workspace isolation check
      if (entry.workspaceId !== null && entry.workspaceId !== workspaceId) {
        throw new Error('[' + ErrorCodes.SECURITY_BLOCKED + "] Provider workspace '" + entry.workspaceId + "' does not match caller workspace '" + (workspaceId || 'unspecified') + "'");
      }

      return entry.adapter;
    },

    getEntry(providerId, { tenantId = null, workspaceId = null } = {}) {
      if (!providerId || typeof providerId !== 'string') return null;
      const cleanId = providerId.trim();
      const entry = providers.get(cleanId);
      if (!entry) return null;
      if (entry.tenantId !== null && entry.tenantId !== tenantId) return null;
      if (entry.workspaceId !== null && entry.workspaceId !== workspaceId) return null;
      return Object.freeze({ ...entry });
    },

    hasProvider(providerId) {
      return providers.has(typeof providerId === 'string' ? providerId.trim() : '');
    },

    listProviders({ tenantId = null, workspaceId = null } = {}) {
      const list = [];
      for (const entry of providers.values()) {
        if (entry.tenantId !== null && entry.tenantId !== tenantId) {
          continue;
        }
        if (entry.workspaceId !== null && entry.workspaceId !== workspaceId) {
          continue;
        }
        list.push(Object.freeze({
          providerId: entry.providerId,
          id: entry.id,
          name: entry.name,
          displayName: entry.displayName,
          category: entry.category,
          priority: entry.priority,
          enabled: entry.enabled,
          model: entry.model,
          defaultModel: entry.defaultModel,
          isLocal: entry.isLocal,
          hasCredentials: entry.hasCredentials,
          capabilities: entry.capabilities,
          supportsStreaming: entry.supportsStreaming,
          supportsStructuredOutput: entry.supportsStructuredOutput,
          supportsVision: entry.supportsVision,
          supportsTools: entry.supportsTools,
          supportsReasoning: entry.supportsReasoning,
          tenantId: entry.tenantId,
          workspaceId: entry.workspaceId,
          registeredAt: entry.registeredAt
        }));
      }
      return Object.freeze(list);
    },

    async checkAllHealth() {
      const results = {};
      for (const [id, entry] of providers.entries()) {
        try {
          if (typeof entry.adapter.checkHealth === 'function') {
            results[id] = await entry.adapter.checkHealth();
          } else if (typeof entry.adapter.healthCheck === 'function') {
            results[id] = await entry.adapter.healthCheck();
          } else {
            results[id] = { status: 'HEALTHY', providerId: id, ready: true };
          }
        } catch (err) {
          results[id] = {
            status: 'UNAVAILABLE',
            providerId: id,
            ready: false,
            error: err.message
          };
        }
      }
      return Object.freeze(results);
    }
  });
}
