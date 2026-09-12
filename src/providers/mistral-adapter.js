/**
 * ONLUNET ZEKA - Mistral AI Real Provider Adapter
 * FAZ 62 Architecture: Direct Provider Adapter for Mistral API
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { createOpenAICompatibleAdapter } from './openai-compatible-base.js';
import { ProviderCategories } from './provider-categories.js';
import { ProviderCapabilities } from './provider-capabilities.js';

export function createMistralProviderAdapter({
  apiKey = null,
  model = 'mistral-large-latest',
  baseURL = 'https://api.mistral.ai/v1',
  timeoutMs = 15000
} = {}) {
  return createOpenAICompatibleAdapter({
    providerId: 'mistral',
    name: 'Mistral AI Provider Gateway',
    category: ProviderCategories.DIRECT,
    envKeyName: 'MISTRAL_API_KEY',
    baseURL,
    defaultModel: model,
    capabilities: [
      ProviderCapabilities.TEXT,
      ProviderCapabilities.STRUCTURED_OUTPUT,
      ProviderCapabilities.CODE_GENERATION,
      ProviderCapabilities.REASONING
    ],
    timeoutMs
  });
}
