/**
 * ONLUNET ZEKA - Ollama Local Provider Adapter
 * FAZ 62 Architecture: Local / On-Prem Self-Hosted AI Engine Adapter
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { createOpenAICompatibleAdapter } from './openai-compatible-base.js';
import { ProviderCategories } from './provider-categories.js';
import { ProviderCapabilities } from './provider-capabilities.js';

export function createOllamaProviderAdapter({
  baseURL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1',
  model = 'llama3.1:8b',
  timeoutMs = 15000
} = {}) {
  return createOpenAICompatibleAdapter({
    providerId: 'ollama',
    name: 'Ollama Local Self-Hosted Engine',
    category: ProviderCategories.LOCAL,
    envKeyName: 'OLLAMA_BASE_URL',
    baseURL,
    defaultModel: model,
    capabilities: [
      ProviderCapabilities.TEXT,
      ProviderCapabilities.LOCAL,
      ProviderCapabilities.STRUCTURED_OUTPUT,
      ProviderCapabilities.JSON_MODE
    ],
    timeoutMs
  });
}
