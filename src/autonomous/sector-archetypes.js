/**
 * ONLUNET ZEKA - Multi-Archetype Sector Layout Engine
 * Generates truly independent, bespoke, top-tier frontends tailored to 13 Main Categories & 80+ Sub-Sectors.
 *
 * Implements Google Stitch UI principles and VoltAgent/awesome-design-md contracts:
 * - 8 distinct layout archetypes (clean_clinical_light, editorial_magazine_sharp, dark_bento_cyber, etc.)
 * - Bespoke sector Hero structures with industry widgets
 * - Metric/Stats cards respecting sector border-radius and tone
 * - Sektöre özel interaktif simülatör ve araç kütüphanesi
 * - Solid header and zero thin-content compliance
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js ESM.
 */

import {
  MainCategories,
  SubSectorPresets,
  getSectorPreset,
  detectSectorPreset
} from './sector-presets.js';

// Legacy compatibility map
export const SectorArchetypes = Object.freeze({
  ENERGY_INDUSTRIAL: {
    id: 'ENERGY_INDUSTRIAL',
    name: 'Endüstriyel Enerji & Akü Teknolojileri',
    badge: '⚡ YÜKSEK VERİMLİ ENDÜSTRİYEL ENERJİ & AKÜ SİSTEMLERİ',
    heroSubtitlePrefix: 'Endüstriyel Akü, Solar GES ve Güç Sistemlerinde Mühendislik Güvencesi',
    accentTheme: 'gold',
    ctaPrimary: 'GES & Akü Teklifi Alın',
    ctaSecondary: 'Ürün Kataloğunu İnceleyin',
    toolTitle: 'Akü Kapasite & Solar Enerji Amortisman Simülatörü',
    toolSubtitle: 'İşletmenizin ihtiyacına uygun akü tipi ve solar kurulum için tahmini yıllık tasarruf ve geri dönüş süresini anlık hesaplayın.'
  },
  LOGISTICS_FREIGHT: {
    id: 'LOGISTICS_FREIGHT',
    name: 'Lojistik & Küresel Tedarik Zinciri',
    badge: '🚢 KÜRESEL LOJİSTİK, NAVLUN & TEDARİK ZİNCİRİ AĞI',
    heroSubtitlePrefix: 'Dünya Standartlarında Hızlı, Güvenli ve Entegre Taşımacılık',
    accentTheme: 'blue',
    ctaPrimary: 'Hemen Navlun Teklifi Alın',
    ctaSecondary: 'Lojistik Rotalarımızı İnceleyin',
    toolTitle: 'Uluslararası & Yurtiçi Navlun ve Taşıma Simülatörü',
    toolSubtitle: 'Kalkış, varış ve yük tipinizi seçerek tahmini transit süresi ve navlun planlamanızı oluşturun.'
  },
  HEALTH_MEDICAL: {
    id: 'HEALTH_MEDICAL',
    name: 'Sağlık, Medikal & Klinik Teknolojileri',
    badge: '⚕️ ULUSLARARASI AKREDİTE SAĞLIK & İLERİ MEDİKAL TEKNOLOJİ',
    heroSubtitlePrefix: 'Hasta Odaklı Yaklaşım, Uzman Hekim Kadrosu ve İleri Tanı Yöntemleri',
    accentTheme: 'emerald',
    ctaPrimary: 'Online Randevu Oluşturun',
    ctaSecondary: 'Tıbbi Branşlarımızı Keşfedin',
    toolTitle: 'Online Randevu & Ön Konsültasyon Belirleme Modülü',
    toolSubtitle: 'Muayene olmak istediğiniz tıbbi branşı seçin, uzman hekim ajandasına anında kaydolun.'
  },
  TECH_SOFTWARE: {
    id: 'TECH_SOFTWARE',
    name: 'Bilişim, Yazılım & Bulut Mimarisi',
    badge: '💻 MODERN BULUT, YAZILIM & SİBER GÜVENLİK TEKNOLOJİLERİ',
    heroSubtitlePrefix: 'Ölçeklenebilir Mikroservisler, Büyük Veri ve Kurumsal Güvenlik',
    accentTheme: 'purple',
    ctaPrimary: 'Proje Başlatın & Demo İsteyin',
    ctaSecondary: 'Teknoloji Yığınımızı İnceleyin',
    toolTitle: 'Bulut & Yazılım Proje Kapsamı ve Mimari Hesaplayıcı',
    toolSubtitle: 'Projenizin türünü ve kullanıcı ölçeğini belirleyin, önerilen altyapı mimarisini anında görüntüleyin.'
  },
  CONSTRUCTION_REAL_ESTATE: {
    id: 'CONSTRUCTION_REAL_ESTATE',
    name: 'İnşaat, Yapı & Mimari Mühendislik',
    badge: '🏗️ DEPREME DAYANIKLI YAPI, PRESTİJ PROJELERİ & TAAHHÜT',
    heroSubtitlePrefix: 'Geleceğin Güvenli Yaşam Alanları ve Modern Sanayi Tesisleri',
    accentTheme: 'crimson',
    ctaPrimary: 'Proje Teklifi İsteyin',
    ctaSecondary: 'Portföyümüzü Görüntüleyin',
    toolTitle: 'İnşaat & Mimari Proje Bütçe ve Takvim Planlayıcı',
    toolSubtitle: 'Yapı sınıfı ve metrekareye göre tahmini inşaat takvimi ve aşama planınızı çıkarın.'
  },
  CORPORATE_CONSULTING: {
    id: 'CORPORATE_CONSULTING',
    name: 'Kurumsal Danışmanlık & Yönetim Çözümleri',
    badge: '🏛️ STRATEJİK YÖNETİM, UYUM & KURUMSAL GÜVEN',
    heroSubtitlePrefix: 'Sürdürülebilir Büyüme ve Stratejik Kararlarda Güvenilir Çözüm Ortağınız',
    accentTheme: 'blue',
    ctaPrimary: 'Danışmanlık Randevusu Alın',
    ctaSecondary: 'Hizmet Alanlarımızı İnceleyin',
    toolTitle: 'Kurumsal İhtiyaç Analizi & Çözüm Planlayıcı',
    toolSubtitle: 'Faaliyet alanınız ve şirket büyüklüğünüze göre kurumsal dönüşüm adımlarını planlayın.'
  },
  PETSHOP_ANIMAL_CARE: {
    id: 'PETSHOP_ANIMAL_CARE',
    name: 'PetShop & Evcil Hayvan Beslenmesi',
    badge: '🐾 PREMİUM EVCİL HAYVAN BESLENMESİ & BAKIM DÜNYASI',
    heroSubtitlePrefix: 'Dostlarınız İçin En Kaliteli Mama, Vitamin ve Bakım Ürünleri',
    accentTheme: 'emerald',
    ctaPrimary: 'Mama & Ürün Siparişi Ver',
    ctaSecondary: 'Mama Kataloğumuzu Keşfedin',
    toolTitle: 'Evcil Hayvan Günlük Mama & Besin İhtiyacı Hesaplayıcı',
    toolSubtitle: 'Kedinizin veya köpeğinizin yaş, ırk ve kısırlaştırma durumunu seçin; önerilen günlük porsiyon ve mama tipini anında öğrenin.'
  }
});

const CategoryToLegacyArchetype = {
  HEALTH_MEDICAL: 'HEALTH_MEDICAL',
  SPORTS_FITNESS_BEAUTY: 'HEALTH_MEDICAL',
  CONSTRUCTION_REAL_ESTATE: 'CONSTRUCTION_REAL_ESTATE',
  HEAVY_INDUSTRY_MANUFACTURING: 'ENERGY_INDUSTRIAL',
  ENERGY_ENVIRONMENT_MINING: 'ENERGY_INDUSTRIAL',
  LOGISTICS_AUTOMOTIVE: 'LOGISTICS_FREIGHT',
  TECH_SOFTWARE: 'TECH_SOFTWARE',
  LAW_FINANCE_CONSULTING: 'CORPORATE_CONSULTING',
  EDUCATION_ACADEMY: 'CORPORATE_CONSULTING',
  TOURISM_HOSPITALITY: 'CORPORATE_CONSULTING',
  AGRICULTURE_FOOD: 'CORPORATE_CONSULTING',
  LOCAL_SERVICES_EMERGENCY: 'CORPORATE_CONSULTING',
  NGO_ASSOCIATION_FOUNDATION: 'CORPORATE_CONSULTING'
};

/**
 * Detects the sector archetype and returns an enriched archetype object
 * referencing the 80+ sub-sectors taxonomy.
 */
export function detectSectorArchetype({ subSectorId = '', industry = '', companyName = '', services = [], products = [] } = {}) {
  const preset = (subSectorId && getSectorPreset(subSectorId)) || detectSectorPreset({ industry, companyName, services, products });

  if (!preset) {
    return SectorArchetypes.CORPORATE_CONSULTING;
  }

  let legacyId = CategoryToLegacyArchetype[preset.parentCategory] || 'CORPORATE_CONSULTING';
  if (preset.id.includes('PET') || preset.id.includes('EVCIL_HAYVAN')) {
    legacyId = 'PETSHOP_ANIMAL_CARE';
  }

  // Pre-configured custom tool titles for key legacy categories
  let toolTitle = preset.interactiveTool?.title || 'Sektörel Çözüm & İhtiyaç Simülatörü';
  let toolSubtitle = preset.interactiveTool?.subtitle || 'İşletmenizin gereksinimlerine göre en verimli çözümü anında planlayın.';

  if (legacyId === 'ENERGY_INDUSTRIAL') {
    toolTitle = 'Akü Kapasite & Solar Enerji Amortisman Simülatörü';
    toolSubtitle = 'İşletmenizin ihtiyacına uygun akü tipi ve solar kurulum için tahmini yıllık tasarruf ve geri dönüş süresini anlık hesaplayın.';
  } else if (legacyId === 'LOGISTICS_FREIGHT') {
    toolTitle = 'Uluslararası & Yurtiçi Navlun ve Taşıma Simülatörü';
    toolSubtitle = 'Kalkış, varış ve yük tipinizi seçerek tahmini transit süresi ve navlun planlamanızı oluşturun.';
  } else if (legacyId === 'PETSHOP_ANIMAL_CARE') {
    toolTitle = 'Evcil Hayvan Günlük Mama & Besin İhtiyacı Hesaplayıcı';
    toolSubtitle = 'Kedinizin veya köpeğinizin yaş, ırk ve kısırlaştırma durumunu seçin; önerilen günlük porsiyon ve mama tipini anında öğrenin.';
  }

  return {
    id: legacyId,
    subSectorId: preset.id,
    presetId: preset.id,
    parentCategory: preset.parentCategory,
    name: preset.name,
    badge: preset.ctaBehavior?.badge || `⚡ ${preset.name.toUpperCase()}`,
    heroSubtitlePrefix: preset.ctaBehavior?.badge || preset.name,
    accentTheme: preset.parentCategory.toLowerCase(),
    ctaPrimary: preset.ctaBehavior?.primaryText || 'Teklif Alın',
    ctaSecondary: preset.ctaBehavior?.secondaryText || 'Kataloğu İnceleyin',
    toolTitle,
    toolSubtitle,
    styleTheme: preset.designTokens?.styleTheme || 'clean_clinical_light',
    designTokens: preset.designTokens,
    requiredSections: preset.requiredSections,
    interactiveTool: preset.interactiveTool,
    ctaBehavior: preset.ctaBehavior,
    preset
  };
}

/**
 * Renders the sector-specific bespoke Hero section according to its styleTheme.
 */
