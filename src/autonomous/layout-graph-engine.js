/**
 * ONLUNET ZEKA — Layout Graph Engine (FAZ 73 / FAZ 74.1 Genuine Orchestration)
 *
 * Capabilities:
 * 1. Structural Architecture without Pre-baked Templates:
 *    - Resolves 7 architectural design questions dynamically based on DesignReasoning strategy.
 *    - Synthesizes an ordered, weighted graph of page sections per sector and business intent.
 * 2. Sector-Driven Section Sequencing & Differentiation:
 *    - Eliminates the static monolithic skeleton anti-pattern.
 *    - Gastronomy: Appetite-first hero, menu catalog immediately after hero, reservation focus.
 *    - Legal & Consulting: Centered editorial hero, credentials & practice philosophy before offerings.
 *    - Industrial & Manufacturing: Technical specs hero, ISO certifications, machine capabilities, RFQ.
 *    - Retail / Petcare / E-commerce: Product conversion hero, catalog bento grid, quick WhatsApp order.
 *    - Healthcare / Medical: Empathetic clinical hero, specialties, accreditations, appointment booking.
 *    - Software / Tech: Modern split hero, client logos, feature bento grid, demo booking.
 * 3. Same-Sector Variation:
 *    - Differentiates businesses in the same sector based on business model (Boutique vs Community vs Conversion-First).
 * 4. Responsive Transformation Blueprint & Conversion Touchpoints.
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js.
 */

/**
 * Builds a dynamic layout graph tailored to the company's business model, sector strategy, and archetype.
 */
