/**
 * ONLUNET ZEKA - FAZ 62 OpenAI-Compatible Provider Abstraction Suite
 * Validates wire compatibility across xAI, Mistral, DeepSeek, Groq, OpenRouter, vLLM
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createProviderRegistry } from '../src/providers/provider-registry.js';
import { ProviderCategories } from '../src/providers/provider-categories.js';

describe('FAZ 62.22: OpenAI-Compatible Provider Abstraction', () => {
  it('differentiates provider identity and categories among wire-compatible adapters', () => {
    const registry = createProviderRegistry({ includeBuiltins: true });

    const xai = registry.getEntry('xai');
    const mistral = registry.getEntry('mistral');
    const deepseek = registry.getEntry('deepseek');
    const groq = registry.getEntry('groq');
    const openrouter = registry.getEntry('openrouter');
    const vllm = registry.getEntry('vllm');

    assert.equal(xai.category, ProviderCategories.DIRECT);
    assert.equal(mistral.category, ProviderCategories.DIRECT);
    assert.equal(deepseek.category, ProviderCategories.DIRECT);
    assert.equal(groq.category, ProviderCategories.INFERENCE);
    assert.equal(openrouter.category, ProviderCategories.AGGREGATOR);
    assert.equal(vllm.category, ProviderCategories.CUSTOM);

    assert.notEqual(xai.defaultModel, mistral.defaultModel);
    assert.notEqual(groq.defaultModel, deepseek.defaultModel);
  });
});
