/**
 * ONLUNET ZEKA — Canonical Corporate Site Spec Engine (FAZ 76)
 *
 * Implements the unified specification contract for corporate website generation:
 * - 5 input channels: Manual, Old Website, Google Maps, Reference Image, and Hybrid combinations.
 * - Strict Precedence: MANUAL > GOOGLE_MAPS > OLD_WEBSITE > INFERENCE.
 * - Field-level Provenance & Evidence tracking ({ value, source, confidence, evidence, isVerified }).
 * - Strict Fact vs Inference Separation: Unverified facts are never presented as true facts.
 * - Zero Feature Invention: Missing offerings/team/testimonials are never hallucinated.
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js.
 */

import { buildImageDesignSpec } from './reference-image-analyzer.js';

export const SpecDataSource = Object.freeze({
  MANUAL: 'manual',
  GOOGLE_MAPS: 'google_maps',
  OLD_WEBSITE: 'old_website',
  REFERENCE_IMAGE: 'reference_image',
  INFERENCE: 'inferred'
});

export const ConfidenceLevel = Object.freeze({
  HIGH: 1.0,
  VERIFIED_MAPS: 0.95,
  VERIFIED_WEB: 0.85,
  INFERRED_MEDIUM: 0.5,
  INFERRED_LOW: 0.2
});

/**
 * Creates an evidenced field datum.
 */
export function createEvidencedField(value, source = SpecDataSource.INFERENCE, confidence = 0.5, evidence = null, isInference = false) {
  const hasVal = value !== null && value !== undefined && value !== '';
  return Object.freeze({
    value: hasVal ? value : null,
    source,
    confidence: Number(Math.max(0, Math.min(1, confidence)).toFixed(2)),
    evidence: evidence || (hasVal ? `${source} data` : 'Missing data'),
    isVerified: Boolean(hasVal && !isInference && (source === SpecDataSource.MANUAL || source === SpecDataSource.GOOGLE_MAPS || source === SpecDataSource.OLD_WEBSITE)),
    inference: Boolean(isInference || source === SpecDataSource.INFERENCE)
  });
}

/**
 * Builds a unified canonical CorporateSiteSpec from multiple raw or normalized sources.
 */
