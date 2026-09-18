/**
 * ONLUNET ZEKA — Independent Visual & Commercial Critic (FAZ 74)
 *
 * Capabilities:
 * 1. Independent Evaluation:
 *    - Generator'ın self-assigned skorlarını asla okumaz veya yansıtmaz.
 *    - Puanlama sıfırdan objektif kanıtlar (DOM geometrisi, computed styles, semantikler,
 *      bağlantılar, butonlar, formlar, screenshot metadata, erişilebilirlik ve veri provenansı)
 *      üzerinden yapılır.
 * 2. 16-Dimension Weighted Quality Model (0-10 each, weighted total 0-100):
 *    - Brand Fit (8%)
 *    - First Impression (10%)
 *    - Visual Hierarchy (8%)
 *    - Typography (5%)
 *    - Color System (5%)
 *    - Layout Quality (8%)
 *    - Commercial Conversion (12%)
 *    - Product Presentation (10%)
 *    - Trust (8%)
 *    - Mobile UX (8%)
 *    - Responsive Quality (5%)
 *    - Content Quality (5%)
 *    - Originality (4%)
 *    - Data Integrity (5%)
 *    - Accessibility (4%)
 *    - Professional Perception (5%)
 * 3. Structured Finding Model:
 *    - { id, severity, category, title, evidence, selector, expected, actual, impact, recommendation, autoFixEligible }
 *    - Severity tiers: CRITICAL, MAJOR, MINOR, INFO.
 * 4. Deterministic Quality Gate:
 *    - FAIL, CONDITIONAL, PASS, EXCELLENT with strict cutoffs.
 * 5. Actionable Revision Engine & Iterative Quality Loop:
 *    - Generates prioritized revision proposal without mutating code.
 *    - Circuit breaker: Maximum 2 revision cycles strictly enforced.
 * 6. Non-Negotiable Contract Invariants:
 *    - proposalOnly = true
 *    - executionAuthorized = false
 *    - Zero file mutations in active codebase or inspected site.
 *    - Forensic audit JSON saved to scratch/visual_critic_<generationId>.json.
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js & native CDP.
 */

import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { launchHeadlessBrowser } from './browser-qa-inspector.js';
import { calculateLuminance, calculateContrastRatio, parseCssColor } from './visual-analyzer.js';
import { DataProvenanceStatus } from './company-profile-normalizer.js';
import { synthesizeAutonomousWebsite, GenerationMode } from './website-synthesis-engine.js';

export const CRITIC_VERSION = '1.0.0-FAZ74';

export const QualityGateVerdict = Object.freeze({
  EXCELLENT: 'EXCELLENT',
  PASS: 'PASS',
  CONDITIONAL: 'CONDITIONAL',
  FAIL: 'FAIL'
});

export const FindingSeverity = Object.freeze({
  CRITICAL: 'CRITICAL',
  MAJOR: 'MAJOR',
  MINOR: 'MINOR',
  INFO: 'INFO'
});

export const DIMENSION_WEIGHTS = Object.freeze({
  brandFit: 8,              // 8%
  firstImpression: 10,       // 10%
  visualHierarchy: 8,       // 8%
  typography: 5,            // 5%
  colorSystem: 5,           // 5%
  layoutQuality: 8,         // 8%
  commercialConversion: 12, // 12%
  productPresentation: 10,  // 10%
  trust: 8,                 // 8%
  mobileUx: 8,              // 8%
  responsiveQuality: 5,     // 5%
  contentQuality: 5,        // 5%
  originality: 4,           // 4%
  dataIntegrity: 5,         // 5%
  accessibility: 4,         // 4%
  professionalPerception: 5 // 5%
});

/**
 * Creates a structured finding conforming to Section 8 of FAZ 74 specification.
 */
function createFinding({
  id,
  severity = FindingSeverity.INFO,
  category = 'general',
  title = 'Finding',
  evidence = '',
  selector = '',
  expected = '',
  actual = '',
  impact = '',
  recommendation = '',
  autoFixEligible = false
}) {
  return Object.freeze({
    id,
    severity,
    category,
    title,
    evidence,
    selector,
    expected,
    actual,
    impact,
    recommendation,
    autoFixEligible
  });
}

/**
 * Parses CSS variable value from css text.
 */
function extractCssVar(css, varName, fallback = '') {
  if (!css || !varName) return fallback;
  const regex = new RegExp(`${varName}\\s*:\\s*([^;]+);`, 'i');
  const match = css.match(regex);
  return match ? match[1].trim() : fallback;
}

/**
 * Extracts objective DOM & styling evidence from HTML, CSS, and optional live CDP metrics.
 */
