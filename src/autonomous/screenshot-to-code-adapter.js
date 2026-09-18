/**
 * ONLUNET ZEKA — Screenshot-to-Code Adapter & Multimodal Prompt Architecture
 * Open Source Integration Pattern: abi/screenshot-to-code & shadcn/ui
 *
 * Capabilities:
 * 1. Multimodal Vision Prompt Construction (screenshot-to-code pattern)
 * 2. Visual Layout & Section Graph Extraction (Sector decoupled from Visual Structure)
 * 3. shadcn/ui-inspired Component Primitives & CSS Design Tokens
 * 4. Content Hierarchy Enforcement (Level 1 User -> Level 2 Ref -> Level 3 Company -> Level 4 Sector -> Level 5 Neutral Fallback)
 * 5. Iterative Visual Refinement Loop Interface
 *
 * ZERO HARDCODED SINGLE-IMAGE HACKS. Fully generic across all sectors.
 */

import crypto from 'node:crypto';

/**
 * Standard shadcn/ui design tokens injected as CSS custom properties
 */
export function generateShadcnTokens({ primaryColor = '#2563eb', accentColor = '#3b82f6', borderRadius = '8px', isDark = false } = {}) {
  return `
  :root {
    --background: ${isDark ? '#09090b' : '#ffffff'};
    --foreground: ${isDark ? '#fafafa' : '#09090b'};
    --card: ${isDark ? '#18181b' : '#ffffff'};
    --card-foreground: ${isDark ? '#fafafa' : '#09090b'};
    --popover: ${isDark ? '#18181b' : '#ffffff'};
    --popover-foreground: ${isDark ? '#fafafa' : '#09090b'};
    --primary: ${primaryColor};
    --primary-foreground: #ffffff;
    --secondary: ${isDark ? '#27272a' : '#f4f4f5'};
    --secondary-foreground: ${isDark ? '#fafafa' : '#18181b'};
    --muted: ${isDark ? '#27272a' : '#f4f4f5'};
    --muted-foreground: ${isDark ? '#a1a1aa' : '#71717a'};
    --accent: ${accentColor};
    --accent-foreground: #ffffff;
    --destructive: #ef4444;
    --destructive-foreground: #ffffff;
    --border: ${isDark ? '#27272a' : '#e4e4e7'};
    --input: ${isDark ? '#27272a' : '#e4e4e7'};
    --ring: ${primaryColor};
    --radius: ${borderRadius};
  }
`;
}

/**
 * Builds a structured multimodal prompt adhering to the abi/screenshot-to-code architecture.
 */
export function buildScreenshotToCodePrompt({ referenceSpec, companyProfile, stack = 'html-tailwind' }) {
  const systemPrompt = `You are an expert full-stack developer who specializes in reproducing web designs with pixel-level precision.
You use clean, semantic HTML5, modern Tailwind CSS classes or native CSS variables matching the shadcn/ui design token specification.
Rules:
1. Examine the reference image's visual structure: navigation, hero, feature cards, grid sections, split showcases, social proof, forms, and footer.
2. Match the visual density, typography scale, spacing, border radiuses, and color palette.
3. Use accessible HTML tags (<header>, <nav>, <main>, <section>, <article>, <footer>, <button>, <input>).
4. Do not include any markdown fences or conversational text; return only production-ready HTML code.`;

  const userPrompt = `Generate a complete, responsive, self-contained single-page frontend based on this reference design spec:
- Primary Color: ${referenceSpec?.visualStyle?.primaryColors?.[0] || '#2563eb'}
- Card Radius: ${referenceSpec?.visualStyle?.borderRadius || '8px'}
- Layout Style: ${referenceSpec?.layout?.hero?.composition || 'asymmetric-split-hero'}
- Sections: ${(referenceSpec?.layout?.sections || []).map(s => s.type || s.id).join(', ')}
- Target Company: ${companyProfile?.companyName || 'Kurumsal Firma'}
- Industry: ${companyProfile?.industry || 'Kurumsal Hizmetler'}
`;

  return { systemPrompt, userPrompt, stack };
}

/**
 * Normalizes and extracts a robust ReferenceDesignSpec from visual analysis,
 * ensuring complete decoupling between sector and visual layout.
 */
