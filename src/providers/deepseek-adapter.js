/**
 * ONLUNET ZEKA - DeepSeek Real Provider Adapter
 * FAZ 62 Architecture: Direct Provider Adapter for DeepSeek API
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { createOpenAICompatibleAdapter } from './openai-compatible-base.js';
import { ProviderCategories } from './provider-categories.js';
import { ProviderCapabilities } from './provider-capabilities.js';

export function createDeepSeekProviderAdapter({
  apiKey = null,
  model = 'deepseek-chat',
  baseURL = 'https://api.deepseek.com/v1',
  timeoutMs = 15000
} = {}) {
  return createOpenAICompatibleAdapter({
    providerId: 'deepseek',
    name: 'DeepSeek AI Provider Gateway',
    category: ProviderCategories.DIRECT,
    envKeyName: 'DEEPSEEK_API_KEY',
    baseURL,
    defaultModel: model,
    capabilities: [
      ProviderCapabilities.TEXT,
      ProviderCapabilities.STRUCTURED_OUTPUT,
      ProviderCapabilities.CODE_GENERATION,
      ProviderCapabilities.REASONING,
      ProviderCapabilities.JSON_MODE
    ],
    timeoutMs
  });
}
