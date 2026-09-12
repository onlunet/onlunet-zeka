/**
 * ONLUNET ZEKA - xAI (Grok) Real Provider Adapter
 * FAZ 62 Architecture: Direct Provider Adapter for xAI API
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { createOpenAICompatibleAdapter } from './openai-compatible-base.js';
import { ProviderCategories } from './provider-categories.js';
import { ProviderCapabilities } from './provider-capabilities.js';

export function createXAIProviderAdapter({
  apiKey = null,
  model = 'grok-2-1212',
  baseURL = 'https://api.x.ai/v1',
  timeoutMs = 15000
} = {}) {
  return createOpenAICompatibleAdapter({
    providerId: 'xai',
    name: 'xAI Grok Provider Gateway',
    category: ProviderCategories.DIRECT,
    envKeyName: 'XAI_API_KEY',
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
}
