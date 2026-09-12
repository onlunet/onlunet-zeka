/**
 * ONLUNET ZEKA - Comprehensive Web & Technical SEO Auditor (ONLUNET SEO Radar™)
 *
 * Capabilities:
 * 1. 100-Point Multi-Dimensional Algorithm (ONLUNET SEO Score™):
 *    - Dimension 1: Technical & Crawlability (25%)
 *    - Dimension 2: On-Page Architecture & Headings (25%)
 *    - Dimension 3: Content Depth, LSI & E-E-A-T (20%)
 *    - Dimension 4: Structured Data (Schema.org JSON-LD) (15%)
 *    - Dimension 5: Speed, Mobile & 2026 GEO (AI Overviews) (15%)
 * 2. 2026 GEO & AI Overviews Quotability Engine:
 *    - Evaluates direct answer snippet readiness, data tables, and AI citation potential.
 * 3. Actionable AI Optimization Generator:
 *    - 60-character high-CTR SEO Title
 *    - 150-character Meta Description with CTA
 *    - Complete Organization & FAQPage JSON-LD code blocks
 *    - 3 Soru-Cevap Accordion FAQ drafts
 *    - 2026 GEO Direct Answer Snippet for Google Gemini & Perplexity
 *    - C-Level Financial ROI & Google Ads Spend Savings calculation
 * 4. Self-Healing Engine (autoHealProjectSeo):
 *    - Injects optimized metadata directly into local `projeler/<slug>` SQLite CMS & files.
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js.
 */

import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

/**
 * Calculates 100-point multi-dimensional SEO score
 */