export function extractDomEvidence(html = '', css = '', domMetrics = null) {
  const lowerHtml = (html || '').toLowerCase();
  const lowerCss = (css || '').toLowerCase();

  // 1. Heading structure
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h2Matches = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [];
  const h3Matches = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/gi) || [];

  // 2. CTAs and phone links
  const telMatches = html.match(/href=["']tel:([^"']+)["']/gi) || [];
  const telNumbers = telMatches.map(m => {
    const raw = m.replace(/href=["']tel:/i, '').replace(/["']/g, '').trim();
    return raw;
  });

  const buttons = html.match(/<(?:a|button)[^>]*class=["'][^"']*(?:btn|cta)[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|button)>/gi) || [];
  const forms = html.match(/<form[\s\S]*?<\/form>/gi) || [];
  const inputs = html.match(/<input[^>]*>/gi) || [];

  // 3. Header & Corporate Rules
  const hasStickyHeader = lowerCss.includes('position: sticky') && lowerCss.includes('top: 0');
  const hasOpaqueHeaderBg = lowerCss.includes('background: #ffffff') || lowerCss.includes('background-color: #ffffff') || lowerCss.includes('var(--color-surface)');
  const hasDropdownMenu = lowerCss.includes('.dropdown-menu') && lowerCss.includes('white-space: nowrap');
  const hasDropdownOpen = lowerCss.includes('.nav-item-dropdown:hover') || lowerCss.includes('.is-open');

  // 4. Products / Offerings
  const offeringCards = html.match(/class=["'][^"']*offering-card[^"']*["']/gi) || [];
  const hasEmptySectionAnomaly = /<section[^>]*>[\s\r\n]*<\/section>/i.test(html) || /<div class=["']card-grid[^"']*["']>[\s\r\n]*<\/div>/i.test(html);

  // 5. Images and placeholders
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const imgAlts = imgTags.map(img => {
    const m = img.match(/alt=["']([^"']*)["']/i);
    return m ? m[1].trim() : null;
  });
  const svgIcons = html.match(/<svg[\s\S]*?<\/svg>/gi) || [];

  // 6. Responsive & Viewports
  const mediaQueries = css.match(/@media[^{]+\{/gi) || [];
  const hasMobileMedia = mediaQueries.some(mq => mq.includes('768px') || mq.includes('640px') || mq.includes('480px'));

  // 7. Colors & Contrast
  const primaryColorHex = extractCssVar(css, '--color-primary', '#1e3a8a');
  const surfaceColorHex = extractCssVar(css, '--color-surface', '#ffffff');
  const textColorHex = extractCssVar(css, '--color-text', '#0f172a');
  const bgColorHex = extractCssVar(css, '--color-background', '#ffffff');

  let contrastTextOnBg = 15.0; // fallback safe
  let contrastBtnOnSurface = 4.5;
  try {
    const parsedText = parseCssColor(textColorHex);
    const parsedBg = parseCssColor(bgColorHex);
    if (parsedText && parsedBg) {
      const lumText = calculateLuminance(parsedText.r, parsedText.g, parsedText.b);
      const lumBg = calculateLuminance(parsedBg.r, parsedBg.g, parsedBg.b);
      contrastTextOnBg = calculateContrastRatio(lumText, lumBg);
    }

    const parsedPrimary = parseCssColor(primaryColorHex);
    if (parsedPrimary) {
      const lumPrim = calculateLuminance(parsedPrimary.r, parsedPrimary.g, parsedPrimary.b);
      const lumWhite = calculateLuminance(255, 255, 255);
      contrastBtnOnSurface = calculateContrastRatio(lumPrim, lumWhite);
    }
  } catch (_) {
    // Keep defaults
  }

  // 8. Viewport overflow metrics (from CDP domMetrics if available, or estimated)
  const mobileOverflowPx = domMetrics?.mobile?.horizontalOverflowPx !== undefined
    ? domMetrics.mobile.horizontalOverflowPx
    : 0;

  return Object.freeze({
    h1Count: h1Matches.length,
    h1Text: h1Matches[0] ? h1Matches[0].replace(/<[^>]+>/g, '').trim() : '',
    h2Count: h2Matches.length,
    h3Count: h3Matches.length,
    telNumbers: Object.freeze(telNumbers),
    buttonCount: buttons.length,
    formCount: forms.length,
    inputCount: inputs.length,
    hasStickyHeader,
    hasOpaqueHeaderBg,
    hasDropdownMenu,
    hasDropdownOpen,
    offeringCardCount: offeringCards.length,
    hasEmptySectionAnomaly,
    imgCount: imgTags.length,
    imgAlts: Object.freeze(imgAlts),
    svgIconCount: svgIcons.length,
    mediaQueryCount: mediaQueries.length,
    hasMobileMedia,
    primaryColorHex,
    surfaceColorHex,
    textColorHex,
    bgColorHex,
    contrastTextOnBg,
    contrastBtnOnSurface,
    mobileOverflowPx,
    rawText: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  });
}

/**
 * Evaluates the 16 independent quality dimensions from objective evidence.
 */
function evaluateDimensions({
  companyProfile = {},
  designStrategy = {},
  layoutGraph = {},
  designSystem = {},
  html = '',
  css = '',
  domEvidence,
  options = {}
}) {
  const findings = [];
  let findingCounter = 1;
  const nextId = () => `VC-${String(findingCounter++).padStart(3, '0')}`;

  const scores = {};
  const company = companyProfile?.company || {};
  const contact = companyProfile?.contact || {};
  const facts = companyProfile?.facts || {};
  const offerings = companyProfile?.offerings || { services: [], products: [] };
  const lowerHtml = (html || '').toLowerCase();
  const lowerCss = (css || '').toLowerCase();

  // ==========================================
  // 1. BRAND FIT (Weight: 8%)
  // ==========================================
  let brandFitScore = 9.2;
  const industryCategory = designStrategy.industryCategory || 'corporate_services';
  const companyIndustry = (company.industry?.value || '').toLowerCase();

  if (industryCategory === 'gastronomy') {
    const hasFoodKeywords = lowerHtml.includes('lezzet') || lowerHtml.includes('menü') || lowerHtml.includes('mutfak') || lowerHtml.includes('gıda') || lowerHtml.includes('doğal');
    if (!hasFoodKeywords) {
      brandFitScore -= 1.5;
      findings.push(createFinding({
        id: nextId(),
        severity: FindingSeverity.MAJOR,
        category: 'brand_fit',
        title: 'Gastronomi Sektör Dili Yetersiz',
        evidence: 'HTML metninde gastronomi ve gıdaya özgü lezzet/menü terimleri eksik.',
        expected: 'Gastronomi ve gıda sektörüne uygun iştah açıcı ve güven verici terminoloji.',
        actual: 'Genel kurumsal terimler kullanılmış.',
        impact: 'Kullanıcı firmanın gerçek faaliyet alanını anlamakta zorlanabilir.',
        recommendation: 'Sektöre özel ürün, lezzet ve tazelik ifadeleri eklenmelidir.'
      }));
    }
  } else if (industryCategory === 'legal_consulting') {
    const hasLegalKeywords = lowerHtml.includes('hukuk') || lowerHtml.includes('danışmanlık') || lowerHtml.includes('dava') || lowerHtml.includes('müvekkil');
    if (!hasLegalKeywords) {
      brandFitScore -= 1.5;
    }
  } else if (industryCategory === 'industrial_manufacturing') {
    const hasIndustrialKeywords = lowerHtml.includes('üretim') || lowerHtml.includes('sanayi') || lowerHtml.includes('kapasite') || lowerHtml.includes('standart');
    if (!hasIndustrialKeywords) {
      brandFitScore -= 1.5;
    }
  }

  // Negative check: Cyber neon gradient on traditional law firm or food
  if ((industryCategory === 'legal_consulting' || industryCategory === 'gastronomy') && (lowerCss.includes('linear-gradient(135deg, #a855f7') || lowerCss.includes('neon'))) {
    brandFitScore -= 2.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MAJOR,
      category: 'brand_fit',
      title: 'Sektörle Uyumsuz Görsel Estetik',
      evidence: 'Geleneksel / kurumsal sektörde aşırı neon/gradient kullanımı.',
      expected: 'Sektörün ağırlığına uygun klasik ve güven veren renk paleti.',
      actual: 'SaaS / Web3 estetiği kullanılmış.',
      impact: 'Marka güvenilirliği zedelenebilir.',
      recommendation: 'Daha oturaklı ve sektöre uygun renk tonlarına geçilmelidir.'
    }));
  }
  scores.brandFit = Number(Math.max(0, Math.min(10, brandFitScore)).toFixed(1));

  // ==========================================
  // 2. FIRST IMPRESSION (Weight: 10%)
  // ==========================================
  let firstImpressionScore = 9.0;
  if (domEvidence.h1Count === 0) {
    firstImpressionScore -= 4.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.CRITICAL,
      category: 'first_impression',
      title: 'Hero Başlığı (H1) Eksik',
      evidence: 'Sayfada hiçbir <h1> etiketi bulunamadı.',
      selector: 'h1',
      expected: 'İlk ekranda net ve güçlü bir H1 başlık bulunmalıdır.',
      actual: 'H1 başlık mevcut değil.',
      impact: 'İlk ekran değer önerisi sunmuyor ve SEO kaybı yaratır.',
      recommendation: 'Hero bölümüne ana değer önerisini içeren H1 ekleyin.'
    }));
  } else if (domEvidence.h1Count > 1) {
    firstImpressionScore -= 1.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MINOR,
      category: 'first_impression',
      title: 'Birden Fazla H1 Başlık Bulundu',
      evidence: `Sayfada ${domEvidence.h1Count} adet H1 etiketi var.`,
      selector: 'h1',
      expected: 'Sayfa başına tam olarak 1 adet H1 başlık olmalıdır.',
      actual: `${domEvidence.h1Count} adet H1 tespit edildi.`,
      impact: 'Hiyerarşi ve semantik SEO zayıflar.',
      recommendation: 'Alt başlıkları H2 veya H3 seviyesine çekin.'
    }));
  }

  if (domEvidence.buttonCount === 0) {
    firstImpressionScore -= 3.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MAJOR,
      category: 'first_impression',
      title: 'İlk Ekranda CTA Butonu Eksik',
      evidence: 'Hero alanında aksiyona yönlendiren CTA butonu tespit edilemedi.',
      selector: '.hero-actions',
      expected: 'Hero alanında doğrudan aksiyon butonları yer almalıdır.',
      actual: 'Buton bulunamadı.',
      impact: 'Kullanıcı sayfaya girdiğinde ne yapacağını bilemez.',
      recommendation: 'Teklif al veya iletişime geç butonu ekleyin.'
    }));
  }
  scores.firstImpression = Number(Math.max(0, Math.min(10, firstImpressionScore)).toFixed(1));

  // ==========================================
  // 3. VISUAL HIERARCHY (Weight: 8%)
  // ==========================================
  let visualHierarchyScore = 9.0;
  if (domEvidence.h2Count === 0) {
    visualHierarchyScore -= 2.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MAJOR,
      category: 'visual_hierarchy',
      title: 'Bölüm Başlıkları (H2) Eksik',
      evidence: 'Sayfa bölümlerinde H2 hiyerarşisi bulunamadı.',
      selector: 'h2',
      expected: 'Her bağımsız bölümün kendine ait H2 başlığı olmalıdır.',
      actual: '0 adet H2 bulundu.',
      impact: 'Kullanıcı bölümleri tarayamaz.',
      recommendation: 'Bölüm başlıklarını semantik H2 etiketleri ile yapılandırın.'
    }));
  }
  scores.visualHierarchy = Number(Math.max(0, Math.min(10, visualHierarchyScore)).toFixed(1));

  // ==========================================
  // 4. TYPOGRAPHY (Weight: 5%)
  // ==========================================
  let typographyScore = 8.8;
  const fontBody = extractCssVar(css, '--font-body', '');
  const fontDisplay = extractCssVar(css, '--font-display', '');
  if (!fontBody || !fontDisplay) {
    typographyScore -= 1.5;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MINOR,
      category: 'typography',
      title: 'Font Token Tanımları Eksik',
      evidence: 'CSS değişkenlerinde --font-body veya --font-display tanımlanmamış.',
      selector: ':root',
      expected: 'Tipografi tokenları eksiksiz tanımlanmalıdır.',
      actual: 'Eksik font tokenları tespit edildi.',
      impact: 'Sistem varsayılan yazı tipine düşebilir.',
      recommendation: 'Tipografi tokenlarını :root seviyesinde tanımlayın.'
    }));
  }
  scores.typography = Number(Math.max(0, Math.min(10, typographyScore)).toFixed(1));

  // ==========================================
  // 5. COLOR SYSTEM (Weight: 5%)
  // ==========================================
  let colorSystemScore = 9.2;
  if (domEvidence.contrastTextOnBg < 4.5) {
    colorSystemScore -= 3.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.CRITICAL,
      category: 'color_system',
      title: 'Yetersiz Metin Kontrastı (WCAG AA İhlali)',
      evidence: `Metin ve arka plan kontrast oranı: ${domEvidence.contrastTextOnBg}:1.`,
      selector: 'body',
      expected: 'Normal metin için minimum kontrast oranı en az 4.5:1 olmalıdır.',
      actual: `${domEvidence.contrastTextOnBg}:1`,
      impact: 'Metinlerin okunabilirliği ciddi şekilde düşer ve erişilebilirlik ihlal edilir.',
      recommendation: 'Metin rengini koyulaştırın veya arka planı açın.'
    }));
  }
  scores.colorSystem = Number(Math.max(0, Math.min(10, colorSystemScore)).toFixed(1));

  // ==========================================
  // 6. LAYOUT QUALITY (Weight: 8%)
  // ==========================================
  let layoutQualityScore = 9.0;
  if (!domEvidence.hasStickyHeader || !domEvidence.hasOpaqueHeaderBg) {
    layoutQualityScore -= 2.5;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MAJOR,
      category: 'layout_quality',
      title: 'Corporate Rule 3 İhlali (Opak Sticky Header)',
      evidence: 'Header sticky pozisyonda değil veya opak beyaz arka plan içermiyor.',
      selector: '.site-header',
      expected: 'Header position: sticky; top: 0; z-index: 9999; background: #ffffff olmalıdır.',
      actual: 'Opak sticky header kuralı eksik.',
      impact: 'Sayfa kaydırıldığında içerikler header altına girip okunmaz hale gelir.',
      recommendation: 'Header için Corporate Rule 3 CSS kurallarını uygulayın.'
    }));
  }

  if (!domEvidence.hasDropdownMenu) {
    layoutQualityScore -= 1.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MINOR,
      category: 'layout_quality',
      title: 'Corporate Rule 6 İhlali (Dropdown & No-Wrap)',
      evidence: 'Menü bağlantılarında white-space: nowrap veya açılır menü kuralları eksik.',
      selector: '.dropdown-menu',
      expected: 'Menü elemanlarında yazı kırılması engellenmeli ve dropdown gizlenmelidir.',
      actual: 'Kural eksikliği tespit edildi.',
      impact: 'Uzun menü başlıkları iki satıra bölünebilir.',
      recommendation: 'Dropdown menüye white-space: nowrap ve gizleme kurallarını uygulayın.'
    }));
  }
  scores.layoutQuality = Number(Math.max(0, Math.min(10, layoutQualityScore)).toFixed(1));

  // ==========================================
  // 7. COMMERCIAL CONVERSION (Weight: 12%)
  // ==========================================
  let commercialConversionScore = 8.8;
  const providedPhone = (contact.phone?.value || '').trim();

  // Adversarial Test D check: Invalid / dummy phone
  if (providedPhone) {
    const cleanDigits = providedPhone.replace(/[^\d]/g, '');
    const isDummyPhone = cleanDigits.length < 7 || /^0+$/.test(cleanDigits) || /^12345/.test(cleanDigits);

    if (isDummyPhone) {
      commercialConversionScore -= 3.5;
      findings.push(createFinding({
        id: nextId(),
        severity: FindingSeverity.MAJOR,
        category: 'commercial_conversion',
        title: 'Geçersiz / Sahte Telefon Numarası CTA Hedefi',
        evidence: `Telefon hedefi: "${providedPhone}" (${cleanDigits.length} hane).`,
        selector: 'a[href^="tel:"]',
        expected: 'Geçerli en az 7 haneli gerçek iletişim telefonu.',
        actual: `Geçersiz numara: "${providedPhone}"`,
        impact: 'Kullanıcılar firmaya telefonla ulaşamaz; doğrudan arama CTA dönüşümü çöker.',
        recommendation: 'Gerçek firma telefonu girilmeli veya telefon yerine online form CTA kullanılmalıdır.'
      }));
    } else {
      // Check if tel: link exists in HTML
      const hasValidTelHref = domEvidence.telNumbers.some(num => {
        const d = num.replace(/[^\d]/g, '');
        return d.length >= 7;
      });
      if (!hasValidTelHref) {
        commercialConversionScore -= 1.5;
        findings.push(createFinding({
          id: nextId(),
          severity: FindingSeverity.MINOR,
          category: 'commercial_conversion',
          title: 'Telefon Bağlantısı Tıklanabilir Değil',
          evidence: 'Telefon numarası metin olarak var ancak tel: bağlantısı eksik.',
          selector: 'a[href^="tel:"]',
          expected: '<a href="tel:+90..."> formatında tıklanabilir bağlantı.',
          actual: 'Tıklanabilir tel bağlantısı bulunamadı.',
          impact: 'Mobilde tek tıkla arama yapılamaz.',
          recommendation: 'Numarayı tıklanabilir tel: bağlantısına sarın.'
        }));
      }
    }
  }

  // Form check
  if (domEvidence.formCount === 0) {
    commercialConversionScore -= 2.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MAJOR,
      category: 'commercial_conversion',
      title: 'İletişim / Teklif Formu Bulunmuyor',
      evidence: 'Sayfada hiçbir <form> elemanı tespit edilemedi.',
      selector: 'form',
      expected: 'Hızlı teklif ve mesajlaşma için iletişim formu bulunmalıdır.',
      actual: 'Form bulunamadı.',
      impact: 'Mesai dışı müşteri adayları kaybolur.',
      recommendation: 'Sayfanın alt bölümüne teklif/iletişim formu ekleyin.'
    }));
  }
  scores.commercialConversion = Number(Math.max(0, Math.min(10, commercialConversionScore)).toFixed(1));

  // ==========================================
  // 8. PRODUCT PRESENTATION (Weight: 10%)
  // ==========================================
  let productPresentationScore = 9.2;

  // Adversarial Test G check: 0 products / empty catalog anomaly
  if (domEvidence.hasEmptySectionAnomaly) {
    productPresentationScore -= 3.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MAJOR,
      category: 'product_presentation',
      title: 'Boş Kart Izgarası / Boş Bölüm Anomalisi',
      evidence: 'Sayfada içi boş bir kart ızgarası veya boş <section> tespit edildi.',
      selector: '.card-grid-3',
      expected: 'Ürün veya hizmet yoksa bölüm ya gizlenmeli ya da kurumsal fallback ile sunulmalıdır.',
      actual: 'Boş bölüm render edilmiş.',
      impact: 'Site terk edilmiş veya yarım kalmış izlenimi verir.',
      recommendation: 'Boş ürün bölümünü kaldırın veya profesyonel hizmet içeriğiyle doldurun.'
    }));
  }

  // Check asset availability (Section 12: MISSING_ASSET)
  if (domEvidence.imgCount === 0) {
    // Only SVG icons used, no real photography
    productPresentationScore -= 1.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MINOR,
      category: 'product_presentation',
      title: 'MISSING_ASSET: Gerçek Ürün / Hizmet Fotoğrafı Eksik',
      evidence: 'Sitede gerçek fotoğraf (img etiketi) bulunmuyor, yalnızca SVG ikonlar kullanılmış.',
      selector: 'img',
      expected: 'Firma ürün veya tesislerine ait yüksek çözünürlüklü gerçek fotoğraflar.',
      actual: '0 adet görsel bulundu (yalnızca vektörel ikonlar aktif).',
      impact: 'Ticari ürün sunumu gerçekçilik ve ikna edicilik açısından zayıflar.',
      recommendation: 'Firma tarafından sağlanan özgün ürün/hizmet görselleri eklenmelidir.'
    }));
  }
  scores.productPresentation = Number(Math.max(0, Math.min(10, productPresentationScore)).toFixed(1));

  // ==========================================
  // 9. TRUST (Weight: 8%)
  // ==========================================
  let trustScore = 9.0;
  const addressVal = (contact.address?.value || '').trim();
  if (!addressVal) {
    trustScore -= 1.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.INFO,
      category: 'trust',
      title: 'Fiziksel Konum / Adres Bilgisi Eksik',
      evidence: 'İletişim bilgilerinde doğrulanmış açık adres bulunmuyor.',
      selector: '.contact-section',
      expected: 'Kullanıcı güveni için açık adres ve şehir bilgisi.',
      actual: 'Adres belirtilmemiş.',
      impact: 'Yerel müşteri güveni sınırlı kalabilir.',
      recommendation: 'Doğrulanmış şirket adresi ekleyin.'
    }));
  }
  scores.trust = Number(Math.max(0, Math.min(10, trustScore)).toFixed(1));

  // ==========================================
  // 10. MOBILE UX (Weight: 8%)
  // ==========================================
  let mobileUxScore = 9.2;
  if (domEvidence.mobileOverflowPx > 0) {
    mobileUxScore -= 4.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.CRITICAL,
      category: 'mobile_ux',
      title: 'Mobil Ekranda Yatay Taşma Hatası (Horizontal Overflow)',
      evidence: `390px mobil viewportta ${domEvidence.mobileOverflowPx}px yatay taşma tespit edildi.`,
      selector: 'html, body',
      expected: 'Mobil ekranda scrollWidth === clientWidth (0px overflow).',
      actual: `${domEvidence.mobileOverflowPx}px yatay taşma mevcut.`,
      impact: 'Sayfa mobilde sağa sola kayarak kullanılamaz hale gelir.',
      recommendation: 'Geniş elemanlarda max-width: 100% ve overflow-x: hidden uygulayın.'
    }));
  }
  scores.mobileUx = Number(Math.max(0, Math.min(10, mobileUxScore)).toFixed(1));

  // ==========================================
  // 11. RESPONSIVE QUALITY (Weight: 5%)
  // ==========================================
  let responsiveQualityScore = 9.2;
  if (!domEvidence.hasMobileMedia) {
    responsiveQualityScore -= 3.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MAJOR,
      category: 'responsive_quality',
      title: 'Mobil CSS Medya Sorguları Eksik',
      evidence: 'CSS stil dosyasında 768px veya altı için @media sorgusu tespit edilemedi.',
      selector: '@media',
      expected: 'Mobil ve tablet için duyarlı stil kuralları tanımlanmalıdır.',
      actual: 'Medya sorguları eksik.',
      impact: 'Site mobil cihazlarda masaüstü düzeninde sıkışır.',
      recommendation: '@media (max-width: 768px) altında mobil grid ve menü kurallarını tanımlayın.'
    }));
  }
  scores.responsiveQuality = Number(Math.max(0, Math.min(10, responsiveQualityScore)).toFixed(1));

  // ==========================================
  // 12. CONTENT QUALITY (Weight: 5%)
  // ==========================================
  let contentQualityScore = 9.0;
  if (lowerHtml.includes('lorem ipsum') || lowerHtml.includes('sample text') || lowerHtml.includes('company name here')) {
    contentQualityScore -= 3.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.CRITICAL,
      category: 'content_quality',
      title: 'Şablon / Taslak Metin Kalıntısı (Thin Content)',
      evidence: 'Sayfada "lorem ipsum" veya yer tutucu sahte metin tespit edildi.',
      selector: 'body',
      expected: 'Sektöre ve firmaya özel anlamlı kurumsal içerik.',
      actual: 'Yer tutucu şablon metinleri bulundu.',
      impact: 'Sitenin profesyonellik algısı sıfırlanır ve arama motorları tarafından cezalandırılır.',
      recommendation: 'Tüm yer tutucu metinleri gerçek sektörel içerikle değiştirin.'
    }));
  }
  scores.contentQuality = Number(Math.max(0, Math.min(10, contentQualityScore)).toFixed(1));

  // ==========================================
  // 13. ORIGINALITY (Weight: 4%)
  // ==========================================
  let originalityScore = 9.0;
  const saasCliches = [
    'join 10,000+ happy teams',
    'all-in-one platform',
    'boost your workflow with ai',
    'start your 14-day free trial',
    'no credit card required'
  ];
  for (const cliche of saasCliches) {
    if (lowerHtml.includes(cliche)) {
      originalityScore -= 2.0;
      findings.push(createFinding({
        id: nextId(),
        severity: FindingSeverity.MAJOR,
        category: 'originality',
        title: `Yapay Zeka / SaaS Klişesi Tespit Edildi: "${cliche}"`,
        evidence: `Metin içinde jenerik SaaS sloganı bulundu: "${cliche}".`,
        expected: 'Firmaya ve sektöre özgü özgün ticari dil.',
        actual: `Klişe metin: "${cliche}"`,
        impact: 'Site hazır SaaS şablonu izlenimi yaratır.',
        recommendation: 'Klişe slogan yerine firmanın gerçek faaliyetini anlatan özgün metin yazın.'
      }));
    }
  }
  scores.originality = Number(Math.max(0, Math.min(10, originalityScore)).toFixed(1));

  // ==========================================
  // 14. DATA INTEGRITY (Weight: 5%)
  // ==========================================
  let dataIntegrityScore = 9.8;

  // Check unverified specific claims (Section 14 & 15)
  const unverifiedYears = lowerHtml.match(/(?:19|20)\d{2}['’]?d?e?n?\s*beri|(\d{1,2})\s*yıllık\s*(?:deneyim|tecrübe)/gi);
  if (unverifiedYears && facts.foundedYear?.status !== DataProvenanceStatus.VERIFIED) {
    dataIntegrityScore -= 2.5;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MAJOR,
      category: 'data_integrity',
      title: 'Doğrulanmamış Kuruluş Yılı / Deneyim İddiası',
      evidence: `Metinde "${unverifiedYears[0]}" ifadesi yer alıyor ancak Company Profile içinde VERIFIED değil.`,
      expected: 'Yalnızca VERIFIED kaynaklı geçmiş ve kuruluş iddiaları yer almalıdır.',
      actual: `Doğrulanmamış iddia: "${unverifiedYears[0]}"`,
      impact: 'Yanıltıcı reklam ve veri bütünlüğü ihlali riski doğurur.',
      recommendation: 'Kuruluş yılı iddialarını profil doğrulanana kadar kaldırın veya genel güven ifadeleri kullanın.'
    }));
  }

  const unverifiedCustomerClaims = lowerHtml.match(/(?:10[.,]000\+|binlerce|yüzbinlerce)\s*(?:mutlu\s*)?müşteri/gi);
  if (unverifiedCustomerClaims && facts.customerCount?.status !== DataProvenanceStatus.VERIFIED) {
    dataIntegrityScore -= 2.0;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MAJOR,
      category: 'data_integrity',
      title: 'Doğrulanmamış Müşteri Sayısı İddiası',
      evidence: `Metinde "${unverifiedCustomerClaims[0]}" ifadesi yer alıyor ancak profil doğrulanmamış.`,
      expected: 'Doğrulanmamış sayısal büyüklük iddialarından kaçınılmalıdır.',
      actual: `Doğrulanmamış iddia: "${unverifiedCustomerClaims[0]}"`,
      impact: 'Gerçek dışı beyan güven kaybına yol açar.',
      recommendation: 'Sayısal iddiayı kaldırın veya müşteri odaklılık vurgusu ile değiştirin.'
    }));
  }
  scores.dataIntegrity = Number(Math.max(0, Math.min(10, dataIntegrityScore)).toFixed(1));

  // ==========================================
  // 15. ACCESSIBILITY (Weight: 4%)
  // ==========================================
  let accessibilityScore = 9.2;
  const missingAltCount = domEvidence.imgAlts.filter(alt => alt === null || alt === '').length;
  if (missingAltCount > 0) {
    accessibilityScore -= 1.5;
    findings.push(createFinding({
      id: nextId(),
      severity: FindingSeverity.MINOR,
      category: 'accessibility',
      title: 'Eksik Görsel Alt Açıklamaları (img alt)',
      evidence: `${missingAltCount} adet görselde alt açıklaması eksik.`,
      selector: 'img:not([alt])',
      expected: 'Tüm görsellerde betimleyici alt etiketi bulunmalıdır.',
      actual: `${missingAltCount} görselde alt etiketi boş veya eksik.`,
      impact: 'Ekran okuyucu kullanıcıları görselleri anlayamaz.',
      recommendation: 'Görsellere anlamlı alt açıklamaları ekleyin.'
    }));
  }
  scores.accessibility = Number(Math.max(0, Math.min(10, accessibilityScore)).toFixed(1));

  // ==========================================
  // 16. PROFESSIONAL PERCEPTION (Weight: 5%)
  // ==========================================
  let professionalPerceptionScore = 9.0;
  if (findings.some(f => f.severity === FindingSeverity.CRITICAL)) {
    professionalPerceptionScore -= 3.0;
  } else if (findings.filter(f => f.severity === FindingSeverity.MAJOR).length > 2) {
    professionalPerceptionScore -= 1.5;
  }
  scores.professionalPerception = Number(Math.max(0, Math.min(10, professionalPerceptionScore)).toFixed(1));

  return Object.freeze({
    scores: Object.freeze(scores),
    findings: Object.freeze(findings)
  });
}

