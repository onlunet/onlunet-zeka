import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractWebsiteMetadata,
  enrichExtractedDataWithAI,
  mapToCorporateSpec,
  matchBrandColorToPalette,
  inferServiceIcon
} from '../src/autonomous/site-extractor.js';
import { createCorporateGenerator } from '../src/autonomous/corporate-generator.js';

// Sample representative HTML modeled directly on falconenerji.com
const SAMPLE_FALCON_HTML = `
<!DOCTYPE html>
<html lang="tr">
<head>
  <title>Anasayfa - Falcon Enerji Akü Satış ve Solar Hizmetler</title>
  <meta name="description" content="Falcon Enerji 7 yıllık özel sektörde akü ve enerji alanlarında tecrübe birikimi ile en iyi hizmeti sağlamak için Tekirdağ/ Çorlu'da Falcon Enerji kurulmuştur."/>
  <meta property="og:title" content="Anasayfa - Falcon Enerji Akü Satış ve Solar Hizmetler" />
  <meta property="og:site_name" content="Falcon Enerji Akü Satış ve Solar Hizmetler" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "name": "Falcon Enerji",
        "url": "https://falconenerji.com",
        "logo": {
          "@type": "ImageObject",
          "url": "https://falconenerji.com/wp-content/uploads/2021/01/anasayfa-hakkimizda.jpg"
        }
      }
    ]
  }
  </script>
  <style id="grade-addon-style-inline-css">
    .btn { background: #F8B200 !important; }
    a:hover { color: #F8B200 !important; }
  </style>
</head>
<body>
  <div class="elementor-heading-title">Falcon Enerji ve İstif Makinaları</div>
  
  <div class="elementor-icon-box-wrapper">
    <i class="fas fa-phone-alt"></i>
    <h6 class="elementor-icon-box-title">0 554 507 77 31</h6>
    <p class="elementor-icon-box-description">bilgi@falconenerji.com</p>
  </div>

  <div class="elementor-icon-box-wrapper">
    <i class="fas fa-map-marker-alt"></i>
    <h6 class="elementor-icon-box-title">Trakya Bölgesi</h6>
    <p class="elementor-icon-box-description">Akü, Enerji ve İş Makineleri Satış Noktası</p>
  </div>

  <nav>
    <ul id="menu-main-menu">
      <li class="menu-item"><a href="https://falconenerji.com/">Anasayfa</a></li>
      <li class="menu-item"><a href="https://falconenerji.com/hakkimizda/">Kurumsal</a></li>
      <li class="menu-item"><a href="https://falconenerji.com/hizmetlerimiz/endustriyel-aku-satis/">Forklift Akü Satış(Traksiyoner)</a></li>
      <li class="menu-item"><a href="https://falconenerji.com/hizmetlerimiz/forklift-kiralama-ve-satis/">Forklift Kiralama ve Satış</a></li>
      <li class="menu-item"><a href="https://falconenerji.com/hizmetlerimiz/solar-sistem-kurulumlari/">Solar Sistem Kurulumları</a></li>
      <li class="menu-item"><a href="https://falconenerji.com/hizmetlerimiz/ges-cati-temizlik-uygulamalari/">GES Çatı Temizlik Uygulamaları</a></li>
      <li class="menu-item"><a href="https://falconenerji.com/hizmetlerimiz/karavan-enerji-cozumleri/">Karavan Enerji Çözümleri</a></li>
      <li class="menu-item"><a href="https://falconenerji.com/lityum-akuler/">Lityum Aküler</a></li>
      <li class="menu-item"><a href="https://falconenerji.com/solar-jel-akuler/">Solar Jel Aküler</a></li>
      <li class="menu-item"><a href="https://falconenerji.com/forkliftler/">Forkliftler</a></li>
      <li class="menu-item"><a href="https://falconenerji.com/iletisim/">İletişim</a></li>
    </ul>
  </nav>

  <div class="elementor-widget-text-editor">
    <p>Trakya Bölgesi başta olmak üzere, Türkiye’nin her bölgesinde hizmet veriyoruz</p>
  </div>

  <h2>Bizi Tanıyın</h2>
  <p>2020 yılında Makine Mühendisi tarafından Tekirdağ/ Çorlu'da kurulan Falcon Enerji, gücünü 7 yıllık özel sektörde akü ve enerji alanlarında karşılaşmış olduğu bilgi ve tecrübesinden almaktadır.</p>

  <div class="elementskit-funfact-inner" data-value="7">
    <div class="funfact-title">Sektörde 7 yıllık tecrübe</div>
  </div>
  <div class="elementskit-funfact-inner" data-value="18">
    <div class="funfact-title">Enerji alt grubunda projelendirme</div>
  </div>

  <div class="qlwapp" data-button='{"type":"phone","phone":"905545077731"}'></div>

  <a href="https://www.facebook.com/profile.php?id=61563617493618">Facebook</a>
  <a href="https://www.instagram.com/falconenerji">Instagram</a>
  <a href="https://www.youtube.com/@falconenerji">Youtube</a>
</body>
</html>
`;

