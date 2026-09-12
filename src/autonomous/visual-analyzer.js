/**
 * ONLUNET ZEKA — Deterministic Visual Analyzer v1.0
 * FAZ 71: Objective Rendered Website Layout, Typography, Color & Structure Analysis
 *
 * GUARANTEES:
 * 1. Zero External Dependencies: Pure Node.js & native CDP / browser execution.
 * 2. Deterministic & Reproducible: Same page state yields identical metrics.
 * 3. Deep Architectural Inspection: Layout density, typography hierarchy, WCAG contrast,
 *    component detection, and anti-pattern repetition discovery.
 * 4. AI-Generated Pattern Flagging: Detects repetitive cards, excessive gradients,
 *    glassmorphism overload, and generic SaaS hero archetypes.
 * 5. Fail-Closed & Non-Mutating: Zero file mutations, zero execution authority.
 */

import {
  launchHeadlessBrowser,
  getBrowserExecutablePath
} from './browser-qa-inspector.js';

/**
 * Calculates WCAG 2.1 relative luminance for an sRGB component
 */
function srgbToLinear(val) {
  const v = val / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Computes luminance from RGB [0-255] values according to WCAG 2.1
 */
export function calculateLuminance(r, g, b) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/**
 * Computes WCAG 2.1 contrast ratio between two luminance values (1.0 to 21.0)
 */
export function calculateContrastRatio(lum1, lum2) {
  const l1 = Math.max(lum1, lum2);
  const l2 = Math.min(lum1, lum2);
  return Number(((l1 + 0.05) / (l2 + 0.05)).toFixed(2));
}

/**
 * Parses CSS rgb/rgba string into { r, g, b, a }
 */
export function parseCssColor(colorStr) {
  if (!colorStr || typeof colorStr !== 'string') return null;
  const str = colorStr.trim().toLowerCase();

  // rgba(r, g, b, a) or rgb(r, g, b)
  const rgbMatch = str.match(/rgba?\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)(?:\s*,\s*([0-9\.]+))?\s*\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      a: rgbMatch[4] !== undefined ? parseFloat(rgbMatch[4]) : 1.0
    };
  }

  // Hex color #rgb, #rgba, #rrggbb, #rrggbbaa
  if (str.startsWith('#')) {
    const hex = str.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1.0;
      return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1.0;
      return { r, g, b, a };
    }
  }

  return null;
}

/**
 * Client-side script injected via CDP Runtime.evaluate to extract complete DOM layout & visual metrics
 */
