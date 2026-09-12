import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MainCategories,
  SubSectorPresets,
  getAllCategories,
  getAllSubSectors,
  getSectorPreset,
  detectSectorPreset
} from '../src/autonomous/sector-presets.js';

test('SectorPresets: should declare all 13 main categories with metadata', () => {
  const categories = getAllCategories();
  assert.equal(categories.length, 13, 'Should have exactly 13 main categories');
  
  for (const cat of categories) {
    assert.ok(cat.id, 'Category must have an id');
    assert.ok(cat.code, 'Category must have a numeric code');
    assert.ok(cat.name, 'Category must have a Turkish display name');
    assert.ok(cat.vibe, 'Category must have design vibe guidelines');
    assert.ok(cat.defaultTheme, 'Category must have defaultTheme');
  }
});

test('SectorPresets: should declare 79 distinct sub-sector presets', () => {
  const subSectors = getAllSubSectors();
  assert.ok(subSectors.length >= 78, `Sub-sectors should be at least 78, got ${subSectors.length}`);

  for (const preset of subSectors) {
    assert.ok(preset.id, 'Preset must have an id');
    assert.ok(preset.parentCategory, `Preset ${preset.id} must belong to a parentCategory`);
    assert.ok(MainCategories[preset.parentCategory], `Preset ${preset.id} has invalid parentCategory: ${preset.parentCategory}`);
    assert.ok(preset.name, `Preset ${preset.id} must have a name`);
    assert.ok(Array.isArray(preset.keywords) && preset.keywords.length > 0, `Preset ${preset.id} must have keywords`);
    assert.ok(preset.designTokens, `Preset ${preset.id} must have designTokens`);
    assert.ok(preset.designTokens.palette.primary, `Preset ${preset.id} must have primary color`);
    assert.ok(preset.designTokens.borderRadius, `Preset ${preset.id} must have borderRadius`);
    assert.ok(preset.designTokens.typography.heading, `Preset ${preset.id} must have heading typography`);
    assert.ok(preset.designTokens.styleTheme, `Preset ${preset.id} must have styleTheme`);
    assert.ok(Array.isArray(preset.requiredSections), `Preset ${preset.id} must have requiredSections`);
    assert.ok(preset.interactiveTool, `Preset ${preset.id} must define an interactiveTool`);
    assert.ok(preset.ctaBehavior, `Preset ${preset.id} must define ctaBehavior`);
  }
});

test('SectorPresets: getSectorPreset returns expected presets', () => {
  const dental = getSectorPreset('DIS_KLINIGI_AGIZ_SAGLIGI');
  assert.ok(dental);
  assert.equal(dental.name, 'Diş Klinikleri & Ağız-Diş Sağlığı');
  assert.equal(dental.designTokens.styleTheme, 'clean_clinical_light');

  const arch = getSectorPreset('MIMARLIK_IC_MIMARLIK_OFISI');
  assert.ok(arch);
  assert.equal(arch.designTokens.borderRadius, '0px');
  assert.equal(arch.designTokens.styleTheme, 'editorial_magazine_sharp');
});

test('SectorPresets: detectSectorPreset accurately identifies diverse industries', () => {
  // Test Dental Clinic
  const dentalMatch = detectSectorPreset({
    industry: 'Diş Hekimi ve Ağız Sağlığı',
    companyName: 'Özel DentaVita Polikliniği',
    services: ['Zirkonyum Kaplama', 'İmplant Tedavisi', 'Gülüş Tasarımı']
  });
  assert.equal(dentalMatch.id, 'DIS_KLINIGI_AGIZ_SAGLIGI');

  // Test Architecture Office
  const archMatch = detectSectorPreset({
    industry: 'Mimarlık ve Restorasyon',
    companyName: 'Atölye Mimarî',
    services: ['Villa Tasarımı', 'İç Mimarlık Projesi', '3D Render']
  });
  assert.equal(archMatch.id, 'MIMARLIK_IC_MIMARLIK_OFISI');

  // Test Tiny House / Modular
  const tinyMatch = detectSectorPreset({
    industry: 'Prefabrik ve Modüler Yaşam',
    companyName: 'Doğa Tiny House & Çelik Ev',
    services: ['Tekerlekli Tiny House', 'Hafif Çelik Villa']
  });
  assert.equal(tinyMatch.id, 'PREFABRIK_CELIK_TINY_HOUSE');

  // Test Heavy Machinery CNC
  const cncMatch = detectSectorPreset({
    industry: 'Makine İmalat ve Talaşlı Sanayi',
    companyName: 'Tekniker CNC Torna Otomasyon',
    services: ['CNC Dik İşleme', 'Robotik Kaynak', 'Fason Parça']
  });
  assert.equal(cncMatch.id, 'MAKINE_IMALATI_OTOMASYON');

  // Test Solar GES
  const solarMatch = detectSectorPreset({
    industry: 'Güneş Enerjisi Sistemleri',
    companyName: 'Helios Solar Enerji GES',
    services: ['Çatı GES Kurulumu', 'İnverter ve Lityum Akü']
  });
  assert.equal(solarMatch.id, 'GUNES_ENERJISI_GES_YENILENEBILIR');

  // Test PetShop
  const petMatch = detectSectorPreset({
    industry: 'PetShop ve Evcil Hayvan',
    companyName: 'Gökhan KOÇ PetShop',
    services: ['Kedi Maması', 'Köpek Maması', 'Kedi Kumu']
  });
  assert.equal(petMatch.id, 'PETSHOP_EVCIL_HAYVAN');

  // Test Locksmith
  const lockMatch = detectSectorPreset({
    industry: 'Çilingir ve Anahtar',
    companyName: 'Hızlı Çilingir Nöbetçi Servis',
    services: ['Kapı Açma', 'Kilit Değiştirme', 'Oto Çilingir']
  });
  assert.equal(lockMatch.id, 'CILINGIR_OTO_ANAHTAR');
});

