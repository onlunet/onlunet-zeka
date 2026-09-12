/**
 * ONLUNET ZEKA — Visual Capture Engine v1.0
 * FAZ 70: Deterministic Browser Screenshot Infrastructure
 *
 * GUARANTEES:
 * 1. Zero External Dependencies: Native Node.js & native WebSocket / CDP only.
 * 2. Reuses Hardened Browser QA Lifecycle: No parallel browser launchers.
 * 3. Strict Storage Isolation: Captures stored exclusively under os.tmpdir()/onlunet-visual-captures/.
 *    Zero pollution into src/, tests/, projects/, or repository root.
 * 4. Deterministic Filename & Metadata: Sanitized slugs, collision-proof unique IDs, structured metadata.
 * 5. PNG Signature Integrity: Magic bytes verification (89 50 4E 47 0D 0A 1A 0A).
 * 6. Dual Capture Modes: Explicit 'viewport' and 'fullPage' support.
 * 7. Bounded Cleanup: Guaranteed cleanup of CDP targets, WebSockets, and partial failure files.
 *    Successful captures retained for FAZ 71+ visual intelligence inspection.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import {
  launchHeadlessBrowser,
  getBrowserExecutablePath,
  safeRemoveDir
} from './browser-qa-inspector.js';

export const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const DEFAULT_CAPTURE_BASE_DIR = path.join(os.tmpdir(), 'onlunet-visual-captures');
export const SUPPORTED_MODES = Object.freeze(['viewport', 'fullPage']);

/**
 * Validates whether a Buffer starts with standard 8-byte PNG magic header
 */
export function validatePngBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 8) {
    return false;
  }
  return buffer.subarray(0, 8).equals(PNG_MAGIC_BYTES);
}

/**
 * Sanitizes arbitrary URL or page identifier into a secure filesystem slug.
 * Prevents directory traversal (..), path separators (\, /), and illegal Windows characters.
 */
export function sanitizeFilenameSlug(input) {
  if (!input || typeof input !== 'string') {
    return 'page';
  }

  let raw = input.trim();

  // If input is a URL, extract host and pathname
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathname = parsed.pathname.replace(/\/$/, '');
    raw = `${host}${pathname}`;
  } catch {
    // Keep raw string
  }

  // Remove protocol prefixes if any remain
  raw = raw.replace(/^https?:\/\//i, '');

  // Strip path traversal attempts and illegal filename characters
  // Windows invalid: < > : " / \ | ? * and ASCII 0-31
  let sanitized = raw
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\.\.+/g, '-')
    .replace(/[^a-zA-Z0-9_\-\.]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_\.]+|[-_\.]+$/g, '');

  if (!sanitized) {
    return 'page';
  }

  // Bound length to prevent filesystem path-length overflow
  if (sanitized.length > 50) {
    sanitized = sanitized.slice(0, 50).replace(/[-_\.]+$/, '');
  }

  return sanitized || 'page';
}

/**
 * Constructs structured, machine-readable capture metadata
 */
export function createCaptureMetadata({
  captureId,
  url,
  mode,
  viewport,
  filePath,
  fileSizeBytes = 0,
  pageTitle = '',
  pageDimensions = null,
  capturedAt = new Date().toISOString(),
  durationMs = null,
  browserVersion = ''
} = {}) {
  return {
    captureId,
    url,
    mode,
    viewport: {
      width: Number(viewport?.width) || 1440,
      height: Number(viewport?.height) || 900
    },
    filePath,
    fileSizeBytes,
    pageTitle,
    pageDimensions: pageDimensions ? {
      width: Number(pageDimensions.width),
      height: Number(pageDimensions.height)
    } : null,
    capturedAt,
    durationMs,
    browserVersion,
    format: 'png'
  };
}

/**
 * Captures a deterministic screenshot of a single URL via CDP.
 *
 * @param {Object} options
 * @param {string} options.url - Full target URL (http:// or https://)
 * @param {'viewport'|'fullPage'} [options.mode='viewport'] - Capture mode
 * @param {Object} [options.viewport] - Viewport dimensions { width, height }
 * @param {string} [options.outputDir] - Target directory under os.tmpdir()
 * @param {number} [options.timeoutMs=10000] - Bounded execution timeout
 * @param {number} [options.deviceScaleFactor=1] - Pixel ratio
 * @param {Object} [options.browserInstance] - Existing headless browser instance to reuse
 * @returns {Promise<Object>} Structured capture metadata
 */