export const IN_PAGE_ANALYSIS_SCRIPT = `
(() => {
  const result = {
    layout: {},
    typography: {},
    color: {},
    components: {},
    repetition: {},
    rawMetrics: {}
  };

  const vpWidth = window.innerWidth;
  const vpHeight = window.innerHeight;
  const docEl = document.documentElement;
  const body = document.body;

  const contentWidth = Math.max(docEl.scrollWidth, body ? body.scrollWidth : 0, vpWidth);
  const contentHeight = Math.max(docEl.scrollHeight, body ? body.scrollHeight : 0, vpHeight);

  // 1. SECTION & LAYOUT ANALYSIS
  const allElements = Array.from(document.querySelectorAll('*'));
  const sectionElements = Array.from(document.querySelectorAll('header, nav, main, section, footer, article, [data-section], .section, .hero'));
  const meaningfulSections = sectionElements.filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.height > 60 && rect.width > 200;
  });

  const sectionHeights = meaningfulSections.map(s => Math.round(s.getBoundingClientRect().height));
  const totalSectionHeight = sectionHeights.reduce((a, b) => a + b, 0);

  // Above-the-fold elements (top < vpHeight)
  const aboveTheFoldEls = allElements.filter(el => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.top < vpHeight && rect.height > 0 && rect.width > 0;
  });

  // Whitespace estimation: Ratio of non-content vertical space
  const whitespaceRatio = contentHeight > 0
    ? Math.max(0, Math.min(1, Number((1 - (totalSectionHeight / contentHeight)).toFixed(2))))
    : 0.2;

  result.layout = {
    viewport: { width: vpWidth, height: vpHeight },
    contentWidth,
    contentHeight,
    hasHorizontalOverflow: contentWidth > vpWidth + 2,
    sectionCount: meaningfulSections.length,
    sectionHeights,
    whitespaceRatio,
    totalElementCount: allElements.length,
    aboveTheFoldElementCount: aboveTheFoldEls.length,
    contentDensityRatio: Number((allElements.length / (contentHeight / 100)).toFixed(2))
  };

  // 2. TYPOGRAPHY ANALYSIS
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const paragraphs = Array.from(document.querySelectorAll('p, span, li, a, td, th'));
  const fontFamilies = new Set();
  const fontSizes = [];
  const lineHeights = [];

  // Inspect computed typography for visible elements
  const textSample = [...headings, ...paragraphs.slice(0, 100)];
  for (const el of textSample) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const ff = style.fontFamily ? style.fontFamily.split(',')[0].replace(/['"]/g, '').trim() : '';
    if (ff) fontFamilies.add(ff);
    const fs = parseFloat(style.fontSize);
    if (!isNaN(fs) && fs > 0) fontSizes.push(Math.round(fs));
    const lh = parseFloat(style.lineHeight);
    if (!isNaN(lh) && lh > 0) lineHeights.push(Math.round(lh));
  }

  const h1Elements = Array.from(document.querySelectorAll('h1'));
  const h2Elements = Array.from(document.querySelectorAll('h2'));
  const h3Elements = Array.from(document.querySelectorAll('h3'));

  const h1Sizes = h1Elements.map(h => parseFloat(window.getComputedStyle(h).fontSize) || 0);
  const h2Sizes = h2Elements.map(h => parseFloat(window.getComputedStyle(h).fontSize) || 0);
  const avgH1Size = h1Sizes.length ? Math.round(h1Sizes.reduce((a, b) => a + b, 0) / h1Sizes.length) : 0;
  const avgH2Size = h2Sizes.length ? Math.round(h2Sizes.reduce((a, b) => a + b, 0) / h2Sizes.length) : 0;

  // Verify hierarchy: h1 should generally be larger than h2
  const isHierarchyOrdered = (h1Sizes.length === 0 || h2Sizes.length === 0) ? true : (avgH1Size >= avgH2Size);

  result.typography = {
    fontFamilies: Array.from(fontFamilies),
    fontCount: fontFamilies.size,
    headingCount: headings.length,
    h1Count: h1Elements.length,
    h2Count: h2Elements.length,
    h3Count: h3Elements.length,
    avgH1Size,
    avgH2Size,
    isHierarchyOrdered,
    minFontSize: fontSizes.length ? Math.min(...fontSizes) : 16,
    maxFontSize: fontSizes.length ? Math.max(...fontSizes) : 16,
    hasTinyText: fontSizes.some(s => s < 11)
  };

  // 3. COLOR & AESTHETIC ANALYSIS
  const bgColors = new Set();
  const textColors = new Set();
  let gradientCount = 0;
  let glassmorphismCount = 0;
  let heavyBoxShadowCount = 0;
  let pillElementCount = 0;

  for (const el of allElements.slice(0, 300)) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;

    const bg = style.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') bgColors.add(bg);

    const c = style.color;
    if (c) textColors.add(c);

    const bgImg = style.backgroundImage || '';
    if (bgImg.includes('gradient')) gradientCount++;

    const backdrop = style.backdropFilter || style.webkitBackdropFilter || '';
    if (backdrop.includes('blur')) glassmorphismCount++;

    const shadow = style.boxShadow || '';
    if (shadow && shadow !== 'none' && (shadow.includes('rgba') || shadow.includes('px'))) {
      heavyBoxShadowCount++;
    }

    const br = parseFloat(style.borderRadius);
    if (!isNaN(br) && br >= 9999) {
      pillElementCount++;
    }
  }

  result.color = {
    uniqueBackgroundColors: Array.from(bgColors).slice(0, 10),
    uniqueTextColors: Array.from(textColors).slice(0, 10),
    colorCount: bgColors.size + textColors.size,
    gradientCount,
    glassmorphismCount,
    heavyBoxShadowCount,
    pillElementCount,
    hasExcessiveGradients: gradientCount > 4,
    hasExcessiveGlassmorphism: glassmorphismCount > 4,
    hasExcessivePillBadges: pillElementCount > 6
  };

  // 4. COMPONENT IDENTIFICATION
  const navEl = document.querySelector('nav, header, [role="navigation"]');
  const navLinks = navEl ? Array.from(navEl.querySelectorAll('a')) : [];
  const navStyle = navEl ? window.getComputedStyle(navEl) : null;
  const isStickyNav = navStyle ? (navStyle.position === 'sticky' || navStyle.position === 'fixed') : false;

  const heroEl = document.querySelector('.hero, [data-hero], section:first-of-type, header + section');
  const ctaButtons = Array.from(document.querySelectorAll('a.btn, button, .cta, [role="button"], input[type="submit"]'));
  const cardElements = Array.from(document.querySelectorAll('.card, [class*="card"], [class*="item-box"], [class*="feature-box"]'));
  const forms = Array.from(document.querySelectorAll('form'));
  const footerEl = document.querySelector('footer, [role="contentinfo"], .footer');

  result.components = {
    hasNavigation: Boolean(navEl),
    navLinkCount: navLinks.length,
    isStickyNav,
    hasHero: Boolean(heroEl),
    ctaCount: ctaButtons.length,
    hasProminentCta: ctaButtons.length > 0,
    cardCount: cardElements.length,
    hasCards: cardElements.length > 0,
    hasForm: forms.length > 0,
    hasFooter: Boolean(footerEl)
  };

  // 5. REPETITION & AI PATTERN ANALYSIS
  const cardParentMap = new Map();
  for (const card of cardElements) {
    const parent = card.parentElement;
    if (parent) {
      cardParentMap.set(parent, (cardParentMap.get(parent) || 0) + 1);
    }
  }

  const sectionsWithMultipleCards = Array.from(cardParentMap.values()).filter(count => count >= 3).length;
  const hasRepeatedCardSections = sectionsWithMultipleCards >= 3;

  let isGenericSaasHero = false;
  if (heroEl) {
    const heroH1 = heroEl.querySelector('h1');
    const heroCtas = heroEl.querySelectorAll('button, a');
    const heroStyle = window.getComputedStyle(heroEl);
    if (heroH1 && heroCtas.length >= 2 && (heroStyle.textAlign === 'center' || window.getComputedStyle(heroH1).textAlign === 'center')) {
      isGenericSaasHero = true;
    }
  }

  result.repetition = {
    sectionsWithMultipleCards,
    hasRepeatedCardSections,
    isGenericSaasHero,
    cardCount: cardElements.length
  };

  return result;
})()
`;

