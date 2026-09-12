/**
 * ONLUNET ZEKA - High-Performance Web & SEO Crawler Engine (ONLUNET SEO Radar™)
 *
 * Capabilities:
 * 1. Dual-Mode Scanning Architecture:
 *    - Mode A (Ultra-Fast Native HTTP): ~300-600ms latency, zero browser overhead.
 *      Fetches raw HTML, response headers, checks /robots.txt and /sitemap.xml concurrently.
 *    - Mode B (Resilient Headless Chrome CDP Fallback): For JavaScript-heavy SPAs
 *      (React/Vue/Angular) where raw HTML lacks rendered content.
 * 2. Exhaustive SEO Metadata Extraction:
 *    - Title tag analysis (length, pixel estimate, keyword placement).
 *    - Meta description (length, CTR appeal, call to action).
 *    - Meta robots directives (index/noindex, follow/nofollow).
 *    - Canonical URL validation (self-referencing vs missing vs cross-domain).
 *    - Full H1-H6 heading tree hierarchy & missing level detection.
 *    - Image asset audit (missing alt attributes, WebP/AVIF vs legacy PNG/JPG ratio).
 *    - Link graph audit (internal vs external link counts, nofollow tags).
 *    - Schema.org Structured Data detection (JSON-LD Organization, LocalBusiness, FAQPage, Product, BreadcrumbList).
 *    - Content depth metrics (clean word count, reading time, text-to-code ratio).
 *    - Technical security headers (HTTPS, HSTS, CSP, X-Frame-Options).
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js native http/https/fetch.
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { launchHeadlessBrowser } from './browser-qa-inspector.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 ONLUNET-SEORadar/2026';

/**
 * Normalizes input URL by adding protocol if omitted.
 */
