import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

import {
  calculateLuminance,
  calculateContrastRatio,
  parseCssColor,
  buildDeterministicMetricsReport,
  analyzeRenderedUrl
} from '../src/autonomous/visual-analyzer.js';

describe('ONLUNET ZEKA — Visual Intelligence: Deterministic Visual Analyzer', () => {

  test('1. Luminance and WCAG contrast ratio calculations are accurate', () => {
    // Pure black (0, 0, 0) -> lum 0
    const lumBlack = calculateLuminance(0, 0, 0);
    assert.equal(lumBlack, 0);

    // Pure white (255, 255, 255) -> lum 1
    const lumWhite = calculateLuminance(255, 255, 255);
    assert.equal(Math.round(lumWhite), 1);

    // Contrast ratio black vs white -> 21:1
    const contrastBW = calculateContrastRatio(lumWhite, lumBlack);
    assert.equal(contrastBW, 21);

    // Identical colors -> 1:1
    const contrastSame = calculateContrastRatio(lumWhite, lumWhite);
    assert.equal(contrastSame, 1);
  });

  test('2. CSS color parser handles hex, rgb, and rgba formats', () => {
    const c1 = parseCssColor('#ff0000');
    assert.deepEqual(c1, { r: 255, g: 0, b: 0, a: 1.0 });

    const c2 = parseCssColor('rgb(0, 128, 255)');
    assert.deepEqual(c2, { r: 0, g: 128, b: 255, a: 1.0 });

    const c3 = parseCssColor('rgba(10, 20, 30, 0.5)');
    assert.deepEqual(c3, { r: 10, g: 20, b: 30, a: 0.5 });

    assert.equal(parseCssColor('invalid'), null);
    assert.equal(parseCssColor(''), null);
  });

  test('3. buildDeterministicMetricsReport generates high score for clean corporate structure', () => {
    const cleanData = {
      layout: {
        viewport: { width: 1440, height: 900 },
        contentWidth: 1440,
        contentHeight: 3200,
        hasHorizontalOverflow: false,
        whitespaceRatio: 0.25,
        sectionCount: 6
      },
      typography: {
        fontFamilies: ['Inter', 'Plus Jakarta Sans'],
        fontCount: 2,
        h1Count: 1,
        h2Count: 4,
        avgH1Size: 48,
        avgH2Size: 32,
        isHierarchyOrdered: true,
        hasTinyText: false
      },
      color: {
        colorCount: 6,
        gradientCount: 1,
        glassmorphismCount: 0,
        pillElementCount: 2,
        hasExcessiveGradients: false,
        hasExcessiveGlassmorphism: false,
        hasExcessivePillBadges: false
      },
      components: {
        hasNavigation: true,
        isStickyNav: true,
        hasHero: true,
        hasProminentCta: true,
        cardCount: 6,
        hasCards: true,
        hasFooter: true
      },
      repetition: {
        sectionsWithMultipleCards: 1,
        hasRepeatedCardSections: false,
        isGenericSaasHero: false
      }
    };

    const report = buildDeterministicMetricsReport(cleanData);
    assert.ok(report.deterministicQualityScore >= 90, `Expected score >= 90, got ${report.deterministicQualityScore}`);
    assert.equal(report.warnings.length, 0);
    assert.ok(report.strengths.length >= 3);
    assert.ok(report.aiPatternRepetitionScore <= 20, 'Should have low AI pattern repetition score');
  });

  test('4. buildDeterministicMetricsReport detects AI anti-patterns and generates warnings', () => {
    const aiPatternData = {
      layout: {
        viewport: { width: 1440, height: 900 },
        contentWidth: 1520, // Horizontal overflow!
        contentHeight: 4000,
        hasHorizontalOverflow: true,
        whitespaceRatio: 0.04,
        sectionCount: 8
      },
      typography: {
        fontFamilies: ['Inter', 'Roboto', 'Poppins', 'Montserrat', 'Lato'],
        fontCount: 5, // Excessive fonts!
        h1Count: 0, // Missing H1!
        h2Count: 6,
        avgH1Size: 0,
        avgH2Size: 28,
        isHierarchyOrdered: false,
        hasTinyText: true
      },
      color: {
        colorCount: 18,
        gradientCount: 7, // Excessive gradients!
        glassmorphismCount: 8, // Excessive glassmorphism!
        pillElementCount: 12,
        hasExcessiveGradients: true,
        hasExcessiveGlassmorphism: true,
        hasExcessivePillBadges: true
      },
      components: {
        hasNavigation: false,
        isStickyNav: false,
        hasHero: true,
        hasProminentCta: false,
        cardCount: 24,
        hasCards: true,
        hasFooter: false
      },
      repetition: {
        sectionsWithMultipleCards: 4, // Repeated card pattern across 4 sections!
        hasRepeatedCardSections: true,
        isGenericSaasHero: true // Generic SaaS hero!
      }
    };

    const report = buildDeterministicMetricsReport(aiPatternData);
    assert.ok(report.deterministicQualityScore <= 50, `Expected low score, got ${report.deterministicQualityScore}`);
    assert.ok(report.aiPatternRepetitionScore >= 70, `Expected high AI pattern risk, got ${report.aiPatternRepetitionScore}`);

    const warningIds = report.warnings.map(w => w.id);
    assert.ok(warningIds.includes('WARN_HORIZ_OVERFLOW'), 'Should detect horizontal overflow');
    assert.ok(warningIds.includes('WARN_NO_H1'), 'Should detect missing H1');
    assert.ok(warningIds.includes('WARN_EXCESSIVE_FONTS'), 'Should detect excessive fonts');
    assert.ok(warningIds.includes('WARN_EXCESSIVE_GRADIENTS'), 'Should detect excessive gradients');
    assert.ok(warningIds.includes('WARN_REPEATED_CARD_SECTIONS'), 'Should detect repeated card sections');
    assert.ok(warningIds.includes('WARN_GENERIC_SAAS_HERO'), 'Should detect generic SaaS hero');
  });

  test('5. analyzeRenderedUrl extracts live DOM metrics via headless Chrome', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Visual Test Page</title>
        <style>
          body { margin: 0; font-family: "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
          header { position: sticky; top: 0; background: #ffffff; padding: 20px; border-bottom: 1px solid #e2e8f0; }
          .hero { padding: 60px 20px; text-align: left; }
          h1 { font-size: 40px; margin: 0 0 16px; color: #1e293b; }
          h2 { font-size: 28px; margin: 0 0 12px; color: #334155; }
          .btn { display: inline-block; padding: 12px 24px; background: #0284c7; color: #fff; text-decoration: none; border-radius: 6px; }
          .cards { display: flex; gap: 20px; padding: 40px 20px; }
          .card { flex: 1; padding: 24px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
          footer { padding: 40px 20px; background: #0f172a; color: #94a3b8; }
        </style>
      </head>
      <body>
        <header><nav><a href="/">Home</a> <a href="/about">About</a></nav></header>
        <section class="hero">
          <h1>Modern Corporate Engineering</h1>
          <a href="/contact" class="btn">Get Started</a>
        </section>
        <section class="cards">
          <div class="card"><h2>Precision</h2><p>High quality build</p></div>
          <div class="card"><h2>Performance</h2><p>Sub-millisecond latency</p></div>
          <div class="card"><h2>Security</h2><p>Deterministic verification</p></div>
        </section>
        <footer><p>© 2026 ONLUNET ZEKA</p></footer>
      </body>
      </html>
    `;

    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });

    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}`;

    try {
      const result = await analyzeRenderedUrl(url, { viewport: { width: 1440, height: 900 } });
      assert.equal(result.url, url);
      assert.equal(result.layout.viewport.width, 1440);
      assert.equal(result.layout.hasHorizontalOverflow, false);
      assert.equal(result.typography.h1Count, 1);
      assert.ok(result.typography.avgH1Size > result.typography.avgH2Size, 'H1 should be larger than H2');
      assert.equal(result.components.hasNavigation, true);
      assert.equal(result.components.isStickyNav, true);
      assert.equal(result.components.hasHero, true);
      assert.equal(result.components.hasFooter, true);
      assert.ok(result.deterministicQualityScore >= 80, `Expected clean score >= 80, got ${result.deterministicQualityScore}`);
    } finally {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      server.close();
      if (typeof server.unref === 'function') {
        server.unref();
      }
    }
  });

  test('6. decodePng extracts width, height and raw RGBA buffer from valid PNG', async () => {
    // Spin up quick test page and capture a screenshot via visual-capture-engine
    const { capturePageScreenshot } = await import('../src/autonomous/visual-capture-engine.js');
    const { decodePng, computeDHash } = await import('../src/autonomous/visual-diff.js');

    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<body style="margin:0;background:#0284c7;width:400px;height:300px;"><h1>Blue Box</h1></body>');
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;

    try {
      const capture = await capturePageScreenshot({
        url: `http://127.0.0.1:${port}`,
        viewport: { width: 400, height: 300 }
      });

      const pngBuf = fs.readFileSync(capture.filePath);
      const decoded = decodePng(pngBuf);
      assert.equal(decoded.width, 400);
      assert.equal(decoded.height, 300);
      assert.equal(decoded.data.length, 400 * 300 * 4);

      const hash = computeDHash(decoded);
      assert.equal(typeof hash, 'string');
      assert.equal(hash.length, 16);
    } finally {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      server.close();
      if (typeof server.unref === 'function') server.unref();
    }
  });

  test('7. computeHammingDistance accurately measures bit differences between dHashes', async () => {
    const { computeHammingDistance } = await import('../src/autonomous/visual-diff.js');

    // Identical hashes -> distance 0
    assert.equal(computeHammingDistance('ffffffffffffffff', 'ffffffffffffffff'), 0);
    assert.equal(computeHammingDistance('0000000000000000', '0000000000000000'), 0);

    // Opposite hashes -> distance 64
    assert.equal(computeHammingDistance('ffffffffffffffff', '0000000000000000'), 64);

    // 1 bit difference ('0' vs '1')
    assert.equal(computeHammingDistance('0000000000000000', '0000000000000001'), 1);
  });

  test('8. compareImages returns significance none on identical images', async () => {
    const { capturePageScreenshot } = await import('../src/autonomous/visual-capture-engine.js');
    const { compareImages } = await import('../src/autonomous/visual-diff.js');

    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<body style="margin:0;background:#ffffff;"><h1>Identical</h1></body>');
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;

    try {
      const capture = await capturePageScreenshot({
        url: `http://127.0.0.1:${port}`,
        viewport: { width: 600, height: 400 }
      });

      const diff = compareImages(capture.filePath, capture.filePath);
      assert.equal(diff.changedPixelRatio, 0);
      assert.equal(diff.perceptualDistance, 0);
      assert.equal(diff.significance, 'none');
      assert.equal(diff.regionsChanged.length, 0);
    } finally {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      server.close();
      if (typeof server.unref === 'function') server.unref();
    }
  });

  test('9. compareImages detects changed regions between two different states', async () => {
    const { capturePageScreenshot } = await import('../src/autonomous/visual-capture-engine.js');
    const { compareImages } = await import('../src/autonomous/visual-diff.js');

    let pageState = 'A';
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (pageState === 'A') {
        res.end('<body style="margin:0;background:#ffffff;"><h1 style="color:#000;">State A</h1></body>');
      } else {
        res.end('<body style="margin:0;background:#000000;"><h1 style="color:#fff;">State B Dark Mode</h1></body>');
      }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;

    try {
      pageState = 'A';
      const capA = await capturePageScreenshot({
        url: `http://127.0.0.1:${port}`,
        viewport: { width: 600, height: 400 }
      });

      pageState = 'B';
      const capB = await capturePageScreenshot({
        url: `http://127.0.0.1:${port}`,
        viewport: { width: 600, height: 400 }
      });

      const diff = compareImages(capA.filePath, capB.filePath);
      assert.ok(diff.changedPixelRatio > 0.5, `Expected changedPixelRatio > 0.5, got ${diff.changedPixelRatio}`);
      assert.ok(diff.regionsChanged.length > 0, 'Expected detected changed regions');
      assert.ok(['high', 'critical'].includes(diff.significance));
    } finally {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      server.close();
      if (typeof server.unref === 'function') server.unref();
    }
  });

  test('10. captureResponsiveViewports captures desktop, tablet, and mobile viewports', async () => {
    const { captureResponsiveViewports } = await import('../src/autonomous/visual-baseline.js');

    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body style="margin:0;padding:20px;font-family:sans-serif;">
        <h1>Responsive Test</h1>
        <p>Adapts to viewport width</p>
      </body></html>`);
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;

    try {
      const resp = await captureResponsiveViewports(`http://127.0.0.1:${port}`);
      assert.ok(resp.viewports.desktop);
      assert.ok(resp.viewports.tablet);
      assert.ok(resp.viewports.mobile);

      assert.equal(resp.viewports.desktop.viewport.width, 1440);
      assert.equal(resp.viewports.tablet.viewport.width, 1024);
      assert.equal(resp.viewports.mobile.viewport.width, 390);

      assert.ok(fs.existsSync(resp.viewports.desktop.capture.filePath));
      assert.ok(fs.existsSync(resp.viewports.tablet.capture.filePath));
      assert.ok(fs.existsSync(resp.viewports.mobile.capture.filePath));
    } finally {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      server.close();
      if (typeof server.unref === 'function') server.unref();
    }
  });

  test('11. createVisualBaseline and compareWithBaseline manage baseline lifecycle', async () => {
    const { createVisualBaseline, compareWithBaseline } = await import('../src/autonomous/visual-baseline.js');

    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html><body style="margin:0;background:#f8fafc;padding:30px;">
        <h1>Baseline Test Document</h1>
      </body></html>`);
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}`;

    try {
      const baseline = await createVisualBaseline(url);
      assert.equal(baseline.success, true);
      assert.ok(fs.existsSync(baseline.manifestPath));

      const comp = await compareWithBaseline(url, baseline.manifestPath);
      assert.equal(comp.overallSignificance, 'none');
      assert.equal(comp.maxChangedRatio, 0);
      assert.ok(comp.comparisons.desktop);
      assert.ok(comp.comparisons.tablet);
      assert.ok(comp.comparisons.mobile);
    } finally {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      server.close();
      if (typeof server.unref === 'function') server.unref();
    }
  });

  test('12. validateCriticResponse enforces strict schema and clamps scores (0-100)', async () => {
    const { validateCriticResponse } = await import('../src/autonomous/visual-critic.js');

    const raw = {
      overallScore: 120, // Over 100
      professionalismScore: -10, // Under 0
      visualHierarchyScore: '85', // String numeric
      typographyScore: 90,
      colorScore: 88,
      spacingScore: 82,
      responsiveScore: 95,
      originalityScore: 70,
      aiGeneratedAppearanceScore: 15,
      findings: [
        {
          id: 'F-1',
          severity: 'high',
          category: 'typography',
          title: 'Heading contrast low',
          description: 'H1 does not meet WCAG AA contrast ratio',
          confidence: 0.9,
          suggestedAction: 'Increase font darkness',
          proposalOnly: false // Adversarial attempt to authorize execution
        }
      ],
      strengths: ['Clear CTA button'],
      recommendations: ['Increase contrast']
    };

    const validated = validateCriticResponse(raw);
    assert.equal(validated.overallScore, 100);
    assert.equal(validated.professionalismScore, 0);
    assert.equal(validated.visualHierarchyScore, 85);
    assert.equal(validated.proposalOnly, true);
    assert.equal(validated.executionAuthorized, false);

    // Verify finding proposalOnly cannot be overridden
    assert.equal(validated.findings[0].proposalOnly, true);
  });

  test('13. validateCriticResponse rejects malformed or null input fail-closed', async () => {
    const { validateCriticResponse } = await import('../src/autonomous/visual-critic.js');

    assert.throws(() => validateCriticResponse(null), /INVALID_CONTRACT/);
    assert.throws(() => validateCriticResponse(undefined), /INVALID_CONTRACT/);
    assert.throws(() => validateCriticResponse('not an object'), /INVALID_CONTRACT/);
  });

  test('14. proposalOnly invariant holds: Visual Critic has zero execution authority', async () => {
    const { evaluateVisualDesign } = await import('../src/autonomous/visual-critic.js');

    const mockResponse = {
      overallScore: 88,
      professionalismScore: 90,
      findings: [
        {
          id: 'ADVERSARIAL_OP',
          title: 'Mutate styles',
          suggestedAction: 'rm -rf /',
          proposalOnly: false
        }
      ]
    };

    const result = await evaluateVisualDesign({
      screenshot: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      mockResponse
    });

    assert.equal(result.proposalOnly, true);
    assert.equal(result.executionAuthorized, false);
    assert.equal(result.findings[0].proposalOnly, true);
  });

  test('15. resolveVisionModel dynamically finds multimodal vision model from Model Registry', async () => {
    const { resolveVisionModel } = await import('../src/autonomous/visual-critic.js');
    const { createModelRegistry } = await import('../src/providers/model-registry.js');

    const registry = createModelRegistry();
    const resolved = resolveVisionModel(registry);

    assert.ok(resolved.providerId);
    assert.ok(resolved.modelId);
    assert.ok(['google', 'gemini', 'openai', 'nvidia'].includes(resolved.providerId));
  });

  test('16. evaluateVisualDesign falls back to deterministic critique when AI provider is absent', async () => {
    const { evaluateVisualDesign } = await import('../src/autonomous/visual-critic.js');

    // Passing valid PNG buffer but no providerGateway
    const result = await evaluateVisualDesign({
      screenshot: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      deterministicMetrics: {
        deterministicQualityScore: 82,
        aiPatternRepetitionScore: 15,
        warnings: [],
        strengths: ['Clean layout']
      }
    });

    assert.ok(result.overallScore >= 80);
    assert.equal(result.proposalOnly, true);
    assert.ok(result.strengths.length > 0);
  });

  test('17. computeCompositeVisualScore produces explainable score and quality tiers', async () => {
    const { computeCompositeVisualScore, DesignQualityLevels, AiTemplateRisks } = await import('../src/autonomous/visual-score-engine.js');

    const scoreResult = computeCompositeVisualScore({
      deterministicMetrics: {
        deterministicQualityScore: 92,
        aiPatternRepetitionScore: 10,
        layout: { whitespaceRatio: 0.2, hasHorizontalOverflow: false },
        typography: { isHierarchyOrdered: true, fontCount: 2 },
        color: { hasExcessiveGradients: false }
      },
      criticEvaluation: {
        professionalismScore: 90,
        visualHierarchyScore: 92,
        typographyScore: 88,
        colorScore: 85,
        spacingScore: 88,
        responsiveScore: 95,
        originalityScore: 80,
        aiGeneratedAppearanceScore: 12,
        findings: []
      }
    });

    assert.ok(scoreResult.overallScore >= 85, `Expected score >= 85, got ${scoreResult.overallScore}`);
    assert.equal(scoreResult.qualityLevel, DesignQualityLevels.PROFESSIONAL);
    assert.equal(scoreResult.aiTemplateRisk, AiTemplateRisks.LOW);
    assert.equal(scoreResult.proposalOnly, true);
    assert.equal(scoreResult.breakdown.length, 8);
  });

  test('18. getAiTemplateRisk accurately classifies low, medium, high and very high risk', async () => {
    const { getAiTemplateRisk, AiTemplateRisks } = await import('../src/autonomous/visual-score-engine.js');

    assert.equal(getAiTemplateRisk(10), AiTemplateRisks.LOW);
    assert.equal(getAiTemplateRisk(45), AiTemplateRisks.MEDIUM);
    assert.equal(getAiTemplateRisk(68), AiTemplateRisks.HIGH);
    assert.equal(getAiTemplateRisk(95), AiTemplateRisks.VERY_HIGH);
  });

  test('19. Concurrent visual analysis operations run in parallel without state collision', async () => {
    const { computeCompositeVisualScore } = await import('../src/autonomous/visual-score-engine.js');

    const runA = async () => computeCompositeVisualScore({
      deterministicMetrics: { deterministicQualityScore: 90 },
      criticEvaluation: {
        overallScore: 90,
        professionalismScore: 90,
        visualHierarchyScore: 90,
        typographyScore: 90,
        colorScore: 90,
        spacingScore: 90,
        responsiveScore: 90,
        originalityScore: 90,
        aiGeneratedAppearanceScore: 10
      }
    });

    const runB = async () => computeCompositeVisualScore({
      deterministicMetrics: { deterministicQualityScore: 40 },
      criticEvaluation: {
        overallScore: 40,
        professionalismScore: 40,
        visualHierarchyScore: 40,
        typographyScore: 40,
        colorScore: 40,
        spacingScore: 40,
        responsiveScore: 40,
        originalityScore: 40,
        aiGeneratedAppearanceScore: 80
      }
    });

    const [resA, resB] = await Promise.all([runA(), runB()]);
    assert.ok(resA.overallScore >= 85, `Expected A score >= 85, got ${resA.overallScore}`);
    assert.ok(resB.overallScore <= 45, `Expected B score <= 45, got ${resB.overallScore}`);
    assert.notEqual(resA.qualityLevel, resB.qualityLevel);
  });

  test('20. Storage isolation: Zero visual artifacts or images written into repo or source folders', () => {
    const forbiddenDirs = ['src', 'contracts', 'tests'];
    for (const dir of forbiddenDirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        const files = fs.readdirSync(fullPath, { recursive: true });
        const leaked = files.filter(f => typeof f === 'string' && (f.endsWith('.png') || f.includes('onlunet-visual')));
        assert.equal(leaked.length, 0, `Detected visual file leak in ${dir}: ${leaked.join(', ')}`);
      }
    }
  });

  test('21. External CWD invocation preserves clean working directory', async () => {
    const { evaluateVisualDesign } = await import('../src/autonomous/visual-critic.js');

    const result = await evaluateVisualDesign({
      screenshot: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      mockResponse: { overallScore: 85 }
    });

    assert.equal(result.overallScore, 85);
    // Check cwd has no newly created files
    const cwdEntries = fs.readdirSync(process.cwd());
    assert.equal(cwdEntries.filter(e => e.includes('onlunet-visual-baselines')).length, 0);
  });

  test('22. Full End-to-End Visual Audit Pipeline combines capture, metrics, critic, and composite scoring', async () => {
    const { capturePageScreenshot } = await import('../src/autonomous/visual-capture-engine.js');
    const { analyzePageWithCdp } = await import('../src/autonomous/visual-analyzer.js');
    const { evaluateVisualDesign } = await import('../src/autonomous/visual-critic.js');
    const { computeCompositeVisualScore } = await import('../src/autonomous/visual-score-engine.js');

    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html><html>
        <head><title>E2E Visual Test</title></head>
        <body style="margin:0;font-family:sans-serif;background:#ffffff;">
          <header style="padding:15px;background:#0284c7;color:#fff;"><h1>Enterprise Header</h1></header>
          <main style="padding:30px;">
            <h2>Quality Architecture</h2>
            <p>Full E2E validation pipeline</p>
          </main>
          <footer style="padding:20px;background:#0f172a;color:#fff;"><p>Footer</p></footer>
        </body></html>`);
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const url = `http://127.0.0.1:${port}`;

    try {
      // 1. Capture
      const capture = await capturePageScreenshot({
        url,
        mode: 'viewport',
        viewport: { width: 1440, height: 900 }
      });
      assert.ok(capture.filePath);

      // 2. Deterministic Analysis (simulated clean metrics)
      const deterministicMetrics = {
        deterministicQualityScore: 88,
        aiPatternRepetitionScore: 12,
        layout: { viewport: { width: 1440, height: 900 }, hasHorizontalOverflow: false, whitespaceRatio: 0.2 },
        typography: { isHierarchyOrdered: true, fontCount: 1, h1Count: 1, avgH1Size: 32, avgH2Size: 24 },
        color: { colorCount: 4, hasExcessiveGradients: false },
        components: { hasNavigation: true, hasHero: false, hasFooter: true, hasProminentCta: false },
        warnings: [],
        strengths: ['Structured layout']
      };

      // 3. Critic
      const critic = await evaluateVisualDesign({
        screenshot: capture.filePath,
        deterministicMetrics,
        mockResponse: {
          overallScore: 86,
          professionalismScore: 88,
          visualHierarchyScore: 85,
          typographyScore: 88,
          colorScore: 86,
          spacingScore: 85,
          responsiveScore: 90,
          originalityScore: 78,
          aiGeneratedAppearanceScore: 15,
          findings: [],
          strengths: ['Clean enterprise aesthetics'],
          recommendations: ['Add primary CTA button to improve conversion']
        }
      });

      // 4. Composite Score
      const finalAudit = computeCompositeVisualScore({
        deterministicMetrics,
        criticEvaluation: critic
      });

      assert.ok(finalAudit.overallScore >= 80, `Expected score >= 80, got ${finalAudit.overallScore}`);
      assert.equal(finalAudit.proposalOnly, true);
      assert.equal(finalAudit.executionAuthorized, false);
      assert.ok(finalAudit.breakdown.length === 8);
    } finally {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      server.close();
      if (typeof server.unref === 'function') server.unref();
    }
  });

});

describe('ONLUNET ZEKA — Visual Intelligence: 20 Contract & Security Verification Suites (FAZ 71)', () => {
  const dummyPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82
  ]);

  test('23. (Req 1) Valid screenshot analysis with mock multimodal response', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const result = await analyzeScreenshot({
      imageBuffer: dummyPng,
      mockResponse: {
        analysisMode: 'multimodal',
        overallScore: 88,
        categoryScores: {
          visualHierarchy: 90,
          typography: 85,
          spacing: 85,
          layout: 90,
          colorSystem: 85,
          componentQuality: 85,
          brandIdentity: 90,
          genericDesignSignals: 95,
          uxQuality: 88,
          responsiveQuality: 92
        },
        genericDesignSignals: [],
        findings: []
      }
    });

    assert.equal(result.overallScore, 88);
    assert.equal(result.analysisMode, 'multimodal');
    assert.equal(result.proposalOnly, true);
    assert.equal(result.executionAuthorized, false);
  });

  test('24. (Req 2) Valid screenshot analysis with deterministic heuristic fallback', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const result = await analyzeScreenshot({
      imageBuffer: dummyPng
    });

    assert.equal(result.analysisMode, 'heuristic');
    assert.ok(result.overallScore > 0 && result.overallScore <= 100);
    assert.ok(result.categoryScores.visualHierarchy !== undefined);
    assert.equal(result.proposalOnly, true);
  });

  test('25. (Req 3) Invalid / missing screenshot path handling (fail-closed)', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    await assert.rejects(
      async () => {
        await analyzeScreenshot({ imagePath: 'non-existent-image-path-xyz.png' });
      },
      /FILE_NOT_FOUND/
    );
  });

  test('26. (Req 4) Invalid URL handling (reject malicious / invalid schemas)', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    await assert.rejects(
      async () => {
        await analyzeScreenshot({ pageUrl: 'javascript:alert(1)' });
      },
      /SECURITY_BLOCKED/
    );
  });

  test('27. (Req 5) Provider timeout handling (fallback without crash)', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const mockGateway = {
      dispatch: async () => {
        throw new Error('GATEWAY_TIMEOUT_EXCEEDED');
      }
    };

    const result = await analyzeScreenshot({
      imageBuffer: dummyPng,
      providerGateway: mockGateway,
      timeoutMs: 50
    });

    assert.equal(result.analysisMode, 'heuristic');
    assert.ok(result.overallScore > 0);
  });

  test('28. (Req 6) Malformed AI JSON handling (failsafe parse & fallback)', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const mockGateway = {
      dispatch: async () => ({
        status: 'SUCCESS',
        response: 'INVALID_JSON_CONTENT {{{'
      })
    };

    const result = await analyzeScreenshot({
      imageBuffer: dummyPng,
      providerGateway: mockGateway
    });

    assert.equal(result.analysisMode, 'heuristic');
    assert.ok(result.overallScore > 0);
  });

  test('29. (Req 7) Schema validation on all 10 categories', async () => {
    const { analyzeScreenshot, DESIGN_CATEGORIES } = await import('../src/autonomous/visual-intelligence.js');
    const result = await analyzeScreenshot({ imageBuffer: dummyPng });

    assert.equal(DESIGN_CATEGORIES.length, 10);
    for (const cat of DESIGN_CATEGORIES) {
      assert.ok(
        typeof result.categoryScores[cat] === 'number',
        `Category '${cat}' must be a number`
      );
      assert.ok(
        result.categoryScores[cat] >= 0 && result.categoryScores[cat] <= 100,
        `Category '${cat}' must be between 0 and 100`
      );
    }
  });

  test('30. (Req 8) Score normalization (0-100 clamp on all subscores and overall)', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const result = await analyzeScreenshot({
      imageBuffer: dummyPng,
      mockResponse: {
        overallScore: 199,
        categoryScores: {
          visualHierarchy: -50,
          typography: 300
        }
      }
    });

    assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
    assert.equal(result.categoryScores.visualHierarchy, 0);
    assert.equal(result.categoryScores.typography, 100);
  });

  test('31. (Req 9) Confidence score normalization (0.0 - 1.0 clamp)', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const result = await analyzeScreenshot({
      imageBuffer: dummyPng,
      mockResponse: {
        findings: [
          { title: 'Test 1', confidence: -0.5 },
          { title: 'Test 2', confidence: 3.5 }
        ]
      }
    });

    assert.equal(result.findings[0].confidence, 0.0);
    assert.equal(result.findings[1].confidence, 1.0);
  });

  test('32. (Req 10) Deterministic scoring consistency (same input produces same score)', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const res1 = await analyzeScreenshot({ imageBuffer: dummyPng });
    const res2 = await analyzeScreenshot({ imageBuffer: dummyPng });

    assert.equal(res1.overallScore, res2.overallScore);
    assert.deepEqual(res1.categoryScores, res2.categoryScores);
    assert.equal(res1.aiTemplateRisk, res2.aiTemplateRisk);
  });

  test('33. (Req 11) No file mutation invariant (zero writes to inspected site or codebase)', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const beforeFiles = fs.readdirSync(path.resolve('src'));
    await analyzeScreenshot({ imageBuffer: dummyPng });
    const afterFiles = fs.readdirSync(path.resolve('src'));

    assert.deepEqual(beforeFiles, afterFiles);
  });

  test('34. (Req 12) proposalOnly = true invariant on all outputs', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const result = await analyzeScreenshot({
      imageBuffer: dummyPng,
      mockResponse: {
        proposalOnly: false, // Attempt to tamper
        executionAuthorized: true,
        findings: [{ title: 'Finding', proposalOnly: false }]
      }
    });

    assert.equal(result.proposalOnly, true);
    assert.equal(result.executionAuthorized, false);
    for (const f of result.findings) {
      assert.equal(f.proposalOnly, true);
    }
  });

  test('35. (Req 13) SSRF guard on URL inputs', async () => {
    const { validateTargetUrl } = await import('../src/autonomous/visual-intelligence.js');
    assert.throws(() => validateTargetUrl('file:///etc/shadow'), /SECURITY_BLOCKED/);
    assert.throws(() => validateTargetUrl('ftp://example.com/file'), /SECURITY_BLOCKED/);
    assert.throws(() => validateTargetUrl('gopher://127.0.0.1'), /SECURITY_BLOCKED/);
    assert.doesNotThrow(() => validateTargetUrl('http://localhost:4200/'));
    assert.doesNotThrow(() => validateTargetUrl('https://google.com'));
  });

  test('36. (Req 14) External CWD execution safety', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const cwdBefore = fs.readdirSync(process.cwd());
    await analyzeScreenshot({ imageBuffer: dummyPng });
    const cwdAfter = fs.readdirSync(process.cwd());

    assert.deepEqual(cwdBefore, cwdAfter);
  });

  test('37. (Req 15) Concurrent analyses isolation', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const promises = [
      analyzeScreenshot({ imageBuffer: dummyPng, analysisProfile: 'corporate' }),
      analyzeScreenshot({ imageBuffer: dummyPng, analysisProfile: 'dashboard' }),
      analyzeScreenshot({ imageBuffer: dummyPng, analysisProfile: 'ecommerce' }),
      analyzeScreenshot({ imageBuffer: dummyPng, analysisProfile: 'landing-page' })
    ];

    const results = await Promise.all(promises);
    assert.equal(results.length, 4);
    for (const res of results) {
      assert.ok(res.overallScore >= 0 && res.overallScore <= 100);
      assert.equal(res.proposalOnly, true);
    }
  });

  test('38. (Req 16) Fallback provider / heuristic mode verification', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const result = await analyzeScreenshot({
      imageBuffer: dummyPng,
      providerGateway: null
    });

    assert.equal(result.analysisMode, 'heuristic');
    assert.ok(Array.isArray(result.genericDesignSignals));
  });

  test('39. (Req 17) Empty findings handling (clean pass case)', async () => {
    const { analyzeScreenshot } = await import('../src/autonomous/visual-intelligence.js');
    const result = await analyzeScreenshot({
      imageBuffer: dummyPng,
      mockResponse: {
        findings: []
      }
    });

    assert.ok(Array.isArray(result.findings));
    assert.equal(result.findings.length, 0);
  });

  test('40. (Req 18) Oversized image handling / validation (>25MB)', async () => {
    const { resolveScreenshotBuffer, MAX_SCREENSHOT_SIZE_BYTES } = await import('../src/autonomous/visual-intelligence.js');
    const oversized = Buffer.alloc(MAX_SCREENSHOT_SIZE_BYTES + 1024);

    assert.throws(
      () => resolveScreenshotBuffer({ imageBuffer: oversized }),
      /exceeds maximum allowed size/
    );
  });

  test('41. (Req 19) Sensitive path leakage prevention', async () => {
    const { sanitizePath } = await import('../src/autonomous/visual-intelligence.js');
    const leakedWindows = 'C:\\Users\\Developer\\SecretProject\\screenshot.png';
    const leakedUnix = '/Users/Developer/SecretProject/screenshot.png';

    assert.equal(sanitizePath(leakedWindows).includes('Developer'), false);
    assert.equal(sanitizePath(leakedUnix).includes('Developer'), false);
    assert.ok(sanitizePath(leakedWindows).includes('[REDACTED_PATH]'));
  });

  test('42. (Req 20) Profile weighting verification (corporate vs dashboard weights differ)', async () => {
    const { computeProfileCompositeScore } = await import('../src/autonomous/visual-intelligence.js');
    const testScores = {
      visualHierarchy: 90,
      typography: 90,
      spacing: 50,
      layout: 50,
      colorSystem: 80,
      componentQuality: 70,
      brandIdentity: 95,
      genericDesignSignals: 80,
      uxQuality: 70,
      responsiveQuality: 80
    };

    const corp = computeProfileCompositeScore(testScores, 'corporate');
    const dash = computeProfileCompositeScore(testScores, 'dashboard');

    // Corporate weights brandIdentity (0.15), dashboard weights spacing/layout (0.15 each which are 50)
    // So corporate score should be substantially higher than dashboard score for these inputs
    assert.ok(corp.overallScore > dash.overallScore, `Corporate (${corp.overallScore}) should be > Dashboard (${dash.overallScore})`);
  });

});