export function renderArchetypeHero({
  archetype,
  companyName,
  slogan,
  description,
  industry = '',
  palette,
  phone = '',
  funfacts = []
}) {
  const theme = archetype.styleTheme || 'clean_clinical_light';
  const borderRadius = archetype.designTokens?.borderRadius || '12px';
  const badgeText = archetype.badge || archetype.name;
  const primaryCta = archetype.ctaPrimary || 'Hemen İletişime Geçin';
  const secondaryCta = archetype.ctaSecondary || 'Hizmetlerimizi İnceleyin';

  // Format clean phone
  const cleanPhone = (phone || '0850 123 45 67').replace(/\s+/g, '');
  const waPhone = cleanPhone.replace(/\D/g, '');

  // 1. BESPOKE ENERGY INDUSTRIAL HERO
  if (archetype.id === 'ENERGY_INDUSTRIAL' || theme === 'eco_engineering') {
    return `
<!-- SEKTÖREL ÖZEL HERO (ARCHETYPE: ENERGY_INDUSTRIAL) -->
<section style="padding: 85px 20px 80px; background: linear-gradient(135deg, #090e17 0%, #0f172a 60%, #1e293b 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.08); position: relative; overflow: hidden;">
  <div style="position: absolute; top: -120px; right: -80px; width: 650px; height: 650px; background: radial-gradient(circle, ${palette.primary}30 0%, transparent 70%); pointer-events: none; z-index: 0;"></div>
  <div class="hero-grid-split" style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1.3fr 0.9fr; gap: 50px; align-items: center; position: relative; z-index: 1;">
    <div style="text-align: left;">
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); border: 1px solid ${palette.primary}40; padding: 7px 18px; border-radius: 9999px; font-size: 0.82rem; color: #fbbf24; margin-bottom: 22px; backdrop-filter: blur(8px);">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${palette.primary}; display: inline-block; box-shadow: 0 0 10px ${palette.primary};"></span>
        <span style="font-weight: 700; letter-spacing: 0.5px;">${badgeText}</span>
      </div>
      <h1 class="hero-title-responsive" style="font-size: clamp(1.85rem, 5vw, 3.1rem); font-weight: 800; line-height: 1.18; margin-bottom: 22px; color: #ffffff !important; letter-spacing: -0.5px; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">
        ${slogan || companyName}
      </h1>
      <p style="font-size: 1.15rem; color: #cbd5e1 !important; line-height: 1.75; margin-bottom: 36px; max-width: 680px; font-weight: 400;">
        ${description}
      </p>
      <div class="hero-cta-group" style="display: flex; gap: 16px; flex-wrap: wrap;">
        <a href="#teklif" style="background: linear-gradient(135deg, ${palette.primary} 0%, #b45309 100%); color: #ffffff !important; padding: 15px 34px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 1rem; box-shadow: 0 6px 20px ${palette.primary}60; display: inline-flex; align-items: center; gap: 8px; transition: transform 0.2s;">
          <span>${primaryCta}</span> &rarr;
        </a>
        <a href="#katalog" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.3); color: #ffffff !important; padding: 15px 30px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 1rem; backdrop-filter: blur(8px);">
          <span>${secondaryCta}</span>
        </a>
      </div>
    </div>
    <div>
      <div style="background: rgba(17, 24, 39, 0.75); border: 1px solid ${palette.primary}30; border-radius: 16px; padding: 26px; backdrop-filter: blur(12px); box-shadow: 0 10px 30px rgba(0,0,0,0.35); text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 14px; margin-bottom: 16px;">
          <span style="font-size: 0.85rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
            <span style="color: ${palette.primary};">⚡</span> Endüstriyel Çözüm Hattı
          </span>
          <span style="font-size: 0.75rem; background: ${palette.primary}20; color: #fbbf24; padding: 3px 8px; border-radius: 4px; font-weight: 600;">CANLI SERVİS</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.88rem;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">Akü & Güç Teknolojisi:</span>
            <strong style="color: #fff;">Traksiyoner / Lityum / Jel</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">Hizmet Bölgesi:</span>
            <strong style="color: #fff;">Trakya & Türkiye Geneli</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">Saha Desteği:</span>
            <strong style="color: #10b981;">7/24 Mobil Akü & GES Servisi</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">Sertifikasyon:</span>
            <strong style="color: #fff;">CE, ISO 9001, TSE Uyumlu</strong>
          </div>
        </div>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; gap: 10px;">
          <a href="https://wa.me/${waPhone}" target="_blank" style="flex: 1; background: #25D366; color: #fff; text-decoration: none; padding: 10px; border-radius: 8px; text-align: center; font-weight: 700; font-size: 0.82rem; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>💬</span> WhatsApp Danışma
          </a>
          <a href="tel:${cleanPhone}" style="background: #1e293b; border: 1px solid #334155; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;">
            📞 Ara
          </a>
        </div>
      </div>
    </div>
  </div>
</section>
    `;
  }

  // 2. BESPOKE LOGISTICS FREIGHT HERO
  if (archetype.id === 'LOGISTICS_FREIGHT' || theme === 'logistics_freight') {
    return `
<!-- SEKTÖREL ÖZEL HERO (ARCHETYPE: LOGISTICS_FREIGHT) -->
<section style="padding: 85px 20px 80px; background: linear-gradient(135deg, #0a1120 0%, #0f1d36 60%, #1e3a5f 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.08); position: relative; overflow: hidden;">
  <div class="hero-grid-split" style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1.3fr 0.9fr; gap: 50px; align-items: center; position: relative; z-index: 1;">
    <div style="text-align: left;">
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(56, 189, 248, 0.1); border: 1px solid #38bdf840; padding: 7px 18px; border-radius: 9999px; font-size: 0.82rem; color: #38bdf8; margin-bottom: 22px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #38bdf8; display: inline-block;"></span>
        <span style="font-weight: 700; letter-spacing: 0.5px;">${badgeText}</span>
      </div>
      <h1 class="hero-title-responsive" style="font-size: clamp(1.85rem, 5vw, 3.1rem); font-weight: 800; line-height: 1.18; margin-bottom: 22px; color: #ffffff !important; letter-spacing: -0.5px;">
        ${slogan || companyName}
      </h1>
      <p style="font-size: 1.15rem; color: #cbd5e1 !important; line-height: 1.75; margin-bottom: 36px; max-width: 680px; font-weight: 400;">
        ${description}
      </p>
      <div class="hero-cta-group" style="display: flex; gap: 16px; flex-wrap: wrap;">
        <a href="#teklif" style="background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #ffffff !important; padding: 15px 34px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 1rem; box-shadow: 0 6px 20px rgba(2,132,199,0.4); display: inline-flex; align-items: center; gap: 8px;">
          <span>${primaryCta}</span> &rarr;
        </a>
        <a href="#katalog" style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.3); color: #ffffff !important; padding: 15px 30px; border-radius: 9999px; text-decoration: none; font-weight: 600; font-size: 1rem;">
          <span>${secondaryCta}</span>
        </a>
      </div>
    </div>
    <div>
      <div style="background: #0f1d36; border: 1px solid #1b3156; border-radius: 16px; padding: 26px; box-shadow: 0 10px 30px rgba(0,0,0,0.35); text-align: left;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1b3156; padding-bottom: 14px; margin-bottom: 16px;">
          <span style="font-size: 0.85rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
            <span style="color: #38bdf8;">🚢</span> Küresel Navlun & Hat Güzergahları
          </span>
          <span style="font-size: 0.75rem; background: rgba(56,189,248,0.2); color: #38bdf8; padding: 3px 8px; border-radius: 4px; font-weight: 600;">AKTİF SEFERLER</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.88rem;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">Taşıma Modu:</span>
            <strong style="color: #fff;">Avrupa Karayolu Hattı & FTL</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">Hizmet Kapsamı:</span>
            <strong style="color: #fff;">İthalat / İhracat & Gümrükleme</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">Takip & Güvenlik:</span>
            <strong style="color: #10b981;">7/24 Canlı GPS & Isı Takibi</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">Sigorta Kapsamı:</span>
            <strong style="color: #fff;">CMR Sigortası & Tam Teminat</strong>
          </div>
        </div>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #1b3156; display: flex; gap: 10px;">
          <a href="https://wa.me/${waPhone}" target="_blank" style="flex: 1; background: #25D366; color: #fff; text-decoration: none; padding: 10px; border-radius: 8px; text-align: center; font-weight: 700; font-size: 0.82rem; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>💬</span> WhatsApp Sefer Hattı
          </a>
          <a href="tel:${cleanPhone}" style="background: #1e293b; border: 1px solid #334155; color: #fff; text-decoration: none; padding: 10px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;">
            📞 Ara
          </a>
        </div>
      </div>
    </div>
  </div>
</section>
    `;
  }

  // 3. EDITORIAL MAGAZINE SHARP (Architecture, Construction, Luxury Real Estate, Tiny House)
  if (theme === 'editorial_magazine_sharp') {
    return `
<!-- SEKTÖREL ÖZEL HERO (ARCHETYPE: ${archetype.id}) -->
<!-- HERO: EDITORIAL MAGAZINE SHARP (Mimarlık & Prestij İnşaat) -->
<section style="background: #0c0a09; color: #fafaf9; padding: 110px 20px 90px; border-bottom: 1px solid #292524; position: relative; overflow: hidden;">
  <div style="max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 60px; align-items: center;" class="hero-grid-split hero-editorial-grid">
    <div>
      <div style="display: inline-block; border-bottom: 2px solid ${palette.primary}; padding-bottom: 6px; font-size: 0.82rem; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #a1a1aa; margin-bottom: 24px;">
        ${badgeText}
      </div>
      <h1 class="hero-title-responsive" style="font-size: clamp(2.4rem, 5vw, 4.0rem); font-weight: 800; line-height: 1.08; letter-spacing: -0.03em; color: #fafaf9; margin-bottom: 24px;">
        ${companyName}
      </h1>
      <p style="font-size: 1.25rem; font-weight: 500; color: #e7e5e4; line-height: 1.5; margin-bottom: 16px;">
        ${slogan || 'Mimari Mükemmellik, Depreme Dayanıklı Taahhüt ve Prestij Yaşam Alanları'}
      </p>
      <p style="font-size: 0.98rem; color: #a8a29e; line-height: 1.7; max-width: 620px; margin-bottom: 36px;">
        ${description}
      </p>

      <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center;">
        <a href="#teklif" style="background: ${palette.primary}; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 0px; font-weight: 800; font-size: 0.95rem; letter-spacing: 0.5px; text-transform: uppercase; display: inline-flex; align-items: center; gap: 8px;">
          <span>📐</span> ${primaryCta}
        </a>
        <a href="#katalog" style="background: transparent; border: 1px solid #78716c; color: #fafaf9 !important; text-decoration: none; padding: 13px 26px; border-radius: 0px; font-weight: 700; font-size: 0.92rem; letter-spacing: 0.5px; text-transform: uppercase;">
          ${secondaryCta}
        </a>
      </div>
    </div>

    <!-- Editorial Project Specs Card -->
    <div style="background: #1c1917; border: 1px solid #44403c; border-radius: 0px; padding: 36px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
      <div style="border-bottom: 1px solid #292524; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 0.85rem; font-weight: 800; letter-spacing: 1px; color: ${palette.accent || '#d97706'}; text-transform: uppercase;">PROJE KÜNYESİ</span>
        <span style="font-size: 0.75rem; background: #292524; color: #d6d3d1; padding: 4px 10px; font-weight: 700;">2026 EDİTÖR SEÇKİSİ</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px; font-size: 0.9rem;">
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #292524; padding-bottom: 10px;">
          <span style="color: #a8a29e;">Yapı Tipi:</span>
          <strong style="color: #fafaf9;">Rezidans, Villa & Lüks Yaşam</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #292524; padding-bottom: 10px;">
          <span style="color: #a8a29e;">Mühendislik Sınıfı:</span>
          <strong style="color: #10b981;">C35/40 Deprem Güvenlikli</strong>
        </div>
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #292524; padding-bottom: 10px;">
          <span style="color: #a8a29e;">Mimarî Konsept:</span>
          <strong style="color: #fafaf9;">Biyofilik & Modernist Minimalizm</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #a8a29e;">Teslim Garantisi:</span>
          <strong style="color: #fafaf9;">Sözleşmeli Anahtar Teslim</strong>
        </div>
      </div>

      <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #292524; display: flex; flex-direction: column; gap: 10px;">
        <a href="https://wa.me/${waPhone}?text=Merhaba,%20mimari%20proje%20ve%20portföy%20hakkında%20bilgi%20almak%20istiyorum." target="_blank" style="background: #25D366; color: #fff !important; text-decoration: none; padding: 12px; font-weight: 800; font-size: 0.9rem; text-align: center; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>💬</span> WhatsApp ile Lookbook / Katalog İste
        </a>
        <a href="tel:${cleanPhone}" style="background: #292524; color: #e7e5e4 !important; text-decoration: none; padding: 11px; font-size: 0.88rem; font-weight: 700; text-align: center;">
          📞 Satış Ofisi: ${phone || '0850 123 45 67'}
        </a>
      </div>
    </div>
  </div>
</section>
    `;
  }

  // 4. DARK BENTO CYBER (SaaS, Cyber Security, Cloud, IT, Agency, Gaming)
  if (theme === 'dark_bento_cyber') {
    return `
<!-- SEKTÖREL ÖZEL HERO (ARCHETYPE: ${archetype.id}) -->
<!-- HERO: DARK BENTO CYBER (SaaS & Teknoloji) -->
<section style="background: #07090e; color: #f8fafc; padding: 110px 20px 90px; border-bottom: 1px solid rgba(255,255,255,0.08); position: relative; overflow: hidden;">
  <div style="max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 50px; align-items: center;" class="hero-grid-split hero-bento-grid">
    <div>
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); padding: 7px 18px; border-radius: 9999px; font-size: 0.82rem; color: #a5b4fc; margin-bottom: 24px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #6366f1; box-shadow: 0 0 10px #6366f1;"></span>
        <span style="font-weight: 700; letter-spacing: 0.5px;">${badgeText}</span>
      </div>
      <h1 class="hero-title-responsive" style="font-size: clamp(2.4rem, 5vw, 3.8rem); font-weight: 900; line-height: 1.12; letter-spacing: -0.03em; color: #f8fafc; margin-bottom: 20px;">
        ${companyName}
      </h1>
      <p style="font-size: 1.25rem; font-weight: 600; color: #cbd5e1; line-height: 1.45; margin-bottom: 16px;">
        ${slogan || 'Yeni Nesil Bulut Mimarisi, Büyük Veri ve Yüksek Hızlı API Entegrasyonu'}
      </p>
      <p style="font-size: 0.98rem; color: #94a3b8; line-height: 1.7; max-width: 600px; margin-bottom: 34px;">
        ${description}
      </p>

      <div style="display: flex; gap: 14px; flex-wrap: wrap;">
        <a href="#teklif" style="background: linear-gradient(135deg, ${palette.primary} 0%, #4f46e5 100%); color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 800; font-size: 0.95rem; box-shadow: 0 4px 20px rgba(99,102,241,0.4); display: inline-flex; align-items: center; gap: 8px;">
          <span>⚡</span> ${primaryCta}
        </a>
        <a href="#katalog" style="background: #111622; border: 1px solid rgba(255,255,255,0.12); color: #f8fafc !important; text-decoration: none; padding: 13px 24px; border-radius: 10px; font-weight: 700; font-size: 0.92rem;">
          ${secondaryCta}
        </a>
      </div>
    </div>

    <!-- Interactive Bento Telemetry Card -->
    <div style="background: #0d111a; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 30px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.7); display: flex; flex-direction: column; gap: 18px;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 14px;">
        <div style="display: flex; gap: 6px;">
          <span style="width: 11px; height: 11px; border-radius: 50%; background: #ef4444;"></span>
          <span style="width: 11px; height: 11px; border-radius: 50%; background: #f59e0b;"></span>
          <span style="width: 11px; height: 11px; border-radius: 50%; background: #10b981;"></span>
        </div>
        <span style="font-size: 0.75rem; color: #10b981; font-family: monospace; font-weight: 700;">● ALL SYSTEMS OPERATIONAL</span>
      </div>

      <div style="font-family: monospace; font-size: 0.85rem; background: #07090e; border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 16px; color: #cbd5e1; line-height: 1.6;">
        <span style="color: #6366f1;">$</span> curl -X POST https://api.${companyName.toLowerCase().replace(/\s+/g, '')}.com/v1/deploy<br>
        <span style="color: #10b981;">✔ Status: 200 OK</span> [latency: 12ms]<br>
        <span style="color: #94a3b8;">Uptime: 99.99% | SLA Tier-III Enterprise</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.82rem;">
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 12px; border-radius: 8px;">
          <div style="color: #94a3b8; font-size: 0.75rem;">MİKROSERVİS</div>
          <div style="color: #f8fafc; font-weight: 800; font-size: 1.1rem;">Kubernetes & Edge</div>
        </div>
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 12px; border-radius: 8px;">
          <div style="color: #94a3b8; font-size: 0.75rem;">GÜVENLİK</div>
          <div style="color: #38bdf8; font-weight: 800; font-size: 1.1rem;">ISO 27001 / KVKK</div>
        </div>
      </div>
    </div>
  </div>
</section>
    `;
  }

  // 5. MOBILE FIRST DISPATCH (Yerel Hizmetler, Çilingir, Kombi, Böcek İlaçlama, Asansör, Nakliyat)
  if (theme === 'mobile_first_dispatch') {
    return `
<!-- SEKTÖREL ÖZEL HERO (ARCHETYPE: ${archetype.id}) -->
<!-- HERO: MOBILE FIRST DISPATCH (Acil Yerel Hizmetler & Çilingir/Kombi) -->
<section style="background: #0f172a; color: #f8fafc; padding: 90px 20px 70px; border-bottom: 1px solid #1e293b;">
  <div style="max-width: 1100px; margin: 0 auto; text-align: center;" class="hero-grid-split hero-dispatch-grid">
    <div style="display: inline-flex; align-items: center; gap: 8px; background: #dc2626; color: #ffffff; padding: 7px 20px; border-radius: 9999px; font-size: 0.85rem; font-weight: 800; margin-bottom: 24px; box-shadow: 0 4px 14px rgba(220,38,38,0.4);">
      <span>🚨</span> 7/24 NÖBETÇİ ACİL SERVİS • 15-30 DAKİKADA KAPINIZDA
    </div>

    <h1 class="hero-title-responsive" style="font-size: clamp(2.2rem, 5vw, 3.8rem); font-weight: 900; line-height: 1.15; color: #ffffff; margin-bottom: 18px;">
      ${companyName}
    </h1>
    <p style="font-size: 1.2rem; font-weight: 600; color: #94a3b8; max-width: 750px; margin: 0 auto 30px; line-height: 1.5;">
      ${slogan || 'En Yakın Yetkili Ekip Anında Konumunuza Sevk Edilir. Orijinal Parça & Sabit Fiyat Garantisi.'}
    </p>

    <!-- Giant Call-To-Action Box -->
    <div style="max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 14px;">
      <a href="tel:${cleanPhone}" style="background: #dc2626; color: #ffffff !important; text-decoration: none; padding: 20px; border-radius: 14px; font-size: 1.35rem; font-weight: 900; box-shadow: 0 10px 30px rgba(220,38,38,0.5); display: flex; align-items: center; justify-content: center; gap: 12px; letter-spacing: 0.5px;">
        <span>📞</span> TIKLA & HEMEN ARA: ${phone || '0850 123 45 67'}
      </a>
      <a href="https://wa.me/${waPhone}?text=Acil%20servis%20ve%20usta%20çağırmak%20istiyorum.%20Konumum:" target="_blank" style="background: #25D366; color: #ffffff !important; text-decoration: none; padding: 16px; border-radius: 14px; font-size: 1.1rem; font-weight: 800; box-shadow: 0 6px 20px rgba(37,211,102,0.4); display: flex; align-items: center; justify-content: center; gap: 10px;">
        <span>💬</span> WhatsApp ile Anlık Konum Gönder
      </a>
    </div>

    <div style="margin-top: 36px; display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; color: #cbd5e1; font-size: 0.9rem; font-weight: 600;">
      <span>✔ Hasarsız Müdahale</span>
      <span>✔ 1 Yıl Resmi Garanti</span>
      <span>✔ Sabıka Kaydı Kontrollü Usta Kadrosu</span>
      <span>✔ Kredi Kartı ile Kapıda Ödeme</span>
    </div>
  </div>
</section>
    `;
  }

  // 6. BESPOKE PETSHOP & EVCİL HAYVAN HERO (warm_artisan_organic / PETSHOP_ANIMAL_CARE)
  const isPetshop = archetype.id === 'PETSHOP_ANIMAL_CARE' || 
                    archetype.subSectorId === 'PETSHOP_EVCIL_HAYVAN' || 
                    (industry && /pet|mama|kedi|k\u00f6pek/i.test(industry)) || 
                    (companyName && /pet|mama|kedi|k\u00f6pek/i.test(companyName));

  if (isPetshop) {
    return `
<!-- SEKT\u00d6REL \u00d6ZEL HERO (ARCHETYPE: ${archetype.id}) -->
<!-- HERO: PETSHOP & EVC\u0130L HAYVAN (Pati D\u00fcnyas\u0131 & Beslenme) -->
<section style="background: linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%); color: #064e3b; padding: 95px 20px 80px; border-bottom: 1px solid #bbf7d0; position: relative;">
  <div style="max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: 1.18fr 0.82fr; gap: 50px; align-items: center;" class="hero-grid-split hero-petshop-grid">
    <div>
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(5, 150, 105, 0.1); border: 1px solid rgba(5, 150, 105, 0.25); padding: 7px 18px; border-radius: 9999px; font-size: 0.82rem; color: #059669; margin-bottom: 24px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #059669; box-shadow: 0 0 8px #059669;"></span>
        <span style="font-weight: 800; letter-spacing: 0.5px;">${badgeText}</span>
      </div>
      <h1 class="hero-title-responsive" style="font-size: clamp(2.3rem, 5vw, 3.8rem); font-weight: 900; line-height: 1.15; letter-spacing: -0.02em; color: #064e3b; margin-bottom: 20px;">
        ${companyName}
      </h1>
      <p style="font-size: 1.25rem; font-weight: 700; color: #047857; line-height: 1.45; margin-bottom: 16px;">
        ${slogan || "Google'da \u2b50 5 Puan ve 69+ Memnun M\u00fc\u015fteri ile G\u00fcvenilir \u00c7\u00f6z\u00fcm Orta\u011f\u0131n\u0131z"}
      </p>
      <p style="font-size: 0.98rem; color: #374151; line-height: 1.7; max-width: 620px; margin-bottom: 34px;">
        ${description}
      </p>

      <div style="display: flex; gap: 14px; flex-wrap: wrap;">
        <a href="#teklif" style="background: #059669; color: #ffffff !important; text-decoration: none; padding: 15px 30px; border-radius: 16px; font-weight: 800; font-size: 0.98rem; box-shadow: 0 6px 20px rgba(5,150,105,0.35); display: inline-flex; align-items: center; gap: 8px;">
          <span>\ud83d\udef5</span> ${primaryCta}
        </a>
        <a href="#katalog" style="background: #ffffff; border: 1.5px solid #a7f3d0; color: #064e3b !important; text-decoration: none; padding: 14px 26px; border-radius: 16px; font-weight: 700; font-size: 0.95rem;">
          <span>\ud83d\udc3e</span> ${secondaryCta}
        </a>
      </div>
    </div>

    <!-- PetShop Fast Order & Delivery Trust Card -->
    <div style="background: #ffffff; border: 1.5px solid #bbf7d0; border-radius: 20px; padding: 32px; box-shadow: 0 20px 45px -15px rgba(5,150,105,0.12);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f0fdf4; padding-bottom: 14px; margin-bottom: 18px;">
        <span style="font-size: 0.95rem; font-weight: 800; color: #064e3b; display: flex; align-items: center; gap: 8px;">
          <span>\ud83d\udc3e</span> H\u0131zl\u0131 Sipari\u015f & Kap\u0131ya Teslimat
        </span>
        <span style="font-size: 0.72rem; background: #dcfce7; color: #15803d; padding: 4px 10px; border-radius: 9999px; font-weight: 800;">AYNI G\u00dcN KURYE</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.88rem; color: #374151;">
        <div style="display: flex; justify-content: space-between;">
          <span>Garantili Markalar:</span>
          <strong style="color: #064e3b;">Royal Canin, Pro Plan, N&D, Hills</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>H\u0131zl\u0131 Teslimat:</span>
          <strong style="color: #059669;">Bal\u0131kesir \u0130\u00e7i Ayn\u0131 G\u00fcn Kap\u0131da</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>A\u011f\u0131r Paket Deste\u011fi:</span>
          <strong style="color: #064e3b;">10-15 kg Mama & Kumlar\u0131 Ta\u015f\u0131ma</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Beslenme Dan\u0131\u015fmanl\u0131\u011f\u0131:</span>
          <strong style="color: #d97706;">\u00dccretsiz Irk & Porsiyon Tavsiyesi</strong>
        </div>
      </div>

      <div style="margin-top: 22px; padding-top: 18px; border-top: 1px solid #f0fdf4; display: flex; flex-direction: column; gap: 10px;">
        <a href="https://wa.me/${waPhone}?text=Merhaba,%20h%C4%B1zl%C4%B1%20mama%20ve%20kum%20sipari%C5%9Fi%20vermek%20istiyorum." target="_blank" style="background: #25D366; color: #ffffff !important; text-decoration: none; padding: 13px; border-radius: 12px; text-align: center; font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(37,211,102,0.35);">
          <span>\ud83d\udcac</span> WhatsApp ile Mama / Kum Sipari\u015f Ver
        </a>
        <a href="tel:${cleanPhone}" style="background: #f0fdf4; border: 1px solid #bbf7d0; color: #064e3b !important; text-decoration: none; padding: 11px; border-radius: 12px; font-size: 0.88rem; font-weight: 700; text-align: center;">
          \ud83d\udcde Ma\u011faza & Kurye Hatt\u0131: ${phone || '0542 734 48 10'}
        </a>
      </div>
    </div>
  </div>
</section>
    `;
  }

  // 7. WARM ARTISAN ORGANIC HERO (Tar\u0131m, G\u0131da Fabrikas\u0131, Tohum, Zeytinya\u011f\u0131)
  if (theme === 'warm_artisan_organic') {
    return `
<!-- SEKT\u00d6REL \u00d6ZEL HERO (ARCHETYPE: ${archetype.id}) -->
<!-- HERO: WARM ARTISAN ORGANIC (Tar\u0131m & G\u0131da \u0130malat\u0131) -->
<section style="background: linear-gradient(180deg, #fefce8 0%, #ffffff 100%); color: #451a03; padding: 95px 20px 80px; border-bottom: 1px solid #fef08a; position: relative;">
  <div style="max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: 1.18fr 0.82fr; gap: 50px; align-items: center;" class="hero-grid-split hero-artisan-grid">
    <div>
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(180, 83, 9, 0.1); border: 1px solid rgba(180, 83, 9, 0.25); padding: 7px 18px; border-radius: 9999px; font-size: 0.82rem; color: #b45309; margin-bottom: 24px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #b45309;"></span>
        <span style="font-weight: 800; letter-spacing: 0.5px;">${badgeText}</span>
      </div>
      <h1 class="hero-title-responsive" style="font-size: clamp(2.3rem, 5vw, 3.8rem); font-weight: 900; line-height: 1.15; letter-spacing: -0.02em; color: #451a03; margin-bottom: 20px;">
        ${companyName}
      </h1>
      <p style="font-size: 1.25rem; font-weight: 700; color: #78350f; line-height: 1.45; margin-bottom: 16px;">
        ${slogan || 'Do\u011fal \u00dcretim, Tarladan Sofraya Tazelik ve Y\u00fcksek Besin De\u011feri'}
      </p>
      <p style="font-size: 0.98rem; color: #57534e; line-height: 1.7; max-width: 620px; margin-bottom: 34px;">
        ${description}
      </p>
      <div style="display: flex; gap: 14px; flex-wrap: wrap;">
        <a href="#teklif" style="background: #b45309; color: #ffffff !important; text-decoration: none; padding: 15px 30px; border-radius: 12px; font-weight: 800; font-size: 0.98rem; box-shadow: 0 6px 20px rgba(180,83,9,0.3); display: inline-flex; align-items: center; gap: 8px;">
          <span>\ud83c\udf3e</span> ${primaryCta}
        </a>
        <a href="#katalog" style="background: #ffffff; border: 1.5px solid #fde047; color: #451a03 !important; text-decoration: none; padding: 14px 26px; border-radius: 12px; font-weight: 700; font-size: 0.95rem;">
          ${secondaryCta}
        </a>
      </div>
    </div>
    <div style="background: #ffffff; border: 1.5px solid #fef08a; border-radius: 16px; padding: 32px; box-shadow: 0 20px 45px -15px rgba(180,83,9,0.1);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #fef9c3; padding-bottom: 14px; margin-bottom: 18px;">
        <span style="font-size: 0.95rem; font-weight: 800; color: #451a03;">\ud83c\udf3e \u00dcretim & Toptan Sevkiyat Masas\u0131</span>
        <span style="font-size: 0.72rem; background: #fef08a; color: #854d0e; padding: 4px 10px; border-radius: 9999px; font-weight: 800;">BRCGS & HELAL</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.88rem; color: #57534e;">
        <div style="display: flex; justify-content: space-between;"><span>Tesis Kapasitesi:</span><strong style="color: #451a03;">G\u00fcnl\u00fck 50+ Ton \u0130\u015fleme</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>So\u011fuk Zincir:</span><strong style="color: #15803d;">+4\u00b0C \u0130klimlendirmeli Lojistik</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>Toptan & \u0130hracat:</span><strong style="color: #451a03;">Palet & Konteyner Bazl\u0131</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>Analiz Raporu:</span><strong style="color: #b45309;">Akredite Laboratuvar Onayl\u0131</strong></div>
      </div>
      <div style="margin-top: 22px; padding-top: 18px; border-top: 1px solid #fef9c3; display: flex; flex-direction: column; gap: 10px;">
        <a href="https://wa.me/${waPhone}" target="_blank" style="background: #25D366; color: #ffffff !important; text-decoration: none; padding: 13px; border-radius: 10px; text-align: center; font-weight: 800; font-size: 0.95rem; display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span>\ud83d\udcac</span> Toptan Fiyat Listesi \u0130ste
        </a>
        <a href="tel:${cleanPhone}" style="background: #fefce8; border: 1px solid #fef08a; color: #451a03 !important; text-decoration: none; padding: 11px; border-radius: 10px; font-size: 0.88rem; font-weight: 700; text-align: center;">
          \ud83d\udcde Sat\u0131\u015f Koordinasyon: ${phone || '0850 123 45 67'}
        </a>
      </div>
    </div>
  </div>
</section>
    `;
  }

  // 8. AUTHORITATIVE CLASSIC HERO (Hukuk, Finans, Mali M\u00fc\u015favirlik, Denetim)
  if (theme === 'authoritative_classic') {
    return `
<!-- SEKT\u00d6REL \u00d6ZEL HERO (ARCHETYPE: ${archetype.id}) -->
<!-- HERO: AUTHORITATIVE CLASSIC (Hukuk & Finansal Dan\u0131\u015fmanl\u0131k) -->
<section style="background: #0f172a; color: #f8fafc; padding: 100px 20px 85px; border-bottom: 1px solid #1e293b; position: relative;">
  <div style="max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 50px; align-items: center;" class="hero-grid-split hero-classic-grid">
    <div>
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(217, 119, 6, 0.12); border: 1px solid rgba(217, 119, 6, 0.3); padding: 7px 18px; border-radius: 9999px; font-size: 0.82rem; color: #fbbf24; margin-bottom: 24px;">
        <span style="font-weight: 800; letter-spacing: 0.5px;">${badgeText}</span>
      </div>
      <h1 class="hero-title-responsive" style="font-size: clamp(2.3rem, 5vw, 3.8rem); font-weight: 800; line-height: 1.15; color: #ffffff; margin-bottom: 20px;">
        ${companyName}
      </h1>
      <p style="font-size: 1.25rem; font-weight: 600; color: #cbd5e1; line-height: 1.45; margin-bottom: 16px;">
        ${slogan || 'Stratejik Hukuki Dan\u0131\u015fmanl\u0131k, Finansal G\u00fcven ve Kurumsal \u00c7\u00f6z\u00fcm Ortakl\u0131\u011f\u0131'}
      </p>
      <p style="font-size: 0.98rem; color: #94a3b8; line-height: 1.7; max-width: 620px; margin-bottom: 34px;">
        ${description}
      </p>
      <div style="display: flex; gap: 14px; flex-wrap: wrap;">
        <a href="#teklif" style="background: #d97706; color: #ffffff !important; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: 800; font-size: 0.98rem; box-shadow: 0 6px 20px rgba(217,119,6,0.35);">
          <span>\u2696\ufe0f</span> ${primaryCta}
        </a>
        <a href="#katalog" style="background: transparent; border: 1px solid #475569; color: #ffffff !important; text-decoration: none; padding: 14px 26px; border-radius: 6px; font-weight: 700; font-size: 0.95rem;">
          ${secondaryCta}
        </a>
      </div>
    </div>
    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; box-shadow: 0 20px 45px rgba(0,0,0,0.4);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 14px; margin-bottom: 18px;">
        <span style="font-size: 0.95rem; font-weight: 800; color: #fbbf24;">\u2696\ufe0f M\u00fcvekkil Dan\u0131\u015fma Masas\u0131</span>
        <span style="font-size: 0.72rem; background: rgba(217,119,6,0.2); color: #fbbf24; padding: 4px 10px; border-radius: 4px; font-weight: 800;">G\u0130ZL\u0130L\u0130K & ET\u0130K</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.88rem; color: #cbd5e1;">
        <div style="display: flex; justify-content: space-between;"><span>K\u0131demli Kadro:</span><strong style="color: #ffffff;">Baro / T\u00dcRMOB Kay\u0131tl\u0131</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>Uyum G\u00fcvencesi:</span><strong style="color: #10b981;">KVKK & Ticaret Kanunu</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>S\u00f6zle\u015fme T\u00fcr\u00fc:</span><strong style="color: #ffffff;">Gizlilik S\u00f6zle\u015fmesi (NDA)</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>Dan\u0131\u015fmanl\u0131k:</span><strong style="color: #fbbf24;">Online / Y\u00fcz Y\u00fcze Randevu</strong></div>
      </div>
      <div style="margin-top: 22px; padding-top: 18px; border-top: 1px solid #334155; display: flex; flex-direction: column; gap: 10px;">
        <a href="https://wa.me/${waPhone}" target="_blank" style="background: #25D366; color: #ffffff !important; text-decoration: none; padding: 13px; border-radius: 6px; text-align: center; font-weight: 800; font-size: 0.95rem;">
          \ud83d\udcac \u00d6n Dan\u0131\u015fmanl\u0131k Randevusu Al
        </a>
        <a href="tel:${cleanPhone}" style="background: #0f172a; border: 1px solid #334155; color: #ffffff !important; text-decoration: none; padding: 11px; border-radius: 6px; font-size: 0.88rem; font-weight: 700; text-align: center;">
          \ud83d\udcde Santral: ${phone || '0850 123 45 67'}
        </a>
      </div>
    </div>
  </div>
</section>
    `;
  }

  // 9. TECHNICAL INDUSTRIAL DATA HERO (A\u011f\u0131r Sanayi, \u0130malat, Tala\u015fl\u0131, Pano, Trafo)
  if (theme === 'technical_industrial_data') {
    return `
<!-- SEKT\u00d6REL \u00d6ZEL HERO (ARCHETYPE: ${archetype.id}) -->
<!-- HERO: TECHNICAL INDUSTRIAL DATA (Sanayi & B2B \u0130malat) -->
<section style="background: #0b0f19; color: #f8fafc; padding: 95px 20px 80px; border-bottom: 1px solid #1e293b; position: relative;">
  <div style="max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 50px; align-items: center;" class="hero-grid-split hero-industrial-grid">
    <div>
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(14, 165, 233, 0.12); border: 1px solid rgba(14, 165, 233, 0.3); padding: 7px 18px; border-radius: 4px; font-size: 0.82rem; color: #38bdf8; margin-bottom: 24px;">
        <span style="font-weight: 800; letter-spacing: 0.5px;">${badgeText}</span>
      </div>
      <h1 class="hero-title-responsive" style="font-size: clamp(2.3rem, 5vw, 3.8rem); font-weight: 900; line-height: 1.15; color: #ffffff; margin-bottom: 20px;">
        ${companyName}
      </h1>
      <p style="font-size: 1.25rem; font-weight: 600; color: #cbd5e1; line-height: 1.45; margin-bottom: 16px;">
        ${slogan || 'Y\u00fcksek Hassasiyetli \u0130malat, End\u00fcstriyel Standartlar ve Seri \u00dcretim G\u00fcvenilirli\u011fi'}
      </p>
      <p style="font-size: 0.98rem; color: #94a3b8; line-height: 1.7; max-width: 620px; margin-bottom: 34px;">
        ${description}
      </p>
      <div style="display: flex; gap: 14px; flex-wrap: wrap;">
        <a href="#teklif" style="background: #0284c7; color: #ffffff !important; text-decoration: none; padding: 15px 30px; border-radius: 4px; font-weight: 800; font-size: 0.98rem; box-shadow: 0 6px 20px rgba(2,132,199,0.35);">
          <span>\u2699\ufe0f</span> ${primaryCta}
        </a>
        <a href="#katalog" style="background: transparent; border: 1px solid #475569; color: #ffffff !important; text-decoration: none; padding: 14px 26px; border-radius: 4px; font-weight: 700; font-size: 0.95rem;">
          ${secondaryCta}
        </a>
      </div>
    </div>
    <div style="background: #111827; border: 1px solid #374151; border-radius: 8px; padding: 32px; box-shadow: 0 20px 45px rgba(0,0,0,0.5);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #374151; padding-bottom: 14px; margin-bottom: 18px;">
        <span style="font-size: 0.95rem; font-weight: 800; color: #38bdf8;">\u2699\ufe0f B2B Teknik \u015eartname & Ke\u015fif</span>
        <span style="font-size: 0.72rem; background: rgba(56,189,248,0.2); color: #38bdf8; padding: 4px 10px; border-radius: 4px; font-weight: 800;">ISO 9001:2015</span>
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.88rem; color: #cbd5e1;">
        <div style="display: flex; justify-content: space-between;"><span>Hassasiyet Tolerans\u0131:</span><strong style="color: #ffffff;">\u00b10.005 mm CNC Mikron</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>Sertifikasyon:</span><strong style="color: #10b981;">3.1 Malzeme Test Belgesi</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>\u00dcretim Modeli:</span><strong style="color: #ffffff;">Seri \u00dcretim & Fason \u0130malat</strong></div>
        <div style="display: flex; justify-content: space-between;"><span>Fizibilite:</span><strong style="color: #38bdf8;">24 Saatte Teknik Teklif</strong></div>
      </div>
      <div style="margin-top: 22px; padding-top: 18px; border-top: 1px solid #374151; display: flex; flex-direction: column; gap: 10px;">
        <a href="https://wa.me/${waPhone}" target="_blank" style="background: #25D366; color: #ffffff !important; text-decoration: none; padding: 13px; border-radius: 4px; text-align: center; font-weight: 800; font-size: 0.95rem;">
          \ud83d\udcac Teknik \u00c7izim / CAD Dosyas\u0131 G\u00f6nder
        </a>
        <a href="tel:${cleanPhone}" style="background: #1f2937; border: 1px solid #374151; color: #ffffff !important; text-decoration: none; padding: 11px; border-radius: 4px; font-size: 0.88rem; font-weight: 700; text-align: center;">
          \ud83d\udcde M\u00fchendislik Masas\u0131: ${phone || '0850 123 45 67'}
        </a>
      </div>
    </div>
  </div>
</section>
    `;
  }

  // 10. CLEAN CLINICAL LIGHT (Health, Dental, Physiotherapy, Dietitian, Vet, Medical Device, Default)
  return `
<!-- SEKTÖREL ÖZEL HERO (ARCHETYPE: ${archetype.id}) -->
<!-- HERO: CLEAN CLINICAL LIGHT (Sağlık & Medikal) -->
<section style="background: #f8fafc; color: #0f172a; padding: 95px 20px 80px; border-bottom: 1px solid #e2e8f0; position: relative;">
  <div style="max-width: 1240px; margin: 0 auto; display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 50px; align-items: center;" class="hero-grid-split hero-clinical-grid">
    <div>
      <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.25); padding: 7px 18px; border-radius: 9999px; font-size: 0.82rem; color: #0284c7; margin-bottom: 24px;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: #0ea5e9; box-shadow: 0 0 8px #0ea5e9;"></span>
        <span style="font-weight: 800; letter-spacing: 0.5px;">${badgeText}</span>
      </div>
      <h1 class="hero-title-responsive" style="font-size: clamp(2.3rem, 5vw, 3.8rem); font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; color: #0f172a; margin-bottom: 20px;">
        ${companyName}
      </h1>
      <p style="font-size: 1.25rem; font-weight: 600; color: #334155; line-height: 1.45; margin-bottom: 16px;">
        ${slogan || 'Hasta Odaklı Yaklaşım, Uzman Hekim Kadrosu ve İleri Tanı Yöntemleri'}
      </p>
      <p style="font-size: 0.98rem; color: #64748b; line-height: 1.7; max-width: 620px; margin-bottom: 34px;">
        ${description}
      </p>

      <div style="display: flex; gap: 14px; flex-wrap: wrap;">
        <a href="#teklif" style="background: ${palette.primary}; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: ${borderRadius}; font-weight: 800; font-size: 0.95rem; box-shadow: 0 4px 18px ${palette.primary}40; display: inline-flex; align-items: center; gap: 8px;">
          <span>📅</span> ${primaryCta}
        </a>
        <a href="#katalog" style="background: #ffffff; border: 1px solid #cbd5e1; color: #0f172a !important; text-decoration: none; padding: 13px 24px; border-radius: ${borderRadius}; font-weight: 700; font-size: 0.92rem;">
          ${secondaryCta}
        </a>
      </div>
    </div>

    <!-- Clinical Doctor & Trust Card -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: ${borderRadius}; padding: 32px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.07);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 18px;">
        <span style="font-size: 0.95rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px;">
          <span>⚕️</span> Klinik Ön Konsültasyon Hattı
        </span>
        <span style="font-size: 0.72rem; background: #ecfdf5; color: #047857; padding: 4px 10px; border-radius: 9999px; font-weight: 700;">RANDEVU AKTİF</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.88rem; color: #475569;">
        <div style="display: flex; justify-content: space-between;">
          <span>Çalışma Saatleri:</span>
          <strong style="color: #0f172a;">Pzt - Cmt: 09:00 - 19:00</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Sağlık Turizmi:</span>
          <strong style="color: #0284c7;">VIP Havalimanı & Otel Transferi</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Akreditasyon:</span>
          <strong style="color: #10b981;">T.C. Sağlık Bakanlığı Onaylı</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>Dijital Görüntüleme:</span>
          <strong style="color: #0f172a;">3D Tomografi & Ağız İçi Tarama</strong>
        </div>
      </div>

      <div style="margin-top: 22px; padding-top: 18px; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 10px;">
        <a href="https://wa.me/${waPhone}?text=Merhaba,%20ön%20konsültasyon%20ve%20randevu%20için%20bilgi%20almak%20istiyorum." target="_blank" style="background: #25D366; color: #ffffff !important; text-decoration: none; padding: 12px; border-radius: 10px; text-align: center; font-weight: 800; font-size: 0.92rem; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(37,211,102,0.3);">
          <span>💬</span> WhatsApp ile Röntgen / Bilgi Gönder
        </a>
        <a href="tel:${cleanPhone}" style="background: #f8fafc; border: 1px solid #cbd5e1; color: #334155 !important; text-decoration: none; padding: 11px; border-radius: 10px; font-size: 0.88rem; font-weight: 700; text-align: center;">
          📞 Klinik Santrali: ${phone || '0850 123 45 67'}
        </a>
      </div>
    </div>
  </div>
</section>
  `;
}

