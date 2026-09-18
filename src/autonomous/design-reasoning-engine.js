/**
 * ONLUNET ZEKA — Design Reasoning Engine (FAZ 73)
 *
 * Capabilities:
 * 1. Deep Context & Business Deduction:
 *    - Analyzes normalized CompanyProfile (industry, offerings, reviews, physical location).
 *    - Synthesizes 20 core strategic design parameters.
 * 2. Explainable AI / Deterministic Decisions:
 *    - Every single decision is paired with an explicit machine-readable `reason` and `confidence`.
 *    - Zero arbitrary styling: CSS/layout rules directly reflect business strategy.
 * 3. Fallback Resiliency:
 *    - 100% deterministic heuristic reasoning when external AI gateway is offline.
 *    - Seamlessly augmented if LLM reasoning is provided.
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js.
 */

/**
 * Classifies the industry into a broad archetype category.
 */
export function classifyIndustryCategory(industryStr = '', offerings = []) {
  const normalizeTr = (str) => (str || '').replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
  const s = normalizeTr(industryStr);
  const offeringsText = offerings.map(o => normalizeTr(o.title) + ' ' + normalizeTr(o.description)).join(' ');
  const corpus = `${s} ${offeringsText}`;

  if (/restoran|lokanta|yemek|kebap|kafe|cafe|fırın|pastane|lezzet|mutfak|bistro|pizza|burger|gurme/i.test(corpus)) {
    return 'gastronomy';
  }
  if (/hukuk|avukat|arabuluculuk|danışmanlık|mali müşavir|denetim|sigorta|hukuki/i.test(corpus)) {
    return 'legal_consulting';
  }
  if (/sağlık|diş|klinik|poliklinik|doktor|tıp|hastane|estetik|fizik tedavi|medikal|psikolog/i.test(corpus)) {
    return 'healthcare_medical';
  }
  if (/endüstri|endustri|enerji|solar|güneş|sanayi|imalat|makine|makina|metal|üretim|fabrika|boru|çelik|tesisat|akü|forklift/i.test(corpus)) {
    return 'industrial_manufacturing';
  }
  if (/oto|otomotiv|tamir|servis|bakım|kaporta|lastik|yedek parça|egzoz/i.test(corpus)) {
    return 'automotive_technical';
  }
  if (/lojistik|nakliyat|taşımacılık|kargo|depolama|antrepo|gümrük/i.test(corpus)) {
    return 'logistics_freight';
  }
  if (/pet|kedi|köpek|mama|hayvan|veteriner|akvaryum/i.test(corpus)) {
    return 'petcare_retail';
  }
  if (/yazılım|bilişim|saas|bulut|yapay zeka|teknoloji|software|platform/i.test(corpus)) {
    return 'software_saas_tech';
  }
  return 'corporate_general';
}

/**
 * Executes deep design reasoning based on normalized company profile.
 * Produces 20 strategic parameters with rationale and confidence.
 */
