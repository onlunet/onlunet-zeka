/**
 * ONLUNET ZEKA — Multi-Source Input Adapter (FAZ 75)
 *
 * Ingests, prioritizes, and normalizes corporate data from 5 potential channels:
 * 1. Manual user data (forms)
 * 2. Old / legacy website URL
 * 3. Google Maps link
 * 4. Reference / template screenshot image
 * 5. Multi-source hybrid combinations
 *
 * Strict Precedence Hierarchy:
 * MANUAL USER DATA > VERIFIED SOURCE DATA > EXTRACTED WEBSITE DATA > MAP DATA > AI INFERENCE.
 *
 * All AI inferred values are explicitly marked with `provenance: 'inferred'`.
 * Integrates directly with Backend Capability Registry to detect missing modules early.
 */

import { normalizeCompanyProfile, DataProvenanceStatus, DataSource } from './company-profile-normalizer.js';
import { validateBackendCapabilities } from './backend-capability-registry.js';
import { analyzeReferenceImage, computeReferenceDesignMatch } from './reference-image-analyzer.js';
import { buildCorporateSiteSpec } from './corporate-spec.js';

export async function ingestMultiSourceCorporateData({
  manual = {},
  websiteUrl = null,
  websiteData = null,
  mapsUrl = null,
  mapsData = null,
  referenceImage = null,
  referenceImagePath = null,
  requiredCapabilities = [],
  options = {}
} = {}) {
  const warnings = [];
  const sourcesUsed = [];

  // 1. Manual Source Identification
  const hasManual = manual && Object.keys(manual).length > 0 && (manual.companyName || manual.industry || manual.services);
  if (hasManual) sourcesUsed.push('manual');

  // 2. Website Data Processing
  let resolvedWebsite = websiteData;
  if (websiteUrl && !resolvedWebsite) {
    sourcesUsed.push('website');
  } else if (resolvedWebsite) {
    sourcesUsed.push('website');
  }

  // 3. Google Maps Processing
  let resolvedMaps = mapsData;
  if (mapsUrl && !resolvedMaps) {
    sourcesUsed.push('maps');
  } else if (resolvedMaps) {
    sourcesUsed.push('maps');
  }

  // 4. Reference Image Analysis
  let referenceAnalysis = null;
  if (referenceImage || referenceImagePath) {
    sourcesUsed.push('reference_image');
    try {
      referenceAnalysis = analyzeReferenceImage({
        imageBuffer: referenceImage,
        imagePath: referenceImagePath,
        notes: manual.inspirationNotes || ''
      });
    } catch (refErr) {
      warnings.push(`Reference image analysis warning: ${refErr.message}`);
    }
  }

  // 5. Run Provenance-Aware Company Profile Normalizer
  const normalized = normalizeCompanyProfile({
    manual: {
      ...manual,
      websiteUrl: manual.websiteUrl || websiteUrl,
      googleMapsUrl: manual.googleMapsUrl || mapsUrl
    },
    websiteData: resolvedWebsite,
    mapsData: resolvedMaps,
    options
  });

  // Overlay reference image design tokens if manual theme is not explicitly specified
  if (referenceAnalysis && referenceAnalysis.inferredDesignTokens) {
    normalized.designSystem = {
      palette: referenceAnalysis.detectedPalette,
      tokens: referenceAnalysis.inferredDesignTokens,
      layoutAnalysis: referenceAnalysis.layoutAnalysis,
      provenance: 'reference-derived'
    };
  }

  // 6. Automatic Capability Discovery & Verification
  // Determine all features required by the synthesized company profile
  const detectedCapabilities = new Set(['pages', 'media', 'seo', 'forms']);

  if (normalized.offerings?.services && normalized.offerings.services.length > 0) {
    detectedCapabilities.add('services');
  }
  if (normalized.offerings?.products && normalized.offerings.products.length > 0) {
    detectedCapabilities.add('products');
  }
  if (manual.blogRequired || manual.hasBlog || (resolvedWebsite && resolvedWebsite.blog)) {
    detectedCapabilities.add('blog');
  }
  if (manual.teamRequired === true) {
    detectedCapabilities.add('team');
  }
  if (manual.testimonialsRequired === true) {
    detectedCapabilities.add('testimonials');
  }
  if (manual.faqRequired === true) {
    detectedCapabilities.add('faq');
  }
  if (manual.caseStudiesRequired === true) {
    detectedCapabilities.add('case_studies');
  }
  if (manual.brandReferencesRequired === true) {
    detectedCapabilities.add('brand_references');
  }
  if (manual.galleryRequired === true) {
    detectedCapabilities.add('gallery');
  }

  // Add explicitly requested capabilities
  if (Array.isArray(requiredCapabilities)) {
    for (const cap of requiredCapabilities) {
      detectedCapabilities.add(cap);
    }
  }

  const capabilityValidation = validateBackendCapabilities(Array.from(detectedCapabilities));

  // Expose ergonomic aliases on normalized profile
  const extendedProfile = {
    ...normalized,
    services: normalized.offerings?.services || [],
    products: normalized.offerings?.products || [],
    socialProof: {
      rating: normalized.metrics?.rating || null,
      reviewCount: normalized.metrics?.reviewCount || null,
      reviews: normalized.metrics?.reviews || []
    }
  };

  // 7. Assemble Canonical Corporate Site Spec (FAZ 76)
  const corporateSiteSpec = buildCorporateSiteSpec({
    manual,
    websiteData: resolvedWebsite,
    websiteUrl,
    mapsData: resolvedMaps,
    mapsUrl,
    referenceImageAnalysis: referenceAnalysis,
    requiredCapabilities: Array.from(detectedCapabilities),
    options
  });

  // 8. Assemble Complete Normalization Output
  return {
    companyProfile: extendedProfile,
    corporateSiteSpec,
    sourcesUsed,
    sourcesSummary: {
      manual: hasManual,
      website: !!resolvedWebsite || !!websiteUrl,
      maps: !!resolvedMaps || !!mapsUrl,
      referenceImage: !!referenceAnalysis
    },
    provenanceReport: {
      verifiedCount: (normalized.verifiedFields || []).length,
      inferredCount: (normalized.inferred || []).length,
      missingCount: (normalized.missing || []).length,
      verifiedFields: normalized.verifiedFields || [],
      inferredFields: normalized.inferred || [],
      missingFields: normalized.missing || []
    },
    referenceAnalysis,
    detectedCapabilities: Array.from(detectedCapabilities),
    capabilityValidation,
    isGenerationBlocked: capabilityValidation.blocked,
    warnings
  };
}