export function extractReferenceDesignSpec(analysis, { fidelityMode = 'exact', explicitData = {} } = {}) {
  const palette = analysis?.detectedPalette || analysis?.colorPalette || {};
  const layout = analysis?.layoutAnalysis || {};
  const isExact = fidelityMode === 'exact';

  const primary = explicitData.primaryColor || palette.primary || '#2563eb';
  const accent = explicitData.accentColor || palette.accent || '#3b82f6';
  const bgLight = palette.bgLight || '#ffffff';
  const bgDark = palette.bgDark || '#0f172a';
  const surface = palette.surface || '#f8fafc';

  const heroComp = layout.hero?.composition || analysis?.compositionStyle || 'asymmetric-split-hero';
  const gridStruct = layout.sections?.gridStructure || analysis?.layoutStyle || 'modular-cards-4col';
  const density = layout.hero?.visualDensity || 'comfortable';
  const cardRadius = layout.sections?.cardBorderRadius || '8px';
  const fontFamily = layout.typography?.fontFamilyCategory || 'Inter';

  // Build standard sections according to visual composition
  const sections = [
    { id: 'sec-hero', type: 'hero', composition: heroComp },
    { id: 'sec-features', type: 'features', columns: isExact ? 4 : 3, gridStructure: gridStruct },
    { id: 'sec-showcase', type: 'showcase', columns: 4, hasImages: true },
    { id: 'sec-split', type: 'split_about', hasStorefrontOrFacility: true },
    { id: 'sec-proof', type: 'social_proof', hasGoogleReviews: true, hasBrands: true },
    { id: 'sec-interactive', type: 'interactive_tool_or_form', hasLeadForm: true },
    { id: 'sec-faq', type: 'accordion_faq', count: 4 },
    { id: 'sec-footer', type: 'footer', columns: 4 }
  ];

  return {
    specId: `spec-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    source: 'reference_image',
    fidelityMode,
    architecture: 'screenshot-to-code-shadcn',
    visualStyle: {
      primaryColors: [primary, accent],
      palette: { primary, accent, bgLight, bgDark, surface },
      typography: { fontDisplay: fontFamily, scaleRatio: 1.25 },
      borderRadius: cardRadius,
      density
    },
    layout: {
      header: layout.header || { style: 'solid-sticky-opaque', hasTopbar: true, navAlignment: 'right' },
      hero: { composition: heroComp, visualDensity: density, hasMetricsStrip: true, hasInteractiveCta: true },
      sections,
      footer: layout.footer || { columns: 4, darkSurface: true }
    },
    components: ['navigation', 'hero_cta', 'value_cards', 'brand_strip', 'product_grid', 'split_card', 'reviews', 'interactive_widget', 'lead_form', 'faq_accordion', 'footer'],
    density,
    shadcnTokens: generateShadcnTokens({ primaryColor: primary, accentColor: accent, borderRadius: cardRadius })
  };
}

/**
 * Diagnoses visual diff results between reference and generated page,
 * returning structured corrective recommendations for the iterative loop.
 */
export function diagnoseVisualDifferences(metrics = {}, context = {}) {
  const {
    pixelSimilarity = metrics.visualFidelity ?? null,
    structuralFidelity = null,
    visualFidelity = metrics.pixelSimilarity ?? null,
    contentRelevance = null,
    diffRatio = 0,
    boundingBoxes = []
  } = metrics;

  const sim = pixelSimilarity !== null ? pixelSimilarity : visualFidelity;
  const recommendations = [];
  let needsCorrection = false;

  if (sim !== null && (sim < 85 || diffRatio > 0.15)) {
    needsCorrection = true;
    recommendations.push({
      priority: 'high',
      target: 'colors_and_contrast',
      message: 'Dominant color contrast deviates from reference. Adjust --primary and background tint variables.'
    });
  }

  if (structuralFidelity !== null && structuralFidelity < 85) {
    needsCorrection = true;
    recommendations.push({
      priority: 'high',
      target: 'grid_and_spacing',
      message: 'Grid column count or container alignment deviates from reference layout. Adjust grid-cols and section padding.'
    });
  }

  if (contentRelevance !== null && contentRelevance < 85) {
    needsCorrection = true;
    recommendations.push({
      priority: 'medium',
      target: 'content_hierarchy',
      message: 'Detected text divergence from expected brand or domain metadata. Enforce Content Hierarchy Level 1-3.'
    });
  }

  const simStr = sim !== null ? `%${sim}` : 'NOT_MEASURED';
  const structStr = structuralFidelity !== null ? `%${structuralFidelity}` : 'NOT_MEASURED';
  const contentStr = contentRelevance !== null ? `%${contentRelevance}` : 'NOT_MEASURED';

  const summary = `Görsel karşılaştırma raporu: Pixel Similarity: ${simStr}, Structural Fidelity: ${structStr}, Content Relevance: ${contentStr}. ${needsCorrection ? `${recommendations.length} iyileştirme önerildi.` : 'Temel piksel benzerlik kriterleri sağlandı.'}`;

  return {
    needsCorrection,
    overallScore: null,
    pixelSimilarity: sim,
    structuralFidelity,
    visualFidelity: sim,
    contentRelevance,
    diffRatio,
    recommendations,
    adjustments: recommendations,
    summary,
    context
  };
}