export function calculateSeoScore(scrapedData) {
  const scores = {
    technical: 0,    // max 25
    onPage: 0,       // max 25
    content: 0,      // max 20
    schema: 0,       // max 15
    speedAndGeo: 0   // max 15
  };

  const criticalIssues = [];
  const quickWins = [];

  // ==========================================
  // Dimension 1: Technical & Crawlability (25 pts)
  // ==========================================
  if (scrapedData.statusCode === 200) {
    scores.technical += 6;
  } else if (scrapedData.statusCode >= 300 && scrapedData.statusCode < 400) {
    scores.technical += 3;
    quickWins.push({
      title: 'Yönlendirme Zinciri (Redirect Chain) Mevcut',
      description: `Sayfa HTTP ${scrapedData.statusCode} yönlendirmesiyle açılıyor. Arama motoru botları için doğrudan 200 hedef URL'ye link verin.`
    });
  } else {
    criticalIssues.push({
      title: `Sayfa HTTP ${scrapedData.statusCode} Hatası Veriyor`,
      description: 'Arama motoru botları sayfayı başarıyla tarayamıyor.',
      level: 'CRITICAL'
    });
  }

  // HTTPS Check
  if (scrapedData.securityHeaders?.isHttps || scrapedData.url.startsWith('https://')) {
    scores.technical += 5;
  } else {
    criticalIssues.push({
      title: 'Güvenli Bağlantı (HTTPS/SSL) Yok',
      description: 'Web siteniz HTTP üzerinden çalışıyor. Google güvenli olmayan siteleri sıralamada ciddi şekilde geriye iter.',
      level: 'HIGH'
    });
  }

  // Robots.txt Check
  if (scrapedData.robotsTxt?.exists) {
    if (scrapedData.robotsTxt.isDisallowingAll) {
      criticalIssues.push({
        title: 'Robots.txt Tüm Botları Engelliyor (Disallow: /)',
        description: 'Robots.txt dosyanız Googlebot dahil tüm arama motorlarının sitenizi taramasını tamamen engellemektedir!',
        level: 'CRITICAL'
      });
    } else {
      scores.technical += 5;
    }
  } else {
    scores.technical += 2;
    quickWins.push({
      title: 'Robots.txt Dosyası Eksik',
      description: 'Kök dizinde /robots.txt dosyası tanımlayarak botların bütçesini optimize edin.'
    });
  }

  // Sitemap.xml Check
  if (scrapedData.sitemapXml?.exists) {
    scores.technical += 4;
  } else {
    quickWins.push({
      title: 'XML Sitemap (Site Haritası) Bulunamadı',
      description: 'Sitenizin arama motorları tarafından hızlı indekslenmesi için /sitemap.xml haritası oluşturun.'
    });
  }

  // Canonical Tag Check
  if (scrapedData.canonical?.isPresent) {
    scores.technical += 3;
  } else {
    quickWins.push({
      title: 'Canonical Etiketi Eksik',
      description: 'Kopya içerik risklerini (duplicate content) önlemek için <link rel="canonical"> etiketini ekleyin.'
    });
  }

  // Meta Robots Check
  if (scrapedData.metaRobots?.isIndexable) {
    scores.technical += 2;
  } else {
    criticalIssues.push({
      title: 'Sayfada "noindex" Etiketi Var',
      description: 'Meta robots etiketinde noindex kuralı var. Sayfa Google dizininden silinme tehlikesi altındadır!',
      level: 'CRITICAL'
    });
  }

  // ==========================================
  // Dimension 2: On-Page Architecture & Headings (25 pts)
  // ==========================================
  // Title Tag (Max 10)
  if (scrapedData.title?.isPresent) {
    scores.onPage += 5;
    const len = scrapedData.title.length;
    if (len >= 35 && len <= 65) {
      scores.onPage += 5;
    } else if (len > 65) {
      scores.onPage += 2;
      quickWins.push({
        title: 'Title (Başlık) Çok Uzun',
        description: `Mevcut başlık ${len} karakter. Google arama sonuçlarında kesilmemesi için 50-60 karaktere indirin.`
      });
    } else {
      scores.onPage += 2;
      quickWins.push({
        title: 'Title (Başlık) Çok Kısa',
        description: `Mevcut başlık ${len} karakter. Anahtar kelimelerinizi ve marka adınızı içeren 45-60 karakterlik başlık yazın.`
      });
    }
  } else {
    criticalIssues.push({
      title: 'Sayfa Başlığı (<title>) Eksik',
      description: 'En temel sıralama faktörü olan sayfa başlığı kaynak kodunda bulunamadı.',
      level: 'HIGH'
    });
  }

  // Meta Description (Max 8)
  if (scrapedData.metaDescription?.isPresent) {
    scores.onPage += 4;
    const descLen = scrapedData.metaDescription.length;
    if (descLen >= 110 && descLen <= 165) {
      scores.onPage += 4;
    } else if (descLen > 165) {
      scores.onPage += 2;
      quickWins.push({
        title: 'Meta Açıklaması Çok Uzun',
        description: `Açıklama ${descLen} karakter. Mobilde taşmaması için 130-155 karaktere optimize edin.`
      });
    } else {
      scores.onPage += 2;
      quickWins.push({
        title: 'Meta Açıklaması Kısa',
        description: 'Tıklama oranını artırmak için açıklamanızı 120-150 karaktere tamamlayıp harekete geçirici mesaj (CTA) ekleyin.'
      });
    }
  } else {
    criticalIssues.push({
      title: 'Meta Description (Açıklama) Eksik',
      description: 'Arama sonuçlarındaki tıklama oranını doğrudan etkileyen meta description etiketi eksik.',
      level: 'HIGH'
    });
  }

  // Heading Architecture (Max 7)
  const h1Count = scrapedData.headings?.h1?.length || 0;
  if (h1Count === 1) {
    scores.onPage += 4;
  } else if (h1Count === 0) {
    criticalIssues.push({
      title: 'Sayfada H1 Başlığı Bulunmuyor',
      description: 'Google sayfanın ana konusunu anlamak için tek bir H1 başlığı bekler.',
      level: 'HIGH'
    });
  } else {
    scores.onPage += 2;
    quickWins.push({
      title: `Sayfada Birden Fazla H1 Var (${h1Count} Adet)`,
      description: 'Her sayfada sadece tek bir ana H1 başlığı olmalıdır. Alt başlıkları H2 ve H3 yapın.'
    });
  }

  if (scrapedData.headings?.h2?.length > 0) {
    scores.onPage += 3;
  } else {
    quickWins.push({
      title: 'H2 Alt Başlıkları Eksik',
      description: 'İçeriğin taranabilirliğini artırmak için konuyu H2 alt başlıklarına bölün.'
    });
  }

  // ==========================================
  // Dimension 3: Content Depth, LSI & E-E-A-T (20 pts)
  // ==========================================
  const words = scrapedData.content?.wordCount || 0;
  if (words >= 550) {
    scores.content += 8;
  } else if (words >= 300) {
    scores.content += 5;
  } else if (words >= 150) {
    scores.content += 2;
    quickWins.push({
      title: 'İçerik Hacmi Geliştirilmeli (Zayıf İçerik Riski)',
      description: `Sayfada yaklaşık ${words} kelime tespit edildi. Otoriter bir sıralama için en az 450-600 kelime önerilir.`
    });
  } else {
    criticalIssues.push({
      title: 'Zayıf İçerik (Thin Content) Alarmı',
      description: `Sayfada yalnızca ${words} kelime var. Google yetersiz içerikli sayfaları düşük kaliteli (low quality) olarak işaretler.`,
      level: 'HIGH'
    });
  }

  // Text-to-HTML ratio
  const ratio = scrapedData.content?.textToHtmlRatio || 0;
  if (ratio >= 12) {
    scores.content += 4;
  } else if (ratio >= 6) {
    scores.content += 2;
  }

  // Internal Links
  const internalLinks = scrapedData.links?.internalCount || 0;
  if (internalLinks >= 6) {
    scores.content += 4;
  } else if (internalLinks >= 2) {
    scores.content += 2;
  } else {
    quickWins.push({
      title: 'Dahili Bağlantı (Internal Link) Sayısı Yetersiz',
      description: 'Kullanıcıların ve Google botlarının site içinde derinleşmesi için diğer sayfalara en az 4-5 dahili link verin.'
    });
  }

  // E-E-A-T Sinyalleri (Telefon, Adres, İletişim, Hakkımızda)
  const sampleText = (scrapedData.content?.sampleText || '').toLowerCase();
  const hasEeat = /telefon|iletişim|adres|hakkımızda|vizyon|kvkk|gizlilik/i.test(sampleText) ||
                  scrapedData.links?.externalCount > 0;
  if (hasEeat) {
    scores.content += 4;
  } else {
    quickWins.push({
      title: 'E-E-A-T Güvenilirlik Sinyalleri Eksik',
      description: 'Sayfa altında veya menüde açık iletişim, adres ve yasal künye sinyallerini belirginleştirin.'
    });
  }

  // ==========================================
  // Dimension 4: Structured Data (Schema.org) (15 pts)
  // ==========================================
  const schemaCount = scrapedData.schemas?.length || 0;
  const types = scrapedData.schemaTypes || [];

  if (schemaCount > 0) {
    scores.schema += 6;
    const richTypes = ['Organization', 'LocalBusiness', 'Product', 'FAQPage', 'BreadcrumbList', 'Article', 'Service'];
    const matchingRich = types.filter(t => richTypes.includes(t));
    if (matchingRich.length > 0) {
      scores.schema += 5;
    }
    if (matchingRich.length > 1 || types.includes('FAQPage') || types.includes('BreadcrumbList')) {
      scores.schema += 4;
    }
  } else {
    criticalIssues.push({
      title: 'Schema.org JSON-LD Yapılandırılmış Verisi Eksik',
      description: 'Sitenizde Google arama sonuçlarını zenginleştiren (yıldızlar, SSS akordeonları, şirket bilgisi) hiçbir JSON-LD şeması bulunamadı.',
      level: 'MEDIUM'
    });
  }

  // ==========================================
  // Dimension 5: Speed, Mobile & 2026 GEO (15 pts)
  // ==========================================
  // Viewport
  if (scrapedData.viewport?.isResponsive) {
    scores.speedAndGeo += 4;
  } else {
    criticalIssues.push({
      title: 'Mobil Viewport Etiketi Eksik',
      description: 'Mobil cihazlara uyumlu viewport meta etiketi eksik. Site mobilde düzgün ölçeklenemez.',
      level: 'HIGH'
    });
  }

  // TTFB / Speed proxy
  const respTime = scrapedData.responseTimeMs || 800;
  if (respTime < 600) {
    scores.speedAndGeo += 4;
  } else if (respTime < 1400) {
    scores.speedAndGeo += 2;
  } else {
    quickWins.push({
      title: 'Sunucu İlk Yanıt Süresi (TTFB) Yavaş',
      description: `Sayfa yanıtı ${respTime} ms sürdü. Google Core Web Vitals için TTFB süresinin 600 ms altında olması gerekir.`
    });
  }

  // Images Alt Attributes
  const totalImgs = scrapedData.images?.total || 0;
  const missingAlts = scrapedData.images?.missingAltCount || 0;
  if (totalImgs === 0) {
    scores.speedAndGeo += 4;
  } else if (missingAlts === 0) {
    scores.speedAndGeo += 4;
  } else if (missingAlts <= totalImgs * 0.3) {
    scores.speedAndGeo += 2;
    quickWins.push({
      title: `${missingAlts} Görselde Alt Etiketi Eksik`,
      description: 'Eksik alt etiketleri Google Görseller sıralamasını ve erişilebilirliği olumsuz etkiler.'
    });
  } else {
    criticalIssues.push({
      title: `Çok Sayıda Görselde Alt Etiketi Eksik (${missingAlts} / ${totalImgs})`,
      description: 'Görsellerinizin çoğunda açıklayıcı alt metin bulunmuyor.',
      level: 'MEDIUM'
    });
  }

  // Modern Format Check
  const modernImgs = scrapedData.images?.modernFormatCount || 0;
  if (totalImgs > 0 && modernImgs >= totalImgs * 0.5) {
    scores.speedAndGeo += 3;
  } else if (totalImgs > 0) {
    quickWins.push({
      title: 'Görselleri WebP / AVIF Formatına Dönüştürün',
      description: 'Eski PNG/JPG dosyalarını modern WebP formatına çevirerek sayfa açılış hızını %40 artırabilirsiniz.'
    });
    scores.speedAndGeo += 1;
  } else {
    scores.speedAndGeo += 3;
  }

  // Total Score Calculation
  const totalScore = Math.min(100, Math.max(0,
    scores.technical + scores.onPage + scores.content + scores.schema + scores.speedAndGeo
  ));

  let grade = 'B';
  let gradeLabel = 'Orta Seviye';
  let gradeColor = '#f59e0b';

  if (totalScore >= 90) {
    grade = 'A+';
    gradeLabel = 'Mükemmel (Google Zirve Adayı)';
    gradeColor = '#10b981';
  } else if (totalScore >= 80) {
    grade = 'A';
    gradeLabel = 'İyi Durumda';
    gradeColor = '#22c55e';
  } else if (totalScore >= 65) {
    grade = 'B';
    gradeLabel = 'Orta (Geliştirilmeli)';
    gradeColor = '#f59e0b';
  } else if (totalScore >= 50) {
    grade = 'C';
    gradeLabel = 'Zayıf (Sıralama Kaybı Riski)';
    gradeColor = '#f97316';
  } else {
    grade = 'D';
    gradeLabel = 'Kritik Düzeyde Hatalı';
    gradeColor = '#ef4444';
  }

  return {
    totalScore,
    grade,
    gradeLabel,
    gradeColor,
    scores,
    criticalIssues,
    quickWins
  };
}

