/**
 * ONLUNET ZEKA — Backend Capability Registry (FAZ 75)
 *
 * Enforces the Golden Rule:
 * The frontend MUST NEVER invent or hardcode backend features locally
 * if the core backend (ONLUNET KURUMSAL) does not support them.
 *
 * Every feature required by a generated design must be checked against this registry.
 * If missing, site generation is BLOCKED with an explicit capability gap notification.
 */

export const CapabilityStatus = Object.freeze({
  FULL: 'FULL',
  AVAILABLE: 'FULL', // backward compatible alias
  PARTIAL: 'PARTIAL',
  DEFERRED: 'DEFERRED',
  MISSING: 'MISSING',
  UNVERIFIED: 'UNVERIFIED',
  DEPRECATED: 'DEPRECATED'
});

export const BackendCapabilities = Object.freeze({
  pages: {
    id: 'pages',
    name: 'Kurumsal Sayfalar',
    status: CapabilityStatus.FULL,
    db: 'YES',
    backend: 'YES',
    api: 'YES',
    adminUI: 'YES',
    table: 'cms_contents',
    typeFilter: 'page',
    apiEndpoint: '/api/v1/cms/contents',
    adminRoute: '/admin/cms?type=page',
    description: 'Statik ve dinamik kurumsal alt sayfalar, çok dilli başlık, slug ve gövde.',
    generatorSupported: true
  },
  media: {
    id: 'media',
    name: 'Medya Kütüphanesi',
    status: CapabilityStatus.FULL,
    db: 'YES',
    backend: 'YES',
    api: 'YES',
    adminUI: 'YES',
    table: 'media_files',
    typeFilter: null,
    apiEndpoint: '/api/v1/media',
    adminRoute: '/admin/media',
    description: 'Görsel ve belge yükleme, SHA-256 sağlama toplamı, MIME doğrulaması.',
    generatorSupported: true
  },
  services: {
    id: 'services',
    name: 'Hizmetler Kataloğu',
    status: CapabilityStatus.FULL,
    db: 'YES',
    backend: 'YES',
    api: 'YES',
    adminUI: 'YES',
    table: 'cms_contents',
    typeFilter: 'service',
    apiEndpoint: '/api/v1/cms/contents',
    adminRoute: '/admin/cms?type=service',
    description: 'Hizmet kartları, detay sayfaları ve sektörel çözüm içerikleri.',
    generatorSupported: true
  },
  products: {
    id: 'products',
    name: 'Ürün Kataloğu',
    status: CapabilityStatus.FULL,
    db: 'YES',
    backend: 'YES',
    api: 'YES',
    adminUI: 'YES',
    table: 'cms_contents',
    typeFilter: 'product',
    apiEndpoint: '/api/v1/cms/contents',
    adminRoute: '/admin/cms?type=product',
    description: 'Ürün kataloğu, SKU, teknik özellikler ve PDF şartname bağlantıları.',
    generatorSupported: true
  },
  blog: {
    id: 'blog',
    name: 'Blog ve Haberler',
    status: CapabilityStatus.FULL,
    db: 'YES',
    backend: 'YES',
    api: 'YES',
    adminUI: 'YES',
    table: 'cms_contents',
    typeFilter: 'blog',
    apiEndpoint: '/api/v1/cms/contents',
    adminRoute: '/admin/cms?type=blog',
    description: 'Haber, makale ve teknik SEO rehberleri.',
    generatorSupported: true
  },
  forms: {
    id: 'forms',
    name: 'İletişim ve CRM Formları',
    status: CapabilityStatus.FULL,
    db: 'YES',
    backend: 'YES',
    api: 'YES',
    adminUI: 'YES',
    table: 'leads',
    typeFilter: null,
    apiEndpoint: '/api/v1/leads',
    adminRoute: '/admin/leads',
    description: 'Honeypot korumalı teklif, maliyet hesaplama ve iletişim formu altyapısı.',
    generatorSupported: true
  },
  seo: {
    id: 'seo',
    name: 'SEO ve Yapısal Veri',
    status: CapabilityStatus.FULL,
    db: 'YES',
    backend: 'YES',
    api: 'YES',
    adminUI: 'YES',
    table: 'site_settings',
    typeFilter: 'seo',
    apiEndpoint: '/api/v1/settings',
    adminRoute: '/admin/seo',
    description: 'Dinamik sitemap.xml, robots.txt, Schema.org JSON-LD ve 301 yönlendirmeler.',
    generatorSupported: true
  },
  case_studies: {
    id: 'case_studies',
    name: 'Vaka Analizleri ve Portföy',
    status: CapabilityStatus.FULL,
    db: 'YES',
    backend: 'YES',
    api: 'YES',
    adminUI: 'YES',
    table: 'case_studies',
    typeFilter: null,
    apiEndpoint: '/api/v1/case-studies',
    adminRoute: '/admin/case-studies',
    description: 'Ölçülebilir başarı hikayeleri, metrikler JSON ve müşteri projeleri.',
    generatorSupported: true
  },
  team: {
    id: 'team',
    name: 'Ekibimiz Modülü',
    status: CapabilityStatus.FULL,
    db: 'YES',
    backend: 'YES',
    api: 'YES',
    adminUI: 'YES',
    table: 'cms_contents',
    typeFilter: 'team',
    apiEndpoint: '/api/v1/cms/contents',
    adminRoute: '/admin/cms?type=team',
    description: 'Kurumsal ekip üyeleri, unvan, departman, avatar görseli, LinkedIn bağlantısı ve sıralama yönetimi.',
    generatorSupported: true
  },
  faq: {
    id: 'faq',
    name: 'Sıkça Sorulan Sorular (SSS)',
    status: CapabilityStatus.FULL,
    db: 'YES',
    backend: 'YES',
    api: 'YES',
    adminUI: 'YES',
    table: 'cms_contents',
    typeFilter: 'faq',
    apiEndpoint: '/api/v1/cms/contents',
    adminRoute: '/admin/cms?type=faq',
    description: 'Sıkça Sorulan Sorular, soru-cevap yönetimi, kategori etiketleme ve sıralama kontrolü.',
    generatorSupported: true
  },
  testimonials: {
    id: 'testimonials',
    name: 'Müşteri Yorumları (Testimonials)',
    status: CapabilityStatus.FULL,
    db: 'YES',
    backend: 'YES',
    api: 'YES',
    adminUI: 'YES',
    table: 'testimonials',
    typeFilter: null,
    apiEndpoint: '/api/v1/testimonials',
    adminRoute: '/admin/testimonials',
    description: 'Doğrulanmış müşteri geri bildirimleri, 1-5 yıldız değerlendirmeleri, şirket ve unvan bilgileri, avatar ve yayın yönetimi.',
    generatorSupported: true
  },
  brand_references: {
    id: 'brand_references',
    name: 'Marka Referansları & Partner Logoları',
    status: CapabilityStatus.DEFERRED,
    db: 'NO',
    backend: 'NO',
    api: 'NO',
    adminUI: 'NO',
    table: null,
    typeFilter: null,
    apiEndpoint: null,
    adminRoute: null,
    description: 'Marka logoları şeridi ve harici partner linkleri P2 fazına ertelenmiştir (DEFERRED). Statik frontend çıktısı desteklenir ancak backend CRUD yönetimi ertelenmiştir.',
    generatorSupported: false,
    remediationGuide: 'Marka referanslarını frontend tarafında statik bileşen olarak tanımlayınız veya backend yönetim gereksinimini kaldırınız.'
  },
  gallery: {
    id: 'gallery',
    name: 'Foto Galeri ve Albümler',
    status: CapabilityStatus.DEFERRED,
    db: 'PARTIAL',
    backend: 'PARTIAL',
    api: 'PARTIAL',
    adminUI: 'PARTIAL',
    table: 'media_files',
    typeFilter: null,
    apiEndpoint: '/api/v1/media',
    adminRoute: '/admin/media',
    description: 'Çoklu görsel içeren albüm/galeri koleksiyon yönetimi P2 fazına ertelenmiştir (DEFERRED). Statik medya kullanımı ve /admin/media tekil yükleme desteklenir ancak albüm CRUD yönetimi ertelenmiştir.',
    generatorSupported: false,
    remediationGuide: 'Fotoğrafları Medya Kütüphanesi üzerinden tekil olarak yönetiniz veya albüm CRUD yönetim gereksinimini kaldırarak statik galeri kullanınız.'
  }
});

