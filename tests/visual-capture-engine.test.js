import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

import {
  capturePageScreenshot,
  capturePages,
  createCaptureMetadata,
  sanitizeFilenameSlug,
  validatePngBuffer,
  PNG_MAGIC_BYTES,
  DEFAULT_CAPTURE_BASE_DIR,
  SUPPORTED_MODES
} from '../src/autonomous/visual-capture-engine.js';

import { findFreePort } from '../src/autonomous/browser-qa-inspector.js';

test('ONLUNET ZEKA — Visual Capture Engine Test Suite (FAZ 70)', async (t) => {
  let server = null;
  let serverPort = null;
  let baseUrl = null;

  t.before(async () => {
    serverPort = await findFreePort(9910);
    server = http.createServer((req, res) => {
      const url = req.url || '/';

      if (url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html>
<head><title>Test Home Page</title></head>
<body style="margin: 0; background: #f0fdf4; font-family: sans-serif; padding: 40px;">
  <h1 style="color: #166534;">ONLUNET ZEKA Visual Capture</h1>
  <p>Viewport capture test document.</p>
</body>
</html>`);
      } else if (url === '/tall') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html>
<head><title>Tall Page</title></head>
<body style="margin: 0; background: linear-gradient(#fef2f2, #eff6ff); font-family: sans-serif; padding: 20px;">
  <h1>Tall Page Header</h1>
  <div style="height: 2400px; background: repeating-linear-gradient(45deg, #e2e8f0, #e2e8f0 10px, #f8fafc 10px, #f8fafc 20px); margin: 20px 0;"></div>
  <h2>Tall Page Footer</h2>
</body>
</html>`);
      } else if (url === '/error') {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<h1>Internal Server Error</h1>');
      } else if (url === '/slow') {
        // Intentionally delayed response
        setTimeout(() => {
          try {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Slow Response</h1>');
          } catch {}
        }, 15000);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>Not Found</h1>');
      }
    });

    await new Promise(resolve => server.listen(serverPort, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${serverPort}`;
  });

  t.after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  await t.test('1. Captures valid viewport screenshot with PNG magic bytes', async () => {
    const meta = await capturePageScreenshot({
      url: `${baseUrl}/`,
      mode: 'viewport',
      viewport: { width: 1280, height: 720 },
      timeoutMs: 8000
    });

    assert.ok(meta);
    assert.equal(meta.mode, 'viewport');
    assert.equal(meta.viewport.width, 1280);
    assert.equal(meta.viewport.height, 720);
    assert.equal(meta.format, 'png');
    assert.ok(meta.filePath);
    assert.ok(fs.existsSync(meta.filePath));

    // Verify file content & PNG magic bytes
    const buf = fs.readFileSync(meta.filePath);
    assert.ok(validatePngBuffer(buf), 'Must match 8-byte PNG header');
    assert.equal(buf.subarray(0, 8).toString('hex'), PNG_MAGIC_BYTES.toString('hex'));
    assert.ok(meta.fileSizeBytes > 1000);
    assert.equal(meta.pageTitle, 'Test Home Page');
  });

  await t.test('2. Captures valid fullPage screenshot with expanded height', async () => {
    const meta = await capturePageScreenshot({
      url: `${baseUrl}/tall`,
      mode: 'fullPage',
      viewport: { width: 1440, height: 900 },
      timeoutMs: 8000
    });

    assert.ok(meta);
    assert.equal(meta.mode, 'fullPage');
    assert.ok(meta.filePath);
    assert.ok(fs.existsSync(meta.filePath));

    // Fullpage dimensions must exceed viewport height because document is tall (~2400px+)
    assert.ok(meta.pageDimensions.height > 1500, `Fullpage height (${meta.pageDimensions.height}) should be > 1500px`);

    const buf = fs.readFileSync(meta.filePath);
    assert.ok(validatePngBuffer(buf));
  });

  await t.test('3. Rejects invalid capture mode fail-closed', async () => {
    await assert.rejects(
      async () => {
        await capturePageScreenshot({
          url: `${baseUrl}/`,
          mode: 'isometric3d'
        });
      },
      (err) => {
        assert.ok(err.message.includes('Invalid capture mode'));
        return true;
      }
    );
  });

  await t.test('4. Rejects invalid URL and invalid protocols fail-closed', async () => {
    await assert.rejects(
      async () => {
        await capturePageScreenshot({ url: 'file:///etc/passwd' });
      },
      (err) => {
        assert.ok(err.message.includes('protocol'));
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await capturePageScreenshot({ url: 'javascript:alert(1)' });
      },
      (err) => {
        assert.ok(err.message.includes('protocol') || err.message.includes('Invalid URL'));
        return true;
      }
    );
  });

  await t.test('5. Rejects writing directly to forbidden project directories', async () => {
    await assert.rejects(
      async () => {
        await capturePageScreenshot({
          url: `${baseUrl}/`,
          outputDir: path.join(process.cwd(), 'src')
        });
      },
      (err) => {
        assert.ok(err.message.includes('VISUAL_CAPTURE_SECURITY_BLOCKED'));
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await capturePageScreenshot({
          url: `${baseUrl}/`,
          outputDir: path.join(process.cwd(), 'tests')
        });
      },
      (err) => {
        assert.ok(err.message.includes('VISUAL_CAPTURE_SECURITY_BLOCKED'));
        return true;
      }
    );
  });

  await t.test('6. Sanitizes slugs and prevents directory traversal attacks', () => {
    assert.equal(sanitizeFilenameSlug('../../etc/shadow'), 'etc-shadow');
    assert.equal(sanitizeFilenameSlug('..\\..\\boot.ini'), 'boot.ini');
    assert.equal(sanitizeFilenameSlug('https://example.com/a/b/c?x=1&y=2'), 'example.com-a-b-c');
    assert.equal(sanitizeFilenameSlug('C:\\Windows\\System32\\calc.exe'), 'Windows-System32-calc.exe');
    assert.equal(sanitizeFilenameSlug(''), 'page');
    assert.equal(sanitizeFilenameSlug(null), 'page');
  });

  await t.test('7. Enforces bounded timeout on slow/hanging targets', async () => {
    const startTime = Date.now();
    await assert.rejects(
      async () => {
        await capturePageScreenshot({
          url: `${baseUrl}/slow`,
          mode: 'viewport',
          timeoutMs: 2500
        });
      },
      (err) => {
        assert.ok(err.message.includes('VISUAL_CAPTURE_TIMEOUT'));
        return true;
      }
    );
    const elapsed = Date.now() - startTime;
    assert.ok(elapsed < 6000, `Execution should reject within bounded window, took ${elapsed}ms`);
  });

  await t.test('8. Handles concurrent captures safely without collision or file overwrite', async () => {
    const [capA, capB] = await Promise.all([
      capturePageScreenshot({
        url: `${baseUrl}/`,
        mode: 'viewport',
        viewport: { width: 1280, height: 800 }
      }),
      capturePageScreenshot({
        url: `${baseUrl}/tall`,
        mode: 'fullPage',
        viewport: { width: 1024, height: 768 }
      })
    ]);

    assert.notEqual(capA.captureId, capB.captureId);
    assert.notEqual(capA.filePath, capB.filePath);
    assert.ok(fs.existsSync(capA.filePath));
    assert.ok(fs.existsSync(capB.filePath));
    assert.ok(validatePngBuffer(fs.readFileSync(capA.filePath)));
    assert.ok(validatePngBuffer(fs.readFileSync(capB.filePath)));
  });

  await t.test('9. capturePages captures multiple URLs sequentially reusing single browser', async () => {
    const pages = [
      `${baseUrl}/`,
      `${baseUrl}/tall`
    ];

    const results = await capturePages(pages, {
      mode: 'viewport',
      viewport: { width: 1366, height: 768 }
    });

    assert.equal(results.length, 2);
    assert.ok(results[0].filePath.includes('.png'));
    assert.ok(results[1].filePath.includes('.png'));
    assert.notEqual(results[0].filePath, results[1].filePath);
    assert.ok(fs.existsSync(results[0].filePath));
    assert.ok(fs.existsSync(results[1].filePath));
    assert.ok(validatePngBuffer(fs.readFileSync(results[0].filePath)));
    assert.ok(validatePngBuffer(fs.readFileSync(results[1].filePath)));
  });

  await t.test('10. Storage Isolation: Zero screenshot files written into process.cwd() or source folders', () => {
    const cwdFiles = fs.readdirSync(process.cwd());
    const leakedPngs = cwdFiles.filter(f => f.endsWith('.png'));
    assert.equal(leakedPngs.length, 0, `process.cwd() must have 0 png files, found: ${leakedPngs.join(', ')}`);

    const srcFiles = fs.readdirSync(path.join(process.cwd(), 'src'));
    assert.equal(srcFiles.filter(f => f.endsWith('.png')).length, 0);

    const testFiles = fs.readdirSync(path.join(process.cwd(), 'tests'));
    assert.equal(testFiles.filter(f => f.endsWith('.png')).length, 0);
  });

  await t.test('11. Cleanup after failure: partial artifacts are unlinked on error', async () => {
    const customDir = path.join(os.tmpdir(), `test-fail-cleanup-${Date.now()}`);
    fs.mkdirSync(customDir, { recursive: true });

    try {
      await assert.rejects(
        async () => {
          await capturePageScreenshot({
            url: 'http://127.0.0.1:1/nonexistent',
            mode: 'viewport',
            outputDir: customDir,
            timeoutMs: 1500
          });
        }
      );

      // Verify that no partial png was left in customDir
      const files = fs.readdirSync(customDir);
      assert.equal(files.filter(f => f.endsWith('.png')).length, 0);
    } finally {
      try { fs.rmSync(customDir, { recursive: true, force: true }); } catch {}
    }
  });

  await t.test('12. External CWD verification: invocation preserves clean working directory', async () => {
    const meta = await capturePageScreenshot({
      url: `${baseUrl}/`,
      mode: 'viewport'
    });

    assert.ok(meta.filePath);
    assert.ok(fs.existsSync(meta.filePath));
    assert.ok(meta.filePath.startsWith(os.tmpdir()));

    // Verify process.cwd() has no newly created visual capture directories
    const cwdEntries = fs.readdirSync(process.cwd());
    assert.equal(cwdEntries.filter(e => e.includes('onlunet-visual-captures')).length, 0);
  });
});