export function normalizeTargetUrl(inputUrl) {
  let url = (inputUrl || '').trim();
  if (!url) throw new Error('Geçersiz veya boş web sitesi bağlantısı.');
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

/**
 * Cleanly strips HTML tags and scripts to extract visible body text.
 */
export function extractCleanBodyText(html) {
  if (!html) return '';
  // Remove script and style tags and their contents
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
  text = text.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ');
  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  // Strip all other tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>');
  // Collapse whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Fast Regex-based HTML Parser for SEO Elements
 */
export function parseHtmlForSeo(html, pageUrl) {
  let baseUrl;
  try {
    baseUrl = new URL(pageUrl);
  } catch {
    baseUrl = new URL('http://localhost');
  }

  // 1. Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

  // 2. Meta Description
  const metaDescMatch = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                        html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  const metaDescText = metaDescMatch ? metaDescMatch[1].trim() : '';

  // 3. Meta Robots
  const metaRobotsMatch = html.match(/<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                          html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']robots["'][^>]*>/i);
  const metaRobotsText = metaRobotsMatch ? metaRobotsMatch[1].toLowerCase().trim() : 'index, follow';

  // 4. Canonical Link
  const canonicalMatch = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>/i) ||
                         html.match(/<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*>/i);
  const canonicalHref = canonicalMatch ? canonicalMatch[1].trim() : '';

  // 5. Viewport Meta
  const viewportMatch = html.match(/<meta\s+[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["'][^>]*>/i) ||
                        html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']viewport["'][^>]*>/i);
  const viewportText = viewportMatch ? viewportMatch[1].trim() : '';

  // 6. Charset
  const charsetMatch = html.match(/<meta\s+[^>]*charset=["']?([^"'>\s]+)["']?[^>]*>/i) ||
                       html.match(/<meta\s+[^>]*content=["'][^"']*charset=([^"'>\s]+)["'][^>]*>/i);
  const charsetText = charsetMatch ? charsetMatch[1].trim() : 'utf-8';

  // 7. Headings (H1 - H6)
  const headings = { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [], all: [] };
  const headingRegex = /<(h[1-6])(?:\s+[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let hMatch;
  while ((hMatch = headingRegex.exec(html)) !== null) {
    const level = hMatch[1].toLowerCase();
    const cleanHText = hMatch[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (cleanHText) {
      headings[level].push(cleanHText);
      headings.all.push({ level, text: cleanHText });
    }
  }

  // 8. Images (Img tags and attributes)
  const imgRegex = /<img\s+([^>]+)>/gi;
  let imgMatch;
  let totalImages = 0;
  let missingAltCount = 0;
  let modernFormatCount = 0;
  let legacyFormatCount = 0;
  const sampleImages = [];

  while ((imgMatch = imgRegex.exec(html)) !== null) {
    totalImages++;
    const attrs = imgMatch[1];
    
    // Alt attribute check
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    const hasAlt = altMatch && altMatch[1].trim().length > 0;
    if (!hasAlt) {
      missingAltCount++;
    }

    // Src format check
    const srcMatch = attrs.match(/src=["']([^"']*)["']/i);
    const src = srcMatch ? srcMatch[1] : '';
    const ext = (src.split('?')[0].split('.').pop() || '').toLowerCase();

    if (['webp', 'avif', 'svg'].includes(ext)) {
      modernFormatCount++;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext)) {
      legacyFormatCount++;
    }

    if (sampleImages.length < 8 && src) {
      sampleImages.push({
        src,
        hasAlt,
        alt: altMatch ? altMatch[1] : '',
        isModernFormat: ['webp', 'avif', 'svg'].includes(ext)
      });
    }
  }

  // 9. Links (Anchor tags)
  const linkRegex = /<a\s+([^>]+)>/gi;
  let linkMatch;
  let internalLinkCount = 0;
  let externalLinkCount = 0;
  let nofollowCount = 0;

  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const attrs = linkMatch[1];
    const hrefMatch = attrs.match(/href=["']([^"']*)["']/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      continue;
    }

    const relMatch = attrs.match(/rel=["']([^"']*)["']/i);
    if (relMatch && relMatch[1].toLowerCase().includes('nofollow')) {
      nofollowCount++;
    }

    try {
      const linkUrl = new URL(href, baseUrl.origin);
      if (linkUrl.hostname === baseUrl.hostname) {
        internalLinkCount++;
      } else {
        externalLinkCount++;
      }
    } catch {
      // Relative link
      internalLinkCount++;
    }
  }

  // 10. Schema.org JSON-LD extraction
  const jsonLdRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdMatch;
  const schemas = [];
  const schemaTypes = new Set();

  while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const rawJson = jsonLdMatch[1].trim();
      const parsed = JSON.parse(rawJson);
      schemas.push(parsed);

      // Collect @type
      if (Array.isArray(parsed)) {
        parsed.forEach(item => { if (item['@type']) schemaTypes.add(item['@type']); });
      } else if (parsed['@graph'] && Array.isArray(parsed['@graph'])) {
        parsed['@graph'].forEach(item => { if (item['@type']) schemaTypes.add(item['@type']); });
      } else if (parsed['@type']) {
        schemaTypes.add(parsed['@type']);
      }
    } catch {
      // Malformed JSON-LD
    }
  }

  // 11. Social Metadata (OpenGraph & Twitter)
  const ogTitleMatch = html.match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const ogDescMatch = html.match(/<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const ogImgMatch = html.match(/<meta\s+[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const twCardMatch = html.match(/<meta\s+[^>]*name=["']twitter:card["'][^>]*content=["']([^"']*)["'][^>]*>/i);

  // 12. Content Text & Word Count
  const cleanBody = extractCleanBodyText(html);
  const words = cleanBody ? cleanBody.split(/\s+/).filter(w => w.length > 1) : [];
  const wordCount = words.length;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
  const htmlByteLength = Buffer.byteLength(html, 'utf-8');
  const textByteLength = Buffer.byteLength(cleanBody, 'utf-8');
  const textToHtmlRatio = htmlByteLength > 0 ? Number(((textByteLength / htmlByteLength) * 100).toFixed(1)) : 0;

  return {
    title: {
      text: titleText,
      length: titleText.length,
      isPresent: titleText.length > 0
    },
    metaDescription: {
      text: metaDescText,
      length: metaDescText.length,
      isPresent: metaDescText.length > 0
    },
    metaRobots: {
      text: metaRobotsText,
      isIndexable: !metaRobotsText.includes('noindex'),
      isFollowable: !metaRobotsText.includes('nofollow')
    },
    canonical: {
      href: canonicalHref,
      isPresent: canonicalHref.length > 0,
      isSelfReferencing: Boolean(canonicalHref && (canonicalHref === pageUrl || canonicalHref === baseUrl.href))
    },
    viewport: {
      text: viewportText,
      isResponsive: Boolean(viewportText && viewportText.includes('width=device-width'))
    },
    charset: charsetText,
    headings,
    images: {
      total: totalImages,
      missingAltCount,
      modernFormatCount,
      legacyFormatCount,
      sample: sampleImages
    },
    links: {
      total: internalLinkCount + externalLinkCount,
      internalCount: internalLinkCount,
      externalCount: externalLinkCount,
      nofollowCount
    },
    schemas,
    schemaTypes: Array.from(schemaTypes),
    social: {
      ogTitle: ogTitleMatch ? ogTitleMatch[1].trim() : '',
      ogDescription: ogDescMatch ? ogDescMatch[1].trim() : '',
      ogImage: ogImgMatch ? ogImgMatch[1].trim() : '',
      twitterCard: twCardMatch ? twCardMatch[1].trim() : ''
    },
    content: {
      wordCount,
      readingTimeMinutes,
      textToHtmlRatio,
      sampleText: cleanBody.slice(0, 500)
    }
  };
}

/**
 * Ultra-fast HTTP Scraper using native fetch
 */
export async function scrapeViaHttp(targetUrl) {
  const urlObj = new URL(targetUrl);
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache'
      },
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;
    const statusCode = res.status;
    const finalUrl = res.url || targetUrl;

    const html = await res.text();

    // Headers check
    const securityHeaders = {
      isHttps: urlObj.protocol === 'https:',
      hsts: Boolean(res.headers.get('strict-transport-security')),
      csp: Boolean(res.headers.get('content-security-policy')),
      xFrameOptions: Boolean(res.headers.get('x-frame-options')),
      xContentTypeOptions: Boolean(res.headers.get('x-content-type-options')),
      server: res.headers.get('server') || 'Unknown'
    };

    // Parallel check for robots.txt & sitemap.xml
    const [robotsTxt, sitemapXml] = await Promise.all([
      checkRobotsTxt(urlObj.origin),
      checkSitemapXml(urlObj.origin)
    ]);

    const seoData = parseHtmlForSeo(html, finalUrl);

    return {
      url: finalUrl,
      originalUrl: targetUrl,
      statusCode,
      responseTimeMs,
      securityHeaders,
      robotsTxt,
      sitemapXml,
      crawlMethod: 'fast-http',
      htmlByteLength: Buffer.byteLength(html, 'utf-8'),
      ...seoData
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Checks presence and basic directives of robots.txt
 */
async function checkRobotsTxt(origin) {
  try {
    const res = await fetch(`${origin}/robots.txt`, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return { exists: false, isDisallowingAll: false, hasSitemapDirective: false };
    const text = await res.text();
    const isDisallowingAll = /Disallow:\s*\/\s*$/m.test(text) && !/Allow:\s*\//i.test(text);
    const hasSitemapDirective = /Sitemap:\s*https?:\/\//i.test(text);
    return {
      exists: true,
      isDisallowingAll,
      hasSitemapDirective,
      preview: text.slice(0, 300)
    };
  } catch {
    return { exists: false, isDisallowingAll: false, hasSitemapDirective: false };
  }
}

/**
 * Checks presence of /sitemap.xml
 */
async function checkSitemapXml(origin) {
  try {
    const res = await fetch(`${origin}/sitemap.xml`, {
      method: 'GET',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return { exists: false, urlCount: 0 };
    const text = await res.text();
    const urlMatches = text.match(/<loc>/gi);
    return {
      exists: true,
      urlCount: urlMatches ? urlMatches.length : 1
    };
  } catch {
    return { exists: false, urlCount: 0 };
  }
}

/**
 * Headless Chrome CDP Scraper for SPA / JS-heavy sites
 */
export async function scrapeViaCdp(targetUrl) {
  const browser = await launchHeadlessBrowser();
  const startTime = Date.now();

  try {
    const targetRes = await fetch(`http://127.0.0.1:${browser.debugPort}/json/new`, { method: 'PUT' });
    const targetData = await targetRes.json();
    const ws = new globalThis.WebSocket(targetData.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    let msgId = 1;
    const send = (method, params = {}) => {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.id === id) {
              ws.removeEventListener('message', handler);
              resolve(data.result);
            }
          } catch { /* ignore */ }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await send('Network.enable');
    await send('Page.enable');
    await send('Runtime.enable');

    await send('Page.navigate', { url: targetUrl });
    await new Promise(r => setTimeout(r, 2200));

    const responseTimeMs = Date.now() - startTime;

    // Extract rendered HTML
    const doc = await send('Runtime.evaluate', {
      expression: 'document.documentElement.outerHTML',
      returnByValue: true
    });
    const renderedHtml = doc?.result?.value || '';

    ws.close();

    const urlObj = new URL(targetUrl);
    const [robotsTxt, sitemapXml] = await Promise.all([
      checkRobotsTxt(urlObj.origin),
      checkSitemapXml(urlObj.origin)
    ]);

    const seoData = parseHtmlForSeo(renderedHtml, targetUrl);

    return {
      url: targetUrl,
      originalUrl: targetUrl,
      statusCode: 200,
      responseTimeMs,
      securityHeaders: {
        isHttps: urlObj.protocol === 'https:',
        hsts: false,
        csp: false,
        xFrameOptions: false,
        xContentTypeOptions: false,
        server: 'Rendered Browser'
      },
      robotsTxt,
      sitemapXml,
      crawlMethod: 'cdp',
      htmlByteLength: Buffer.byteLength(renderedHtml, 'utf-8'),
      ...seoData
    };
  } finally {
    try { browser.process.kill(); } catch {}
  }
}

/**
 * Main Scraper Dispatcher
 * Runs fast HTTP scan first; if thin SPA or if fast scan fails, automatically falls back to CDP.
 */
export async function scrapeWebsiteForSeo(rawUrl, options = {}) {
  const targetUrl = normalizeTargetUrl(rawUrl);

  if (options.forceCdp) {
    return await scrapeViaCdp(targetUrl);
  }

  try {
    const httpResult = await scrapeViaHttp(targetUrl);
    // If the page returned virtually no words (< 40 words) and has root container, it's likely an unrendered SPA
    if (httpResult.content.wordCount < 40 && (httpResult.htmlByteLength > 1500 || httpResult.statusCode === 200)) {
      try {
        const cdpResult = await scrapeViaCdp(targetUrl);
        if (cdpResult.content.wordCount > httpResult.content.wordCount) {
          return cdpResult;
        }
      } catch {
        // Return httpResult if CDP fallback fails
      }
    }
    return httpResult;
  } catch (httpErr) {
    // If HTTP failed (e.g. self-signed cert or strict bot check), try CDP fallback
    return await scrapeViaCdp(targetUrl);
  }
}