/**
 * Returns complete capability registry overview.
 */
export function getBackendCapabilityRegistry() {
  const caps = Object.values(BackendCapabilities);
  return {
    version: '1.2.0-faz75.2',
    backendCore: 'ONLUNET KURUMSAL 2026',
    freezeStatus: 'FROZEN',
    capabilities: { ...BackendCapabilities },
    fullCount: caps.filter(c => c.status === CapabilityStatus.FULL).length,
    availableCount: caps.filter(c => c.status === CapabilityStatus.FULL).length,
    partialCount: caps.filter(c => c.status === CapabilityStatus.PARTIAL).length,
    deferredCount: caps.filter(c => c.status === CapabilityStatus.DEFERRED).length,
    missingCount: caps.filter(c => c.status === CapabilityStatus.MISSING).length,
    unverifiedCount: caps.filter(c => c.status === CapabilityStatus.UNVERIFIED).length
  };
}

/**
 * Normalizes a capability name/alias to standard registry ID.
 */
export function normalizeCapabilityId(rawName) {
  if (!rawName || typeof rawName !== 'string') return null;
  const clean = rawName.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
  const aliasMap = {
    page: 'pages',
    pages: 'pages',
    sayfalar: 'pages',
    media: 'media',
    medya: 'media',
    upload: 'media',
    service: 'services',
    services: 'services',
    hizmetler: 'services',
    product: 'products',
    products: 'products',
    urunler: 'products',
    katalog: 'products',
    blog: 'blog',
    makaleler: 'blog',
    haberler: 'blog',
    form: 'forms',
    forms: 'forms',
    lead: 'forms',
    leads: 'forms',
    contact: 'forms',
    iletisim: 'forms',
    seo: 'seo',
    casestudies: 'case_studies',
    case_studies: 'case_studies',
    projeler: 'case_studies',
    basari_hikayeleri: 'case_studies',
    team: 'team',
    ekibimiz: 'team',
    ekip: 'team',
    testimonial: 'testimonials',
    testimonials: 'testimonials',
    yorumlar: 'testimonials',
    musteri_yorumlari: 'testimonials',
    references: 'case_studies',
    referanslar: 'case_studies',
    brand_references: 'brand_references',
    brandreferences: 'brand_references',
    brand_logos: 'brand_references',
    marka_referanslari: 'brand_references',
    partner_logos: 'brand_references',
    markalar: 'brand_references',
    faq: 'faq',
    sss: 'faq',
    sorular: 'faq',
    gallery: 'gallery',
    galeri: 'gallery',
    album: 'gallery'
  };
  return aliasMap[clean] || clean;
}

