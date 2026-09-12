/**
 * ONLUNET ZEKA - FAZ 62 Model Registry Test Suite
 * Validates Provider ≠ Model axiom, model lookup, and capability discovery
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createModelRegistry } from '../src/providers/model-registry.js';
import { ProviderCapabilities } from '../src/providers/provider-capabilities.js';

describe('FAZ 62.5 & 62.8: Model Registry & Decoupled Model Selection', () => {
  it('proves Provider ≠ Model: multiple models exist under single provider', () => {
    const modelRegistry = createModelRegistry();
    const openaiModels = modelRegistry.listModels({ providerId: 'openai' });
    const anthropicModels = modelRegistry.listModels({ providerId: 'anthropic' });

    assert.ok(openaiModels.length >= 2, 'OpenAI must have multiple models');
    assert.ok(anthropicModels.length >= 2, 'Anthropic must have multiple models');

    const gpt4o = modelRegistry.getModel('gpt-4o', { providerId: 'openai' });
    assert.equal(gpt4o.providerId, 'openai');
    assert.ok(gpt4o.contextWindow >= 128000);
  });

  it('finds models based on capability (REASONING, STRUCTURED_OUTPUT)', () => {
    const modelRegistry = createModelRegistry();
    const reasoningModels = modelRegistry.findModelsForCapability(ProviderCapabilities.REASONING);
    assert.ok(reasoningModels.length >= 3, 'Must find multiple reasoning models across providers');

    const providerIds = reasoningModels.map(m => m.providerId);
    assert.ok(providerIds.includes('openai') || providerIds.includes('anthropic') || providerIds.includes('deepseek'));
  });

  it('registers custom third-party model definition safely', () => {
    const modelRegistry = createModelRegistry();
    const custom = modelRegistry.registerModel({
      id: 'custom-finetuned-llama',
      providerId: 'vllm',
      displayName: 'Fine-tuned Enterprise Llama',
      capabilities: [ProviderCapabilities.TEXT, ProviderCapabilities.CODE_GENERATION],
      contextWindow: 65536,
      pricing: { inputPerMillion: 0, outputPerMillion: 0 }
    });

    assert.equal(custom.id, 'custom-finetuned-llama');
    assert.equal(custom.providerId, 'vllm');
    assert.equal(custom.contextWindow, 65536);
  });
});
