import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SectorArchetypes,
  detectSectorArchetype,
  renderArchetypeHero,
  renderArchetypeStats,
  renderArchetypeCatalog,
  renderArchetypeInteractiveTool
} from '../src/autonomous/sector-archetypes.js';
import { createCorporateGenerator } from '../src/autonomous/corporate-generator.js';

test('ONLUNET ZEKA — Sector Archetype Bespoke Engine', async (t) => {
  await t.test('1. Accurately detects sector archetype based on industry, company, and offerings', () => {
    assert.equal(
      detectSectorArchetype({ industry: 'Güneş Enerjisi ve Akü', companyName: 'Falcon Enerji' }).id,
      'ENERGY_INDUSTRIAL'
    );
    assert.equal(
      detectSectorArchetype({ industry: 'Lojistik', companyName: 'Akdeniz Lojistik', services: ['Karayolu Taşıma'] }).id,
      'LOGISTICS_FREIGHT'
    );
    assert.equal(
      detectSectorArchetype({ industry: 'Sağlık & Medikal', companyName: 'Avrasya Sağlık' }).id,
      'HEALTH_MEDICAL'
    );
    assert.equal(
      detectSectorArchetype({ industry: 'Bilişim ve Siber Güvenlik', companyName: 'Nova Teknoloji' }).id,
      'TECH_SOFTWARE'
    );
    assert.equal(
      detectSectorArchetype({ industry: 'İnşaat ve Taahhüt', companyName: 'Kaya Mimarlık' }).id,
      'CONSTRUCTION_REAL_ESTATE'
    );
    assert.equal(
      detectSectorArchetype({ industry: 'Kurumsal Danışmanlık', companyName: 'Vera Strateji' }).id,
      'CORPORATE_CONSULTING'
    );
  });

  await t.test('2. Falcon Enerji (Solar & Akü) generates bespoke industrial split-hero, catalog, and energy simulator', () => {
    const corporateGen = createCorporateGenerator();
    const spec = {
      companyName: 'Falcon Enerji',
      industry: 'Endüstriyel Akü & Solar Sistemleri',
      slogan: 'Güç ve Enerji Sistemlerinde Kesintisiz Mühendislik Çözümleri',
      description: 'Endüstriyel aküler, güneş enerjisi ve forklift bataryalarında güvenilir çözüm ortağınız.',
      contact: { phone: '+90 532 555 1234', email: 'info@falconenerji.com' },
      theme: { palette: 'gold' },
      products: [
        { title: 'Forklift Traksiyoner Aküleri', badge: 'Yüksek Çevrim' },
        { title: 'Solar Jel Aküler', badge: 'Derin Deşarj' },
        { title: 'LiFePO4 Lityum Akü', badge: 'Hızlı Şarj' }
      ],
      funfacts: [
        { value: '7+', label: 'Yıllık Saha Tecrübesi' },
        { value: '18+', label: 'GES Projesi' },
        { value: '176+', label: 'Tesis Desteği' }
      ]
    };

    const synthesis = corporateGen.synthesizeCorporateProject(spec);
    const homeFile = synthesis.files.find(f => f.path === 'resources/views/frontend/home.php');

    assert.ok(homeFile, 'home.php must exist');
    const content = homeFile.content;

    // Must have split hero with industrial live widget
    assert.ok(content.includes('SEKTÖREL ÖZEL HERO (ARCHETYPE: ENERGY_INDUSTRIAL)'));
    assert.ok(content.includes('Endüstriyel Çözüm Hattı'));
    assert.ok(content.includes('Traksiyoner / Lityum / Jel'));
    assert.ok(content.includes('WhatsApp Danışma'));

    // Must have real extracted/supplied stats
    assert.ok(content.includes('7+'));
    assert.ok(content.includes('Yıllık Saha Tecrübesi'));
    assert.ok(content.includes('18+'));

    // Must have the dedicated industrial equipment catalog
    assert.ok(content.includes('id="katalog"'));
    assert.ok(content.includes('Forklift Traksiyoner Aküleri'));
    assert.ok(content.includes('Solar Jel Aküler'));
    assert.ok(content.includes('LiFePO4 Lityum Akü'));

    // Must have the live interactive battery & energy payback simulator
    assert.ok(content.includes('Akü Kapasite & Solar Enerji Amortisman Simülatörü'));
    assert.ok(content.includes('calcEnergySim'));
    assert.ok(content.includes('applySimToLeadForm'));

    // Must have bespoke standards
    assert.ok(content.includes('Endüstriyel Akü & GES Uzmanlığı'));
  });

  await t.test('3. Akdeniz Lojistik generates completely distinct logistics UI with freight transit simulator', () => {
    const corporateGen = createCorporateGenerator();
    const spec = {
      companyName: 'Akdeniz Lojistik',
      industry: 'Uluslararası Taşımacılık & Navlun',
      slogan: 'Dünyayı Birbirine Bağlayan Güvenilir Lojistik Ağı',
      contact: { phone: '+90 212 555 9988' },
      theme: { palette: 'blue' }
    };

    const synthesis = corporateGen.synthesizeCorporateProject(spec);
    const homeFile = synthesis.files.find(f => f.path === 'resources/views/frontend/home.php');

    assert.ok(homeFile, 'home.php must exist');
    const content = homeFile.content;

    // Must have logistics hero
    assert.ok(content.includes('SEKTÖREL ÖZEL HERO (ARCHETYPE: LOGISTICS_FREIGHT)'));
    assert.ok(content.includes('Küresel Navlun & Hat Güzergahları'));
    assert.ok(content.includes('Avrupa Karayolu Hattı'));

    // Must have freight simulator
    assert.ok(content.includes('Uluslararası & Yurtiçi Navlun ve Taşıma Simülatörü'));
    assert.ok(content.includes('calcFreightSim'));
    assert.ok(content.includes('applyFreightToLead'));

    // Must NOT contain energy simulator
    assert.ok(!content.includes('Akü Kapasite & Solar Enerji Amortisman Simülatörü'));
  });
});