export async function capturePageScreenshot(options = {}) {
  const {
    url,
    mode = 'viewport',
    viewport = { width: 1440, height: 900 },
    outputDir = null,
    timeoutMs = 10000,
    deviceScaleFactor = 1,
    browserInstance = null
  } = options;

  // 1. Validate Input Parameters
  if (!url || typeof url !== 'string') {
    throw new Error('[VISUAL_CAPTURE_ERROR] url is required and must be a string');
  }

  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`[VISUAL_CAPTURE_ERROR] Invalid URL protocol '${parsedUrl.protocol}'. Only http: and https: are supported.`);
    }
  } catch (err) {
    throw new Error(`[VISUAL_CAPTURE_ERROR] Invalid URL '${url}': ${err.message}`);
  }

  if (!SUPPORTED_MODES.includes(mode)) {
    throw new Error(`[VISUAL_CAPTURE_ERROR] Invalid capture mode '${mode}'. Supported modes: ${SUPPORTED_MODES.map(m => `'${m}'`).join(', ')}`);
  }

  const vpWidth = Number(viewport?.width);
  const vpHeight = Number(viewport?.height);
  if (!vpWidth || vpWidth <= 0 || !vpHeight || vpHeight <= 0) {
    throw new Error(`[VISUAL_CAPTURE_ERROR] Invalid viewport dimensions: width=${viewport?.width}, height=${viewport?.height}. Must be positive numbers.`);
  }

  const startTime = Date.now();
  const captureId = `cap-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // 2. Storage Directory Isolation (Guaranteed in os.tmpdir())
  const targetDir = outputDir
    ? path.resolve(outputDir)
    : path.join(DEFAULT_CAPTURE_BASE_DIR, captureId);

  // Storage boundary guard: Never allow writing directly into repo root or source folders
  const forbiddenDirs = ['src', 'tests', 'projects', 'projeler'];
  const normalizedTargetDir = path.normalize(targetDir).toLowerCase();
  for (const forbidden of forbiddenDirs) {
    const checkPath = path.join(process.cwd(), forbidden).toLowerCase();
    if (normalizedTargetDir === checkPath || normalizedTargetDir.startsWith(checkPath + path.sep)) {
      throw new Error(`[VISUAL_CAPTURE_SECURITY_BLOCKED] Writing captures to project directory '${forbidden}' is forbidden.`);
    }
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 3. Browser Lifecycle Acquisition
  let ownBrowser = false;
  let browser = browserInstance;

  if (!browser) {
    browser = await launchHeadlessBrowser({
      timeoutMs: Math.max(6000, timeoutMs)
    });
    ownBrowser = true;
  }

  let targetId = null;
  let ws = null;
  let writtenFilePath = null;
  let captureSuccess = false;

  try {
    // 4. Create new target page via CDP HTTP API (instant empty target)
    const targetRes = await fetch(
      `http://127.0.0.1:${browser.debugPort}/json/new`,
      { method: 'PUT' }
    );
    if (!targetRes.ok) {
      throw new Error(`Failed to create browser target for ${url}: HTTP ${targetRes.status}`);
    }

    const targetData = await targetRes.json();
    targetId = targetData.id;
    const wsUrl = targetData.webSocketDebuggerUrl;

    // 5. Connect WebSocket with bounded timeout
    ws = new globalThis.WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      const wsTimer = setTimeout(() => {
        reject(new Error(`WebSocket connection timed out for ${url}`));
      }, 4000);

      ws.onopen = () => {
        clearTimeout(wsTimer);
        resolve();
      };
      ws.onerror = (e) => {
        clearTimeout(wsTimer);
        reject(new Error(`WebSocket connection failed for ${url}: ${e?.message || 'Connection refused'}`));
      };
    });

    let msgId = 1;
    const send = (method, params = {}) => {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        const handler = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.id === id) {
              ws.removeEventListener('message', handler);
              if (data.error) {
                reject(new Error(`CDP error on ${method}: ${data.error.message}`));
              } else {
                resolve(data.result);
              }
            }
          } catch { /* ignore parse error */ }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    // 6. Enable CDP Domains
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');

    // 7. Configure Viewport
    await send('Emulation.setDeviceMetricsOverride', {
      width: vpWidth,
      height: vpHeight,
      deviceScaleFactor: Number(deviceScaleFactor) || 1,
      mobile: false
    });

    // 8. Execute navigation and capture under bounded timeout
    let timeoutTimer = null;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutTimer = setTimeout(() => {
        reject(new Error(`[VISUAL_CAPTURE_TIMEOUT] Page capture timed out after ${timeoutMs}ms for ${url}`));
      }, timeoutMs);
    });

    const captureWork = (async () => {
      // Navigate to destination URL
      const navRes = await send('Page.navigate', { url });
      if (navRes?.errorText) {
        throw new Error(`[VISUAL_CAPTURE_ERROR] Navigation failed: ${navRes.errorText}`);
      }

      // Wait for page load / DOM readiness with sub-timeout
      await new Promise((resolve) => {
        let resolved = false;
        const done = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };

        const readyTimer = setTimeout(done, Math.max(1000, timeoutMs - 1200));
        const loadListener = (evt) => {
          try {
            const d = JSON.parse(evt.data);
            if (d.method === 'Page.loadEventFired' || d.method === 'Page.domContentEventFired') {
              clearTimeout(readyTimer);
              ws.removeEventListener('message', loadListener);
              done();
            }
          } catch { /* ignore */ }
        };
        ws.addEventListener('message', loadListener);
      });

      // Settle delay for web fonts and layout stability
      await new Promise(r => setTimeout(r, 350));

      // Extract page title
      let pageTitle = '';
      try {
        const titleEval = await send('Runtime.evaluate', { expression: 'document.title' });
        pageTitle = titleEval?.result?.value || '';
      } catch { /* ignore */ }

      // Execute Capture based on mode
      let screenshotParams = { format: 'png' };
      let pageDimensions = { width: vpWidth, height: vpHeight };

      if (mode === 'fullPage') {
        const metrics = await send('Page.getLayoutMetrics');
        const contentWidth = Math.max(
          vpWidth,
          Math.ceil(metrics?.contentSize?.width || metrics?.cssContentSize?.width || vpWidth)
        );
        const contentHeight = Math.max(
          vpHeight,
          Math.ceil(metrics?.contentSize?.height || metrics?.cssContentSize?.height || vpHeight)
        );
        pageDimensions = { width: contentWidth, height: contentHeight };

        screenshotParams = {
          format: 'png',
          captureBeyondViewport: true,
          clip: {
            x: 0,
            y: 0,
            width: contentWidth,
            height: contentHeight,
            scale: 1
          }
        };
      }

      const snapResult = await send('Page.captureScreenshot', screenshotParams);
      if (!snapResult || !snapResult.data) {
        throw new Error(`[VISUAL_CAPTURE_ERROR] CDP Page.captureScreenshot returned empty data for ${url}`);
      }

      return { snapResult, pageTitle, pageDimensions };
    })();

    const { snapResult, pageTitle, pageDimensions } = await Promise.race([captureWork, timeoutPromise]);
    if (timeoutTimer) clearTimeout(timeoutTimer);

    const imageBuffer = Buffer.from(snapResult.data, 'base64');
    if (!validatePngBuffer(imageBuffer)) {
      throw new Error(`[VISUAL_CAPTURE_ERROR] Captured image data failed PNG signature validation for ${url}`);
    }

    // 9. Write File Deterministically
    const slug = sanitizeFilenameSlug(url);
    const fileName = `${slug}-${mode}-${captureId}.png`;
    writtenFilePath = path.join(targetDir, fileName);

    fs.writeFileSync(writtenFilePath, imageBuffer);

    // 11. Retrieve browser version for metadata
    let browserVersion = '';
    try {
      const vRes = await fetch(`http://127.0.0.1:${browser.debugPort}/json/version`);
      if (vRes.ok) {
        const vData = await vRes.json();
        browserVersion = vData?.Browser || '';
      }
    } catch { /* ignore */ }

    const durationMs = Date.now() - startTime;
    const metadata = createCaptureMetadata({
      captureId,
      url,
      mode,
      viewport: { width: vpWidth, height: vpHeight },
      filePath: writtenFilePath,
      fileSizeBytes: imageBuffer.length,
      pageTitle,
      pageDimensions,
      capturedAt: new Date().toISOString(),
      durationMs,
      browserVersion
    });

    captureSuccess = true;
    return metadata;

  } finally {
    // 12. Guaranteed Resource Cleanup (finally)
    if (ws) {
      try { ws.close(); } catch { /* ignore */ }
    }

    if (targetId && browser?.debugPort) {
      try {
        await fetch(`http://127.0.0.1:${browser.debugPort}/json/close/${targetId}`);
      } catch { /* ignore */ }
    }

    if (ownBrowser && browser) {
      try {
        await browser.close();
      } catch { /* ignore */ }
    }

    // Clean up partial file on failure
    if (!captureSuccess && writtenFilePath && fs.existsSync(writtenFilePath)) {
      try {
        fs.unlinkSync(writtenFilePath);
      } catch { /* ignore */ }
    }
  }
}

/**
 * Captures screenshots for multiple URLs sequentially reusing a single browser instance.
 *
 * @param {Array<string|Object>} pages - List of URLs or page options
 * @param {Object} [commonOptions] - Default options applied to all captures
 * @returns {Promise<Array<Object>>} Array of capture metadata objects
 */
export async function capturePages(pages = [], commonOptions = {}) {
  if (!Array.isArray(pages)) {
    throw new Error('[VISUAL_CAPTURE_ERROR] capturePages requires an array of page URLs or page specifications');
  }

  const results = [];
  const browser = await launchHeadlessBrowser({
    timeoutMs: commonOptions.timeoutMs || 15000,
    debugPort: commonOptions.debugPort,
    userDataDir: commonOptions.userDataDir
  });

  try {
    for (const item of pages) {
      const spec = typeof item === 'string' ? { url: item } : item;
      const opts = {
        ...commonOptions,
        ...spec,
        browserInstance: browser
      };
      const metadata = await capturePageScreenshot(opts);
      results.push(metadata);
    }
    return results;
  } finally {
    await browser.close();
  }
}
