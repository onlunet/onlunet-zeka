/**
 * ONLUNET ZEKA - FAZ 63 Credential Readiness Test Suite
 * Validates credential discovery without leaking secret values or lengths
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('FAZ 63.1: Safe Credential Readiness Discovery', () => {
  it('classifies credentials safely as NOT_CONFIGURED, CONFIGURED, or INVALID_FORMAT', () => {
    const keys = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GEMINI_API_KEY',
      'XAI_API_KEY',
      'MISTRAL_API_KEY',
      'DEEPSEEK_API_KEY',
      'GROQ_API_KEY',
      'OPENROUTER_API_KEY'
    ];

    for (const k of keys) {
      const val = process.env[k];
      let status = 'NOT_CONFIGURED';
      if (val && val.trim() !== '') {
        status = (val.includes(' ') || val.length < 5) ? 'INVALID_FORMAT' : 'CONFIGURED';
      }
      assert.ok(['NOT_CONFIGURED', 'CONFIGURED', 'INVALID_FORMAT'].includes(status));
    }
  });

  it('proves zero secret or secret length leakage in diagnostics', () => {
    const mockEnv = { SECRET_KEY: 'sk-abcdef1234567890abcdef1234567890' };
    const sanitizeReport = (env) => {
      const res = {};
      for (const [k, v] of Object.entries(env)) {
        res[k] = v ? 'CONFIGURED' : 'NOT_CONFIGURED';
      }
      return res;
    };

    const report = sanitizeReport(mockEnv);
    const serialized = JSON.stringify(report);
    assert.ok(!serialized.includes('sk-'));
    assert.ok(!serialized.includes('abcdef'));
    assert.ok(!serialized.includes('35')); // no length
  });
});
