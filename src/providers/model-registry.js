/**
 * ONLUNET ZEKA - Model Registry 1.0
 * FAZ 62 Foundation: Independent Model Management & Metadata Catalog
 *
 * Key Invariant: Provider ≠ Model.
 * Multiple models can be registered per provider, and aggregators can route models across providers.
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { ErrorCodes } from '../contracts/constants.js';
import { ProviderCapabilities } from './provider-capabilities.js';

export function createModelRegistry(options = {}) {
  const includeBuiltins = options.includeBuiltins !== false;
  const models = new Map();

  function registerModel(modelDef) {
    if (!modelDef || typeof modelDef !== 'object') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Model definition must be a non-null object`);
    }

    const id = modelDef.id;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Model definition requires non-empty id`);
    }

    const providerId = modelDef.providerId;
    if (!providerId || typeof providerId !== 'string' || providerId.trim() === '') {
      throw new Error(`[${ErrorCodes.INVALID_CONTRACT}] Model definition requires non-empty providerId`);
    }

    const entry = Object.freeze({
      id: id.trim(),
      providerId: providerId.trim(),
      displayName: modelDef.displayName || id.trim(),
      capabilities: Object.freeze(Array.isArray(modelDef.capabilities) ? [...modelDef.capabilities] : [ProviderCapabilities.TEXT]),
      contextWindow: typeof modelDef.contextWindow === 'number' ? modelDef.contextWindow : 8192,
      inputModalities: Object.freeze(Array.isArray(modelDef.inputModalities) ? [...modelDef.inputModalities] : ['text']),
      outputModalities: Object.freeze(Array.isArray(modelDef.outputModalities) ? [...modelDef.outputModalities] : ['text']),
      pricing: Object.freeze(modelDef.pricing ? { ...modelDef.pricing } : { inputPerMillion: 0, outputPerMillion: 0 }),
      isPaid: Boolean(modelDef.isPaid),
      isFreeTier: Boolean(modelDef.isFreeTier),
      availability: modelDef.availability || 'AVAILABLE',
      registeredAt: new Date().toISOString()
    });

    const key = `${entry.providerId}:${entry.id}`;
    models.set(key, entry);
    // If registered as google or gemini, alias under both namespaces for cross-resolution
    if (entry.providerId === 'google') {
      models.set(`gemini:${entry.id}`, entry);
    } else if (entry.providerId === 'gemini') {
      models.set(`google:${entry.id}`, entry);
    }
    // Also index by ID for global lookup if unambiguous
    if (!models.has(entry.id)) {
      models.set(entry.id, entry);
    }

    return entry;
  }

  // Pre-populate built-in model definitions for 10+ providers
  const defaultModels = [
    // OpenAI
    { id: 'gpt-4o', providerId: 'openai', displayName: 'GPT-4o', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.VISION, ProviderCapabilities.REASONING], contextWindow: 128000, pricing: { inputPerMillion: 2.50, outputPerMillion: 10.00 } },
    { id: 'gpt-4o-mini', providerId: 'openai', displayName: 'GPT-4o Mini', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.VISION], contextWindow: 128000, pricing: { inputPerMillion: 0.15, outputPerMillion: 0.60 } },
    { id: 'o1', providerId: 'openai', displayName: 'OpenAI o1', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.REASONING], contextWindow: 200000, pricing: { inputPerMillion: 15.00, outputPerMillion: 60.00 } },
    { id: 'o3-mini', providerId: 'openai', displayName: 'OpenAI o3-mini', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.REASONING], contextWindow: 200000, pricing: { inputPerMillion: 1.10, outputPerMillion: 4.40 } },
    // Anthropic
    { id: 'claude-3-5-sonnet-20241022', providerId: 'anthropic', displayName: 'Claude 3.5 Sonnet', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.REASONING, ProviderCapabilities.LONG_CONTEXT], contextWindow: 200000, pricing: { inputPerMillion: 3.00, outputPerMillion: 15.00 } },
    { id: 'claude-3-5-haiku-20241022', providerId: 'anthropic', displayName: 'Claude 3.5 Haiku', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE], contextWindow: 200000, pricing: { inputPerMillion: 0.80, outputPerMillion: 4.00 } },
    // Google / Gemini
    { id: 'gemini-2.5-flash', providerId: 'google', displayName: 'Gemini 2.5 Flash', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.REASONING, ProviderCapabilities.LONG_CONTEXT], contextWindow: 1048576, pricing: { inputPerMillion: 0.075, outputPerMillion: 0.30 }, availability: 'AVAILABLE' },
    { id: 'gemini-3.5-flash', providerId: 'google', displayName: 'Gemini 3.5 Flash', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.REASONING, ProviderCapabilities.LONG_CONTEXT], contextWindow: 1048576, pricing: { inputPerMillion: 0.075, outputPerMillion: 0.30 }, availability: 'AVAILABLE' },
    { id: 'gemini-3.6-flash', providerId: 'google', displayName: 'Gemini 3.6 Flash', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.REASONING, ProviderCapabilities.LONG_CONTEXT], contextWindow: 1048576, pricing: { inputPerMillion: 0.075, outputPerMillion: 0.30 }, availability: 'AVAILABLE' },
    { id: 'gemini-3.8-flash', providerId: 'google', displayName: 'Gemini 3.8 Flash', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.REASONING, ProviderCapabilities.LONG_CONTEXT], contextWindow: 1048576, pricing: { inputPerMillion: 0.075, outputPerMillion: 0.30 }, availability: 'AVAILABLE' },
    { id: 'gemini-1.5-pro', providerId: 'google', displayName: 'Gemini 1.5 Pro', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.LONG_CONTEXT, ProviderCapabilities.REASONING], contextWindow: 1000000, pricing: { inputPerMillion: 1.25, outputPerMillion: 5.00 }, availability: 'AVAILABLE' },
    { id: 'gemini-1.5-flash', providerId: 'google', displayName: 'Gemini 1.5 Flash (Legacy/Deprecated)', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE, ProviderCapabilities.STRUCTURED_OUTPUT], contextWindow: 1000000, pricing: { inputPerMillion: 0.075, outputPerMillion: 0.30 }, availability: 'DEFERRED' },
    // xAI
    { id: 'grok-2', providerId: 'xai', displayName: 'Grok 2', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING, ProviderCapabilities.STRUCTURED_OUTPUT], contextWindow: 128000, pricing: { inputPerMillion: 2.00, outputPerMillion: 10.00 } },
    { id: 'grok-beta', providerId: 'xai', displayName: 'Grok Beta', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE], contextWindow: 128000, pricing: { inputPerMillion: 5.00, outputPerMillion: 15.00 } },
    // Mistral
    { id: 'mistral-large-latest', providerId: 'mistral', displayName: 'Mistral Large', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING, ProviderCapabilities.STRUCTURED_OUTPUT], contextWindow: 128000, pricing: { inputPerMillion: 2.00, outputPerMillion: 6.00 } },
    { id: 'mistral-small-latest', providerId: 'mistral', displayName: 'Mistral Small', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE], contextWindow: 32000, pricing: { inputPerMillion: 0.20, outputPerMillion: 0.60 } },
    // DeepSeek
    { id: 'deepseek-chat', providerId: 'deepseek', displayName: 'DeepSeek-V3 Chat', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.JSON_MODE], contextWindow: 64000, pricing: { inputPerMillion: 0.14, outputPerMillion: 0.28 } },
    { id: 'deepseek-reasoner', providerId: 'deepseek', displayName: 'DeepSeek-R1 Reasoner', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING, ProviderCapabilities.LONG_CONTEXT], contextWindow: 64000, pricing: { inputPerMillion: 0.55, outputPerMillion: 2.19 } },
    // Groq
    { id: 'llama-3.3-70b-versatile', providerId: 'groq', displayName: 'Llama 3.3 70B (Groq)', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE, ProviderCapabilities.STRUCTURED_OUTPUT], contextWindow: 128000, pricing: { inputPerMillion: 0.59, outputPerMillion: 0.79 } },
    // OpenRouter
    { id: 'openrouter/auto', providerId: 'openrouter', displayName: 'OpenRouter Auto Router', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT], contextWindow: 128000, pricing: { inputPerMillion: 1.00, outputPerMillion: 2.00 } },
    // Ollama (Local)
    { id: 'llama3.1:8b', providerId: 'ollama', displayName: 'Llama 3.1 8B (Ollama)', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.LOCAL, ProviderCapabilities.STRUCTURED_OUTPUT], contextWindow: 8192, pricing: { inputPerMillion: 0, outputPerMillion: 0 } },
    // vLLM (Local / Custom)
    { id: 'vllm-default', providerId: 'vllm', displayName: 'vLLM Endpoint Model', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.LOCAL, ProviderCapabilities.FAST_INFERENCE], contextWindow: 32768, pricing: { inputPerMillion: 0, outputPerMillion: 0 } },
    // NVIDIA Build
    { id: 'meta/llama-3.2-11b-vision-instruct', providerId: 'nvidia', displayName: 'Llama 3.2 11B Vision Instruct (NVIDIA NIM)', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.VISION, ProviderCapabilities.FAST_INFERENCE], contextWindow: 128000, pricing: { inputPerMillion: 0, outputPerMillion: 0 }, availability: 'AVAILABLE' },
    { id: 'deepseek-ai/deepseek-v4-pro-0813', providerId: 'nvidia', displayName: 'DeepSeek V4 Pro (NVIDIA NIM)', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING, ProviderCapabilities.CODE_GENERATION], contextWindow: 64000, pricing: { inputPerMillion: 0, outputPerMillion: 0 }, availability: 'DEFERRED' },
    { id: 'deepseek-ai/deepseek-v4-flash-0731', providerId: 'nvidia', displayName: 'DeepSeek V4 Flash (NVIDIA NIM)', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.FAST_INFERENCE], contextWindow: 64000, pricing: { inputPerMillion: 0, outputPerMillion: 0 }, availability: 'DEFERRED' },
    { id: 'moonshotai/kimi-k3', providerId: 'nvidia', displayName: 'Kimi K3 (NVIDIA NIM)', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.REASONING], contextWindow: 128000, pricing: { inputPerMillion: 0, outputPerMillion: 0 }, availability: 'DEFERRED' },
    // Kimi Direct
    { id: 'moonshot-v1-8k', providerId: 'kimi', displayName: 'Moonshot v1 8K', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.REASONING, ProviderCapabilities.LONG_CONTEXT], contextWindow: 8192, pricing: { inputPerMillion: 1.00, outputPerMillion: 1.00 }, availability: 'AVAILABLE' },
    { id: 'moonshot-v1-32k', providerId: 'kimi', displayName: 'Moonshot v1 32K', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.REASONING, ProviderCapabilities.LONG_CONTEXT], contextWindow: 32768, pricing: { inputPerMillion: 2.00, outputPerMillion: 2.00 }, availability: 'AVAILABLE' },
    { id: 'moonshot-v1-128k', providerId: 'kimi', displayName: 'Moonshot v1 128K', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.REASONING, ProviderCapabilities.LONG_CONTEXT], contextWindow: 131072, pricing: { inputPerMillion: 5.00, outputPerMillion: 5.00 }, availability: 'AVAILABLE' },
    // Local In-Memory
    { id: 'local-deterministic-v1', providerId: 'local', displayName: 'ONLUNET Local Deterministic Engine', capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.STRUCTURED_OUTPUT, ProviderCapabilities.LOCAL], contextWindow: 32768, pricing: { inputPerMillion: 0, outputPerMillion: 0 } }
  ];

  if (includeBuiltins) {
    for (const m of defaultModels) {
      registerModel(m);
    }
  }

  return Object.freeze({
    registerModel,

    getModel(modelId, { providerId = null } = {}) {
      if (!modelId || typeof modelId !== 'string') return null;
      const cleanId = modelId.trim();
      if (providerId) {
        const p = String(providerId).trim().toLowerCase();
        const scopedKey = `${p}:${cleanId}`;
        if (models.has(scopedKey)) return models.get(scopedKey);
        if (p === 'gemini' && models.has(`google:${cleanId}`)) return models.get(`google:${cleanId}`);
        if (p === 'google' && models.has(`gemini:${cleanId}`)) return models.get(`gemini:${cleanId}`);
      }
      return models.get(cleanId) || null;
    },

    listModels({ providerId = null, capability = null } = {}) {
      const results = [];
      const seen = new Set();

      for (const [key, model] of models.entries()) {
        if (!key.includes(':')) continue; // Skip alias entries
        if (seen.has(model.id + ':' + model.providerId)) continue;
        seen.add(model.id + ':' + model.providerId);

        if (providerId) {
          const reqP = String(providerId).trim().toLowerCase();
          const modP = String(model.providerId).trim().toLowerCase();
          const isMatch = (modP === reqP) ||
                          (reqP === 'gemini' && modP === 'google') ||
                          (reqP === 'google' && modP === 'gemini');
          if (!isMatch) continue;
        }
        if (capability && !model.capabilities.includes(capability)) continue;
        results.push(model);
      }
      return results;
    },

    findModelsForCapability(capability) {
      if (!capability) return [];
      return this.listModels({ capability });
    }
  });
}
