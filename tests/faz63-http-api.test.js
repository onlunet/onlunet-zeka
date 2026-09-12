/**
 * ONLUNET ZEKA - FAZ 63 HTTP Endpoints Test Suite
 * Validates GET /api/ai/models, GET /api/ai/capabilities, POST /api/ai/route
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

import { createApplicationServer } from '../src/app/server.js';

describe('FAZ 63.27 & 63.28: HTTP AI Routing API', () => {
  let server = null;
  let serverPort = null;

  before((_, done) => {
    const app = createApplicationServer();
    server = app.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      done();
    });
  });

  after((_, done) => {
    if (server) server.close(done);
    else done();
  });

  function request(method, pathName, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: '127.0.0.1',
        port: serverPort,
        path: pathName,
        method,
        headers: { 'Content-Type': 'application/json', ...headers }
      };
      const req = http.request(opts, (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch (e) {
            resolve({ status: res.statusCode, rawBody: raw });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  it('GET /api/ai/models returns registered model list', async () => {
    const res = await request('GET', '/api/ai/models');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.models));
  });

  it('GET /api/ai/capabilities returns canonical capability list', async () => {
    const res = await request('GET', '/api/ai/capabilities');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.capabilities.includes('TEXT'));
    assert.ok(res.body.capabilities.includes('REASONING'));
  });

  it('POST /api/ai/route performs intelligent routing and returns decision with proposalOnly', async () => {
    const res = await request('POST', '/api/ai/route', {
      task: 'Generate unit tests for array sorting'
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.decision.selectedProvider);
    assert.strictEqual(res.body.decision.proposalOnly, true);
    assert.strictEqual(res.body.decision.executionAuthorized, false);
  });
});
