/**
 * ONLUNET ZEKA — Composite Visual Score & Quality Engine
 * FAZ 71: Explainable Multi-Factor Design Scoring, Quality Levels & AI Risk Classification
 *
 * GUARANTEES:
 * 1. Explainable composite scoring combining deterministic metrics & AI critic evaluations.
 * 2. Standardized Quality Levels: EXCEPTIONAL, PROFESSIONAL, GOOD, NEEDS IMPROVEMENT, WEAK, CRITICAL.
 * 3. AI Template Risk Classification: LOW, MEDIUM, HIGH, VERY_HIGH.
 * 4. Configurable weights schema (defaulting to standard corporate design ratios).
 */

export const DEFAULT_SCORE_WEIGHTS = Object.freeze({
  professionalism: 0.20,
  visualHierarchy: 0.15,
  typography: 0.10,
  color: 0.10,
  spacing: 0.10,
  responsive: 0.15,
  originality: 0.10,
  visualConsistency: 0.10
});

export const DesignQualityLevels = Object.freeze({
  EXCEPTIONAL: 'EXCEPTIONAL',
  PROFESSIONAL: 'PROFESSIONAL',
  GOOD: 'GOOD',
  NEEDS_IMPROVEMENT: 'NEEDS IMPROVEMENT',
  WEAK: 'WEAK',
  CRITICAL: 'CRITICAL'
});

export const AiTemplateRisks = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  VERY_HIGH: 'VERY_HIGH'
});

/**
 * Maps a numerical score (0-100) to standard DesignQualityLevels
 */
export function getQualityLevel(score) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s >= 90) return DesignQualityLevels.EXCEPTIONAL;
  if (s >= 80) return DesignQualityLevels.PROFESSIONAL;
  if (s >= 70) return DesignQualityLevels.GOOD;
  if (s >= 60) return DesignQualityLevels.NEEDS_IMPROVEMENT;
  if (s >= 40) return DesignQualityLevels.WEAK;
  return DesignQualityLevels.CRITICAL;
}

/**
 * Maps an AI-generated appearance score (0-100) to AiTemplateRisks
 */
export function getAiTemplateRisk(aiScore) {
  const s = Math.max(0, Math.min(100, Math.round(aiScore)));
  if (s < 30) return AiTemplateRisks.LOW;
  if (s < 60) return AiTemplateRisks.MEDIUM;
  if (s < 80) return AiTemplateRisks.HIGH;
  return AiTemplateRisks.VERY_HIGH;
}

/**
 * Calculates the composite explainable visual score from deterministic and AI critic data
 *
 * @param {Object} params
 * @param {Object} [params.deterministicMetrics] - Output from visual-analyzer.js
 * @param {Object} [params.criticEvaluation] - Output from visual-critic.js
 * @param {Object} [params.weights] - Custom weights override
 * @returns {Object} Full explainable visual score report
 */
