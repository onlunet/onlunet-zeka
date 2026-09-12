import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createGeminiProviderAdapter } from '../src/providers/google-adapter.js';

describe('FAZ 66: Gemini Error Code Mapping & Handling', () => {
  it('1. Maps HTTP 401 to AUTHENTICATION_FAILED', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 401,
      headers: new Headers(),
      text: async () => 'API key not valid'
    });

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: 'AIzaSyInvalid' });
      await assert.rejects(
        () => adapter.invoke({ prompt: 'test' }),
        (err) => {
          assert.strictEqual(err.code, 'AUTHENTICATION_FAILED');
          assert.strictEqual(err.status, 401);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('2. Maps HTTP 429 to RATE_LIMITED and extracts retry-after', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '5' }),
      text: async () => 'Resource exhausted'
    });

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: 'AIzaSyKey' });
      await assert.rejects(
        () => adapter.invoke({ prompt: 'test' }),
        (err) => {
          assert.strictEqual(err.code, 'RATE_LIMITED');
          assert.strictEqual(err.status, 429);
          assert.strictEqual(err.retryAfter, 5);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('3. Maps HTTP 503 to SERVER_ERROR', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: false,
      status: 503,
      headers: new Headers(),
      text: async () => 'Service Unavailable'
    });

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: 'AIzaSyKey' });
      await assert.rejects(
        () => adapter.invoke({ prompt: 'test' }),
        (err) => {
          assert.strictEqual(err.code, 'SERVER_ERROR');
          assert.strictEqual(err.status, 503);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('4. Handles AbortError with code TIMEOUT and status 408', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      throw abortErr;
    };

    try {
      const adapter = createGeminiProviderAdapter({ apiKey: 'AIzaSyKey' });
      await assert.rejects(
        () => adapter.invoke({ prompt: 'test' }),
        (err) => {
          assert.strictEqual(err.code, 'TIMEOUT');
          assert.strictEqual(err.status, 408);
          return true;
        }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
