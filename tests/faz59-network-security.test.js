/**
 * ONLUNET ZEKA - FAZ 59 Network Security & SSRF Red-Team Test Suite
 *
 * Comprehensive validation:
 * - SSRF cloud metadata endpoint protection (IPv4, IPv6, integer, hex, domain)
 * - Protocol whitelisting (http/https only)
 * - URL embedded credentials defense
 * - Path traversal in provider URLs
 * - Control character / CRLF protocol smuggling defense
 * - HTTP redirect SSRF bypass defense (redirect: 'error')
 * - Real loopback wire communication over TCP sockets
 *
 * ZERO EXTERNAL DEPENDENCIES: node:test, node:assert, node:http only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  validateAndNormalizeProviderURL,
  createCustomProviderAdapter
} from '../src/providers/custom-adapter.js';

describe('FAZ 59 Network Security & SSRF Red-Team Suite', () => {

  describe('1. Protocol Scheme Whitelisting', () => {
    const prohibitedSchemes = [
      'file:///etc/passwd',
      'ftp://ftp.example.com/files',
      'gopher://gopher.example.com:70/',
      'dict://dict.org/d:word',
      'ldap://ldap.example.com/dc=example,dc=com',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'javascript:alert(1)'
    ];

    for (const url of prohibitedSchemes) {
      it(`Rejects prohibited protocol scheme fail-closed: ${url.split(':')[0]}`, () => {
        assert.throws(
          () => validateAndNormalizeProviderURL(url),
          /Prohibited protocol|Invalid provider baseURL/
        );
      });
    }

    it('Permits http: and https: protocols', () => {
      assert.strictEqual(validateAndNormalizeProviderURL('http://localhost:11434/v1'), 'http://localhost:11434/v1');
      assert.strictEqual(validateAndNormalizeProviderURL('https://api.together.xyz/v1'), 'https://api.together.xyz/v1');
    });
  });

  describe('2. Cloud Metadata & Link-Local IP Defense (SSRF)', () => {
    const metadataEndpoints = [
      'http://169.254.169.254/latest/meta-data',
      'http://169.254.169.253',
      'http://metadata.google.internal/computeMetadata/v1',
      'http://instance-data/latest/meta-data',
      'http://[fd00:ec2::254]/latest/meta-data',
      'http://[fe80::1]/v1',
      'http://2852039166/latest/meta-data', // Decimal integer notation for 169.254.169.254
      'http://0xa9fea9fe/latest/meta-data'  // Hexadecimal notation for 169.254.169.254
    ];

    for (const endpoint of metadataEndpoints) {
      it(`Blocks metadata endpoint fail-closed: ${endpoint}`, () => {
        assert.throws(
          () => validateAndNormalizeProviderURL(endpoint),
          /SSRF blocked: Access to link-local\/cloud metadata endpoint/
        );
      });
    }
  });

  describe('3. URL Credentials & Path Traversal Defense', () => {
    it('Blocks embedded basic auth credentials fail-closed', () => {
      assert.throws(
        () => validateAndNormalizeProviderURL('http://admin:superSecretPassword@localhost:11434/v1'),
        /Provider baseURL must not contain embedded credentials/
      );
    });

    it('Blocks path traversal in provider URL pathname fail-closed', () => {
      assert.throws(
        () => validateAndNormalizeProviderURL('http://localhost:11434/v1/../../etc'),
        /Path traversal prohibited in provider baseURL/
      );
    });

    it('Blocks standalone double dot traversal attempt', () => {
      assert.throws(
        () => validateAndNormalizeProviderURL('http://localhost:11434/..'),
        /Path traversal prohibited in provider baseURL/
      );
    });
  });

  describe('4. Protocol Smuggling & Control Character Defense', () => {
    it('Blocks carriage return and newline in provider URL', () => {
      assert.throws(
        () => validateAndNormalizeProviderURL('http://localhost:11434/v1\r\nHost: evil.com'),
        /Prohibited control characters|Invalid provider baseURL format/
      );
    });

    it('Blocks null byte injection in provider URL', () => {
      assert.throws(
        () => validateAndNormalizeProviderURL('http://localhost:11434/v1\0evil'),
        /Prohibited control characters|Invalid provider baseURL format/
      );
    });
  });

  describe('5. HTTP Redirect SSRF Defense (redirect: error)', () => {
    it('Rejects HTTP redirect attempt attempting to reach metadata endpoint', async () => {
      let port;
      const srv = http.createServer((req, res) => {
        res.writeHead(302, { 'Location': 'http://169.254.169.254/latest/meta-data' });
        res.end();
      });
      await new Promise(r => srv.listen(0, '127.0.0.1', () => { port = srv.address().port; r(); }));

      try {
        const adapter = createCustomProviderAdapter({
          providerId: 'redirect-test',
          baseURL: `http://127.0.0.1:${port}/v1`
        });

        await assert.rejects(
          () => adapter.invoke({ prompt: 'test' }),
          (err) => {
            // Native fetch throws TypeError when redirect occurs with redirect: 'error'
            assert.ok(err.message.includes('redirect') || err.message.includes('fetch') || err.name === 'TypeError');
            return true;
          }
        );
      } finally {
        await new Promise(r => srv.close(r));
      }
    });
  });

  describe('6. Real Wire Network Communication (node:http Socket)', () => {
    it('Accurately transmits headers and receives structured JSON over real TCP loopback', async () => {
      let port;
      let receivedAuthHeader = null;
      let receivedContentType = null;
      let receivedBody = null;

      const srv = http.createServer((req, res) => {
        receivedAuthHeader = req.headers['authorization'];
        receivedContentType = req.headers['content-type'];

        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => {
          receivedBody = JSON.parse(data);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            choices: [{
              message: {
                content: JSON.stringify({
                  rationale: 'Verified real socket transport',
                  operations: [{ type: 'CREATE', target: 'src/wire.js', description: 'Wire transport test' }]
                })
              }
            }],
            usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 }
          }));
        });
      });
      await new Promise(r => srv.listen(0, '127.0.0.1', () => { port = srv.address().port; r(); }));

      try {
        const adapter = createCustomProviderAdapter({
          providerId: 'custom-wire',
          baseURL: `http://127.0.0.1:${port}`,
          apiKey: 'test-wire-key'
        });

        const result = await adapter.invoke({
          prompt: 'Wire prompt test',
          agentRole: 'DEVELOPER'
        });

        assert.strictEqual(receivedAuthHeader, 'Bearer test-wire-key');
        assert.strictEqual(receivedContentType, 'application/json');
        assert.strictEqual(receivedBody.messages[1].content, 'Wire prompt test');

        assert.strictEqual(result.rationale, 'Verified real socket transport');
        assert.strictEqual(result.usage.totalTokens, 30);
      } finally {
        await new Promise(r => srv.close(r));
      }
    });
  });

});