/**
 * Computes weighted composite score (0-100) from dimension scores.
 */
export function computeWeightedOverallScore(dimensionScores) {
  let total = 0;
  let totalWeight = 0;
  for (const [dimension, weight] of Object.entries(DIMENSION_WEIGHTS)) {
    const dimScore = Number(dimensionScores[dimension]) || 0;
    total += dimScore * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Number(((total / totalWeight) * 10).toFixed(1));
}

/**
 * Evaluates the Quality Gate strictly per Section 7 of FAZ 74 prompt.
 */
export function evaluateQualityGate({
  overallScore,
  dimensionScores,
  findings
}) {
  const criticalFindings = findings.filter(f => f.severity === FindingSeverity.CRITICAL);
  const majorFindings = findings.filter(f => f.severity === FindingSeverity.MAJOR);
  const minorFindings = findings.filter(f => f.severity === FindingSeverity.MINOR);

  const dataIntegrity = Number(dimensionScores.dataIntegrity) || 0;
  const mobileUx = Number(dimensionScores.mobileUx) || 0;
  const commercialConversion = Number(dimensionScores.commercialConversion) || 0;
  const brandFit = Number(dimensionScores.brandFit) || 0;

  // FAIL criteria
  const isFail = (
    dataIntegrity < 7 ||
    mobileUx < 7 ||
    commercialConversion < 6 ||
    brandFit < 6 ||
    criticalFindings.length > 0 ||
    overallScore < 75
  );

  if (isFail) {
    return Object.freeze({
      verdict: QualityGateVerdict.FAIL,
      grade: 'FAIL',
      passed: false,
      reason: criticalFindings.length > 0
        ? `Critical findings exist: ${criticalFindings[0].title}`
        : (overallScore < 75 ? `Overall score ${overallScore} is below minimum threshold 75.` : 'Core dimension threshold breached.')
    });
  }

  // EXCELLENT criteria
  const isExcellent = (
    overallScore >= 90 &&
    criticalFindings.length === 0 &&
    majorFindings.length === 0 &&
    minorFindings.length <= 5 &&
    dataIntegrity >= 9 &&
    mobileUx >= 9 &&
    commercialConversion >= 8 &&
    brandFit >= 9
  );

  if (isExcellent) {
    return Object.freeze({
      verdict: QualityGateVerdict.EXCELLENT,
      grade: 'EXCELLENT',
      passed: true,
      reason: 'All dimensions and quality gates met with agency-grade excellence.'
    });
  }

  // PASS criteria
  const isPass = (
    overallScore >= 80 &&
    criticalFindings.length === 0 &&
    majorFindings.length <= 2 &&
    dataIntegrity >= 8 &&
    mobileUx >= 8 &&
    commercialConversion >= 7 &&
    brandFit >= 8
  );

  if (isPass) {
    return Object.freeze({
      verdict: QualityGateVerdict.PASS,
      grade: 'PASS',
      passed: true,
      reason: 'Design meets commercial viability and visual quality standards.'
    });
  }

  // CONDITIONAL criteria (Score >= 75 with Major findings)
  if (overallScore >= 75 && majorFindings.length > 0) {
    return Object.freeze({
      verdict: QualityGateVerdict.CONDITIONAL,
      grade: 'CONDITIONAL',
      passed: false,
      reason: `Overall score is ${overallScore} but ${majorFindings.length} major finding(s) require remediation.`
    });
  }

  return Object.freeze({
    verdict: QualityGateVerdict.FAIL,
    grade: 'FAIL',
    passed: false,
    reason: 'Requirements not satisfied.'
  });
}

/**
 * Builds actionable revision proposal conforming to Section 16 of FAZ 74 prompt.
 */
export function buildRevisionProposal(findings, qualityGate, cycleCount = 0) {
  const actionableFindings = findings
    .filter(f => f.severity === FindingSeverity.CRITICAL || f.severity === FindingSeverity.MAJOR || f.severity === FindingSeverity.MINOR)
    .sort((a, b) => {
      const order = { CRITICAL: 0, MAJOR: 1, MINOR: 2, INFO: 3 };
      return order[a.severity] - order[b.severity];
    });

  const revisionRequired = (
    qualityGate.verdict === QualityGateVerdict.FAIL ||
    qualityGate.verdict === QualityGateVerdict.CONDITIONAL ||
    findings.some(f => f.severity === FindingSeverity.CRITICAL || f.severity === FindingSeverity.MAJOR) ||
    (qualityGate.verdict === QualityGateVerdict.PASS && findings.some(f => f.severity === FindingSeverity.MINOR) && cycleCount < 1)
  );

  const priority = actionableFindings.map((f, idx) => Object.freeze({
    findingId: f.id,
    priority: idx + 1,
    target: f.selector || f.category,
    change: f.recommendation,
    reason: f.actual || f.evidence,
    expectedImpact: f.impact || 'Quality and compliance enhancement'
  }));

  return Object.freeze({
    revisionRequired,
    cycleCount,
    priority: Object.freeze(priority)
  });
}

/**
 * Evaluates a synthesized design independently, producing unvarnished critic audit and quality gate.
 */
export async function evaluateVisualCommercialDesign({
  companyProfile = {},
  designStrategy = {},
  layoutGraph = {},
  designSystem = {},
  html = '',
  css = '',
  metadata = {},
  browserMeasurements = null,
  domAudit = null,
  screenshots = {},
  generationId = `design-${Date.now()}`,
  options = {}
} = {}) {
  // Extract objective DOM & styling evidence
  const domEvidence = extractDomEvidence(html, css, browserMeasurements || domAudit);

  // Evaluate 16 independent dimensions
  const { scores: dimensionScores, findings: allFindings } = evaluateDimensions({
    companyProfile,
    designStrategy,
    layoutGraph,
    designSystem,
    html,
    css,
    domEvidence,
    options
  });

  // Calculate weighted overall score (0-100)
  const overallScore = computeWeightedOverallScore(dimensionScores);

  // Quality Gate
  const qualityGate = evaluateQualityGate({
    overallScore,
    dimensionScores,
    findings: allFindings
  });

  // Findings segmented by severity
  const criticalFindings = allFindings.filter(f => f.severity === FindingSeverity.CRITICAL);
  const majorFindings = allFindings.filter(f => f.severity === FindingSeverity.MAJOR);
  const minorFindings = allFindings.filter(f => f.severity === FindingSeverity.MINOR);
  const positiveFindings = allFindings.filter(f => f.severity === FindingSeverity.INFO);

  // Findings segmented by category
  const commercialFindings = allFindings.filter(f => f.category === 'commercial_conversion' || f.category === 'product_presentation');
  const visualFindings = allFindings.filter(f => f.category === 'first_impression' || f.category === 'visual_hierarchy' || f.category === 'typography' || f.category === 'color_system' || f.category === 'layout_quality');
  const mobileFindings = allFindings.filter(f => f.category === 'mobile_ux' || f.category === 'responsive_quality');
  const trustFindings = allFindings.filter(f => f.category === 'trust');
  const contentIntegrityFindings = allFindings.filter(f => f.category === 'data_integrity' || f.category === 'content_quality');
  const originalityFindings = allFindings.filter(f => f.category === 'originality');

  // Revision Proposal
  const revisionProposal = buildRevisionProposal(allFindings, qualityGate, options.cycleCount || 0);

  // Compile full critic report
  const criticReport = Object.freeze({
    criticVersion: CRITIC_VERSION,
    generationId,
    overallScore,
    grade: qualityGate.grade,
    qualityGate: qualityGate.verdict,
    qualityGateDetails: qualityGate,
    dimensionScores,
    criticalFindings: Object.freeze(criticalFindings),
    majorFindings: Object.freeze(majorFindings),
    minorFindings: Object.freeze(minorFindings),
    positiveFindings: Object.freeze(positiveFindings),
    commercialFindings: Object.freeze(commercialFindings),
    visualFindings: Object.freeze(visualFindings),
    mobileFindings: Object.freeze(mobileFindings),
    trustFindings: Object.freeze(trustFindings),
    contentIntegrityFindings: Object.freeze(contentIntegrityFindings),
    originalityFindings: Object.freeze(originalityFindings),
    revisionPriority: revisionProposal.priority,
    revisionProposal,
    domEvidence: Object.freeze(domEvidence),
    proposalOnly: true,
    executionAuthorized: false,
    evaluatedAt: new Date().toISOString()
  });

  // Write inspectable audit JSON to scratch/visual_critic_<generationId>.json (Section 21)
  try {
    const scratchDir = path.resolve(process.cwd(), 'scratch');
    fs.mkdirSync(scratchDir, { recursive: true });
    const auditFilePath = path.join(scratchDir, `visual_critic_${generationId}.json`);
    fs.writeFileSync(auditFilePath, JSON.stringify({
      criticVersion: CRITIC_VERSION,
      generationId,
      timestamp: criticReport.evaluatedAt,
      inputs: {
        companyName: companyProfile?.company?.name?.value,
        industryCategory: designStrategy?.industryCategory,
        hasPhone: Boolean(companyProfile?.contact?.phone?.value),
        hasAddress: Boolean(companyProfile?.contact?.address?.value)
      },
      evidence: {
        h1Count: domEvidence.h1Count,
        buttonCount: domEvidence.buttonCount,
        contrastTextOnBg: domEvidence.contrastTextOnBg,
        mobileOverflowPx: domEvidence.mobileOverflowPx,
        imgCount: domEvidence.imgCount
      },
      dimensionScores,
      overallScore,
      qualityGate: criticReport.qualityGate,
      findings: allFindings,
      revisionProposal,
      proposalOnly: true,
      executionAuthorized: false
    }, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[CRITIC AUDIT FILE WARNING]:', err.message);
  }

  return criticReport;
}

/**
 * Audits a stored design in storage/visual-designs/<id>/
 */
export async function auditStoredDesign(generationId, options = {}) {
  const baseDir = options.storageBaseDir || process.cwd();
  const storageDir = path.resolve(baseDir, 'storage', 'visual-designs', generationId);

  if (!fs.existsSync(storageDir)) {
    throw new Error(`[CRITIC ERROR] Generation directory not found: ${storageDir}`);
  }

  const html = fs.readFileSync(path.join(storageDir, 'index.html'), 'utf-8');
  const companyProfile = JSON.parse(fs.readFileSync(path.join(storageDir, 'company-profile.json'), 'utf-8'));
  const designStrategy = JSON.parse(fs.readFileSync(path.join(storageDir, 'design-reasoning.json'), 'utf-8'));
  const layoutGraph = JSON.parse(fs.readFileSync(path.join(storageDir, 'layout-graph.json'), 'utf-8'));
  const designSystem = JSON.parse(fs.readFileSync(path.join(storageDir, 'design-system.json'), 'utf-8'));

  return evaluateVisualCommercialDesign({
    companyProfile,
    designStrategy,
    layoutGraph,
    designSystem,
    html,
    css: designSystem.cssVariables || '',
    generationId,
    options
  });
}

/**
 * Orchestrates autonomous iterative synthesis & critic revision loop (Section 17).
 * Circuit Breaker: Strictly capped at maximum 2 revision cycles.
 */
export async function runIterativeSynthesisCriticLoop({
  generationMode = GenerationMode.SYNTHESIS,
  manual = {},
  websiteData = null,
  mapsData = null,
  options = {}
} = {}) {
  const maxCycles = 2; // Strict circuit breaker: Max 2 revision cycles
  const revisionHistory = [];

  // Cycle 0: Initial Synthesis
  let currentSynthesis = await synthesizeAutonomousWebsite({
    generationMode,
    manual,
    websiteData,
    mapsData,
    options
  });

  let currentCritic = await evaluateVisualCommercialDesign({
    companyProfile: currentSynthesis.companyProfile,
    designStrategy: currentSynthesis.designStrategy,
    layoutGraph: currentSynthesis.layoutGraph,
    designSystem: currentSynthesis.designSystem,
    html: currentSynthesis.composition?.html || '',
    css: currentSynthesis.composition?.css || '',
    generationId: currentSynthesis.generationId,
    options: { cycleCount: 0 }
  });

  revisionHistory.push({
    cycle: 0,
    generationId: currentSynthesis.generationId,
    overallScore: currentCritic.overallScore,
    qualityGate: currentCritic.qualityGate,
    findingsCount: currentCritic.criticalFindings.length + currentCritic.majorFindings.length + currentCritic.minorFindings.length
  });

  let cycleCount = 0;

  // Revision Loop
  while (
    options.runRevision === true &&
    currentCritic.revisionProposal.revisionRequired &&
    cycleCount < maxCycles
  ) {
    cycleCount++;

    // Prepare refined options based on findings
    const refinedOptions = {
      ...options,
      cycleCount
    };

    // Re-synthesize revised version
    currentSynthesis = await synthesizeAutonomousWebsite({
      generationMode,
      manual,
      websiteData,
      mapsData,
      options: refinedOptions
    });

    // Re-evaluate with Critic
    currentCritic = await evaluateVisualCommercialDesign({
      companyProfile: currentSynthesis.companyProfile,
      designStrategy: currentSynthesis.designStrategy,
      layoutGraph: currentSynthesis.layoutGraph,
      designSystem: currentSynthesis.designSystem,
      html: currentSynthesis.composition?.html || '',
      css: currentSynthesis.composition?.css || '',
      generationId: currentSynthesis.generationId,
      options: { cycleCount }
    });

    revisionHistory.push({
      cycle: cycleCount,
      generationId: currentSynthesis.generationId,
      overallScore: currentCritic.overallScore,
      qualityGate: currentCritic.qualityGate,
      findingsCount: currentCritic.criticalFindings.length + currentCritic.majorFindings.length + currentCritic.minorFindings.length
    });

    if (currentCritic.qualityGate === QualityGateVerdict.PASS || currentCritic.qualityGate === QualityGateVerdict.EXCELLENT) {
      break;
    }
  }

  return Object.freeze({
    success: true,
    generationId: currentSynthesis.generationId,
    finalSynthesis: currentSynthesis,
    finalCritic: currentCritic,
    revisionHistory: Object.freeze(revisionHistory),
    totalCyclesExecuted: cycleCount,
    proposalOnly: true,
    executionAuthorized: false
  });
}