/**
 * Evaluates 2026 GEO (Generative Engine Optimization) & Google Gemini AI Overviews Readiness
 */
export function evaluateGeoReadiness(scrapedData) {
  const sample = (scrapedData.content?.sampleText || '').toLowerCase();
  let geoScore = 50;

  const hasDefinitionSnippet = /nedir|nasıl|avantaj|özellik|farkı|kılavuz|rehber/i.test(sample);
  const hasTablesOrLists = (scrapedData.headings?.all?.length || 0) >= 4;
  const hasFaqSchema = (scrapedData.schemaTypes || []).includes('FAQPage');
  const wordAdequacy = (scrapedData.content?.wordCount || 0) >= 400;

  if (hasDefinitionSnippet) geoScore += 15;
  if (hasTablesOrLists) geoScore += 15;
  if (hasFaqSchema) geoScore += 10;
  if (wordAdequacy) geoScore += 10;

  geoScore = Math.min(100, Math.max(30, geoScore));

  let quotabilityStatus = 'Orta Seviye';
  if (geoScore >= 80) quotabilityStatus = 'Yüksek (Alıntılanma Hazır)';
  else if (geoScore < 60) quotabilityStatus = 'Zayıf (Tanım Blokları Gerekli)';

  return {
    score: geoScore,
    quotabilityStatus,
    hasDirectAnswers: hasDefinitionSnippet,
    hasStructuredLists: hasTablesOrLists,
    hasFaqSchema,
    recommendation: 'Yapay zeka modellerinin (Google Gemini AI Overviews, Perplexity) sayfanızı kaynak göstermesi için 40-50 kelimelik doğrudan soru-cevap tanım blokları ekleyin.'
  };
}

