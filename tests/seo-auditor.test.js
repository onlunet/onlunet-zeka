import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHtmlForSeo, normalizeTargetUrl } from '../src/autonomous/seo-scraper.js';
import { calculateSeoScore, evaluateGeoReadiness, generateAiRemediationPackage, auditWebsiteSeo } from '../src/autonomous/seo-auditor.js';

test('ONLUNET ZEKA — SEO Auditor & Radar Engine', async (t) => {

  await t.test('1. Normalizes URL correctly', () => {
    assert.equal(normalizeTargetUrl('falconenerji.com'), 'https://falconenerji.com');
    assert.equal(normalizeTargetUrl('http://localhost:8080'), 'http://localhost:8080');
    assert.throws(() => normalizeTargetUrl(''), /Geçersiz/);
  });

  await t.test('2. Exhaustively parses HTML elements for SEO', () => {
    const sampleHtml = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="utf-8">
        <title>Falcon Enerji | Endüstriyel Akü ve Güneş Paneli Sistemleri</title>
        <meta name="description" content="Falcon Enerji, endüstriyel forklift aküleri ve anahtar teslim solar güneş enerjisi sistemleri alanında lider çözümler sunar. Hemen teklif alın.">
        <link rel="canonical" href="https://falconenerji.com/">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Falcon Enerji"
        }
        </script>
      </head>
      <body>
        <h1>Endüstriyel Enerji Çözümleri</h1>
        <h2>Forklift Aküsü Çeşitleri</h2>
        <p>Falcon Enerji olarak traksiyoner akü, lityum batarya ve güneş enerjisi sistemlerinde uzmanız. İletişim için telefon numaramızdan bize ulaşabilirsiniz.</p>
        <img src="/img/aku1.webp" alt="Traksiyoner Forklift Aküsü">
        <img src="/img/aku2.jpg">
        <a href="/tr/hizmetlerimiz/">Hizmetlerimiz</a>
        <a href="https://google.com" rel="nofollow">Google</a>
      </body>
      </html>
    `;

    const parsed = parseHtmlForSeo(sampleHtml, 'https://falconenerji.com/');
    assert.equal(parsed.title.isPresent, true);
    assert.ok(parsed.title.text.includes('Falcon Enerji'));
    assert.equal(parsed.metaDescription.isPresent, true);
    assert.equal(parsed.canonical.isPresent, true);
    assert.equal(parsed.canonical.isSelfReferencing, true);
    assert.equal(parsed.viewport.isResponsive, true);
    assert.equal(parsed.headings.h1.length, 1);
    assert.equal(parsed.headings.h2.length, 1);
    assert.equal(parsed.images.total, 2);
    assert.equal(parsed.images.missingAltCount, 1);
    assert.equal(parsed.images.modernFormatCount, 1);
    assert.equal(parsed.links.internalCount, 1);
    assert.equal(parsed.links.externalCount, 1);
    assert.equal(parsed.links.nofollowCount, 1);
    assert.equal(parsed.schemas.length, 1);
    assert.ok(parsed.schemaTypes.includes('Organization'));
  });

  await t.test('3. Computes multi-dimensional 100-point SEO Score accurately', () => {
    const mockScraped = {
      url: 'https://falconenerji.com/',
      statusCode: 200,
      responseTimeMs: 380,
      securityHeaders: { isHttps: true },
      robotsTxt: { exists: true, isDisallowingAll: false },
      sitemapXml: { exists: true, urlCount: 15 },
      canonical: { isPresent: true },
      metaRobots: { isIndexable: true },
      title: { isPresent: true, text: 'Falcon Enerji | Endüstriyel Akü ve Solar', length: 42 },
      metaDescription: { isPresent: true, text: 'Falcon Enerji endüstriyel forklift aküleri ve güneş panelleri için kurumsal teklif sunar.', length: 135 },
      headings: { h1: ['Endüstriyel Akü'], h2: ['Modeller', 'Avantajlar'] },
      content: { wordCount: 650, textToHtmlRatio: 18, sampleText: 'telefon iletisim hakkimizda vizyon' },
      links: { internalCount: 10, externalCount: 2 },
      schemas: [{ '@type': 'Organization' }, { '@type': 'FAQPage' }],
      schemaTypes: ['Organization', 'FAQPage'],
      viewport: { isResponsive: true },
      images: { total: 4, missingAltCount: 0, modernFormatCount: 4 }
    };

    const scoreResult = calculateSeoScore(mockScraped);
    assert.ok(scoreResult.totalScore >= 85, `Score should be >= 85, got ${scoreResult.totalScore}`);
    assert.ok(['A+', 'A'].includes(scoreResult.grade));
    assert.equal(scoreResult.criticalIssues.length, 0);
  });

  await t.test('4. Evaluates 2026 GEO & AI Overviews readiness', () => {
    const mockScraped = {
      headings: { all: [{ level: 'h1', text: 'Başlık' }, { level: 'h2', text: 'Nedir?' }, { level: 'h2', text: 'Avantajlar' }, { level: 'h2', text: 'Fiyatlar' }] },
      schemaTypes: ['FAQPage'],
      content: { wordCount: 700, sampleText: 'forklift aküsü nedir ve nasıl çalışır avantajları nelerdir' }
    };

    const geo = evaluateGeoReadiness(mockScraped);
    assert.ok(geo.score >= 80, `GEO score should be >= 80, got ${geo.score}`);
    assert.equal(geo.hasDirectAnswers, true);
    assert.equal(geo.hasFaqSchema, true);
  });

  await t.test('5. Generates high-CTR AI Remediation & Financial ROI Package', async () => {
    const mockScraped = {
      url: 'https://falconenerji.com/',
      statusCode: 200,
      responseTimeMs: 350,
      securityHeaders: { isHttps: true },
      robotsTxt: { exists: true },
      sitemapXml: { exists: true },
      canonical: { isPresent: true },
      metaRobots: { isIndexable: true },
      title: { isPresent: true, text: 'Falcon Enerji', length: 13 },
      metaDescription: { isPresent: false, text: '', length: 0 },
      headings: { h1: ['Akü Sistemleri'], h2: [] },
      content: { wordCount: 450, sampleText: 'akü enerji solar batarya' },
      links: { internalCount: 4 },
      schemas: [],
      schemaTypes: [],
      viewport: { isResponsive: true },
      images: { total: 2, missingAltCount: 1, modernFormatCount: 0 }
    };

    const fullAudit = await auditWebsiteSeo(mockScraped);
    assert.ok(fullAudit.totalScore > 0);
    assert.ok(fullAudit.aiPackage.optimizedTitle.length > 0);
    assert.ok(fullAudit.aiPackage.optimizedDescription.length > 0);
    assert.ok(fullAudit.aiPackage.organizationSchemaJson.includes('Organization'));
    assert.ok(fullAudit.aiPackage.faqSchemaJson.includes('FAQPage'));
    assert.ok(fullAudit.aiPackage.geoDirectSnippet.length > 50);
    assert.ok(fullAudit.aiPackage.financialRoi.monthlySavingsTry > 0);
  });

});