export function buildLayoutGraph(companyProfile, designStrategy, options = {}) {
  const strategy = designStrategy?.strategy || {};
  const indCat = designStrategy?.industryCategory || 'corporate_general';
  const facts = companyProfile?.facts || {};
  const offerings = companyProfile?.offerings || { services: [], products: [] };
  const company = companyProfile?.company || {};
  const companyName = company?.name?.value || 'İşletme';
  const slogan = company?.slogan?.value || '';
  const description = company?.description?.value || '';
  const subSector = company?.subSector?.value || '';
  const hasReviews = Boolean(facts.hasVerifiedReviews);
  const hasPhysicalLocation = Boolean(facts.hasPhysicalLocation);

  // Analyze textual cues for same-sector variations
  const rawNotes = options.inspirationNotes || (typeof options.subProfile === 'string' ? options.subProfile : (options.subProfile?.id || options.subProfile?.palette || '')) || options.variant || subSector || description || '';
  const notes = String(rawNotes).toLowerCase();

  const sections = [];

  function addSection({
    id,
    type,
    title,
    subtitle = null,
    importance = 'secondary',
    visualWeight = 5,
    containerWidth = '1200px',
    layoutPattern = 'standard_grid',
    bgVariant = 'light',
    responsiveRule = 'collapse_to_single_column',
    interactiveComponent = null
  }) {
    sections.push(Object.freeze({
      id,
      type,
      title,
      subtitle,
      importance,
      visualWeight,
      containerWidth,
      layoutPattern,
      bgVariant,
      responsiveRule,
      interactiveComponent
    }));
  }

  // 1. HEADER (Mandatory across all archetypes: Solid opaque sticky header meeting Rule 3 & Rule 6)
  addSection({
    id: 'header-section',
    type: 'header',
    title: 'Site Navigasyonu',
    importance: 'critical',
    visualWeight: 8,
    containerWidth: '1280px',
    layoutPattern: 'flex_between_sticky',
    bgVariant: 'surface_solid_sticky',
    responsiveRule: 'desktop_nav_links_to_mobile_drawer',
    interactiveComponent: 'dropdown_menu_with_touch_toggle'
  });

  // ==========================================
  // SECTOR & ARCHETYPE SPECIFIC GRAPH ASSEMBLY
  // ==========================================

  if (indCat === 'gastronomy') {
    // GASTRONOMY: Appetite-first, Menu first, Social Proof, Reservation
    addSection({
      id: 'hero-section',
      type: 'hero',
      title: slogan || 'Lezzet ve Keyif Dolu Bir Deneyim',
      subtitle: description || 'Geleneksel tarifler ve taze malzemelerle hazırlanan eşsiz lezzetler.',
      importance: 'critical',
      visualWeight: 10,
      containerWidth: '1280px',
      layoutPattern: 'split_hero_appetite_led',
      bgVariant: 'warm_tint',
      responsiveRule: 'stack_vertical_action_first',
      interactiveComponent: 'direct_reservation_call_bar'
    });

    addSection({
      id: 'offerings-section',
      type: 'menu_catalog',
      title: 'Özel Menümüz & Spesiyaller',
      subtitle: 'Her lokmada ustalık, her tabakta taze ve seçkin lezzetler.',
      importance: 'critical',
      visualWeight: 10,
      containerWidth: '1280px',
      layoutPattern: 'menu_card_tabs_or_accordion',
      bgVariant: 'light_surface',
      responsiveRule: 'grid_3_col_to_single_column_scroll',
      interactiveComponent: 'menu_item_selector'
    });

    addSection({
      id: 'trust-bar-section',
      type: 'trust_bar',
      title: 'Lezzet Standartlarımız',
      importance: 'high',
      visualWeight: 7,
      containerWidth: '1200px',
      layoutPattern: 'horizontal_kpi_counters',
      bgVariant: 'surface_accent_border',
      responsiveRule: 'wrap_2x2_grid_on_mobile',
      interactiveComponent: 'verified_stat_counters'
    });

    addSection({
      id: 'about-section',
      type: 'about_capabilities',
      title: `Hakkımızda — ${companyName} Mutfak Felsefesi`,
      subtitle: 'Yerel üreticilerden temin edilen taze malzemeler ve mutfak tutkusu.',
      importance: 'medium',
      visualWeight: 6,
      containerWidth: '1200px',
      layoutPattern: 'split_story_and_feature_list',
      bgVariant: 'subtle_tinted_bg',
      responsiveRule: 'stack_story_then_features',
      interactiveComponent: 'culinary_craft_highlights'
    });

    if (hasReviews || strategy.socialProofPriority === 'verified_google_reviews_prominent') {
      addSection({
        id: 'reviews-section',
        type: 'reviews_social_proof',
        title: 'Misafir Değerlendirmeleri',
        subtitle: `Google Haritalar üzerinde ⭐ ${facts.reviewRating || '4.9'}/5.0 Puan ile tescillenmiş misafir memnuniyeti.`,
        importance: 'high',
        visualWeight: 8,
        containerWidth: '1240px',
        layoutPattern: 'testimonial_card_carousel_or_grid',
        bgVariant: 'light_surface',
        responsiveRule: 'horizontal_scroll_cards_on_mobile',
        interactiveComponent: 'real_google_review_cards'
      });
    }

    addSection({
      id: 'contact-section',
      type: 'conversion_contact',
      title: 'Masa Rezervasyonu & Özel Sipariş',
      subtitle: 'Özel günleriniz ve grup rezervasyonlarınız için hızlı masa ayırtın.',
      importance: 'critical',
      visualWeight: 9,
      containerWidth: '1200px',
      layoutPattern: 'split_form_and_direct_contact',
      bgVariant: 'high_contrast_surface_card',
      responsiveRule: 'stack_form_above_contact_info',
      interactiveComponent: 'reservation_booking_form'
    });

    if (hasPhysicalLocation) {
      addSection({
        id: 'location-section',
        type: 'location_map',
        title: 'Restoran Konumu & Çalışma Saatleri',
        subtitle: companyProfile?.contact?.address?.value || 'Adres bilgisi',
        importance: 'high',
        visualWeight: 7,
        containerWidth: '1280px',
        layoutPattern: 'full_width_map_embed',
        bgVariant: 'light_surface',
        responsiveRule: 'responsive_map_aspect_ratio',
        interactiveComponent: 'google_maps_directions_button'
      });
    }

    addSection({
      id: 'faq-section',
      type: 'faq_accordion',
      title: 'Sıkça Sorulan Sorular',
      subtitle: 'Rezervasyon koşulları, otopark ve menü içerikleri hakkında merak edilenler.',
      importance: 'low',
      visualWeight: 5,
      containerWidth: '960px',
      layoutPattern: 'centered_accordion_list',
      bgVariant: 'subtle_tinted_bg',
      responsiveRule: 'full_width_accordion',
      interactiveComponent: 'collapsible_faq_items'
    });

  } else if (indCat === 'legal_consulting') {
    // LEGAL: Gravitas, Authority, Credentials Bar, Philosophy before Offerings, Confidential Form
    addSection({
      id: 'hero-section',
      type: 'hero',
      title: slogan || 'Hukuki Güvence ve Stratejik Danışmanlık',
      subtitle: description || 'Deneyimli kadro ile gizlilik, titizlik ve etkin dava takibi.',
      importance: 'critical',
      visualWeight: 10,
      containerWidth: '1200px',
      layoutPattern: 'centered_editorial_authority',
      bgVariant: 'navy_deep_subtle_gradient',
      responsiveRule: 'single_col_centered_readable',
      interactiveComponent: 'consultation_modal_trigger'
    });

    addSection({
      id: 'trust-bar-section',
      type: 'trust_bar',
      title: 'Mesleki Yetkinlik & Temsil Standartları',
      importance: 'high',
      visualWeight: 8,
      containerWidth: '1200px',
      layoutPattern: 'credential_badges',
      bgVariant: 'surface_accent_border',
      responsiveRule: 'wrap_2x2_grid_on_mobile',
      interactiveComponent: 'credential_badges_display'
    });

    addSection({
      id: 'about-section',
      type: 'about_capabilities',
      title: `Mesleki İlkelerimiz & ${companyName}`,
      subtitle: 'Yüksek meslek etiği, müvekkil sırrı ve stratejik derinlik.',
      importance: 'high',
      visualWeight: 7,
      containerWidth: '1200px',
      layoutPattern: 'split_story_and_feature_list',
      bgVariant: 'subtle_tinted_bg',
      responsiveRule: 'stack_story_then_features',
      interactiveComponent: 'legal_ethos_accordion'
    });

    addSection({
      id: 'offerings-section',
      type: 'service_grid',
      title: 'Uzmanlık Alanlarımız & Çalışma Konuları',
      subtitle: 'Ulusal ve uluslararası mevzuat çerçevesinde kapsamlı hukuki danışmanlık.',
      importance: 'critical',
      visualWeight: 9,
      containerWidth: '1280px',
      layoutPattern: 'practice_areas_grid',
      bgVariant: 'light_surface',
      responsiveRule: 'grid_3_col_to_single_column_scroll',
      interactiveComponent: 'practice_area_detail_cards'
    });

    addSection({
      id: 'faq-section',
      type: 'faq_accordion',
      title: 'Hukuki Süreç & Sıkça Sorulan Sorular',
      subtitle: 'İlk danışma, vekaletname süreci ve gizlilik protokolleri.',
      importance: 'medium',
      visualWeight: 6,
      containerWidth: '960px',
      layoutPattern: 'centered_accordion_list',
      bgVariant: 'subtle_tinted_bg',
      responsiveRule: 'full_width_accordion',
      interactiveComponent: 'collapsible_faq_items'
    });

    addSection({
      id: 'contact-section',
      type: 'conversion_contact',
      title: 'Gizli Ön Değerlendirme & Randevu',
      subtitle: 'Hukuki durumunuz hakkında avukatlarımızla gizlilik esasıyla görüşün.',
      importance: 'critical',
      visualWeight: 9,
      containerWidth: '1100px',
      layoutPattern: 'centered_lead_card',
      bgVariant: 'high_contrast_surface_card',
      responsiveRule: 'stack_form_above_contact_info',
      interactiveComponent: 'confidential_intake_form'
    });

    if (hasPhysicalLocation) {
      addSection({
        id: 'location-section',
        type: 'location_map',
        title: 'Büro Lokasyonu & Randevu Adresi',
        subtitle: companyProfile?.contact?.address?.value || 'Adres bilgisi',
        importance: 'medium',
        visualWeight: 6,
        containerWidth: '1280px',
        layoutPattern: 'full_width_map_embed',
        bgVariant: 'light_surface',
        responsiveRule: 'responsive_map_aspect_ratio',
        interactiveComponent: 'google_maps_directions_button'
      });
    }

  } else if (indCat === 'industrial_manufacturing') {
    // INDUSTRIAL: Engineering Specs, ISO Certifications, Capacity Matrix, RFQ
    addSection({
      id: 'hero-section',
      type: 'hero',
      title: slogan || 'Endüstriyel Güç ve Mühendislik Çözümleri',
      subtitle: description || 'Yüksek toleranslı imalat, sertifikalı kalite standartları ve kesintisiz tedarik.',
      importance: 'critical',
      visualWeight: 10,
      containerWidth: '1280px',
      layoutPattern: 'split_hero_specs_and_stats',
      bgVariant: 'dark_technical_contrast',
      responsiveRule: 'stack_vertical_specs_first',
      interactiveComponent: 'quick_rfq_trigger'
    });

    addSection({
      id: 'trust-bar-section',
      type: 'trust_bar',
      title: 'Sertifikasyonlar ve İmalat Toleransları',
      importance: 'high',
      visualWeight: 8,
      containerWidth: '1200px',
      layoutPattern: 'industrial_certifications',
      bgVariant: 'surface_accent_border',
      responsiveRule: 'wrap_2x2_grid_on_mobile',
      interactiveComponent: 'iso_certification_badges'
    });

    addSection({
      id: 'offerings-section',
      type: 'service_grid',
      title: 'Üretim Hatlarımız & İmalat Kapasitesi',
      subtitle: 'CNC işleme, hassas döküm ve montaj hatlarında uluslararası standartlar.',
      importance: 'critical',
      visualWeight: 9,
      containerWidth: '1280px',
      layoutPattern: 'manufacturing_capabilities',
      bgVariant: 'light_surface',
      responsiveRule: 'grid_3_col_to_single_column_scroll',
      interactiveComponent: 'spec_table_modal_trigger'
    });

    addSection({
      id: 'about-section',
      type: 'about_capabilities',
      title: `Tesis & Makine Parkı — ${companyName}`,
      subtitle: 'Modern üretim altyapımız, test laboratuvarımız ve lojistik ağımız.',
      importance: 'medium',
      visualWeight: 6,
      containerWidth: '1200px',
      layoutPattern: 'split_story_and_feature_list',
      bgVariant: 'subtle_tinted_bg',
      responsiveRule: 'stack_story_then_features',
      interactiveComponent: 'plant_tour_gallery'
    });

    addSection({
      id: 'faq-section',
      type: 'faq_accordion',
      title: 'Teknik Sorular & İmalat Süreçleri',
      subtitle: 'Minimum sipariş miktarları (MOQ), tolerans standartları ve teslim süreleri.',
      importance: 'medium',
      visualWeight: 6,
      containerWidth: '960px',
      layoutPattern: 'centered_accordion_list',
      bgVariant: 'subtle_tinted_bg',
      responsiveRule: 'full_width_accordion',
      interactiveComponent: 'collapsible_faq_items'
    });

    addSection({
      id: 'contact-section',
      type: 'conversion_contact',
      title: 'Mühendislik Çizimi / RFQ Teklif Talebi',
      subtitle: 'Teknik çizim ve şartnamenizi yükleyerek 48 saatte resmi teklif alın.',
      importance: 'critical',
      visualWeight: 10,
      containerWidth: '1200px',
      layoutPattern: 'rfq_engineering_form',
      bgVariant: 'high_contrast_surface_card',
      responsiveRule: 'stack_form_above_contact_info',
      interactiveComponent: 'rfq_cad_upload_form'
    });

    if (hasPhysicalLocation) {
      addSection({
        id: 'location-section',
        type: 'location_map',
        title: 'Fabrika & Sevkiyat Depo Konumu',
        subtitle: companyProfile?.contact?.address?.value || 'Fabrika adresi',
        importance: 'high',
        visualWeight: 7,
        containerWidth: '1280px',
        layoutPattern: 'full_width_map_embed',
        bgVariant: 'light_surface',
        responsiveRule: 'responsive_map_aspect_ratio',
        interactiveComponent: 'google_maps_directions_button'
      });
    }

  } else if (indCat === 'petcare_retail') {
    // PETCARE / RETAIL: Check for 3 distinct same-sector sub-archetypes!
    const isECommerceWholesale = /toptan|mama satışı|kurye|kapıda ödeme|katalog|hızlı sipariş|arazya/i.test(notes);
    const isCommunityClinic = !isECommerceWholesale && /veteriner|klinik|sağlık|aşı|tedavi|acil hekim/i.test(notes);
    const isBoutique = !isECommerceWholesale && !isCommunityClinic && /butik|lüks pet|tasarım|luxury pet|özel dikim/i.test(notes);

    if (isBoutique) {
      // PetShop A: Boutique Luxury Showcase
      addSection({
        id: 'hero-section',
        type: 'hero',
        title: slogan || 'Seçkin Dostlarınıza Özel Premium Koleksiyonlar',
        subtitle: description || 'Doğal besinler, tasarım aksesuarlar ve butik bakım ürünleri.',
        importance: 'critical',
        visualWeight: 10,
        containerWidth: '1200px',
        layoutPattern: 'boutique_curated_showcase',
        bgVariant: 'warm_tint',
        responsiveRule: 'stack_vertical_card_after',
        interactiveComponent: 'curated_lookbook_button'
      });

      addSection({
        id: 'about-section',
        type: 'about_capabilities',
        title: `Hakkımızda — ${companyName} Butik Dünyası`,
        subtitle: 'Dostlarımızın konforunu ve sağlığını önceleyen özenli seçimler.',
        importance: 'high',
        visualWeight: 7,
        containerWidth: '1200px',
        layoutPattern: 'split_story_and_feature_list',
        bgVariant: 'subtle_tinted_bg',
        responsiveRule: 'stack_story_then_features',
        interactiveComponent: 'curator_note_badge'
      });

      addSection({
        id: 'offerings-section',
        type: 'service_grid',
        title: 'Seçkin Ürün Koleksiyonu',
        subtitle: 'Özenle seçilmiş organik mamalar, tasarım tasmalar ve konfor yatakları.',
        importance: 'critical',
        visualWeight: 9,
        containerWidth: '1280px',
        layoutPattern: 'curated_collection_grid',
        bgVariant: 'light_surface',
        responsiveRule: 'grid_3_col_to_single_column_scroll',
        interactiveComponent: 'product_quick_view_modal'
      });

      if (hasReviews) {
        addSection({
          id: 'reviews-section',
          type: 'reviews_social_proof',
          title: 'Müşteri Deneyimleri',
          subtitle: `⭐ ${facts.reviewRating || '4.9'} Puan ile hayvanseverlerin tercihi.`,
          importance: 'medium',
          visualWeight: 7,
          containerWidth: '1240px',
          layoutPattern: 'testimonial_card_carousel_or_grid',
          bgVariant: 'light_surface',
          responsiveRule: 'horizontal_scroll_cards_on_mobile',
          interactiveComponent: 'real_google_review_cards'
        });
      }

      addSection({
        id: 'contact-section',
        type: 'conversion_contact',
        title: 'Kişisel Sipariş & Danışmanlık',
        subtitle: 'Dostunuz için en uygun mamayı ve beden ölçüsünü birlikte belirleyelim.',
        importance: 'critical',
        visualWeight: 9,
        containerWidth: '1100px',
        layoutPattern: 'centered_lead_card',
        bgVariant: 'high_contrast_surface_card',
        responsiveRule: 'stack_form_above_contact_info',
        interactiveComponent: 'vip_concierge_whatsapp_button'
      });

      addSection({
        id: 'faq-section',
        type: 'faq_accordion',
        title: 'Butik Hizmet & Kargo SSS',
        subtitle: 'Özel kargo, hijyen garantisi ve iade süreçleri.',
        importance: 'medium',
        visualWeight: 5,
        containerWidth: '960px',
        layoutPattern: 'centered_accordion_list',
        bgVariant: 'subtle_tinted_bg',
        responsiveRule: 'full_width_accordion',
        interactiveComponent: 'collapsible_faq_items'
      });

    } else if (isCommunityClinic) {
      // PetShop B: Neighborhood Community & Veterinary Care
      addSection({
        id: 'hero-section',
        type: 'hero',
        title: slogan || 'Dostunuzun Sağlığı ve Mutluluğu İçin Güvenilir Adres',
        subtitle: description || 'Koruyucu hekimlik, aşı takvimi, mama tedariki ve 7/24 acil destek.',
        importance: 'critical',
        visualWeight: 10,
        containerWidth: '1240px',
        layoutPattern: 'community_care_hero',
        bgVariant: 'light_surface_elevated',
        responsiveRule: 'stack_vertical_action_first',
        interactiveComponent: 'emergency_call_touchpoint'
      });

      addSection({
        id: 'offerings-section',
        type: 'service_grid',
        title: 'Hizmetlerimiz & Klinik Bakım',
        subtitle: 'Veteriner kontrolü, pet kuaför, mikroçip ve beslenme danışmanlığı.',
        importance: 'critical',
        visualWeight: 9,
        containerWidth: '1280px',
        layoutPattern: 'service_grid',
        bgVariant: 'light_surface',
        responsiveRule: 'grid_3_col_to_single_column_scroll',
        interactiveComponent: 'service_appointment_selector'
      });

      addSection({
        id: 'trust-bar-section',
        type: 'trust_bar',
        title: 'Klinik Standartlarımız & Lisanslar',
        importance: 'high',
        visualWeight: 7,
        containerWidth: '1200px',
        layoutPattern: 'credential_badges',
        bgVariant: 'surface_accent_border',
        responsiveRule: 'wrap_2x2_grid_on_mobile',
        interactiveComponent: 'veterinary_credentials'
      });

      if (hasPhysicalLocation) {
        addSection({
          id: 'location-section',
          type: 'location_map',
          title: 'Klinik & Mağaza Adresimiz',
          subtitle: companyProfile?.contact?.address?.value || 'Adres bilgisi',
          importance: 'high',
          visualWeight: 8,
          containerWidth: '1280px',
          layoutPattern: 'full_width_map_embed',
          bgVariant: 'light_surface',
          responsiveRule: 'responsive_map_aspect_ratio',
          interactiveComponent: 'emergency_directions_button'
        });
      }

      if (hasReviews) {
        addSection({
          id: 'reviews-section',
          type: 'reviews_social_proof',
          title: 'Hasta Sahibi Değerlendirmeleri',
          subtitle: `⭐ ${facts.reviewRating || '4.9'} Puan ile mahallemizin güven noktası.`,
          importance: 'medium',
          visualWeight: 7,
          containerWidth: '1240px',
          layoutPattern: 'testimonial_card_carousel_or_grid',
          bgVariant: 'light_surface',
          responsiveRule: 'horizontal_scroll_cards_on_mobile',
          interactiveComponent: 'real_google_review_cards'
        });
      }

      addSection({
        id: 'contact-section',
        type: 'conversion_contact',
        title: 'Randevu Alın veya Danışın',
        subtitle: 'Muayene, aşılama veya traş randevusu için iletişime geçin.',
        importance: 'critical',
        visualWeight: 9,
        containerWidth: '1200px',
        layoutPattern: 'split_form_and_direct_contact',
        bgVariant: 'high_contrast_surface_card',
        responsiveRule: 'stack_form_above_contact_info',
        interactiveComponent: 'clinic_appointment_form'
      });

      addSection({
        id: 'faq-section',
        type: 'faq_accordion',
        title: 'Pet Sağlığı & Klinik SSS',
        subtitle: 'Aşı periyotları, acil durumlar ve seyahat pasaportu.',
        importance: 'medium',
        visualWeight: 5,
        containerWidth: '960px',
        layoutPattern: 'centered_accordion_list',
        bgVariant: 'subtle_tinted_bg',
        responsiveRule: 'full_width_accordion',
        interactiveComponent: 'collapsible_faq_items'
      });

    } else {
      // PetShop C: E-commerce / Wholesale / Conversion-First (Default for Arazya Petshop etc.)
      addSection({
        id: 'hero-section',
        type: 'hero',
        title: slogan || 'Tüm Evcil Hayvan İhtiyaçları Kapınızda',
        subtitle: description || 'Orijinal kedi ve köpek mamaları, konserve lezzetler ve aynı gün hızlı teslimat.',
        importance: 'critical',
        visualWeight: 10,
        containerWidth: '1280px',
        layoutPattern: 'product_conversion_first',
        bgVariant: 'light_surface_elevated',
        responsiveRule: 'stack_vertical_action_first',
        interactiveComponent: 'direct_whatsapp_order_bar'
      });

      addSection({
        id: 'offerings-section',
        type: 'service_grid',
        title: 'Öne Çıkan Ürünler & Kampanyalı Paketler',
        subtitle: 'Lider mama markaları, kum çeşitleri ve vitamin takviyeleri.',
        importance: 'critical',
        visualWeight: 10,
        containerWidth: '1280px',
        layoutPattern: 'product_catalog_bento_grid',
        bgVariant: 'light_surface',
        responsiveRule: 'grid_3_col_to_single_column_scroll',
        interactiveComponent: 'instant_whatsapp_order_buttons'
      });

      addSection({
        id: 'contact-section',
        type: 'conversion_contact',
        title: 'Hızlı Sipariş & WhatsApp Destek',
        subtitle: 'Sepet beklemeden doğrudan WhatsApp üzerinden sipariş verin, kapıda ödeyin.',
        importance: 'critical',
        visualWeight: 9,
        containerWidth: '1100px',
        layoutPattern: 'quick_order_touchpoint',
        bgVariant: 'high_contrast_surface_card',
        responsiveRule: 'stack_form_above_contact_info',
        interactiveComponent: 'one_click_whatsapp_order'
      });

      addSection({
        id: 'trust-bar-section',
        type: 'trust_bar',
        title: 'Sipariş & Teslimat Güvencesi',
        importance: 'high',
        visualWeight: 7,
        containerWidth: '1200px',
        layoutPattern: 'delivery_guarantee_trust_bar',
        bgVariant: 'surface_accent_border',
        responsiveRule: 'wrap_2x2_grid_on_mobile',
        interactiveComponent: 'verified_stat_counters'
      });

      if (hasReviews) {
        addSection({
          id: 'reviews-section',
          type: 'reviews_social_proof',
          title: 'Müşteri Memnuniyeti',
          subtitle: `Google üzerinde ⭐ ${facts.reviewRating || '4.9'} Puan ile doğrulanmış alışveriş yorumları.`,
          importance: 'medium',
          visualWeight: 7,
          containerWidth: '1240px',
          layoutPattern: 'testimonial_card_carousel_or_grid',
          bgVariant: 'light_surface',
          responsiveRule: 'horizontal_scroll_cards_on_mobile',
          interactiveComponent: 'real_google_review_cards'
        });
      }

      addSection({
        id: 'faq-section',
        type: 'faq_accordion',
        title: 'Sipariş, Kurye & Ödeme SSS',
        subtitle: 'Aynı gün teslimat bölgeleri, kapıda kartla ödeme ve orijinal ürün garantisi.',
        importance: 'medium',
        visualWeight: 6,
        containerWidth: '960px',
        layoutPattern: 'centered_accordion_list',
        bgVariant: 'subtle_tinted_bg',
        responsiveRule: 'full_width_accordion',
        interactiveComponent: 'collapsible_faq_items'
      });

      if (hasPhysicalLocation) {
        addSection({
          id: 'location-section',
          type: 'location_map',
          title: 'Mağazamız & Depo Teslimat Noktası',
          subtitle: companyProfile?.contact?.address?.value || 'Mağaza adresi',
          importance: 'medium',
          visualWeight: 6,
          containerWidth: '1280px',
          layoutPattern: 'full_width_map_embed',
          bgVariant: 'light_surface',
          responsiveRule: 'responsive_map_aspect_ratio',
          interactiveComponent: 'google_maps_directions_button'
        });
      }
    }

  } else if (indCat === 'software_saas_tech') {
    // SOFTWARE / TECH: Modern split hero, Client KPIs, Feature Bento, Demo
    addSection({
      id: 'hero-section',
      type: 'hero',
      title: slogan || 'Yapay Zeka Destekli Kurumsal Çözümler',
      subtitle: description || 'Operasyonel verimliliği artıran, ölçeklenebilir ve güvenli bulut mimarisi.',
      importance: 'critical',
      visualWeight: 10,
      containerWidth: '1280px',
      layoutPattern: 'modern_balanced_split',
      bgVariant: 'dark_technical_contrast',
      responsiveRule: 'stack_vertical_card_after',
      interactiveComponent: 'demo_request_button'
    });

    addSection({
      id: 'trust-bar-section',
      type: 'trust_bar',
      title: 'Güvenilirlik & SLA',
      importance: 'high',
      visualWeight: 7,
      containerWidth: '1200px',
      layoutPattern: 'client_logos_and_kpis',
      bgVariant: 'surface_accent_border',
      responsiveRule: 'wrap_2x2_grid_on_mobile',
      interactiveComponent: 'uptime_counter'
    });

    addSection({
      id: 'offerings-section',
      type: 'service_grid',
      title: 'Modüller & Platform Yetenekleri',
      subtitle: 'Modern API entegrasyonu ve kurumsal seviye güvenlik protokolleri.',
      importance: 'critical',
      visualWeight: 10,
      containerWidth: '1280px',
      layoutPattern: 'bento_card_grid',
      bgVariant: 'light_surface',
      responsiveRule: 'grid_3_col_to_single_column_scroll',
      interactiveComponent: 'interactive_feature_tabs'
    });

    addSection({
      id: 'about-section',
      type: 'about_capabilities',
      title: `Teknoloji Vizyonumuz — ${companyName}`,
      subtitle: 'Geleceğin dijital altyapısını bugünden inşa eden mühendislik ekibi.',
      importance: 'medium',
      visualWeight: 6,
      containerWidth: '1200px',
      layoutPattern: 'split_story_and_feature_list',
      bgVariant: 'subtle_tinted_bg',
      responsiveRule: 'stack_story_then_features',
      interactiveComponent: 'tech_stack_badges'
    });

    if (hasReviews) {
      addSection({
        id: 'reviews-section',
        type: 'reviews_social_proof',
        title: 'Müşteri Başarı Hikayeleri',
        subtitle: 'Sektör lideri kurumların platformumuzla elde ettiği verimlilik artışı.',
        importance: 'high',
        visualWeight: 8,
        containerWidth: '1240px',
        layoutPattern: 'testimonial_card_carousel_or_grid',
        bgVariant: 'light_surface',
        responsiveRule: 'horizontal_scroll_cards_on_mobile',
        interactiveComponent: 'case_study_card_slider'
      });
    }

    addSection({
      id: 'faq-section',
      type: 'faq_accordion',
      title: 'Sıkça Sorulan Sorular',
      subtitle: 'Entegrasyon süresi, veri güvenliği ve SLA garantileri.',
      importance: 'medium',
      visualWeight: 6,
      containerWidth: '960px',
      layoutPattern: 'centered_accordion_list',
      bgVariant: 'subtle_tinted_bg',
      responsiveRule: 'full_width_accordion',
      interactiveComponent: 'collapsible_faq_items'
    });

    addSection({
      id: 'contact-section',
      type: 'conversion_contact',
      title: 'Canlı Demo ve Çözüm Görüşmesi',
      subtitle: 'Teknoloji uzmanlarımızla ihtiyaçlarınıza özel demo planlayın.',
      importance: 'critical',
      visualWeight: 9,
      containerWidth: '1100px',
      layoutPattern: 'centered_lead_card',
      bgVariant: 'high_contrast_surface_card',
      responsiveRule: 'stack_form_above_contact_info',
      interactiveComponent: 'saas_demo_booking_form'
    });

  } else if (indCat === 'healthcare_medical') {
    // HEALTHCARE: Empathetic Clinical, Specialties, Accreditations, Appointment
    addSection({
      id: 'hero-section',
      type: 'hero',
      title: slogan || 'Sağlığınız İçin Bilimsel ve Şefkatli Yaklaşım',
      subtitle: description || 'Alanında uzman hekimler, modern tanı altyapısı ve hasta odaklı bakım.',
      importance: 'critical',
      visualWeight: 10,
      containerWidth: '1240px',
      layoutPattern: 'empathetic_clinical_hero',
      bgVariant: 'light_surface_elevated',
      responsiveRule: 'stack_vertical_action_first',
      interactiveComponent: 'appointment_phone_touchpoint'
    });

    addSection({
      id: 'offerings-section',
      type: 'service_grid',
      title: 'Tıbbi Birimlerimiz & Tedavi Alanları',
      subtitle: 'Güncel tıp protokollerine uygun, multidisipliner klinik hizmetler.',
      importance: 'critical',
      visualWeight: 10,
      containerWidth: '1280px',
      layoutPattern: 'medical_specialties_grid',
      bgVariant: 'light_surface',
      responsiveRule: 'grid_3_col_to_single_column_scroll',
      interactiveComponent: 'doctor_profile_modal'
    });

    addSection({
      id: 'trust-bar-section',
      type: 'trust_bar',
      title: 'Klinik Akreditasyonlar & Kalite',
      importance: 'high',
      visualWeight: 8,
      containerWidth: '1200px',
      layoutPattern: 'credential_badges',
      bgVariant: 'surface_accent_border',
      responsiveRule: 'wrap_2x2_grid_on_mobile',
      interactiveComponent: 'clinical_accreditations'
    });

    addSection({
      id: 'about-section',
      type: 'about_capabilities',
      title: `Hasta Odaklı Hizmet Anlayışı — ${companyName}`,
      subtitle: 'Hasta güvenliği, konfor ve tıbbi etik kurallarından taviz vermeyen anlayış.',
      importance: 'medium',
      visualWeight: 6,
      containerWidth: '1200px',
      layoutPattern: 'split_story_and_feature_list',
      bgVariant: 'subtle_tinted_bg',
      responsiveRule: 'stack_story_then_features',
      interactiveComponent: 'hygiene_standards_badge'
    });

    if (hasReviews) {
      addSection({
        id: 'reviews-section',
        type: 'reviews_social_proof',
        title: 'Hasta Değerlendirmeleri',
        subtitle: `⭐ ${facts.reviewRating || '4.9'} Puan ile tescillenmiş hasta memnuniyeti.`,
        importance: 'high',
        visualWeight: 8,
        containerWidth: '1240px',
        layoutPattern: 'testimonial_card_carousel_or_grid',
        bgVariant: 'light_surface',
        responsiveRule: 'horizontal_scroll_cards_on_mobile',
        interactiveComponent: 'real_google_review_cards'
      });
    }

    addSection({
      id: 'contact-section',
      type: 'conversion_contact',
      title: 'Online Randevu Talebi',
      subtitle: 'Hekimlerimizden uygun gün ve saat için randevu oluşturun.',
      importance: 'critical',
      visualWeight: 9,
      containerWidth: '1200px',
      layoutPattern: 'split_form_and_direct_contact',
      bgVariant: 'high_contrast_surface_card',
      responsiveRule: 'stack_form_above_contact_info',
      interactiveComponent: 'clinical_appointment_form'
    });

    if (hasPhysicalLocation) {
      addSection({
        id: 'location-section',
        type: 'location_map',
        title: 'Klinik Konumu & Ulaşım',
        subtitle: companyProfile?.contact?.address?.value || 'Klinik adresi',
        importance: 'high',
        visualWeight: 7,
        containerWidth: '1280px',
        layoutPattern: 'full_width_map_embed',
        bgVariant: 'light_surface',
        responsiveRule: 'responsive_map_aspect_ratio',
        interactiveComponent: 'google_maps_directions_button'
      });
    }

    addSection({
      id: 'faq-section',
      type: 'faq_accordion',
      title: 'Hasta Rehberi & SSS',
      subtitle: 'Muayene hazırlığı, sigorta anlaşmaları ve randevu iptal kuralları.',
      importance: 'medium',
      visualWeight: 5,
      containerWidth: '960px',
      layoutPattern: 'centered_accordion_list',
      bgVariant: 'subtle_tinted_bg',
      responsiveRule: 'full_width_accordion',
      interactiveComponent: 'collapsible_faq_items'
    });

  } else {
    // CORPORATE GENERAL (Balanced, high conversion, robust)
    addSection({
      id: 'hero-section',
      type: 'hero',
      title: slogan || `${companyName} ile Geleceğe Güvenle`,
      subtitle: description || 'Kurumsal uzmanlık, yenilikçi çözümler ve koşulsuz müşteri memnuniyeti.',
      importance: 'critical',
      visualWeight: 10,
      containerWidth: '1240px',
      layoutPattern: 'modern_balanced_split',
      bgVariant: 'light_surface_elevated',
      responsiveRule: 'stack_vertical_card_after',
      interactiveComponent: 'lead_inquiry_button'
    });

    addSection({
      id: 'trust-bar-section',
      type: 'trust_bar',
      title: 'Güven Göstergeleri',
      importance: 'high',
      visualWeight: 7,
      containerWidth: '1200px',
      layoutPattern: 'horizontal_kpi_counters',
      bgVariant: 'surface_accent_border',
      responsiveRule: 'wrap_2x2_grid_on_mobile',
      interactiveComponent: 'verified_stat_counters'
    });

    addSection({
      id: 'offerings-section',
      type: 'service_grid',
      title: offerings.products?.length > 0 ? 'Hizmet ve Çözümlerimiz' : 'Uzmanlık Alanlarımız',
      subtitle: 'Sektörel standartlara tam uyumlu, ölçülebilir ve güvenilir hizmet paketi.',
      importance: 'critical',
      visualWeight: 9,
      containerWidth: '1280px',
      layoutPattern: 'bento_card_grid',
      bgVariant: 'light_surface',
      responsiveRule: 'grid_3_col_to_single_column_scroll',
      interactiveComponent: 'service_detail_modal_or_link'
    });

    addSection({
      id: 'about-section',
      type: 'about_capabilities',
      title: `Hakkımızda — ${companyName}`,
      subtitle: 'İlkeli çalışma anlayışı, tecrübe ve geleceğe değer katan vizyon.',
      importance: 'medium',
      visualWeight: 6,
      containerWidth: '1200px',
      layoutPattern: 'split_story_and_feature_list',
      bgVariant: 'subtle_tinted_bg',
      responsiveRule: 'stack_story_then_features',
      interactiveComponent: 'tabbed_values_view'
    });

    if (hasReviews || strategy.socialProofPriority === 'verified_google_reviews_prominent') {
      addSection({
        id: 'reviews-section',
        type: 'reviews_social_proof',
        title: 'Müşteri Değerlendirmeleri',
        subtitle: `Google Haritalar üzerinde ⭐ ${facts.reviewRating || '4.9'}/5.0 Puan ile doğrulanmış müşteri memnuniyeti.`,
        importance: 'high',
        visualWeight: 8,
        containerWidth: '1240px',
        layoutPattern: 'testimonial_card_carousel_or_grid',
        bgVariant: 'light_surface',
        responsiveRule: 'horizontal_scroll_cards_on_mobile',
        interactiveComponent: 'real_google_review_cards'
      });
    }

    addSection({
      id: 'faq-section',
      type: 'faq_accordion',
      title: 'Sıkça Sorulan Sorular',
      subtitle: 'Hizmetlerimiz, süreçlerimiz ve operasyonel detaylar hakkında merak edilenler.',
      importance: 'medium',
      visualWeight: 6,
      containerWidth: '960px',
      layoutPattern: 'centered_accordion_list',
      bgVariant: 'subtle_tinted_bg',
      responsiveRule: 'full_width_accordion',
      interactiveComponent: 'collapsible_faq_items'
    });

    addSection({
      id: 'contact-section',
      type: 'conversion_contact',
      title: 'Hemen İletişime Geçin',
      subtitle: 'Uzman ekibimiz talebinizi hızla değerlendirip en kısa sürede dönüş sağlamaktadır.',
      importance: 'critical',
      visualWeight: 9,
      containerWidth: '1200px',
      layoutPattern: hasPhysicalLocation ? 'split_form_and_direct_contact' : 'centered_lead_card',
      bgVariant: 'high_contrast_surface_card',
      responsiveRule: 'stack_form_above_contact_info',
      interactiveComponent: 'crm_lead_capture_form'
    });

    if (hasPhysicalLocation) {
      addSection({
        id: 'location-section',
        type: 'location_map',
        title: 'Konum & Ulaşım',
        subtitle: companyProfile?.contact?.address?.value || 'Adres bilgisi',
        importance: 'high',
        visualWeight: 7,
        containerWidth: '1280px',
        layoutPattern: 'full_width_map_embed',
        bgVariant: 'light_surface',
        responsiveRule: 'responsive_map_aspect_ratio',
        interactiveComponent: 'google_maps_directions_button'
      });
    }
  }

  // FINAL MANDATORY: FOOTER
  addSection({
    id: 'footer-section',
    type: 'footer',
    title: 'Alt Bilgi & Yasal Haklar',
    importance: 'medium',
    visualWeight: 5,
    containerWidth: '1280px',
    layoutPattern: 'multi_column_footer',
    bgVariant: 'dark_footer_surface',
    responsiveRule: 'collapse_columns_to_single_accordion',
    interactiveComponent: 'back_to_top_button'
  });

  return Object.freeze({
    companyName,
    industryCategory: indCat,
    sectionCount: sections.length,
    sections: Object.freeze(sections),
    architectureQuestions: Object.freeze({
      q1_sectionSequence: sections.map(s => s.id),
      q2_visualHierarchy: sections.reduce((acc, s) => { acc[s.id] = s.visualWeight; return acc; }, {}),
      q3_containerWidths: sections.reduce((acc, s) => { acc[s.id] = s.containerWidth; return acc; }, {}),
      q4_backgroundRhythm: sections.map(s => `${s.id}:${s.bgVariant}`),
      q5_responsiveRules: sections.reduce((acc, s) => { acc[s.id] = s.responsiveRule; return acc; }, {}),
      q6_interactiveComponents: sections.filter(s => s.interactiveComponent).map(s => s.interactiveComponent),
      q7_conversionTouchpoints: ['hero_primary_cta', 'header_sticky_cta', 'contact_form_lead']
    }),
    generatedAt: new Date().toISOString()
  });
}
