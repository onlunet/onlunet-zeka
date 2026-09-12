/**
 * ONLUNET ZEKA - Groq Fast Inference Provider Adapter
 * FAZ 62 Architecture: Inference Provider Adapter for Groq LPU Engine
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { createOpenAICompatibleAdapter } from './openai-compatible-base.js';
import { ProviderCategories } from './provider-categories.js';
import { ProviderCapabilities } from './provider-capabilities.js';

export function createGroqProviderAdapter({
  apiKey = undefined,
  model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  baseURL = 'https://api.groq.com/openai/v1',
  timeoutMs = 15000
} = {}) {
  return createOpenAICompatibleAdapter({
    providerId: 'groq',
    name: 'Groq LPU Fast Inference Gateway',
    category: ProviderCategories.INFERENCE,
    apiKey,
    envKeyName: 'GROQ_API_KEY',
    baseURL,
    defaultModel: model,
    capabilities: [
      ProviderCapabilities.TEXT,
      ProviderCapabilities.FAST_INFERENCE,
      ProviderCapabilities.STRUCTURED_OUTPUT,
      ProviderCapabilities.TOOL_USE
    ],
    timeoutMs
  });
}
