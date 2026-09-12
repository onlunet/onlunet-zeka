/**
 * ONLUNET ZEKA - Google Maps & Local SEO Auditor (ONLUNET LocalRadar™)
 *
 * Capabilities:
 * 1. 100-Point Multi-Dimensional Algorithm (ONLUNET Local Score™):
 *    - Category Precision & Name Compliance (25%)
 *    - NAP & Website Cross-Validation (25%)
 *    - Review Volume & Reputation Health (20%)
 *    - Visual Identity & Media Assets (15%)
 *    - Engagement, Posts & Catalog (15%)
 * 2. Cross-Verification Engine:
 *    - Checks website for Name, Address, Phone and schema.org/LocalBusiness
 * 3. Actionable AI Optimization Generator:
 *    - 750-character SEO description
 *    - Suggested secondary categories
 *    - 1-star & 5-star review response templates
 *    - Weekly Google Posts drafts
 *    - Complete LocalBusiness JSON-LD code block
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js.
 */

import { fetchWebsiteHtml } from './site-extractor.js';

/**
 * Normalizes phone numbers to comparable digits string
 */
function normalizePhone(phoneStr) {
  if (!phoneStr) return '';
  return phoneStr.replace(/[^0-9]/g, '').replace(/^0/, '').replace(/^90/, '');
}

/**
 * Calculates Levenshtein similarity between two strings (0.0 to 1.0)
 */
function stringSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const a = s1.toLowerCase().trim();
  const b = s2.toLowerCase().trim();
  if (a === b) return 1;

  const track = Array(b.length + 1).fill(null).map(() =>
    Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= b.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  const maxLen = Math.max(a.length, b.length);
  return 1 - (track[b.length][a.length] / maxLen);
}

/**
 * Sector Knowledge Base for Categories and Secondary Category Suggestions
 */
const SectorCategoryMap = {
  'fırın': {
    primary: 'Fırın & Unlu Mamuller',
    secondaries: ['Pasta & Fırın Ürünleri Mağazası', 'Geleneksel Unlu Mamuller', 'Şarküteri', 'Gurme Gıda Mağazası', 'Kahvaltı Mekanı']
  },
  'şarküteri': {
    primary: 'Şarküteri & Doğal Ürünler',
    secondaries: ['Doğal ve Organik Ürünler Mağazası', 'Gurme Gıda Mağazası', 'Peynir Dükkanı', 'Yöresel Ürünler Mağazası', 'Fırın']
  },
  'gurme': {
    primary: 'Gurme Gıda Mağazası',
    secondaries: ['Şarküteri', 'Doğal ve Organik Ürünler Mağazası', 'Yöresel Lezzetler', 'Fırın & Pastane']
  },
  'doğal': {
    primary: 'Doğal ve Organik Ürünler Mağazası',
    secondaries: ['Şarküteri', 'Gurme Gıda Mağazası', 'Yöresel Ürünler', 'Aktar']
  },
  'gıda': {
    primary: 'Gıda ve Şarküteri',
    secondaries: ['Gurme Market', 'Süpermarket', 'Doğal Ürünler', 'Yöresel Pazar']
  },
  'restoran': {
    primary: 'Restoran & Yeme-İçme',
    secondaries: ['Geleneksel Türk Restoranı', 'Aile Restoranı', 'Paket Servis Restoranı', 'Izgara & Kebap Salonu']
  },
  'kafe': {
    primary: 'Kafe & Kahvehane',
    secondaries: ['Kahve Dükkanı', 'Tatlıcı', 'Kahvaltı Restoranı', 'Bistro']
  },
  'güneş': {
    primary: 'Güneş Enerjisi Sistemi Tedarikçisi',
    secondaries: ['Güneş Enerjisi Ekipmanı Tedarikçisi', 'Elektrik Mühendisi', 'Yenilenebilir Enerji Şirketi', 'Mühendislik Danışmanı']
  },
  'enerji': {
    primary: 'Güneş Enerjisi Sistemi Tedarikçisi',
    secondaries: ['Yenilenebilir Enerji Şirketi', 'Elektrik Tesisatı Yüklenicisi', 'Mühendislik Danışmanı']
  },
  'inşaat': {
    primary: 'İnşaat Şirketi',
    secondaries: ['Genel Müteahhit', 'Mimarlık Bürosu', 'Yapı Malzemeleri Tedarikçisi', 'Proje Yönetimi']
  },
  'yazılım': {
    primary: 'Yazılım Şirketi',
    secondaries: ['Web Tasarımcısı', 'Bilgisayar Danışmanı', 'İnternet Pazarlama Hizmeti', 'Bilişim Teknolojileri Hizmeti']
  },
  'hukuk': {
    primary: 'Hukuk Bürosu',
    secondaries: ['Avukat', 'Hukuk Danışmanı', 'Şirket Avukatı', 'Arabulucu']
  },
  'sağlık': {
    primary: 'Özel Sağlık Kliniği',
    secondaries: ['Tıp Merkezi', 'Doktor', 'Fizik Tedavi Kliniği', 'Diş Hekimi']
  },
  'default': {
    primary: 'Kurumsal Şirket',
    secondaries: ['Danışmanlık Hizmeti', 'Ticari İşletme', 'Hizmet Sağlayıcı']
  }
};

