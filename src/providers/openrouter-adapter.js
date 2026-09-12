/**
 * ONLUNET ZEKA - OpenRouter AI Aggregator Provider Adapter
 * FAZ 62 Architecture: Multi-Model Aggregator Provider Adapter
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { createOpenAICompatibleAdapter } from './openai-compatible-base.js';
import { ProviderCategories } from './provider-categories.js';
import { ProviderCapabilities } from './provider-capabilities.js';

export function createOpenRouterProviderAdapter({
  apiKey = undefined,
  model = process.env.OPENROUTER_MODEL || 'openrouter/auto',
  baseURL = 'https://openrouter.ai/api/v1',
  timeoutMs = 15000
} = {}) {
  return createOpenAICompatibleAdapter({
    providerId: 'openrouter',
    name: 'OpenRouter Multi-Model Aggregator Gateway',
    category: ProviderCategories.AGGREGATOR,
    apiKey,
    envKeyName: 'OPENROUTER_API_KEY',
    baseURL,
    defaultModel: model,
    capabilities: [
      ProviderCapabilities.TEXT,
      ProviderCapabilities.STRUCTURED_OUTPUT,
      ProviderCapabilities.VISION,
      ProviderCapabilities.LONG_CONTEXT
    ],
    timeoutMs
  });
}
