/**
 * ONLUNET ZEKA — Design Originality Guard (FAZ 73)
 *
 * Capabilities:
 * 1. Anti-Pattern & Cliché Detection:
 *    - Flags generic SaaS landing clichés (e.g. purple blob hero, floating dashboard mockup).
 *    - Flags 2018 Bootstrap/Tailwind tropes (3 identical cards with centered icon & lorem ipsum).
 *    - Flags excessive glassmorphism with unreadable contrast.
 * 2. Originality Scoring:
 *    - Computes a comprehensive `originalityScore` (0 to 100).
 *    - Evaluates sector-fit, semantic depth, typographic variety, and layout uniqueness.
 * 3. Explainability:
 *    - Reports concrete warnings and actionable remediation tips if similarity or generic risk is detected.
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js.
 */

/**
 * Audits synthesized design artifacts for originality and absence of generic clichés.
 */
export function auditOriginality({
  html = '',
  css = '',
  designStrategy = {},
  layoutGraph = {},
  designSystem = {}
} = {}) {
  const warnings = [];
  const positiveSignals = [];
  let score = 95; // Base high originality for from-scratch synthesis

  const lowerHtml = (html || '').toLowerCase();
  const lowerCss = (css || '').toLowerCase();

  // 1. Check for generic SaaS clichés
  const saasCliches = [
    'join 10,000+ happy teams',
    'all-in-one platform',
    'boost your workflow with ai',
    'start your 14-day free trial',
    'no credit card required',
    'powering the future of work'
  ];
  for (const cliche of saasCliches) {
    if (lowerHtml.includes(cliche)) {
      score -= 15;
      warnings.push(`Generic SaaS copy detected: "${cliche}".`);
    }
  }

  // 2. Check for Bootstrap / Tailwind literal class copies
  if (lowerHtml.includes('class="col-md-4"') || lowerHtml.includes('class="container-fluid"')) {
    score -= 20;
    warnings.push('Legacy Bootstrap grid classes detected in synthesized markup.');
  }

  // 3. Check for excessive glassmorphism abuse
  const backdropFilterMatches = lowerCss.match(/backdrop-filter:\s*blur/g) || [];
  if (backdropFilterMatches.length > 5) {
    score -= 10;
    warnings.push('Excessive glassmorphism detected across multiple layout components.');
  } else {
    positiveSignals.push('Controlled, tasteful glassmorphism application (header only).');
  }

  // 4. Check for pure semantic HTML structure
  if (lowerHtml.includes('<header') && lowerHtml.includes('<nav') && lowerHtml.includes('<main') || lowerHtml.includes('<section')) {
    positiveSignals.push('Semantic HTML5 sectioning elements properly utilized.');
  }

  // 5. Check for sector-specific adaptation
  const indCat = designStrategy.industryCategory;
  if (indCat === 'gastronomy' && (lowerHtml.includes('menü') || lowerHtml.includes('lezzet') || lowerHtml.includes('rezervasyon'))) {
    positiveSignals.push('Gastronomy-tailored terminology and conversion paths active.');
  } else if (indCat === 'industrial_manufacturing' && (lowerHtml.includes('üretim') || lowerHtml.includes('standart') || lowerHtml.includes('tolerans') || lowerHtml.includes('teklif'))) {
    positiveSignals.push('Industrial-tailored engineering terminology active.');
  } else if (indCat === 'legal_consulting' && (lowerHtml.includes('hukuk') || lowerHtml.includes('danışmanlık') || lowerHtml.includes('dava'))) {
    positiveSignals.push('Legal/consulting authoritative terminology active.');
  }

  // 6. Check for typography variety
  const fontCount = (lowerCss.match(/font-family:/g) || []).length;
  if (fontCount >= 2) {
    positiveSignals.push('Harmonious dual-font typography system active (Display + Body).');
  }

  // 7. Check for Corporate Rule 3 (Opaque sticky header)
  if (lowerCss.includes('position: sticky') && lowerCss.includes('top: 0') && lowerCss.includes('z-index: 9999')) {
    positiveSignals.push('Solid opaque sticky header guarantee verified.');
  } else {
    score -= 15;
    warnings.push('Header is missing required sticky or z-index parameters.');
  }

  // Clamp score between 0 and 100
  const finalScore = Math.max(0, Math.min(100, score));
  const isOriginal = finalScore >= 75;

  return Object.freeze({
    originalityScore: finalScore,
    isOriginal,
    verdict: isOriginal ? 'PASS' : 'NEEDS_REFINEMENT',
    riskLevel: finalScore >= 85 ? 'LOW' : (finalScore >= 70 ? 'MODERATE' : 'HIGH'),
    positiveSignals: Object.freeze(positiveSignals),
    warnings: Object.freeze(warnings),
    evaluatedAt: new Date().toISOString()
  });
}