/**
 * Renders stats / telemetry strip tailored to the archetype.
 */
export function renderArchetypeStats({ archetype, funfacts = [], palette }) {
  const borderRadius = archetype.designTokens?.borderRadius || '12px';
  const isDark = archetype.styleTheme === 'dark_bento_cyber' || archetype.styleTheme === 'editorial_magazine_sharp';

  const defaultFacts = [
    { number: '15+', label: 'Yıllık Sektörel Tecrübe' },
    { number: '10.000+', label: 'Mutlu Müşteri Portföyü' },
    { number: '%100', label: 'Kurumsal Kalite Güvencesi' },
    { number: '7/24', label: 'Kesintisiz Destek & İletişim' }
  ];

  const items = Array.isArray(funfacts) && funfacts.length > 0 ? funfacts : defaultFacts;

  return `
<!-- METRİK & GÜVEN GÖSTERGELERİ -->
<section style="background: ${isDark ? '#111622' : '#ffffff'}; padding: 48px 20px; border-bottom: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'};">
  <div style="max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 24px;">
    ${items.slice(0, 4).map(f => `
      <div style="background: ${isDark ? '#0d111a' : '#f8fafc'}; border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}; border-radius: ${borderRadius}; padding: 24px; text-align: center;">
        <div style="font-size: 2.2rem; font-weight: 900; color: ${palette.primary}; line-height: 1.1; margin-bottom: 6px;">
          ${f.value || f.number || f.val || '100%'}
        </div>
        <div style="font-size: 0.88rem; font-weight: 600; color: ${isDark ? '#94a3b8' : '#64748b'};">
          ${f.label || f.title || 'Müşteri Memnuniyeti'}
        </div>
      </div>
    `).join('\n')}
  </div>
</section>
  `;
}