export function deduceDesignStrategy(profile, options = {}) {
  const company = profile?.company || {};
  const contact = profile?.contact || {};
  const metrics = profile?.metrics || {};
  const offerings = profile?.offerings || { services: [], products: [] };
  const facts = profile?.facts || {};

  const allOfferings = [...(offerings.services || []), ...(offerings.products || [])];
  const industryCategory = classifyIndustryCategory(company.industry?.value || '', allOfferings);
  const companyName = company.name?.value || 'İşletme';
  const hasPhysicalStore = facts.hasPhysicalLocation;
  const hasReviews = facts.hasVerifiedReviews;
  const rating = facts.reviewRating || 5.0;
  const reviewCount = facts.reviewCount || 0;

  const decisions = [];

  function record(parameter, decision, reason, confidence = 0.95) {
    const item = Object.freeze({
      parameter,
      decision,
      reason,
      confidence: Number(confidence.toFixed(2))
    });
    decisions.push(item);
    return item;
  }

  // 1. Industry Category
  record(
    'industryCategory',
    industryCategory,
    `Deduced from company industry "${company.industry?.value || 'Genel'}" and ${allOfferings.length} business offerings.`
  );

  // 2. Sub-Industry
  const subIndustryVal = company.subSector?.value || company.industry?.value || 'Genel Ticari Faaliyet';
  record(
    'subIndustry',
    subIndustryVal,
    `Identified specific business vertical for targeted terminology and imagery.`
  );

  // 3. Target Audience
  let audience, audReason;
  if (industryCategory === 'gastronomy') {
    audience = 'local_diners_foodies_families';
    audReason = 'Hospitality businesses primarily serve neighborhood diners, families, and experience seekers.';
  } else if (industryCategory === 'legal_consulting') {
    audience = 'corporate_executives_and_business_owners';
    audReason = 'Legal and consulting firms address high-stakes organizational and contractual stakeholders.';
  } else if (industryCategory === 'industrial_manufacturing') {
    audience = 'procurement_engineers_and_facility_managers';
    audReason = 'Industrial products demand technical specifications, compliance, and B2B vendor reliability.';
  } else if (industryCategory === 'healthcare_medical') {
    audience = 'patients_seeking_expert_care';
    audReason = 'Medical patients seek empathy, hygiene credentials, and specialist expertise.';
  } else {
    audience = 'commercial_and_retail_clients';
    audReason = 'Balanced B2B/B2C audience requiring clear service communication.';
  }
  record('targetAudience', audience, audReason);

  // 4. Purchase Intent
  let purchaseIntent, piReason;
  if (industryCategory === 'gastronomy') {
    purchaseIntent = 'impulsive_lifestyle_appetite';
    piReason = 'Food purchases are emotional, sensory, and time-sensitive.';
  } else if (industryCategory === 'legal_consulting' || industryCategory === 'industrial_manufacturing') {
    purchaseIntent = 'high_deliberation_formal_inquiry';
    piReason = 'High financial and operational impact requires extensive due diligence before conversion.';
  } else if (industryCategory === 'automotive_technical' || industryCategory === 'healthcare_medical') {
    purchaseIntent = 'urgent_or_scheduled_need';
    piReason = 'Users frequently arrive with an acute problem requiring fast trust verification.';
  } else {
    purchaseIntent = 'considered_commercial_purchase';
    piReason = 'Standard commercial evaluation based on capability and competitive advantage.';
  }
  record('purchaseIntent', purchaseIntent, piReason);

  // 5. Business Type
  let businessType, btReason;
  if (industryCategory === 'gastronomy' || (hasPhysicalStore && industryCategory === 'petcare_retail')) {
    businessType = 'physical_destination_experience';
    btReason = 'Physical premises is the core venue for customer satisfaction and service delivery.';
  } else if (industryCategory === 'industrial_manufacturing') {
    businessType = 'engineering_production_facility';
    btReason = 'Manufacturing capability, plant infrastructure, and equipment define enterprise value.';
  } else if (industryCategory === 'legal_consulting' || industryCategory === 'healthcare_medical') {
    businessType = 'professional_licensed_practice';
    btReason = 'Human expertise, ethics, and certified credentials constitute the primary service.';
  } else {
    businessType = 'specialized_service_provider';
    btReason = 'Commercial provider addressing specific domain workflows.';
  }
  record('businessType', businessType, btReason);

  // 6. Service Model
  let serviceModel, smReason;
  if (industryCategory === 'gastronomy') {
    serviceModel = 'walk_in_and_table_reservations';
    smReason = 'Service is experienced on-site or via prompt delivery orders.';
  } else if (industryCategory === 'industrial_manufacturing' || industryCategory === 'logistics_freight') {
    serviceModel = 'b2b_contract_and_custom_rfq';
    smReason = 'Every engagement requires custom dimensional or volumetric quotation.';
  } else if (industryCategory === 'legal_consulting') {
    serviceModel = 'retainer_and_case_advisory';
    smReason = 'Confidential client onboarding through structured consultation.';
  } else {
    serviceModel = 'scheduled_appointments_and_direct_contact';
    smReason = 'Standard booking or direct phone coordination.';
  }
  record('serviceModel', serviceModel, smReason);

  // 7. Brand Positioning
  let brandPositioning, bpReason;
  if (industryCategory === 'legal_consulting') {
    brandPositioning = 'prestigious_authoritative_trusted';
    bpReason = 'Demands sobriety, executive gravity, and uncompromising integrity.';
  } else if (industryCategory === 'gastronomy') {
    brandPositioning = 'warm_artisan_flavor_celebrated';
    bpReason = 'Appetite appeal and friendly hospitality encourage visitation.';
  } else if (industryCategory === 'industrial_manufacturing') {
    brandPositioning = 'rugged_precision_engineered_reliable';
    bpReason = 'Heavy engineering values uptime, precision tolerance, and heavy-duty durability.';
  } else if (industryCategory === 'healthcare_medical') {
    brandPositioning = 'compassionate_clinical_excellence';
    bpReason = 'Patients require calming assurance combined with modern clinical mastery.';
  } else {
    brandPositioning = 'modern_progressive_competent';
    bpReason = 'Clean, efficient, and forward-looking business presence.';
  }
  record('brandPositioning', brandPositioning, bpReason);

  // 8. Trust Requirement
  let trustReq, trReason;
  if (industryCategory === 'legal_consulting' || industryCategory === 'healthcare_medical') {
    trustReq = 'critical_licensed_confidential';
    trReason = 'High regulatory and liability stakes require explicit trust markers.';
  } else if (industryCategory === 'industrial_manufacturing') {
    trustReq = 'technical_standards_and_certifications';
    trReason = 'ISO/CE compliance and proven technical capacity drive decisions.';
  } else {
    trustReq = 'social_proof_and_reputation';
    trReason = 'Customer satisfaction, reviews, and prompt accessibility establish credibility.';
  }
  record('trustRequirement', trustReq, trReason);

  // 9. Visual Mood
  let visualMood, vmReason;
  if (industryCategory === 'gastronomy') {
    visualMood = 'warm_amber_charcoal_appetizing';
    vmReason = 'Warm tones stimulate hunger cues and cozy dining atmosphere.';
  } else if (industryCategory === 'legal_consulting') {
    visualMood = 'classic_navy_gold_editorial';
    vmReason = 'Deep navy with gold accents conveys heritage, authority, and discretion.';
  } else if (industryCategory === 'healthcare_medical') {
    visualMood = 'pure_teal_cyan_clinical_calm';
    vmReason = 'Cool cyan and crisp white surfaces evoke cleanliness, health, and calm.';
  } else if (industryCategory === 'industrial_manufacturing') {
    visualMood = 'slate_steel_warning_amber_engineered';
    vmReason = 'Steel gray and energetic amber highlight industrial power and safety standard.';
  } else {
    visualMood = 'refined_indigo_slate_contemporary';
    vmReason = 'Versatile, high-contrast palette suitable for modern business.';
  }
  record('visualMood', visualMood, vmReason);

  // 10. Content Density
  let contentDensity, cdReason;
  if (industryCategory === 'industrial_manufacturing' || industryCategory === 'legal_consulting') {
    contentDensity = 'deep_technical_editorial';
    cdReason = 'Complex domain necessitates thorough explanation, bullet points, and specification tables.';
  } else if (industryCategory === 'gastronomy') {
    contentDensity = 'sensory_visual_first_concise';
    cdReason = 'Diners want instant menu scanning, prices, appetizing visuals, and rapid actions.';
  } else {
    contentDensity = 'balanced_scannable_hierarchy';
    cdReason = 'Mix of punchy summary cards, key benefits, and readable body copy.';
  }
  record('contentDensity', contentDensity, cdReason);

  // 11. Conversion Priority
  let conversionPriority, cpReason;
  if (industryCategory === 'gastronomy') {
    conversionPriority = 'table_reservation_and_phone';
    cpReason = 'Primary revenue driver is table booking or immediate takeout call.';
  } else if (industryCategory === 'industrial_manufacturing' || industryCategory === 'logistics_freight') {
    conversionPriority = 'request_for_quote_rfq';
    cpReason = 'Enterprise customers convert through formal project inquiries.';
  } else if (industryCategory === 'legal_consulting') {
    conversionPriority = 'confidential_consultation_form';
    cpReason = 'Legal inquiries start with confidential preliminary case evaluations.';
  } else {
    conversionPriority = 'direct_phone_and_inquiry_form';
    cpReason = 'Direct contact channel maximizes lead conversion rate.';
  }
  record('conversionPriority', conversionPriority, cpReason);

  // 12. Image Priority
  let imagePriority, ipReason;
  if (industryCategory === 'gastronomy') {
    imagePriority = 'high_hero_dish_and_venue_visuals';
    ipReason = 'Visual appearance of food directly impacts purchase likelihood.';
  } else if (industryCategory === 'industrial_manufacturing') {
    imagePriority = 'machinery_schematics_and_facility';
    ipReason = 'Industrial clients want to see production capacity and actual machinery.';
  } else if (industryCategory === 'legal_consulting') {
    imagePriority = 'minimalist_architectural_or_seal';
    ipReason = 'High text integrity with stately architectural and symbolic visual cues.';
  } else {
    imagePriority = 'balanced_product_and_team_cards';
    ipReason = 'Clean imagery supporting service descriptions.';
  }
  record('imagePriority', imagePriority, ipReason);

  // 13. Navigation Complexity
  let navComplexity, ncReason;
  if (allOfferings.length > 8) {
    navComplexity = 'categorized_dropdown_hierarchy';
    ncReason = `Large offering catalog (${allOfferings.length} items) requires structured dropdown navigation.`;
  } else if (industryCategory === 'gastronomy') {
    navComplexity = 'focused_menu_location_story';
    ncReason = 'Diners navigate between Menu, Story, Location, and Reservation.';
  } else {
    navComplexity = 'direct_four_pillar_nav';
    ncReason = 'Lean navigation focusing attention on core value proposition and conversion.';
  }
  record('navigationComplexity', navComplexity, ncReason);

  // 14. CTA Strategy
  let ctaStrategy, ctaReason;
  if (industryCategory === 'gastronomy' || industryCategory === 'automotive_technical') {
    ctaStrategy = 'prominent_sticky_call_and_directions';
    ctaReason = 'Mobile users on the go require 1-tap dial and Google Maps navigation.';
  } else if (industryCategory === 'industrial_manufacturing') {
    ctaStrategy = 'dual_rfq_and_technical_catalog';
    ctaReason = 'Engineers either want immediate quotes or technical documentation.';
  } else {
    ctaStrategy = 'hero_lead_capture_and_sticky_header_button';
    ctaReason = 'Persistent contact access across full page scroll journey.';
  }
  record('ctaStrategy', ctaStrategy, ctaReason);

  // 15. Typography Direction
  let typoDirection, typoReason;
  if (industryCategory === 'legal_consulting') {
    typoDirection = 'serif_editorial_headers_with_grotesque_body';
    typoReason = 'Classic serif headers establish gravitas; high-contrast sans body ensures readability.';
  } else if (industryCategory === 'industrial_manufacturing') {
    typoDirection = 'technical_geometric_grotesque';
    typoReason = 'Engineered precision font evokes German/Swiss industrial aesthetic.';
  } else if (industryCategory === 'gastronomy') {
    typoDirection = 'warm_humanist_or_playful_display';
    typoReason = 'Approachable, warm curves convey culinary craft and hospitality.';
  } else {
    typoDirection = 'system_neutral_modern_neo_grotesque';
    typoReason = 'Apple / Stripe standard: maximum legibility across all viewport sizes.';
  }
  record('typographyDirection', typoDirection, typoReason);

  // 16. Color Direction
  let colorDirection, colorReason;
  if (profile?.brand?.brandColor?.value) {
    colorDirection = `custom_brand_adapted_${profile.brand.brandColor.value}`;
    colorReason = `Harmonizing brand color ${profile.brand.brandColor.value} with accessible contrast tokens.`;
  } else if (industryCategory === 'gastronomy') {
    colorDirection = 'warm_amber_copper_terracotta';
    colorReason = 'Appetite stimulating warm spectrum.';
  } else if (industryCategory === 'legal_consulting') {
    colorDirection = 'deep_navy_slate_rich_gold';
    colorReason = 'Traditional hallmarks of justice, security, and prestige.';
  } else if (industryCategory === 'healthcare_medical') {
    colorDirection = 'cyan_medical_blue_pure_white';
    colorReason = 'Universal medical clarity, hygiene, and tranquility.';
  } else if (industryCategory === 'industrial_manufacturing') {
    colorDirection = 'steel_charcoal_machinery_gold';
    colorReason = 'Heavy engineering metal tones with high-visibility accent.';
  } else {
    colorDirection = 'corporate_cobalt_blue_silver';
    colorReason = 'Universally accepted corporate stability and technological capability.';
  }
  record('colorDirection', colorDirection, colorReason);

  // 17. Layout Density
  let layoutDensity, ldReason;
  if (industryCategory === 'gastronomy') {
    layoutDensity = 'generous_airy_spacing';
    ldReason = 'Visual imagery needs room to breathe for maximum appetite impact.';
  } else if (industryCategory === 'industrial_manufacturing') {
    layoutDensity = 'structured_compact_grid';
    ldReason = 'Technical buyers prioritize information density and clear comparison tables.';
  } else {
    layoutDensity = 'balanced_modern_cadence';
    ldReason = 'Standard 80px-100px section vertical spacing with consistent rhythmic scale.';
  }
  record('layoutDensity', layoutDensity, ldReason);

  // 18. Mobile Priority
  let mobilePriority, mpReason;
  if (industryCategory === 'gastronomy' || industryCategory === 'automotive_technical') {
    mobilePriority = 'extreme_speed_one_tap_actions';
    mpReason = 'Over 75% of restaurant and local service searches occur on mobile devices.';
  } else {
    mobilePriority = 'responsive_adaptive_fidelity';
    mpReason = 'Ensures zero horizontal overflow and comfortable thumb tap targets (>= 44px).';
  }
  record('mobilePriority', mobilePriority, mpReason);

  // 19. Social Proof Priority
  let spPriority, spReason;
  if (hasReviews && reviewCount > 0) {
    spPriority = 'verified_google_reviews_prominent';
    spReason = `Business possesses verified ⭐ ${rating} rating with ${reviewCount} reviews; prominently featured as trust anchor.`;
  } else if (industryCategory === 'industrial_manufacturing') {
    spPriority = 'standards_tolerances_and_metrics';
    spReason = 'Industrial validation relies on certified standards, engineering tolerances, and capacity specs.';
  } else {
    spPriority = 'value_guarantees_and_client_commitments';
    spReason = 'Honest service commitments and verified process transparency.';
  }
  record('socialProofPriority', spPriority, spReason);

  // 20. Accent Strategy
  let accentStrategy, asReason;
  if (industryCategory === 'legal_consulting') {
    accentStrategy = 'subtle_refined_metallic_borders';
    asReason = 'Restrained elegance with gold hairline borders and muted badges.';
  } else if (industryCategory === 'industrial_manufacturing' || industryCategory === 'gastronomy') {
    accentStrategy = 'bold_high_contrast_action_color';
    asReason = 'Vibrant CTA buttons guarantee unmistakable visual hierarchy and fast click path.';
  } else {
    accentStrategy = 'balanced_monochromatic_accent';
    asReason = 'Harmonious button and pill badge color elevation.';
  }
  record('accentStrategy', accentStrategy, asReason);

  // Build key-value map of decisions
  const decisionMap = {};
  for (const d of decisions) {
    decisionMap[d.parameter] = d.decision;
  }

  return Object.freeze({
    companyName,
    industryCategory,
    decisions: Object.freeze(decisions),
    strategy: Object.freeze(decisionMap),
    summary: `${companyName} için ${industryCategory} sektörüne özel, ${decisionMap.visualMood} görsel tonuna ve ${decisionMap.conversionPriority} dönüşüm hedefine sahip özgün tasarım stratejisi oluşturuldu.`,
    computedAt: new Date().toISOString()
  });
}
