/**
 * ONLUNET ZEKA - NVIDIA Build AI Provider Adapter
 * FAZ 66.6 & 66.7 Architecture: NVIDIA NIM / Cloud Functions Gateway Adapter
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { createOpenAICompatibleAdapter } from './openai-compatible-base.js';
import { ProviderCategories, LifecycleState } from './provider-categories.js';
import { ProviderCapabilities } from './provider-capabilities.js';
import { sanitizeString } from './credential-sanitizer.js';

export function createNvidiaProviderAdapter({
  apiKey = undefined,
  model = process.env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4-pro-0813',
  baseURL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  timeoutMs = 60000
} = {}) {
  // Resolve base key with fallback
  const resolvedBaseApiKey = apiKey !== undefined
    ? apiKey
    : (process.env.NVIDIA_API_KEY || null);

  const baseAdapter = createOpenAICompatibleAdapter({
    providerId: 'nvidia',
    name: 'NVIDIA Build AI Provider Gateway',
    category: ProviderCategories.INFERENCE,
    apiKey: resolvedBaseApiKey,
    envKeyName: 'NVIDIA_API_KEY',
    baseURL,
    defaultModel: model,
    capabilities: [
      ProviderCapabilities.TEXT,
      ProviderCapabilities.STRUCTURED_OUTPUT,
      ProviderCapabilities.CODE_GENERATION,
      ProviderCapabilities.REASONING,
      ProviderCapabilities.FAST_INFERENCE,
      ProviderCapabilities.VISION
    ],
    timeoutMs
  });

  return Object.freeze({
    ...baseAdapter,
    providerId: 'nvidia',
    id: 'nvidia',
    name: 'NVIDIA Build AI Provider Gateway',
    category: ProviderCategories.INFERENCE,
    providerType: 'AGGREGATOR',
    model,
    defaultModel: model,
    baseURL,

    resolveCredential({ modelId = null } = {}) {
      const lowerModel = String(modelId || '').toLowerCase();
      if (lowerModel.includes('deepseek')) {
        if (process.env.NVIDIA_DEEPSEEK_API_KEY) {
          return { alias: 'NVIDIA_DEEPSEEK_API_KEY', isConfigured: true };
        }
      } else if (lowerModel.includes('kimi') || lowerModel.includes('moonshot')) {
        if (process.env.NVIDIA_KIMI_API_KEY) {
          return { alias: 'NVIDIA_KIMI_API_KEY', isConfigured: true };
        }
      } else if (lowerModel.includes('llama')) {
        if (process.env.NVIDIA_LLAMA_API_KEY) {
          return { alias: 'NVIDIA_LLAMA_API_KEY', isConfigured: true };
        }
      }
      return {
        alias: 'NVIDIA_API_KEY',
        isConfigured: Boolean(process.env.NVIDIA_API_KEY || resolvedBaseApiKey)
      };
    },

    getCapabilities() {
      return baseAdapter.capabilities;
    },

    async discoverModels({ signal = null } = {}) {
      const authKey = resolvedBaseApiKey || process.env.NVIDIA_API_KEY;
      if (!authKey) {
        return Object.freeze({
          providerId: 'nvidia',
          discoveredAt: new Date().toISOString(),
          source: 'error',
          live: false,
          status: 'DEFERRED',
          reason: 'CREDENTIALS_UNCONFIGURED',
          models: Object.freeze([
            Object.freeze({ id: 'meta/llama-3.2-11b-vision-instruct', providerId: 'nvidia', capabilities: Object.freeze([ProviderCapabilities.TEXT, ProviderCapabilities.VISION, ProviderCapabilities.FAST_INFERENCE]), status: 'CATALOG_ONLY' }),
            Object.freeze({ id: 'deepseek-ai/deepseek-v4-pro-0813', providerId: 'nvidia', capabilities: Object.freeze([ProviderCapabilities.TEXT, ProviderCapabilities.REASONING, ProviderCapabilities.CODE_GENERATION]), status: 'DEFERRED' })
          ])
        });
      }

      try {
        const controller = new AbortController();
        const timeoutHandle = setTimeout(() => controller.abort(), 8000);
        if (signal) {
          signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        const resp = await fetch(`${baseURL}/models`, {
          headers: {
            'Authorization': `Bearer ${authKey}`
          },
          signal: controller.signal
        });
        clearTimeout(timeoutHandle);

        if (!resp.ok) {
          return Object.freeze({
            providerId: 'nvidia',
            discoveredAt: new Date().toISOString(),
            source: 'error',
            live: false,
            status: 'DEFERRED',
            reason: `MODEL_DISCOVERY_FAILED_HTTP_${resp.status}`,
            models: Object.freeze([
              Object.freeze({ id: 'meta/llama-3.2-11b-vision-instruct', providerId: 'nvidia', capabilities: Object.freeze([ProviderCapabilities.TEXT, ProviderCapabilities.VISION, ProviderCapabilities.FAST_INFERENCE]), status: 'CATALOG_ONLY' }),
              Object.freeze({ id: 'deepseek-ai/deepseek-v4-pro-0813', providerId: 'nvidia', capabilities: Object.freeze([ProviderCapabilities.TEXT, ProviderCapabilities.REASONING, ProviderCapabilities.CODE_GENERATION]), status: 'DEFERRED' })
            ])
          });
        }

        const data = await resp.json();
        const rawList = Array.isArray(data.data) ? data.data : [];
        const normalized = rawList.map(m => {
          const mCaps = [ProviderCapabilities.TEXT];
          const mLower = String(m.id || '').toLowerCase();
          if (mLower.includes('vision')) mCaps.push(ProviderCapabilities.VISION, 'image_input');
          if (mLower.includes('code') || mLower.includes('instruct')) mCaps.push(ProviderCapabilities.CODE_GENERATION, 'coding');
          if (mLower.includes('reason') || mLower.includes('pro') || mLower.includes('r1')) mCaps.push(ProviderCapabilities.REASONING);
          if (mLower.includes('flash') || mLower.includes('mini') || mLower.includes('11b') || mLower.includes('8b')) mCaps.push(ProviderCapabilities.FAST_INFERENCE);

          const isKnownTimeout = mLower.includes('deepseek-v4') || mLower.includes('kimi-k3') || mLower.includes('kimi-k2.6');
          const status = isKnownTimeout ? 'DEFERRED' : 'AVAILABLE';

          return Object.freeze({
            id: m.id,
            providerId: 'nvidia',
            displayName: m.id,
            contextWindow: m.context_window || 8192,
            inputModalities: Object.freeze(mLower.includes('vision') ? ['text', 'image'] : ['text']),
            outputModalities: Object.freeze(['text']),
            capabilities: Object.freeze(Array.from(new Set(mCaps))),
            status,
            availability: status,
            rawMetadata: m
          });
        });

        return Object.freeze({
          providerId: 'nvidia',
          discoveredAt: new Date().toISOString(),
          source: 'live_api',
          live: true,
          models: Object.freeze(normalized)
        });
      } catch (err) {
        return Object.freeze({
          providerId: 'nvidia',
          discoveredAt: new Date().toISOString(),
          source: 'error',
          live: false,
          status: 'DEFERRED',
          reason: 'MODEL_DISCOVERY_FAILED',
          error: sanitizeString(err.message),
          models: Object.freeze([
            Object.freeze({ id: 'meta/llama-3.2-11b-vision-instruct', providerId: 'nvidia', capabilities: Object.freeze([ProviderCapabilities.TEXT, ProviderCapabilities.VISION, ProviderCapabilities.FAST_INFERENCE]), status: 'CATALOG_ONLY' }),
            Object.freeze({ id: 'deepseek-ai/deepseek-v4-pro-0813', providerId: 'nvidia', capabilities: Object.freeze([ProviderCapabilities.TEXT, ProviderCapabilities.REASONING, ProviderCapabilities.CODE_GENERATION]), status: 'DEFERRED' })
          ])
        });
      }
    }
  });
}
