/**
 * ONLUNET ZEKA - FAZ 64 HTTP End-to-End Suite for OpenAI
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';

import { createApplicationServer } from '../src/app/server.js';
import { DataClassification } from '../src/control-plane/data-classifier.js';

describe('FAZ 64.18: HTTP E2E Routing for OpenAI', () => {
  let server = null;
  let port = null;

  before((_, done) => {
    const app = createApplicationServer();
    server = app.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      done();
    });
  });

  after((_, done) => {
    if (server) server.close(done);
    else done();
  });

  it('POST /api/ai/route selects OpenAI when permitted by policy with proposalOnly guarantee', async () => {
    const reqBody = JSON.stringify({
      task: 'Format JSON array',
      dataClassification: DataClassification.PUBLIC,
      preferredProvider: 'openai'
    });

    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/ai/route',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        let data = '';
        res.on('data', c => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.write(reqBody);
      req.end();
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.decision.selectedProvider, 'openai');
    assert.strictEqual(res.body.decision.proposalOnly, true);
    assert.strictEqual(res.body.decision.executionAuthorized, false);
  });
});
