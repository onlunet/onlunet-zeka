/**
 * ONLUNET ZEKA — Company Profile Normalizer (FAZ 73)
 *
 * Capabilities:
 * 1. Multi-Channel Ingestion:
 *    - Manual data (form inputs)
 *    - Website scraped data (from site-extractor)
 *    - Google Maps listing data (from maps-to-corporate)
 *    - Hybrid combinations
 * 2. Field-level Provenance & Evidence Tracking:
 *    - Every data point retains its source ('manual' | 'website' | 'maps' | 'inferred' | 'generated' | 'none')
 *    - Verification status ('VERIFIED' | 'INFERRED' | 'GENERATED' | 'MISSING')
 *    - Confidence score (0.0 to 1.0)
 *    - Evidence snippet if extracted
 * 3. Anti-Hallucination & Truth Separation:
 *    - Strictly distinguishes verified facts from generated marketing copy
 *    - Never invents unverified specific claims (years in business, awards, exact client counts, 24/7)
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js.
 */

export const DataProvenanceStatus = Object.freeze({
  VERIFIED: 'VERIFIED',
  INFERRED: 'INFERRED',
  GENERATED: 'GENERATED',
  MISSING: 'MISSING'
});

export const DataSource = Object.freeze({
  MANUAL: 'manual',
  WEBSITE: 'website',
  MAPS: 'maps',
  INFERRED: 'inferred',
  GENERATED: 'generated',
  NONE: 'none'
});

/**
 * Creates a normalized datum with provenance and confidence.
 */
function createDatum(value, status = DataProvenanceStatus.MISSING, source = DataSource.NONE, confidence = 0.0, evidence = null) {
  return Object.freeze({
    value: value !== undefined && value !== null ? value : null,
    status,
    source,
    confidence: Number(Math.max(0, Math.min(1, confidence)).toFixed(2)),
    evidence: evidence || null,
    isVerified: status === DataProvenanceStatus.VERIFIED
  });
}

/**
 * Normalizes company profile from multiple input sources.
 *
 * Precedence hierarchy for verified fields:
 * 1. Explicit Manual inputs (highest user intent)
 * 2. Scraped Google Maps listing (fresh local business facts)
 * 3. Scraped Website data (broader corporate narrative)
 * 4. Inferred / Generated fallbacks (safely marked)
 */