test('ONLUNET ZEKA — Site Extractor & AI Modernizer', async (t) => {

  await t.test('1. Accurately extracts metadata, branding and color from HTML', () => {
    const meta = extractWebsiteMetadata(SAMPLE_FALCON_HTML, 'https://falconenerji.com/');

    assert.equal(meta.companyName, 'Falcon Enerji');
    assert.match(meta.slogan, /Trakya Bölgesi başta olmak üzere/);
    assert.match(meta.description, /Tekirdağ\/ Çorlu/);
    assert.equal(meta.brandColor, '#F8B200');
    assert.equal(meta.paletteKey, 'gold'); // Yellow/Gold hex matches GOLD palette
    assert.equal(meta.contact.phone, '0 554 507 77 31');
    assert.equal(meta.contact.email, 'bilgi@falconenerji.com');
    assert.equal(meta.contact.city, 'Tekirdağ / Çorlu');
    assert.match(meta.contact.address, /Trakya Bölgesi/);
    assert.ok(meta.contact.social.facebook);
    assert.ok(meta.contact.social.instagram);
    assert.ok(meta.contact.social.youtube);
    assert.match(meta.industry, /Güneş Enerjisi/);

    // Verify services
    assert.ok(meta.services.length >= 5);
    const serviceTitles = meta.services.map(s => s.title);
    assert.ok(serviceTitles.some(t => t.includes('Solar Sistem')));
    assert.ok(serviceTitles.some(t => t.includes('Forklift Akü')));

    // Verify products
    assert.ok(meta.products.length >= 3);
    const productTitles = meta.products.map(p => p.title);
    assert.ok(productTitles.some(p => p.includes('Lityum Aküler')));

    // Verify funfacts
    assert.equal(meta.funfacts.length, 2);
    assert.equal(meta.funfacts[0].value, '7');
  });

  await t.test('2. Color matcher correctly maps hex colors to corporate palettes', () => {
    const gold = matchBrandColorToPalette('#F8B200');
    assert.equal(gold.id, 'gold');

    const blue = matchBrandColorToPalette('#2563EB');
    assert.equal(blue.id, 'blue');

    const emerald = matchBrandColorToPalette('#059669');
    assert.equal(emerald.id, 'emerald');

    const purple = matchBrandColorToPalette('#7C3AED');
    assert.equal(purple.id, 'purple');

    const crimson = matchBrandColorToPalette('#DC2626');
    assert.equal(crimson.id, 'crimson');
  });

  await t.test('3. Semantically infers SVG icons from service titles', () => {
    assert.equal(inferServiceIcon('Güneş Enerjisi Sistemleri'), 'sun');
    assert.equal(inferServiceIcon('Solar GES Çatı Kurulumu'), 'sun');
    assert.equal(inferServiceIcon('Endüstriyel Akü Satışı'), 'battery-charging');
    assert.equal(inferServiceIcon('Lityum Batarya Paketleri'), 'battery-charging');
    assert.equal(inferServiceIcon('Forklift Kiralama ve Bakım'), 'truck');
    assert.equal(inferServiceIcon('Yedek Parça ve Ataşman'), 'tool');
    assert.equal(inferServiceIcon('Çatı Temizlik ve Denetim'), 'shield-check');
  });

  await t.test('4. AI Content Enrichment auto-fills missing descriptions and generates FAQs', async () => {
    const raw = extractWebsiteMetadata(SAMPLE_FALCON_HTML, 'https://falconenerji.com/');
    
    // Check before enrichment: descriptions are empty
    assert.equal(raw.services[0].description, '');

    const enriched = await enrichExtractedDataWithAI(raw);

    // After enrichment:
    assert.ok(enriched.aiEnrichedFields.includes('services_descriptions'));
    assert.ok(enriched.aiEnrichedFields.includes('faqs'));

    // Check that each service now has a rich Turkish description
    for (const service of enriched.services) {
      assert.ok(service.description.length > 30, `Service ${service.title} should have detailed description`);
      assert.ok(service.icon, `Service ${service.title} should have an icon`);
    }

    // Check FAQs
    assert.ok(enriched.faqs.length >= 3);
    assert.ok(enriched.faqs.some(f => f.question.includes('Akü')));
    assert.ok(enriched.faqs.some(f => f.question.includes('Solar')));
  });

  await t.test('5. Maps to CorporateSpec and synthesizes a full project with onlunet-kurumsal admin', async () => {
    const raw = extractWebsiteMetadata(SAMPLE_FALCON_HTML, 'https://falconenerji.com/');
    const enriched = await enrichExtractedDataWithAI(raw);
    const spec = mapToCorporateSpec(enriched);

    assert.equal(spec.companyName, 'Falcon Enerji');
    assert.equal(spec.theme, 'gold');
    assert.equal(spec.targetDir, 'falcon-enerji');
    assert.equal(spec.contact.phone, '0 554 507 77 31');
    assert.equal(spec.contact.email, 'bilgi@falconenerji.com');
    assert.equal(spec.contact.city, 'Tekirdağ / Çorlu');
    assert.ok(spec.services.length >= 5);

    // Test synthesis with corporate generator
    const generator = createCorporateGenerator();
    const synthesis = generator.synthesizeCorporateProject(spec);

    assert.equal(synthesis.projectName, 'Falcon Enerji');
    assert.equal(synthesis.spec.theme, 'gold');
    assert.ok(synthesis.files.some(f => f.path.includes('scripts/server.js')));
    assert.ok(synthesis.files.some(f => f.path.includes('storage/database.sqlite')));
    assert.ok(synthesis.files.some(f => f.path.includes('resources/views/frontend/home.php')));
    assert.ok(synthesis.files.some(f => f.path.includes('resources/views/frontend/contact.php')));

    // Check that home.php contains Falcon Enerji and extracted services
    const homeFile = synthesis.files.find(f => f.path.includes('resources/views/frontend/home.php'));
    assert.ok(homeFile.content.includes('Falcon Enerji'));
    assert.ok(homeFile.content.includes('Solar Sistem Kurulumları'));
  });

  await t.test('6. Tests against real scraped falconenerji content file if available', () => {
    const scrapedPath = 'C:\\Users\\OnluN\\.gemini\\antigravity\\brain\\31a7db48-0b66-4f5c-b95f-d48b90b3c4c8\\.system_generated\\steps\\7327\\content.md';
    if (fs.existsSync(scrapedPath)) {
      const realHtml = fs.readFileSync(scrapedPath, 'utf8');
      const meta = extractWebsiteMetadata(realHtml, 'https://falconenerji.com/');
      
      assert.equal(meta.companyName, 'Falcon Enerji');
      assert.equal(meta.contact.phone, '0 554 507 77 31');
      assert.equal(meta.contact.email, 'bilgi@falconenerji.com');
      assert.equal(meta.brandColor, '#F8B200');
      assert.equal(meta.paletteKey, 'gold');
      assert.ok(meta.services.length >= 5);
      assert.ok(meta.products.length >= 5);
      assert.ok(meta.funfacts.length >= 2);
    }
  });

});