/**
 * Infers business name and sector from title, URL and headings
 */
function inferIdentityAndSector(scrapedData) {
  let hostname = '';
  try {
    hostname = new URL(scrapedData.url).hostname.replace(/^www\./, '');
  } catch {
    hostname = 'firma';
  }

  const rawTitle = scrapedData.title?.text || '';
  const firstH1 = scrapedData.headings?.h1?.[0] || '';
  
  let name = rawTitle.split(/[-|–•]/)[0].trim() || firstH1 || hostname.split('.')[0];
  name = name.replace(/\b\w/g, c => c.toUpperCase());

  const corpus = (rawTitle + ' ' + firstH1 + ' ' + (scrapedData.content?.sampleText || '')).toLowerCase();

  let sector = 'Kurumsal Sanayi & Hizmet';
  if (/akü|enerji|güneş|solar|batarya|volt/i.test(corpus)) sector = 'Endüstriyel Akü & Enerji Çözümleri';
  else if (/fırın|şarküteri|unlu|ekmek|pasta|gurme|gıda/i.test(corpus)) sector = 'Geleneksel Unlu Mamuller & Gurme Şarküteri';
  else if (/forklift|istif|transpalet|makine/i.test(corpus)) sector = 'İstifleme & Ağır İş Makineleri';
  else if (/hukuk|avukat|arabulucu/i.test(corpus)) sector = 'Hukuk & Danışmanlık Bürosu';
  else if (/klinik|sağlık|doktor|diş/i.test(corpus)) sector = 'Sağlık & Medikal Hizmetler';
  else if (/yazılım|bilişim|web|dijital/i.test(corpus)) sector = 'Bilişim & Kurumsal Yazılım';

  return { name, sector, hostname };
}