/**
 * Renders the product / service catalog section adapted for the sector.
 */
export function renderArchetypeCatalog({ archetype, companyName, products = [], services = [], palette }) {
  const isHealth = archetype.styleTheme === 'clean_clinical_light';
  const isFood = archetype.parentCategory === 'AGRICULTURE_FOOD' || archetype.parentCategory === 'TOURISM_HOSPITALITY';
  const borderRadius = archetype.designTokens?.borderRadius || '12px';

  let title = 'Öne Çıkan Ürün ve Çözümlerimiz';
  let subtitle = 'Sektörün en yüksek standartlarına uygun kurumsal çözümlerimiz.';
  if (isHealth) {
    title = 'Tıbbi Branşlarımız ve Tedavi Protokollerimiz';
    subtitle = 'Uluslararası standartlarda ileri tanı ve cerrahi tedavi olanakları.';
  } else if (isFood) {
    title = 'Özel Menü & Ürün Kataloğumuz';
    subtitle = 'En taze hammaddeler ve hijyenik üretim standartlarıyla hazırlanan lezzetler.';
  }

  const items = Array.isArray(products) && products.length > 0 ? products : services;
  if (!items || items.length === 0) return '';

  return `
<!-- SEKTÖREL KATALOG & VİTRİN -->
<section style="padding: 85px 20px; max-width: 1200px; margin: 0 auto;" id="katalog">
  <div style="text-align: center; margin-bottom: 50px;">
    <span style="color: ${palette.primary}; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px;">${companyName} PORTFÖYÜ</span>
    <h2 style="font-size: 2.3rem; color: #0f172a !important; font-weight: 800; margin: 10px 0;">${title}</h2>
    <p style="color: #64748b; max-width: 600px; margin: 0 auto; font-size: 1rem;">
      ${subtitle}
    </p>
  </div>

  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 26px;">
    ${items.slice(0, 6).map((item, idx) => {
      const cleanSlug = (item.slug || '').replace(/^\/+|\/+$/g, '') || (item.path || '').replace(/^\/+|\/+$/g, '');
      const itemUrl = cleanSlug ? `/__LANG__/${cleanSlug}/` : '#teklif';
      return `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: ${borderRadius}; padding: 26px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="font-size: 2rem; margin-bottom: 14px;">${item.icon || '🔹'}</div>
          ${item.badge ? `<span style="background: ${palette.primary}15; color: ${palette.primary}; font-size: 0.75rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">${item.badge}</span>` : ''}
          <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-bottom: 10px;">${item.title}</h3>
          <p style="font-size: 0.9rem; color: #475569; line-height: 1.6; margin-bottom: 20px;">
            ${item.summary || item.description || 'Yüksek standartlı kurumsal çözüm.'}
          </p>
        </div>
        <a href="${itemUrl}" style="color: ${palette.primary}; font-weight: 700; font-size: 0.9rem; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
          Detaylı İncele &rarr;
        </a>
      </div>
    `;}).join('\n')}
  </div>
</section>
  `;
}