/**
 * Validates a list of required capabilities against the Backend Capability Registry.
 *
 * @param {Array<string>} requiredList - List of capability IDs or aliases required by the design
 * @returns {object} Validation result with blocked status and clear explanation
 */
export function validateBackendCapabilities(requiredList = []) {
  if (!Array.isArray(requiredList) || requiredList.length === 0) {
    return {
      valid: true,
      blocked: false,
      missingCapabilities: [],
      deferredCapabilities: [],
      availableCapabilities: []
    };
  }

  const missing = [];
  const deferred = [];
  const available = [];
  const unrecognized = [];

  for (const item of requiredList) {
    const normalizedId = normalizeCapabilityId(item);
    const cap = BackendCapabilities[normalizedId];

    if (!cap) {
      unrecognized.push(item);
      missing.push({
        id: normalizedId || item,
        name: item,
        status: CapabilityStatus.MISSING,
        reason: 'Tanımlanamayan veya backend tarafından desteklenmeyen özellik.'
      });
      continue;
    }

    if (cap.status === CapabilityStatus.FULL) {
      available.push(cap);
    } else if (cap.status === CapabilityStatus.DEFERRED) {
      deferred.push(cap);
    } else {
      missing.push({
        id: cap.id,
        name: cap.name,
        status: cap.status,
        description: cap.description,
        remediationGuide: cap.remediationGuide || 'Admin Panel modülü eklenmelidir.'
      });
    }
  }

  if (deferred.length > 0) {
    const deferredNames = deferred.map(d => `"${d.name}" (${d.id})`).join(', ');
    const remediationSteps = deferred.map(d => `- ${d.name}: ${d.remediationGuide || 'Bu özellik P2 fazına ertelenmiştir (DEFERRED). Lütfen statik içerik olarak tanımlayınız veya gereksinimi kaldırınız.'}`).join('\n');

    return {
      valid: false,
      blocked: true,
      statusCode: 409,
      errorCode: 'BACKEND_CAPABILITY_DEFERRED',
      message: `[BACKEND CAPABILITY DEFERRED]\n\nİhtiyaç:\n${deferredNames}\n\nDurum:\nERTELENDİ (DEFERRED) — Site üretimi durduruldu.\n\nÇözüm:\n${remediationSteps}`,
      deferredCapabilities: deferred,
      missingCapabilities: missing,
      availableCapabilities: available
    };
  }

  if (missing.length > 0) {
    const missingNames = missing.map(m => `"${m.name}" (${m.id})`).join(', ');
    const remediationSteps = missing.map(m => `- ${m.name}: ${m.remediationGuide || m.description}`).join('\n');

    return {
      valid: false,
      blocked: true,
      statusCode: 409,
      errorCode: 'BACKEND_CAPABILITY_MISSING',
      message: `[BACKEND CAPABILITY MISSING]\n\nİhtiyaç:\n${missingNames}\n\nMevcut backend:\nYOK / DESTEKLENMİYOR\n\nDurum:\nSITE GENERATION BLOCKED\n\nÖnerilen işlem:\n${remediationSteps}`,
      deferredCapabilities: [],
      missingCapabilities: missing,
      availableCapabilities: available
    };
  }

  return {
    valid: true,
    blocked: false,
    missingCapabilities: [],
    deferredCapabilities: [],
    availableCapabilities: available
  };
}
