/**
 * ONLUNET ZEKA — Information Architecture & Dynamic Sitemap Engine (FAZ 76)
 *
 * Capabilities:
 * 1. Derives minimum necessary site hierarchy strictly from verified content (Zero Thin Content Guarantee).
 * 2. Generates:
 *    - sitemapTree: Navigational and structural hierarchy for frontend menu & breadcrumbs
 *    - flatRoutes: Clean canonical URL list with SEO priority & changefreq
 *    - xmlSitemap: Valid RFC 8288 compliant sitemap.xml
 *    - robotsTxt: Standards-compliant robots.txt linking to sitemap.xml
 * 3. Never produces empty dummy placeholder pages.
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js.
 */

/**
 * Builds Information Architecture from a CorporateSiteSpec.
 *
 * @param {object} spec - Canonical CorporateSiteSpec
 * @param {object} options - Options including baseUrl
 * @returns {object} Architecture structure with sitemapTree, flatRoutes, xmlSitemap, robotsTxt
 */
export function buildInformationArchitecture(spec = {}, options = {}) {
  const baseUrl = (options.baseUrl || spec.seo?.canonicalBase || 'https://kurumsal-proje.com').replace(/\/+$/, '');
  const flatRoutes = [];
  const sitemapTree = [];

  // 1. Home Page
  const homeNode = {
    path: '/tr/',
    title: spec.company?.name || 'Ana Sayfa',
    type: 'home',
    priority: '1.0',
    changefreq: 'weekly',
    children: []
  };
  flatRoutes.push({
    path: '/tr/',
    title: spec.company?.name ? `${spec.company.name} | Ana Sayfa` : 'Ana Sayfa',
    type: 'home',
    priority: '1.0',
    changefreq: 'weekly'
  });
  sitemapTree.push(homeNode);

  // 2. Hakkımızda (About)
  if (spec.company?.description) {
    const aboutNode = {
      path: '/tr/hakkimizda/',
      title: 'Hakkımızda',
      type: 'page',
      priority: '0.8',
      changefreq: 'monthly',
      children: []
    };
    flatRoutes.push({ ...aboutNode, title: `Hakkımızda | ${spec.company?.name || 'Kurumsal'}` });
    sitemapTree.push(aboutNode);
  }

  // 3. Hizmetlerimiz (Services) — Only if services exist
  const services = Array.isArray(spec.services) ? spec.services : [];
  if (services.length > 0) {
    const serviceChildren = services.map(s => ({
      path: `/tr/hizmetlerimiz/${s.slug}/`,
      title: s.title,
      type: 'service',
      priority: '0.8',
      changefreq: 'monthly',
      children: []
    }));

    const servicesNode = {
      path: '/tr/hizmetlerimiz/',
      title: 'Hizmetlerimiz',
      type: 'catalog',
      priority: '0.9',
      changefreq: 'weekly',
      children: serviceChildren
    };
    flatRoutes.push({
      path: '/tr/hizmetlerimiz/',
      title: `Hizmetlerimiz | ${spec.company?.name || 'Kurumsal'}`,
      type: 'catalog',
      priority: '0.9',
      changefreq: 'weekly'
    });
    for (const child of serviceChildren) {
      flatRoutes.push({
        ...child,
        title: `${child.title} | ${spec.company?.name || 'Kurumsal'}`
      });
    }
    sitemapTree.push(servicesNode);
  }

  // 4. Ürünlerimiz (Products) — Only if products exist
  const products = Array.isArray(spec.products) ? spec.products : [];
  if (products.length > 0) {
    const productChildren = products.map(p => ({
      path: `/tr/urunler/${p.slug}/`,
      title: p.title,
      type: 'product',
      priority: '0.8',
      changefreq: 'weekly',
      children: []
    }));

    const productsNode = {
      path: '/tr/urunler/',
      title: 'Ürünlerimiz',
      type: 'catalog',
      priority: '0.9',
      changefreq: 'weekly',
      children: productChildren
    };
    flatRoutes.push({
      path: '/tr/urunler/',
      title: `Ürünlerimiz | ${spec.company?.name || 'Kurumsal'}`,
      type: 'catalog',
      priority: '0.9',
      changefreq: 'weekly'
    });
    for (const child of productChildren) {
      flatRoutes.push({
        ...child,
        title: `${child.title} | ${spec.company?.name || 'Kurumsal'}`
      });
    }
    sitemapTree.push(productsNode);
  }

  // 5. Ekibimiz (Team) — Only if team members exist
  const team = Array.isArray(spec.team) ? spec.team : [];
  if (team.length > 0) {
    const teamNode = {
      path: '/tr/ekibimiz/',
      title: 'Ekibimiz',
      type: 'team',
      priority: '0.7',
      changefreq: 'monthly',
      children: []
    };
    flatRoutes.push({ ...teamNode, title: `Ekibimiz | ${spec.company?.name || 'Kurumsal'}` });
    sitemapTree.push(teamNode);
  }

  // 6. Sıkça Sorulan Sorular (FAQ) — Only if FAQs exist
  const faq = Array.isArray(spec.faq) ? spec.faq : [];
  if (faq.length > 0) {
    const faqNode = {
      path: '/tr/sss/',
      title: 'Sıkça Sorulan Sorular',
      type: 'faq',
      priority: '0.7',
      changefreq: 'monthly',
      children: []
    };
    flatRoutes.push({ ...faqNode, title: `Sıkça Sorulan Sorular | ${spec.company?.name || 'Kurumsal'}` });
    sitemapTree.push(faqNode);
  }

  // 7. Müşteri Yorumları & Referanslar (Testimonials) — Only if testimonials exist
  const testimonials = Array.isArray(spec.testimonials) ? spec.testimonials : [];
  if (testimonials.length > 0) {
    const refNode = {
      path: '/tr/referanslar/',
      title: 'Referanslar & Değerlendirmeler',
      type: 'testimonials',
      priority: '0.7',
      changefreq: 'weekly',
      children: []
    };
    flatRoutes.push({ ...refNode, title: `Referanslar & Değerlendirmeler | ${spec.company?.name || 'Kurumsal'}` });
    sitemapTree.push(refNode);
  }

  // 8. Vaka Çalışmaları (Case Studies) — Only if case studies exist
  const caseStudies = Array.isArray(spec.caseStudies) ? spec.caseStudies : [];
  if (caseStudies.length > 0) {
    const csNode = {
      path: '/tr/vaka-calismalari/',
      title: 'Vaka Çalışmaları',
      type: 'case_studies',
      priority: '0.8',
      changefreq: 'monthly',
      children: []
    };
    flatRoutes.push({ ...csNode, title: `Vaka Çalışmaları | ${spec.company?.name || 'Kurumsal'}` });
    sitemapTree.push(csNode);
  }

  // 9. Blog — Only if blog articles exist
  const blog = Array.isArray(spec.blog) ? spec.blog : [];
  if (blog.length > 0) {
    const blogNode = {
      path: '/tr/blog/',
      title: 'Blog',
      type: 'blog',
      priority: '0.8',
      changefreq: 'weekly',
      children: []
    };
    flatRoutes.push({ ...blogNode, title: `Blog & Haberler | ${spec.company?.name || 'Kurumsal'}` });
    sitemapTree.push(blogNode);
  }

  // 10. İletişim (Contact)
  const contactNode = {
    path: '/tr/iletisim/',
    title: 'İletişim',
    type: 'contact',
    priority: '0.8',
    changefreq: 'monthly',
    children: []
  };
  flatRoutes.push({ ...contactNode, title: `İletişim | ${spec.company?.name || 'Kurumsal'}` });
  sitemapTree.push(contactNode);

  // XML Sitemap Generation
  const xmlUrls = flatRoutes.map(r => `  <url>
    <loc>${baseUrl}${r.path}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('\n');

  const xmlSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`;

  // robots.txt Generation
  const robotsTxt = `# robots.txt for ${spec.company?.name || 'Kurumsal Firma'}
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`;

  return Object.freeze({
    sitemapTree: Object.freeze(sitemapTree),
    flatRoutes: Object.freeze(flatRoutes),
    totalPageCount: flatRoutes.length,
    xmlSitemap,
    robotsTxt,
    summary: {
      hasServices: services.length > 0,
      hasProducts: products.length > 0,
      hasTeam: team.length > 0,
      hasFaq: faq.length > 0,
      hasTestimonials: testimonials.length > 0,
      hasCaseStudies: caseStudies.length > 0,
      hasBlog: blog.length > 0
    }
  });
}
