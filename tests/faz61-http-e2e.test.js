/**
 * ONLUNET ZEKA - FAZ 61 HTTP End-to-End Test Suite
 *
 * Validates:
 * - Native HTTP API endpoints (/api/ai/status, /api/ai/control-plane/dispatch)
 * - Strict tenant isolation enforcement over HTTP
 * - Concurrency handling (10 and 25 concurrent requests) without race conditions
 *
 * ZERO EXTERNAL DEPENDENCIES: Native node:test, node:assert, node:http only.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

import { createApplicationServer } from '../src/app/server.js';

describe('FAZ 61.15: HTTP End-to-End Production Simulation', () => {
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
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  function request(method, pathName, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: '127.0.0.1',
        port: serverPort,
        path: pathName,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(opts, (res) => {
        let raw = '';
        res.on('data', chunk => { raw += chunk; });
        res.on('end', () => {
          try {
            const parsed = raw ? JSON.parse(raw) : null;
            resolve({ status: res.statusCode, headers: res.headers, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, rawBody: raw });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  it('GET /api/ai/status verifies control plane and provider health over HTTP', async () => {
    const res = await request('GET', '/api/ai/status');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.status, 'ONLINE');
    assert.ok(res.body.providers);
    assert.ok(res.body.budget);
  });

  it('POST /api/ai/control-plane/dispatch processes full request chain with proposalOnly guarantee', async () => {
    const res = await request('POST', '/api/ai/control-plane/dispatch', {
      prompt: 'Generate unit test assertion for division',
      taskType: 'coding'
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.strictEqual(res.body.result.executionAuthorized, false);
    assert.strictEqual(res.body.result.proposalOnly, true);
  });

  it('enforces tenant isolation over HTTP: rejects header vs body tenant mismatch fail-closed', async () => {
    const res = await request(
      'POST',
      '/api/ai/control-plane/dispatch',
      { prompt: 'Unauthorized cross tenant attempt', tenantId: 'tenant-body-x' },
      { 'x-tenant-id': 'tenant-header-y' }
    );

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('Tenant mismatch'));
  });

  it('handles 10 concurrent requests cleanly without race conditions or billing corruption', async () => {
    const tasks = [];
    for (let i = 0; i < 10; i++) {
      tasks.push(
        request('POST', '/api/ai/control-plane/dispatch', {
          prompt: 'Concurrent HTTP request ' + i,
          taskId: 'task-http-c10-' + i
        })
      );
    }

    const results = await Promise.all(tasks);
    assert.equal(results.length, 10);
    for (const r of results) {
      assert.equal(r.status, 200);
      assert.equal(r.body.success, true);
      assert.strictEqual(r.body.result.executionAuthorized, false);
    }
  });

  it('handles 25 concurrent requests cleanly without socket starvation or trace collision', async () => {
    const tasks = [];
    for (let i = 0; i < 25; i++) {
      tasks.push(
        request('POST', '/api/ai/control-plane/dispatch', {
          prompt: 'Batch concurrent HTTP request ' + i,
          taskId: 'task-http-c25-' + i
        })
      );
    }

    const results = await Promise.all(tasks);
    assert.equal(results.length, 25);
    const traceIds = new Set();
    for (const r of results) {
      assert.equal(r.status, 200);
      assert.equal(r.body.success, true);
      assert.ok(r.body.result.traceId);
      traceIds.add(r.body.result.traceId);
    }
    // Invariant: zero trace collisions
    assert.equal(traceIds.size, 25);
  });
});