/**
 * Renders the sector-specific interactive tool / calculator.
 * Includes dental appointment simulators, VKE calculators, solar ROI, pet food portion,
 * freight rate calculators, CNC cycle time estimators, etc.
 */
export function renderArchetypeInteractiveTool({ archetype, companyName, palette }) {
  const tool = archetype.interactiveTool || {};
  const toolType = tool.type || '';
  const borderRadius = archetype.designTokens?.borderRadius || '14px';

  // 1. DENTAL & BEFORE/AFTER SLIDER (Diş Hekimi, Plastik Cerrahi, Estetik)
  if (toolType === 'before_after_slider' || toolType === 'dental_booking_simulator') {
    return `
<!-- INTERAKTİF DENTAL / ESTETİK GÜLÜŞ & BEFORE-AFTER SİMÜLATÖRÜ -->
<section style="background: #f8fafc; padding: 85px 20px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
  <div style="max-width: 1100px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 45px;">
      <span style="color: ${palette.primary}; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px;">Görsel Simülatör</span>
      <h2 style="font-size: clamp(1.6rem, 4vw, 2.3rem); color: #0f172a !important; font-weight: 800; margin: 10px 0 14px;">${tool.title || 'Online Randevu & Gülüş Tasarımı Ön Analiz Modülü'}</h2>
      <p style="color: #475569; max-width: 650px; margin: 0 auto; font-size: 1.02rem; line-height: 1.6;">
        ${tool.subtitle || 'Tedavi türünü seçin, hekim randevunuzu ve tahmini tedavi planınızı çıkarın.'}
      </p>
    </div>

    <div class="simulator-grid-split" style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: ${borderRadius}; padding: 36px; box-shadow: 0 15px 35px rgba(0,0,0,0.06);">
      <!-- Controls -->
      <div>
        <div style="margin-bottom: 22px;">
          <label style="display: block; font-size: 0.9rem; font-weight: 700; color: #0f172a; margin-bottom: 8px;">1. İhtiyacınız Olan Tedavi / Branş</label>
          <select id="dental-treatment" onchange="calcDentalSim()" style="width: 100%; background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; padding: 14px; border-radius: 8px; font-size: 0.95rem; font-weight: 600;">
            <option value="implant">İmplant Tedavisi & All-on-4 / All-on-6</option>
            <option value="zirconia">Zirkonyum / E-Max Estetik Gülüş Tasarımı</option>
            <option value="orthodontics">Şeffaf Plak (Invisalign) & Ortodonti</option>
            <option value="whitening">Lazerle Diş Beyazlatma & Diş Eti Estetiği</option>
          </select>
        </div>

        <div style="margin-bottom: 22px;">
          <label style="display: block; font-size: 0.9rem; font-weight: 700; color: #0f172a; margin-bottom: 8px;">2. Tercih Edilen Randevu Günü</label>
          <select id="dental-timing" onchange="calcDentalSim()" style="width: 100%; background: #f8fafc; border: 1px solid #cbd5e1; color: #0f172a; padding: 14px; border-radius: 8px; font-size: 0.95rem; font-weight: 600;">
            <option value="fast">En Erken Müsait Randevu (Hafta İçi)</option>
            <option value="weekend">Hafta Sonu Cumartesi Kliniği</option>
            <option value="tourist">Yurt Dışı / Şehir Dışı VIP Paket Randevusu</option>
          </select>
        </div>
      </div>

      <!-- Result Card -->
      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: ${borderRadius}; padding: 28px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="font-size: 0.8rem; color: #0369a1; text-transform: uppercase; font-weight: 800; letter-spacing: 1px;">Tahmini Süreç & Plan</div>
          <div id="dental-plan-title" style="font-size: 1.5rem; font-weight: 900; color: #0c4a6e; margin: 10px 0;">3 - 5 Günde Tamamlanan Dijital Gülüş</div>
          <p id="dental-plan-desc" style="font-size: 0.88rem; color: #0369a1; line-height: 1.6;">
            Ağız içi dijital 3D tarayıcı ile ölçü alınır, laboratuvarda robotik CAD/CAM ile üretilir ve aynı hafta uygulanır.
          </p>
        </div>

        <button onclick="applyDentalToLeadForm()" style="margin-top: 20px; background: #0284c7; color: #ffffff !important; border: none; padding: 14px; border-radius: 8px; font-weight: 800; font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 14px rgba(2,132,199,0.35);">
          Bu Tedavi İçin Online Randevu Oluştur &rarr;
        </button>
      </div>
    </div>
  </div>
</section>

<script>
function calcDentalSim() {
  const treat = document.getElementById('dental-treatment').value;
  const titleEl = document.getElementById('dental-plan-title');
  const descEl = document.getElementById('dental-plan-desc');
  if (treat === 'implant') {
    titleEl.textContent = 'Aynı Gün Sabit Diş & Dikişsiz İmplant';
    descEl.textContent = '3D Çene tomografisiyle kemik yapısı incelenir, kemik içi implantlar yerleştirilerek geçici sabit protez aynı gün takılır.';
  } else if (treat === 'orthodontics') {
    titleEl.textContent = 'Telsiz Şeffaf Plak Tedavisi (6-12 Ay)';
    descEl.textContent = 'Görünmeyen akıllı plaklarla sosyal hayatınızı etkilemeden diş çapraşıklıkları düzeltilir.';
  } else {
    titleEl.textContent = '3 - 5 Günde Tamamlanan Zirkonyum Gülüş';
    descEl.textContent = 'CAD/CAM dijital laboratuvarımızda yüz hattınıza uygun özel zirkonyum porselenler üretilir.';
  }
}
function applyDentalToLeadForm() {
  const treat = document.getElementById('dental-treatment').options[document.getElementById('dental-treatment').selectedIndex].text;
  const msgInput = document.getElementById('lead-msg');
  if (msgInput) {
    msgInput.value = 'Tedavi / Randevu Talebi: ' + treat + '. Ön muayene ve randevu oluşturmak istiyorum.';
    msgInput.scrollIntoView({ behavior: 'smooth' });
    msgInput.focus();
  }
}
</script>
    `;
  }

  // 2. BMI & CALORIE CALCULATOR (Diyetisyen & Beslenme)
  if (toolType === 'bmi_calorie_calculator') {
    return `
<!-- INTERAKTİF VÜCUT KİTLE ENDEKSİ (VKE) HESAPLAYICI -->
<section style="background: #f0fdf4; padding: 85px 20px; border-top: 1px solid #bbf7d0; border-bottom: 1px solid #bbf7d0;">
  <div style="max-width: 1100px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 45px;">
      <span style="color: #16a34a; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px;">Beslenme & Metabolizma</span>
      <h2 style="font-size: clamp(1.6rem, 4vw, 2.3rem); color: #14532d !important; font-weight: 800; margin: 10px 0 14px;">Vücut Kitle Endeksi (VKE) ve İdeal Kilo Hesaplayıcı</h2>
      <p style="color: #374151; max-width: 650px; margin: 0 auto; font-size: 1.02rem; line-height: 1.6;">
        Boy ve kilo bilgilerinizi girin; bilimsel VKE skorunuzu ve sağlıklı kilonuza ulaşmak için gereken programı anında öğrenin.
      </p>
    </div>

    <div class="simulator-grid-split" style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; background: #ffffff; border: 1px solid #bbf7d0; border-radius: 16px; padding: 36px; box-shadow: 0 15px 35px rgba(20,83,45,0.06);">
      <div>
        <div style="margin-bottom: 22px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <label style="font-weight: 700; color: #14532d;">Boyunuz (cm)</label>
            <span id="bmi-height-val" style="font-weight: 800; color: #16a34a;">175 cm</span>
          </div>
          <input type="range" id="bmi-height" min="140" max="210" value="175" oninput="calcBmiSim()" style="width: 100%; accent-color: #16a34a; cursor: pointer;">
        </div>

        <div style="margin-bottom: 22px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <label style="font-weight: 700; color: #14532d;">Kilonuz (kg)</label>
            <span id="bmi-weight-val" style="font-weight: 800; color: #16a34a;">75 kg</span>
          </div>
          <input type="range" id="bmi-weight" min="40" max="160" value="75" oninput="calcBmiSim()" style="width: 100%; accent-color: #16a34a; cursor: pointer;">
        </div>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 28px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span style="font-size: 0.8rem; font-weight: 800; color: #15803d; text-transform: uppercase;">VKE Değerlendirmeniz</span>
          <div id="bmi-score" style="font-size: 2.8rem; font-weight: 900; color: #16a34a; margin: 10px 0;">24.5 (Normal)</div>
          <div id="bmi-ideal" style="font-size: 0.95rem; color: #14532d; font-weight: 700; margin-bottom: 8px;">İdeal Kilo Aralığınız: 58 - 76 kg</div>
          <p style="font-size: 0.85rem; color: #4b5563; line-height: 1.5;">Metabolizma hızınıza ve hedefinize uygun online diyet paketini belirleyelim.</p>
        </div>

        <button onclick="applyBmiToLead()" style="margin-top: 20px; background: #16a34a; color: #fff !important; border: none; padding: 14px; border-radius: 8px; font-weight: 800; font-size: 0.95rem; cursor: pointer;">
          🥗 Kişiye Özel Beslenme Paketi İste &rarr;
        </button>
      </div>
    </div>
  </div>
</section>

<script>
function calcBmiSim() {
  const h = parseInt(document.getElementById('bmi-height').value, 10);
  const w = parseInt(document.getElementById('bmi-weight').value, 10);
  document.getElementById('bmi-height-val').textContent = h + ' cm';
  document.getElementById('bmi-weight-val').textContent = w + ' kg';
  const score = (w / ((h/100) * (h/100))).toFixed(1);
  let status = 'Normal';
  if (score < 18.5) status = 'Zayıf';
  else if (score >= 25 && score < 30) status = 'Fazla Kilolu';
  else if (score >= 30) status = 'Obezite';
  document.getElementById('bmi-score').textContent = score + ' (' + status + ')';
}
function applyBmiToLead() {
  const h = document.getElementById('bmi-height').value;
  const w = document.getElementById('bmi-weight').value;
  const score = document.getElementById('bmi-score').textContent;
  const msgInput = document.getElementById('lead-msg');
  if (msgInput) {
    msgInput.value = 'Diyetisyen Danışmanlığı: Boy ' + h + ' cm, Kilo ' + w + ' kg, VKE: ' + score + '. Kişiye özel online beslenme programı rica ederim.';
    msgInput.scrollIntoView({ behavior: 'smooth' });
    msgInput.focus();
  }
}
calcBmiSim();
</script>
    `;
  }

  // 3. PETSHOP PORTION SIMULATOR
  if (toolType === 'pet_daily_portion_calculator' || archetype.id === 'PETSHOP_ANIMAL_CARE' || archetype.id === 'PETSHOP_EVCIL_HAYVAN') {
    return `
<!-- İNTERAKTİF EVCİL HAYVAN MAMA & PORSİYON HESAPLAYICI -->
<section style="background: #f0fdf4; padding: 85px 20px; border-top: 1px solid #bbf7d0; border-bottom: 1px solid #bbf7d0;">
  <div style="max-width: 1100px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 45px;">
      <span style="color: #059669; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px;">🐾 Canlı Beslenme Rehberi</span>
      <h2 style="font-size: clamp(1.6rem, 4vw, 2.3rem); color: #064e3b !important; font-weight: 800; margin: 10px 0 14px; line-height: 1.25;">
        Evcil Hayvan Günlük Mama & Porsiyon Hesaplayıcı
      </h2>
      <p style="color: #374151 !important; max-width: 650px; margin: 0 auto; font-size: 1.05rem; line-height: 1.6;">
        Dostunuzun türünü, yaş evresini ve kilosunu seçin; günlük tüketmesi gereken ideal gramajı ve uygun mama formülünü anında öğrenin.
      </p>
    </div>

    <div class="simulator-grid-split" style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; background: #064e3b; border-radius: 20px; padding: 36px; box-shadow: 0 20px 50px rgba(6,78,59,0.25); color: #ffffff;">
      <div>
        <div style="margin-bottom: 22px;">
          <label style="display: block; font-size: 0.9rem; font-weight: 700; color: #ffffff !important; margin-bottom: 8px;">1. Evcil Dostunuzun Türü & Yaşam Evresi</label>
          <select id="pet-type" onchange="calcPetFoodSim()" style="width: 100%; background: #047857; border: 1px solid #10b981; color: #ffffff !important; padding: 14px; border-radius: 8px; outline: none; font-size: 0.95rem; font-weight: 600;">
            <option value="cat_sterilised">Kedi - Kısırlaştırılmış Yetişkin (1-7 Yaş)</option>
            <option value="cat_kitten">Kedi - Yavru / Büyüme Dönemi (2-12 Ay)</option>
            <option value="cat_senior">Kedi - Yaşlı / Hassas Sindirim (7+ Yaş)</option>
            <option value="dog_small">Köpek - Küçük Irk Yetişkin (1-10 kg)</option>
            <option value="dog_medium_large">Köpek - Orta & Büyük Irk Yetişkin (11-40 kg)</option>
            <option value="dog_puppy">Köpek - Yavru (Puppy 2-12 Ay)</option>
          </select>
        </div>

        <div style="margin-bottom: 22px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <label style="font-size: 0.9rem; font-weight: 700; color: #ffffff !important;">2. Vücut Ağırlığı (Kilo)</label>
            <span id="pet-weight-val" style="color: #6ee7b7; font-weight: 800; font-size: 1rem;">4.5 kg</span>
          </div>
          <input type="range" id="pet-weight" min="1" max="40" step="0.5" value="4.5" oninput="calcPetFoodSim()" style="width: 100%; accent-color: #10b981; cursor: pointer;">
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; font-size: 0.9rem; font-weight: 700; color: #ffffff !important; margin-bottom: 8px;">3. Günlük Hareket / Aktivite Düzeyi</label>
          <select id="pet-activity" onchange="calcPetFoodSim()" style="width: 100%; background: #047857; border: 1px solid #10b981; color: #ffffff !important; padding: 14px; border-radius: 8px; outline: none; font-size: 0.95rem; font-weight: 600;">
            <option value="normal">Normal / Ev İçi Standart Aktivite</option>
            <option value="low">Sakin / Az Hareketli (Kilo Kontrolü Gerekli)</option>
            <option value="high">Çok Hareketli / Dışarıda Gezen / Enerjik</option>
          </select>
        </div>
      </div>

      <div style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 28px; display: flex; flex-direction: column; justify-content: space-between; backdrop-filter: blur(10px);">
        <div>
          <span style="font-size: 0.8rem; font-weight: 700; color: #6ee7b7; text-transform: uppercase; letter-spacing: 1px;">Önerilen Günlük Beslenme</span>
          <div style="margin-top: 14px; margin-bottom: 20px;">
            <div id="pet-portion-result" style="font-size: 2.8rem; font-weight: 900; color: #ffffff; line-height: 1.1;">60 - 75 gr</div>
            <div style="color: #a7f3d0; font-size: 0.9rem; margin-top: 4px;">Günlük Tavsiye Edilen Kuru Mama Miktarı</div>
          </div>
          <div style="background: rgba(0,0,0,0.2); border-radius: 10px; padding: 16px; font-size: 0.88rem; line-height: 1.6; color: #e2e8f0;">
            <div style="margin-bottom: 6px;">💡 <strong>Tavsiye Edilen Mama Türü:</strong> <span id="pet-formula-text" style="color: #6ee7b7; font-weight: 700;">Yüksek Proteinli Tahılsız Kısırlaştırılmış Kedi Maması</span></div>
            <div>💧 <strong>Günlük Taze Su İhtiyacı:</strong> <span id="pet-water-text" style="color: #38bdf8; font-weight: 700;">~200 - 250 ml</span></div>
          </div>
        </div>

        <div style="margin-top: 24px;">
          <a id="pet-sim-whatsapp-btn" href="https://wa.me/905427344810?text=Merhaba,%20mama%20siparişi%20vermek%20istiyorum." target="_blank" style="display: block; width: 100%; box-sizing: border-box; background: #25D366; color: #ffffff !important; text-decoration: none; padding: 14px; border-radius: 10px; font-weight: 800; font-size: 0.95rem; text-align: center; box-shadow: 0 4px 14px rgba(37,211,102,0.4);">
            💬 Bu Formüle Uygun Mamayı WhatsApp'tan Sor
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<script>
function calcPetFoodSim() {
  const typeEl = document.getElementById('pet-type');
  if (!typeEl) return;
  const type = typeEl.value;
  const weight = parseFloat(document.getElementById('pet-weight').value) || 4;
  const activity = document.getElementById('pet-activity').value;
  document.getElementById('pet-weight-val').textContent = weight + ' kg';

  let mult = 15;
  let formula = 'Tahılsız Kısırlaştırılmış Somonlu Kedi Maması';
  let water = Math.round(weight * 50);

  if (type === 'cat_kitten') { mult = 22; formula = 'Yüksek Enerjili Yavru Kedi Maması'; }
  else if (type === 'cat_sterilised') { mult = 14; formula = 'Düşük Yağlı Kısırlaştırılmış Kedi Maması'; }
  else if (type === 'cat_senior') { mult = 13; formula = 'Böbrek & Eklem Destekli Yaşlı Kedi Maması'; }
  else if (type === 'dog_small') { mult = 20; formula = 'Küçük Irk Hipoalerjenik Köpek Maması'; water = Math.round(weight * 60); }
  else if (type === 'dog_medium_large') { mult = 16; formula = 'Eklem Destekli Büyük Irk Köpek Maması'; water = Math.round(weight * 65); }
  else if (type === 'dog_puppy') { mult = 26; formula = 'Zengin Puppy Yavru Köpek Maması'; water = Math.round(weight * 70); }

  if (activity === 'low') mult *= 0.85;
  if (activity === 'high') mult *= 1.2;

  const minGrams = Math.round(weight * mult * 0.9);
  const maxGrams = Math.round(weight * mult * 1.1);

  document.getElementById('pet-portion-result').textContent = minGrams + ' - ' + maxGrams + ' gr';
  document.getElementById('pet-formula-text').textContent = formula;
  document.getElementById('pet-water-text').textContent = '~' + water + ' - ' + (water + 50) + ' ml';
}
calcPetFoodSim();
</script>
    `;
  }

  // 4. SOLAR GES & INDUSTRIAL AMORTIZATION
  if (toolType === 'solar_ges_roi_calculator' || archetype.id === 'ENERGY_INDUSTRIAL' || archetype.id === 'GUNES_ENERJISI_GES_YENILENEBILIR') {
    return `
<!-- INTERAKTİF ENERJİ & AKÜ KAPASİTE HESAPLAYICI -->
<section style="background: #f8fafc; padding: 85px 20px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
  <div style="max-width: 1100px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 45px;">
      <span style="color: ${palette.primary}; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px;">Online Mühendislik Aracı</span>
      <h2 style="font-size: clamp(1.6rem, 4vw, 2.3rem); color: #0f172a !important; font-weight: 800; margin: 10px 0 14px;">${archetype.toolTitle}</h2>
      <p style="color: #475569 !important; max-width: 650px; margin: 0 auto; font-size: 1.05rem; line-height: 1.6;">
        ${archetype.toolSubtitle}
      </p>
    </div>

    <div class="simulator-grid-split" style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; background: #0f172a; border-radius: 20px; padding: 36px; box-shadow: 0 20px 50px rgba(15,23,42,0.15);">
      <div>
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 0.9rem; font-weight: 600; color: #ffffff !important; margin-bottom: 8px;">1. Uygulama ve Sistem Türü</label>
          <select id="sim-type" onchange="calcEnergySim()" style="width: 100%; background: #1e293b; border: 1px solid #334155; color: #ffffff !important; padding: 14px; border-radius: 8px; outline: none; font-size: 0.95rem;">
            <option value="traksiyoner">Elektrikli Forklift Traksiyoner Aküsü (48V / 80V)</option>
            <option value="solar">Endüstriyel Çatı Güneş Enerjisi (GES Kurulumu)</option>
            <option value="lityum">Lityum (LiFePO4) Endüstriyel Depolama</option>
            <option value="karavan">Karavan / Marin Bağımsız Enerji Grubu</option>
          </select>
        </div>

        <div style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <label style="font-size: 0.9rem; font-weight: 600; color: #ffffff !important;">2. Ekipman / Tesis Sayısı veya Çatı Kapasitesi</label>
            <span id="sim-count-val" style="color: ${palette.accent || '#fbbf24'}; font-weight: 700; font-size: 0.95rem;">3 Adet</span>
          </div>
          <input type="range" id="sim-count" min="1" max="20" value="3" oninput="calcEnergySim()" style="width: 100%; accent-color: ${palette.primary}; cursor: pointer;">
        </div>

        <div style="margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <label style="font-size: 0.9rem; font-weight: 600; color: #ffffff !important;">3. Günlük Operasyon Süresi</label>
            <span id="sim-hours-val" style="color: ${palette.accent || '#fbbf24'}; font-weight: 700; font-size: 0.95rem;">12 Saat</span>
          </div>
          <input type="range" id="sim-hours" min="4" max="24" value="12" oninput="calcEnergySim()" style="width: 100%; accent-color: ${palette.primary}; cursor: pointer;">
        </div>
      </div>

      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 28px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; margin-bottom: 8px;">Tahmini Yıllık Kazanç & Verimlilik</div>
          <div id="sim-result-savings" style="font-size: 2.5rem; font-weight: 900; color: #34d399 !important; margin-bottom: 6px;">₺185,000 / yıl</div>
          <div style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 18px; line-height: 1.5;">Konvansiyonel enerji maliyetlerine kıyasla operasyonel tasarruf.</div>
          
          <div style="padding-top: 14px; border-top: 1px solid #334155; display: flex; flex-direction: column; gap: 10px; font-size: 0.88rem;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #94a3b8;">Geri Dönüş (Amortisman):</span>
              <strong id="sim-result-payback" style="color: #ffffff !important;">9 - 14 Ay</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #94a3b8;">Karbon Tasarrufu:</span>
              <strong id="sim-result-carbon" style="color: #ffffff !important;">14.2 Ton CO₂ / yıl</strong>
            </div>
          </div>
        </div>

        <button onclick="applySimToLeadForm()" style="margin-top: 22px; background: ${palette.primary}; color: #ffffff !important; border: none; padding: 14px; border-radius: 10px; font-weight: 800; font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 14px ${palette.primary}50;">
          Bu Simülasyon İçin Mühendislik Teklifi Al &rarr;
        </button>
      </div>
    </div>
  </div>
</section>

<script>
function calcEnergySim() {
  const type = document.getElementById('sim-type').value;
  const count = parseInt(document.getElementById('sim-count').value, 10);
  const hours = parseInt(document.getElementById('sim-hours').value, 10);
  document.getElementById('sim-count-val').innerText = count + ' Adet';
  document.getElementById('sim-hours-val').innerText = hours + ' Saat';

  let multiplier = 4500;
  let paybackMonths = Math.max(6, Math.round(22 - (hours * 0.5)));
  if (type === 'solar') multiplier = 9500;
  if (type === 'lityum') multiplier = 7500;
  if (type === 'karavan') multiplier = 2500;

  const totalSavings = count * hours * multiplier;
  const carbon = (count * hours * 0.35).toFixed(1);

  document.getElementById('sim-result-savings').innerText = '₺' + totalSavings.toLocaleString('tr-TR') + ' / yıl';
  document.getElementById('sim-result-payback').innerText = paybackMonths + ' - ' + (paybackMonths + 4) + ' Ay';
  document.getElementById('sim-result-carbon').innerText = carbon + ' Ton CO₂ / yıl';
}
function applySimToLeadForm() {
  const type = document.getElementById('sim-type').options[document.getElementById('sim-type').selectedIndex].text;
  const count = document.getElementById('sim-count').value;
  const hours = document.getElementById('sim-hours').value;
  const msgInput = document.getElementById('lead-msg');
  if (msgInput) {
    msgInput.value = 'Enerji/Akü Simülatör Talebi: ' + type + ' (' + count + ' Adet, Günlük ' + hours + ' saat). Fiyat ve mühendislik teklifi rica ederim.';
    msgInput.scrollIntoView({ behavior: 'smooth' });
    msgInput.focus();
  }
}
calcEnergySim();
</script>
    `;
  }

  // 5. FREIGHT & LOGISTICS CALCULATOR
  if (toolType === 'freight_calculator_tool' || archetype.id === 'LOGISTICS_FREIGHT' || archetype.id === 'ULUSLARARASI_NAKLIYE_FORWARDING') {
    return `
<!-- INTERAKTİF LOJİSTİK & NAVLUN SİMÜLATÖRÜ -->
<section style="background: #081325; padding: 80px 20px; border-top: 1px solid #1b3156; border-bottom: 1px solid #1b3156; color: #f0f9ff;">
  <div style="max-width: 1100px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 45px;">
      <span style="color: #38bdf8; font-weight: 800; font-size: 0.85rem; text-transform: uppercase;">Akıllı Rota & Maliyet</span>
      <h2 style="font-size: clamp(1.6rem, 4vw, 2.2rem); color: #fff; margin: 10px 0;">${archetype.toolTitle}</h2>
      <p style="color: #93c5fd; max-width: 650px; margin: 0 auto; font-size: 0.95rem;">
        ${archetype.toolSubtitle}
      </p>
    </div>

    <div class="simulator-grid-split" style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; background: #0f1d36; border: 1px solid #1b3156; border-radius: 16px; padding: 36px;">
      <div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
          <div>
            <label style="display: block; font-size: 0.8rem; color: #93c5fd; margin-bottom: 6px;">Kalkış Noktası</label>
            <select id="log-origin" onchange="calcFreightSim()" style="width: 100%; background: #081325; border: 1px solid #1b3156; color: #fff; padding: 12px; border-radius: 8px;">
              <option value="ist">İstanbul & Marmara Bölgesi</option>
              <option value="izm">İzmir Limanı</option>
              <option value="mer">Mersin Limanı</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.8rem; color: #93c5fd; margin-bottom: 6px;">Varış Ülkesi</label>
            <select id="log-dest" onchange="calcFreightSim()" style="width: 100%; background: #081325; border: 1px solid #1b3156; color: #fff; padding: 12px; border-radius: 8px;">
              <option value="de">Almanya (Münih / Frankfurt)</option>
              <option value="it">İtalya (Trieste)</option>
              <option value="gb">İngiltere (Londra)</option>
              <option value="us">ABD (New York)</option>
            </select>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 0.8rem; color: #93c5fd; margin-bottom: 6px;">Taşıma Modu</label>
          <select id="log-mode" onchange="calcFreightSim()" style="width: 100%; background: #081325; border: 1px solid #1b3156; color: #fff; padding: 12px; border-radius: 8px;">
            <option value="road">Karayolu Komple Tır (FTL)</option>
            <option value="express">Ekspres Minivan (48h)</option>
            <option value="sea">Denizyolu Konteyner (FCL)</option>
          </select>
        </div>
      </div>

      <div style="background: #081325; border: 1px solid #1b3156; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="font-size: 0.8rem; color: #94a3b8; text-transform: uppercase;">Tahmini Transit Süresi</div>
          <div id="log-time" style="font-size: 2.2rem; font-weight: 800; color: #38bdf8; margin: 6px 0;">3 - 4 Gün</div>
          <div style="font-size: 0.85rem; color: #93c5fd;">Kapıdan kapıya gümrükleme dahil güvenli teslimat.</div>
        </div>
        <button onclick="applyFreightToLead()" style="margin-top: 20px; background: #0284c7; color: #fff; border: none; padding: 12px; border-radius: 8px; font-weight: 700; cursor: pointer;">
          Navlun Fiyat Teklifi İste &rarr;
        </button>
      </div>
    </div>
  </div>
</section>

<script>
function calcFreightSim() {
  const dest = document.getElementById('log-dest').value;
  const mode = document.getElementById('log-mode').value;
  let time = '3 - 4 Gün';
  if (mode === 'express') time = '36 - 48 Saat';
  else if (mode === 'sea') time = '14 - 21 Gün';
  else if (dest === 'gb') time = '5 - 6 Gün';
  document.getElementById('log-time').innerText = time;
}
function applyFreightToLead() {
  const dest = document.getElementById('log-dest').options[document.getElementById('log-dest').selectedIndex].text;
  const mode = document.getElementById('log-mode').options[document.getElementById('log-mode').selectedIndex].text;
  const msgInput = document.getElementById('lead-msg');
  if (msgInput) {
    msgInput.value = 'Navlun Talebi: Varış ' + dest + ' (' + mode + '). Fiyat ve sefer planı talep ediyorum.';
    msgInput.scrollIntoView({ behavior: 'smooth' });
    msgInput.focus();
  }
}
calcFreightSim();
</script>
    `;
  }

  // DEFAULT HIGH-CONVERSION CONTACT & ADVISORY MODULE
  return `
<!-- GENEL SEKTÖREL ÇÖZÜM MODÜLÜ -->
<section style="background: #f8fafc; padding: 75px 20px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
  <div style="max-width: 1100px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 40px;">
      <span style="color: ${palette.primary}; font-weight: 800; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">${companyName} Hızlı Teklif Hattı</span>
      <h2 style="font-size: 2.2rem; color: #0f172a !important; font-weight: 800; margin: 10px 0 16px;">${archetype.toolTitle}</h2>
      <p style="color: #64748b; font-size: 1rem; max-width: 600px; margin: 0 auto;">
        ${archetype.toolSubtitle}
      </p>
    </div>

    <div class="simulator-grid-split" style="display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 36px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: ${borderRadius}; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.05);">
      <div>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-bottom: 12px;">Hızlı İhtiyaç ve Kapsam Analizi</h3>
        <p style="font-size: 0.92rem; color: #475569; line-height: 1.6; margin-bottom: 20px;">
          Uzman mühendis ve danışman ekibimizle işletmenize en uygun çözümü belirlemek için hemen ön talep oluşturun.
        </p>
        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.88rem; color: #334155;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="color: ${palette.primary};">✔</span>
            <span>Aynı gün teknik inceleme ve fizibilite</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="color: ${palette.primary};">✔</span>
            <span>Resmi şartname ve standartlara %100 uyum</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="color: ${palette.primary};">✔</span>
            <span>Şeffaf maliyet ve garantili teslim süreci</span>
          </div>
        </div>
      </div>

      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; justify-content: space-between; text-align: center;">
        <div>
          <div style="font-size: 0.8rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Doğrudan Başvuru</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: #0f172a; margin: 8px 0 12px;">Özel Teklif ve Danışmanlık</div>
          <p style="font-size: 0.88rem; color: #475569; line-height: 1.5;">
            Talebiniz uzman temsilcilerimize anında iletilir ve en kısa sürede geri dönüş sağlanır.
          </p>
        </div>
        <a href="#teklif" style="margin-top: 20px; background: ${palette.primary}; color: #ffffff !important; text-decoration: none; padding: 14px; border-radius: 8px; font-weight: 800; font-size: 0.95rem; display: block;">
          Hemen İhtiyaç Formunu Doldurun &rarr;
        </a>
      </div>
    </div>
  </div>
</section>
  `;
}
