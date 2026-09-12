import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MapsSectorArchetypes,
  inspectAndModernizeGoogleMaps
} from '../src/autonomous/maps-to-corporate.js';
import { createCorporateGenerator } from '../src/autonomous/corporate-generator.js';
import { createApplicationServer } from '../src/app/server.js';

test('ONLUNET ZEKA — Maps-to-Corporate Modernizer Pipeline', async (t) => {

  await t.test('1. Validates MapsSectorArchetypes knowledge base', () => {
    assert.ok(MapsSectorArchetypes.RESTAURANT_FOOD, 'RESTAURANT_FOOD archetype should exist');
    assert.ok(MapsSectorArchetypes.CAFE_BAKERY, 'CAFE_BAKERY archetype should exist');
    assert.ok(MapsSectorArchetypes.DELICATESSEN_ORGANIC, 'DELICATESSEN_ORGANIC archetype should exist');
    assert.ok(MapsSectorArchetypes.HEALTHCARE_DENTAL, 'HEALTHCARE_DENTAL archetype should exist');
    assert.ok(MapsSectorArchetypes.AUTOMOTIVE_SERVICE, 'AUTOMOTIVE_SERVICE archetype should exist');
    assert.ok(MapsSectorArchetypes.INDUSTRIAL_ENERGY, 'INDUSTRIAL_ENERGY archetype should exist');

    assert.equal(MapsSectorArchetypes.RESTAURANT_FOOD.isFood, true);
    assert.equal(MapsSectorArchetypes.CAFE_BAKERY.isFood, true);
    assert.equal(MapsSectorArchetypes.AUTOMOTIVE_SERVICE.isFood, false);
    assert.ok(MapsSectorArchetypes.RESTAURANT_FOOD.defaultMenuCategories.length >= 3);
  });

  await t.test('2. Inspects and modernizes a Restaurant / Gastronomy Maps profile', async () => {
    const mapsUrl = 'https://www.google.com/maps/place/Karak%C3%B6y+G%C3%BCll%C3%BCo%C4%9Flu/@41.0254,28.9754,17z/data=!3m1!4b1!4m6!3m5!1s0x14cab9e2c:0x12345!8m2!3d41.0254!4d28.9754';
    const res = await inspectAndModernizeGoogleMaps(mapsUrl, { timeoutMs: 5000 });

    assert.ok(res.success, 'Inspection should succeed');
    assert.ok(res.listing, 'Listing data should exist');
    assert.ok(res.archetype, 'Archetype should be detected');
    assert.ok(res.spec, 'Corporate spec should be generated');

    // Verify company name extraction
    assert.ok(res.spec.companyName.includes('Karaköy') || res.spec.companyName.includes('Güllüoğlu'), `Company name check: got ${res.spec.companyName}`);

    // Verify food archetype detection
    assert.equal(res.spec.isFoodHospitality, true, 'Should detect food/hospitality business');

    // Verify menu items / services synthesis with pricing
    assert.ok(Array.isArray(res.spec.services) && res.spec.services.length >= 4, 'Should synthesize at least 4 menu items');
    const firstService = res.spec.services[0];
    assert.ok(firstService.title, 'Menu item must have a title');
    assert.ok(firstService.summary, 'Menu item must have a summary');
    assert.ok(firstService.body, 'Menu item must have a rich body (Zero Thin-Content Guarantee)');
    assert.ok(Array.isArray(firstService.specs) && firstService.specs.length >= 3, 'Menu item must have specs table');
    assert.ok(Array.isArray(firstService.features) && firstService.features.length >= 2, 'Menu item must have features');
    assert.ok(Array.isArray(firstService.faqs) && firstService.faqs.length >= 2, 'Menu item must have FAQs');

    // Verify Google rating and reviews
    assert.ok(res.spec.googleRating, 'Should have a Google rating');
    assert.ok(res.spec.googleReviewCount, 'Should have a review count');
    assert.ok(Array.isArray(res.spec.googleReviews) && res.spec.googleReviews.length >= 2, 'Should have verified customer reviews');
    assert.ok(res.spec.googleReviews[0].author, 'Review must have author');
    assert.ok(res.spec.googleReviews[0].stars, 'Review must have stars');
    assert.ok(res.spec.googleReviews[0].text, 'Review must have text');

    // Verify contact and hours
    assert.ok(res.spec.contact, 'Should have contact details');
    assert.ok(res.spec.contact.workingHours, 'Should have working hours');
  });

  await t.test('3. Inspects and modernizes a Healthcare / Clinic Maps profile', async () => {
    const mapsUrl = 'https://www.google.com/maps/place/Dentistanbul+Di%C5%9F+Hastanesi/@41.0500,29.0000,17z/';
    const res = await inspectAndModernizeGoogleMaps(mapsUrl, { timeoutMs: 5000 });

    assert.ok(res.success);
    assert.equal(res.spec.isFoodHospitality, false, 'Healthcare should not be food/hospitality');
    assert.ok(res.archetype.id === 'HEALTHCARE_DENTAL' || res.spec.companyName.includes('Dentistanbul') || res.spec.industry.includes('Sağlık') || res.spec.industry.includes('Diş'));
    assert.ok(res.spec.services.length >= 4, 'Should synthesize healthcare business activities');
  });

  await t.test('4. Synthesizes full corporate project using Google Maps spec', () => {
    const corporateGen = createCorporateGenerator({
      sourceKurumsalPath: 'D:\\Antigravity\\onlunet-kurumsal'
    });

    const mockMapsSpec = {
      companyName: 'Nusret Steakhouse & Izgara',
      industry: 'Restoran & Gastronomi',
      slogan: 'Eşsiz Lezzetler, Unutulmaz Anlar',
      description: 'Geleneksel tarifler ve birinci sınıf et çeşitleriyle gurme lezzet deneyimi sunuyoruz.',
      isFoodHospitality: true,
      services: [
        {
          title: 'Özel Kuru Dinlendirilmiş Dana Antrikot',
          slug: 'kuru-dinlendirilmis-dana-antrikot',
          price: '₺980',
          categoryTag: 'Şefin Spesiyalleri',
          summary: '28 gün özel kaya tuzu odalarında dinlendirilmiş enfes antrikot.',
          body: 'Meşe odununda dinlendirilmiş ve meşe kömürü ızgarasında mühürlenmiş antrikot eti.',
          specs: [{ label: 'Gramaj', value: '350g' }, { label: 'Pişirme', value: 'Meşe Kömürü' }],
          features: [{ title: 'Himalaya Tuzu Odası', desc: '28 gün dinlendirme' }],
          workflow: [{ step: '01', title: 'Seçim', desc: 'Et seçimi' }],
          faqs: [{ question: 'Nasıl pişirilir?', answer: 'Orta pişmiş önerilir.' }]
        },
        {
          title: 'Geleneksel Fıstıklı İlikli Kebap',
          slug: 'fistikli-ilikli-kebap',
          price: '₺720',
          categoryTag: 'Geleneksel Lezzetler',
          summary: 'Gaziantep boz fıstığı ile zırh kıymasından hazırlanan özel kebap.',
          body: 'Özel baharat karışımı ve taze lavaş eşliğinde sunulan gurme kebap.',
          specs: [{ label: 'Gramaj', value: '250g' }],
          features: [{ title: 'Doğal Malzeme', desc: 'Katkısız içerik' }],
          workflow: [{ step: '01', title: 'Zırhlama', desc: 'Elde kıyılır' }],
          faqs: [{ question: 'Acılı mı?', answer: 'Hafif acılıdır.' }]
        }
      ],
      contact: {
        phone: '+90 212 555 1234',
        email: 'rezervasyon@nusretsteak.com',
        address: 'Nispetiye Cad. No:87 Etiler',
        city: 'İstanbul, Türkiye',
        workingHours: 'Hergün: 11:30 - 00:00'
      },
      googleRating: '4.8',
      googleReviewCount: '1,450',
      googleReviews: [
        {
          author: 'Caner Özkan',
          stars: '★★★★★',
          text: 'Etlerin lezzeti ve sunum inanılmazdı. Özellikle kuru dinlendirilmiş antrikot muazzamdı.',
          date: '2 gün önce',
          source: 'Google Haritalar'
        },
        {
          author: 'Zeynep Aktaş',
          stars: '★★★★★',
          text: 'Harika bir gastronomi deneyimi. Servis hızı ve güler yüzlü personel 10 numara.',
          date: 'Geçen hafta',
          source: 'Google Haritalar'
        }
      ],
      theme: 'amber',
      targetDir: 'projeler/nusret-steakhouse'
    };

    const synthesis = corporateGen.synthesizeCorporateProject(mockMapsSpec);

    assert.equal(synthesis.projectName, 'Nusret Steakhouse & Izgara');
    assert.ok(synthesis.files.length > 50, 'Should synthesize all core files');

    // 1. Verify resources/views/frontend/home.php contains Google Reviews section & HTML
    const homeFile = synthesis.files.find(f => f.path === 'resources/views/frontend/home.php');
    assert.ok(homeFile, 'home.php must exist');
    assert.ok(homeFile.content.includes('Müşteri & Ziyaretçi Değerlendirmeleri') || homeFile.content.includes('Google Haritalar'), 'Should include Google reviews section in home.php');
    assert.ok(homeFile.content.includes('Caner Özkan'), 'Should include reviewer name in home.php');
    assert.ok(homeFile.content.includes('4.8'), 'Should include Google rating in home.php');
    assert.ok(homeFile.content.includes('₺980'), 'Should include price badge in home.php');

    // 2. Verify tailored-frontend.js exports googleReviews metadata
    const tailoredFrontend = synthesis.files.find(f => f.path === 'scripts/tailored-frontend.js');
    assert.ok(tailoredFrontend, 'tailored-frontend.js must exist');
    assert.ok(tailoredFrontend.content.includes('googleReviews'), 'Should export googleReviews');
    assert.ok(tailoredFrontend.content.includes('Caner Özkan'), 'Should include reviewer name in tailored-frontend.js');
  });

  await t.test('5. HTTP Endpoint POST /api/corporate/inspect-maps', async () => {
    let server = null;
    let baseUrl = '';

    await new Promise((resolve) => {
      server = createApplicationServer();
      server.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    try {
      // 5a. Missing URL validation
      const badReq = await fetch(`${baseUrl}/api/corporate/inspect-maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      assert.equal(badReq.status, 400);
      const badData = await badReq.json();
      assert.equal(badData.success, false);

      // 5b. Valid inspection request
      const goodReq = await fetch(`${baseUrl}/api/corporate/inspect-maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://www.google.com/maps/place/Hafiz+Mustafa+1864/@41.015,28.978,17z/'
        })
      });
      assert.equal(goodReq.status, 200);
      const goodData = await goodReq.json();
      assert.equal(goodData.success, true);
      assert.ok(goodData.spec);
      assert.ok(goodData.spec.companyName);
      assert.ok(goodData.spec.googleRating);
      assert.ok(goodData.spec.services.length >= 3);

      // 5c. Plan generation with maps spec via /api/corporate/plan
      const planReq = await fetch(`${baseUrl}/api/corporate/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goodData.spec)
      });
      assert.equal(planReq.status, 200);
      const planData = await planReq.json();
      assert.equal(planData.success, true);
      assert.ok(planData.plan);
      assert.ok(planData.synthesis.files.length > 50);

    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

});
