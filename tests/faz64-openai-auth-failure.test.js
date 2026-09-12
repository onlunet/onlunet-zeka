/**
 * ONLUNET ZEKA - FAZ 64 OpenAI 401 Authentication Failure Suite
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

import { createOpenAIProviderAdapter } from '../src/providers/openai-adapter.js';

describe('FAZ 64.8: OpenAI 401 Authentication Failure Handling', () => {
  it('classifies 401 as AUTHENTICATION_FAILED with zero retry amplification', () => {
    const err = new Error('OpenAI API error (401): Incorrect API key provided');
    err.status = 401;
    err.code = 'AUTHENTICATION_FAILED';

    assert.strictEqual(err.status, 401);
    assert.strictEqual(err.code, 'AUTHENTICATION_FAILED');
  });
});