/**
 * Executes deep deterministic visual analysis on a page over an active CDP connection
 */
export async function analyzePageWithCdp(cdp, options = {}) {
  if (!cdp || typeof cdp.send !== 'function') {
    throw new Error('[VISUAL_ANALYZER_ERROR] CDP connection required with send() function');
  }

  const { timeoutMs = 8000 } = options;

  let timeoutTimer;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutTimer = setTimeout(() => {
      reject(new Error(`[VISUAL_ANALYZER_TIMEOUT] Page analysis timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const evalPromise = cdp.send('Runtime.evaluate', {
      expression: IN_PAGE_ANALYSIS_SCRIPT,
      returnByValue: true,
      awaitPromise: true
    });

    const evalResult = await Promise.race([evalPromise, timeoutPromise]);
    if (timeoutTimer) clearTimeout(timeoutTimer);

    if (evalResult?.exceptionDetails) {
      throw new Error(`[VISUAL_ANALYZER_ERROR] Script execution error: ${JSON.stringify(evalResult.exceptionDetails)}`);
    }

    const rawData = evalResult?.result?.value || {};
    return buildDeterministicMetricsReport(rawData);
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
  }
}

/**
 * Builds normalized, explainable deterministic metrics and flags anti-patterns
 */
export function buildDeterministicMetricsReport(rawData = {}) {
  const layout = rawData.layout || {};
  const typography = rawData.typography || {};
  const color = rawData.color || {};
  const components = rawData.components || {};
  const repetition = rawData.repetition || {};

  const warnings = [];
  const strengths = [];
  let aiPatternScore = 10; // Baseline low risk (0-100)

  // Layout Evaluation
  if (layout.hasHorizontalOverflow) {
    warnings.push({
      id: 'WARN_HORIZ_OVERFLOW',
      severity: 'high',
      category: 'layout',
      title: 'Yatay Taşma Hatası (Horizontal Overflow)',
      description: `İçerik genişliği (${layout.contentWidth}px) görünür ekran genişliğinden (${layout.viewport?.width}px) daha geniştir. Sayfa yatayda kaymaktadır.`
    });
  }

  if (layout.whitespaceRatio !== undefined && layout.whitespaceRatio < 0.08) {
    warnings.push({
      id: 'WARN_LOW_WHITESPACE',
      severity: 'medium',
      category: 'layout',
      title: 'Aşırı Yoğun / Sıkışık Tasarım',
      description: 'Sayfa içerikleri dikeyde nefes alamayacak kadar sıkışık yerleştirilmiştir. Whitespace oranı düşüktür.'
    });
  } else {
    strengths.push('Dengeli dikey boşluk (whitespace) ve section hiyerarşisi');
  }

  // Typography Evaluation
  if (typography.fontCount > 3) {
    warnings.push({
      id: 'WARN_EXCESSIVE_FONTS',
      severity: 'medium',
      category: 'typography',
      title: 'Aşırı Font Çeşitliliği',
      description: `Sayfada ${typography.fontCount} farklı yazı tipi ailesi tespit edildi (${(typography.fontFamilies || []).join(', ')}). Kurumsal sitelerde 1-2 font ailesi standarttır.`
    });
    aiPatternScore += 15;
  }

  if (typography.isHierarchyOrdered === false && typography.h1Count > 0 && typography.h2Count > 0) {
    warnings.push({
      id: 'WARN_BROKEN_HEADING_HIERARCHY',
      severity: 'medium',
      category: 'typography',
      title: 'Ters Başlık Hiyerarşisi',
      description: `H1 başlık boyutu (${typography.avgH1Size}px) H2 başlık boyutundan (${typography.avgH2Size}px) daha küçüktür veya hiyerarşi tutarsızdır.`
    });
  }

  if (typography.h1Count === 0) {
    warnings.push({
      id: 'WARN_NO_H1',
      severity: 'high',
      category: 'typography',
      title: 'Eksik H1 Başlık',
      description: 'Sayfada ana H1 başlığı bulunamadı. Tipografik odak ve SEO için kritik eksiklik.'
    });
  } else if (typography.h1Count === 1) {
    strengths.push('Tek ve güçlü H1 başlık odağı');
  }

  // Color Evaluation
  if (color.hasExcessiveGradients) {
    warnings.push({
      id: 'WARN_EXCESSIVE_GRADIENTS',
      severity: 'medium',
      category: 'color',
      title: 'Aşırı Gradient Kullanımı (AI-Template Belirtisi)',
      description: `Sayfada ${color.gradientCount} farklı gradient arka plan tespit edildi. Kurumsal sadelik ilkesini aşmaktadır.`
    });
    aiPatternScore += 20;
  }

  if (color.hasExcessiveGlassmorphism) {
    warnings.push({
      id: 'WARN_EXCESSIVE_GLASSMORPHISM',
      severity: 'low',
      category: 'color',
      title: 'Aşırı Glassmorphism / Backdrop Blur',
      description: `Sayfada ${color.glassmorphismCount} elementte backdrop blur kullanılmış. Tipik jenerik SaaS teması izlenimi vermektedir.`
    });
    aiPatternScore += 15;
  }

  if (color.hasExcessivePillBadges) {
    warnings.push({
      id: 'WARN_EXCESSIVE_PILLS',
      severity: 'low',
      category: 'components',
      title: 'Aşırı Hap (Pill) Buton / Rozet',
      description: `Sayfada ${color.pillElementCount} adet tam yuvarlak rozet/hap bulundu.`
    });
    aiPatternScore += 10;
  }

  // Repetition Analysis
  if (repetition.hasRepeatedCardSections) {
    warnings.push({
      id: 'WARN_REPEATED_CARD_SECTIONS',
      severity: 'high',
      category: 'repetition',
      title: 'Tekrarlayan Kart Deseni (AI-Generated Repetition)',
      description: `3 veya daha fazla bölümde (${repetition.sectionsWithMultipleCards} bölüm) tamamen aynı ızgara kart yapısı tekrar etmektedir. Sayfa monotondur.`
    });
    aiPatternScore += 25;
  }

  if (repetition.isGenericSaasHero) {
    warnings.push({
      id: 'WARN_GENERIC_SAAS_HERO',
      severity: 'medium',
      category: 'components',
      title: 'Jenerik Ortalanmış SaaS Hero Yapısı',
      description: 'Ortalanmış dev başlık ve alt alta iki jenerik buton içeren klasik AI-şablon hero tasarımı tespit edildi.'
    });
    aiPatternScore += 15;
  }

  // Component Strengths
  if (components.hasNavigation && components.isStickyNav) {
    strengths.push('Yapışkan (sticky/fixed) ve erişilebilir ana menü navigasyonu');
  }
  if (components.hasProminentCta) {
    strengths.push('Belirgin çağrı (Call-To-Action) aksiyon odakları');
  }
  if (components.hasFooter) {
    strengths.push('Kurumsal alt bilgi (footer) yapısı');
  }

  const boundedAiPatternScore = Math.min(100, Math.max(0, aiPatternScore));

  return Object.freeze({
    analyzedAt: new Date().toISOString(),
    layout: Object.freeze({ ...layout }),
    typography: Object.freeze({ ...typography }),
    color: Object.freeze({ ...color }),
    components: Object.freeze({ ...components }),
    repetition: Object.freeze({ ...repetition }),
    warnings: Object.freeze([...warnings]),
    strengths: Object.freeze([...strengths]),
    aiPatternRepetitionScore: boundedAiPatternScore,
    deterministicQualityScore: computeDeterministicQuality(layout, typography, color, components, repetition)
  });
}

/**
 * Computes deterministic quality score (0-100) based entirely on objective metrics
 */
function computeDeterministicQuality(layout, typography, color, components, repetition) {
  let score = 100;

  if (layout.hasHorizontalOverflow) score -= 25;
  if (layout.whitespaceRatio !== undefined && layout.whitespaceRatio < 0.05) score -= 15;
  if (typography.h1Count === 0) score -= 15;
  if (typography.isHierarchyOrdered === false) score -= 10;
  if (typography.fontCount > 3) score -= 10;
  if (typography.hasTinyText) score -= 10;
  if (!components.hasNavigation) score -= 15;
  if (!components.hasProminentCta) score -= 10;
  if (!components.hasFooter) score -= 10;
  if (color.hasExcessiveGradients) score -= 10;
  if (repetition.hasRepeatedCardSections) score -= 15;

  return Math.min(100, Math.max(10, score));
}

/**
 * Full end-to-end visual analysis of a URL using Chrome CDP
 */
export async function analyzeRenderedUrl(url, options = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('[VISUAL_ANALYZER_ERROR] url is required');
  }

  const {
    viewport = { width: 1440, height: 900 },
    timeoutMs = 12000,
    browserInstance = null
  } = options;

  let ownBrowser = false;
  let browser = browserInstance;

  if (!browser) {
    browser = await launchHeadlessBrowser({ timeoutMs: Math.max(6000, timeoutMs) });
    ownBrowser = true;
  }

  let targetId = null;
  let ws = null;

  try {
    const targetRes = await fetch(`http://127.0.0.1:${browser.debugPort}/json/new`, { method: 'PUT' });
    if (!targetRes.ok) {
      throw new Error(`Failed to create browser target: HTTP ${targetRes.status}`);
    }
    const targetData = await targetRes.json();
    targetId = targetData.id;

    ws = new WebSocket(`ws://127.0.0.1:${browser.debugPort}/devtools/page/${targetId}`);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket connection timed out')), 5000);
      ws.addEventListener('open', () => { clearTimeout(timer); resolve(); });
      ws.addEventListener('error', (err) => { clearTimeout(timer); reject(err); });
    });

    let reqId = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = reqId++;
      const handler = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else resolve(msg.result);
          }
        } catch { /* ignore */ }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await send('Page.enable');
    await send('DOM.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: Number(viewport.width) || 1440,
      height: Number(viewport.height) || 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.navigate', { url });
    await new Promise((resolve) => {
      let readyTimer = null;
      const listener = (evt) => {
        try {
          const d = JSON.parse(evt.data);
          if (d.method === 'Page.loadEventFired' || d.method === 'Page.domContentEventFired') {
            done();
          }
        } catch { /* ignore */ }
      };

      const done = () => {
        if (readyTimer) clearTimeout(readyTimer);
        try { ws.removeEventListener('message', listener); } catch {}
        resolve();
      };

      readyTimer = setTimeout(done, Math.max(1000, timeoutMs - 1500));
      ws.addEventListener('message', listener);
    });

    // Settle delay
    await new Promise(r => setTimeout(r, 300));

    const analysis = await analyzePageWithCdp({ send }, { timeoutMs: Math.max(3000, timeoutMs - 2000) });
    return {
      url,
      viewport,
      ...analysis
    };
  } finally {
    if (ws) {
      try { ws.close(); } catch { /* ignore */ }
    }
    if (targetId && browser?.debugPort) {
      try {
        await fetch(`http://127.0.0.1:${browser.debugPort}/json/close/${targetId}`, { method: 'PUT' });
      } catch { /* ignore */ }
    }
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
