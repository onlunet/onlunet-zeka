/**
 * ONLUNET ZEKA - vLLM Inference / Self-Hosted Provider Adapter
 * FAZ 62 Architecture: High-Throughput OpenAI-Compatible Inference Server Adapter
 *
 * ZERO EXTERNAL DEPENDENCIES: Native Node.js only.
 */
import { createOpenAICompatibleAdapter } from './openai-compatible-base.js';
import { ProviderCategories } from './provider-categories.js';
import { ProviderCapabilities } from './provider-capabilities.js';

export function createVLLMProviderAdapter({
  baseURL = process.env.VLLM_BASE_URL || 'http://127.0.0.1:8000/v1',
  model = 'vllm-default',
  timeoutMs = 15000
} = {}) {
  return createOpenAICompatibleAdapter({
    providerId: 'vllm',
    name: 'vLLM High-Throughput Inference Engine',
    category: ProviderCategories.CUSTOM,
    envKeyName: 'VLLM_BASE_URL',
    baseURL,
    defaultModel: model,
    capabilities: [
      ProviderCapabilities.TEXT,
      ProviderCapabilities.LOCAL,
      ProviderCapabilities.FAST_INFERENCE,
      ProviderCapabilities.STRUCTURED_OUTPUT
    ],
    timeoutMs
  });
}
