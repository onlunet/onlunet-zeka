/**
 * ONLUNET ZEKA — FAZ 74.2 Authoritative Plan Isolation & Concurrency Security Test Suite
 *
 * Validates:
 * 1. Generate without plan -> BLOCKED
 * 2. Approval alone does not grant mutation authority
 * 3. Valid plan -> Valid generate -> PASS
 * 4. Plan A -> Project B targetDirectory -> BLOCKED (Cross-project authority violation)
 * 5. Plan A -> Project B companyName -> BLOCKED (Cross-project authority violation)
 * 6. Plan A -> Plan B interleaved -> Unkeyed generate cannot use Plan B for Project A
 * 7. Stale authority protection: Invalidated plan -> BLOCKED
 * 8. Target directory path traversal (../, ../../, projeler/../../outside) -> BLOCKED
 * 9. Absolute target path (/tmp/test, C:\temp\test) -> BLOCKED
 * 10. Replay protection: Consumed plan cannot be re-executed
 * 11. Concurrent multi-project planning & execution isolation
 * 12. Failed generation does not leave invalid authority
 * 13. Successful generation of Project A does not affect Project B's authority
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { createApplicationServer } from '../src/app/server.js';

test('ONLUNET ZEKA — FAZ 74.2 Authoritative Plan Isolation & Concurrency Security', async (t) => {
  let server;
  let baseUrl;
  const testWorkspace = path.join(process.cwd(), 'scratch-faz74-2-workspace');

  if (!fs.existsSync(testWorkspace)) {
    fs.mkdirSync(testWorkspace, { recursive: true });
  }

  await new Promise((resolve) => {
    server = createApplicationServer();
    server.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (fs.existsSync(testWorkspace)) {
      fs.rmSync(testWorkspace, { recursive: true, force: true });
    }
  });

  // Select test workspace
  await fetch(`${baseUrl}/api/workspace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rootPath: testWorkspace })
  });

  await t.test('1. Generate without plan is strictly blocked with SECURITY_BLOCKED', async () => {
    const res = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approval: true
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('SECURITY_BLOCKED') || data.error.includes('No authoritative plan exists'));
  });

  await t.test('2. Approval alone does not grant mutation authority; approval:false is blocked', async () => {
    const planRes = await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Test Güvenlik A.Ş.',
        industry: 'Bilişim & Siber Güvenlik',
        targetDirectory: 'projeler/test-guvenlik'
      })
    });
    assert.equal(planRes.status, 200);
    const planData = await planRes.json();
    assert.equal(planData.success, true);
    const planId = planData.authoritativePlanId;

    const genRes = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        approval: false
      })
    });

    assert.equal(genRes.status, 400);
    const genData = await genRes.json();
    assert.equal(genData.success, false);
    assert.ok(genData.error.includes('SECURITY_BLOCKED') || genData.error.includes('User approval was rejected'));
  });

  await t.test('3. Valid plan -> Valid generate -> PASS with isolated corporate files', async () => {
    const planRes = await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Nova Lojistik',
        industry: 'Lojistik & Taşımacılık',
        targetDirectory: 'projeler/nova-lojistik'
      })
    });
    const planData = await planRes.json();
    assert.equal(planData.success, true);
    const planId = planData.authoritativePlanId;

    const genRes = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        approval: true,
        autoStart: false
      })
    });

    assert.equal(genRes.status, 200);
    const genData = await genRes.json();
    assert.equal(genData.success, true);
    assert.ok(genData.result.writtenFiles.length > 0);

    const indexPath = path.join(testWorkspace, 'projeler', 'nova-lojistik', 'public', 'index.html');
    assert.ok(fs.existsSync(indexPath));
  });

  await t.test('4. Cross-project binding: Plan A cannot generate for Project B targetDirectory', async () => {
    const planRes = await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Firma Alpha',
        industry: 'Mühendislik',
        targetDirectory: 'projeler/firma-alpha'
      })
    });
    const planData = await planRes.json();
    const planId = planData.authoritativePlanId;

    const genRes = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        targetDirectory: 'projeler/firma-beta',
        approval: true,
        autoStart: false
      })
    });

    assert.equal(genRes.status, 400);
    const genData = await genRes.json();
    assert.equal(genData.success, false);
    assert.ok(genData.error.includes('Cross-project authority violation'));
  });

  await t.test('5. Cross-project binding: Plan A cannot generate for Project B companyName', async () => {
    const planRes = await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Firma Delta',
        industry: 'Hukuk',
        targetDirectory: 'projeler/firma-delta'
      })
    });
    const planData = await planRes.json();
    const planId = planData.authoritativePlanId;

    const genRes = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        companyName: 'Omega Danışmanlık',
        approval: true,
        autoStart: false
      })
    });

    assert.equal(genRes.status, 400);
    const genData = await genRes.json();
    assert.equal(genData.success, false);
    assert.ok(genData.error.includes('Cross-project authority violation'));
  });

  await t.test('6. Plan A -> Plan B interleaved: Unkeyed generate does NOT allow Plan B for Project A', async () => {
    await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Firma Birinci',
        industry: 'Gıda',
        targetDirectory: 'projeler/firma-birinci'
      })
    });

    await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Firma Ikinci',
        industry: 'Tekstil',
        targetDirectory: 'projeler/firma-ikinci'
      })
    });

    const genRes = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetDirectory: 'projeler/firma-birinci',
        approval: true,
        autoStart: false
      })
    });

    assert.equal(genRes.status, 400);
    const genData = await genRes.json();
    assert.equal(genData.success, false);
    assert.ok(genData.error.includes('Cross-project authority violation'));
  });

  await t.test('7. Stale authority protection: Invalidated plan is strictly blocked', async () => {
    const planRes = await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Firma Stale',
        industry: 'Enerji',
        targetDirectory: 'projeler/firma-stale'
      })
    });
    const planData = await planRes.json();
    const planId = planData.authoritativePlanId;

    const invRes = await fetch(`${baseUrl}/api/corporate/plan/invalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId })
    });
    assert.equal(invRes.status, 200);

    const genRes = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        approval: true,
        autoStart: false
      })
    });

    assert.equal(genRes.status, 400);
    const genData = await genRes.json();
    assert.equal(genData.success, false);
    assert.ok(genData.error.includes('Stale plan blocked'));
  });

  await t.test('8. Target directory path traversal (../, ../../, projeler/../../outside) is strictly blocked', async () => {
    const traversalPayloads = [
      '../evil-folder',
      '../../outside-corp',
      'projeler/../../escape-corp'
    ];

    for (const targetDir of traversalPayloads) {
      const res = await fetch(`${baseUrl}/api/corporate/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Traversal Attack Corp',
          industry: 'Security Test',
          targetDirectory: targetDir
        })
      });

      assert.equal(res.status, 400, `Target dir ${targetDir} must be rejected with 400`);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('SECURITY_BLOCKED') || data.error.includes('Path traversal blocked'));
    }
  });

  await t.test('9. Absolute target paths (/tmp/test, C:\\temp\\test) are strictly blocked', async () => {
    const absPayloads = [
      '/tmp/test-escape',
      'C:\\temp\\test-escape'
    ];

    for (const targetDir of absPayloads) {
      const res = await fetch(`${baseUrl}/api/corporate/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Absolute Attack Corp',
          industry: 'Security Test',
          targetDirectory: targetDir
        })
      });

      assert.equal(res.status, 400, `Target dir ${targetDir} must be rejected with 400`);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('SECURITY_BLOCKED') || data.error.includes('Absolute path not allowed'));
    }
  });

  await t.test('10. Replay protection: Consumed plan cannot be re-executed', async () => {
    const planRes = await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Replay Shield Corp',
        industry: 'Fintech',
        targetDirectory: 'projeler/replay-shield'
      })
    });
    const planData = await planRes.json();
    const planId = planData.authoritativePlanId;

    const genRes1 = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        approval: true,
        autoStart: false
      })
    });
    assert.equal(genRes1.status, 200);

    const genRes2 = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        approval: true,
        autoStart: false
      })
    });

    assert.equal(genRes2.status, 400);
    const genData2 = await genRes2.json();
    assert.equal(genData2.success, false);
    assert.ok(genData2.error.includes('Replay execution blocked'));
  });

  await t.test('11. Concurrent multi-project planning & execution isolation', async () => {
    const [planResX, planResY] = await Promise.all([
      fetch(`${baseUrl}/api/corporate/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Project X Aero',
          industry: 'Havacılık',
          targetDirectory: 'projeler/project-x'
        })
      }),
      fetch(`${baseUrl}/api/corporate/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: 'Project Y Marine',
          industry: 'Denizcilik',
          targetDirectory: 'projeler/project-y'
        })
      })
    ]);

    const planDataX = await planResX.json();
    const planDataY = await planResY.json();
    assert.equal(planDataX.success, true);
    assert.equal(planDataY.success, true);
    assert.notEqual(planDataX.authoritativePlanId, planDataY.authoritativePlanId);

    const [genResX, genResY] = await Promise.all([
      fetch(`${baseUrl}/api/corporate/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: planDataX.authoritativePlanId,
          approval: true,
          autoStart: false
        })
      }),
      fetch(`${baseUrl}/api/corporate/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: planDataY.authoritativePlanId,
          approval: true,
          autoStart: false
        })
      })
    ]);

    const genDataX = await genResX.json();
    const genDataY = await genResY.json();
    assert.equal(genResX.status, 200);
    assert.equal(genResY.status, 200);
    assert.equal(genDataX.success, true);
    assert.equal(genDataY.success, true);

    const indexX = path.join(testWorkspace, 'projeler', 'project-x', 'public', 'index.html');
    const indexY = path.join(testWorkspace, 'projeler', 'project-y', 'public', 'index.html');
    assert.ok(fs.existsSync(indexX));
    assert.ok(fs.existsSync(indexY));

    const contentX = fs.readFileSync(indexX, 'utf-8');
    const contentY = fs.readFileSync(indexY, 'utf-8');
    assert.ok(contentX.includes('Project X Aero'));
    assert.ok(contentY.includes('Project Y Marine'));
  });

  await t.test('12. Failed generation does not leave invalid authority for subsequent reuse', async () => {
    const planRes = await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Firma Failure Guard',
        industry: 'Gıda',
        targetDirectory: 'projeler/failure-guard'
      })
    });
    const planData = await planRes.json();
    const planId = planData.authoritativePlanId;

    await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        approval: false
      })
    });

    const retryRes = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approval: true
      })
    });

    assert.equal(retryRes.status, 400);
    const retryData = await retryRes.json();
    assert.equal(retryData.success, false);
    assert.ok(retryData.error.includes('SECURITY_BLOCKED'));
  });

  await t.test('13. Generating Project A does not affect independent Project B authority', async () => {
    const planResM = await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Firma M',
        industry: 'Teknoloji',
        targetDirectory: 'projeler/firma-m'
      })
    });
    const planM = await planResM.json();

    const planResN = await fetch(`${baseUrl}/api/corporate/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: 'Firma N',
        industry: 'Kimya',
        targetDirectory: 'projeler/firma-n'
      })
    });
    const planN = await planResN.json();

    const genResM = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: planM.authoritativePlanId,
        approval: true,
        autoStart: false
      })
    });
    assert.equal(genResM.status, 200);

    const genResN = await fetch(`${baseUrl}/api/corporate/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: planN.authoritativePlanId,
        approval: true,
        autoStart: false
      })
    });
    assert.equal(genResN.status, 200);
    const genDataN = await genResN.json();
    assert.equal(genDataN.success, true);
    assert.ok(fs.existsSync(path.join(testWorkspace, 'projeler', 'firma-n', 'public', 'index.html')));
  });
});