export function normalizeCompanyProfile({
  manual = {},
  websiteData = null,
  mapsData = null,
  options = {}
} = {}) {
  const missing = [];
  const inferredList = [];
  const verifiedFields = [];

  // Extract raw containers safely
  const m = manual || {};
  const w = (websiteData && websiteData.spec) ? websiteData.spec : (websiteData || {});
  const wExt = (websiteData && websiteData.rawExtracted) ? websiteData.rawExtracted : {};
  const g = (mapsData && mapsData.listing) ? mapsData.listing : (mapsData || {});
  const gSpec = (mapsData && mapsData.spec) ? mapsData.spec : {};

  // 1. Company Name
  let nameDatum;
  if (m.companyName && typeof m.companyName === 'string' && m.companyName.trim()) {
    nameDatum = createDatum(m.companyName.trim(), DataProvenanceStatus.VERIFIED, DataSource.MANUAL, 1.0, 'Manual user entry');
    verifiedFields.push('company.name');
  } else if (g.name && typeof g.name === 'string' && g.name.trim()) {
    nameDatum = createDatum(g.name.trim(), DataProvenanceStatus.VERIFIED, DataSource.MAPS, 0.95, `Google Maps listing: ${g.name}`);
    verifiedFields.push('company.name');
  } else if (w.companyName && typeof w.companyName === 'string' && w.companyName.trim()) {
    nameDatum = createDatum(w.companyName.trim(), DataProvenanceStatus.VERIFIED, DataSource.WEBSITE, 0.90, `Website title / meta: ${w.companyName}`);
    verifiedFields.push('company.name');
  } else {
    nameDatum = createDatum('Kurumsal İşletme', DataProvenanceStatus.GENERATED, DataSource.GENERATED, 0.2, 'Default fallback');
    missing.push('company.name');
  }

  // 2. Industry & Sub-Sector
  let industryDatum;
  let subSectorDatum;
  const rawIndustry = m.industry || g.category || gSpec.industry || w.industry || null;
  const rawSubSector = m.subSector || m.subSectorId || g.secondaryCategories?.[0] || null;

  if (m.industry && m.industry.trim()) {
    industryDatum = createDatum(m.industry.trim(), DataProvenanceStatus.VERIFIED, DataSource.MANUAL, 1.0, 'Manual user industry selection');
    verifiedFields.push('company.industry');
  } else if (g.category && g.category.trim()) {
    industryDatum = createDatum(g.category.trim(), DataProvenanceStatus.VERIFIED, DataSource.MAPS, 0.95, `Google Maps primary category: ${g.category}`);
    verifiedFields.push('company.industry');
  } else if (w.industry && w.industry.trim()) {
    industryDatum = createDatum(w.industry.trim(), DataProvenanceStatus.VERIFIED, DataSource.WEBSITE, 0.85, `Extracted website industry: ${w.industry}`);
    verifiedFields.push('company.industry');
  } else {
    industryDatum = createDatum('Genel Kurumsal Hizmetler', DataProvenanceStatus.INFERRED, DataSource.INFERRED, 0.4, 'Deduced from business context');
    inferredList.push('company.industry');
  }

  if (rawSubSector && typeof rawSubSector === 'string') {
    subSectorDatum = createDatum(rawSubSector.trim(), DataProvenanceStatus.VERIFIED, m.subSector ? DataSource.MANUAL : DataSource.MAPS, 0.9);
  } else {
    subSectorDatum = createDatum(null, DataProvenanceStatus.MISSING, DataSource.NONE, 0.0);
    missing.push('company.subSector');
  }

  // 3. Description & Narrative
  let descriptionDatum;
  if (m.description && m.description.trim()) {
    descriptionDatum = createDatum(m.description.trim(), DataProvenanceStatus.VERIFIED, DataSource.MANUAL, 1.0, 'Manual user description');
    verifiedFields.push('company.description');
  } else if (w.description && w.description.trim() && w.description.length > 20) {
    descriptionDatum = createDatum(w.description.trim(), DataProvenanceStatus.VERIFIED, DataSource.WEBSITE, 0.85, 'Extracted from website narrative');
    verifiedFields.push('company.description');
  } else if (gSpec.description && gSpec.description.trim()) {
    descriptionDatum = createDatum(gSpec.description.trim(), DataProvenanceStatus.INFERRED, DataSource.MAPS, 0.8, 'Synthesized from Google Maps metadata');
    inferredList.push('company.description');
  } else {
    descriptionDatum = createDatum(
      `${nameDatum.value}, ${industryDatum.value} alanında müşteri odaklı ve kaliteli çözümler sunmaktadır.`,
      DataProvenanceStatus.GENERATED,
      DataSource.GENERATED,
      0.3,
      'Safe generic placeholder'
    );
    missing.push('company.description');
  }

  // 4. Slogan / Tagline
  let sloganDatum;
  if (m.slogan && m.slogan.trim()) {
    sloganDatum = createDatum(m.slogan.trim(), DataProvenanceStatus.VERIFIED, DataSource.MANUAL, 1.0, 'Manual slogan');
  } else if (w.slogan && w.slogan.trim()) {
    sloganDatum = createDatum(w.slogan.trim(), DataProvenanceStatus.VERIFIED, DataSource.WEBSITE, 0.85, 'Extracted tagline');
  } else if (gSpec.slogan && gSpec.slogan.trim()) {
    sloganDatum = createDatum(gSpec.slogan.trim(), DataProvenanceStatus.INFERRED, DataSource.MAPS, 0.75, 'Maps rating tagline');
  } else {
    sloganDatum = createDatum(
      `${industryDatum.value} Alanında Güvenilir ve Profesyonel Hizmet`,
      DataProvenanceStatus.GENERATED,
      DataSource.GENERATED,
      0.3
    );
  }

  // 5. Contact Information
  const manualContact = m.contact || {};
  const webContact = w.contact || wExt.contact || {};
  const rawPhone = manualContact.phone || m.phone || g.phone || webContact.phone || null;
  const rawEmail = manualContact.email || m.email || webContact.email || null;
  const rawAddress = manualContact.address || m.address || g.address || webContact.address || null;
  const rawCity = manualContact.city || m.city || gSpec.contact?.city || webContact.city || null;
  const rawHours = manualContact.workingHours || m.workingHours || g.hours || gSpec.contact?.workingHours || null;

  const phoneDatum = rawPhone && rawPhone !== 'Telefon belirtilmemiş'
    ? createDatum(rawPhone.trim(), DataProvenanceStatus.VERIFIED, (manualContact.phone || m.phone) ? DataSource.MANUAL : (g.phone ? DataSource.MAPS : DataSource.WEBSITE), 0.95, rawPhone)
    : createDatum(null, DataProvenanceStatus.MISSING, DataSource.NONE, 0.0);
  if (!phoneDatum.value) missing.push('contact.phone');

  const emailDatum = rawEmail
    ? createDatum(rawEmail.trim(), DataProvenanceStatus.VERIFIED, (manualContact.email || m.email) ? DataSource.MANUAL : DataSource.WEBSITE, 0.95, rawEmail)
    : createDatum(null, DataProvenanceStatus.MISSING, DataSource.NONE, 0.0);
  if (!emailDatum.value) missing.push('contact.email');

  const addressDatum = rawAddress && rawAddress !== 'Adres belirtilmemiş'
    ? createDatum(rawAddress.trim(), DataProvenanceStatus.VERIFIED, (manualContact.address || m.address) ? DataSource.MANUAL : (g.address ? DataSource.MAPS : DataSource.WEBSITE), 0.95, rawAddress)
    : createDatum(null, DataProvenanceStatus.MISSING, DataSource.NONE, 0.0);
  if (!addressDatum.value) missing.push('contact.address');

  const cityDatum = rawCity
    ? createDatum(rawCity.trim(), DataProvenanceStatus.VERIFIED, (manualContact.city || m.city) ? DataSource.MANUAL : DataSource.INFERRED, 0.9)
    : (addressDatum.value ? createDatum('Türkiye', DataProvenanceStatus.INFERRED, DataSource.INFERRED, 0.5) : createDatum(null, DataProvenanceStatus.MISSING, DataSource.NONE, 0.0));

  let hoursDatum;
  if (rawHours) {
    const hoursDisplay = typeof rawHours === 'object' && rawHours.display ? rawHours.display : (typeof rawHours === 'string' ? rawHours : 'Hafta İçi: 09:00 - 18:00');
    hoursDatum = createDatum(hoursDisplay, DataProvenanceStatus.VERIFIED, g.hours ? DataSource.MAPS : DataSource.MANUAL, 0.9);
  } else {
    hoursDatum = createDatum(null, DataProvenanceStatus.MISSING, DataSource.NONE, 0.0);
    missing.push('contact.workingHours');
  }

  // 6. Online Presence & Maps URLs
  const websiteDatum = (m.websiteUrl || w.sourceUrl || w.url || g.website)
    ? createDatum((m.websiteUrl || w.sourceUrl || w.url || g.website).trim(), DataProvenanceStatus.VERIFIED, m.websiteUrl ? DataSource.MANUAL : (g.website ? DataSource.MAPS : DataSource.WEBSITE), 0.95)
    : createDatum(null, DataProvenanceStatus.MISSING, DataSource.NONE, 0.0);

  const mapsUrlDatum = (m.googleMapsUrl || g.url || gSpec.googleMapsDirectUrl || gSpec.googleMapsUrl)
    ? createDatum((m.googleMapsUrl || g.url || gSpec.googleMapsDirectUrl || gSpec.googleMapsUrl).trim(), DataProvenanceStatus.VERIFIED, DataSource.MAPS, 0.98)
    : createDatum(null, DataProvenanceStatus.MISSING, DataSource.NONE, 0.0);

  // 7. Social Proof & Reviews
  const rawRating = g.rating || g.googleRating || gSpec.googleRating || m.googleRating;
  const ratingDatum = rawRating
    ? createDatum(Number(rawRating), DataProvenanceStatus.VERIFIED, (g.rating || g.googleRating || gSpec.googleRating) ? DataSource.MAPS : DataSource.MANUAL, 1.0, `Google Maps rating: ${rawRating}`)
    : createDatum(null, DataProvenanceStatus.MISSING, DataSource.NONE, 0.0);

  const rawReviewCount = g.reviewCount || g.googleReviewCount || gSpec.googleReviewCount || m.googleReviewCount;
  const reviewCountDatum = rawReviewCount
    ? createDatum(Number(rawReviewCount), DataProvenanceStatus.VERIFIED, (g.reviewCount || g.googleReviewCount || gSpec.googleReviewCount) ? DataSource.MAPS : DataSource.MANUAL, 1.0, `Google Maps review count: ${rawReviewCount}`)
    : createDatum(0, DataProvenanceStatus.MISSING, DataSource.NONE, 0.0);

  const verifiedReviews = (Array.isArray(g.reviews) && g.reviews.length > 0)
    ? g.reviews
    : ((Array.isArray(g.googleReviews) && g.googleReviews.length > 0)
      ? g.googleReviews
      : ((Array.isArray(gSpec.googleReviews) && gSpec.googleReviews.length > 0)
        ? gSpec.googleReviews
        : (Array.isArray(m.googleReviews) ? m.googleReviews : [])));

  // 8. Services & Products Offerings
  const offerings = {
    services: [],
    products: []
  };

  function normalizeItem(raw, defaultCat = 'service', source = DataSource.MANUAL) {
    if (!raw) return null;
    if (typeof raw === 'string') {
      return {
        title: raw.trim(),
        description: null,
        category: defaultCat,
        icon: 'check-circle',
        price: null,
        status: DataProvenanceStatus.VERIFIED,
        source
      };
    }
    return {
      title: raw.title || raw.name || 'Hizmet',
      description: raw.description || raw.summary || null,
      category: raw.category || defaultCat,
      icon: raw.icon || 'check-circle',
      price: raw.price || null,
      status: raw.status || DataProvenanceStatus.VERIFIED,
      source: raw.source || source
    };
  }

  // Ingest manual services
  if (Array.isArray(m.services) && m.services.length > 0) {
    for (const item of m.services) {
      const norm = normalizeItem(item, 'service', DataSource.MANUAL);
      if (norm) offerings.services.push(norm);
    }
  } else if (typeof m.services === 'string' && m.services.trim()) {
    m.services.split('\n').filter(s => s.trim()).forEach(s => {
      offerings.services.push(normalizeItem(s, 'service', DataSource.MANUAL));
    });
  }

  // Ingest website services if empty
  if (offerings.services.length === 0 && Array.isArray(w.services) && w.services.length > 0) {
    for (const item of w.services) {
      const norm = normalizeItem(item, 'service', DataSource.WEBSITE);
      if (norm) offerings.services.push(norm);
    }
  }

  // Ingest maps services/offerings if empty
  if (offerings.services.length === 0 && Array.isArray(gSpec.services) && gSpec.services.length > 0) {
    for (const item of gSpec.services) {
      const norm = normalizeItem(item, 'service', DataSource.MAPS);
      if (norm) offerings.services.push(norm);
    }
  }

  // Ingest products similarly
  if (Array.isArray(m.products) && m.products.length > 0) {
    for (const item of m.products) {
      const norm = normalizeItem(item, 'product', DataSource.MANUAL);
      if (norm) offerings.products.push(norm);
    }
  } else if (Array.isArray(w.products) && w.products.length > 0) {
    for (const item of w.products) {
      const norm = normalizeItem(item, 'product', DataSource.WEBSITE);
      if (norm) offerings.products.push(norm);
    }
  }

  if (offerings.services.length === 0 && offerings.products.length === 0) {
    missing.push('business.offerings');
  }

  // 9. Brand & Visual Clues
  const detectedBrandColor = m.theme?.primary || m.brandColor || w.brandColor || w.meta?.brandColor || gSpec.meta?.brandColor || null;
  const brandColorDatum = detectedBrandColor
    ? createDatum(detectedBrandColor, DataProvenanceStatus.VERIFIED, m.brandColor ? DataSource.MANUAL : DataSource.WEBSITE, 0.9)
    : createDatum(null, DataProvenanceStatus.MISSING, DataSource.NONE, 0.0);

  // 10. Compute Overall Confidence Score
  const totalWeight = 10;
  let earnedWeight = 0;
  if (nameDatum.isVerified) earnedWeight += 2;
  if (industryDatum.isVerified) earnedWeight += 2;
  if (descriptionDatum.isVerified) earnedWeight += 1;
  if (phoneDatum.isVerified || emailDatum.isVerified) earnedWeight += 2;
  if (addressDatum.isVerified || cityDatum.isVerified) earnedWeight += 1;
  if (offerings.services.length > 0 || offerings.products.length > 0) earnedWeight += 1;
  if (ratingDatum.isVerified || reviewCountDatum.isVerified) earnedWeight += 1;

  const confidenceScore = Number((earnedWeight / totalWeight).toFixed(2));

  // 11. Strict Anti-Hallucination Safe Facts
  const safeFacts = Object.freeze({
    hasPhysicalLocation: Boolean(addressDatum.value && addressDatum.isVerified),
    isFoodHospitality: Boolean(
      gSpec.isFoodHospitality ||
      (industryDatum.value && /restoran|cafe|kafe|yemek|mutfak|gıda|pastane|fırın/i.test(industryDatum.value))
    ),
    hasVerifiedReviews: Boolean(ratingDatum.value && reviewCountDatum.value > 0),
    reviewRating: ratingDatum.value,
    reviewCount: reviewCountDatum.value,
    serviceCount: offerings.services.length,
    productCount: offerings.products.length,
    workingHoursAvailable: Boolean(hoursDatum.value && hoursDatum.isVerified)
  });

  return Object.freeze({
    company: Object.freeze({
      name: nameDatum,
      industry: industryDatum,
      subSector: subSectorDatum,
      description: descriptionDatum,
      slogan: sloganDatum
    }),
    contact: Object.freeze({
      phone: phoneDatum,
      email: emailDatum,
      address: addressDatum,
      city: cityDatum,
      workingHours: hoursDatum,
      website: websiteDatum,
      mapsUrl: mapsUrlDatum
    }),
    metrics: Object.freeze({
      rating: ratingDatum,
      reviewCount: reviewCountDatum,
      reviews: Object.freeze(verifiedReviews)
    }),
    offerings: Object.freeze({
      services: Object.freeze(offerings.services),
      products: Object.freeze(offerings.products)
    }),
    brand: Object.freeze({
      brandColor: brandColorDatum,
      logoUrl: createDatum(m.logoUrl || w.logoUrl || null, (m.logoUrl || w.logoUrl) ? DataProvenanceStatus.VERIFIED : DataProvenanceStatus.MISSING)
    }),
    facts: safeFacts,
    missing: Object.freeze(missing),
    inferred: Object.freeze(inferredList),
    verifiedFields: Object.freeze(verifiedFields),
    confidenceScore,
    meta: Object.freeze({
      normalizedAt: new Date().toISOString(),
      channels: {
        hasManual: Boolean(m && Object.keys(m).length > 0),
        hasWebsite: Boolean(websiteData),
        hasMaps: Boolean(mapsData)
      }
    })
  });
}
