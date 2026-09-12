import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

import {
  getBrowserExecutablePath,
  findFreePort,
  launchHeadlessBrowser,
  auditPageWithCdp,
  applyAutonomousFixes,
  runSelfHealingAudit
} from '../src/autonomous/browser-qa-inspector.js';

test('ONLUNET ZEKA — Autonomous Browser QA Inspector & Self-Healing Engine', async (t) => {
  const tempProjectDir = path.join(process.cwd(), 'temp-qa-test-project');

  t.before(() => {
    if (!fs.existsSync(tempProjectDir)) {
      fs.mkdirSync(tempProjectDir, { recursive: true });
    }
  });

  t.after(() => {
    if (fs.existsSync(tempProjectDir)) {
      try { fs.rmSync(tempProjectDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });

  await t.test('1. Detects available Chrome or Edge browser executable on the system', () => {
    const browserPath = getBrowserExecutablePath();
    assert.ok(browserPath, 'A browser path should be found on the system');
    assert.ok(fs.existsSync(browserPath), `Browser executable must exist: ${browserPath}`);
  });

  await t.test('2. Finds a free debugging TCP port dynamically', async () => {
    const port = await findFreePort(9450);
    assert.ok(typeof port === 'number');
    assert.ok(port >= 9450);
  });

  await t.test('3. Launches headless browser, communicates with CDP and terminates cleanly', async () => {
    const browser = await launchHeadlessBrowser();
    assert.ok(browser.process);
    assert.ok(browser.debugPort);

    // Verify CDP HTTP version endpoint
    const res = await fetch(`http://127.0.0.1:${browser.debugPort}/json/version`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.Browser);

    await browser.close();
  });

  await t.test('4. applyAutonomousFixes automatically synthesizes missing 404 upload assets', async () => {
    const fakeAudit = [{
      url: 'http://localhost:8080/tr/',
      errors: [],
      networkErrors: [
        {
          type: 'http_error',
          status: 404,
          statusText: 'Not Found',
          url: 'http://localhost:8080/uploads/missing-logo.png'
        }
      ]
    }];

    const fixRes = await applyAutonomousFixes(tempProjectDir, fakeAudit);
    assert.equal(fixRes.fixed, true);
    assert.ok(fixRes.fixesApplied.length > 0);

    const createdAsset = path.join(tempProjectDir, 'public', 'uploads', 'missing-logo.png');
    assert.ok(fs.existsSync(createdAsset), 'Fallback asset should have been created in public/uploads');
  });

  await t.test('5. applyAutonomousFixes automatically whitelists blocked CSP domains in scripts/server.js', async () => {
    const scriptsDir = path.join(tempProjectDir, 'scripts');
    fs.mkdirSync(scriptsDir, { recursive: true });
    const dummyServerJs = `
function getSecurityHeaders() {
  const csp = "script-src 'self' https://www.google.com; connect-src 'self';";
  return { 'Content-Security-Policy': csp };
}
`;
    fs.writeFileSync(path.join(scriptsDir, 'server.js'), dummyServerJs, 'utf8');

    const fakeAudit = [{
      url: 'http://localhost:8080/tr/',
      errors: [
        {
          type: 'log_error',
          message: "Loading the script 'https://analytics.tiktok.com/pixel.js' violates the following Content Security Policy directive"
        }
      ],
      networkErrors: []
    }];

    const fixRes = await applyAutonomousFixes(tempProjectDir, fakeAudit);
    assert.equal(fixRes.fixed, true);

    const updatedServerJs = fs.readFileSync(path.join(scriptsDir, 'server.js'), 'utf8');
    assert.ok(updatedServerJs.includes('analytics.tiktok.com'), 'Blocked domain should be whitelisted in server.js');
  });

  await t.test('6. Circuit Breaker: prevents infinite loops and stops cleanly after maxIterations', async () => {
    // Start dummy server that always triggers a persistent unfixable error
    const dummyServer = http.createServer((req, res) => {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end('<h1>Server Error</h1>');
    });

    const dummyPort = await findFreePort(9870);
    await new Promise(resolve => dummyServer.listen(dummyPort, '127.0.0.1', resolve));

    try {
      const result = await runSelfHealingAudit({
        projectDir: tempProjectDir,
        port: dummyPort,
        baseUrl: `http://localhost:${dummyPort}`,
        maxIterations: 2,
        launchUserBrowser: false,
        pageWaitMs: 800,
        maxPages: 1
      });

      assert.equal(result.success, false);
      assert.equal(result.status, 'max_iterations_reached');
      assert.equal(result.iterations, 2);
      assert.ok(result.message.includes('Sonsuz döngü engellendi'));
      assert.ok(result.remainingErrors.length > 0);
    } finally {
      await new Promise(resolve => dummyServer.close(resolve));
    }
  });

  await t.test('7. runSelfHealingAudit achieves 0 errors and reports "clean" on clean server', async () => {
    const cleanServer = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><head><title>Clean Site</title></head><body><h1>OK</h1></body></html>');
    });

    const cleanPort = await findFreePort(9880);
    await new Promise(resolve => cleanServer.listen(cleanPort, '127.0.0.1', resolve));

    try {
      const result = await runSelfHealingAudit({
        projectDir: tempProjectDir,
        port: cleanPort,
        baseUrl: `http://localhost:${cleanPort}`,
        maxIterations: 2,
        launchUserBrowser: false,
        pageWaitMs: 800,
        maxPages: 1
      });

      assert.equal(result.success, true);
      assert.equal(result.status, 'clean');
      assert.equal(result.iterations, 1);
      assert.ok(result.message.includes('Bitti'));
      assert.equal(result.remainingErrors.length, 0);
    } finally {
      await new Promise(resolve => cleanServer.close(resolve));
    }
  });
});
