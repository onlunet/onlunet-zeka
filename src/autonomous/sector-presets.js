/**
 * ONLUNET ZEKA - Sector Presets & Taxonomy Engine
 * Authoritative taxonomy comprising 13 Main Categories and 80+ Sub-Sectors.
 *
 * Each preset adheres to VoltAgent/awesome-design-md and Google Stitch standards:
 * - Specific color palette (primary, secondary, background, surface, text, border)
 * - Typography (headings font, body font)
 * - Geometry & Radius (0-4px sharp for architecture/industrial vs 12-16px soft for healthcare/education)
 * - Layout Style Theme (clean_clinical_light, editorial_magazine_sharp, dark_bento_cyber, etc.)
 * - Required functional sections & modules
 * - Interactive tools & simulators
 * - High-conversion CTA behavior
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js ESM.
 */

export const MainCategories = Object.freeze({
  HEALTH_MEDICAL: {
    id: 'HEALTH_MEDICAL',
    code: '1',
    name: 'Sağlık, Medikal & İyi Yaşam',
    icon: '⚕️',
    vibe: 'Bol beyaz alan, steril/ferah hava, açık mavi/turkuaz/adaçayı yeşili, yumuşak kenarlar (12-16px), güven verici ve insani tipografi.',
    defaultTheme: 'clean_clinical_light'
  },
  CONSTRUCTION_REAL_ESTATE: {
    id: 'CONSTRUCTION_REAL_ESTATE',
    code: '2',
    name: 'İnşaat, Gayrimenkul, Mimarlık & Yaşam Alanları',
    icon: '🏛️',
    vibe: 'Prestijli, keskin kenarlar (0-4px), antrasit/bronz/bej/siyah, editorial/dergi mizanpajı, tam ekran görsel galerileri, asimetrik grid.',
    defaultTheme: 'editorial_magazine_sharp'
  },
  HEAVY_INDUSTRY_MANUFACTURING: {
    id: 'HEAVY_INDUSTRY_MANUFACTURING',
    code: '3',
    name: 'Sanayi, İmalat & Ağır Endüstri (B2B)',
    icon: '⚙️',
    vibe: 'Teknik, maskülen, çelik grisi, koyu lacivert, endüstriyel sarı/turuncu, yoğun veri düzeni, kurumsal ve oturaklı fontlar.',
    defaultTheme: 'technical_industrial_data'
  },
  AGRICULTURE_FOOD: {
    id: 'AGRICULTURE_FOOD',
    code: '4',
    name: 'Tarım, Gıda, Hayvancılık & İçecek',
    icon: '🌾',
    vibe: 'Doğal tonlar (toprak rengi, zeytin yeşili, buğday sarısı), organik dokular, tarladan sofraya hikaye anlatımı.',
    defaultTheme: 'warm_artisan_organic'
  },
  LAW_FINANCE_CONSULTING: {
    id: 'LAW_FINANCE_CONSULTING',
    code: '5',
    name: 'Hukuk, Finans, Denetim & Danışmanlık',
    icon: '⚖️',
    vibe: 'Ağırbaşlı, prestijli, otoriter, gece mavisi, bordo, mürdüm, altın varak detaylar, klasik serif tipografi.',
    defaultTheme: 'authoritative_classic'
  },
  TECH_SOFTWARE: {
    id: 'TECH_SOFTWARE',
    code: '6',
    name: 'Teknoloji, Yazılım, Bilişim & Telekomünikasyon',
    icon: '💻',
    vibe: 'Modern dark mode, fütüristik neon/mor/cyan vurgular, cam efekti, bento-grid kartlar, interaktif canlı elementler.',
    defaultTheme: 'dark_bento_cyber'
  },
  LOGISTICS_AUTOMOTIVE: {
    id: 'LOGISTICS_AUTOMOTIVE',
    code: '7',
    name: 'Lojistik, Ulaşım & Otomotiv',
    icon: '🚢',
    vibe: 'Hareket, hız, dakiklik hissi, kırmızı/turuncu/parlak mavi aksanlar, geniş harita alanları, dinamik şemalar.',
    defaultTheme: 'high_velocity_logistics'
  },
  TOURISM_HOSPITALITY: {
    id: 'TOURISM_HOSPITALITY',
    code: '8',
    name: 'Turizm, Konaklama, Yeme-İçme & Etkinlik',
    icon: '🏨',
    vibe: 'Duygusal, iştah açıcı veya rahatlatıcı renkler, yüksek kaliteli atmosfer fotoğrafları, misafir odaklı sıcak arayüz.',
    defaultTheme: 'inviting_hospitality'
  },
  EDUCATION_ACADEMY: {
    id: 'EDUCATION_ACADEMY',
    code: '9',
    name: 'Eğitim, Akademi & Kültür-Sanat',
    icon: '🎓',
    vibe: 'Canlı, güvenilir, enerjik renkler (mavi, turuncu, mor, sarı), anlaşılır tipografi, öğrenci ve veli odaklı çift kanallı navigasyon.',
    defaultTheme: 'friendly_education'
  },
  ENERGY_ENVIRONMENT_MINING: {
    id: 'ENERGY_ENVIRONMENT_MINING',
    code: '10',
    name: 'Enerji, Çevre, Geri Dönüşüm & Maden',
    icon: '⚡',
    vibe: 'Ekolojik yeşiller, güneş sarısı, toprak tonları, temiz/sürdürülebilir grafikler, mühendislik göstergeleri.',
    defaultTheme: 'eco_engineering'
  },
  SPORTS_FITNESS_BEAUTY: {
    id: 'SPORTS_FITNESS_BEAUTY',
    code: '11',
    name: 'Spor, Fitness, Güzellik & Kişisel Bakım',
    icon: '✨',
    vibe: 'Dinamik, enerjik (neon yeşil, siyah, pembe/altın, fuşya), fit/estetik görseller, motivasyonel tipografi.',
    defaultTheme: 'high_energy_sports'
  },
  LOCAL_SERVICES_EMERGENCY: {
    id: 'LOCAL_SERVICES_EMERGENCY',
    code: '12',
    name: 'Yerel Hizmetler, Teknik Servisler & Güvenlik',
    icon: '🔧',
    vibe: 'Mobil öncelikli (Mobile-First), dev arama butonu, doğrudan tıkla-ara ve WhatsApp butonları, 30 dakikada kapıda güven rozetleri.',
    defaultTheme: 'mobile_first_dispatch'
  },
  NGO_ASSOCIATION_FOUNDATION: {
    id: 'NGO_ASSOCIATION_FOUNDATION',
    code: '13',
    name: 'STK, Vakıf, Dernek & Birlikler',
    icon: '🤝',
    vibe: 'Topluluk odaklı, şeffaf, samimi ve güven veren yapı, bağış ve katılım butonları.',
    defaultTheme: 'community_trust'
  }
});