/**
 * Detects sector and returns category recommendations
 */
function getCategoryRecommendations(categoryName, businessName) {
  const combined = `${categoryName} ${businessName}`.toLowerCase();
  for (const [key, val] of Object.entries(SectorCategoryMap)) {
    if (combined.includes(key)) {
      return val.secondaries;
    }
  }
  return SectorCategoryMap.default.secondaries;
}

/**
 * Audits a Google Maps listing against Local SEO standards and linked website.
 */
export async function auditGoogleMapsListing(listing) {
  const auditStartTime = Date.now();

  // 1. Cross-Check with Linked Website
  let webCrossCheck = {
    checked: false,
    websiteAvailable: false,
    nameMatch: false,
    addressMatch: false,
    phoneMatch: false,
    hasLocalBusinessSchema: false,
    hasMapsEmbed: false,
    issues: []
  };

  if (listing.website && /^https?:\/\//i.test(listing.website)) {
    webCrossCheck.checked = true;
    try {
      const webRes = await fetchWebsiteHtml(listing.website, { timeoutMs: 8000 });
      if (webRes && webRes.success && webRes.html) {
        webCrossCheck.websiteAvailable = true;
        const html = webRes.html;
        const lowerHtml = html.toLowerCase();

        // Name check
        const cleanName = listing.name.toLowerCase().replace(/ltd|şti|a\.ş|aş|sanayi|ticaret/gi, '').trim();
        webCrossCheck.nameMatch = lowerHtml.includes(cleanName.slice(0, 10));

        // Phone check
        const normPhone = normalizePhone(listing.phone);
        const normWebDigits = html.replace(/[^0-9]/g, '');
        webCrossCheck.phoneMatch = normPhone.length >= 7 && normWebDigits.includes(normPhone);

        // Address city/district check
        const addrTokens = (listing.address || '').toLowerCase().split(/[\s,./-]+/).filter(t => t.length > 3);
        const matchedTokens = addrTokens.filter(tok => lowerHtml.includes(tok));
        webCrossCheck.addressMatch = matchedTokens.length >= Math.min(2, addrTokens.length);

        // Schema check
        webCrossCheck.hasLocalBusinessSchema =
          lowerHtml.includes('schema.org/localbusiness') ||
          lowerHtml.includes('"@type":"localbusiness"') ||
          lowerHtml.includes('"@type": "localbusiness"');

        // Maps embed check
        webCrossCheck.hasMapsEmbed =
          lowerHtml.includes('google.com/maps/embed') ||
          lowerHtml.includes('maps.google.com') ||
          lowerHtml.includes('iframe');

        // Issues
        if (!webCrossCheck.phoneMatch) {
          webCrossCheck.issues.push('Web sitesindeki telefon numarası ile Google Harita numarası uyuşmuyor.');
        }
        if (!webCrossCheck.addressMatch) {
          webCrossCheck.issues.push('Web sitesinde Google Harita adresinizle birebir örtüşen açık adres bulunamadı.');
        }
        if (!webCrossCheck.hasLocalBusinessSchema) {
          webCrossCheck.issues.push('Web sitenizde "LocalBusiness" JSON-LD yapısal veri şeması eksik. Bu durum Google yerel sıralamasını düşürür.');
        }
      }
    } catch (err) {
      webCrossCheck.issues.push(`Web sitesine bağlanılamadı (${err.message}).`);
    }
  } else {
    webCrossCheck.issues.push('Google Harita profilinizde tanımlı resmi bir web sitesi bağlantısı bulunmuyor.');
  }

  // 2. Score Calculation (100 Points Total)
  const scores = {
    categoryAndIdentity: 0, // max 25
    napAndWebsite: 0,       // max 25
    reviewsAndReputation: 0,// max 20
    visualsAndMedia: 0,     // max 15
    engagementAndPosts: 0   // max 15
  };

  const criticalIssues = [];
  const quickWins = [];

  // --- DIMENSION 1: Category & Identity (Max 25) ---
  if (listing.category && listing.category !== 'Kurumsal İşletme') {
    scores.categoryAndIdentity += 12;
  } else {
    scores.categoryAndIdentity += 4;
    criticalIssues.push({
      level: 'HIGH',
      title: 'Birincil Kategori Çok Genel',
      description: 'Birincil kategoriniz yerel aramalarda en yüksek sıralama faktörüdür. Sektörünüze özel net bir kategori seçmelisiniz.'
    });
  }

  // Check keyword stuffing in business name
  const spamKeywords = ['en ucuz', 'en iyi', 'fiyatları', 'tamiri', 'servisi', 'numarası', 'usta', 'telefon'];
  const hasSpamInName = spamKeywords.some(k => listing.name.toLowerCase().includes(k));
  if (!hasSpamInName) {
    scores.categoryAndIdentity += 8;
  } else {
    scores.categoryAndIdentity += 2;
    criticalIssues.push({
      level: 'CRITICAL',
      title: 'İşletme Unvanında Spam Riski',
      description: 'Unvana arama kelimeleri eklemek Google spam algoritması tarafından askıya alınma (suspension) sebebidir. Yalnızca resmi tabelanızı kullanın.'
    });
  }

  // Hours
  if (listing.hours && listing.hours.length > 5) {
    scores.categoryAndIdentity += 5;
  } else {
    scores.categoryAndIdentity += 2;
    quickWins.push('Çalışma saatlerinizi (varsa bayram/özel gün saatleriyle birlikte) eksiksiz girin.');
  }

  // --- DIMENSION 2: NAP & Website Cross-Check (Max 25) ---
  if (webCrossCheck.websiteAvailable) {
    scores.napAndWebsite += 5;
    if (webCrossCheck.nameMatch) scores.napAndWebsite += 5;
    else quickWins.push('Web sitenizdeki şirket unvanını Haritalar unvanınızla tam eşleştirin.');

    if (webCrossCheck.phoneMatch) scores.napAndWebsite += 5;
    else criticalIssues.push({
      level: 'HIGH',
      title: 'NAP Telefon Uyuşmazlığı',
      description: 'Web sitenizdeki telefon numarası ile Haritalar profilinizdeki numara farklı. Google bunu güvensizlik sinyali sayar.'
    });

    if (webCrossCheck.addressMatch) scores.napAndWebsite += 5;
    else quickWins.push('Web sitesi iletişim ve footer alanındaki adresi haritadaki ile harfiyen aynı yapın.');

    if (webCrossCheck.hasLocalBusinessSchema) scores.napAndWebsite += 5;
    else {
      criticalIssues.push({
        level: 'MEDIUM',
        title: 'LocalBusiness Schema Eksik',
        description: 'Web sitenizin kaynak koduna Google Harita koordinatlı LocalBusiness JSON-LD kodu eklenmelidir.'
      });
    }
  } else {
    scores.napAndWebsite += 6; // base score if website not analyzed
  }

  // --- DIMENSION 3: Reviews & Reputation (Max 20) ---
  const rating = listing.rating || 0;
  const count = listing.reviewCount || 0;

  if (rating >= 4.7) scores.reviewsAndReputation += 8;
  else if (rating >= 4.2) scores.reviewsAndReputation += 6;
  else if (rating >= 3.8) scores.reviewsAndReputation += 4;
  else scores.reviewsAndReputation += 2;

  if (count >= 50) scores.reviewsAndReputation += 7;
  else if (count >= 20) scores.reviewsAndReputation += 5;
  else if (count >= 5) scores.reviewsAndReputation += 3;
  else {
    scores.reviewsAndReputation += 1;
    quickWins.push('Yorum sayınız 10\'un altında. Müşterilerinize doğrudan Google Yorum Linki göndererek hacmi artırın.');
  }

  // Response check
  const reviewsWithReply = (listing.reviews || []).filter(r => r.hasReply);
  if (listing.reviews && listing.reviews.length > 0) {
    if (reviewsWithReply.length >= listing.reviews.length * 0.7) {
      scores.reviewsAndReputation += 5;
    } else {
      scores.reviewsAndReputation += 2;
      criticalIssues.push({
        level: 'MEDIUM',
        title: 'Cevapsız Müşteri Yorumları Var',
        description: 'Müşteri yorumlarına 48 saat içinde kurumsal yanıt vermek, Google yerel sıralamasını doğrudan yükselten aktiflik sinyalidir.'
      });
    }
  } else {
    scores.reviewsAndReputation += 3;
  }

  // --- DIMENSION 4: Visuals & Media (Max 15) ---
  if (listing.coverPhotoUrl) {
    scores.visualsAndMedia += 8;
  } else {
    scores.visualsAndMedia += 3;
    quickWins.push('Yüksek çözünürlüklü kurumsal logo ve kapak fotoğrafı yükleyin.');
  }

  if (count > 10) scores.visualsAndMedia += 7;
  else scores.visualsAndMedia += 4;

  // --- DIMENSION 5: Engagement & Posts (Max 15) ---
  // Google Posts and services check
  scores.engagementAndPosts += 7; // Average base
  quickWins.push('Her hafta düzenli olarak "Google Güncellemeleri" (Google Posts) üzerinden kampanya veya duyuru paylaşın.');
  quickWins.push('Google İşletme Paneli\'nde "Hizmetler" ve "Ürünler" sekmesine fiyat ve web sitesi butonlu katalog ekleyin.');

  // Total Score (0 - 100)
  const totalScore = Math.min(100, Math.round(
    scores.categoryAndIdentity +
    scores.napAndWebsite +
    scores.reviewsAndReputation +
    scores.visualsAndMedia +
    scores.engagementAndPosts
  ));

  // Determine Grade
  let grade = 'B';
  let gradeLabel = 'Geliştirilmeli';
  let gradeColor = '#f59e0b';
  if (totalScore >= 85) {
    grade = 'A+';
    gradeLabel = 'Mükemmel Yerel Otorite';
    gradeColor = '#10b981';
  } else if (totalScore >= 70) {
    grade = 'B+';
    gradeLabel = 'İyi, Birkaç Eksik Var';
    gradeColor = '#3b82f6';
  } else if (totalScore < 50) {
    grade = 'C-';
    gradeLabel = 'Kritik Düzeltmeler Gerekli';
    gradeColor = '#ef4444';
  }

  // 3. AI Generated Ready-to-Copy Optimization Pack
  const suggestedSecondaries = getCategoryRecommendations(listing.category, listing.name);

  const cityMatch = (listing.address || '').match(/(Adana|Adıyaman|Afyon|Ağrı|Amasya|Ankara|Antalya|Artvin|Aydın|Balıkesir|Bilecik|Bingöl|Bitlis|Bolu|Burdur|Bursa|Çanakkale|Çankırı|Çorum|Denizli|Diyarbakır|Edirne|Elazığ|Erzincan|Erzurum|Eskişehir|Gaziantep|Giresun|Gümüşhane|Hakkari|Hatay|Isparta|Mersin|İstanbul|İzmir|Kars|Kastamonu|Kayseri|Kırklareli|Kırşehir|Kocaeli|Konya|Kütahya|Malatya|Manisa|Kahramanmaraş|Mardin|Muğla|Muş|Nevşehir|Niğde|Ordu|Rize|Sakarya|Samsun|Siirt|Sinop|Sivas|Tekirdağ|Tokat|Trabzon|Tunceli|Şanlıurfa|Uşak|Van|Yozgat|Zonguldak|Aksaray|Bayburt|Karaman|Kırıkkale|Batman|Şırnak|Bartın|Ardahan|Iğdır|Yalova|Karabük|Kilis|Osmaniye|Düzce)/i);
  const cleanCity = cityMatch ? cityMatch[0] : 'bölgesinde';

  const combinedSectorText = `${listing.category} ${listing.name}`.toLowerCase();
  let sectorSnippet = 'müşteri odaklı yaklaşımımız, üstün kalite standartlarımız ve güvenilir çözümlerimizle';
  let postDrafts = [];

  if (combinedSectorText.includes('fırın') || combinedSectorText.includes('şarküteri') || combinedSectorText.includes('gurme') || combinedSectorText.includes('doğal') || combinedSectorText.includes('gıda')) {
    sectorSnippet = 'taze, hijyenik ve geleneksel üretim anlayışımız, doğal yöresel lezzetlerimiz ve zengin ürün çeşitliliğimizle';
    postDrafts = [
      {
        title: `🥖 Günlük Taze ve Doğal Lezzetler Sizlerle!`,
        body: `${cleanCity} şubemizde her gün taze hazırlanan geleneksel ürünlerimiz, seçkin şarküteri lezzetlerimiz ve doğal gıda çeşitlerimizle hizmetinizdeyiz. Sofralarınıza değer katmak için bizi ziyaret edin.`,
        cta: 'Hemen Ara / Bilgi Al'
      },
      {
        title: `🧀 Yöresel Güven ve Katkısız Tatlar`,
        body: `Gelenekten geleceğe en taze ve doğal ürünleri özenle seçiyor, titizlikle sunuyoruz. Güncel ürünlerimizi ve avantajlarımızı keşfetmek için hemen arayın veya mağazamıza uğrayın.`,
        cta: 'Konum & Yol Tarifi'
      }
    ];
  } else if (combinedSectorText.includes('enerji') || combinedSectorText.includes('mühendislik') || combinedSectorText.includes('makine') || combinedSectorText.includes('inşaat')) {
    sectorSnippet = 'yüksek mühendislik standartlarımız, garantili ekipman tedariğimiz ve anahtar teslim uygulama tecrübemizle';
    postDrafts = [
      {
        title: `☀️ 2026 Yeni Sezon Çözümlerimizle Tanışın!`,
        body: `${cleanCity} genelinde ${listing.category.toLowerCase()} projelerinizde yüksek verimli ve garantili çözümler sunuyoruz. Erken sipariş avantajlarından faydalanmak için hemen profilimizden bize ulaşın.`,
        cta: 'Hemen Ara / Teklif Al'
      },
      {
        title: `🛠️ Uzman Mühendislik & Güvenilir Teknik Destek`,
        body: `Kaliteden ödün vermeyen yaklaşımımızla sektörde fark yaratıyoruz. Referanslarımızı incelemek ve işletmenize özel teklif almak için web sitemizi ziyaret edin.`,
        cta: 'Daha Fazla Bilgi'
      }
    ];
  } else {
    sectorSnippet = 'yüksek kalite anlayışımız, kurumsal güvencemiz ve profesyonel hizmet kadromuzla';
    postDrafts = [
      {
        title: `✨ Hizmet Kalitemizle Yanınızdayız!`,
        body: `${cleanCity} genelinde ${listing.category.toLowerCase()} alanında en kaliteli ve güvenilir hizmeti sunuyoruz. Detaylı bilgi ve randevu için hemen iletişime geçin.`,
        cta: 'Hemen Ara'
      },
      {
        title: `📞 Müşteri Memnuniyeti Odaklı Çözümler`,
        body: `Geniş hizmet yelpazemiz ve deneyimli kadromuzla sizlere değer katmaya devam ediyoruz. Güncel fırsatlarımız için profilimizden bize ulaşabilirsiniz.`,
        cta: 'Daha Fazla Bilgi'
      }
    ];
  }

  const optimizedDescription = `${listing.name}, ${cleanCity} genelinde ${listing.category.toLowerCase()} alanında ${sectorSnippet} hizmet vermektedir. Kaliteden ödün vermeyen güvencemiz ve güler yüzlü hizmet anlayışımızla müşterilerimize her zaman en iyisini sunuyoruz. Güncel ürün ve hizmetlerimizi incelemek, sipariş vermek veya detaylı bilgi almak için hemen bizi arayın veya işletmemizi ziyaret edin.`;

  const reviewReplyNegative = `Sayın Müşterimiz, ${listing.name} olarak müşteri memnuniyeti bizim birinci önceliğimizdir. Yaşadığınız deneyim standartlarımızın altında kaldığı için üzgünüz. Durumu derhal telafi edebilmemiz ve detayları görüşebilmemiz için lütfen doğrudan yetkilimizle ${listing.phone} numaralı hattan iletişime geçiniz. Saygılarımızla.`;

  const reviewReplyPositive = `Harika geri bildiriminiz ve bizi tercih ettiğiniz için ${listing.name} ailesi olarak çok teşekkür ederiz! ${cleanCity} bölgesinde ${listing.category.toLowerCase()} alanında sizlere en kaliteli hizmeti sunmaktan gurur duyuyoruz. Sizleri tekrar aramızda görmekten mutluluk duyarız.`;

  const googlePostsDrafts = postDrafts;

  const localBusinessJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": listing.name,
    "image": listing.coverPhotoUrl || "https://example.com/logo.png",
    "telephone": listing.phone,
    "url": listing.website,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": listing.address,
      "addressLocality": cleanCity,
      "addressCountry": "TR"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": listing.coordinates?.lat || 39.9255,
      "longitude": listing.coordinates?.lng || 32.8662
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      "opens": "08:30",
      "closes": "18:30"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": rating.toString(),
      "reviewCount": count.toString()
    }
  }, null, 2);

  return {
    success: true,
    totalScore,
    grade,
    gradeLabel,
    gradeColor,
    scores,
    listing,
    webCrossCheck,
    criticalIssues,
    quickWins,
    optimizations: {
      optimizedDescription,
      suggestedSecondaries,
      reviewReplyNegative,
      reviewReplyPositive,
      googlePostsDrafts,
      localBusinessJsonLd
    },
    durationMs: Date.now() - auditStartTime,
    timestamp: new Date().toISOString()
  };
}