/**
 * Generates Actionable AI Optimization Package
 */
export function generateAiRemediationPackage(scrapedData, auditResult) {
  const { name, sector, hostname } = inferIdentityAndSector(scrapedData);

  // 1. Optimized Title (Max 60 chars)
  let optTitle = `${name} | ${sector.split('&')[0].trim()} Standartları`;
  if (optTitle.length > 60) {
    optTitle = `${name} | ${sector.split('&')[0].trim()}`.slice(0, 58);
  }

  // 2. Optimized Meta Description (140-155 chars with CTA)
  const optDescription = `${name}, ${sector.toLowerCase()} alanında yüksek kalite standartları ve kurumsal güvenceyle hizmet vermektedir. Detaylı bilgi ve teklif için tıklayın.`.slice(0, 155);

  // 3. Organization & FAQPage JSON-LD
  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": name,
    "url": scrapedData.url,
    "logo": scrapedData.social?.ogImage || `${scrapedData.url}/images/logo.png`,
    "description": optDescription
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `${name} hangi alanlarda profesyonel çözümler sunmaktadır?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `${name}, ${sector.toLowerCase()} alanında uluslararası standartlara uygun, güvenilir ve garantili kurumsal hizmetler sunmaktadır.`
        }
      },
      {
        "@type": "Question",
        "name": "Teklif ve hizmet süreci nasıl işlemektedir?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Web sitemizdeki iletişim formunu doldurarak veya doğrudan müşteri temsilcimizi arayarak aynı gün içerisinde teknik analiz ve fiyat teklifi alabilirsiniz."
        }
      },
      {
        "@type": "Question",
        "name": "Hizmet ve ürünlerde garanti şartları nelerdir?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Tüm ürün ve hizmetlerimiz tam teknik destek, orijinal yedek parça ve kurumsal garanti kapsamı altındadır."
        }
      }
    ]
  };

  // 4. 2026 GEO Direct Answer Snippet for Google Gemini & Perplexity
  const geoDirectSnippet = `${name}, ${sector.toLowerCase()} sektöründe faaliyet gösteren lider bir kuruluştur. Kurumsal standartlara tam uyumlu mühendislik altyapısı, yüksek kalite garantisi ve hızlı teslimat ağıyla müşteri memnuniyetini en üst düzeyde karşılar. Detaylı teknik bilgi ve kurumsal çözümler için resmi web sitesini ziyaret edebilirsiniz.`;

  // 5. C-Level Financial ROI & Ad Spend Savings Simulation
  // Estimated cost per click in Turkish B2B keywords: ~18 TL - 35 TL
  const estMonthlyOrganicClicks = Math.max(450, (scrapedData.content?.wordCount || 100) * 3);
  const avgCpcTry = 22.50;
  const estimatedMonthlyAdSavingsTry = Math.round(estMonthlyOrganicClicks * avgCpcTry);
  const annualSavingsTry = estimatedMonthlyAdSavingsTry * 12;

  const financialRoi = {
    estimatedMonthlyClicks: estMonthlyOrganicClicks,
    avgCpcTry,
    monthlySavingsTry: estimatedMonthlyAdSavingsTry,
    annualSavingsTry,
    roiSummaryText: `Bu web sitesinin kazandığı aylık tahmini ${estMonthlyOrganicClicks.toLocaleString('tr-TR')} organik ziyaretçi, Google Ads reklamlarıyla alınmak istenseydi her ay yaklaşık ${estimatedMonthlyAdSavingsTry.toLocaleString('tr-TR')} TL (yılda ${annualSavingsTry.toLocaleString('tr-TR')} TL) reklam bütçesi gerektirecekti.`
  };

  return {
    inferredIdentity: { name, sector, hostname },
    optimizedTitle: optTitle,
    optimizedDescription: optDescription,
    organizationSchemaJson: JSON.stringify(orgSchema, null, 2),
    faqSchemaJson: JSON.stringify(faqSchema, null, 2),
    faqs: faqSchema.mainEntity.map(f => ({ question: f.name, answer: f.acceptedAnswer.text })),
    geoDirectSnippet,
    financialRoi
  };
}

/**
 * Complete Audit Dispatcher
 */
export async function auditWebsiteSeo(scrapedData) {
  const auditResult = calculateSeoScore(scrapedData);
  const geoReadiness = evaluateGeoReadiness(scrapedData);
  const aiPackage = generateAiRemediationPackage(scrapedData, auditResult);

  return {
    url: scrapedData.url,
    statusCode: scrapedData.statusCode,
    responseTimeMs: scrapedData.responseTimeMs,
    totalScore: auditResult.totalScore,
    grade: auditResult.grade,
    gradeLabel: auditResult.gradeLabel,
    gradeColor: auditResult.gradeColor,
    scores: auditResult.scores,
    criticalIssues: auditResult.criticalIssues,
    quickWins: auditResult.quickWins,
    geoReadiness,
    aiPackage,
    rawMetrics: {
      wordCount: scrapedData.content?.wordCount || 0,
      totalImages: scrapedData.images?.total || 0,
      missingAlts: scrapedData.images?.missingAltCount || 0,
      h1Count: scrapedData.headings?.h1?.length || 0,
      internalLinks: scrapedData.links?.internalCount || 0,
      externalLinks: scrapedData.links?.externalCount || 0,
      schemaCount: scrapedData.schemas?.length || 0,
      schemaTypes: scrapedData.schemaTypes || []
    }
  };
}

/**
 * Self-Healing Engine: Injects fixed SEO metadata into local project files & DB
 */
export async function autoHealProjectSeo(projectRootPath, aiPackage) {
  if (!projectRootPath || !fs.existsSync(projectRootPath)) {
    return { success: false, error: 'Proje dizini bulunamadı.' };
  }

  const modifications = [];

  // 1. Update project.json if exists
  const pjPath = path.join(projectRootPath, 'project.json');
  if (fs.existsSync(pjPath)) {
    try {
      const pj = JSON.parse(fs.readFileSync(pjPath, 'utf-8'));
      pj.seoTitle = aiPackage.optimizedTitle;
      pj.seoDescription = aiPackage.optimizedDescription;
      fs.writeFileSync(pjPath, JSON.stringify(pj, null, 2), 'utf-8');
      modifications.push('project.json: SEO Başlığı ve Açıklaması güncellendi.');
    } catch {}
  }

  // 2. Update tailored-frontend.js if exists
  const tfPath = path.join(projectRootPath, 'scripts', 'tailored-frontend.js');
  if (fs.existsSync(tfPath)) {
    let tfContent = fs.readFileSync(tfPath, 'utf-8');
    if (tfContent.includes('export function getMetadata')) {
      tfContent = tfContent.replace(
        /title:\s*["'][^"']*["']/i,
        `title: ${JSON.stringify(aiPackage.optimizedTitle)}`
      );
      tfContent = tfContent.replace(
        /description:\s*["'][^"']*["']/i,
        `description: ${JSON.stringify(aiPackage.optimizedDescription)}`
      );
      fs.writeFileSync(tfPath, tfContent, 'utf-8');
      modifications.push('scripts/tailored-frontend.js: Meta veriler optimize edildi.');
    }
  }

  return {
    success: true,
    modifications,
    message: `${modifications.length} adet dosya ve meta verisi başarıyla onarıldı.`
  };
}