export const SubSectorPresets = Object.freeze({
  // ==========================================
  // 1. SAĞLIK, MEDİKAL & İYİ YAŞAM (1 - 7)
  // ==========================================
  PLASTIK_CERRAHI_ESTETIK: {
    id: 'PLASTIK_CERRAHI_ESTETIK',
    number: 1,
    parentCategory: 'HEALTH_MEDICAL',
    name: 'Plastik Cerrahi, Saç Ekimi & Estetik (Sağlık Turizmi)',
    keywords: ['plastik cerrahi', 'saç ekimi', 'sac ekimi', 'estetik', 'rinoplasti', 'sağlık turizmi', 'hair transplant', 'aesthetic'],
    designTokens: {
      palette: {
        primary: '#0d9488', // Teal
        secondary: '#115e59',
        accent: '#f59e0b',
        bg: '#fafafa',
        surface: '#ffffff',
        text: '#0f172a',
        border: '#e2e8f0'
      },
      borderRadius: '16px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'clean_clinical_light'
    },
    requiredSections: ['hero_medical', 'stats_strip', 'before_after_slider', 'vip_travel_packages', 'doctor_team_grid', 'services_cards', 'lead_form'],
    interactiveTool: {
      type: 'before_after_slider',
      title: 'Tedavi Sonuçları & Before / After Karşılaştırma Vitrini',
      subtitle: 'Gerçek hastalarımızın operasyon öncesi ve sonrası medikal sonuçlarını inceleyin.'
    },
    ctaBehavior: {
      primaryText: 'Ücretsiz Online Konsültasyon',
      secondaryText: 'WhatsApp ile Fotoğraf Gönder',
      badge: '🌍 VIP Havalimanı & Otel Transfer Paketi',
      phoneText: 'Hemen Doktorla Görüş'
    }
  },

  DIS_KLINIGI_AGIZ_SAGLIGI: {
    id: 'DIS_KLINIGI_AGIZ_SAGLIGI',
    number: 2,
    parentCategory: 'HEALTH_MEDICAL',
    name: 'Diş Klinikleri & Ağız-Diş Sağlığı',
    keywords: ['diş kliniği', 'dis klinigi', 'diş hekimi', 'dis hekimi', 'implant', 'gülüş tasarımı', 'zirkonyum', 'ortodonti', 'dental'],
    designTokens: {
      palette: {
        primary: '#0ea5e9', // Sky blue
        secondary: '#0369a1',
        accent: '#10b981',
        bg: '#f8fafc',
        surface: '#ffffff',
        text: '#0f172a',
        border: '#e2e8f0'
      },
      borderRadius: '14px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'clean_clinical_light'
    },
    requiredSections: ['hero_medical', 'stats_strip', 'treatment_guide_tabs', 'doctor_team_grid', 'before_after_slider', 'clinic_virtual_tour', 'lead_form'],
    interactiveTool: {
      type: 'dental_booking_simulator',
      title: 'Online Randevu & Gülüş Tasarımı Ön Analiz Modülü',
      subtitle: 'Tedavi türünü ve uygun gün/saati seçerek uzman hekim ajandasına anında kaydolun.'
    },
    ctaBehavior: {
      primaryText: 'Online Diş Randevusu Al',
      secondaryText: 'WhatsApp ile Röntgen Gönder',
      badge: '🦷 Ağrısız & Dijital Gülüş Tasarımı',
      phoneText: 'Klinik Randevu Hattı'
    }
  },

  PSIKOLOG_AILE_DANISMANLIGI: {
    id: 'PSIKOLOG_AILE_DANISMANLIGI',
    number: 3,
    parentCategory: 'HEALTH_MEDICAL',
    name: 'Psikolog, Psikiyatrist & Aile Danışmanlığı',
    keywords: ['psikolog', 'psikiyatri', 'aile danışmanlığı', 'terapi', 'çift terapisi', 'depresyon', 'anksiyete', 'pedagog'],
    designTokens: {
      palette: {
        primary: '#059669', // Sage / Emerald calm
        secondary: '#047857',
        accent: '#d97706',
        bg: '#fcfdfd',
        surface: '#ffffff',
        text: '#1e293b',
        border: '#e2e8f0'
      },
      borderRadius: '16px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'clean_clinical_light'
    },
    requiredSections: ['hero_medical', 'therapy_specialties', 'therapist_profile', 'online_zoom_sessions', 'podcast_articles', 'lead_form'],
    interactiveTool: {
      type: 'therapy_session_planner',
      title: 'Bireysel & Çift Terapi İhtiyaç Belirleme Aracı',
      subtitle: 'Destek almak istediğiniz konuyu belirleyin, yüz yüze veya online seans planınızı oluşturalım.'
    },
    ctaBehavior: {
      primaryText: 'Online Terapi Randevusu Al',
      secondaryText: 'WhatsApp Ön Bilgi',
      badge: '🌿 Gizlilik & Etik İlkelerle Güvenli Seanslar',
      phoneText: 'Danışmanlık Hattı'
    }
  },

  FIZIK_TEDAVI_REHABILITASYON: {
    id: 'FIZIK_TEDAVI_REHABILITASYON',
    number: 4,
    parentCategory: 'HEALTH_MEDICAL',
    name: 'Fizik Tedavi, Manuel Terapi & Rehabilitasyon',
    keywords: ['fizik tedavi', 'manuel terapi', 'fizyoterapi', 'rehabilitasyon', 'fizyoterapist', 'bel fıtığı', 'felç rehabilitasyonu'],
    designTokens: {
      palette: {
        primary: '#0284c7', // Calm blue
        secondary: '#0369a1',
        accent: '#14b8a6',
        bg: '#f8fafc',
        surface: '#ffffff',
        text: '#0f172a',
        border: '#cbd5e1'
      },
      borderRadius: '14px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'clean_clinical_light'
    },
    requiredSections: ['hero_medical', 'symptom_search', 'treatment_packages', 'patient_success_stories', 'physio_team', 'lead_form'],
    interactiveTool: {
      type: 'symptom_treatment_finder',
      title: 'Ağrı & Rahatsızlık Bölgesi Tedavi Eşleştirici',
      subtitle: 'Ağrı hissettiğiniz bölgeyi (Boyun, Bel, Omuz, Diz) seçin; uygulanan manuel terapi yöntemlerini görün.'
    },
    ctaBehavior: {
      primaryText: 'Ücretsiz Fizyoterapi Değerlendirmesi',
      secondaryText: 'WhatsApp ile Bilgi Al',
      badge: '⚡ Ameliyatsız Hareket Özgürlüğü',
      phoneText: 'Tedavi Hattı'
    }
  },

  DIYETISYEN_BESLENME: {
    id: 'DIYETISYEN_BESLENME',
    number: 5,
    parentCategory: 'HEALTH_MEDICAL',
    name: 'Diyetisyen & Beslenme Danışmanlığı',
    keywords: ['diyetisyen', 'beslenme uzmanı', 'kilo verme', 'online diyet', 'sporcu beslenmesi', 'ketojenik', 'andulasyon'],
    designTokens: {
      palette: {
        primary: '#16a34a', // Fresh green
        secondary: '#15803d',
        accent: '#ea580c',
        bg: '#f0fdf4',
        surface: '#ffffff',
        text: '#14532d',
        border: '#bbf7d0'
      },
      borderRadius: '16px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'clean_clinical_light'
    },
    requiredSections: ['hero_medical', 'stats_strip', 'diet_packages', 'bmi_calculator_section', 'client_transformations', 'lead_form'],
    interactiveTool: {
      type: 'bmi_calorie_calculator',
      title: 'Vücut Kitle Endeksi (VKE) & İdeal Kilo Hesaplayıcı',
      subtitle: 'Boy, kilo ve yaş bilgilerinizi girin; vücut kitle endeksinizi ve hedeflenen kalori aralığını anında hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'Kişiye Özel Diyet Paketini Seç',
      secondaryText: 'WhatsApp Diyet Asistanı',
      badge: '🥗 Bilimsel & Sürdürülebilir Beslenme',
      phoneText: 'Randevu & Analiz Hattı'
    }
  },

  VETERINER_KLINIKLERI: {
    id: 'VETERINER_KLINIKLERI',
    number: 6,
    parentCategory: 'HEALTH_MEDICAL',
    name: 'Veteriner Klinikleri & Hayvan Hastaneleri',
    keywords: ['veteriner', 'hayvan hastanesi', 'veteriner kliniği', 'pet aşı', 'kedi tedavisi', 'köpek tedavisi', 'acil veteriner'],
    designTokens: {
      palette: {
        primary: '#0d9488', // Teal
        secondary: '#115e59',
        accent: '#f97316',
        bg: '#f0fdfa',
        surface: '#ffffff',
        text: '#0f172a',
        border: '#ccfbf1'
      },
      borderRadius: '16px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'clean_clinical_light'
    },
    requiredSections: ['hero_medical', 'emergency_24_7_bar', 'vaccine_schedule', 'pet_grooming_hotel', 'vet_team', 'lead_form'],
    interactiveTool: {
      type: 'vaccine_schedule_tracker',
      title: 'Kedi & Köpek Aşı Takvimi ve Periyodik Bakım Sorgulama',
      subtitle: 'Dostunuzun yaş ve türüne göre yapılması gereken zorunlu aşı ve parazit uygulamalarını kontrol edin.'
    },
    ctaBehavior: {
      primaryText: '7/24 Acil Çağrı & Randevu',
      secondaryText: 'WhatsApp ile Konum Al',
      badge: '🐾 7/24 Tam Teşekküllü Yoğun Bakım & Cerrahi',
      phoneText: 'Acil Veteriner Hattı'
    }
  },

  TIBBI_CIHAZ_SARF_MALZEME: {
    id: 'TIBBI_CIHAZ_SARF_MALZEME',
    number: 7,
    parentCategory: 'HEALTH_MEDICAL',
    name: 'Tıbbi Cihaz, Protez & Medikal Sarf Malzeme',
    keywords: ['tıbbi cihaz', 'medikal sarf', 'ortopedi protez', 'cerrahi alet', 'hastane ekipmanları', 'uts kayıt', 'medikal toptan'],
    designTokens: {
      palette: {
        primary: '#0369a1', // Clinical deep blue
        secondary: '#075985',
        accent: '#10b981',
        bg: '#f8fafc',
        surface: '#ffffff',
        text: '#0f172a',
        border: '#e2e8f0'
      },
      borderRadius: '10px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'clean_clinical_light'
    },
    requiredSections: ['hero_medical', 'stats_strip', 'product_catalog_datasheet', 'uts_regulatory_cert', 'dealership_form', 'lead_form'],
    interactiveTool: {
      type: 'medical_datasheet_finder',
      title: 'Tıbbi Cihaz & Sarf Malzeme Şartname ve UBB/ÜTS Sorgulama',
      subtitle: 'Katalog kodunu veya ürün adını girerek teknik şartname ve CE sertifikalarını anında indirin.'
    },
    ctaBehavior: {
      primaryText: 'Hastane & Bayi Teklifi Al',
      secondaryText: 'Teknik Kılavuz (Datasheet) İndir',
      badge: '🛡️ CE & ISO 13485 Medikal Standartlar',
      phoneText: 'Kurumsal Satış Hattı'
    }
  },

  // =========================================================================
  // 2. İNŞAAT, GAYRİMENKUL, MİMARLIK & YAŞAM ALANLARI (8 - 13)
  // =========================================================================
  MUTEAHHITLIK_BUYUK_KONUT: {
    id: 'MUTEAHHITLIK_BUYUK_KONUT',
    number: 8,
    parentCategory: 'CONSTRUCTION_REAL_ESTATE',
    name: 'Müteahhitlik & Büyük Konut/Rezidans Projeleri',
    keywords: ['müteahhit', 'konut projesi', 'rezidans', 'toplu konut', 'kentsel dönüşüm', 'kat karşılığı', 'satılık daire proje'],
    designTokens: {
      palette: {
        primary: '#b45309', // Bronze / Gold
        secondary: '#1c1917',
        accent: '#d97706',
        bg: '#0c0a09', // Dark luxury
        surface: '#1c1917',
        text: '#fafaf9',
        border: '#292524'
      },
      borderRadius: '2px', // Sharp architectural
      typography: {
        heading: 'Playfair Display',
        body: 'Inter'
      },
      styleTheme: 'editorial_magazine_sharp'
    },
    requiredSections: ['hero_architectural', 'project_status_tabs', 'floor_plan_selector', 'sales_office_booking', 'construction_timeline', 'lead_form'],
    interactiveTool: {
      type: 'floor_plan_configurator',
      title: 'İnteraktif Kat Planı & Daire Tipi Seçici (1+1, 2+1, 3+1, Penthouse)',
      subtitle: 'Projemizdeki blok ve katı seçerek net m², cephe ve güneş alma simülasyonunu anında inceleyin.'
    },
    ctaBehavior: {
      primaryText: 'Örnek Daire Randevusu Al',
      secondaryText: 'Proje Kataloğunu İndir',
      badge: '🏛️ Depreme Dayanıklı C35/40 Radye Temel Mimarisi',
      phoneText: 'Satış Ofisi Doğrudan Hattı'
    }
  },

  MIMARLIK_IC_MIMARLIK_OFISI: {
    id: 'MIMARLIK_IC_MIMARLIK_OFISI',
    number: 9,
    parentCategory: 'CONSTRUCTION_REAL_ESTATE',
    name: 'Mimarlık, İç Mimarlık & Restorasyon Ofisleri',
    keywords: ['mimarlık', 'iç mimarlık', 'ic mimarlik', 'restorasyon', 'villa tasarımı', 'ofis tasarımı', 'render', 'architect'],
    designTokens: {
      palette: {
        primary: '#18181b', // Ultra sharp black / zinc
        secondary: '#27272a',
        accent: '#a1a1aa',
        bg: '#ffffff',
        surface: '#fafafa',
        text: '#09090b',
        border: '#e4e4e7'
      },
      borderRadius: '0px', // Strict razor sharp
      typography: {
        heading: 'Cinzel',
        body: 'Inter'
      },
      styleTheme: 'editorial_magazine_sharp'
    },
    requiredSections: ['hero_minimalist', 'fullscreen_portfolio_grid', 'project_specs_meta', 'press_awards_list', 'lead_form'],
    interactiveTool: {
      type: 'architectural_brief_creator',
      title: 'Mimari Tasarım & Alan Keşif Brifingi Oluşturucu',
      subtitle: 'Mekan tipi (Villa, Ofis, Otel, Kafe) ve metrekareyi girerek konsept tasarım takvimini belirleyin.'
    },
    ctaBehavior: {
      primaryText: 'Mimari Proje Teklifi Al',
      secondaryText: 'Dijital Lookbook İncele',
      badge: '📐 Ulusal ve Uluslararası Tasarım Ödüllü Ofis',
      phoneText: 'Stüdyo İletişim Hattı'
    }
  },

  LUKS_GAYRIMENKUL_EMLAK: {
    id: 'LUKS_GAYRIMENKUL_EMLAK',
    number: 10,
    parentCategory: 'CONSTRUCTION_REAL_ESTATE',
    name: 'Lüks Gayrimenkul Danışmanlığı & Emlak',
    keywords: ['gayrimenkul', 'emlak', 'lüks konut', 'yalı', 'villa satılık', 'arsa yatırım', 'realtor', 'property'],
    designTokens: {
      palette: {
        primary: '#92400e', // Amber luxury
        secondary: '#1e293b',
        accent: '#b45309',
        bg: '#0f172a',
        surface: '#1e293b',
        text: '#f8fafc',
        border: '#334155'
      },
      borderRadius: '4px',
      typography: {
        heading: 'Playfair Display',
        body: 'Inter'
      },
      styleTheme: 'editorial_magazine_sharp'
    },
    requiredSections: ['hero_real_estate', 'portfolio_filters', 'luxury_listings_grid', 'agent_cards', 'video_tour_embed', 'lead_form'],
    interactiveTool: {
      type: 'real_estate_filter_engine',
      title: 'Lüks Gayrimenkul Portföy Filtreleme & Değerleme Motoru',
      subtitle: 'Bölge, oda sayısı, arsa büyüklüğü ve bütçenizi seçerek eşleşen özel portföyleri anında listeleyin.'
    },
    ctaBehavior: {
      primaryText: 'Özel Portföy Sunumu Talep Et',
      secondaryText: 'WhatsApp Özel Danışman',
      badge: '💎 VIP & Off-Market Gayrimenkul Portföyü',
      phoneText: 'Yatırım Danışmanı Hattı'
    }
  },

  PREFABRIK_CELIK_TINY_HOUSE: {
    id: 'PREFABRIK_CELIK_TINY_HOUSE',
    number: 11,
    parentCategory: 'CONSTRUCTION_REAL_ESTATE',
    name: 'Prefabrik, Çelik Konstrüksiyon & Tiny House',
    keywords: ['prefabrik', 'çelik ev', 'celik konstrüksiyon', 'tiny house', 'hafif çelik', 'modüler ev', 'ahşap ev'],
    designTokens: {
      palette: {
        primary: '#ea580c', // Structural orange
        secondary: '#292524',
        accent: '#0284c7',
        bg: '#fafaf9',
        surface: '#ffffff',
        text: '#1c1917',
        border: '#e7e5e4'
      },
      borderRadius: '6px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'editorial_magazine_sharp'
    },
    requiredSections: ['hero_modular', 'model_3d_gallery', 'insulation_spec_diagram', 'price_m2_configurator', 'shipping_assembly_steps', 'lead_form'],
    interactiveTool: {
      type: 'tinyhouse_cost_configurator',
      title: 'Tiny House & Prefabrik Model ve m² Fiyat Konfigüratörü',
      subtitle: 'İstediğiniz yaşam alanı ölçüsünü (24m², 40m², 80m²) ve yalıtım tipini seçerek tahmini üretim maliyetini hesaplayın.'
    },
    ctaBehavior: {
      primaryText: '3 Boyutlu Model Kataloğu Al',
      secondaryText: 'Showroom Ziyaret Randevusu',
      badge: '🚛 Türkiye Geneli 15 Günde Anahtar Teslim Montaj',
      phoneText: 'Üretim Fabrikası Hattı'
    }
  },

  YAPI_MALZEMELERI_IZOLASYON: {
    id: 'YAPI_MALZEMELERI_IZOLASYON',
    number: 12,
    parentCategory: 'CONSTRUCTION_REAL_ESTATE',
    name: 'Yapı Malzemeleri, İzolasyon & Zemin/Cephe Sistemleri',
    keywords: ['yapı malzemeleri', 'yalıtım', 'izolasyon', 'dış cephe', 'mantolama', 'zemin kaplama', 'epoksi', 'seramik toptan'],
    designTokens: {
      palette: {
        primary: '#c2410c', // Terracotta
        secondary: '#334155',
        accent: '#eab308',
        bg: '#f8fafc',
        surface: '#ffffff',
        text: '#0f172a',
        border: '#cbd5e1'
      },
      borderRadius: '4px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'technical_industrial_data'
    },
    requiredSections: ['hero_materials', 'color_texture_swatches', 'durability_lab_reports', 'dealer_map_locator', 'lead_form'],
    interactiveTool: {
      type: 'insulation_energy_saving_calc',
      title: 'Dış Cephe & Yalıtım Enerji Tasarruf Hesaplayıcı',
      subtitle: 'Bina metrekarenizi girerek ısı ve su yalıtımı sonrası yıllık doğalgaz/enerji tasarrufunuzu görün.'
    },
    ctaBehavior: {
      primaryText: 'Şantiye & Toptan Fiyat Teklifi Al',
      secondaryText: 'Teknik Numune Talep Et',
      badge: '🛡️ TSE & Yangın Dayanım Sertifikalı Ürünler',
      phoneText: 'Toptan Sipariş Hattı'
    }
  },

  HARITA_GEOTEKNIK_ZEMIN: {
    id: 'HARITA_GEOTEKNIK_ZEMIN',
    number: 13,
    parentCategory: 'CONSTRUCTION_REAL_ESTATE',
    name: 'Harita, Geoteknik & Zemin Etüdü Mühendisliği',
    keywords: ['zemin etüdü', 'harita mühendisliği', 'geoteknik', 'sondaj', 'plankote', 'imar uygulama', 'sismik ölçüm'],
    designTokens: {
      palette: {
        primary: '#475569', // Slate engineering
        secondary: '#0f172a',
        accent: '#f59e0b',
        bg: '#ffffff',
        surface: '#f1f5f9',
        text: '#0f172a',
        border: '#cbd5e1'
      },
      borderRadius: '4px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'JetBrains Mono'
      },
      styleTheme: 'technical_industrial_data'
    },
    requiredSections: ['hero_engineering', 'equipment_fleet_inventory', 'public_references_list', 'geo_coordinates_map', 'lead_form'],
    interactiveTool: {
      type: 'soil_survey_timeline_estimator',
      title: 'Zemin Sondaj & Parsel Etüt Süresi Hesaplayıcı',
      subtitle: 'Parsel büyüklüğü ve kat adedini belirleyin; gereken sondaj derinliği ve raporlama süresini hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'Resmi Zemin Etüt Teklifi Al',
      secondaryText: 'Mühendislik Heyetiyle Görüş',
      badge: '📐 Bakanlık Akredite Zemin Mekaniği Laboratuvarı',
      phoneText: 'Mühendislik Danışma Hattı'
    }
  },

  // =========================================================================
  // 3. SANAYİ, İMALAT & AĞIR ENDÜSTRİ (B2B) (14 - 21)
  // =========================================================================
  MAKINE_IMALATI_OTOMASYON: {
    id: 'MAKINE_IMALATI_OTOMASYON',
    number: 14,
    parentCategory: 'HEAVY_INDUSTRY_MANUFACTURING',
    name: 'Makine İmalatı & Endüstriyel Otomasyon (CNC, Robotik)',
    keywords: ['makine imalatı', 'cnc', 'endüstriyel otomasyon', 'robotik kaynak', 'torna', 'lazer kesim', 'plc yazılım', 'fason işleme'],
    designTokens: {
      palette: {
        primary: '#eab308', // Industrial yellow/gold
        secondary: '#0f172a',
        accent: '#ef4444',
        bg: '#0b0f19', // Heavy slate
        surface: '#111827',
        text: '#f8fafc',
        border: '#1f293d'
      },
      borderRadius: '4px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'technical_industrial_data'
    },
    requiredSections: ['hero_industrial', 'tech_specs_table', 'working_videos_carousel', 'spare_parts_inquiry', 'factory_fleet_list', 'lead_form'],
    interactiveTool: {
      type: 'cnc_cycle_time_estimator',
      title: 'CNC İşleme Süresi & Parça Üretim Maliyet Simülatörü',
      subtitle: 'İşlenecek metal türü, tolerans ve parça adedini girin; tahmini tezgah çevrim süresi ve birim maliyeti görün.'
    },
    ctaBehavior: {
      primaryText: 'Teknik Çizim / Step Dosyası Yükle',
      secondaryText: 'Makine Parkuru Kataloğu',
      badge: '⚙️ ±0.005mm Mikron Hassasiyetli Talaşlı İmalat',
      phoneText: 'Fabrika Satış & Destek Hattı'
    }
  },

  PLASTIK_ENJEKSIYON_AMBALAJ: {
    id: 'PLASTIK_ENJEKSIYON_AMBALAJ',
    number: 15,
    parentCategory: 'HEAVY_INDUSTRY_MANUFACTURING',
    name: 'Plastik, Enjeksiyon, Kauçuk & Ambalaj Sanayi',
    keywords: ['plastik enjeksiyon', 'kauçuk', 'ambalaj sanayi', 'şişirme kalıp', 'polimer', 'fason plastik', 'pet ambalaj'],
    designTokens: {
      palette: {
        primary: '#2563eb', // Industrial blue
        secondary: '#1e293b',
        accent: '#10b981',
        bg: '#f8fafc',
        surface: '#ffffff',
        text: '#0f172a',
        border: '#e2e8f0'
      },
      borderRadius: '6px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'technical_industrial_data'
    },
    requiredSections: ['hero_industrial', 'grammage_dimension_table', 'raw_material_certifications', 'contract_manufacturing_form', 'lead_form'],
    interactiveTool: {
      type: 'plastic_mold_tonnage_calculator',
      title: 'Kalıp Göz Sayısı & Enjeksiyon Tonaj Hesaplayıcı',
      subtitle: 'Parça gramajı ve hammadde türünü (PP, PE, ABS) seçerek gereken pres tonajı ve aylık kapasiteyi belirleyin.'
    },
    ctaBehavior: {
      primaryText: 'Fason Üretim Teklifi Al',
      secondaryText: 'Gıda Uyum Sertifikalarını İndir',
      badge: '🛡️ ISO 9001 & BRCGS Ambalaj Güvencesi',
      phoneText: 'Üretim Planlama Hattı'
    }
  },

  DEMIR_CELIK_DOKUM: {
    id: 'DEMIR_CELIK_DOKUM',
    number: 16,
    parentCategory: 'HEAVY_INDUSTRY_MANUFACTURING',
    name: 'Demir-Çelik, Döküm & Talaşlı İmalat',
    keywords: ['demir çelik', 'dökümhane', 'talaşlı imalat', 'pik döküm', 'sfero döküm', 'çelik boru', 'profil sac', 'metalurji'],
    designTokens: {
      palette: {
        primary: '#dc2626', // Steel red / heat
        secondary: '#18181b',
        accent: '#f97316',
        bg: '#09090b',
        surface: '#18181b',
        text: '#fafafa',
        border: '#27272a'
      },
      borderRadius: '2px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'technical_industrial_data'
    },
    requiredSections: ['hero_industrial', 'tolerance_values_grid', 'monthly_tonnage_capacity', 'spectro_analysis_lab', 'lead_form'],
    interactiveTool: {
      type: 'steel_weight_tolerance_calculator',
      title: 'Çelik Profil & Sac Ağırlık / Tolerans Hesaplayıcı',
      subtitle: 'Et kalınlığı, çap ve boy ölçülerini girerek toplam tonaj ve mekanik çekme dayanımını hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'Tonajlı Alım Teklifi İste',
      secondaryText: 'Spektral Analiz Raporunu İncele',
      badge: '🔥 Aylık 2.500 Ton Yüksek Kalite Sfero & Pik Döküm',
      phoneText: 'Metalurji Satış Masası'
    }
  },

  KIMYA_BOYA_MADENI_YAG: {
    id: 'KIMYA_BOYA_MADENI_YAG',
    number: 17,
    parentCategory: 'HEAVY_INDUSTRY_MANUFACTURING',
    name: 'Kimya, Boya, Madeni Yağ & Endüstriyel Yapıştırıcılar',
    keywords: ['kimya sanayi', 'madeni yağ', 'endüstriyel boya', 'epoksi astar', 'yapıştırıcı kimyasal', 'solvent', 'msds'],
    designTokens: {
      palette: {
        primary: '#7c3aed', // Chemical purple
        secondary: '#1e1b4b',
        accent: '#06b6d4',
        bg: '#0b0f19',
        surface: '#111827',
        text: '#f8fafc',
        border: '#1f293d'
      },
      borderRadius: '4px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'technical_industrial_data'
    },
    requiredSections: ['hero_industrial', 'msds_tds_download_center', 'chemical_compatibility_matrix', 'bulk_ordering_section', 'lead_form'],
    interactiveTool: {
      type: 'lubricant_viscosity_selector',
      title: 'Madeni Yağ Viskozite & Kimyasal Uyumluluk Seçici',
      subtitle: 'Çalışma sıcaklığı ve makine devrine göre önerilen ISO VG / SAE viskozite sınıfını belirleyin.'
    },
    ctaBehavior: {
      primaryText: 'MSDS & Teknik Form İndir',
      secondaryText: 'Endüstriyel Deneme Numunesi İste',
      badge: '🧪 REACH & RoHS Uyumlu Yüksek Performanslı Formülasyonlar',
      phoneText: 'Teknik Destek Laboratuvarı'
    }
  },

  TEKSTIL_KUMAS_KONFEKSIYON: {
    id: 'TEKSTIL_KUMAS_KONFEKSIYON',
    number: 18,
    parentCategory: 'HEAVY_INDUSTRY_MANUFACTURING',
    name: 'Tekstil, Kumaş & Fason Konfeksiyon Üreticileri',
    keywords: ['tekstil fabrikası', 'kumaş üretimi', 'örme kumaş', 'fason konfeksiyon', 'iplik', 'denim', 'oeko tex', 'fason dikim'],
    designTokens: {
      palette: {
        primary: '#be185d', // Textile rose / yarn
        secondary: '#1e293b',
        accent: '#f59e0b',
        bg: '#fff1f2',
        surface: '#ffffff',
        text: '#0f172a',
        border: '#fecdd3'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'technical_industrial_data'
    },
    requiredSections: ['hero_industrial', 'fabric_types_catalog', 'moq_minimum_order_table', 'sustainability_certs', 'lead_form'],
    interactiveTool: {
      type: 'fabric_gsm_order_calculator',
      title: 'Kumaş Gramajı (GSM) & Metraj Minimum Sipariş (MOQ) Hesaplayıcı',
      subtitle: 'Kumaş kompozisyonu (Pamuk, Viskon, Polyester) ve en ölçüsünü seçerek tahmini üretim takvimini görün.'
    },
    ctaBehavior: {
      primaryText: 'Kumaş Kartelası & Numune İste',
      secondaryText: 'Fason Üretim Fiyatı Al',
      badge: '🧵 OEKO-TEX Standard 100 & GOTS Organik Pamuk',
      phoneText: 'İhracat & Pazarlama Hattı'
    }
  },

  SAVUNMA_SANAYI_HAVACILIK: {
    id: 'SAVUNMA_SANAYI_HAVACILIK',
    number: 19,
    parentCategory: 'HEAVY_INDUSTRY_MANUFACTURING',
    name: 'Savunma Sanayi & Havacılık Tedarikçileri',
    keywords: ['savunma sanayi', 'havacılık', 'as9100', 'nato gizlilik', 'millileştirme', 'aviyonik', 'talaşlı savunma', 'mil-std'],
    designTokens: {
      palette: {
        primary: '#0369a1', // Military navy
        secondary: '#082f49',
        accent: '#10b981',
        bg: '#030712',
        surface: '#0f172a',
        text: '#f8fafc',
        border: '#1e293b'
      },
      borderRadius: '2px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'JetBrains Mono'
      },
      styleTheme: 'technical_industrial_data'
    },
    requiredSections: ['hero_industrial', 'compliance_certs_security', 'nationalization_projects_showcase', 'clean_room_capabilities', 'lead_form'],
    interactiveTool: {
      type: 'defense_subcontractor_qualification',
      title: 'Tedarikçi Yetkinlik & Askeri Standart (MIL-STD) Uyumluluk Kılavuzu',
      subtitle: 'Talaşlı imalat, ısıl işlem ve NDT tahribatsız muayene akreditasyonlarımızı inceleyin.'
    },
    ctaBehavior: {
      primaryText: 'Gizlilik Sözleşmesi (NDA) ile Proje İlet',
      secondaryText: 'AS9100 Rev D Sertifikasını İncele',
      badge: '🛡️ Tesis Güvenlik Belgeli Millileştirme Çözüm Ortağı',
      phoneText: 'Savunma Projeleri Koordinatörlüğü'
    }
  },

  ELEKTRIK_PANO_TRAFO_JENERATOR: {
    id: 'ELEKTRIK_PANO_TRAFO_JENERATOR',
    number: 20,
    parentCategory: 'HEAVY_INDUSTRY_MANUFACTURING',
    name: 'Elektrik Pano, Trafo & Jeneratör Sistemleri',
    keywords: ['elektrik pano', 'trafo', 'jeneratör', 'kompanzasyon', 'ag pano', 'og trafo', 'dizel jeneratör', 'kesintisiz güç'],
    designTokens: {
      palette: {
        primary: '#d97706', // High voltage amber
        secondary: '#1e293b',
        accent: '#ef4444',
        bg: '#0f172a',
        surface: '#1e293b',
        text: '#f8fafc',
        border: '#334155'
      },
      borderRadius: '4px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'JetBrains Mono'
      },
      styleTheme: 'technical_industrial_data'
    },
    requiredSections: ['hero_industrial', 'generator_kva_calculator', 'service_network_map', 'emergency_generator_rental', 'lead_form'],
    interactiveTool: {
      type: 'kva_power_load_calculator',
      title: 'Tesis Güç (kVA) & Jeneratör / Trafo Kapasite Hesaplama Sihirbazı',
      subtitle: 'Motor gücü, aydınlatma ve anlık demeraj katsayısını girerek gereken jeneratör kVA değerini anında bulun.'
    },
    ctaBehavior: {
      primaryText: 'Acil Jeneratör Kiralama / Satın Alma',
      secondaryText: 'Pano Projesi Fiyatlandır',
      badge: '⚡ IEC 61439-1/2 Tip Testli Alçak Gerilim Panoları',
      phoneText: '7/24 Kesintisiz Enerji Servis Hattı'
    }
  },

  HVAC_SOGUTMA_HAVALANDIRMA: {
    id: 'HVAC_SOGUTMA_HAVALANDIRMA',
    number: 21,
    parentCategory: 'HEAVY_INDUSTRY_MANUFACTURING',
    name: 'HVAC, Endüstriyel Soğutma & Havalandırma',
    keywords: ['hvac', 'endüstriyel soğutma', 'havalandırma santrali', 'chiller', 'klima santrali', 'vrf klima', 'soğuk hava deposu motoru'],
    designTokens: {
      palette: {
        primary: '#0284c7', // Cool cyan/blue
        secondary: '#075985',
        accent: '#38bdf8',
        bg: '#f0f9ff',
        surface: '#ffffff',
        text: '#0c4a6e',
        border: '#bae6fd'
      },
      borderRadius: '6px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'technical_industrial_data'
    },
    requiredSections: ['hero_industrial', 'airflow_cop_efficiency_calc', 'project_references_portfolio', 'maintenance_contract_plans', 'lead_form'],
    interactiveTool: {
      type: 'hvac_airflow_cooling_calculator',
      title: 'Hava Debisi (m³/h) & Soğutma Kapasitesi (kW/BTU) Hesaplayıcı',
      subtitle: 'Fabrika, AVM veya hastane hacmini girerek gereken taze hava ve chiller soğutma kapasitesini hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'HVAC Mühendislik Keşfi Talep Et',
      secondaryText: 'Referans Projelerimizi İncele',
      badge: '❄️ Eurovent & ErP 2021 Yüksek Enerji Verimliliği',
      phoneText: 'İklimlendirme Mühendisliği Hattı'
    }
  },

  // =========================================================================
  // 4. TARIM, GIDA, HAYVANCILIK & İÇECEK (22 - 27 + PetShop)
  // =========================================================================
  ENDUSTRIYEL_GIDA_IMALATCILARI: {
    id: 'ENDUSTRIYEL_GIDA_IMALATCILARI',
    number: 22,
    parentCategory: 'AGRICULTURE_FOOD',
    name: 'Endüstriyel Gıda İmalatçıları (Süt, Un, Yağ, Et Entegre)',
    keywords: ['gıda fabrikası', 'süt fabrikası', 'un fabrikası', 'zeytinyağı fabrikası', 'et entegre', 'helal gıda', 'brc sertifikalı'],
    designTokens: {
      palette: {
        primary: '#b45309', // Warm golden grain
        secondary: '#1c1917',
        accent: '#15803d',
        bg: '#fefce8',
        surface: '#ffffff',
        text: '#451a03',
        border: '#fef08a'
      },
      borderRadius: '12px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'warm_artisan_organic'
    },
    requiredSections: ['hero_food', 'halal_brc_ifs_certs', 'nutrition_facts_table', 'wholesale_b2b_order', 'lead_form'],
    interactiveTool: {
      type: 'food_wholesale_freight_estimator',
      title: 'Toptan Gıda Sipariş & Palet/Konteyner Yük Hesaplayıcı',
      subtitle: 'Palet adetlerinizi seçin; soğuk zincir lojistik kapasitesi ve teslimat takvimini anlık çıkarın.'
    },
    ctaBehavior: {
      primaryText: 'Toptan & İhracat Fiyat Teklifi Al',
      secondaryText: 'Gıda Analiz & Kalite Raporu',
      badge: '🌾 Helal, BRCGS & IFS Food Sertifikalı Hijyenik Tesis',
      phoneText: 'Kurumsal Satış & İhracat Masası'
    }
  },

  PETSHOP_EVCIL_HAYVAN: {
    id: 'PETSHOP_EVCIL_HAYVAN',
    number: 28,
    parentCategory: 'AGRICULTURE_FOOD',
    name: 'PetShop & Evcil Hayvan Beslenmesi',
    keywords: ['petshop', 'kedi maması', 'köpek maması', 'mama sipariş', 'kedi kumu', 'evcil hayvan beslenmesi', 'pet kuaför'],
    designTokens: {
      palette: {
        primary: '#059669', // Pet emerald
        secondary: '#064e3b',
        accent: '#f59e0b',
        bg: '#f0fdf4',
        surface: '#ffffff',
        text: '#064e3b',
        border: '#bbf7d0'
      },
      borderRadius: '16px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'warm_artisan_organic'
    },
    requiredSections: ['hero_petshop', 'brand_carousel', 'portion_calculator', 'same_day_courier_box', 'catalog_grid', 'lead_form'],
    interactiveTool: {
      type: 'pet_daily_portion_calculator',
      title: 'Evcil Hayvan Günlük Mama & Besin İhtiyacı Hesaplayıcı',
      subtitle: 'Kedinizin veya köpeğinizin yaş, ırk ve kısırlaştırma durumunu seçin; önerilen günlük porsiyon ve mama tipini anında öğrenin.'
    },
    ctaBehavior: {
      primaryText: 'Kurye ile Aynı Gün Sipariş Ver',
      secondaryText: 'Mama Kataloğunu Keşfet',
      badge: '🐾 Orijinal Marka Garantili Mama & Vitamin Dünyası',
      phoneText: 'Hızlı Sipariş & WhatsApp Hattı'
    }
  },

  TARIM_MAKINELERI_TRAKTOR: {
    id: 'TARIM_MAKINELERI_TRAKTOR',
    number: 23,
    parentCategory: 'AGRICULTURE_FOOD',
    name: 'Tarım Makineleri, Traktör & Ekipmanları',
    keywords: ['tarım makineleri', 'traktör', 'pulluk', 'biçerdöver', 'mibzer', 'zirai ekipman', 'tarımsal sulama'],
    designTokens: {
      palette: {
        primary: '#15803d', // Tractor green
        secondary: '#1e293b',
        accent: '#eab308',
        bg: '#f0fdf4',
        surface: '#ffffff',
        text: '#14532d',
        border: '#bbf7d0'
      },
      borderRadius: '6px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'warm_artisan_organic'
    },
    requiredSections: ['hero_farming', 'horsepower_filter_catalog', 'agricultural_grant_advisor', 'dealer_network_map', 'lead_form'],
    interactiveTool: {
      type: 'tractor_grant_eligibility_checker',
      title: 'Tarımsal Hibe (TKDK/KKYDP) & Traktör Kredisi Uygunluk Danışmanı',
      subtitle: 'Arazi büyüklüğünüz ve yatırım planınıza göre devlet teşvik ve faiz indirimli kredi imkanlarını öğrenin.'
    },
    ctaBehavior: {
      primaryText: 'Ekipman Fiyat Teklifi Al',
      secondaryText: 'Tarımsal Hibe Danışmanlığı İste',
      badge: '🚜 Dayanıklı Şasi & Minimum Yakıt Tüketimli Tarım Teknolojisi',
      phoneText: 'Bölge Bayi Satış Masası'
    }
  },

  TOHUM_GUBRE_ZIRAI_ILAC: {
    id: 'TOHUM_GUBRE_ZIRAI_ILAC',
    number: 24,
    parentCategory: 'AGRICULTURE_FOOD',
    name: 'Tohum, Gübre, Zirai İlaç & Fide Üretimi',
    keywords: ['tohumculuk', 'gübre', 'zirai ilaç', 'organik gübre', 'fide üretimi', 'hibrit tohum', 'bitki besleme'],
    designTokens: {
      palette: {
        primary: '#65a30d', // Sprout lime
        secondary: '#365314',
        accent: '#d97706',
        bg: '#f7fee7',
        surface: '#ffffff',
        text: '#1a2e05',
        border: '#d9f99d'
      },
      borderRadius: '12px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'warm_artisan_organic'
    },
    requiredSections: ['hero_farming', 'planting_calendar_guide', 'regional_seed_selector', 'agronomist_support_line', 'lead_form'],
    interactiveTool: {
      type: 'crop_planting_calendar_tool',
      title: 'Bölgeye Göre Ekim/Hasat Takvimi & Tohum Çeşidi Seçici',
      subtitle: 'Bulunduğunuz ili ve toprak tipinizi seçin; en yüksek verim alabileceğiniz tohum ve gübreleme programını görün.'
    },
    ctaBehavior: {
      primaryText: 'Ziraat Mühendisiyle Konuş',
      secondaryText: 'Tohum & Fide Kataloğu İndir',
      badge: '🌱 Yüksek Çimlenme Oranlı Sertifikalı Tohum & Organik Gübre',
      phoneText: 'Ziraat Destek Masası'
    }
  },

  SERACILIK_TOPRAKSIZ_TARIM: {
    id: 'SERACILIK_TOPRAKSIZ_TARIM',
    number: 25,
    parentCategory: 'AGRICULTURE_FOOD',
    name: 'Seracılık & Topraksız/Akıllı Tarım Teknolojileri',
    keywords: ['seracılık', 'topraksız tarım', 'akıllı sera', 'hidroponik', 'jeotermal sera', 'sera otomasyonu'],
    designTokens: {
      palette: {
        primary: '#059669', // Greenhouse emerald
        secondary: '#064e3b',
        accent: '#0284c7',
        bg: '#f0fdf4',
        surface: '#ffffff',
        text: '#064e3b',
        border: '#a7f3d0'
      },
      borderRadius: '10px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'warm_artisan_organic'
    },
    requiredSections: ['hero_farming', 'greenhouse_automation_showcase', 'turnkey_cost_calculator', 'crop_yield_metrics', 'lead_form'],
    interactiveTool: {
      type: 'greenhouse_roi_cost_calculator',
      title: 'Anahtar Teslim Sera Kurulum Maliyeti & Amortisman Hesaplayıcı',
      subtitle: 'Dönüm alanı ve yetiştirilecek ürünü (Domates, Çilek, Biber) girerek kurulum bütçesi ve yıllık rekolteyi hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'Anahtar Teslim Sera Teklifi Al',
      secondaryText: 'Otomasyon Şemasını İncele',
      badge: '💡 %90 Su Tasarruflu İklim Kontrollü Akıllı Seracılık',
      phoneText: 'Sera Proje Koordinatörü'
    }
  },

  SU_ICECEK_SISALEME: {
    id: 'SU_ICECEK_SISALEME',
    number: 26,
    parentCategory: 'AGRICULTURE_FOOD',
    name: 'Su, İçecek Şişeleme & Kaynak Suyu Tesisleri',
    keywords: ['kaynak suyu', 'su şişeleme', 'doğal kaynak', 'maden suyu', 'damacana su bayilik', 'içecek fabrikası'],
    designTokens: {
      palette: {
        primary: '#0284c7', // Pure water blue
        secondary: '#0c4a6e',
        accent: '#38bdf8',
        bg: '#f0f9ff',
        surface: '#ffffff',
        text: '#082f49',
        border: '#bae6fd'
      },
      borderRadius: '12px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'warm_artisan_organic'
    },
    requiredSections: ['hero_food', 'water_analysis_lab_values', 'distribution_dealership_form', 'pet_glass_packaging_options', 'lead_form'],
    interactiveTool: {
      type: 'water_analysis_ph_comparator',
      title: 'Doğal Kaynak Suyu Mineral & pH Değeri Karşılaştırma Tablosu',
      subtitle: 'Kaynak suyumuzun pH 8.2 alkali dengesi ve zengin kalsiyum-magnezyum tahlil raporlarını inceleyin.'
    },
    ctaBehavior: {
      primaryText: 'Bölge Damacana/Pet Bayilik Başvurusu',
      secondaryText: 'Resmi Sağlık Analiz Raporu',
      badge: '💧 Toroslardan El Değmeden Şişelenen Doğal Kaynak Suyu',
      phoneText: 'Bayilik & Dağıtım Hattı'
    }
  },

  TOPTAN_YAS_MEYVE_SEBZE: {
    id: 'TOPTAN_YAS_MEYVE_SEBZE',
    number: 27,
    parentCategory: 'AGRICULTURE_FOOD',
    name: 'Toptan Yaş Meyve/Sebze İhracatçıları',
    keywords: ['yaş meyve sebze', 'narenciye ihracat', 'toptan meyve', 'soğuk hava lojistik', 'globalgap sertifikalı'],
    designTokens: {
      palette: {
        primary: '#ea580c', // Fresh citrus orange
        secondary: '#1c1917',
        accent: '#16a34a',
        bg: '#fff7ed',
        surface: '#ffffff',
        text: '#431407',
        border: '#fed7aa'
      },
      borderRadius: '10px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'warm_artisan_organic'
    },
    requiredSections: ['hero_food', 'seasonal_crop_calendar', 'cold_chain_export_fleet', 'globalgap_iso_certs', 'lead_form'],
    interactiveTool: {
      type: 'seasonal_export_readiness_checker',
      title: 'Sezonluk Ürün Takvimi & Soğuk Hava Konteyner Talep Motoru',
      subtitle: 'Mevsime göre hasadı süren narenciye, nar ve domates çeşitlerinin ihracat hazır stoklarını inceleyin.'
    },
    ctaBehavior: {
      primaryText: 'Küresel İhracat & Toptan Teklif Al',
      secondaryText: 'Sezonluk Hasat Takvimini İndir',
      badge: '🍊 GlobalGAP Sertifikalı Avrupa ve Körfez Standartlarında İhracat',
      phoneText: 'İhracat Operasyon Masası'
    }
  },

  // =========================================================================
  // 5. HUKUK, FİNANS, DENETİM & DANIŞMANLIK (29 - 35)
  // =========================================================================
  HUKUK_BUROLARI_AVUKATLIK: {
    id: 'HUKUK_BUROLARI_AVUKATLIK',
    number: 29,
    parentCategory: 'LAW_FINANCE_CONSULTING',
    name: 'Hukuk Büroları & Avukatlık Ortaklıkları',
    keywords: ['hukuk bürosu', 'avukat', 'ticaret hukuku', 'ceza hukuku', 'iş hukuku', 'arabuluculuk', 'dava danışmanlık', 'lawyer'],
    designTokens: {
      palette: {
        primary: '#1e3a8a', // Dark navy
        secondary: '#0f172a',
        accent: '#b45309', // Gold foil
        bg: '#f8fafc',
        surface: '#ffffff',
        text: '#0f172a',
        border: '#cbd5e1'
      },
      borderRadius: '4px',
      typography: {
        heading: 'Playfair Display',
        body: 'Source Sans Pro'
      },
      styleTheme: 'authoritative_classic'
    },
    requiredSections: ['hero_legal', 'practice_areas_accordion', 'legal_articles_bulletin', 'lawyer_bar_cards', 'lead_form'],
    interactiveTool: {
      type: 'legal_consultation_scheduler',
      title: 'Dava & Arabuluculuk Ön Değerlendirme ve Danışmanlık Talebi',
      subtitle: 'Uyuşmazlık türünüzü seçin; uzman avukat kadromuzla gizlilik esasına dayalı ön görüşme planlayın.'
    },
    ctaBehavior: {
      primaryText: 'Hukuki Danışmanlık Randevusu Al',
      secondaryText: 'Emsal Karar ve Makalelerimizi Oku',
      badge: '🏛️ Baro Sicilli Uzman Arabulucu & Avukat Kadrosu',
      phoneText: 'Hukuk Bürosu Santrali'
    }
  },

  MALI_MUSAVIRLIK_YMM_DENETIM: {
    id: 'MALI_MUSAVIRLIK_YMM_DENETIM',
    number: 30,
    parentCategory: 'LAW_FINANCE_CONSULTING',
    name: 'Mali Müşavirlik, YMM & Bağımsız Denetim',
    keywords: ['mali müşavir', 'smmm', 'ymm', 'bağımsız denetim', 'vergi danışmanlığı', 'şirket kuruluşu', 'bordrolama', 'kdv iadesi'],
    designTokens: {
      palette: {
        primary: '#0f766e', // Deep teal / financial
        secondary: '#134e4a',
        accent: '#b45309',
        bg: '#f0fdfa',
        surface: '#ffffff',
        text: '#134e4a',
        border: '#ccfbf1'
      },
      borderRadius: '6px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'authoritative_classic'
    },
    requiredSections: ['hero_finance', 'tax_calendar_ticker', 'legislation_newsletter', 'severance_tax_calculator', 'lead_form'],
    interactiveTool: {
      type: 'severance_corporate_tax_calculator',
      title: 'Kıdem Tazminatı, Gelir Vergisi & KDV İade Hesaplama Aracı',
      subtitle: 'Brüt maaş ve hizmet süresini girerek güncel yasal mevzuata göre kıdem tazminatı tavanını anında hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'Şirket Kuruluş & Vergi Teklifi Al',
      secondaryText: 'Aylık Vergi Takvimini İndir',
      badge: '📊 TÜRMOB & KGK Akreditasyonlu Denetim Güvencesi',
      phoneText: 'Müşavirlik & Denetim Hattı'
    }
  },

  SIGORTA_ACENTELERI_BROKER: {
    id: 'SIGORTA_ACENTELERI_BROKER',
    number: 31,
    parentCategory: 'LAW_FINANCE_CONSULTING',
    name: 'Sigorta Acenteleri & Brokerlar',
    keywords: ['sigorta acentesi', 'kasko teklif', 'trafik sigortası', 'dask', 'tamamlayıcı sağlık sigortası', 'özel sağlık', 'nakliyat sigortası'],
    designTokens: {
      palette: {
        primary: '#2563eb', // Trust blue
        secondary: '#1e3a8a',
        accent: '#10b981',
        bg: '#eff6ff',
        surface: '#ffffff',
        text: '#1e3a8a',
        border: '#bfdbfe'
      },
      borderRadius: '10px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'authoritative_classic'
    },
    requiredSections: ['hero_insurance', 'quick_policy_engine', 'claim_guide_steps', 'partner_insurance_brands', 'lead_form'],
    interactiveTool: {
      type: 'insurance_instant_quote_engine',
      title: 'Kasko, DASK & Sağlık Sigortası Karşılaştırmalı Teklif Motoru',
      subtitle: 'Araç plakanızı veya T.C. kimlik no girerek 20+ sigorta şirketinden en uygun poliçe teklifini 2 dakikada görün.'
    },
    ctaBehavior: {
      primaryText: 'Anında En Uygun Sigorta Teklifini Gör',
      secondaryText: 'WhatsApp ile Hasar Bildir',
      badge: '🛡️ 25+ Anlaşmalı Sigorta Şirketinden En İyi Fiyat Garantisi',
      phoneText: 'Sigorta Destek Hattı'
    }
  },

  GUMRUK_MUSAVIRLIGI_DIS_TICARET: {
    id: 'GUMRUK_MUSAVIRLIGI_DIS_TICARET',
    number: 32,
    parentCategory: 'LAW_FINANCE_CONSULTING',
    name: 'Gümrük Müşavirliği & Dış Ticaret Danışmanlığı',
    keywords: ['gümrük müşavirliği', 'gtip kodu', 'ithalat gümrükleme', 'ihracat beyanname', 'serbest bölge', 'antrepo gümrük'],
    designTokens: {
      palette: {
        primary: '#0369a1', // International blue
        secondary: '#075985',
        accent: '#f59e0b',
        bg: '#f8fafc',
        surface: '#ffffff',
        text: '#0f172a',
        border: '#cbd5e1'
      },
      borderRadius: '4px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'authoritative_classic'
    },
    requiredSections: ['hero_customs', 'gtip_code_search_box', 'customs_workflow_steps', 'free_trade_zone_services', 'lead_form'],
    interactiveTool: {
      type: 'gtip_tariff_duty_estimator',
      title: 'GTİP Kodu & İthalat Vergi / Gümrük Masrafı Tahmin Aracı',
      subtitle: 'Ürün kategorisi ve menşe ülkeyi girerek tahmini gümrük vergisi, ÖTV ve KDV oranlarını listeleyin.'
    },
    ctaBehavior: {
      primaryText: 'Gümrükleme Teklifi Talep Et',
      secondaryText: 'Mevzuat Değişiklik Bültenini Oku',
      badge: '🌐 A Sınıfı Yetkilendirilmiş Yükümlü Statüsü (YYS) Güvencesi',
      phoneText: 'Gümrük Operasyon Merkezi'
    }
  },

  INSAN_KAYNAKLARI_BORDROLAMA: {
    id: 'INSAN_KAYNAKLARI_BORDROLAMA',
    number: 33,
    parentCategory: 'LAW_FINANCE_CONSULTING',
    name: 'İnsan Kaynakları, Bordrolama & Headhunter',
    keywords: ['insan kaynakları', 'headhunter', 'bordrolama', 'personel seçme', 'işe alım ajansı', 'özgeçmiş havuzu', 'cv bırak'],
    designTokens: {
      palette: {
        primary: '#4f46e5', // Modern indigo
        secondary: '#312e81',
        accent: '#06b6d4',
        bg: '#f5f3ff',
        surface: '#ffffff',
        text: '#1e1b4b',
        border: '#ddd6fe'
      },
      borderRadius: '12px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'authoritative_classic'
    },
    requiredSections: ['hero_hr', 'dual_candidate_employer_form', 'open_executive_positions', 'payroll_compliance_features', 'lead_form'],
    interactiveTool: {
      type: 'employer_payroll_cost_calculator',
      title: 'İşveren Toplam Personel Maliyeti & SGK Teşvik Hesaplayıcı',
      subtitle: 'Net maaş girerek işverene toplam maliyeti ve uygulanabilecek 5510 / 6111 SGK istihdam teşviklerini görün.'
    },
    ctaBehavior: {
      primaryText: 'İşveren: Pozisyon / Aday Talebi Bırak',
      secondaryText: 'Aday: CV Yükle & Havuza Katıl',
      badge: '💼 Üst Düzey Yönetici ve Teknik Yetenek Avcılığı',
      phoneText: 'İK Danışmanlık Hattı'
    }
  },

  PATENT_MARKA_TESCIL: {
    id: 'PATENT_MARKA_TESCIL',
    number: 34,
    parentCategory: 'LAW_FINANCE_CONSULTING',
    name: 'Patent, Marka Tescil & Fikri Mülkiyet',
    keywords: ['marka tescil', 'patent başvurusu', 'faydalı model', 'türkpatent', 'tasarım tescili', 'marka sorgulama'],
    designTokens: {
      palette: {
        primary: '#0891b2', // Cyan / Protection
        secondary: '#164e63',
        accent: '#f59e0b',
        bg: '#ecfeff',
        surface: '#ffffff',
        text: '#164e63',
        border: '#a5f3fc'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'authoritative_classic'
    },
    requiredSections: ['hero_patent', 'free_trademark_search_form', 'registration_timeline_flow', 'bulletin_objection_guide', 'lead_form'],
    interactiveTool: {
      type: 'trademark_availability_search_tool',
      title: 'Ücretsiz Marka İsim Müsaitlik & Sınıf Sorgulama Formu',
      subtitle: 'Tescil ettirmek istediğiniz marka adını yazın; TürkPatent veritabanında benzerlik ve itiraz riskini anında inceleyelim.'
    },
    ctaBehavior: {
      primaryText: 'Ücretsiz Marka Tescil Sorgulaması Yap',
      secondaryText: 'Patent & Tasarım Başvurusu İlet',
      badge: '®️ TürkPatent ve WIPO Resmi Vekillik Güvencesi',
      phoneText: 'Marka Vekili Doğrudan Hattı'
    }
  },

  YONETIM_DANISMANLIGI_MA: {
    id: 'YONETIM_DANISMANLIGI_MA',
    number: 35,
    parentCategory: 'LAW_FINANCE_CONSULTING',
    name: 'Yönetim Danışmanlığı, M&A & Kurumsal Finansman',
    keywords: ['yönetim danışmanlığı', 'm&a', 'şirket evliliği', 'şirket değerleme', 'due diligence', 'kurumsal finansman', 'strateji danışmanlık'],
    designTokens: {
      palette: {
        primary: '#334155', // Executive slate
        secondary: '#0f172a',
        accent: '#b45309', // Gold
        bg: '#ffffff',
        surface: '#f8fafc',
        text: '#0f172a',
        border: '#e2e8f0'
      },
      borderRadius: '4px',
      typography: {
        heading: 'Cinzel',
        body: 'Inter'
      },
      styleTheme: 'authoritative_classic'
    },
    requiredSections: ['hero_advisory', 'completed_tombstones_showcase', 'valuation_methodologies', 'strategic_roadmap_phases', 'lead_form'],
    interactiveTool: {
      type: 'company_valuation_multiple_calculator',
      title: 'Şirket Değerleme & FAVÖK (EBITDA) Çarpanı Tahmin Modülü',
      subtitle: 'Sektörünüz ve yıllık cironuzu belirleyin; piyasa birleşme ve satın alma işlem çarpanlarını inceleyin.'
    },
    ctaBehavior: {
      primaryText: 'M&A Danışmanlık Görüşmesi Planla',
      secondaryText: 'Kurumsal Vaka Analizlerini Oku',
      badge: '📈 500M+ TL Başarıyla Kapanan Şirket Devir & Birleşme Hacmi',
      phoneText: 'Stratejik Yönetim Ofisi'
    }
  },

  // =========================================================================
  // 6. TEKNOLOJİ, YAZILIM, BİLİŞİM & TELEKOMÜNİKASYON (36 - 41)
  // =========================================================================
  SAAS_BULUT_YAZILIM: {
    id: 'SAAS_BULUT_YAZILIM',
    number: 36,
    parentCategory: 'TECH_SOFTWARE',
    name: 'SaaS & B2B Bulut Yazılımları',
    keywords: ['saas', 'bulut yazılım', 'b2b yazılım', 'crm', 'erp', 'abonelik yazılım', 'api entegrasyon', 'cloud software'],
    designTokens: {
      palette: {
        primary: '#6366f1', // Electric Indigo
        secondary: '#1e1b4b',
        accent: '#a855f7',
        bg: '#07090e', // Deep Obsidian Void
        surface: '#0d111a',
        text: '#f8fafc',
        border: 'rgba(255, 255, 255, 0.10)'
      },
      borderRadius: '12px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'dark_bento_cyber'
    },
    requiredSections: ['hero_saas', 'bento_features_grid', 'pricing_toggle_plans', 'interactive_demo_video', 'api_docs_teaser', 'lead_form'],
    interactiveTool: {
      type: 'saas_roi_time_saved_calculator',
      title: 'Ekip Büyüklüğü & SaaS Zaman Tasarrufu / ROI Hesaplayıcı',
      subtitle: 'Kullanıcı sayınızı ve manuel harcanan saatleri girin; platformumuzla elde edeceğiniz aylık net tasarrufu görün.'
    },
    ctaBehavior: {
      primaryText: '14 Gün Ücretsiz Dene (Kredi Kartsız)',
      secondaryText: 'Canlı B2B Demosu Talep Et',
      badge: '⚡ Modern Bulut & Mikroservis Mimarisi',
      phoneText: 'Kurumsal Satış & Demo Masası'
    }
  },

  SIBER_GUVENLIK_SOC: {
    id: 'SIBER_GUVENLIK_SOC',
    number: 37,
    parentCategory: 'TECH_SOFTWARE',
    name: 'Siber Güvenlik & SOC Merkezleri',
    keywords: ['siber güvenlik', 'soc merkezi', 'sızma testi', 'pentest', 'kvkk uyum', 'iso 27001', 'ddos koruma', 'siem'],
    designTokens: {
      palette: {
        primary: '#10b981', // Terminal emerald
        secondary: '#064e3b',
        accent: '#ef4444',
        bg: '#030712',
        surface: '#0f172a',
        text: '#f8fafc',
        border: 'rgba(16, 185, 129, 0.25)'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'JetBrains Mono'
      },
      styleTheme: 'dark_bento_cyber'
    },
    requiredSections: ['hero_security', 'live_threat_map_vis', 'pentest_inquiry_form', 'compliance_guides_kvkk', 'lead_form'],
    interactiveTool: {
      type: 'cyber_risk_score_evaluator',
      title: 'Kurumsal Dış Yüzey Güvenlik & Sızma Riski Ön Değerlendirici',
      subtitle: 'Alan adınızı ve sunucu altyapınızı belirleyin; açık port ve zafiyet kontrol kriterlerini inceleyin.'
    },
    ctaBehavior: {
      primaryText: 'Hemen Sızma Testi (Pentest) Talep Et',
      secondaryText: '7/24 SOC Alarm Merkezine Bağlan',
      badge: '🔒 TSE Onaylı A Tipi Sızma Testi & ISO 27001 Başdenetçi Ekip',
      phoneText: '7/24 Siber Olay Müdahale Hattı'
    }
  },

  SISTEM_ENTEGRATOR_DATA_CENTER: {
    id: 'SISTEM_ENTEGRATOR_DATA_CENTER',
    number: 38,
    parentCategory: 'TECH_SOFTWARE',
    name: 'Sistem Entegratörleri & Veri Merkezi / Cloud',
    keywords: ['veri merkezi', 'datacenter', 'sistem entegratörü', 'sunucu kiralama', 'vmware', 'openstack', 'felaket kurtarma'],
    designTokens: {
      palette: {
        primary: '#0ea5e9', // Sky cloud blue
        secondary: '#0369a1',
        accent: '#6366f1',
        bg: '#0b0f19',
        surface: '#111827',
        text: '#f8fafc',
        border: '#1f293d'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'JetBrains Mono'
      },
      styleTheme: 'dark_bento_cyber'
    },
    requiredSections: ['hero_cloud', 'uptime_sla_counters', 'server_specs_configurator', 'tech_partners_logos', 'lead_form'],
    interactiveTool: {
      type: 'cloud_server_resource_configurator',
      title: 'Sanal Sunucu (vCPU / RAM / NVMe) Paket Yapılandırıcı',
      subtitle: 'Çekirdek, bellek ve disk kapasitenizi seçerek Tier III sertifikalı veri merkezimizden anlık sunucu teklifi alın.'
    },
    ctaBehavior: {
      primaryText: 'Bulut Sunucu Yapılandır',
      secondaryText: 'Tier III Veri Merkezi Turu İste',
      badge: '☁️ %99.99 Uptime SLA Garantili Türk Telekom & Vodafone Çoklu Omurga',
      phoneText: 'Veri Merkezi Destek Hattı'
    }
  },

  DONANIM_POS_BARKOD_IOT: {
    id: 'DONANIM_POS_BARKOD_IOT',
    number: 39,
    parentCategory: 'TECH_SOFTWARE',
    name: 'Donanım, POS, Barkod & IoT Sistemleri',
    keywords: ['pos sistemi', 'barkod yazıcı', 'el terminali', 'iot sensör', 'yazar kasa', 'stok sayım cihazı', 'rfid'],
    designTokens: {
      palette: {
        primary: '#f59e0b', // Amber hardware
        secondary: '#78350f',
        accent: '#10b981',
        bg: '#0f172a',
        surface: '#1e293b',
        text: '#f8fafc',
        border: '#334155'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'JetBrains Mono'
      },
      styleTheme: 'dark_bento_cyber'
    },
    requiredSections: ['hero_hardware', 'driver_download_center', 'api_sdk_guide', 'retail_scenarios_grid', 'lead_form'],
    interactiveTool: {
      type: 'hardware_driver_finder',
      title: 'El Terminali, POS & Barkod Cihaz Sürücü / Driver İndirme Merkezi',
      subtitle: 'Cihaz modelinizi seçin; Windows, Android ve Linux uyumlu güncel SDK ve sürücüleri doğrudan indirin.'
    },
    ctaBehavior: {
      primaryText: 'Toplu Donanım & POS Teklifi Al',
      secondaryText: 'Driver & SDK Dokümanı İndir',
      badge: '📟 Endüstriyel IP65 Dayanıklı El Terminalleri & Hızlı Barkod',
      phoneText: 'Teknik Servis & Satış Masası'
    }
  },

  DIJITAL_AJANS_REKLAM_MEDYA: {
    id: 'DIJITAL_AJANS_REKLAM_MEDYA',
    number: 40,
    parentCategory: 'TECH_SOFTWARE',
    name: 'Dijital Ajanslar & Medya/Reklam Ofisleri',
    keywords: ['dijital ajans', 'reklam ajansı', 'seo ajansı', 'sosyal medya yönetimi', 'google ads', 'performans pazarlama', 'kreatif ajans'],
    designTokens: {
      palette: {
        primary: '#ec4899', // Pink / Creative neon
        secondary: '#831843',
        accent: '#8b5cf6',
        bg: '#09090b',
        surface: '#18181b',
        text: '#fafafa',
        border: '#27272a'
      },
      borderRadius: '16px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'dark_bento_cyber'
    },
    requiredSections: ['hero_agency', 'case_studies_roi_metrics', 'creative_portfolio_grid', 'marketing_proposal_wizard', 'lead_form'],
    interactiveTool: {
      type: 'ads_roas_growth_calculator',
      title: 'Reklam Bütçesi & ROAS Ciro Büyüme Simülatörü',
      subtitle: 'Aylık Meta ve Google Ads bütçenizi girin; hedef ROAS ve beklenen dönüşüm cirosunu hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'Ajans Teklifi & Büyüme Brifingi Al',
      secondaryText: 'Başarı Hikayelerimizi İncele',
      badge: '🚀 Google Premier Partner & Meta Sertifikalı Büyüme Ekibi',
      phoneText: 'Kreatif Direktör Masası'
    }
  },

  OYUN_GELISTIRME_STUDYOLARI: {
    id: 'OYUN_GELISTIRME_STUDYOLARI',
    number: 41,
    parentCategory: 'TECH_SOFTWARE',
    name: 'Oyun Geliştirme Stüdyoları (Game Dev)',
    keywords: ['oyun stüdyosu', 'game dev', 'mobil oyun', 'unity', 'unreal engine', 'steam oyunu', 'indie game'],
    designTokens: {
      palette: {
        primary: '#8b5cf6', // Game violet
        secondary: '#4c1d95',
        accent: '#06b6d4',
        bg: '#05050a',
        surface: '#0d0d1a',
        text: '#f8fafc',
        border: 'rgba(139, 92, 246, 0.25)'
      },
      borderRadius: '12px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'dark_bento_cyber'
    },
    requiredSections: ['hero_gamedev', 'trailer_video_hero', 'app_store_steam_badges', 'open_game_careers', 'lead_form'],
    interactiveTool: {
      type: 'game_showcase_modal_player',
      title: 'Oyun Teaser & Steam İstek Listesi (Wishlist) Vitrini',
      subtitle: 'Geliştirdiğimiz son yapımları inceleyin; Steam istek listenize ekleyerek erken erişim fırsatı yakalayın.'
    },
    ctaBehavior: {
      primaryText: 'Steam İstek Listesine Ekle',
      secondaryText: 'Açık Pozisyonlar & Stüdyo Başvurusu',
      badge: '🎮 PC, Konsol & Mobilde Milyonlarca Oyuncuya Ulaşan Başarı',
      phoneText: 'Yayıncı & Stüdyo İletişim'
    }
  },

  // =========================================================================
  // 7. LOJİSTİK, ULAŞIM & OTOMOTİV (42 - 47)
  // =========================================================================
  ULUSLARARASI_NAKLIYE_FORWARDING: {
    id: 'ULUSLARARASI_NAKLIYE_FORWARDING',
    number: 42,
    parentCategory: 'LOGISTICS_AUTOMOTIVE',
    name: 'Uluslararası Nakliye & Freight Forwarding',
    keywords: ['uluslararası nakliye', 'freight forwarding', 'denizyolu konteyner', 'havayolu kargo', 'karayolu tır', 'navlun teklif'],
    designTokens: {
      palette: {
        primary: '#0284c7', // Ocean deep blue
        secondary: '#0369a1',
        accent: '#f97316',
        bg: '#081325',
        surface: '#0f1d36',
        text: '#f0f9ff',
        border: '#1b3156'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'high_velocity_logistics'
    },
    requiredSections: ['hero_logistics', 'tracking_code_search_box', 'freight_quote_calculator', 'incoterms_guide_tabs', 'lead_form'],
    interactiveTool: {
      type: 'freight_calculator_tool',
      title: 'Uluslararası & Yurtiçi Navlun ve Taşıma Simülatörü',
      subtitle: 'Kalkış, varış ve yük tipinizi (Konteyner FCL/LCL, Tır, Uçak) seçerek tahmini transit süresi ve navlun planlamanızı oluşturun.'
    },
    ctaBehavior: {
      primaryText: 'Hemen Navlun Teklifi Al',
      secondaryText: 'Yük Takibi Sorgula',
      badge: '🚢 180+ Ülkeye Düzenli Haftalık Konteyner & Parsiyel Çıkış',
      phoneText: 'Navlun Masası Doğrudan Hattı'
    }
  },

  ANTREPO_SOGUK_HAVA_DAGITIM: {
    id: 'ANTREPO_SOGUK_HAVA_DAGITIM',
    number: 43,
    parentCategory: 'LOGISTICS_AUTOMOTIVE',
    name: 'Antrepo, Soğuk Hava Deposu & Dağıtım',
    keywords: ['antrepo', 'gümrüklü antrepo', 'soğuk hava deposu', 'lojistik depo', 'palet depolama', 'serbest depo'],
    designTokens: {
      palette: {
        primary: '#0369a1',
        secondary: '#075985',
        accent: '#06b6d4',
        bg: '#f8fafc',
        surface: '#ffffff',
        text: '#0f172a',
        border: '#cbd5e1'
      },
      borderRadius: '6px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'high_velocity_logistics'
    },
    requiredSections: ['hero_logistics', 'warehouse_capacity_metrics', 'location_distance_radii', 'customs_bonded_specs', 'lead_form'],
    interactiveTool: {
      type: 'warehouse_pallet_cost_calculator',
      title: 'Palet Kapasitesi & Günlük/Aylık Depolama Maliyet Hesaplayıcı',
      subtitle: 'Depolanacak palet adedi ve sıcaklık rejimini (+4°C, -18°C, Ortam) seçerek depolama maliyetinizi hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'Antrepo / Depo Alanı Kirala',
      secondaryText: 'Depolama Standartlarını İncele',
      badge: '❄️ 25.000 m² Kapalı A Tipi Gümrüklü & Soğuk Hava Antreposu',
      phoneText: 'Depo Operasyon Yönetimi'
    }
  },

  FILO_KIRALAMA_VIP_TRANSFER: {
    id: 'FILO_KIRALAMA_VIP_TRANSFER',
    number: 44,
    parentCategory: 'LOGISTICS_AUTOMOTIVE',
    name: 'Filo Kiralama & VIP Transfer / Rent A Car',
    keywords: ['filo kiralama', 'vip transfer', 'rent a car', 'araç kiralama', 'şoförlü araç', 'havalimanı transfer'],
    designTokens: {
      palette: {
        primary: '#0f172a', // Luxury slate / black
        secondary: '#1e293b',
        accent: '#eab308', // Gold
        bg: '#ffffff',
        surface: '#f8fafc',
        text: '#0f172a',
        border: '#e2e8f0'
      },
      borderRadius: '10px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'high_velocity_logistics'
    },
    requiredSections: ['hero_fleet', 'vehicle_category_filter', 'booking_dates_location_selector', 'fuel_mileage_policy', 'lead_form'],
    interactiveTool: {
      type: 'fleet_rental_booking_wizard',
      title: 'Online Araç Kiralama & VIP Transfer Rezervasyon Sihirbazı',
      subtitle: 'Alış-bırakış lokasyonu ve tarihlerinizi seçin; Sedan, SUV veya VIP Minibüs araçlarımızı anında rezerve edin.'
    },
    ctaBehavior: {
      primaryText: 'Online Rezervasyon Yap',
      secondaryText: 'VIP Transfer Fiyatlarını Gör',
      badge: '🚘 Son Model Dezenfekte VIP Araç Filosu & Özel Şoför',
      phoneText: '7/24 Transfer Rezervasyon Hattı'
    }
  },

  OTO_EKSPERTIZ_MUAYENE: {
    id: 'OTO_EKSPERTIZ_MUAYENE',
    number: 45,
    parentCategory: 'LOGISTICS_AUTOMOTIVE',
    name: 'Oto Ekspertiz & Muayene Merkezleri',
    keywords: ['oto ekspertiz', 'araç ekspertiz', 'dyno test', 'boya kaporta kontrol', 'fren testi', 'mobil ekspertiz', 'tse onaylı ekspertiz'],
    designTokens: {
      palette: {
        primary: '#dc2626', // Dynamic red
        secondary: '#18181b',
        accent: '#f59e0b',
        bg: '#fef2f2',
        surface: '#ffffff',
        text: '#18181b',
        border: '#fecaca'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'high_velocity_logistics'
    },
    requiredSections: ['hero_automotive', 'package_comparison_matrix', 'online_appointment_calendar', 'sample_report_viewer', 'lead_form'],
    interactiveTool: {
      type: 'inspection_package_selector',
      title: 'Oto Ekspertiz Paket Karşılaştırma & Örnek Rapor Görüntüleyici',
      subtitle: 'Motor, mekanik, kaporta-boya ve airbag kontrollerini kapsayan Gold/Platinum paketleri inceleyin.'
    },
    ctaBehavior: {
      primaryText: 'Online Ekspertiz Randevusu Al',
      secondaryText: 'Örnek Ekspertiz Raporunu İncele',
      badge: '🔍 TSE-HYB Belgeli Garantili ve Noter Onaylı Oto Ekspertiz',
      phoneText: 'İstasyon Randevu Hattı'
    }
  },

  OTO_YEDEK_PARCA_TOPTAN: {
    id: 'OTO_YEDEK_PARCA_TOPTAN',
    number: 46,
    parentCategory: 'LOGISTICS_AUTOMOTIVE',
    name: 'Oto Yedek Parça Toptancıları',
    keywords: ['oto yedek parça', 'oem parça', 'şase no parça sorgulama', 'b2b yedek parça', 'balata debriyaj', 'orijinal parça toptan'],
    designTokens: {
      palette: {
        primary: '#d97706', // Gear amber
        secondary: '#1e293b',
        accent: '#2563eb',
        bg: '#0f172a',
        surface: '#1e293b',
        text: '#f8fafc',
        border: '#334155'
      },
      borderRadius: '6px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'JetBrains Mono'
      },
      styleTheme: 'high_velocity_logistics'
    },
    requiredSections: ['hero_automotive', 'oem_vin_search_module', 'b2b_dealer_login_portal', 'brand_catalogs_grid', 'lead_form'],
    interactiveTool: {
      type: 'vin_oem_part_lookup',
      title: 'Şase No (VIN) veya OEM Parça Kodu ile Uyumluluk Sorgulama',
      subtitle: 'Aracınızın şase numarasını veya parça kodunu girin; birebir uyumlu orijinal ve muadil stokları görün.'
    },
    ctaBehavior: {
      primaryText: 'Şase Numarası ile Parça Sor',
      secondaryText: 'B2B Bayi Girişi Yap',
      badge: '⚙️ 100.000+ Kalem Anında Stok & Aynı Gün Türkiye Geneli Kargo',
      phoneText: 'Yedek Parça Satış Masası'
    }
  },

  DENIZCILIK_GEMI_TERSANE: {
    id: 'DENIZCILIK_GEMI_TERSANE',
    number: 47,
    parentCategory: 'LOGISTICS_AUTOMOTIVE',
    name: 'Denizcilik, Gemi Acenteliği & Tersane',
    keywords: ['gemi acentesi', 'tersane', 'denizcilik', 'havuzlama', 'boğaz geçiş acentesi', 'gemi bakım onarım', 'bunker yakıt'],
    designTokens: {
      palette: {
        primary: '#0369a1', // Deep marine
        secondary: '#082f49',
        accent: '#eab308',
        bg: '#04111d',
        surface: '#0a1d30',
        text: '#f0f9ff',
        border: '#133555'
      },
      borderRadius: '4px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'high_velocity_logistics'
    },
    requiredSections: ['hero_marine', 'port_agency_services', 'drydock_capacity_table', 'crew_change_application', 'lead_form'],
    interactiveTool: {
      type: 'strait_transit_cost_estimator',
      title: 'Boğaz Geçiş & Liman Acentelik Masrafı (D/A) Hesaplayıcı',
      subtitle: 'Gemi GRT/NRT tonajını ve yük durumunu girerek Çanakkale/İstanbul Boğaz geçiş tahmini tarife hesabını çıkarın.'
    },
    ctaBehavior: {
      primaryText: 'Liman Acenteliği / D/A Teklifi İste',
      secondaryText: 'Tersane Havuzlama Takvimini İncele',
      badge: '⚓ 7/24 Türk Boğazları & Tüm Türkiye Limanlarında Acentelik',
      phoneText: '24/7 Gemi Operasyon Masası'
    }
  },

  // =========================================================================
  // 8. TURİZM, KONAKLAMA, YEME-İÇME & ETKİNLİK (48 - 53)
  // =========================================================================
  BUTIK_LUKS_OTELLER: {
    id: 'BUTIK_LUKS_OTELLER',
    number: 48,
    parentCategory: 'TOURISM_HOSPITALITY',
    name: 'Butik & Lüks Oteller',
    keywords: ['butik otel', 'lüks otel', 'oda rezervasyon', 'spa otel', 'tatil köyü', 'resort', 'balayı oteli'],
    designTokens: {
      palette: {
        primary: '#9a3412', // Warm terracotta / luxury
        secondary: '#1c1917',
        accent: '#d97706',
        bg: '#fafaf9',
        surface: '#ffffff',
        text: '#292524',
        border: '#e7e5e4'
      },
      borderRadius: '12px',
      typography: {
        heading: 'Playfair Display',
        body: 'Source Sans Pro'
      },
      styleTheme: 'inviting_hospitality'
    },
    requiredSections: ['hero_hotel', 'room_types_360_tour', 'pricing_availability_calendar', 'hotel_amenities_spa_dining', 'lead_form'],
    interactiveTool: {
      type: 'room_booking_calendar_wizard',
      title: 'Oda Müsaitlik & En İyi Fiyat Garantili Rezervasyon Modülü',
      subtitle: 'Giriş-çıkış tarihlerinizi ve kişi sayısını seçerek süit odalarımızı ve erken rezervasyon fırsatlarını görün.'
    },
    ctaBehavior: {
      primaryText: 'En İyi Fiyatla Rezervasyon Yap',
      secondaryText: 'Sanal Otel Turunu Başlat',
      badge: '🌿 Doğanın Kalbinde Unutulmaz Bir Tatil & Gurme Gastronomi',
      phoneText: 'Otel Rezervasyon Masası'
    }
  },

  TUR_ACENTELERI_KULTUR_HAC: {
    id: 'TUR_ACENTELERI_KULTUR_HAC',
    number: 49,
    parentCategory: 'TOURISM_HOSPITALITY',
    name: 'Tur Acenteleri & Hac/Umre/Kültür Turları',
    keywords: ['tur acentesi', 'kültür turu', 'hac turları', 'umre turları', 'yurtdışı tur', 'vizesiz tur', 'balkan turu'],
    designTokens: {
      palette: {
        primary: '#0d9488', // Teal journey
        secondary: '#115e59',
        accent: '#f59e0b',
        bg: '#f0fdfa',
        surface: '#ffffff',
        text: '#134e4a',
        border: '#ccfbf1'
      },
      borderRadius: '12px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'inviting_hospitality'
    },
    requiredSections: ['hero_tours', 'day_by_day_itinerary', 'included_excluded_list', 'online_prepayment_form', 'lead_form'],
    interactiveTool: {
      type: 'tour_itinerary_explorer',
      title: 'Gün Gün Tur Programı & Dahil/Hariç Hizmetler Rehberi',
      subtitle: 'Gideceğiniz rotayı (Balkanlar, Kapadokya, Kudüs, Umre) seçin; uçuş, otel ve rehberlik detaylarını inceleyin.'
    },
    ctaBehavior: {
      primaryText: 'Tura Ön Kayıt Yaptır',
      secondaryText: 'Ayrıntılı Tur Broşürünü İndir',
      badge: '✈️ TÜRSAB A Grubu Seyahat Acentesi Güvencesi',
      phoneText: 'Tur Danışma & Satış Masası'
    }
  },

  RESTORANLAR_FINE_DINING_STEAK: {
    id: 'RESTORANLAR_FINE_DINING_STEAK',
    number: 50,
    parentCategory: 'TOURISM_HOSPITALITY',
    name: 'Restoranlar, Fine Dining & Steakhouse',
    keywords: ['restoran', 'fine dining', 'steakhouse', 'dijital menü', 'qr menü', 'masa rezervasyonu', 'şef spesiyalleri'],
    designTokens: {
      palette: {
        primary: '#b91c1c', // Crimson dining
        secondary: '#18181b',
        accent: '#d97706',
        bg: '#0c0a09', // Warm dark ambiance
        surface: '#1c1917',
        text: '#fafaf9',
        border: '#292524'
      },
      borderRadius: '10px',
      typography: {
        heading: 'Playfair Display',
        body: 'Inter'
      },
      styleTheme: 'inviting_hospitality'
    },
    requiredSections: ['hero_restaurant', 'digital_qr_menu_categories', 'table_reservation_form', 'chef_specials_highlight', 'lead_form'],
    interactiveTool: {
      type: 'restaurant_table_booking_tool',
      title: 'Online Masa Rezervasyonu & Özel Şef Menüsü Seçici',
      subtitle: 'Tarih, saat ve misafir sayınızı belirleyin; teras veya şömine başı masanızı anında ayırtın.'
    },
    ctaBehavior: {
      primaryText: 'Masa Rezervasyonu Oluştur',
      secondaryText: 'QR Dijital Menüyü Aç',
      badge: '🍷 Kuru Dinlendirilmiş Özel Etler & Şefin İmza Tabakları',
      phoneText: 'Restoran Rezervasyon Hattı'
    }
  },

  CATERING_TOPLU_YEMEK: {
    id: 'CATERING_TOPLU_YEMEK',
    number: 51,
    parentCategory: 'TOURISM_HOSPITALITY',
    name: 'Catering & Toplu Yemek Şirketleri',
    keywords: ['catering', 'toplu yemek', 'tabldot', 'fabrika yemek', 'şantiye yemeği', 'kurumsal davet catering', 'düğün yemeği'],
    designTokens: {
      palette: {
        primary: '#ea580c', // Appetizing orange
        secondary: '#431407',
        accent: '#16a34a',
        bg: '#fff7ed',
        surface: '#ffffff',
        text: '#431407',
        border: '#fed7aa'
      },
      borderRadius: '10px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'inviting_hospitality'
    },
    requiredSections: ['hero_catering', 'monthly_tabldot_menu_download', 'per_person_price_calculator', 'kitchen_hygiene_certs', 'lead_form'],
    interactiveTool: {
      type: 'catering_cost_per_person_calc',
      title: 'Kişi Sayısına Göre Toplu Yemek & Menü Fiyat Hesaplayıcı',
      subtitle: 'Günlük yemek adedini ve menü çeşidini (3 Kap, 4 Kap, Gurme) girerek aylık bütçenizi anlık hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'Fabrika / Şantiye Yemek Teklifi Al',
      secondaryText: 'Aylık Tabldot Menüsünü İndir',
      badge: '🍲 ISO 22000 Gıda Güvenliği & Diyetisyen Onaylı Kalori Dengesi',
      phoneText: 'Kurumsal Yemek Satış Masası'
    }
  },

  DUGUN_DAVET_SALONLARI: {
    id: 'DUGUN_DAVET_SALONLARI',
    number: 52,
    parentCategory: 'TOURISM_HOSPITALITY',
    name: 'Düğün Salonları & Davet/Etkinlik Alanları',
    keywords: ['düğün salonu', 'kır düğünü', 'davet alanı', 'kına organizasyon', 'mezuniyet balosu', 'etkinlik mekanı'],
    designTokens: {
      palette: {
        primary: '#be185d', // Rose romance
        secondary: '#1e293b',
        accent: '#eab308',
        bg: '#fdf2f8',
        surface: '#ffffff',
        text: '#831843',
        border: '#fbcfe8'
      },
      borderRadius: '14px',
      typography: {
        heading: 'Playfair Display',
        body: 'Inter'
      },
      styleTheme: 'inviting_hospitality'
    },
    requiredSections: ['hero_events', 'table_layout_diagram', 'organization_packages_cocktail', 'date_availability_calendar', 'lead_form'],
    interactiveTool: {
      type: 'wedding_date_package_wizard',
      title: 'Düğün & Davet Boş Tarih Sorgulama ve Paket Hesaplayıcı',
      subtitle: 'Hayal ettiğiniz mevsimi ve davetli sayısını belirleyin; kokteyl veya yemekli paket alternatiflerini inceleyin.'
    },
    ctaBehavior: {
      primaryText: 'Tarih Sorgula & Davet Teklifi Al',
      secondaryText: 'Düğün Fotoğraf Galerisini İncele',
      badge: '💍 1.000 Kişilik Kır Bahçesi & Balo Salonuyla Rüya Gibi Davetler',
      phoneText: 'Davet Koordinatörü Masası'
    }
  },

  FUAR_STAND_TASARIMI_SAHNE: {
    id: 'FUAR_STAND_TASARIMI_SAHNE',
    number: 53,
    parentCategory: 'TOURISM_HOSPITALITY',
    name: 'Fuar Stand Tasarımı & Sahne/Ses/Işık',
    keywords: ['fuar standı', 'ahşap stand', 'modüler stand', 'sahne ses ışık', 'kongre organizasyon', 'fuar stand tasarımı'],
    designTokens: {
      palette: {
        primary: '#7c3aed', // Creative violet
        secondary: '#1e1b4b',
        accent: '#f59e0b',
        bg: '#0f172a',
        surface: '#1e293b',
        text: '#f8fafc',
        border: '#334155'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'inviting_hospitality'
    },
    requiredSections: ['hero_expo', 'render_vs_real_comparison', 'expo_calendar_timeline', 'modular_wooden_gallery', 'lead_form'],
    interactiveTool: {
      type: 'expo_stand_budget_calculator',
      title: 'Fuar Standı (m²) & Malzeme Tipi Bütçe Hesaplayıcı',
      subtitle: 'Stand alanınızı (m²) ve malzeme tercihini (Ahşap, Maxima, Modüler) seçerek anahtar teslim bütçe çıkarın.'
    },
    ctaBehavior: {
      primaryText: 'Ücretsiz 3D Stand Çizimi Talep Et',
      secondaryText: 'Stand Portföyümüzü Görüntüle',
      badge: '🎪 Türkiye ve Avrupa Fuarlarında Kusursuz Kurulum & Demontaj',
      phoneText: 'Fuar Proje Yöneticisi'
    }
  },

  // =========================================================================
  // 9. EĞİTİM, AKADEMİ & KÜLTÜR-SANAT (54 - 59)
  // =========================================================================
  OZEL_KOLEJLER_K12: {
    id: 'OZEL_KOLEJLER_K12',
    number: 54,
    parentCategory: 'EDUCATION_ACADEMY',
    name: 'Özel Kolejler, Fen Liseleri & K-12',
    keywords: ['özel kolej', 'fen lisesi', 'k-12', 'özel okul', 'bursluluk sınavı', 'anadolu lisesi', 'özel ilkokul'],
    designTokens: {
      palette: {
        primary: '#1d4ed8', // Academic royal blue
        secondary: '#1e293b',
        accent: '#f59e0b',
        bg: '#eff6ff',
        surface: '#ffffff',
        text: '#1e3a8a',
        border: '#bfdbfe'
      },
      borderRadius: '12px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'friendly_education'
    },
    requiredSections: ['hero_education', 'scholarship_exam_form', 'academic_success_ranking', 'parent_portal_entry', 'campus_facilities_tour', 'lead_form'],
    interactiveTool: {
      type: 'scholarship_application_portal',
      title: 'Bursluluk Sınavı Online Başvuru & Kayıt Formu',
      subtitle: 'Öğrencinin sınıf düzeyini seçerek erken kayıt indirimleri ve bursluluk sınavına anında başvurun.'
    },
    ctaBehavior: {
      primaryText: 'Bursluluk Sınavına Başvur',
      secondaryText: 'Kampüs Tanıtım Randevusu Al',
      badge: '🎓 Çift Dilli Eğitim & %98 YKS/LGS Kitlesel Başarı Ortalaması',
      phoneText: 'Öğrenci İşleri & Kayıt Masası'
    }
  },

  KRES_ANAOKULU_BAKIMEVI: {
    id: 'KRES_ANAOKULU_BAKIMEVI',
    number: 55,
    parentCategory: 'EDUCATION_ACADEMY',
    name: 'Kreş, Anaokulu & Gündüz Bakımevleri',
    keywords: ['kreş', 'anaokulu', 'gündüz bakımevi', 'montessori', 'okul öncesi eğitim', 'bebek kreşi'],
    designTokens: {
      palette: {
        primary: '#f97316', // Playful warm orange
        secondary: '#0284c7',
        accent: '#eab308',
        bg: '#fffbeb',
        surface: '#ffffff',
        text: '#78350f',
        border: '#fde68a'
      },
      borderRadius: '18px', // Soft rounded playful
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'friendly_education'
    },
    requiredSections: ['hero_kindergarten', 'daily_menu_activities_schedule', 'security_camera_protocol', 'montessori_curriculum', 'lead_form'],
    interactiveTool: {
      type: 'kindergarten_readiness_age_calculator',
      title: 'Çocuk Yaş Grubu & Kreş/Anaokulu Başlama Uygunluk Hesaplayıcı',
      subtitle: 'Çocuğunuzun doğum tarihini girerek gelişim seviyesine uygun sınıf ve psikolog destekli oryantasyon planını görün.'
    },
    ctaBehavior: {
      primaryText: 'Oyun Grubu & Kreş Tanıtım Randevusu',
      secondaryText: 'Aylık Etkinlik & Yemek Bülteni',
      badge: '🧸 Sevgi Dolu Montessori Eğitimi & 7/24 Kamera İzleme Güvencesi',
      phoneText: 'Anaokulu Müdüriyeti'
    }
  },

  DIL_KURSLARI_YURTDISI_EGITIM: {
    id: 'DIL_KURSLARI_YURTDISI_EGITIM',
    number: 56,
    parentCategory: 'EDUCATION_ACADEMY',
    name: 'Yabancı Dil Kursları & Yurt Dışı Eğitim Danışmanlığı',
    keywords: ['yabancı dil kursu', 'ingilizce kursu', 'ielts', 'toefl', 'yurtdışı eğitim', 'almanca kursu', 'erasmus danışmanlık'],
    designTokens: {
      palette: {
        primary: '#0ea5e9', // Global sky blue
        secondary: '#0369a1',
        accent: '#f97316',
        bg: '#f0f9ff',
        surface: '#ffffff',
        text: '#0c4a6e',
        border: '#bae6fd'
      },
      borderRadius: '12px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'friendly_education'
    },
    requiredSections: ['hero_language', 'online_level_test_quiz', 'country_university_guide', 'visa_process_steps', 'lead_form'],
    interactiveTool: {
      type: 'english_level_placement_test',
      title: '5 Dakikalık Ücretsiz Online İngilizce Seviye Tespit Testi',
      subtitle: 'Soruları yanıtlayarak CEFR standartlarında (A1, A2, B1, B2, C1) seviyenizi ve gereken ders saatini öğrenin.'
    },
    ctaBehavior: {
      primaryText: 'Online Seviye Tespit Sınavını Başlat',
      secondaryText: 'Yurtdışı Dil Okulları Rehberini İndir',
      badge: '🌍 Anadili İngilizce Olan Eğitmenler & Konuşma Garantisi',
      phoneText: 'Eğitim Danışmanı Masası'
    }
  },

  SURUCU_KURSLARI_IS_MAKINESI: {
    id: 'SURUCU_KURSLARI_IS_MAKINESI',
    number: 57,
    parentCategory: 'EDUCATION_ACADEMY',
    name: 'Sürücü Kursları & SRC/İş Makinesi Kursları',
    keywords: ['sürücü kursu', 'ehliyet kursu', 'b sınıfı ehliyet', 'a2 motor ehliyeti', 'src belgesi', 'forklift ehliyeti', 'psikoteknik'],
    designTokens: {
      palette: {
        primary: '#eab308', // Road yellow
        secondary: '#1e293b',
        accent: '#dc2626',
        bg: '#0f172a',
        surface: '#1e293b',
        text: '#f8fafc',
        border: '#334155'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'friendly_education'
    },
    requiredSections: ['hero_driving', 'license_class_requirements', 'training_fleet_cars', 'online_preregistration_form', 'lead_form'],
    interactiveTool: {
      type: 'license_fee_cost_calculator',
      title: 'Ehliyet Sınıfı (A, B, C, D) ve Harç/Ders Ücreti Hesaplayıcı',
      subtitle: 'Almak istediğiniz ehliyet sınıfını seçin; kurs, direksiyon eğitimi ve MEB sınav harçları toplamını görün.'
    },
    ctaBehavior: {
      primaryText: 'Online Ehliyet Ön Kaydı Yap',
      secondaryText: 'Direksiyon Eğitmenlerimizle Tanış',
      badge: '🚗 Son Model Eğitim Araçları & Birebir Akan Trafikte Direksiyon',
      phoneText: 'Sürücü Kursu Kayıt Ofisi'
    }
  },

  MESLEKI_EGITIM_YAZILIM_AKADEMILERI: {
    id: 'MESLEKI_EGITIM_YAZILIM_AKADEMILERI',
    number: 58,
    parentCategory: 'EDUCATION_ACADEMY',
    name: 'Mesleki Eğitim, Yazılım & Kariyer Akademileri',
    keywords: ['yazılım akademisi', 'bootcamp', 'mesleki eğitim', 'fullstack kursu', 'veri bilimi kursu', 'grafik tasarım kursu'],
    designTokens: {
      palette: {
        primary: '#6366f1', // Tech academy indigo
        secondary: '#1e1b4b',
        accent: '#10b981',
        bg: '#090d16',
        surface: '#111827',
        text: '#f8fafc',
        border: '#243248'
      },
      borderRadius: '10px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'JetBrains Mono'
      },
      styleTheme: 'dark_bento_cyber'
    },
    requiredSections: ['hero_academy', 'curriculum_syllabus_download', 'instructor_industry_track', 'alumni_hiring_companies', 'lead_form'],
    interactiveTool: {
      type: 'career_path_bootcamp_finder',
      title: 'Kariyer Yolu Belirleme & Bootcamp Müfredat Karşılaştırma Aracı',
      subtitle: 'Hedeflediğiniz pozisyonu (Frontend, Backend, Yapay Zeka) seçin; haftalık ders planı ve bitirme projelerini görün.'
    },
    ctaBehavior: {
      primaryText: 'Detaylı Müfredatı (Syllabus) İndir',
      secondaryText: 'Kariyer Danışmanıyla Görüş',
      badge: '💻 İşe Yerleştirme Destekli Uygulamalı Yazılım Bootcamp',
      phoneText: 'Akademi Kabul Masası'
    }
  },

  MUZIK_RESIM_SANAT_OKULLARI: {
    id: 'MUZIK_RESIM_SANAT_OKULLARI',
    number: 59,
    parentCategory: 'EDUCATION_ACADEMY',
    name: 'Müzik, Resim & Bale/Dans Okulları',
    keywords: ['müzik kursu', 'piyano kursu', 'gitar dersi', 'bale okulu', 'resim atölyesi', 'konservatuvar hazırlık', 'şan dersi'],
    designTokens: {
      palette: {
        primary: '#9333ea', // Artistic violet
        secondary: '#581c87',
        accent: '#f59e0b',
        bg: '#faf5ff',
        surface: '#ffffff',
        text: '#581c87',
        border: '#f3e8ff'
      },
      borderRadius: '16px',
      typography: {
        heading: 'Playfair Display',
        body: 'Inter'
      },
      styleTheme: 'friendly_education'
    },
    requiredSections: ['hero_arts', 'instrument_guide_accordion', 'student_recitals_video_gallery', 'free_trial_lesson_form', 'lead_form'],
    interactiveTool: {
      type: 'instrument_discovery_quiz',
      title: 'Enstrüman & Sanat Dalı Yetenek Eğilimi Belirleme Testi',
      subtitle: 'Yaş ve ilgi alanlarınıza göre (Piyano, Keman, Bateri, Resim) en uygun branşı ve deneme dersini planlayın.'
    },
    ctaBehavior: {
      primaryText: 'Ücretsiz Deneme Dersi Talep Et',
      secondaryText: 'Öğrenci Resitallerini İzle',
      badge: '🎵 MEB Onaylı Sertifika & London College of Music Akreditasyonu',
      phoneText: 'Sanat Koordinatörü Masası'
    }
  },

  // =========================================================================
  // 10. ENERJİ, ÇEVRE, GERİ DÖNÜŞÜM & MADEN (60 - 64)
  // =========================================================================
  GUNES_ENERJISI_GES_YENILENEBILIR: {
    id: 'GUNES_ENERJISI_GES_YENILENEBILIR',
    number: 60,
    parentCategory: 'ENERGY_ENVIRONMENT_MINING',
    name: 'Güneş Enerjisi (GES) & Yenilenebilir Enerji',
    keywords: ['güneş enerjisi', 'ges', 'solar panel', 'çatı ges', 'arazi ges', 'inverter', 'lityum akü', 'yenilenebilir enerji', 'akü', 'traksiyoner akü', 'endüstriyel akü', 'forklift aküsü', 'batarya'],
    designTokens: {
      palette: {
        primary: '#eab308', // Solar electric gold
        secondary: '#0f172a',
        accent: '#10b981',
        bg: '#0b0f19',
        surface: '#111827',
        text: '#f8fafc',
        border: '#1f293d'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'eco_engineering'
    },
    requiredSections: ['hero_solar', 'solar_roi_amortization_tool', 'installed_mwp_references', 'tedas_permits_guide', 'lead_form'],
    interactiveTool: {
      type: 'solar_ges_roi_calculator',
      title: 'Akü Kapasite & Solar Enerji Amortisman Simülatörü',
      subtitle: 'İşletmenizin ihtiyacına uygun akü tipi ve solar kurulum için tahmini yıllık tasarruf ve geri dönüş süresini anlık hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'GES & Çatı Fizibilitesi İsteyin',
      secondaryText: 'Kurulum Portföyünü İnceleyin',
      badge: '⚡ Yüksek Verimli Endüstriyel Enerji & Akü Sistemleri',
      phoneText: 'Güneş Enerjisi Mühendislik Masası'
    }
  },

  GERI_DONUSUM_HURDA_ATIK: {
    id: 'GERI_DONUSUM_HURDA_ATIK',
    number: 61,
    parentCategory: 'ENERGY_ENVIRONMENT_MINING',
    name: 'Geri Dönüşüm, Hurda & Endüstriyel Atık Yönetimi',
    keywords: ['geri dönüşüm', 'hurda metal', 'atık yönetimi', 'tehlikeli atık bertaraf', 'plastik geri dönüşüm', 'çevre lisansı'],
    designTokens: {
      palette: {
        primary: '#16a34a', // Ecological green
        secondary: '#14532d',
        accent: '#eab308',
        bg: '#052e16',
        surface: '#0f3d24',
        text: '#f0fdf4',
        border: '#166534'
      },
      borderRadius: '6px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'eco_engineering'
    },
    requiredSections: ['hero_recycling', 'waste_acceptance_list', 'environmental_licenses_cert', 'waste_purchase_quote_form', 'lead_form'],
    interactiveTool: {
      type: 'waste_tonnage_quote_estimator',
      title: 'Endüstriyel Hurda & Atık Tonaj Fiyat Teklif Motoru',
      subtitle: 'Metal, plastik veya kağıt atık cinsini ve aylık tonajınızı girerek anında alım teklifimizi görün.'
    },
    ctaBehavior: {
      primaryText: 'Atık Alım / Bertaraf Teklifi İste',
      secondaryText: 'Çevre İzin & Lisans Belgelerimiz',
      badge: '♻️ Çevre ve Şehircilik Bakanlığı Lisanslı Sıfır Atık Tesisi',
      phoneText: 'Atık Alım Koordinatörü'
    }
  },

  SU_ARITMA_CEVRE_MUHENDISLIGI: {
    id: 'SU_ARITMA_CEVRE_MUHENDISLIGI',
    number: 62,
    parentCategory: 'ENERGY_ENVIRONMENT_MINING',
    name: 'Su Arıtma Sistemleri & Çevre Mühendisliği',
    keywords: ['su arıtma', 'endüstriyel su arıtma', 'ters ozmoz', 'saf su sistemi', 'filtre değişimi', 'atıksu arıtma'],
    designTokens: {
      palette: {
        primary: '#0284c7', // Pure blue
        secondary: '#075985',
        accent: '#10b981',
        bg: '#f0f9ff',
        surface: '#ffffff',
        text: '#0c4a6e',
        border: '#bae6fd'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'eco_engineering'
    },
    requiredSections: ['hero_water_treatment', 'industrial_vs_domestic_categories', 'filter_replacement_period_table', 'water_saving_analysis_form', 'lead_form'],
    interactiveTool: {
      type: 'water_consumption_ro_calculator',
      title: 'Ters Ozmoz (RO) & Fabrika Su Tasarruf / İletkenlik Hesaplayıcı',
      subtitle: 'Günlük su tüketiminizi ve kaynak suyunun sertlik derecesini girerek gereken arıtma kapasitesini bulun.'
    },
    ctaBehavior: {
      primaryText: 'Ücretsiz Tesis Su Analizi İsteyin',
      secondaryText: 'Endüstriyel RO Sistem Kataloğu',
      badge: '💧 Yüksek Saflıkta İletkenlik Kontrollü Endüstriyel Su Arıtma',
      phoneText: 'Su Teknolojileri Masası'
    }
  },

  MADENCILIK_MERMER_DOGAL_TAS: {
    id: 'MADENCILIK_MERMER_DOGAL_TAS',
    number: 63,
    parentCategory: 'ENERGY_ENVIRONMENT_MINING',
    name: 'Madencilik, Mermer & Doğal Taş Fabrikaları',
    keywords: ['mermer fabrikası', 'doğal taş', 'traverten ocak', 'granit plaka', 'cilalı mermer', 'mermer ihracat'],
    designTokens: {
      palette: {
        primary: '#78716c', // Stone marble gray
        secondary: '#1c1917',
        accent: '#d97706',
        bg: '#fafaf9',
        surface: '#ffffff',
        text: '#1c1917',
        border: '#e7e5e4'
      },
      borderRadius: '2px', // Sharp mineral
      typography: {
        heading: 'Cinzel',
        body: 'Inter'
      },
      styleTheme: 'editorial_magazine_sharp'
    },
    requiredSections: ['hero_quarry', 'marble_quarry_map', 'slab_finishing_options_grid', 'container_loading_specs', 'lead_form'],
    interactiveTool: {
      type: 'marble_container_weight_estimator',
      title: 'Mermer Plaka (2cm/3cm) Metrekare & Konteyner Yük Hesaplayıcı',
      subtitle: 'Taş cinsi (Traverten, Bej, Beyaz) ve plaka kalınlığını seçerek konteyner başına net m² kapasitesini hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'Konteyner / Blok Mermer Teklifi Al',
      secondaryText: 'Doğal Taş Kartelasını İndir',
      badge: '🏛️ Kendi Ocaklarımızdan Çıkarılan 1. Sınıf İhracat Mermeri',
      phoneText: 'Mermer İhracat Departmanı'
    }
  },

  AKARYAKIT_DAGITIM_ISTASYONLARI: {
    id: 'AKARYAKIT_DAGITIM_ISTASYONLARI',
    number: 64,
    parentCategory: 'ENERGY_ENVIRONMENT_MINING',
    name: 'Akaryakıt Dağıtım Şirketleri & İstasyon Zincirleri',
    keywords: ['akaryakıt dağıtım', 'benzin istasyonu', 'akaryakıt fiyatları', 'en yakın istasyon', 'istasyon bayilik', 'motorin toptan'],
    designTokens: {
      palette: {
        primary: '#dc2626', // Station energetic red
        secondary: '#1e293b',
        accent: '#eab308',
        bg: '#0f172a',
        surface: '#1e293b',
        text: '#f8fafc',
        border: '#334155'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'eco_engineering'
    },
    requiredSections: ['hero_fuel', 'live_city_fuel_prices_table', 'station_locator_map', 'franchise_dealership_terms', 'lead_form'],
    interactiveTool: {
      type: 'fuel_savings_fleet_calculator',
      title: 'Taşıt Tanıma Sistemi (TTS) & Filo Akaryakıt Tasarruf Hesaplayıcı',
      subtitle: 'Filodaki araç sayınızı ve aylık litre tüketiminizi girerek TTS iskonto ve vergi avantajınızı hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'Filo Taşıt Tanıma (TTS) Başvurusu',
      secondaryText: 'İstasyon Bayilik Şartlarını İncele',
      badge: '⛽ EPDK Lisanslı Katkılı Kurşunsuz & Eurodizel Güvencesi',
      phoneText: 'Kurumsal Akaryakıt Masası'
    }
  },

  // =========================================================================
  // 11. SPOR, FITNESS, GÜZELLİK & KİŞİSEL BAKIM (65 - 69)
  // =========================================================================
  SPOR_SALONLARI_CROSSFIT: {
    id: 'SPOR_SALONLARI_CROSSFIT',
    number: 65,
    parentCategory: 'SPORTS_FITNESS_BEAUTY',
    name: "Spor Salonları & Crossfit Box'lar",
    keywords: ['spor salonu', 'fitness', 'crossfit', 'vücut geliştirme', 'gym', 'pt özel ders', 'üyelik paketleri'],
    designTokens: {
      palette: {
        primary: '#84cc16', // High-energy neon lime
        secondary: '#09090b',
        accent: '#eab308',
        bg: '#09090b', // Ultra dark gym vibe
        surface: '#18181b',
        text: '#fafafa',
        border: '#27272a'
      },
      borderRadius: '10px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'high_energy_sports'
    },
    requiredSections: ['hero_fitness', 'class_schedule_calendar', 'membership_tier_plans', 'personal_trainers_grid', 'lead_form'],
    interactiveTool: {
      type: 'gym_membership_matcher',
      title: 'Fitness Hedefine Göre Ders & Üyelik Planı Seçici',
      subtitle: 'Hedefinizi (Kilo Verme, Kas Kazanımı, Kondisyon) belirleyin; haftalık grup dersi ve antrenör takviminizi çıkarın.'
    },
    ctaBehavior: {
      primaryText: 'Ücretsiz 1 Günlük Antrenman Davetiyesi Al',
      secondaryText: 'Ders Programı & Seansları Gör',
      badge: '⚡ 1.500 m² Profesyonel Ekipman Parkı & Islak Alan / Sauna',
      phoneText: 'Gym Resepsiyon Masası'
    }
  },

  PILATES_REFORMER_STUDYOLARI: {
    id: 'PILATES_REFORMER_STUDYOLARI',
    number: 66,
    parentCategory: 'SPORTS_FITNESS_BEAUTY',
    name: 'Pilates & Reformer Stüdyoları',
    keywords: ['pilates stüdyosu', 'reformer pilates', 'aletli pilates', 'hamile pilatesi', 'klinik pilates', 'birebir reformer'],
    designTokens: {
      palette: {
        primary: '#be185d', // Soft rose / blush
        secondary: '#831843',
        accent: '#d97706',
        bg: '#fdf2f8',
        surface: '#ffffff',
        text: '#701a75',
        border: '#fbcfe8'
      },
      borderRadius: '16px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'high_energy_sports'
    },
    requiredSections: ['hero_pilates', 'individual_group_class_times', 'studio_hygiene_equipment_photos', 'free_trial_session_form', 'lead_form'],
    interactiveTool: {
      type: 'pilates_posture_session_picker',
      title: 'Duruş (Postür) Analizi & Birebir Reformer Seans Seçici',
      subtitle: 'Omurga sağlığı ve sıkılaşma hedeflerinize uygun düet veya birebir seans saatlerini belirleyin.'
    },
    ctaBehavior: {
      primaryText: 'Ücretsiz Deneme Seansı Al',
      secondaryText: 'Stüdyo Saatlerini İncele',
      badge: '🌸 Sertifikalı Eğitmenlerle Butik & Hijyenik Reformer Deneyimi',
      phoneText: 'Stüdyo Randevu Hattı'
    }
  },

  GUZELLIK_SALONLARI_CILT_BAKIM: {
    id: 'GUZELLIK_SALONLARI_CILT_BAKIM',
    number: 67,
    parentCategory: 'SPORTS_FITNESS_BEAUTY',
    name: 'Güzellik Salonları & Cilt Bakım Merkezleri',
    keywords: ['güzellik salonu', 'cilt bakımı', 'hydrafacial', 'lazer epilasyon', 'bölgesel incelme', 'kalıcı makyaj', 'ipek kirpik'],
    designTokens: {
      palette: {
        primary: '#ec4899', // Elegant magenta / rose
        secondary: '#831843',
        accent: '#f59e0b',
        bg: '#fff1f2',
        surface: '#ffffff',
        text: '#4c0519',
        border: '#fecdd3'
      },
      borderRadius: '16px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'high_energy_sports'
    },
    requiredSections: ['hero_beauty', 'skin_protocols_list', 'certified_devices_showcase', 'whatsapp_instant_appointment', 'lead_form'],
    interactiveTool: {
      type: 'skin_type_treatment_advisor',
      title: 'Cilt Tipi Analizi & İhtiyaca Özel Bakım Protokolü Seçici',
      subtitle: 'Cilt endişenizi (Leke, Kırışıklık, Akne, Gözenek) seçin; uygulanan medikal cilt bakım aşamalarını inceleyin.'
    },
    ctaBehavior: {
      primaryText: 'WhatsApp ile Hızlı Randevu Al',
      secondaryText: 'Cilt Bakım Kampanyalarını Gör',
      badge: '✨ FDA Onaylı Orijinal Cihazlar & Medikal Cilt Bakım Protokolleri',
      phoneText: 'Güzellik Merkezi Danışma Hattı'
    }
  },

  KUAFOR_ERKEK_BERBER_SALONLARI: {
    id: 'KUAFOR_ERKEK_BERBER_SALONLARI',
    number: 68,
    parentCategory: 'SPORTS_FITNESS_BEAUTY',
    name: 'Kuaför & Erkek Berber Salonları',
    keywords: ['kuaför', 'erkek berberi', 'saç kesim', 'sakal tasarımı', 'saç renklendirme', 'keratin bakım', 'gelin saçı'],
    designTokens: {
      palette: {
        primary: '#1c1917', // Barber classic dark / brass
        secondary: '#0c0a09',
        accent: '#b45309',
        bg: '#0c0a09',
        surface: '#1c1917',
        text: '#fafaf9',
        border: '#292524'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Playfair Display',
        body: 'Inter'
      },
      styleTheme: 'high_energy_sports'
    },
    requiredSections: ['hero_barber', 'hair_beard_pricing_menu', 'operating_hours_box', 'stylist_selection_booking', 'lead_form'],
    interactiveTool: {
      type: 'barber_stylist_booking_engine',
      title: 'Usta / Stilist Seçmeli Online Kuaför Randevu Modülü',
      subtitle: 'Favori kuaförünüzü, işlem tipini (Kesim, Renklendirme, Sakal) ve uygun saati seçerek koltuğunuzu ayırtın.'
    },
    ctaBehavior: {
      primaryText: 'Stilist Seç & Randevu Al',
      secondaryText: 'Fiyat Listesini İncele',
      badge: '✂️ Kişiye Özel Saç ve Sakal Tasarımında Usta Dokunuşlar',
      phoneText: 'Salon Randevu Hattı'
    }
  },

  SPOR_KULUPLERI_ALTYAPI_OKULLARI: {
    id: 'SPOR_KULUPLERI_ALTYAPI_OKULLARI',
    number: 69,
    parentCategory: 'SPORTS_FITNESS_BEAUTY',
    name: 'Spor Kulüpleri & Futbol/Basketbol Altyapı Okulları',
    keywords: ['futbol okulu', 'basketbol okulu', 'spor kulübü altyapı', 'voleybol okulu', 'yüzme kursu', 'lisanslı sporcu'],
    designTokens: {
      palette: {
        primary: '#2563eb', // Athletic blue
        secondary: '#1e3a8a',
        accent: '#f59e0b',
        bg: '#eff6ff',
        surface: '#ffffff',
        text: '#1e3a8a',
        border: '#bfdbfe'
      },
      borderRadius: '10px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'high_energy_sports'
    },
    requiredSections: ['hero_club', 'age_groups_pitches_info', 'licensing_requirements_steps', 'fixture_match_scores', 'lead_form'],
    interactiveTool: {
      type: 'youth_academy_registration_wizard',
      title: 'Altyapı Seçmeleri & Yaş Grubu Kayıt Başvuru Sihirbazı',
      subtitle: 'Çocuğunuzun doğum yılını girerek antrenman günlerini, tesis sahalarını ve seçme tarihlerini öğrenin.'
    },
    ctaBehavior: {
      primaryText: 'Altyapı Seçmelerine Başvur',
      secondaryText: 'Haftalık Maç Fikstürünü Gör',
      badge: '⚽ Geleceğin Yıldız Sporcularını Yetiştiren Profesyonel Akademi',
      phoneText: 'Kulüp Tesisleri İletişim'
    }
  },

  // =========================================================================
  // 12. YEREL HİZMETLER, TEKNİK SERVİSLER & GÜVENLİK (70 - 76)
  // =========================================================================
  OZEL_GUVENLIK_ALARM_KAMERA: {
    id: 'OZEL_GUVENLIK_ALARM_KAMERA',
    number: 70,
    parentCategory: 'LOCAL_SERVICES_EMERGENCY',
    name: 'Özel Güvenlik Şirketleri & Kamera/Alarm Sistemleri',
    keywords: ['özel güvenlik', 'kamera sistemi', 'alarm sistemi', 'güvenlik görevlisi temini', '5188 sayılı kanun', 'yakın koruma'],
    designTokens: {
      palette: {
        primary: '#0f172a', // Midnight security
        secondary: '#0284c7',
        accent: '#ef4444',
        bg: '#090d16',
        surface: '#111827',
        text: '#f8fafc',
        border: '#1e293b'
      },
      borderRadius: '6px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'JetBrains Mono'
      },
      styleTheme: 'mobile_first_dispatch'
    },
    requiredSections: ['hero_security_local', 'governorship_license_badges', 'site_recon_request_form', 'security_guard_job_portal', 'lead_form'],
    interactiveTool: {
      type: 'security_reconnaissance_request_tool',
      title: 'Tesis Keşif & Güvenlik Personeli Sayı Belirleme Modülü',
      subtitle: 'Siteniz, fabrikanız veya etkinliğiniz için gereken vardiyalı güvenlik personeli ve kamera noktalarını belirleyin.'
    },
    ctaBehavior: {
      primaryText: 'Ücretsiz Güvenlik Keşfi İste',
      secondaryText: 'Alarm & Kamera Fiyatı Al',
      badge: '🛡️ İçişleri Bakanlığı İzinli 5188 Sayılı Kanun Kapsamında Güvenlik',
      phoneText: '7/24 Alarm & Güvenlik Merkezi'
    }
  },

  ENDUSTRIYEL_EV_OFIS_TEMIZLIGI: {
    id: 'ENDUSTRIYEL_EV_OFIS_TEMIZLIGI',
    number: 71,
    parentCategory: 'LOCAL_SERVICES_EMERGENCY',
    name: 'Endüstriyel Temizlik & Ev/Ofis Temizliği',
    keywords: ['temizlik şirketi', 'ev temizliği', 'ofis temizliği', 'inşaat sonrası temizlik', 'dış cephe cam silme', 'koltuk yıkama'],
    designTokens: {
      palette: {
        primary: '#0284c7', // Sparkling blue
        secondary: '#0369a1',
        accent: '#10b981',
        bg: '#f0f9ff',
        surface: '#ffffff',
        text: '#0c4a6e',
        border: '#bae6fd'
      },
      borderRadius: '12px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'mobile_first_dispatch'
    },
    requiredSections: ['hero_cleaning', 'm2_instant_pricing_calculator', 'insured_staff_guarantee_seal', 'cleaning_checklist_grid', 'lead_form'],
    interactiveTool: {
      type: 'cleaning_instant_price_estimator',
      title: 'Metrekare & Hizmet Türüne Göre Anlık Temizlik Fiyat Hesaplayıcı',
      subtitle: 'Mekan tipinizi (Ev, Ofis, İnşaat Sonu) ve m² girerek sigortalı personelli temizlik fiyatını 1 dakikada görün.'
    },
    ctaBehavior: {
      primaryText: 'Anında Temizlik Fiyatı Al',
      secondaryText: 'WhatsApp ile Randevu Ayarla',
      badge: '✨ Sabıka Kaydı Kontrollü & SGK Sigortalı Profesyonel Temizlik Kadrosu',
      phoneText: 'Temizlik Randevu Hattı'
    }
  },

  BOCEK_ILACLAMA_HASERE_KONTROL: {
    id: 'BOCEK_ILACLAMA_HASERE_KONTROL',
    number: 72,
    parentCategory: 'LOCAL_SERVICES_EMERGENCY',
    name: 'Böcek İlaçlama & Haşere Kontrol',
    keywords: ['böcek ilaçlama', 'haşere kontrol', 'pire ilaçlama', 'fare ilaçlama', 'sağlık bakanlığı onaylı ilaçlama', 'ev ilaçlama'],
    designTokens: {
      palette: {
        primary: '#15803d', // Pest control green
        secondary: '#14532d',
        accent: '#dc2626',
        bg: '#f0fdf4',
        surface: '#ffffff',
        text: '#14532d',
        border: '#bbf7d0'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'mobile_first_dispatch'
    },
    requiredSections: ['hero_pest', 'pest_types_guide_accordion', 'health_ministry_approved_seal', 'emergency_dispatch_banner', 'lead_form'],
    interactiveTool: {
      type: 'pest_identifier_solution_tool',
      title: 'Haşere Türü Teşhis & Kokusuz İlaçlama Yöntemi Seçici',
      subtitle: 'Karşılaştığınız haşere türünü (Hamam böceği, Pire, Fare, Tahtakurusu) seçerek tahmini seans ve çözüm planını öğrenin.'
    },
    ctaBehavior: {
      primaryText: 'Acil İlaçlama Ekibi Çağır',
      secondaryText: 'WhatsApp Canlı Destek',
      badge: '🌿 T.C. Sağlık Bakanlığı Onaylı Kokusuz & İnsan Sağlığına Zararsız İlaçlar',
      phoneText: '7/24 Haşere İhbar Hattı'
    }
  },

  KOMBI_KLIMA_BEYAZ_ESYA_SERVISI: {
    id: 'KOMBI_KLIMA_BEYAZ_ESYA_SERVISI',
    number: 73,
    parentCategory: 'LOCAL_SERVICES_EMERGENCY',
    name: 'Kombi, Klima & Beyaz Eşya Özel/Yetkili Servisleri',
    keywords: ['kombi servisi', 'klima servisi', 'beyaz eşya tamiri', 'kombi arıza', 'klima montaj', 'petek temizleme', 'orijinal parça garantisi'],
    designTokens: {
      palette: {
        primary: '#ea580c', // Service flame / action
        secondary: '#1e293b',
        accent: '#0284c7',
        bg: '#fff7ed',
        surface: '#ffffff',
        text: '#431407',
        border: '#fed7aa'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'mobile_first_dispatch'
    },
    requiredSections: ['hero_appliance', 'error_codes_guide', 'original_parts_warranty_badge', 'dispatch_30_min_banner', 'lead_form'],
    interactiveTool: {
      type: 'boiler_error_code_lookup',
      title: 'Kombi & Klima Arıza Kodları (F1, E01 vb.) Hızlı Çözüm Rehberi',
      subtitle: 'Cihaz markanızı ve ekranda beliren arıza kodunu seçin; arızanın kaynağını ve servis öncesi güvenlik adımlarını görün.'
    },
    ctaBehavior: {
      primaryText: '30 Dakikada Kapınızda Servis Çağır',
      secondaryText: 'WhatsApp Arıza Gönder',
      badge: '⚡ 1 Yıl Parça ve İşçilik Garantili Yetkili Standartta Teknik Servis',
      phoneText: 'Acil Servis Çağrı Merkezi'
    }
  },

  ASANSOR_IMALAT_BAKIM: {
    id: 'ASANSOR_IMALAT_BAKIM',
    number: 74,
    parentCategory: 'LOCAL_SERVICES_EMERGENCY',
    name: 'Asansör İmalat, Montaj & Periyodik Bakım',
    keywords: ['asansör imalatı', 'asansör bakımı', 'yeşil etiket asansör', 'asansör revizyon', '7/24 asansörde kalma', 'asansör arıza'],
    designTokens: {
      palette: {
        primary: '#0284c7', // Elevator engineering
        secondary: '#0f172a',
        accent: '#16a34a', // Green tag
        bg: '#0b0f19',
        surface: '#111827',
        text: '#f8fafc',
        border: '#1f293d'
      },
      borderRadius: '6px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'JetBrains Mono'
      },
      styleTheme: 'mobile_first_dispatch'
    },
    requiredSections: ['hero_elevator', 'red_green_tag_revision_guide', 'emergency_elevator_stuck_bar', 'maintenance_contract_form', 'lead_form'],
    interactiveTool: {
      type: 'elevator_maintenance_cost_calculator',
      title: 'Bina Durak Sayısı & Yıllık Asansör Bakım Sözleşmesi Hesaplayıcı',
      subtitle: 'Asansör adedi ve bina durak sayınızı girerek periyodik yeşil etiket bakım ve revizyon maliyetinizi hesaplayın.'
    },
    ctaBehavior: {
      primaryText: 'Aylık Bakım Sözleşmesi Teklifi Al',
      secondaryText: '7/24 Asansörde Kalma Acil İhbar',
      badge: '🟢 Sanayi Bakanlığı Akredite Yeşil Etiket & CE Standartlarında Güvenlik',
      phoneText: '7/24 Asansör Acil Kurtarma'
    }
  },

  EVDEN_EVE_NAKLIYAT_ASANSORLU: {
    id: 'EVDEN_EVE_NAKLIYAT_ASANSORLU',
    number: 75,
    parentCategory: 'LOCAL_SERVICES_EMERGENCY',
    name: 'Evden Eve Nakliyat & Asansörlü Taşımacılık',
    keywords: ['evden eve nakliyat', 'asansörlü nakliyat', 'şehirlerarası nakliyat', 'ev taşıma', 'eşya depolama', 'sigortalı taşımacılık'],
    designTokens: {
      palette: {
        primary: '#2563eb', // Moving truck blue
        secondary: '#1e3a8a',
        accent: '#f59e0b',
        bg: '#eff6ff',
        surface: '#ffffff',
        text: '#1e3a8a',
        border: '#bfdbfe'
      },
      borderRadius: '10px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'mobile_first_dispatch'
    },
    requiredSections: ['hero_moving', 'item_inventory_price_calculator', 'insurance_policy_details', 'truck_fleet_photos', 'lead_form'],
    interactiveTool: {
      type: 'moving_cost_inventory_estimator',
      title: 'Oda Sayısı (1+1, 2+1, 3+1) & Kat Mesafesi Nakliyat Fiyat Hesaplayıcı',
      subtitle: 'Eski evinizin ve yeni evinizin kat durumunu ve asansör ihtiyacını seçerek sigortalı taşıma fiyatını anında görün.'
    },
    ctaBehavior: {
      primaryText: 'Anında Nakliyat Fiyatı Al',
      secondaryText: 'WhatsApp ile Eşya Videosu Gönder',
      badge: '📦 Kaskolu & Asansörlü Çizilmez Ambalajlı Profesyonel Taşımacılık',
      phoneText: 'Nakliyat Danışma Hattı'
    }
  },

  CILINGIR_OTO_ANAHTAR: {
    id: 'CILINGIR_OTO_ANAHTAR',
    number: 76,
    parentCategory: 'LOCAL_SERVICES_EMERGENCY',
    name: 'Çilingir & Oto Anahtar',
    keywords: ['çilingir', 'oto anahtar', 'kapı açma', 'kilit değiştirme', 'nöbetçi çilingir', 'oto çilingir', 'en yakın çilingir'],
    designTokens: {
      palette: {
        primary: '#e11d48', // Urgent rose / red alert
        secondary: '#0f172a',
        accent: '#f59e0b',
        bg: '#0f172a',
        surface: '#1e293b',
        text: '#f8fafc',
        border: '#334155'
      },
      borderRadius: '8px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'mobile_first_dispatch'
    },
    requiredSections: ['hero_locksmith', 'emergency_callout_giant_cta', 'location_dispatch_guide', 'lock_brands_showcase', 'lead_form'],
    interactiveTool: {
      type: 'emergency_locksmith_locator',
      title: 'En Yakın Nöbetçi Çilingir & Konum Gönderme Butonu',
      subtitle: 'Bulunduğunuz mahalleyi seçin veya konumunuzu iletin; ustamız 15 dakika içinde kapınıza ulaşsın.'
    },
    ctaBehavior: {
      primaryText: '🚨 15 Dakikada Çilingir Hemen Gelsin',
      secondaryText: 'WhatsApp ile Kilit Fotoğrafı Gönder',
      badge: '🔑 Hasarsız Kapı & Kilit Açma Garantisi / Oda Kayıtlı Esnaf',
      phoneText: '7/24 Acil Çilingir Hattı'
    }
  },

  // =========================================================================
  // 13. STK, VAKIF, DERNEK & BİRLİKLER (77 - 79)
  // =========================================================================
  INSANI_YARDIM_VAKIFLARI_DERNEK: {
    id: 'INSANI_YARDIM_VAKIFLARI_DERNEK',
    number: 77,
    parentCategory: 'NGO_ASSOCIATION_FOUNDATION',
    name: 'İnsani Yardım Vakıfları & Sosyal Yardım Dernekleri',
    keywords: ['vakıf', 'dernek', 'insani yardım', 'bağış yap', 'kurban bağışı', 'su kuyusu bağışı', 'yetim projesi', 'sosyal yardım'],
    designTokens: {
      palette: {
        primary: '#059669', // Hope emerald
        secondary: '#064e3b',
        accent: '#d97706',
        bg: '#f0fdf4',
        surface: '#ffffff',
        text: '#064e3b',
        border: '#bbf7d0'
      },
      borderRadius: '16px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'community_trust'
    },
    requiredSections: ['hero_ngo', 'online_donation_card_sms_eft', 'transparency_audit_reports', 'annual_activity_stats', 'volunteer_signup_form', 'lead_form'],
    interactiveTool: {
      type: 'donation_tier_selector',
      title: 'Online Bağış Modülü (Kredi Kartı / SMS / Havale - EFT)',
      subtitle: 'Gıda paketi, eğitim bursu veya su kuyusu hissesi seçerek bağışınızı güvenli ödeme altyapısıyla anında ulaştırın.'
    },
    ctaBehavior: {
      primaryText: 'Şimdi Online Bağış Yap',
      secondaryText: 'Gönüllü Olarak Katıl',
      badge: '🤝 Kamu Yararına Çalışan Vakıf & Şeffaf Bağımsız Denetim Raporları',
      phoneText: 'Vakıf Genel Sekreterliği'
    }
  },

  SANAYI_SITELERI_OSB_ODALAR: {
    id: 'SANAYI_SITELERI_OSB_ODALAR',
    number: 78,
    parentCategory: 'NGO_ASSOCIATION_FOUNDATION',
    name: 'Sanayi Siteleri, OSB (Organize Sanayi Bölgeleri) & Odalar',
    keywords: ['osb', 'organize sanayi bölgesi', 'sanayi sitesi', 'ticaret odası', 'sanayi odası', 'esnaf odası', 'osb rehberi'],
    designTokens: {
      palette: {
        primary: '#1e3a8a', // Institutional blue
        secondary: '#0f172a',
        accent: '#f59e0b',
        bg: '#f8fafc',
        surface: '#ffffff',
        text: '#0f172a',
        border: '#cbd5e1'
      },
      borderRadius: '6px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'community_trust'
    },
    requiredSections: ['hero_osb', 'factory_directory_search', 'utility_outage_announcements', 'board_decisions_bulletin', 'lead_form'],
    interactiveTool: {
      type: 'industrial_zone_directory_search',
      title: 'Bölge Fabrika Fihristi & Faaliyet Alanı Arama Motoru',
      subtitle: 'OSB bünyesinde faaliyet gösteren 250+ üretici firmayı sektörüne ve ada/parsel no bilgisine göre listeleyin.'
    },
    ctaBehavior: {
      primaryText: 'OSB Parsel / Arsa Tahsisi Talebi',
      secondaryText: 'Duyuru ve Kararları Görüntüle',
      badge: '🏭 Yeşil OSB Sertifikalı Modern Altyapı ve Arıtma Tesisleri',
      phoneText: 'OSB Bölge Müdürlüğü'
    }
  },

  MEZUN_DERNEKLERI_MESLEK_BIRLIKLERI: {
    id: 'MEZUN_DERNEKLERI_MESLEK_BIRLIKLERI',
    number: 79,
    parentCategory: 'NGO_ASSOCIATION_FOUNDATION',
    name: 'Mezun Dernekleri & Meslek Birlikleri',
    keywords: ['mezunlar derneği', 'meslek birliği', 'oda kaydı', 'aidat ödeme', 'networking etkinlik', 'burs komisyonu'],
    designTokens: {
      palette: {
        primary: '#4338ca', // Indigo community
        secondary: '#312e81',
        accent: '#f59e0b',
        bg: '#eef2ff',
        surface: '#ffffff',
        text: '#1e1b4b',
        border: '#c7d2fe'
      },
      borderRadius: '12px',
      typography: {
        heading: 'Plus Jakarta Sans',
        body: 'Inter'
      },
      styleTheme: 'community_trust'
    },
    requiredSections: ['hero_alumni', 'member_registration_dues_portal', 'networking_events_calendar', 'scholarship_fund_announcements', 'lead_form'],
    interactiveTool: {
      type: 'alumni_membership_dues_portal',
      title: 'Üye Kayıt & Online Aidat Ödeme / Bağış Portalı',
      subtitle: 'Mezuniyet yılınızı ve sicil numaranızı girerek üyelik durumunuzu sorgulayın, dernek etkinliklerine kaydolun.'
    },
    ctaBehavior: {
      primaryText: 'Derneğe Üye Ol & Aidat Öde',
      secondaryText: 'Etkinlik Takvimini İncele',
      badge: '🎓 Mezunlar Arası Güçlü Dayanışma & Öğrenci Burs Fonu',
      phoneText: 'Dernek Yönetim Masası'
    }
  }
});

/**
 * Helper to fetch a preset by its SubSector ID.
 */
export function getSectorPreset(subSectorId) {
  if (!subSectorId) return null;
  const upper = String(subSectorId).toUpperCase();
  return SubSectorPresets[upper] || null;
}

/**
 * Returns all main categories as an array.
 */
export function getAllCategories() {
  return Object.values(MainCategories);
}

/**
 * Returns all subsector presets as an array.
 */
export function getAllSubSectors() {
  return Object.values(SubSectorPresets);
}

/**
 * Intelligent detector matching any text, industry, company name, services or products
 * against the 80+ sub-sectors with scoring to avoid false positives.
 */
export function detectSectorPreset({ industry = '', companyName = '', services = [], products = [] } = {}) {
  const cleanServices = Array.isArray(services)
    ? services.map(s => (typeof s === 'string' ? s : (s.title || ''))).join(' ')
    : '';
  const cleanProducts = Array.isArray(products)
    ? products.map(p => (typeof p === 'string' ? p : (p.title || ''))).join(' ')
    : '';

  const corpus = `${industry} ${companyName} ${cleanServices} ${cleanProducts}`.toLowerCase();

  let bestMatch = null;
  let highestScore = 0;

  for (const preset of Object.values(SubSectorPresets)) {
    let score = 0;
    for (const kw of preset.keywords) {
      const lowerKw = kw.toLowerCase();
      if (corpus.includes(lowerKw)) {
        // Longer keyword matches earn higher weight
        score += lowerKw.length >= 8 ? 5 : 3;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = preset;
    }
  }

  // Fallback defaults if score is 0
  if (!bestMatch || highestScore === 0) {
    if (corpus.includes('sağlık') || corpus.includes('klinik') || corpus.includes('tedavi')) {
      return SubSectorPresets.DIS_KLINIGI_AGIZ_SAGLIGI;
    }
    if (corpus.includes('inşaat') || corpus.includes('yapı') || corpus.includes('mimarlık')) {
      return SubSectorPresets.MUTEAHHITLIK_BUYUK_KONUT;
    }
    if (corpus.includes('yazılım') || corpus.includes('bilişim') || corpus.includes('kod')) {
      return SubSectorPresets.SAAS_BULUT_YAZILIM;
    }
    if (corpus.includes('enerji') || corpus.includes('solar') || corpus.includes('ges')) {
      return SubSectorPresets.GUNES_ENERJISI_GES_YENILENEBILIR;
    }
    if (corpus.includes('lojistik') || corpus.includes('nakliyat') || corpus.includes('kargo')) {
      return SubSectorPresets.ULUSLARARASI_NAKLIYE_FORWARDING;
    }
    // General corporate consulting fallback
    return SubSectorPresets.HUKUK_BUROLARI_AVUKATLIK;
  }

  return bestMatch;
}
