import { describe, it } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { createGoogleProviderAdapter } from '../src/providers/google-adapter.js';

describe('FAZ 66: Gemini HTTP Loopback E2E Lifecycle', () => {
  it('1. End-to-end HTTP request and response parsing with custom baseURL', async () => {
    let receivedHeader = null;

    const server = http.createServer((req, res) => {
      receivedHeader = req.headers['x-goog-api-key'];
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ rationale: 'HTTP e2e pass', operations: [] }) }]
              },
              finishReason: 'STOP'
            }
          ],
          usageMetadata: {
            promptTokenCount: 15,
            candidatesTokenCount: 25,
            totalTokenCount: 40
          }
        }));
      });
    });

    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseURL = 'http://127.0.0.1:' + port;

    try {
      const adapter = createGoogleProviderAdapter({
        providerId: 'gemini',
        apiKey: 'AIzaSyE2ETestKey123',
        baseURL,
        model: 'gemini-1.5-flash'
      });

      const result = await adapter.invoke({ prompt: 'Run e2e integration' });
      assert.strictEqual(receivedHeader, 'AIzaSyE2ETestKey123');
      assert.strictEqual(result.rationale, 'HTTP e2e pass');
      assert.strictEqual(result.providerId, 'gemini');
      assert.strictEqual(result.usage.totalTokens, 40);
    } finally {
      server.close();
    }
  });
});
