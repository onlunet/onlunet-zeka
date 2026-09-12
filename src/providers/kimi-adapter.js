/**
 * ONLUNET ZEKA - Kimi / Moonshot AI Direct Provider Adapter
 * FAZ 66.7 Architecture: Direct Cloud Provider for Moonshot / Kimi API
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { createOpenAICompatibleAdapter } from './openai-compatible-base.js';
import { ProviderCategories, LifecycleState } from './provider-categories.js';
import { ProviderCapabilities } from './provider-capabilities.js';
import { sanitizeString } from './credential-sanitizer.js';

export function createKimiProviderAdapter({
  apiKey = undefined,
  model = process.env.KIMI_MODEL || 'moonshot-v1-8k',
  baseURL = process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
  timeoutMs = 30000
} = {}) {
  const resolvedApiKey = apiKey !== undefined ? apiKey : (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || null);

  const baseAdapter = createOpenAICompatibleAdapter({
    providerId: 'kimi',
    name: 'Kimi Moonshot AI Direct Gateway',
    category: ProviderCategories.DIRECT,
    apiKey: resolvedApiKey,
    envKeyName: 'KIMI_API_KEY',
    baseURL,
    defaultModel: model,
    capabilities: [
      ProviderCapabilities.TEXT,
      ProviderCapabilities.STRUCTURED_OUTPUT,
      ProviderCapabilities.REASONING,
      ProviderCapabilities.LONG_CONTEXT
    ],
    timeoutMs
  });

  return Object.freeze({
    ...baseAdapter,
    providerId: 'kimi',
    id: 'kimi',
    name: 'Kimi Moonshot AI Direct Gateway',
    category: ProviderCategories.DIRECT,
    providerType: 'DIRECT',
    model,
    defaultModel: model,
    baseURL,

    resolveCredential() {
      if (process.env.KIMI_API_KEY) {
        return { alias: 'KIMI_API_KEY', isConfigured: true };
      }
      if (process.env.MOONSHOT_API_KEY) {
        return { alias: 'MOONSHOT_API_KEY', isConfigured: true };
      }
      return { alias: 'KIMI_API_KEY', isConfigured: false };
    },

    getCapabilities() {
      return baseAdapter.capabilities;
    },

    async discoverModels({ signal = null } = {}) {
      if (!resolvedApiKey) {
        return Object.freeze({
          providerId: 'kimi',
          discoveredAt: new Date().toISOString(),
          source: 'error',
          live: false,
          status: 'DEFERRED',
          reason: 'CREDENTIALS_UNCONFIGURED',
          models: Object.freeze([
            Object.freeze({ id: 'moonshot-v1-8k', providerId: 'kimi', contextWindow: 8192, capabilities: baseAdapter.capabilities, status: 'CATALOG_ONLY' }),
            Object.freeze({ id: 'moonshot-v1-32k', providerId: 'kimi', contextWindow: 32768, capabilities: baseAdapter.capabilities, status: 'CATALOG_ONLY' }),
            Object.freeze({ id: 'moonshot-v1-128k', providerId: 'kimi', contextWindow: 131072, capabilities: baseAdapter.capabilities, status: 'CATALOG_ONLY' })
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
            'Authorization': `Bearer ${resolvedApiKey}`
          },
          signal: controller.signal
        });
        clearTimeout(timeoutHandle);

        if (!resp.ok) {
          return Object.freeze({
            providerId: 'kimi',
            discoveredAt: new Date().toISOString(),
            source: 'error',
            live: false,
            status: 'DEFERRED',
            reason: resp.status === 401 ? 'MODEL_DISCOVERY_FAILED_HTTP_401' : `MODEL_DISCOVERY_FAILED_HTTP_${resp.status}`,
            models: Object.freeze([
              Object.freeze({ id: 'moonshot-v1-8k', providerId: 'kimi', contextWindow: 8192, capabilities: baseAdapter.capabilities, status: 'CATALOG_ONLY' }),
              Object.freeze({ id: 'moonshot-v1-32k', providerId: 'kimi', contextWindow: 32768, capabilities: baseAdapter.capabilities, status: 'CATALOG_ONLY' }),
              Object.freeze({ id: 'moonshot-v1-128k', providerId: 'kimi', contextWindow: 131072, capabilities: baseAdapter.capabilities, status: 'CATALOG_ONLY' })
            ])
          });
        }

        const data = await resp.json();
        const rawList = Array.isArray(data.data) ? data.data : [];
        const normalized = rawList.map(m => Object.freeze({
          id: m.id,
          providerId: 'kimi',
          contextWindow: m.context_window || 8192,
          capabilities: baseAdapter.capabilities,
          inputModalities: Object.freeze(['text']),
          outputModalities: Object.freeze(['text']),
          status: 'AVAILABLE',
          rawMetadata: m
        }));

        return Object.freeze({
          providerId: 'kimi',
          discoveredAt: new Date().toISOString(),
          source: 'live_api',
          live: true,
          models: Object.freeze(normalized)
        });
      } catch (err) {
        return Object.freeze({
          providerId: 'kimi',
          discoveredAt: new Date().toISOString(),
          source: 'error',
          live: false,
          status: 'DEFERRED',
          reason: 'MODEL_DISCOVERY_FAILED',
          error: sanitizeString(err.message),
          models: Object.freeze([
            Object.freeze({ id: 'moonshot-v1-8k', providerId: 'kimi', contextWindow: 8192, capabilities: baseAdapter.capabilities, status: 'CATALOG_ONLY' })
          ])
        });
      }
    }
  });
}