export function buildCorporateSiteSpec({
  manual = {},
  websiteData = null,
  websiteUrl = null,
  mapsData = null,
  mapsUrl = null,
  referenceImageAnalysis = null,
  referenceImageFidelity = 'exact',
  imageDesignSpec = null,
  requiredCapabilities = [],
  options = {}
} = {}) {
  const sourceEvidence = {};
  const missingData = [];
  const sourcesUsed = [];

  const m = manual || {};
  const w = (websiteData && websiteData.spec) ? websiteData.spec : (websiteData || {});
  const g = (mapsData && mapsData.listing) ? mapsData.listing : (mapsData || {});
  const gSpec = (mapsData && mapsData.spec) ? mapsData.spec : {};

  if (Object.keys(m).length > 0 && (m.companyName || m.industry || m.services || m.phone || m.address)) {
    sourcesUsed.push(SpecDataSource.MANUAL);
  }
  if (g.name || g.url || mapsUrl || mapsData) {
    sourcesUsed.push(SpecDataSource.GOOGLE_MAPS);
  }
  if (w.companyName || w.sourceUrl || websiteUrl || websiteData) {
    sourcesUsed.push(SpecDataSource.OLD_WEBSITE);
  }
  if (referenceImageAnalysis) {
    sourcesUsed.push(SpecDataSource.REFERENCE_IMAGE);
  }

  // 1. Company Identity (MANUAL > GOOGLE_MAPS > OLD_WEBSITE > INFERENCE)
  let companyNameField;
  if (m.companyName && typeof m.companyName === 'string' && m.companyName.trim()) {
    companyNameField = createEvidencedField(m.companyName.trim(), SpecDataSource.MANUAL, 1.0, 'Manual user entry');
  } else if (g.name && typeof g.name === 'string' && g.name.trim()) {
    companyNameField = createEvidencedField(g.name.trim(), SpecDataSource.GOOGLE_MAPS, 0.95, `Google Maps listing name: ${g.name}`);
  } else if (w.companyName && typeof w.companyName === 'string' && w.companyName.trim()) {
    companyNameField = createEvidencedField(w.companyName.trim(), SpecDataSource.OLD_WEBSITE, 0.85, `Scraped from website title: ${w.companyName}`);
  } else {
    companyNameField = createEvidencedField('Kurumsal İşletme', SpecDataSource.INFERENCE, 0.2, 'Placeholder fallback', true);
    missingData.push('company.name');
  }
  sourceEvidence['company.name'] = companyNameField;

  let industryField;
  if (m.industry && typeof m.industry === 'string' && m.industry.trim()) {
    industryField = createEvidencedField(m.industry.trim(), SpecDataSource.MANUAL, 1.0, 'Manual industry specification');
  } else if (g.category && typeof g.category === 'string' && g.category.trim()) {
    industryField = createEvidencedField(g.category.trim(), SpecDataSource.GOOGLE_MAPS, 0.95, `Google Maps category: ${g.category}`);
  } else if (w.industry && typeof w.industry === 'string' && w.industry.trim()) {
    industryField = createEvidencedField(w.industry.trim(), SpecDataSource.OLD_WEBSITE, 0.85, `Scraped website industry: ${w.industry}`);
  } else {
    industryField = createEvidencedField('Genel Kurumsal Hizmetler', SpecDataSource.INFERENCE, 0.3, 'Inferred generic business context', true);
    missingData.push('company.industry');
  }
  sourceEvidence['company.industry'] = industryField;

  let sloganField;
  if (m.slogan && typeof m.slogan === 'string' && m.slogan.trim()) {
    sloganField = createEvidencedField(m.slogan.trim(), SpecDataSource.MANUAL, 1.0, 'Manual slogan');
  } else if (w.slogan && typeof w.slogan === 'string' && w.slogan.trim()) {
    sloganField = createEvidencedField(w.slogan.trim(), SpecDataSource.OLD_WEBSITE, 0.85, 'Extracted website slogan');
  } else if (gSpec.slogan && typeof gSpec.slogan === 'string' && gSpec.slogan.trim()) {
    sloganField = createEvidencedField(gSpec.slogan.trim(), SpecDataSource.GOOGLE_MAPS, 0.80, 'Maps listing tagline');
  } else {
    sloganField = createEvidencedField(`${industryField.value} Alanında Güvenilir ve Profesyonel Çözümler`, SpecDataSource.INFERENCE, 0.4, 'Generated contextual tagline', true);
    missingData.push('company.slogan');
  }
  sourceEvidence['company.slogan'] = sloganField;

  let descriptionField;
  if (m.description && typeof m.description === 'string' && m.description.trim()) {
    descriptionField = createEvidencedField(m.description.trim(), SpecDataSource.MANUAL, 1.0, 'Manual corporate description');
  } else if (w.description && typeof w.description === 'string' && w.description.trim().length > 15) {
    descriptionField = createEvidencedField(w.description.trim(), SpecDataSource.OLD_WEBSITE, 0.85, 'Extracted website description');
  } else if (gSpec.description && typeof gSpec.description === 'string' && gSpec.description.trim()) {
    descriptionField = createEvidencedField(gSpec.description.trim(), SpecDataSource.GOOGLE_MAPS, 0.80, 'Synthesized from Google Maps metadata');
  } else {
    descriptionField = createEvidencedField(
      `${companyNameField.value}, ${industryField.value} alanında müşteri memnuniyeti ve kalite odaklı hizmet sunmaktadır.`,
      SpecDataSource.INFERENCE,
      0.3,
      'Safe generic placeholder narrative',
      true
    );
    missingData.push('company.description');
  }
  sourceEvidence['company.description'] = descriptionField;

  // Track absence of corporate claims to enforce Zero Feature Invention
  const rawFoundedYear = m.foundedYear || w.foundedYear || null;
  if (!rawFoundedYear) {
    missingData.push('company.foundedYear');
  }
  const rawAwards = m.awards || w.awards || null;
  if (!rawAwards || (Array.isArray(rawAwards) && rawAwards.length === 0)) {
    missingData.push('company.awards');
  }
  const rawCerts = m.certifications || w.certifications || null;
  if (!rawCerts || (Array.isArray(rawCerts) && rawCerts.length === 0)) {
    missingData.push('company.certifications');
  }

  // 2. Contact Information
  const manualContact = m.contact || {};
  const webContact = w.contact || {};

  const rawPhone = manualContact.phone || m.phone || g.phone || webContact.phone || null;
  let phoneField;
  if (rawPhone && rawPhone.trim() && rawPhone !== 'Telefon belirtilmemiş') {
    const src = (manualContact.phone || m.phone) ? SpecDataSource.MANUAL : (g.phone ? SpecDataSource.GOOGLE_MAPS : SpecDataSource.OLD_WEBSITE);
    phoneField = createEvidencedField(rawPhone.trim(), src, src === SpecDataSource.MANUAL ? 1.0 : 0.95, `Contact phone from ${src}`);
  } else {
    phoneField = createEvidencedField(null, SpecDataSource.INFERENCE, 0.0, 'No verified phone number', true);
    missingData.push('contact.phone');
  }
  sourceEvidence['contact.phone'] = phoneField;

  const rawEmail = manualContact.email || m.email || webContact.email || null;
  let emailField;
  if (rawEmail && rawEmail.trim() && rawEmail.includes('@')) {
    const src = (manualContact.email || m.email) ? SpecDataSource.MANUAL : SpecDataSource.OLD_WEBSITE;
    emailField = createEvidencedField(rawEmail.trim(), src, src === SpecDataSource.MANUAL ? 1.0 : 0.9, `Email from ${src}`);
  } else {
    emailField = createEvidencedField(null, SpecDataSource.INFERENCE, 0.0, 'No verified email', true);
    missingData.push('contact.email');
  }
  sourceEvidence['contact.email'] = emailField;

  const rawAddress = manualContact.address || m.address || g.address || webContact.address || null;
  let addressField;
  if (rawAddress && rawAddress.trim() && rawAddress !== 'Adres belirtilmemiş') {
    const src = (manualContact.address || m.address) ? SpecDataSource.MANUAL : (g.address ? SpecDataSource.GOOGLE_MAPS : SpecDataSource.OLD_WEBSITE);
    addressField = createEvidencedField(rawAddress.trim(), src, src === SpecDataSource.MANUAL ? 1.0 : 0.95, `Address from ${src}`);
  } else {
    addressField = createEvidencedField(null, SpecDataSource.INFERENCE, 0.0, 'No verified address', true);
    missingData.push('contact.address');
  }
  sourceEvidence['contact.address'] = addressField;

  const rawCity = manualContact.city || m.city || gSpec.contact?.city || webContact.city || null;
  let cityField;
  if (rawCity && rawCity.trim()) {
    cityField = createEvidencedField(rawCity.trim(), (manualContact.city || m.city) ? SpecDataSource.MANUAL : SpecDataSource.GOOGLE_MAPS, 0.9);
  } else {
    cityField = createEvidencedField(null, SpecDataSource.INFERENCE, 0.0, 'City not specified', true);
    missingData.push('contact.city');
  }
  sourceEvidence['contact.city'] = cityField;

  const rawHours = manualContact.workingHours || m.workingHours || g.hours || gSpec.contact?.workingHours || null;
  let hoursField;
  if (rawHours) {
    const display = typeof rawHours === 'object' && rawHours.display ? rawHours.display : (typeof rawHours === 'string' ? rawHours.trim() : null);
    hoursField = display ? createEvidencedField(display, g.hours ? SpecDataSource.GOOGLE_MAPS : SpecDataSource.MANUAL, 0.9, 'Working hours') : createEvidencedField(null, SpecDataSource.INFERENCE, 0.0, null, true);
  } else {
    hoursField = createEvidencedField(null, SpecDataSource.INFERENCE, 0.0, 'No working hours specified', true);
    missingData.push('contact.workingHours');
  }
  sourceEvidence['contact.workingHours'] = hoursField;

  // 3. Location & Google Maps
  const rawMapsUrl = m.googleMapsUrl || mapsUrl || g.url || gSpec.googleMapsDirectUrl || gSpec.googleMapsUrl || null;
  let locationData = {
    mapsUrl: null,
    embedUrl: null,
    rating: null,
    reviewCount: 0,
    hasPhysicalLocation: Boolean(addressField.value)
  };

  if (rawMapsUrl && typeof rawMapsUrl === 'string' && rawMapsUrl.trim()) {
    const cleanUrl = rawMapsUrl.trim();
    const embedUrl = cleanUrl.includes('google.com/maps/embed')
      ? cleanUrl
      : `https://maps.google.com/maps?q=${encodeURIComponent(companyNameField.value + ' ' + (addressField.value || ''))}&output=embed`;

    locationData = {
      mapsUrl: cleanUrl,
      embedUrl,
      rating: g.rating || gSpec.googleRating || m.googleRating || null,
      reviewCount: g.reviewCount || gSpec.googleReviewCount || m.googleReviewCount || 0,
      hasPhysicalLocation: true
    };
    sourceEvidence['location.maps'] = createEvidencedField(cleanUrl, SpecDataSource.GOOGLE_MAPS, 0.98, 'Google Maps profile link');
  } else {
    sourceEvidence['location.maps'] = createEvidencedField(null, SpecDataSource.INFERENCE, 0.0, 'No Google Maps link provided', true);
    missingData.push('location.mapsUrl');
  }

  // 4. Offerings (Services & Products) — ZERO FEATURE INVENTION
  const services = [];
  const products = [];

  function normalizeItem(raw, defaultCat, source) {
    if (!raw) return null;
    if (typeof raw === 'string' && raw.trim()) {
      return {
        title: raw.trim(),
        description: null,
        category: defaultCat,
        slug: raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
        source,
        confidence: 1.0,
        isVerified: true
      };
    }
    if (typeof raw === 'object' && raw.title) {
      return {
        title: raw.title.trim(),
        description: raw.description || raw.summary || null,
        category: raw.category || defaultCat,
        slug: raw.slug || raw.title.trim().toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''),
        price: raw.price || null,
        icon: raw.icon || 'check-circle',
        source: raw.source || source,
        confidence: raw.confidence || 0.95,
        isVerified: true
      };
    }
    return null;
  }

  // Ingest Manual Services
  if (Array.isArray(m.services) && m.services.length > 0) {
    for (const s of m.services) {
      const item = normalizeItem(s, 'service', SpecDataSource.MANUAL);
      if (item) services.push(item);
    }
  } else if (typeof m.services === 'string' && m.services.trim()) {
    m.services.split('\n').filter(s => s.trim()).forEach(s => {
      const item = normalizeItem(s, 'service', SpecDataSource.MANUAL);
      if (item) services.push(item);
    });
  } else if (Array.isArray(w.services) && w.services.length > 0) {
    for (const s of w.services) {
      const item = normalizeItem(s, 'service', SpecDataSource.OLD_WEBSITE);
      if (item) services.push(item);
    }
  } else if (Array.isArray(gSpec.services) && gSpec.services.length > 0) {
    for (const s of gSpec.services) {
      const item = normalizeItem(s, 'service', SpecDataSource.GOOGLE_MAPS);
      if (item) services.push(item);
    }
  }

  // Ingest Manual Products
  if (Array.isArray(m.products) && m.products.length > 0) {
    for (const p of m.products) {
      const item = normalizeItem(p, 'product', SpecDataSource.MANUAL);
      if (item) products.push(item);
    }
  } else if (Array.isArray(w.products) && w.products.length > 0) {
    for (const p of w.products) {
      const item = normalizeItem(p, 'product', SpecDataSource.OLD_WEBSITE);
      if (item) products.push(item);
    }
  }

  if (services.length === 0) {
    missingData.push('offerings.services');
  }
  if (products.length === 0) {
    missingData.push('offerings.products');
  }

  // 5. Team, FAQ, Testimonials, Case Studies, Blog (Zero Invention)
  const team = Array.isArray(m.team) ? m.team : (Array.isArray(w.team) ? w.team : []);
  const faq = Array.isArray(m.faq) ? m.faq : (Array.isArray(m.faqs) ? m.faqs : (Array.isArray(w.faq) ? w.faq : []));
  const rawReviews = (Array.isArray(g.reviews) && g.reviews.length > 0)
    ? g.reviews
    : (Array.isArray(gSpec.googleReviews) ? gSpec.googleReviews : (Array.isArray(m.testimonials) ? m.testimonials : []));
  const testimonials = rawReviews.map((rev, idx) => {
    if (typeof rev === 'string') {
      return { name: `Müşteri ${idx + 1}`, content: rev, rating: 5, source: SpecDataSource.MANUAL };
    }
    return {
      name: rev.author || rev.name || rev.author_name || `Müşteri Değerlendirmesi`,
      companyName: rev.company || rev.company_name || null,
      title: rev.title || null,
      content: rev.text || rev.content || rev.comment || '',
      rating: rev.rating || 5,
      avatar: rev.avatar || rev.profile_photo_url || null,
      source: rev.source || (g.reviews ? SpecDataSource.GOOGLE_MAPS : SpecDataSource.MANUAL)
    };
  }).filter(t => t.content && t.content.trim().length > 0);

  const caseStudies = Array.isArray(m.caseStudies) ? m.caseStudies : (Array.isArray(w.caseStudies) ? w.caseStudies : []);
  const blog = Array.isArray(m.blog) ? m.blog : (Array.isArray(w.blog) ? w.blog : []);

  if (team.length === 0) missingData.push('content.team');
  if (faq.length === 0) missingData.push('content.faq');
  if (testimonials.length === 0) missingData.push('content.testimonials');
  if (caseStudies.length === 0) missingData.push('content.caseStudies');
  if (blog.length === 0) missingData.push('content.blog');

  // 6. Brand & Design Tokens
  const detectedBrandColor = m.theme?.primary || m.brandColor || w.brandColor || w.meta?.brandColor || gSpec.meta?.brandColor || null;
  const brandColorField = detectedBrandColor
    ? createEvidencedField(detectedBrandColor, m.brandColor || m.theme ? SpecDataSource.MANUAL : SpecDataSource.OLD_WEBSITE, 0.95, 'Brand primary color')
    : createEvidencedField('#2563eb', SpecDataSource.INFERENCE, 0.3, 'Default corporate blue palette', true);
  sourceEvidence['brand.primaryColor'] = brandColorField;

  const finalImageDesignSpec = imageDesignSpec || (referenceImageAnalysis ? buildImageDesignSpec({
    analysis: referenceImageAnalysis,
    fidelityMode: referenceImageFidelity
  }) : null);

  if (finalImageDesignSpec) {
    sourceEvidence['design.spec'] = createEvidencedField(
      finalImageDesignSpec.layout?.family,
      SpecDataSource.REFERENCE_IMAGE,
      referenceImageFidelity === 'exact' ? 0.98 : 0.90,
      `Reference Image design spec synthesized in ${referenceImageFidelity} mode`
    );
  }

  const designSpec = {
    palette: {
      primary: brandColorField.value,
      primaryHover: m.theme?.primaryHover || '#1d4ed8',
      accent: m.theme?.accent || '#38bdf8'
    },
    referenceAnalysis: referenceImageAnalysis || null,
    imageDesignSpec: finalImageDesignSpec,
    fidelityMode: referenceImageFidelity,
    layoutFamily: finalImageDesignSpec?.layout?.family || options.layoutFamily || null
  };

  // 7. Navigation & Sitemap Architecture (Dynamically derived from real content)
  const navigation = [
    { title: 'Ana Sayfa', path: '/tr/' },
    { title: 'Kurumsal', path: '/tr/hakkimizda/' }
  ];

  if (services.length > 0) {
    navigation.push({
      title: 'Hizmetlerimiz',
      path: '/tr/hizmetlerimiz/',
      hasDropdown: true,
      items: services.map(s => ({ title: s.title, path: `/tr/hizmetlerimiz/${s.slug}/` }))
    });
  }

  if (products.length > 0) {
    navigation.push({
      title: 'Ürünlerimiz',
      path: '/tr/urunler/',
      hasDropdown: true,
      items: products.map(p => ({ title: p.title, path: `/tr/urunler/${p.slug}/` }))
    });
  }

  if (team.length > 0) {
    navigation.push({ title: 'Ekibimiz', path: '/tr/ekibimiz/' });
  }

  if (testimonials.length > 0) {
    navigation.push({ title: 'Referanslar', path: '/tr/referanslar/' });
  }

  if (caseStudies.length > 0) {
    navigation.push({ title: 'Vaka Analizleri', path: '/tr/vaka-calismalari/' });
  }

  if (faq.length > 0) {
    navigation.push({ title: 'SSS', path: '/tr/sss/' });
  }

  if (blog.length > 0) {
    navigation.push({ title: 'Blog', path: '/tr/blog/' });
  }

  navigation.push({ title: 'İletişim', path: '/tr/iletisim/' });

  // 8. Canonical Pages List
  const pages = [
    { title: 'Ana Sayfa', slug: '', path: '/tr/', type: 'home' },
    { title: 'Hakkımızda', slug: 'hakkimizda', path: '/tr/hakkimizda/', type: 'page' },
    { title: 'İletişim', slug: 'iletisim', path: '/tr/iletisim/', type: 'contact' }
  ];

  if (services.length > 0) {
    pages.push({ title: 'Hizmetlerimiz', slug: 'hizmetlerimiz', path: '/tr/hizmetlerimiz/', type: 'catalog' });
    for (const s of services) {
      pages.push({ title: s.title, slug: s.slug, path: `/tr/hizmetlerimiz/${s.slug}/`, type: 'service' });
    }
  }

  if (products.length > 0) {
    pages.push({ title: 'Ürünlerimiz', slug: 'urunler', path: '/tr/urunler/', type: 'catalog' });
    for (const p of products) {
      pages.push({ title: p.title, slug: p.slug, path: `/tr/urunler/${p.slug}/`, type: 'product' });
    }
  }

  if (team.length > 0) {
    pages.push({ title: 'Ekibimiz', slug: 'ekibimiz', path: '/tr/ekibimiz/', type: 'team' });
  }

  if (faq.length > 0) {
    pages.push({ title: 'Sıkça Sorulan Sorular', slug: 'sss', path: '/tr/sss/', type: 'faq' });
  }

  if (testimonials.length > 0) {
    pages.push({ title: 'Müşteri Yorumları & Referanslar', slug: 'referanslar', path: '/tr/referanslar/', type: 'testimonials' });
  }

  if (caseStudies.length > 0) {
    pages.push({ title: 'Vaka Çalışmaları', slug: 'vaka-calismalari', path: '/tr/vaka-calismalari/', type: 'case_studies' });
  }

  // 9. SEO & Social
  const seo = {
    title: `${companyNameField.value} | ${sloganField.value}`,
    metaDescription: `${companyNameField.value} - ${descriptionField.value}`.substring(0, 160),
    canonicalBase: options.baseUrl || `https://${companyNameField.value.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
    locale: 'tr_TR',
    openGraph: {
      type: 'website',
      title: `${companyNameField.value} | ${sloganField.value}`,
      description: descriptionField.value
    }
  };

  const social = {
    facebook: m.social?.facebook || w.social?.facebook || null,
    instagram: m.social?.instagram || w.social?.instagram || null,
    linkedin: m.social?.linkedin || w.social?.linkedin || null,
    twitter: m.social?.twitter || w.social?.twitter || null,
    youtube: m.social?.youtube || w.social?.youtube || null,
    whatsapp: m.contact?.whatsapp || m.whatsapp || phoneField.value || null
  };

  // 10. Compute Required Capabilities
  const requiredCaps = new Set(['pages', 'media', 'seo', 'forms']);
  if (services.length > 0) requiredCaps.add('services');
  if (products.length > 0) requiredCaps.add('products');
  if (blog.length > 0 || m.blogRequired) requiredCaps.add('blog');
  if (m.teamRequired === true) requiredCaps.add('team');
  if (m.testimonialsRequired === true) requiredCaps.add('testimonials');
  if (m.faqRequired === true) requiredCaps.add('faq');
  if (m.caseStudiesRequired === true) requiredCaps.add('case_studies');
  if (m.brandReferencesRequired === true) requiredCaps.add('brand_references');
  if (m.galleryRequired === true) requiredCaps.add('gallery');

  if (Array.isArray(requiredCapabilities)) {
    for (const c of requiredCapabilities) requiredCaps.add(c);
  }

  return Object.freeze({
    company: Object.freeze({
      name: companyNameField.value,
      industry: industryField.value,
      slogan: sloganField.value,
      description: descriptionField.value
    }),
    brand: Object.freeze({
      logo: m.logoUrl || w.logoUrl || null,
      favicon: m.faviconUrl || '/favicon.ico',
      primaryColor: brandColorField.value,
      secondaryColor: designSpec.palette.primaryHover,
      font: m.font || 'system-ui, -apple-system, sans-serif'
    }),
    contact: Object.freeze({
      phone: phoneField.value,
      email: emailField.value,
      address: addressField.value,
      city: cityField.value,
      district: manualContact.district || m.district || null,
      workingHours: hoursField.value,
      whatsapp: social.whatsapp
    }),
    location: Object.freeze(locationData),
    navigation: Object.freeze(navigation),
    pages: Object.freeze(pages),
    services: Object.freeze(services),
    products: Object.freeze(products),
    blog: Object.freeze(blog),
    team: Object.freeze(team),
    faq: Object.freeze(faq),
    testimonials: Object.freeze(testimonials),
    caseStudies: Object.freeze(caseStudies),
    seo: Object.freeze(seo),
    social: Object.freeze(social),
    design: Object.freeze(designSpec),
    sourceEvidence: Object.freeze(sourceEvidence),
    requiredCapabilities: Object.freeze(Array.from(requiredCaps)),
    missingData: Object.freeze(missingData),
    meta: Object.freeze({
      sourcesUsed: Object.freeze(sourcesUsed),
      hasManual: sourcesUsed.includes(SpecDataSource.MANUAL),
      hasMaps: sourcesUsed.includes(SpecDataSource.GOOGLE_MAPS),
      hasWebsite: sourcesUsed.includes(SpecDataSource.OLD_WEBSITE),
      hasReferenceImage: sourcesUsed.includes(SpecDataSource.REFERENCE_IMAGE),
      generatedAt: new Date().toISOString()
    })
  });
}