export function computeCompositeVisualScore({
  deterministicMetrics = {},
  criticEvaluation = {},
  weights = DEFAULT_SCORE_WEIGHTS
} = {}) {
  // Extract or synthesize sub-scores (0-100)
  const professionalism = criticEvaluation.professionalismScore !== undefined
    ? criticEvaluation.professionalismScore
    : (deterministicMetrics.deterministicQualityScore || 75);

  const visualHierarchy = criticEvaluation.visualHierarchyScore !== undefined
    ? criticEvaluation.visualHierarchyScore
    : (deterministicMetrics.typography?.isHierarchyOrdered ? 85 : 60);

  const typography = criticEvaluation.typographyScore !== undefined
    ? criticEvaluation.typographyScore
    : (deterministicMetrics.typography?.fontCount <= 2 ? 90 : 65);

  const color = criticEvaluation.colorScore !== undefined
    ? criticEvaluation.colorScore
    : (deterministicMetrics.color?.hasExcessiveGradients ? 60 : 85);

  const spacing = criticEvaluation.spacingScore !== undefined
    ? criticEvaluation.spacingScore
    : (deterministicMetrics.layout?.whitespaceRatio >= 0.1 ? 85 : 60);

  const responsive = criticEvaluation.responsiveScore !== undefined
    ? criticEvaluation.responsiveScore
    : (deterministicMetrics.layout?.hasHorizontalOverflow ? 50 : 90);

  const originality = criticEvaluation.originalityScore !== undefined
    ? criticEvaluation.originalityScore
    : Math.max(20, 100 - (deterministicMetrics.aiPatternRepetitionScore || 10));

  const visualConsistency = Math.round((visualHierarchy + spacing + typography) / 3);

  // Compute weighted composite score
  const rawOverall = (
    professionalism * (weights.professionalism ?? 0.20) +
    visualHierarchy * (weights.visualHierarchy ?? 0.15) +
    typography * (weights.typography ?? 0.10) +
    color * (weights.color ?? 0.10) +
    spacing * (weights.spacing ?? 0.10) +
    responsive * (weights.responsive ?? 0.15) +
    originality * (weights.originality ?? 0.10) +
    visualConsistency * (weights.visualConsistency ?? 0.10)
  );

  const overallScore = Math.min(100, Math.max(0, Math.round(rawOverall)));
  const qualityLevel = getQualityLevel(overallScore);

  const aiScore = criticEvaluation.aiGeneratedAppearanceScore !== undefined
    ? criticEvaluation.aiGeneratedAppearanceScore
    : (deterministicMetrics.aiPatternRepetitionScore || 15);

  const aiTemplateRisk = getAiTemplateRisk(aiScore);

  // Merge findings and sort by severity
  const severityOrder = { critical: 1, high: 2, medium: 3, low: 4, info: 5 };
  const allFindings = [
    ...(criticEvaluation.findings || []),
    ...((deterministicMetrics.warnings || []).map((w, idx) => ({
      id: w.id || `WARN-${idx + 1}`,
      severity: w.severity || 'medium',
      category: w.category || 'layout',
      title: w.title,
      description: w.description,
      evidence: 'Deterministik DOM metrikleri',
      confidence: 1.0,
      suggestedAction: 'Belirtilen kurala göre düzeltme önerilir.',
      proposalOnly: true
    })))
  ];

  // Deduplicate findings by ID/title
  const uniqueFindings = [];
  const seenIds = new Set();
  for (const f of allFindings) {
    const key = (f.id || f.title).toLowerCase();
    if (!seenIds.has(key)) {
      seenIds.add(key);
      uniqueFindings.push(f);
    }
  }

  uniqueFindings.sort((a, b) => (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3));

  const strengths = [
    ...(criticEvaluation.strengths || []),
    ...(deterministicMetrics.strengths || [])
  ];

  const recommendations = [
    ...(criticEvaluation.recommendations || [])
  ];

  const breakdown = [
    { metric: 'Professionalism', score: professionalism, weight: weights.professionalism ?? 0.20, contribution: Number((professionalism * (weights.professionalism ?? 0.20)).toFixed(1)) },
    { metric: 'Visual Hierarchy', score: visualHierarchy, weight: weights.visualHierarchy ?? 0.15, contribution: Number((visualHierarchy * (weights.visualHierarchy ?? 0.15)).toFixed(1)) },
    { metric: 'Typography', score: typography, weight: weights.typography ?? 0.10, contribution: Number((typography * (weights.typography ?? 0.10)).toFixed(1)) },
    { metric: 'Color', score: color, weight: weights.color ?? 0.10, contribution: Number((color * (weights.color ?? 0.10)).toFixed(1)) },
    { metric: 'Spacing', score: spacing, weight: weights.spacing ?? 0.10, contribution: Number((spacing * (weights.spacing ?? 0.10)).toFixed(1)) },
    { metric: 'Responsive', score: responsive, weight: weights.responsive ?? 0.15, contribution: Number((responsive * (weights.responsive ?? 0.15)).toFixed(1)) },
    { metric: 'Originality', score: originality, weight: weights.originality ?? 0.10, contribution: Number((originality * (weights.originality ?? 0.10)).toFixed(1)) },
    { metric: 'Visual Consistency', score: visualConsistency, weight: weights.visualConsistency ?? 0.10, contribution: Number((visualConsistency * (weights.visualConsistency ?? 0.10)).toFixed(1)) }
  ];

  return Object.freeze({
    overallScore,
    qualityLevel,
    aiGeneratedAppearanceScore: aiScore,
    aiTemplateRisk,
    subScores: Object.freeze({
      professionalism,
      visualHierarchy,
      typography,
      color,
      spacing,
      responsive,
      originality,
      visualConsistency
    }),
    breakdown: Object.freeze(breakdown),
    findings: Object.freeze(uniqueFindings),
    strengths: Object.freeze(Array.from(new Set(strengths))),
    recommendations: Object.freeze(Array.from(new Set(recommendations))),
    calculatedAt: new Date().toISOString(),
    proposalOnly: true,
    executionAuthorized: false
  });
}
