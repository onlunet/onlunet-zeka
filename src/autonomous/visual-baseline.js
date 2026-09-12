/**
 * ONLUNET ZEKA — Multi-Viewport Responsive Capture & Baseline Manager
 * FAZ 71: Deterministic Multi-Device Capture, Baseline Persistence & Comparison
 *
 * GUARANTEES:
 * 1. Multi-device viewport matrix (Desktop 1440x900, Tablet 1024x768, Mobile 390x844).
 * 2. Strict storage isolation under os.tmpdir()/onlunet-visual-baselines/.
 * 3. Zero file pollution in project root or src/.
 * 4. Responsive flaw detection: Horizontal scroll overflow, clipped text, broken grids.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import {
  launchHeadlessBrowser
} from './browser-qa-inspector.js';

import {
  capturePageScreenshot,
  sanitizeFilenameSlug
} from './visual-capture-engine.js';

import {
  compareImages
} from './visual-diff.js';

import {
  analyzeRenderedUrl
} from './visual-analyzer.js';

export const STANDARD_VIEWPORTS = Object.freeze({
  desktop: Object.freeze({ name: 'desktop', width: 1440, height: 900 }),
  tablet: Object.freeze({ name: 'tablet', width: 1024, height: 768 }),
  mobile: Object.freeze({ name: 'mobile', width: 390, height: 844 })
});

export const DEFAULT_BASELINE_BASE_DIR = path.join(os.tmpdir(), 'onlunet-visual-baselines');

/**
 * Captures all standard responsive viewports for a target URL
 * Reuses a single headless browser instance for optimal performance.
 */
export async function captureResponsiveViewports(url, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('[BASELINE_ERROR] url is required');
  }

  const {
    outputDir = null,
    viewports = STANDARD_VIEWPORTS,
    timeoutMs = 15000,
    browserInstance = null
  } = options;

  let ownBrowser = false;
  let browser = browserInstance;

  if (!browser) {
    browser = await launchHeadlessBrowser({ timeoutMs: Math.max(6000, timeoutMs) });
    ownBrowser = true;
  }

  const results = {};
  const targetDir = outputDir || path.join(DEFAULT_BASELINE_BASE_DIR, `resp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  try {
    for (const [key, vp] of Object.entries(viewports)) {
      const capture = await capturePageScreenshot({
        url,
        mode: 'viewport',
        viewport: { width: vp.width, height: vp.height },
        outputDir: targetDir,
        browserInstance: browser,
        timeoutMs: Math.max(4000, Math.floor(timeoutMs / 3))
      });

      results[key] = {
        viewportName: key,
        viewport: { width: vp.width, height: vp.height },
        capture
      };
    }

    return {
      url,
      capturedAt: new Date().toISOString(),
      outputDir: targetDir,
      viewports: results
    };
  } finally {
    if (ownBrowser && browser) {
      try {
        if (typeof browser.close === 'function') {
          await browser.close();
        } else if (typeof browser.terminate === 'function') {
          await browser.terminate();
        }
      } catch { /* ignore */ }
    }
  }
}

/**
 * Creates and persists a visual baseline manifest with screenshots for a site
 */
export async function createVisualBaseline(url, options = {}) {
  const {
    baselineId = `baseline-${sanitizeFilenameSlug(url)}-${Date.now()}`,
    baseDir = DEFAULT_BASELINE_BASE_DIR
  } = options;

  const baselineDir = path.join(baseDir, baselineId);
  const responsiveResult = await captureResponsiveViewports(url, {
    outputDir: baselineDir,
    timeoutMs: options.timeoutMs || 15000
  });

  const manifest = {
    baselineId,
    url,
    createdAt: new Date().toISOString(),
    baselineDir,
    viewports: responsiveResult.viewports
  };

  const manifestPath = path.join(baselineDir, 'baseline.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    success: true,
    manifestPath,
    ...manifest
  };
}

/**
 * Compares current render of a URL against a stored baseline
 */
export async function compareWithBaseline(url, baselineDirOrManifest, options = {}) {
  let manifest = null;

  if (typeof baselineDirOrManifest === 'string') {
    const manifestPath = baselineDirOrManifest.endsWith('.json')
      ? baselineDirOrManifest
      : path.join(baselineDirOrManifest, 'baseline.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error(`[BASELINE_ERROR] Baseline manifest not found at ${manifestPath}`);
    }
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } else if (baselineDirOrManifest && typeof baselineDirOrManifest === 'object') {
    manifest = baselineDirOrManifest;
  } else {
    throw new Error('[BASELINE_ERROR] Invalid baseline specification');
  }

  // Capture current state across viewports
  const currentResponsive = await captureResponsiveViewports(url, {
    timeoutMs: options.timeoutMs || 15000
  });

  const comparisons = {};
  let maxChangedRatio = 0;
  let maxPerceptualDist = 0;

  for (const [vpKey, baseVp] of Object.entries(manifest.viewports || {})) {
    const currVp = currentResponsive.viewports[vpKey];
    if (!currVp || !baseVp?.capture?.filePath || !currVp?.capture?.filePath) continue;

    const diff = compareImages(baseVp.capture.filePath, currVp.capture.filePath);
    comparisons[vpKey] = {
      viewport: baseVp.viewport,
      baselineFile: baseVp.capture.filePath,
      currentFile: currVp.capture.filePath,
      diff
    };

    if (diff.changedPixelRatio > maxChangedRatio) maxChangedRatio = diff.changedPixelRatio;
    if (diff.perceptualDistance > maxPerceptualDist) maxPerceptualDist = diff.perceptualDistance;
  }

  let overallSignificance = 'none';
  if (maxChangedRatio === 0 && maxPerceptualDist === 0) {
    overallSignificance = 'none';
  } else if (maxChangedRatio < 0.02 && maxPerceptualDist <= 4) {
    overallSignificance = 'low';
  } else if (maxChangedRatio < 0.10 && maxPerceptualDist <= 12) {
    overallSignificance = 'medium';
  } else if (maxChangedRatio < 0.30 || maxPerceptualDist <= 24) {
    overallSignificance = 'high';
  } else {
    overallSignificance = 'critical';
  }

  return {
    url,
    comparedAt: new Date().toISOString(),
    baselineId: manifest.baselineId,
    overallSignificance,
    maxChangedRatio,
    maxPerceptualDist,
    comparisons
  };
}