test('DesignSystemGenerator: dynamically produces customized DESIGN.md for any subsector', async () => {
  const { generateDesignMarkdown } = await import('../src/autonomous/design-system-generator.js');

  const dentalDesign = generateDesignMarkdown({
    companyName: 'DentaVita Diş Kliniği',
    sectorId: 'DIS_KLINIGI_AGIZ_SAGLIGI'
  });

  assert.ok(dentalDesign.includes('DentaVita Diş Kliniği'));
  assert.ok(dentalDesign.includes('Diş Klinikleri & Ağız-Diş Sağlığı'));
  assert.ok(dentalDesign.includes('#0ea5e9'));
  assert.ok(dentalDesign.includes('14px'));

  const archDesign = generateDesignMarkdown({
    companyName: 'Studio Arch',
    sectorId: 'MIMARLIK_IC_MIMARLIK_OFISI'
  });

  assert.ok(archDesign.includes('Mimarlık, İç Mimarlık & Restorasyon Ofisleri'));
  assert.ok(archDesign.includes('0px'));
  assert.ok(archDesign.includes('Cinzel'));
});

test('SectorArchetypes: detectSectorArchetype and layout renderers produce distinct HTML structures', async () => {
  const {
    detectSectorArchetype,
    renderArchetypeHero,
    renderArchetypeStats,
    renderArchetypeCatalog,
    renderArchetypeInteractiveTool
  } = await import('../src/autonomous/sector-archetypes.js');

  // Test Architecture layout (editorial_magazine_sharp)
  const archArchetype = detectSectorArchetype({
    industry: 'Mimarlık',
    companyName: 'Studio Lineer',
    services: ['Villa Projesi', 'İç Mimarlık']
  });

  assert.equal(archArchetype.styleTheme, 'editorial_magazine_sharp');
  const archHero = renderArchetypeHero({
    archetype: archArchetype,
    companyName: 'Studio Lineer',
    slogan: 'Lüks Konut & Mimari Tasarım',
    description: 'Ödüllü mimari stüdyomuzla geleceğin mekanlarını tasarlıyoruz.',
    industry: 'Mimarlık',
    palette: { primary: '#18181b', accent: '#a1a1aa' }
  });

  assert.ok(archHero.includes('HERO: EDITORIAL MAGAZINE SHARP'));
  assert.ok(archHero.includes('PROJE KÜNYESİ'));
  assert.ok(archHero.includes('Studio Lineer'));

  // Test Dental Clinic layout (clean_clinical_light)
  const dentalArchetype = detectSectorArchetype({
    industry: 'Diş Kliniği',
    companyName: 'DentaPlus',
    services: ['İmplant', 'Zirkonyum']
  });

  assert.equal(dentalArchetype.styleTheme, 'clean_clinical_light');
  const dentalHero = renderArchetypeHero({
    archetype: dentalArchetype,
    companyName: 'DentaPlus',
    slogan: 'Dijital Gülüş Tasarımı',
    description: 'Uzman hekimlerimizle acısız implant ve estetik zirkonyum tedavileri.',
    industry: 'Diş Kliniği',
    palette: { primary: '#0ea5e9', accent: '#10b981' }
  });

  assert.ok(dentalHero.includes('HERO: CLEAN CLINICAL LIGHT'));
  assert.ok(dentalHero.includes('Klinik Ön Konsültasyon Hattı'));

  // Test Dental Interactive Tool
  const dentalTool = renderArchetypeInteractiveTool({
    archetype: dentalArchetype,
    companyName: 'DentaPlus',
    palette: { primary: '#0ea5e9' }
  });
  assert.ok(dentalTool.includes('Gülüş Tasarımı Ön Analiz Modülü'));
  assert.ok(dentalTool.includes('dental-treatment'));

  // Test Locksmith layout (mobile_first_dispatch)
  const lockArchetype = detectSectorArchetype({
    industry: 'Çilingir',
    companyName: '7/24 Nöbetçi Çilingir',
    services: ['Kapı Açma']
  });

  assert.equal(lockArchetype.styleTheme, 'mobile_first_dispatch');
  const lockHero = renderArchetypeHero({
    archetype: lockArchetype,
    companyName: '7/24 Nöbetçi Çilingir',
    slogan: '15 Dakikada Kapınızdayız',
    description: 'Hasarsız kilit açma ve oto anahtar servisi.',
    industry: 'Çilingir',
    palette: { primary: '#e11d48' }
  });
  assert.ok(lockHero.includes('HERO: MOBILE FIRST DISPATCH'));
  assert.ok(lockHero.includes('TIKLA & HEMEN ARA'));
});


