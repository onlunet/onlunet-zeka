import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sanitizeString, sanitizeHeaders, sanitizeError } from '../src/providers/credential-sanitizer.js';

describe('FAZ 66: Gemini Secret Egress Defense', () => {
  it('1. Redacts Google AI Studio API key format (AIza...)', () => {
    const raw = 'Calling Gemini with key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
    const sanitized = sanitizeString(raw);
    assert.ok(!sanitized.includes('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q'));
    assert.ok(sanitized.includes('***REDACTED***'));
  });

  it('2. Redacts x-goog-api-key in HTTP header scrubbing', () => {
    const headers = {
      'Content-Type': 'application/json',
      'x-goog-api-key': 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q',
      'x-request-id': 'req-12345'
    };
    const cleaned = sanitizeHeaders(headers);
    assert.strictEqual(cleaned['x-goog-api-key'], '***REDACTED***');
    assert.strictEqual(cleaned['x-request-id'], 'req-12345');
  });

  it('3. Redacts secrets from error messages and stack traces', () => {
    const err = new Error('HTTP 401: Unauthorized with AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q');
    const cleaned = sanitizeError(err);
    assert.ok(!cleaned.message.includes('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q'));
    assert.ok(cleaned.message.includes('***REDACTED***'));
  });
});
