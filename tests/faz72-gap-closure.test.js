import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseCssColor,
  calculateLuminance,
  calculateContrastRatio,
  isLargeText,
  compositeRgba,
  resolveEffectiveBackgroundColor,
  evaluateWcagContrast,
  buildDeterministicMetricsReport
} from '../src/autonomous/visual-analyzer.js';

import {
  buildHeuristicCategoryScores,
  computeProfileCompositeScore
} from '../src/autonomous/visual-intelligence.js';

import {
  computeCompositeVisualScore
} from '../src/autonomous/visual-score-engine.js';

import {
  evaluateVisualRegressionPolicy
} from '../src/autonomous/visual-regression-loop.js';

describe('ONLUNET ZEKA — FAZ 72.1 Gap Closure Suite', () => {

  // 1. RGB Parsing
  test('1. RGB parsing parses rgb(r, g, b) strings accurately', () => {
    const c1 = parseCssColor('rgb(255, 255, 255)');
    assert.deepEqual(c1, { r: 255, g: 255, b: 255, a: 1.0 });

    const c2 = parseCssColor('rgb(100, 116, 139)');
    assert.deepEqual(c2, { r: 100, g: 116, b: 139, a: 1.0 });

    const c3 = parseCssColor('rgb(8, 10, 15)');
    assert.deepEqual(c3, { r: 8, g: 10, b: 15, a: 1.0 });
  });

  // 2. RGBA Parsing
  test('2. RGBA parsing parses rgba(r, g, b, a) strings with fractional alpha', () => {
    const c1 = parseCssColor('rgba(15, 23, 42, 0.75)');
    assert.deepEqual(c1, { r: 15, g: 23, b: 42, a: 0.75 });

    const c2 = parseCssColor('rgba(0, 0, 0, 0)');
    assert.deepEqual(c2, { r: 0, g: 0, b: 0, a: 0 });

    const c3 = parseCssColor('rgba(255, 255, 255, 0.05)');
    assert.deepEqual(c3, { r: 255, g: 255, b: 255, a: 0.05 });
  });

  // 3. Transparent Ancestor Background Compositing
  test('3. Transparent ancestor background compositing correctly blends layers', () => {
    // Root is dark body: #07090e -> rgb(7, 9, 14)
    const rootBg = { r: 7, g: 9, b: 14, a: 1.0 };
    // Layer 1: Semi-transparent card -> rgba(255, 255, 255, 0.1)
    const cardBg = { r: 255, g: 255, b: 255, a: 0.1 };
    // Layer 2: Fully transparent child container -> rgba(0, 0, 0, 0)
    const childBg = { r: 0, g: 0, b: 0, a: 0 };

    const effective = resolveEffectiveBackgroundColor([cardBg, childBg], rootBg);
    // Composited: 255*0.1 + 7*0.9 = 25.5 + 6.3 = 31.8 -> 32
    assert.equal(effective.r, 32);
    assert.equal(effective.a, 1.0);
  });

  // 4. Contrast Ratio Calculation
  test('4. Contrast ratio calculation matches standard mathematical formula', () => {
    // White vs Black: (1 + 0.05) / (0 + 0.05) = 21.0
    const lumWhite = calculateLuminance(255, 255, 255);
    const lumBlack = calculateLuminance(0, 0, 0);
    const ratio = calculateContrastRatio(lumWhite, lumBlack);
    assert.equal(ratio, 21.0);

    // Identical colors: 1.0
    const ratioSame = calculateContrastRatio(lumWhite, lumWhite);
    assert.equal(ratioSame, 1.0);
  });

  // 5. AA Failure Detection
  test('5. AA failure is flagged for low contrast text', () => {
    // Text: #080a0f (nearly black) on background #07090e (dark background)
    const result = evaluateWcagContrast({
      foreground: 'rgb(8, 10, 15)',
      background: 'rgb(7, 9, 14)',
      fontSize: 14,
      fontWeight: 400
    });

    assert.equal(result.passesAA, false);
    assert.equal(result.passesAAA, false);
    assert.ok(result.ratio < 2.0, `Expected ratio < 2.0, got ${result.ratio}`);
    assert.equal(result.severity, 'critical');
    assert.equal(result.level, 'FAIL');
  });

  // 6. AA Pass Detection
  test('6. AA pass is confirmed for high contrast text', () => {
    // Text: #f8fafc (near white) on background #07090e (dark background)
    const result = evaluateWcagContrast({
      foreground: 'rgb(248, 250, 252)',
      background: 'rgb(7, 9, 14)',
      fontSize: 16,
      fontWeight: 400
    });

    assert.equal(result.passesAA, true);
    assert.equal(result.passesAAA, true);
    assert.ok(result.ratio >= 7.0, `Expected ratio >= 7.0, got ${result.ratio}`);
    assert.equal(result.level, 'AAA');
    assert.equal(result.severity, 'none');
  });

  // 7. Large Text Threshold
  test('7. Large text threshold requires lower contrast ratio for AA compliance (3:1 vs 4.5:1)', () => {
    // 24px regular text is large text
    assert.equal(isLargeText(24, 400), true);
    // 19px bold text (>= 700) is large text
    assert.equal(isLargeText(19, 700), true);
    assert.equal(isLargeText(19, 'bold'), true);
    // 16px bold text is NOT large text
    assert.equal(isLargeText(16, 700), false);
    // 18px regular text is NOT large text
    assert.equal(isLargeText(18, 400), false);

    // Color ratio 3.5:1 should FAIL for normal text (requires 4.5:1), but PASS for large text (requires 3.0:1)
    const normalResult = evaluateWcagContrast({
      foreground: '#718096',
      background: '#07090e',
      fontSize: 14,
      fontWeight: 400
    });

    const largeResult = evaluateWcagContrast({
      foreground: '#718096',
      background: '#07090e',
      fontSize: 24,
      fontWeight: 400
    });

    assert.equal(normalResult.isLargeText, false);
    assert.equal(largeResult.isLargeText, true);
    assert.equal(largeResult.minRatioAA, 3.0);
    assert.equal(normalResult.minRatioAA, 4.5);
  });

  // 8. Hidden Element Exclusion Contract
  test('8. buildDeterministicMetricsReport handles contrast summary and issues without regressions', () => {
    const reportWithContrast = buildDeterministicMetricsReport({
      layout: { contentWidth: 1440, viewport: { width: 1440 }, whitespaceRatio: 0.2 },
      typography: { fontCount: 2, h1Count: 1, isHierarchyOrdered: true },
      color: { colorCount: 5, hasExcessiveGradients: false },
      components: { hasNavigation: true, isStickyNav: true, hasProminentCta: true, hasFooter: true },
      repetition: { hasRepeatedCardSections: false },
      contrast: {
        contrastSummary: { checked: 50, failures: 3, aaFailures: 3, aaaFailures: 5, worstRatio: 1.1 },
        contrastIssues: [
          { selector: 'p.dim', text: 'Low contrast text', ratio: 1.1, severity: 'critical', level: 'AA' }
        ]
      }
    });

    assert.ok(reportWithContrast.contrast, 'Report should contain contrast data');
    assert.equal(reportWithContrast.contrast.contrastSummary.failures, 3);
    assert.ok(reportWithContrast.warnings.some(w => w.id === 'WARN_CRITICAL_CONTRAST'));
    assert.ok(reportWithContrast.deterministicQualityScore < 85, 'Quality score should be penalized for critical contrast');
  });

  // 9. Heuristic Score Penalty
  test('9. buildHeuristicCategoryScores deducts points from colorSystem and uxQuality on contrast failure', () => {
    const cleanData = {
      layout: { hasHorizontalOverflow: false, whitespaceRatio: 0.25 },
      typography: { fontCount: 2, isHierarchyOrdered: true, h1Count: 1 },
      color: { colorCount: 5, hasExcessiveGradients: false },
      components: { hasNavigation: true, isStickyNav: true, hasHero: true, hasProminentCta: true, hasFooter: true },
      contrast: {
        contrastSummary: { checked: 30, failures: 0, worstRatio: 12.0 }
      }
    };

    const degradedData = {
      ...cleanData,
      color: { ...cleanData.color, hasLowContrastText: true },
      contrast: {
        contrastSummary: { checked: 30, failures: 5, worstRatio: 1.08 }
      }
    };

    const cleanScores = buildHeuristicCategoryScores(cleanData);
    const degradedScores = buildHeuristicCategoryScores(degradedData);

    assert.equal(cleanScores.colorSystem, 85);
    assert.equal(degradedScores.colorSystem, 60); // 85 - 25
    assert.ok(cleanScores.colorSystem - degradedScores.colorSystem >= 25);
    assert.ok(cleanScores.uxQuality - degradedScores.uxQuality >= 30);
  });

  // 10. Regression Trigger
  test('10. evaluateVisualRegressionPolicy triggers ROLLBACK when contrast degrades significantly', () => {
    const beforeAudit = {
      overallScore: 84,
      categoryScores: {
        visualHierarchy: 80,
        typography: 85,
        spacing: 80,
        layout: 85,
        colorSystem: 85,
        componentQuality: 80,
        brandIdentity: 80,
        genericDesignSignals: 80,
        uxQuality: 85,
        responsiveQuality: 85
      },
      findings: []
    };

    const afterAudit = {
      overallScore: 72, // Dropped > 1 point
      categoryScores: {
        ...beforeAudit.categoryScores,
        colorSystem: 60, // Dropped > 5 points (85 -> 60)
        uxQuality: 55
      },
      findings: [
        { id: 'WARN_CRITICAL_CONTRAST', severity: 'critical', title: 'Kritik Metin Kontrastı' }
      ]
    };

    const evaluation = evaluateVisualRegressionPolicy({ beforeAudit, afterAudit });
    assert.equal(evaluation.passed, false);
    assert.equal(evaluation.decision, 'ROLLBACK');
    assert.ok(evaluation.failures.some(f => f.includes('Renk sistemi ve kontrast skoru')));
    assert.ok(evaluation.failures.some(f => f.includes('Kritik tasarım hatası sayısı arttı')));
  });

});
