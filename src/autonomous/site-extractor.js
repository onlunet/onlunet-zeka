/**
 * ONLUNET ZEKA - Autonomous Legacy Website Extractor & AI Content Enricher
 *
 * Capabilities:
 * 1. Deep HTML & Metadata Extraction:
 *    - Page Title, OpenGraph tags, meta description, JSON-LD Organization / LocalBusiness schemas
 *    - Company name, business slogan, mission/vision, about narrative
 *    - Navigation hierarchy, header menus, services submenus, product submenus
 *    - Services and product catalogs
 *    - Contact information (Turkish mobile/landline regex, WhatsApp widget, email, address, city/province)
 *    - Social media URLs (Facebook, Instagram, YouTube, LinkedIn, Twitter/X)
 *    - Google Maps embed or location URL
 *    - Primary brand color detection from Elementor / theme CSS variables / inline styles
 *    - Color matching to CorporatePalettes (gold, blue, emerald, purple, crimson)
 * 2. AI Content Enrichment:
 *    - Detects empty or thin service descriptions and generates rich, persuasive corporate copy
 *    - Semantically infers SVG icon names (e.g. sun, battery-charging, truck, shield-check, cpu, etc.)
 *    - Generates sector-relevant FAQs (Sıkça Sorulan Sorular)
 *    - Expands about narratives and creates punchy taglines/slogans if missing
 *    - Built-in rich Turkish enterprise domain engine + AI Gateway / Gemini interoperability
 * 3. Corporate Generator Specification Mapping:
 *    - Maps extracted and enriched data directly to `synthesizeCorporateProject()` spec
 *
 * ZERO EXTERNAL RUNTIME DEPENDENCIES: Pure Node.js.
 */

import https from 'node:https';
import http from 'node:http';
import { CorporatePalettes } from './corporate-generator.js';

/**
 * Validates a target URL against SSRF and malicious protocol attacks.
 * Rejects non-HTTP(S) protocols, credentials, internal/private IPs, loopbacks, and cloud metadata endpoints.
 */
export function validateUrlSecurity(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    throw new Error('[SECURITY_BLOCKED] URL must be a non-empty string.');
  }

  // Reject CRLF injection or control characters
  if (/[\r\n\0\t]/.test(urlString)) {
    throw new Error('[SECURITY_BLOCKED] URL contains illegal control characters.');
  }

  const trimmed = urlString.trim();
  // If URL has an explicit scheme that is not http: or https:, reject immediately
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    throw new Error(`[SECURITY_BLOCKED] Forbidden protocol scheme in URL '${trimmed}'. Only HTTP and HTTPS are allowed.`);
  }

  let formatted = trimmed;
  if (!/^https?:\/\//i.test(formatted)) {
    formatted = 'https://' + formatted;
  }

  let parsed;
  try {
    parsed = new URL(formatted);
  } catch (err) {
    throw new Error(`[SECURITY_BLOCKED] Invalid URL format: ${err.message}`);
  }

  // Protocol check
  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error(`[SECURITY_BLOCKED] Protocol '${protocol}' is forbidden. Only HTTP and HTTPS are allowed.`);
  }

  // Reject embedded credentials (user:pass@host)
  if (parsed.username || parsed.password) {
    throw new Error('[SECURITY_BLOCKED] URLs with user credentials are forbidden.');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!hostname) {
    throw new Error('[SECURITY_BLOCKED] URL does not contain a valid hostname.');
  }

  // Loopback / Localhost names
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname.endsWith('.corp') ||
    hostname.endsWith('.nip.io') ||
    hostname.endsWith('.sslip.io') ||
    hostname === 'localtest.me'
  ) {
    throw new Error(`[SECURITY_BLOCKED] SSRF Protection: Loopback/internal hostname '${hostname}' is forbidden.`);
  }

  // IPv6 loopback / private checks
  if (
    hostname === '::1' ||
    hostname === '0:0:0:0:0:0:0:1' ||
    hostname.startsWith('fe80:') ||
    hostname.startsWith('fc00:') ||
    hostname.startsWith('fd00:')
  ) {
    throw new Error(`[SECURITY_BLOCKED] SSRF Protection: Private IPv6 address '${hostname}' is forbidden.`);
  }

  // Hexadecimal / Octal / Decimal integer IPv4 representations (e.g. 0x7f000001, 2130706433, 0177.0.0.1)
  if (/^0x[0-9a-f]+$/i.test(hostname) || /^\d+$/.test(hostname)) {
    throw new Error(`[SECURITY_BLOCKED] SSRF Protection: Numeric/encoded IP address '${hostname}' is forbidden.`);
  }

  // IPv4 dotted-decimal checks
  const ipv4Parts = hostname.split('.');
  if (ipv4Parts.length === 4 && ipv4Parts.every(part => /^\d+$/.test(part))) {
    const [p0, p1, p2, p3] = ipv4Parts.map(p => parseInt(p, 10));

    if (p0 > 255 || p1 > 255 || p2 > 255 || p3 > 255) {
      throw new Error(`[SECURITY_BLOCKED] SSRF Protection: Invalid IPv4 octet in '${hostname}'.`);
    }

    // 127.0.0.0/8 (Loopback)
    if (p0 === 127) {
      throw new Error(`[SECURITY_BLOCKED] SSRF Protection: Loopback IP '${hostname}' is forbidden.`);
    }

    // 0.0.0.0/8 (Current network)
    if (p0 === 0) {
      throw new Error(`[SECURITY_BLOCKED] SSRF Protection: Zero address '${hostname}' is forbidden.`);
    }

    // 10.0.0.0/8 (Private)
    if (p0 === 10) {
      throw new Error(`[SECURITY_BLOCKED] SSRF Protection: Private IP '${hostname}' is forbidden.`);
    }

    // 172.16.0.0/12 (Private: 172.16.x.x - 172.31.x.x)
    if (p0 === 172 && p1 >= 16 && p1 <= 31) {
      throw new Error(`[SECURITY_BLOCKED] SSRF Protection: Private IP '${hostname}' is forbidden.`);
    }

    // 192.168.0.0/16 (Private)
    if (p0 === 192 && p1 === 168) {
      throw new Error(`[SECURITY_BLOCKED] SSRF Protection: Private IP '${hostname}' is forbidden.`);
    }

    // 169.254.0.0/16 (Link-Local & Cloud Metadata: AWS/GCP/Azure/DO 169.254.169.254)
    if (p0 === 169 && p1 === 254) {
      throw new Error(`[SECURITY_BLOCKED] SSRF Protection: Cloud metadata/link-local IP '${hostname}' is forbidden.`);
    }

    // 100.64.0.0/10 (Carrier-grade NAT)
    if (p0 === 100 && p1 >= 64 && p1 <= 127) {
      throw new Error(`[SECURITY_BLOCKED] SSRF Protection: Shared address space '${hostname}' is forbidden.`);
    }

    // Multicast & Reserved (224.0.0.0/4 and 240.0.0.0/4)
    if (p0 >= 224) {
      throw new Error(`[SECURITY_BLOCKED] SSRF Protection: Multicast/reserved IP '${hostname}' is forbidden.`);
    }
  }

  return {
    valid: true,
    normalizedUrl: formatted,
    hostname,
    protocol
  };
}

/**
 * Fetches HTML content from a given URL with timeout and standard browser headers.
 * Includes automatic TLS fallback for sites with incomplete intermediate cert chains.
 */
export async function fetchWebsiteHtml(targetUrl, options = {}) {
  const security = validateUrlSecurity(targetUrl);
  const timeoutMs = options.timeoutMs || 10000;
  const userAgent = options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const urlString = security.normalizedUrl;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(urlString, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    return {
      success: true,
      url: urlString,
      html
    };
  } catch (err) {
    // Resilient fallback for legacy / self-signed / intermediate SSL issues
    if (
      err.cause?.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
      err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
      (err.message && err.message.includes('certificate'))
    ) {
      return new Promise((resolve, reject) => {
        const parsed = new URL(urlString);
        const client = parsed.protocol === 'http:' ? http : https;
        const req = client.get(urlString, {
          agent: parsed.protocol === 'https:' ? new https.Agent({ rejectUnauthorized: false }) : undefined,
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
          },
          timeout: timeoutMs
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let redirectUrl = res.headers.location;
            if (!redirectUrl.startsWith('http')) {
              redirectUrl = new URL(redirectUrl, urlString).toString();
            }
            return resolve(fetchWebsiteHtml(redirectUrl, options));
          }
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode} ${res.statusMessage}`));
          }
          let data = '';
          res.setEncoding('utf8');
          res.on('data', chunk => { data += chunk; });
          res.on('end', () => {
            resolve({
              success: true,
              url: urlString,
              html: data
            });
          });
        });
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timed out'));
        });
      });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Unescapes standard HTML entities.
 */
function unescapeHtml(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8221;/g, '"')
    .replace(/&#8220;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts Turkish/Latin text to clean URL slug.
 */
export function slugify(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Extracts clean slug from URL path, falling back to title.
 */
export function extractSlugFromUrl(url, fallbackTitle = '') {
  try {
    if (url && typeof url === 'string') {
      const cleanUrl = url.trim().replace(/^https?:\/\/[^\/]+/i, '').replace(/[?#].*$/, '');
      const parts = cleanUrl.split('/').filter(Boolean);
      if (parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        const s = slugify(lastPart);
        if (s && s !== 'html' && s !== 'php') return s;
      }
    }
  } catch (_) {}
  return slugify(fallbackTitle);
}

/**
 * Maps a hex color (e.g. #F8B200) to the closest CorporatePalette using Euclidean distance.
 */
export function matchBrandColorToPalette(hexColor) {
  if (!hexColor || typeof hexColor !== 'string') {
    return CorporatePalettes.BLUE;
  }

  const cleanHex = hexColor.trim().replace(/^#/, '');
  if (cleanHex.length !== 6 && cleanHex.length !== 3) {
    return CorporatePalettes.BLUE;
  }

  let r, g, b;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  }

  // Canonical RGB centroids for CorporatePalettes
  const palettes = [
    { key: 'GOLD', r: 217, g: 119, b: 6 },      // #d97706
    { key: 'BLUE', r: 37, g: 99, b: 235 },      // #2563eb
    { key: 'EMERALD', r: 5, g: 150, b: 105 },   // #059669
    { key: 'PURPLE', r: 124, g: 58, b: 237 },   // #7c3aed
    { key: 'CRIMSON', r: 220, g: 38, b: 38 }    // #dc2626
  ];

  let minDistance = Infinity;
  let bestKey = 'BLUE';
  for (const pal of palettes) {
    const d = Math.sqrt(Math.pow(r - pal.r, 2) + Math.pow(g - pal.g, 2) + Math.pow(b - pal.b, 2));
    if (d < minDistance) {
      minDistance = d;
      bestKey = pal.key;
    }
  }

  return CorporatePalettes[bestKey] || CorporatePalettes.BLUE;
}

/**
 * Intelligent Multi-Level Navigation & Offerings Extractor
 * Handles unclosed <li>, nested <ul class="sub-menu">, WordPress, Elementor, Bootstrap & custom DOM trees.
 */
export function extractNavigationTree(html, baseUrl = '') {
  if (!html || typeof html !== 'string') return [];

  // Find navigation block
  let navBlock = '';
  const navMatches = html.match(/<nav[\s\S]*?<\/nav>/gi) || [];
  if (navMatches.length > 0) {
    navBlock = navMatches.sort((a, b) => b.length - a.length)[0];
  } else {
    const headerMatch = html.match(/<header[\s\S]*?<\/header>/gi) || [];
    navBlock = headerMatch.length > 0 ? headerMatch[0] : html;
  }

  // Tokenize the nav HTML into tags and text
  const tagRegex = /<(\/?[a-zA-Z0-9]+)([^>]*)>/g;
  let match;

  const root = { tag: 'root', attrs: {}, children: [] };
  const stack = [root];

  let lastIndex = 0;
  while ((match = tagRegex.exec(navBlock)) !== null) {
    const textBefore = navBlock.substring(lastIndex, match.index);
    if (textBefore.trim() && stack.length > 0) {
      const top = stack[stack.length - 1];
      top.children.push({ type: 'text', text: textBefore });
    }
    lastIndex = tagRegex.lastIndex;

    const tagName = match[1].toLowerCase();
    const rawAttrs = match[2];
    const isClosing = tagName.startsWith('/');
    const cleanTag = isClosing ? tagName.substring(1) : tagName;

    const isSelfClosing = /^(img|br|hr|input|meta|link)$/i.test(cleanTag) || rawAttrs.endsWith('/');

    if (isClosing) {
      let foundIdx = -1;
      for (let s = stack.length - 1; s > 0; s--) {
        if (stack[s].tag === cleanTag) {
          foundIdx = s;
          break;
        }
      }
      if (foundIdx !== -1) {
        while (stack.length > foundIdx) {
          stack.pop();
        }
      }
    } else {
      // Auto-close preceding <li> if we encounter a new <li> at the same list level
      if (cleanTag === 'li') {
        const top = stack[stack.length - 1];
        if (top.tag === 'li') {
          stack.pop();
        }
      }

      const attrs = {};
      const attrMatches = rawAttrs.matchAll(/([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?/g);
      for (const am of attrMatches) {
        attrs[am[1].toLowerCase()] = am[2] !== undefined ? am[2] : true;
      }

      const node = {
        tag: cleanTag,
        attrs,
        children: []
      };

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node);
      }

      if (!isSelfClosing) {
        stack.push(node);
      }
    }
  }

  function getNodeText(node) {
    if (!node) return '';
    if (node.type === 'text') return node.text;
    let t = '';
    for (const c of (node.children || [])) {
      t += ' ' + getNodeText(c);
    }
    return unescapeHtml(t.replace(/\s+/g, ' ')).trim();
  }

  function parseNavUl(ulNode, parentTitle = '', level = 1) {
    const items = [];
    for (const child of (ulNode.children || [])) {
      if (child.tag === 'li') {
        let aNode = null;
        let nestedUlNode = null;

        for (const c of (child.children || [])) {
          if (c.tag === 'a' && !aNode) {
            aNode = c;
          } else if (c.tag === 'ul') {
            nestedUlNode = c;
          } else if (c.tag === 'div') {
            const subUl = (c.children || []).find(x => x.tag === 'ul');
            if (subUl) nestedUlNode = subUl;
          }
        }

        if (aNode) {
          let title = getNodeText(aNode).replace(/[▼▶►▼]/g, '').trim();
          let href = (aNode.attrs?.href || '').trim();
          let hasNoDirectUrl = !href || href === '#' || href.startsWith('javascript:');
          let slug = extractSlugFromUrl(href, title) || slugify(title);

          if (title && title.length < 100) {
            const children = nestedUlNode ? parseNavUl(nestedUlNode, title, level + 1) : [];

            const tLower = title.toLowerCase();
            const pLower = (parentTitle || '').toLowerCase();
            const uLower = href.toLowerCase();

            let category = 'page';
            if (level === 1 && (tLower === 'anasayfa' || tLower === 'ana sayfa')) {
              category = 'home';
            } else if (tLower.includes('kurumsal') || tLower.includes('hakkimizda') || tLower.includes('hakkımızda')) {
              category = 'corporate';
            } else if (tLower.includes('hizmet') || pLower.includes('hizmet') || uLower.includes('/hizmet')) {
              category = 'service';
            } else if (
              tLower.includes('urun') || tLower.includes('ürün') ||
              pLower.includes('urun') || pLower.includes('ürün') ||
              pLower.includes('akü') || pLower.includes('aku') ||
              tLower.includes('akü') || tLower.includes('aku') ||
              tLower.includes('forklift') || tLower.includes('transpalet') ||
              tLower.includes('istif') || tLower.includes('sarj') ||
              tLower.includes('şarj') || tLower.includes('jenerator') ||
              tLower.includes('redresor') || tLower.includes('atasman')
            ) {
              category = 'product';
            } else if (tLower.includes('iletisim') || tLower.includes('iletişim') || tLower.includes('teklif') || tLower.includes('bize ulasin')) {
              category = 'contact';
            } else if (tLower.includes('blog') || uLower.includes('/blog/')) {
              category = 'blog';
            }

            items.push({
              title,
              originalUrl: href,
              hasNoDirectUrl,
              slug,
              category,
              parentCategory: parentTitle || null,
              level,
              children
            });
          }
        }
      }
    }
    return items;
  }

  function findUl(node) {
    if (node.tag === 'ul') return node;
    for (const c of (node.children || [])) {
      const found = findUl(c);
      if (found) return found;
    }
    return null;
  }

  const rootUl = findUl(root);
  if (!rootUl) return [];

  return parseNavUl(rootUl);
}

/**
 * Extracts metadata, content, menus, services, and contacts from HTML.
 */
export function extractWebsiteMetadata(html, sourceUrl = '') {
  if (!html || typeof html !== 'string') {
    throw new Error('Valid HTML string is required for extraction');
  }

  const result = {
    sourceUrl,
    pageTitle: '',
    companyName: '',
    slogan: '',
    description: '',
    industry: '',
    logoUrl: '',
    brandColor: '#2563eb',
    paletteKey: 'blue',
    contact: {
      phone: '',
      email: '',
      address: '',
      city: '',
      whatsapp: '',
      social: {}
    },
    googleMapsUrl: '',
    menus: [],
    services: [],
    products: [],
    funfacts: [],
    faqs: [],
    aiEnrichedFields: []
  };

  // 1. Page Title & Meta Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    result.pageTitle = unescapeHtml(titleMatch[1]);
  }

  // 2. OpenGraph Meta Tags
  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const ogSiteNameMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
  const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);

  if (ogDescMatch) {
    result.description = unescapeHtml(ogDescMatch[1]);
  }
  if (ogImageMatch) {
    result.logoUrl = ogImageMatch[1];
  }

  // 3. JSON-LD Structured Data (Organization / WebSite)
  const jsonLdMatches = html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of jsonLdMatches) {
    try {
      const parsed = JSON.parse(m[1]);
      const graph = Array.isArray(parsed['@graph']) ? parsed['@graph'] : [parsed];
      for (const item of graph) {
        if (item['@type'] === 'Organization') {
          if (item.name && !result.companyName) {
            result.companyName = item.name;
          }
          if (item.logo?.url && !result.logoUrl) {
            result.logoUrl = item.logo.url;
          }
          if (item.description && !result.description) {
            result.description = unescapeHtml(item.description);
          }
          if (item.telephone && !result.contact.phone) {
            result.contact.phone = item.telephone;
          }
        }
      }
    } catch (_) {
      // ignore invalid json-ld
    }
  }

  // 4. Derive Company Name
  if (!result.companyName) {
    // Check heading inside header / logo
    const headingTitleMatch = html.match(/class=["'][^"']*elementor-heading-title[^"']*["']>([^<]+)<\/div>/i);
    if (headingTitleMatch && headingTitleMatch[1].length < 60) {
      result.companyName = unescapeHtml(headingTitleMatch[1]);
    } else if (ogSiteNameMatch) {
      result.companyName = unescapeHtml(ogSiteNameMatch[1].split('-')[0].split('|')[0].trim());
    } else if (result.pageTitle) {
      const cleanTitle = result.pageTitle.replace(/Anasayfa\s*[-|–]\s*/i, '');
      result.companyName = cleanTitle.split(/[-|–]/)[0].trim();
    }
  }

  // If companyName still contains long suffix, clean it up
  if (result.companyName) {
    result.companyName = result.companyName.replace(/\s+-\s+.*$/, '').trim();
  }

  // 5. Brand Color Extraction (from CSS variables, Elementor inline styles, e.g. #F8B200)
  const colorMatches = html.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || [];
  const colorFrequency = {};
  for (const hex of colorMatches) {
    const upper = hex.toUpperCase();
    // Exclude plain whites, blacks, grays
    if (!['#FFF', '#FFFFFF', '#000', '#000000', '#333', '#333333', '#F4F4F4', '#ECECEC', '#D0D5D2', '#DEDFE0', '#EBEBEB'].includes(upper)) {
      colorFrequency[upper] = (colorFrequency[upper] || 0) + 1;
    }
  }

  // Look for specific background/accent colors in style blocks
  const accentStyleMatch = html.match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6})!important/i)
    || html.match(/color\s*:\s*(#[0-9a-fA-F]{3,6})!important/i);
  if (accentStyleMatch) {
    result.brandColor = accentStyleMatch[1].toUpperCase();
  } else {
    // Find the most frequent saturated color
    let topColor = '#2563eb';
    let maxCount = 0;
    for (const [col, count] of Object.entries(colorFrequency)) {
      if (count > maxCount) {
        maxCount = count;
        topColor = col;
      }
    }
    result.brandColor = topColor;
  }

  const matchedPalette = matchBrandColorToPalette(result.brandColor);
  result.paletteKey = matchedPalette.id;

  // 6. Contact Information (Phone, Email, Address, WhatsApp)
  // WhatsApp widget regex (e.g. phone: "905545077731" or qlwapp data)
  const waMatch = html.match(/"phone"\s*:\s*"(\d{10,13})"/i) || html.match(/data-phone=["'](\d{10,13})["']/i);
  if (waMatch) {
    let rawPhone = waMatch[1];
    if (rawPhone.startsWith('90')) rawPhone = '0' + rawPhone.substring(2);
    result.contact.whatsapp = rawPhone;
    if (!result.contact.phone) {
      result.contact.phone = formatTurkishPhone(rawPhone);
    }
  }

  // General phone number pattern (0 5xx xxx xx xx or +90...)
  if (!result.contact.phone) {
    const phoneMatches = html.match(/(?:\+90|0)\s?[1-5][0-9]{2}\s?[0-9]{3}\s?[0-9]{2}\s?[0-9]{2}/g);
    if (phoneMatches && phoneMatches.length > 0) {
      result.contact.phone = phoneMatches[0].trim();
    }
  }

  // Email regex
  const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (mailtoMatch) {
    result.contact.email = mailtoMatch[1].trim();
  } else {
    const emailMatches = html.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
    if (emailMatches) {
      const valid = emailMatches.find(e => !e.endsWith('.png') && !e.endsWith('.jpg') && !e.includes('s.w.org'));
      if (valid) result.contact.email = valid.trim();
    }
  }

  // Address & City (Look for address markers, Tekirdağ / Çorlu, Trakya etc.)
  if (html.includes('Tekirdağ') || html.includes('Çorlu')) {
    result.contact.city = 'Tekirdağ / Çorlu';
  } else if (html.includes('İstanbul')) {
    result.contact.city = 'İstanbul';
  } else if (html.includes('Ankara')) {
    result.contact.city = 'Ankara';
  } else if (html.includes('İzmir')) {
    result.contact.city = 'İzmir';
  } else if (html.includes('Bursa')) {
    result.contact.city = 'Bursa';
  }

  // Search for address text in icon-box or footer
  const addressBoxMatch = html.match(/fa-map-marker-alt[\s\S]*?<h6[^>]*>([\s\S]*?)<\/h6>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  if (addressBoxMatch) {
    const region = unescapeHtml(addressBoxMatch[1]).replace(/<[^>]+>/g, '').trim();
    const subtext = unescapeHtml(addressBoxMatch[2]).replace(/<[^>]+>/g, '').trim();
    result.contact.address = `${region} - ${subtext}`;
  } else if (result.contact.city) {
    result.contact.address = `${result.contact.city}, Türkiye`;
  }

  // Social Links
  const socialNetworks = [
    { name: 'facebook', regex: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"']+)["']/i },
    { name: 'instagram', regex: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/i },
    { name: 'youtube', regex: /href=["'](https?:\/\/(?:www\.)?youtube\.com\/[^"']+)["']/i },
    { name: 'linkedin', regex: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/[^"']+)["']/i },
    { name: 'twitter', regex: /href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"']+)["']/i }
  ];
  for (const soc of socialNetworks) {
    const socM = html.match(soc.regex);
    if (socM) {
      result.contact.social[soc.name] = socM[1];
    }
  }

  // Google Maps URL
  const mapsIframeMatch = html.match(/src=["'](https?:\/\/(?:www\.)?google\.com\/maps\/embed[^"']+)["']/i);
  const mapsLinkMatch = html.match(/href=["'](https?:\/\/(?:maps\.app\.goo\.gl|maps\.google\.com|goo\.gl\/maps)\/[^"']+)["']/i);
  if (mapsIframeMatch) {
    result.googleMapsUrl = mapsIframeMatch[1];
  } else if (mapsLinkMatch) {
    result.googleMapsUrl = mapsLinkMatch[1];
  } else if (result.contact.city || result.companyName) {
    const query = encodeURIComponent(`${result.companyName} ${result.contact.city || ''}`.trim());
    result.googleMapsUrl = `https://maps.google.com/maps?q=${query}&output=embed`;
  }

  // 7. Navigation, Services, Products & Subpages Extraction (Robust Multi-Level Hierarchy Engine)
  result.pages = [];
  result.navigationTree = extractNavigationTree(html, sourceUrl);
  result.menus = [];

  const seenUrls = new Set();
  const seenSlugs = new Set();

  function walkNavItems(items, parentTitle = '') {
    for (const item of items) {
      const linkUrl = item.originalUrl || '';
      const linkTitle = item.title;
      const slug = item.slug || slugify(linkTitle);
      const uLower = linkUrl.toLowerCase();
      const tLower = linkTitle.toLowerCase();

      result.menus.push({
        title: linkTitle,
        url: linkUrl,
        slug,
        category: item.category,
        parentCategory: item.parentCategory,
        hasNoDirectUrl: item.hasNoDirectUrl,
        childrenCount: item.children ? item.children.length : 0
      });

      // Skip homepage
      if (
        tLower === 'anasayfa' ||
        tLower === 'ana sayfa' ||
        linkUrl === sourceUrl ||
        linkUrl === sourceUrl + '/' ||
        linkUrl === 'https://' ||
        linkUrl === '/'
      ) {
        if (item.children && item.children.length > 0) {
          walkNavItems(item.children, linkTitle);
        }
        continue;
      }

      // Root "Hizmetlerimiz" hub listing
      if (
        (tLower === 'hizmetlerimiz' || tLower === 'hizmetler') &&
        (uLower.endsWith('/hizmetlerimiz/') || uLower.endsWith('/hizmetlerimiz') || uLower.endsWith('/hizmetler/') || uLower.endsWith('/hizmetler'))
      ) {
        if (item.children && item.children.length > 0) {
          walkNavItems(item.children, linkTitle);
        }
        continue;
      }

      // Root "Ürünlerimiz" / "Ürünler" hub listing
      if (
        (tLower === 'urunler' || tLower === 'ürünler' || tLower === 'urunlerimiz' || tLower === 'ürünlerimiz') &&
        (!linkUrl || linkUrl === '#' || uLower.endsWith('/urunler/') || uLower.endsWith('/urunler') || uLower.endsWith('/urunlerimiz/'))
      ) {
        if (item.children && item.children.length > 0) {
          walkNavItems(item.children, linkTitle);
        }
        continue;
      }

      // Corporate / About subpages
      if (tLower.includes('kurumsal') || tLower.includes('hakkimizda') || uLower.includes('/hakkimizda') || uLower.includes('/kurumsal')) {
        if (!seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          result.pages.push({
            title: linkTitle,
            url: linkUrl,
            slug: slug || 'kurumsal',
            category: 'corporate',
            children: item.children || []
          });
        }
        if (item.children && item.children.length > 0) {
          walkNavItems(item.children, linkTitle);
        }
        continue;
      }

      // Contact & Proposal shortcuts
      if (uLower.includes('iletisim') || uLower.includes('teklif') || uLower.includes('bize-ulasin')) {
        if (item.children && item.children.length > 0) {
          walkNavItems(item.children, linkTitle);
        }
        continue;
      }

      // Blog
      if (uLower.includes('/blog/')) {
        if (item.children && item.children.length > 0) {
          walkNavItems(item.children, linkTitle);
        }
        continue;
      }

      // Services vs Products
      if (item.category === 'service' || tLower.includes('hizmet') || uLower.includes('/hizmetlerimiz/') || uLower.includes('/hizmet/')) {
        if (!seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          result.services.push({
            title: linkTitle,
            url: linkUrl,
            slug,
            description: '',
            icon: inferServiceIcon(linkTitle),
            category: 'service',
            parentCategory: item.parentCategory,
            hasNoDirectUrl: item.hasNoDirectUrl,
            children: item.children || []
          });
        }
      } else {
        // Products & Subcategories
        if (!seenSlugs.has(slug)) {
          seenSlugs.add(slug);
          result.products.push({
            title: linkTitle,
            url: linkUrl,
            slug,
            category: 'product',
            description: '',
            icon: inferServiceIcon(linkTitle),
            parentCategory: item.parentCategory,
            hasNoDirectUrl: item.hasNoDirectUrl,
            children: item.children || []
          });
        }
      }

      // Recursively walk sub-items (e.g. Traksiyoner Akü -> Elektrikli Forklift Aküleri; Jel Akü -> 6 sub-items)
      if (item.children && item.children.length > 0) {
        walkNavItems(item.children, linkTitle);
      }
    }
  }

  walkNavItems(result.navigationTree);

  // If no services were extracted from submenus, search for service section cards or icon-boxes
  if (result.services.length === 0) {
    const iconBoxes = html.matchAll(/class=["'][^"']*elementor-widget-icon-box[^"']*["'][\s\S]*?<h[3456][^>]*>([\s\S]*?)<\/h[3456]>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi);
    for (const ib of iconBoxes) {
      const boxTitle = unescapeHtml(ib[1]).replace(/<[^>]+>/g, '').trim();
      const boxDesc = unescapeHtml(ib[2]).replace(/<[^>]+>/g, '').trim();
      if (boxTitle && boxTitle.length < 50 && !boxTitle.includes('0 5')) {
        result.services.push({
          title: boxTitle,
          description: boxDesc,
          icon: inferServiceIcon(boxTitle),
          slug: slugify(boxTitle)
        });
      }
    }
  }

  // 8. Slogan / Banner Tagline
  const heroMatch = html.match(/class=["'][^"']*elementor-widget-text-editor[^"']*["'][\s\S]*?<p>([^<]+(?:bölgesinde|hizmet|çözüm|güven|lider|teknoloji)[^<]*)<\/p>/i);
  if (heroMatch) {
    result.slogan = unescapeHtml(heroMatch[1]);
  } else if (result.description && result.description.length < 120) {
    result.slogan = result.description;
  }

  // 9. About narrative / Bizi Tanıyın
  const aboutMatch = html.match(/<h[23456][^>]*>(?:Bizi Tanıyın|Hakkımızda)<\/h[23456]>[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  if (aboutMatch) {
    result.description = unescapeHtml(aboutMatch[1]).replace(/<[^>]+>/g, ' ').trim();
  }

  // 10. Funfacts / KPI Counters
  const funfactMatches = html.matchAll(/class=["'][^"']*elementskit-funfact-inner[^"']*["'][\s\S]*?data-value=["']([^"']+)["'][\s\S]*?<div class=["']funfact-title["']>([\s\S]*?)<\/div>/gi);
  for (const ff of funfactMatches) {
    const val = ff[1].trim();
    const label = unescapeHtml(ff[2]).replace(/<[^>]+>/g, '').trim();
    if (val && label) {
      result.funfacts.push({ value: val, label });
    }
  }

  // 11. Sector / Industry Classification
  result.industry = detectIndustrySector(html, result.companyName);

  return result;
}

/**
 * Formats standard Turkish phone string into clean format: 0 5xx xxx xx xx
 */
function formatTurkishPhone(phoneStr) {
  const digits = phoneStr.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return `${digits.substring(0, 1)} ${digits.substring(1, 4)} ${digits.substring(4, 7)} ${digits.substring(7, 9)} ${digits.substring(9, 11)}`;
  }
  if (digits.length === 10) {
    return `0 ${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
  }
  return phoneStr;
}

/**
 * Detects the industry sector from HTML content and company name.
 */
function detectIndustrySector(html, companyName = '') {
  const text = (html + ' ' + companyName).toLowerCase();

  if (text.includes('solar') || text.includes('güneş enerjisi') || text.includes('akü') || text.includes('enerji')) {
    return 'Güneş Enerjisi, Akü & Endüstriyel Enerji Çözümleri';
  }
  if (text.includes('lojistik') || text.includes('taşımacılık') || text.includes('nakliyat') || text.includes('depolama') || text.includes('freight')) {
    return 'Lojistik, Taşımacılık & Tedarik Zinciri';
  }
  if (text.includes('yazılım') || text.includes('bilişim') || text.includes('teknoloji') || text.includes('bulut') || text.includes('software')) {
    return 'Bilişim, Yazılım & Siber Güvenlik Teknolojileri';
  }
  if (text.includes('inşaat') || text.includes('yapı') || text.includes('taahhüt') || text.includes('mimarlık')) {
    return 'İnşaat, Yapı & Mühendislik Projeleri';
  }
  if (text.includes('sağlık') || text.includes('medikal') || text.includes('klinik') || text.includes('hastane')) {
    return 'Sağlık, Medikal & Biyoteknoloji';
  }
  if (text.includes('otomotiv') || text.includes('araç') || text.includes('yedek parça')) {
    return 'Otomotiv & Endüstriyel Ekipmanlar';
  }
  if (text.includes('danışmanlık') || text.includes('müşavirlik') || text.includes('finans')) {
    return 'Finans, Denetim & Kurumsal Danışmanlık';
  }

  return 'Kurumsal Üretim & Hizmet Sektörü';
}

/**
 * Infers an SVG icon name based on service title.
 */
export function inferServiceIcon(title) {
  const t = title.toLowerCase();
  if (t.includes('forklift') || t.includes('istif') || t.includes('transpalet') || t.includes('kiralama')) return 'truck';
  if (t.includes('temizlik') || t.includes('bakım') || t.includes('onarım')) return 'shield-check';
  if (t.includes('solar') || t.includes('güneş') || t.includes('çatı') || t.includes('ges')) return 'sun';
  if (t.includes('akü') || t.includes('batarya') || t.includes('lityum') || t.includes('enerji')) return 'battery-charging';
  if (t.includes('ataşman') || t.includes('yedek') || t.includes('parça') || t.includes('tamir')) return 'tool';
  if (t.includes('karavan') || t.includes('marin') || t.includes('özel')) return 'compass';
  if (t.includes('lojistik') || t.includes('nakliye') || t.includes('kargo')) return 'truck';
  if (t.includes('yazılım') || t.includes('kod') || t.includes('web')) return 'cpu';
  if (t.includes('güvenlik') || t.includes('alarm') || t.includes('kamera')) return 'shield-check';
  if (t.includes('danışmanlık') || t.includes('proje') || t.includes('plan')) return 'file-text';
  return 'zap';
}

/**
 * Maps raw icon identifier strings to high-resolution Unicode emojis/visual glyphs.
 */
export function formatIcon(iconStr, defaultEmoji = '⚡') {
  if (!iconStr) return defaultEmoji;
  const iconMap = {
    'truck': '🚚',
    'forklift': '🚜',
    'shield-check': '🛡️',
    'shield': '🛡️',
    'sun': '☀️',
    'battery-charging': '🔋',
    'battery': '🔋',
    'tool': '🔧',
    'compass': '🧭',
    'cpu': '💻',
    'file-text': '📄',
    'zap': '⚡',
    'target': '🎯',
    'chart': '📈',
    'gear': '⚙️',
    'check': '✅',
    'star': '⭐'
  };
  const lower = String(iconStr).toLowerCase().trim();
  return iconMap[lower] || iconStr;
}

/**
 * Autonomous AI Page & Offering Synthesizer:
 * Fills empty or thin content for any service, product or category with high-authority Turkish corporate copy.
 */
export function generateAutonomousPageContent({
  title,
  category = 'service',
  industry = '',
  companyName = '',
  existingDescription = '',
  url = '',
  children = []
}) {
  const t = (title || '').toLowerCase();
  const slug = extractSlugFromUrl(url, title);
  const comp = companyName || 'Falcon Enerji';

  let summary = existingDescription && existingDescription.trim().length > 40 ? existingDescription.trim() : '';
  let body = '';
  let specs = [];
  let features = [];
  let workflow = [];
  let faqs = [];

  // Battery & Energy Deposition Domain
  if (
    t.includes('aku') || t.includes('akü') || t.includes('batarya') ||
    t.includes('lityum') || t.includes('traksiyoner') || t.includes('redresor') ||
    t.includes('sarj') || t.includes('şarj') || t.includes('ups')
  ) {
    const isLithium = t.includes('lityum') || t.includes('lithium');
    const isGel = t.includes('jel') || t.includes('gel');

    if (!summary) {
      summary = `${comp} güvencesiyle ${title} alanında yüksek çevrim ömrü, üstün hücresel dayanıklılık ve endüstriyel standartlara uygun enerji depolama çözümleri.`;
    }

    body = `
      <p>${comp}, ${title} çözümlerinde uluslararası CE, ISO 9001 ve DIN standartlarına tam uyumlu yüksek performanslı enerji depolama altyapısı sunmaktadır. Tesislerinizde kesintisiz enerji sürekliliği sağlamak amacıyla geliştirilen batarya ve şarj sistemlerimiz, ağır vardiya şartlarında voltaj düşümünü engelleyen dayanıklı hücresel yapıya sahiptir.</p>
      <p>Özellikle üretim tesisleri, antrepolar, lojistik depoları ve kesintisiz güç gerektiren endüstriyel sahalarda ekipmanlarınızın ihtiyaç duyduğu stabil gücü sağlarken, uzun ömürlü çevrim performansı ile operasyonel amortisman maliyetlerinizi en aza indirir. Trakya sanayi bölgesi başta olmak üzere tüm Türkiye genelinde yerinde amperaj/voltaj ölçümü, montaj ve periyodik kapasite denetimi uzman mühendislerimizce yürütülmektedir.</p>
      <p>Mühendislik ekibimiz; tesisinizin çalışma vardiyalarını, sıcaklık koşullarını ve şarj/deşarj döngülerini analiz ederek işletmeniz için en yüksek verimi sağlayacak en doğru amperaj ve voltaj konfigürasyonunu belirlemektedir.</p>
    `.trim();

    specs = [
      { label: 'Voltaj / Kapasite Aralığı', value: isLithium ? '24V - 80V / 100Ah - 800Ah (LiFePO4 Akıllı BMS)' : (isGel ? '12V - 24V / 60Ah - 260Ah Derin Döngü' : '24V - 80V / 120Ah - 1250Ah (2V Traksiyoner Hücre)') },
      { label: 'Çevrim Ömrü (Cycle Life)', value: isLithium ? '4000+ Tam Çevrim (%80 DOD)' : (isGel ? '1200+ Çevrim (%50 DOD)' : '1500+ Tam Çevrim DIN Standardı') },
      { label: 'Şarj Hızı', value: isLithium ? '1.5 - 2 Saat Hızlı Şarj (Fırsat Şarjı Uyumlu)' : '6 - 8 Saat Akıllı Redresör Şarjı' },
      { label: 'Bakım İhtiyacı', value: isLithium ? 'Sıfır Bakım (Saf Su Ekleme Gerektirmez)' : (isGel ? 'Tam Kapalı Kuru Tip / Sızdırmaz' : 'Otomatik veya Manuel Saf Su Dolum Sistemi') },
      { label: 'Garanti & Sertifikalar', value: `${isLithium ? '3 - 5 Yıl' : '2 Yıl'} Kurumsal Garanti, CE, ISO 9001, RoHS, TSE` }
    ];

    features = [
      { icon: '⚡', title: 'Yüksek Enerji Yoğunluğu', desc: 'Ağır yük ve yoğun vardiyalarda voltaj dalgalanması yaşatmayan üstün hücresel kararlılık.' },
      { icon: '🛡️', title: 'Sözleşmeli Kurumsal Garanti', desc: 'Üretim ve malzeme hatalarına karşı birebir parça/hücre değişimini kapsayan resmi garanti.' },
      { icon: '🛠️', title: 'Yerinde Teknik Destek', desc: 'Gezici servis filomuzla tesisinizde anlık kapasite ölçümü, montaj ve hızlı servis.' },
      { icon: '💰', title: 'Düşük İşletme Maliyeti', desc: 'Yüksek şarj verimliliği sayesinde elektrik tüketiminde ve operasyonel giderlerde %20 tasarruf.' }
    ];

    workflow = [
      { step: '01', title: 'Saha Keşfi & Ölçüm', desc: 'Mevcut ekipmanınızın kazan ölçüleri, yük grafiği ve çalışma ortamı incelenir.' },
      { step: '02', title: 'Doğru Model Seçimi', desc: 'Vardiya gereksiniminize göre en ideal kapasite ve teknoloji konfigüre edilir.' },
      { step: '03', title: 'Hızlı Sevkiyat & Montaj', desc: 'Stoktan anında teslimat yapılarak tesisinizde uzman teknisyenlerce montajı tamamlanır.' },
      { step: '04', title: 'Periyodik Kontrol & Rapor', desc: 'Belirlenen periyotlarla voltaj ve şarj çevrimleri raporlanarak batarya ömrü korunur.' }
    ];

    faqs = [
      { question: `${title} seçimi yapılırken hangi kriterlere dikkat edilmelidir?`, answer: 'İşletmenizin vardiya sayısı, çalışma ortam sıcaklığı ve kullanılan iş makinesinin karşı ağırlık (kazan ağırlığı) gereksinimleri dikkate alınarak doğru amper ve voltaj değerleri seçilmelidir.' },
      { question: 'Teslimat ve montaj süresi nedir?', answer: 'Standart kapasite ve ölçülerdeki ürünler geniş stok stoğumuzdan aynı gün sevk edilmekte; özel ölçülü siparişler ortalama 3-5 iş günü içinde montaja hazır hale getirilmektedir.' },
      { question: 'Garanti süresi ve kapsamı nasıldır?', answer: 'Tüm ürünlerimiz 2 ila 5 yıl süresince resmi fabrika garantisi kapsamındadır. Şirketimiz bünyesindeki mühendisler periyodik ölçüm desteği sunmaktadır.' }
    ];

  } else if (
    t.includes('solar') || t.includes('ges') || t.includes('güneş') ||
    t.includes('gunes') || t.includes('cati') || t.includes('çatı') ||
    t.includes('temizlik')
  ) {
    const isCleaning = t.includes('temizlik') || t.includes('bakim') || t.includes('bakım');

    if (!summary) {
      summary = isCleaning
        ? `${comp} güvencesiyle endüstriyel çatı ve arazi güneş enerji santrallerinde panel verimini %25 artıran robotik GES temizlik ve termal denetim hizmeti.`
        : `${comp} uzmanlığıyla endüstriyel çatı ve arazi GES projelerinde anahtar teslimi mühendislik, kurulum, şebeke bağlantısı ve santral işletme çözümleri.`;
    }

    body = isCleaning ? `
      <p>Güneş enerji santrallerinde (GES) panel yüzeyinde biriken toz, endüstriyel kirleticiler, polen ve kuş pislikleri, fotovoltaik hücrelerin güneş ışığını soğurmasını engelleyerek yıllık %10 ila %25 arasında telafisi imkansız üretim kayıplarına yol açar. ${comp}, deiyonize saf su üniteleri ve çizilmez özel GES temizlik robotları ile panellerinize sıfır zarar vererek maksimum elektrik üretimi sağlar.</p>
      <p>Uygulama öncesinde ve sonrasında gerçekleştirdiğimiz termal drone / termovizyon kontrolleri sayesinde hücrelerdeki hot-spot (aşırı ısınma) noktaları, bypass diyot arızaları ve kablo korozyonları tespit edilerek santralinizin teknik sıhhati raporlanır.</p>
      <p>Trakya sanayi bölgesindeki yüzlerce endüstriyel tesisin çatı GES bakımını üstlenen ekibimiz, iş güvenliği (İSG) standartlarına tam uyumlu ekipmanları ve sertifikalı personeli ile hizmet vermektedir.</p>
    `.trim() : `
      <p>Yüksek enerji maliyetlerini kalıcı olarak sıfırlamak ve karbon ayak izinizi azaltmak için ${comp}, endüstriyel çatı ve arazi GES projelerinde uçtan uca anahtar teslimi mühendislik (EPC) çözümleri sunmaktadır. Statik çatı yükü analizinden çağrı mektubu süreçlerine, TEDAŞ kabulünden şebeke senkronizasyonuna kadar tüm adımlar titizlikle yönetilir.</p>
      <p>Tier-1 sınıfı yüksek verimli TOPCon / Monokristal güneş panelleri ve akıllı dizi inverter teknolojileri kullanılarak kurulan santrallerimiz, 25 yıllık lineer performans garantisi ile işletmenize 3-4 yıl içinde kendini amorti eden bir yatırım güvencesi sunar.</p>
      <p>Kurulum sonrası 7/24 SCADA ve uzaktan izleme sistemlerimizle anlık üretim verileriniz takip edilir, olası arızalar anında tespit edilerek santralinizin maksimum çalışma verimliliği korunur.</p>
    `.trim();

    specs = isCleaning ? [
      { label: 'Uygulama Yöntemi', value: 'Deiyonize Saf Su (TDS < 10) & Robotik Döner Fırça Sistemi' },
      { label: 'Panel Güvenliği', value: 'Sıfır Kimyasal, Çizilmez Anti-Statik Kıl Yapısı, Termal Şok Önleyici' },
      { label: 'Verim Artışı', value: '%10 - %25 Arasında Ölçümlenen Anlık Üretim Artışı' },
      { label: 'Denetim & Raporlama', value: 'Uygulama Öncesi & Sonrası Termal Drone / Hot-Spot Muayenesi' },
      { label: 'İSG ve Standartlar', value: 'Yüksekte Çalışma Sertifikalı Ekip, Tam İSG Donanımı & Sigorta' }
    ] : [
      { label: 'Panel Teknolojisi', value: 'Tier-1 TOPCon / N-Type Monokristal Fotovoltaik Paneller' },
      { label: 'İnverter Verimliliği', value: '%98.8+ Verimli Çoklu MPPT Dizi İnverterler' },
      { label: 'Amortisman Süresi', value: 'Ortalama 3 - 4 Yıl Yatırım Geri Dönüşü (ROI)' },
      { label: 'Garanti Koşulları', value: '12 Yıl Ürün Garantisi, 25 Yıl Lineer Performans Garantisi' },
      { label: 'Hizmet Kapsamı', value: 'Statik Proje, Resmi Onaylar, Tedarik, Montaj, TEDAŞ Kabul' }
    ];

    features = [
      { icon: '☀️', title: 'Yüksek Enerji Üretimi', desc: 'Güneş ışığını maksimum elektriğe dönüştüren optimize edilmiş panel dizilimi ve gölgelenme simülasyonu.' },
      { icon: '📊', title: '7/24 SCADA Uzaktan İzleme', desc: 'Cep telefonunuzdan veya bilgisayarınızdan anlık santral üretimi ve tasarruf takibi.' },
      { icon: '🌱', title: 'Sıfır Karbon Ayak İzi', desc: 'Yeşil enerji sertifikasyonu ile işletmenizin karbon salımını sıfırlayan çevreci dönüşüm.' },
      { icon: '📜', title: 'Resmi Süreç Danışmanlığı', desc: 'Çağrı mektubu, TEDAŞ proje onayı ve bağlantı anlaşmalarında anahtar teslimi yürütme.' }
    ];

    workflow = [
      { step: '01', title: 'Çatı & Saha Keşfi', desc: 'Drone ile çatı alanı taranır, statik uygunluk ve güneşlenme açıları simüle edilir.' },
      { step: '02', title: 'Mühendislik & İzinler', desc: 'Elektrik projesi hazırlanarak dağıtım şirketinden bağlantı izinleri alınır.' },
      { step: '03', title: 'Montaj & Bağlantı', desc: 'Konstrüksiyon, panel dizilimi ve inverter montajı güvenlik standartlarında tamamlanır.' },
      { step: '04', title: 'Resmi Kabul & Devreye Alma', desc: 'TEDAŞ yetkilileriyle kabul yapılarak santral resmi olarak elektrik üretmeye başlar.' }
    ];

    faqs = [
      { question: 'Güneş enerjisi santrali çatımıza zarar verir mi?', answer: 'Hayır, mühendislerimiz statik hesaplamaları yaparak çatının taşıma kapasitesine uygun özel alüminyum klemens ve ray sistemleri kullanır, çatı izolasyonuna kesinlikle zarar verilmez.' },
      { question: 'GES panel temizliği ne sıklıkla yapılmalıdır?', answer: 'Bölgemizdeki sanayi tozu ve mevsimsel koşullara bağlı olarak yılda en az 2 ila 4 defa profesyonel deiyonize temizlik yapılması önerilmektedir.' },
      { question: 'Elektrik fazlasını şebekeye satabilir miyiz?', answer: 'Evet, yürürlükteki mevzuat kapsamında tükettiğinizden fazla üretilen elektrik otomatik olarak şebekeye satılarak işletmenize ek gelir sağlar.' }
    ];

  } else if (
    t.includes('forklift') || t.includes('transpalet') || t.includes('istif') ||
    t.includes('atasman') || t.includes('ataşman') || t.includes('kiralama') ||
    t.includes('jenerator') || t.includes('jeneratör')
  ) {
    const isRental = t.includes('kiralama') || t.includes('kiralik');

    if (!summary) {
      summary = isRental
        ? `${comp} güvencesiyle depo, antrepo ve üretim sahalarınız için periyodik bakımı ve sigortası yapılmış elektrikli ve dizel forklift kiralama hizmetleri.`
        : `${comp} portföyünde yer alan elektrikli forklift, transpalet ve istif makineleri ile lojistik operasyonlarınızda sıfır hata ve maksimum taşıma verimliliği.`;
    }

    body = `
      <p>Modern malzeme taşıma ve istifleme operasyonlarında hız, güvenlik ve düşük yakıt/enerji maliyetleri kilit rol oynar. ${comp}, 1 tondan 10 tona kadar taşıma kapasitesine sahip akülü elektrikli forkliftler, kompakt transpaletler ve dar koridor istif makineleri ile işletmenize anahtar teslim çözümler sunar.</p>
      <p>İster dönemsel yoğunluklarınız için günlük/aylık/yıllık operasyonel filo kiralama, ister sıfır/ikinci el sertifikalı satın alma olsun; geniş makine parkımız ve tecrübeli teknik kadromuzla operasyonlarınızın bir an bile durmamasını garanti ediyoruz.</p>
      <p>Tüm makinelerimiz CE sertifikalı, operatör ergonomisine uygun güvenlik sistemleri (kabin koruma, hız limitörü, geri vites ikazı, yük sensörleri) ile donatılmıştır. Satış sonrası orijinal yedek parça ve mobil servis desteği firmamız bünyesinde sunulmaktadır.</p>
    `.trim();

    specs = [
      { label: 'Kapasite Seçenekleri', value: '1.5 Ton - 5.0 Ton Elektrikli & Dizel Seçenekleri' },
      { label: 'Asansör (Mast) Yüksekliği', value: '3.0m - 6.5m Arası Dubleks / Tripleks Asansör' },
      { label: 'Güç / Akü Sistemi', value: 'Yüksek Kapasiteli 48V / 80V Traksiyoner veya Lityum Akü' },
      { label: 'Dönüş Yarıçapı', value: 'Kompakt Şasi Tasarımıyla Dar Depo Koridorlarında Yüksek Manevra' },
      { label: 'Teknik Servis & Bakım', value: 'Tam Donanımlı Mobil Servis Araçlarıyla 2 Saatte Müdahale Garantisi' }
    ];

    features = [
      { icon: '🚜', title: 'Kusursuz Makine Parkı', desc: 'Bakımları eksiksiz yapılmış, genç ve teknolojik elektrikli ve dizel iş makineleri.' },
      { icon: '⏱️', title: 'Esnek Kiralama Modelleri', desc: 'İşletmenizin bütçesine uygun günlük, aylık ve yıllık avantajlı kurumsal kiralama paketleri.' },
      { icon: '🔧', title: 'Yedek Makine Desteği', desc: 'Arıza durumunda işinizin aksamaması için 24 saatte ikame makine güvencesi.' },
      { icon: '🛡️', title: 'İş Güvenliği Standartları', desc: 'Tam İSG uyumlu sesli/ışıklı ikaz donanımları, emniyet kemeri sensörü ve mavi spot ışık.' }
    ];

    workflow = [
      { step: '01', title: 'Operasyon Analizi', desc: 'Tesisinizin zemin tipi, koridor genişliği ve maksimum yük ağırlığı tespit edilir.' },
      { step: '02', title: 'En Uygun Makine Seçimi', desc: 'İşinize en uygun tonaj ve mast yüksekliğindeki forklift belirlenir.' },
      { step: '03', title: 'Sahanıza Teslimat', desc: 'Özel taşıyıcı araçlarımızla makine fabrikanıza teslim edilir ve kontrolleri yapılır.' },
      { step: '04', title: 'Kesintisiz Servis', desc: 'Periyodik yağ, filtre ve akü bakımları sözleşme süresince firmamızca yürütülür.' }
    ];

    faqs = [
      { question: 'Kiralık forkliftlerde periyodik bakım giderleri kime aittir?', answer: `Operasyonel kiralama sözleşmelerimizde periyodik bakım, parça değişimi ve arıza onarım masrafları tamamen ${comp} güvencesindedir.` },
      { question: 'Elektrikli forklift mi yoksa dizel mi tercih etmeliyim?', answer: 'Kapalı depo alanlarında sıfır egzoz emisyonu, sessiz çalışma ve düşük enerji maliyeti nedeniyle elektrikli akülü forkliftler önerilmektedir.' },
      { question: 'Mevcut forkliftimiz için özel ataşman temin ediyor musunuz?', answer: 'Evet, balya ataşmanı, beyaz eşya kıskacı, döner tabla (rotatör) ve yana kaydırma (side-shifter) gibi tüm endüstriyel ataşmanları temin ve monte ediyoruz.' }
    ];

  } else if (
    t.includes('pet') || t.includes('mama') || t.includes('kedi') ||
    t.includes('köpek') || t.includes('kopek') || t.includes('kum') ||
    t.includes('vitamin') || t.includes('hayvan') || t.includes('tasima') ||
    t.includes('taşıma') || t.includes('ödül') || t.includes('odul') ||
    (industry && (industry.toLowerCase().includes('pet') || industry.toLowerCase().includes('hayvan')))
  ) {
    // PetShop & Evcil Hayvan Beslenmesi Archetype
    const isCatFood = t.includes('kedi') && (t.includes('mama') || t.includes('konserve'));
    const isDogFood = (t.includes('köpek') || t.includes('kopek')) && (t.includes('mama') || t.includes('konserve'));
    const isLitter = t.includes('kum') || t.includes('hijyen') || t.includes('tuvalet');
    const isHealth = t.includes('sağlık') || t.includes('saglik') || t.includes('vitamin') || t.includes('tüy') || t.includes('tuy') || t.includes('malt');
    const isTreats = t.includes('ödül') || t.includes('odul') || t.includes('kemik') || t.includes('bisküvi');

    if (!summary) {
      if (isCatFood) {
        summary = `${comp} güvencesiyle yavru, yetişkin ve kısırlaştırılmış kediler için Royal Canin, Pro Plan, N&D gibi lider markalardan %100 orijinal, taze son tüketim tarihli kuru ve yaş kedi mamaları.`;
      } else if (isDogFood) {
        summary = `${comp} güvencesiyle küçük, orta ve büyük ırk köpeklerin kas ve eklem gelişimini destekleyen hipoalerjenik, tahılsız ve yüksek proteinli kuru ve konserve köpek mamaları.`;
      } else if (isLitter) {
        summary = `${comp} güvencesiyle ultra topaklaşan, tozumayan doğal beyaz bentonit kedi kumları, koku hapsedici aktif karbonlu seriler ve hijyenik bakım solüsyonları.`;
      } else if (isHealth) {
        summary = `${comp} uzmanlığıyla kedi ve köpeklerde tüy dökülmesini azaltan, sindirimi destekleyen malt macunları, Omega-3 balık yağları ve veteriner onaylı vitamin takviyeleri.`;
      } else if (isTreats) {
        summary = `${comp} kalitesiyle saf kurutulmuş etten üretilen, yapay koruyucu içermeyen doğal ödül mamaları, diş temizleyici kalsiyumlu çiğneme kemikleri ve eğitim atıştırmalıkları.`;
      } else {
        summary = `${comp}, sevimli dostlarınızın sağlıklı, dengeli ve mutlu bir yaşam sürmesi için veteriner onaylı, yetkili distribütör garantili orijinal mama ve bakım ürünleri sunmaktadır.`;
      }
    }

    body = `
      <p>Evcil hayvanlarımızın sağlıklı, enerjik ve uzun bir ömür sürmesinin temeli doğru ve dengeli beslenmeden geçer. ${comp}, ${title} kategorisinde Royal Canin, Pro Plan, N&D, Acana, Hill's ve Brit Care gibi dünya çapında kabul görmüş premium markaların yetkili satıcısı olarak yalnızca %100 orijinal, taze ve güvenilir ürünleri sunmaktadır.</p>
      <p>Yavru (kitten/puppy), yetişkin, yaşlı (senior) ya da kısırlaştırılmış (sterilised) dönemlerdeki dostlarımızın protein, vitamin ve mineral ihtiyaçları birbirinden tamamen farklıdır. Mağazamızda ve online sipariş hattımızda; dostunuzun ırkına, kilosuna ve olası alerjik reaksiyonlarına (tahıl hassasiyeti, tüy dökülmesi, sindirim problemleri) en uygun formülü seçebilmeniz için uzman ürün danışmanlığı sağlıyoruz.</p>
      <p>Özellikle 10 kg, 12 kg, 15 kg gibi ağır mama çuvalları ile kedi kumlarını taşımakta zorlanan müşterilerimiz için bölge genelinde aynı gün kapıya kurye teslimatı hizmeti sunuyoruz. WhatsApp sipariş hattımızdan tek mesajla sipariş verebilir, kapıda ödeme kolaylığıyla dostunuzun mamasını beklemeden temin edebilirsiniz.</p>
    `.trim();

    specs = [
      { label: 'Orijinallik & Tedarik', value: 'Yetkili Distribütör Garantili %100 Orijinal Ürünler' },
      { label: 'Son Tüketim Tarihi', value: 'Sürekli Yenilenen Taze Stok Güvencesi (Uzun SKT)' },
      { label: 'Formül Çeşitliliği', value: 'Tahılsız, Düşük Tahıllı, Kısırlaştırılmış, Hipoalerjenik, Monoprotein' },
      { label: 'Adrese Teslimat', value: 'Aynı Gün Kapıya Hızlı Kurye Servisi' },
      { label: 'Ödeme & Danışmanlık', value: 'Kapıda Ödeme, Havale/EFT ve Ücretsiz Beslenme Danışmanlığı' }
    ];

    features = [
      { icon: '🐾', title: '%100 Orijinal & Taze Stok', desc: 'Sahte veya açıkta beklemiş mamalara karşı doğrudan yetkili distribütörden temin edilen garantili ürünler.' },
      { icon: '🛵', title: 'Aynı Gün Kapıda Teslimat', desc: 'Ağır mama çuvallarını ve kumları taşımanıza gerek kalmadan kapınıza kadar getiriyoruz.' },
      { icon: '🩺', title: 'Doğru Beslenme Rehberliği', desc: 'Kısırlaştırma, tüy sağlığı, böbrek desteği ve hassas sindirim için en uygun mama önerisi.' },
      { icon: '💬', title: 'WhatsApp Hızlı Sipariş', desc: 'Tek tıkla WhatsApp üzerinden sipariş oluşturun, kuryemiz aynı gün kapınıza teslim etsin.' }
    ];

    workflow = [
      { step: '01', title: 'İhtiyaç & Irk Tespiti', desc: 'Dostunuzun yaşı, kilosu, kısırlaştırma durumu ve özel besin hassasiyetleri değerlendirilir.' },
      { step: '02', title: 'İdeal Mama & Ürün Seçimi', desc: 'En zengin et oranına ve uygun tane yapısına sahip orijinal marka belirlenir.' },
      { step: '03', title: 'Taze Stoktan Hazırlık', desc: 'Son tüketim tarihi kontrol edilerek siparişiniz özenle paketlenir.' },
      { step: '04', title: 'Kapınıza Hızlı Teslimat', desc: 'Kuryemizle aynı gün kapınıza teslim edilir veya mağazadan teslim alınır.' }
    ];

    faqs = [
      { question: `${title} kapsamındaki mamalar taze ve orijinal mi?`, answer: `${comp} olarak yalnızca resmi distribütör onaylı, orijinal barkodlu ve uzun son tüketim tarihli (SKT) taze mamaları satışa sunuyoruz. Asla açıkta beklemiş veya bayat ürün satmıyoruz.` },
      { question: 'Ağır mama çuvalları ve kumlar için adrese kurye hizmetiniz var mı?', answer: 'Evet! Siparişlerinizde 10 kg, 12 kg, 15 kg mama çuvallarını ve kedi kumlarını kapınıza kadar kendi servisimizle ulaştırıyoruz.' },
      { question: 'Kısırlaştırılmış kedi veya köpeğim için hangi mamayı tercih etmeliyim?', answer: 'Kısırlaştırma sonrası metabolizma yavaşlar ve kilo alma eğilimi artar. Düşük yağ oranlı, L-karnitin takviyeli ve idrar yolu pH dengesini koruyan sterilised formülleri öneriyoruz. WhatsApp hattımızdan dostunuza özel öneri alabilirsiniz.' },
      { question: 'WhatsApp üzerinden nasıl sipariş verebilirim?', answer: 'Web sitemizdeki WhatsApp butonuna tıklayarak talep ettiğiniz mama markasını ve adresinizi iletmeniz yeterlidir. Ekibimiz anında stok teyidi verip siparişinizi hazırlar.' }
    ];

  } else {
    // General Enterprise Offerings
    if (!summary) {
      summary = `${comp}, ${title} alanında uluslararası kalite standartları, derin sektörel birikimi ve müşteri odaklı vizyonuyla kurumsal çözümler sunmaktadır.`;
    }

    body = `
      <p>${comp}, ${title} hizmeti kapsamında modern endüstri standartlarını aşan yenilikçi çözümler üretmektedir. İşletmenizin operasyonel gereksinimlerini en ince detayına kadar analiz ederek, zaman ve maliyet tasarrufu sağlayan sürdürülebilir modeller kurguluyoruz.</p>
      <p>Uzman mühendislik kadromuz ve teknolojik altyapımızla süreçlerin her aşamasında şeffaf iletişim ve sıfır hata prensibiyle hareket ediyoruz. Projelerimiz, uluslararası kalite yönetim standartlarına ve yasal düzenlemelere tam uyumlu olarak anahtar teslim hayata geçirilmektedir.</p>
      <p>Hizmetimizin her adımında müşterilerimize özel atanan temsilcilerimizle 7/24 kesintisiz destek veriyor, uzun vadeli iş ortaklıkları kurarak karşılıklı büyümeyi hedefliyoruz.</p>
    `.trim();

    specs = [
      { label: 'Hizmet Kapsamı', value: 'Uçtan Uca Projelendirme, Danışmanlık ve Uygulama' },
      { label: 'Kalite Standartları', value: 'ISO 9001, ISO 14001, OHSAS Sertifikalı Yönetim' },
      { label: 'Hizmet Bölgesi', value: 'Trakya Bölgesi, Marmara ve Tüm Türkiye Geneli' },
      { label: 'Raporlama & Takip', value: 'Haftalık İlerleme Raporları ve Dijital Süreç İzleme' },
      { label: 'Sözleşme & Güvence', value: 'Hizmet Seviyesi Anlaşması (SLA) Kapsamında Tam Taahhüt' }
    ];

    features = [
      { icon: '🎯', title: 'Stratejik Planlama', desc: 'İşletmenizin ihtiyaçlarına özel olarak tasarlanmış, verimliliği artıran yol haritası.' },
      { icon: '⚡', title: 'Hızlı & Hatasız Uygulama', desc: 'Alanında uzman kadro ile taahhüt edilen teslim sürelerinde eksiksiz hayata geçirme.' },
      { icon: '🛡️', title: 'Yüksek Güvenilirlik', desc: 'Uluslararası kalite belgeleri ve kurumsal iş ahlakı ile güvence altına alınmış süreçler.' },
      { icon: '📞', title: '7/24 Kesintisiz İletişim', desc: 'Her an ulaşabileceğiniz uzman destek hattı ve periyodik durum bilgilendirmesi.' }
    ];

    workflow = [
      { step: '01', title: 'İhtiyaç Analizi', desc: 'Talepleriniz detaylı incelenerek hedefleriniz ve bütçeniz netleştirilir.' },
      { step: '02', title: 'Çözüm Tasarımı', desc: 'Kurumunuza en uygun mühendislik ve operasyon planı oluşturulur.' },
      { step: '03', title: 'Uygulama', desc: 'Onaylanan planlama profesyonel ekiplerimizce sahada hayata geçirilir.' },
      { step: '04', title: 'Destek & Takip', desc: 'Teslimat sonrası düzenli kontrollerle sürdürülebilir başarı korunur.' }
    ];

    faqs = [
      { question: `${title} hizmeti için nasıl teklif alabilirim?`, answer: 'Web sitemizdeki online teklif formunu doldurarak veya doğrudan telefon numaramızdan bize ulaşarak 24 saat içinde detaylı teklif alabilirsiniz.' },
      { question: 'Hizmet teslim süreleri ne kadardır?', answer: 'Projenin büyüklüğüne göre karşılıklı mutabakatla belirlenen takvime sıkı sıkıya bağlı kalınarak en hızlı şekilde tamamlanır.' }
    ];
  }

  // If this offering represents a parent category or hub with child items, embed child product cards
  if (Array.isArray(children) && children.length > 0) {
    const subItemsHtml = `
      <div style="margin-top: 35px; padding: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 1.25rem; color: #0f172a; font-weight: 800;">${title} Kapsamındaki Ürün &amp; Çözümlerimiz</h3>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 16px;">Bu kategori altında yer alan tüm modelleri ve teknik detayları aşağıdaki bağlantılardan inceleyebilirsiniz:</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
          ${children.map(c => {
            const childSlug = c.slug || slugify(c.title);
            const childPath = c.category === 'service' ? `/hizmetlerimiz/${childSlug}/` : `/${childSlug}/`;
            return `
            <a href="/__LANG__${childPath}" style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; text-decoration: none; color: #0f172a; font-weight: 700; font-size: 0.92rem; box-shadow: 0 2px 6px rgba(0,0,0,0.02); transition: all 0.2s ease;">
              <span>${c.title}</span>
              <span style="color: #2563eb; font-weight: 800;">&rarr;</span>
            </a>
            `;
          }).join('')}
        </div>
      </div>
    `.trim();
    body += '\n' + subItemsHtml;
  }

  const seoTitle = `${title} | ${comp}`;
  const seoDescription = summary.length > 155 ? summary.substring(0, 152) + '...' : summary;

  return {
    title,
    slug,
    category,
    summary,
    body,
    specs,
    features,
    workflow,
    faqs,
    seoTitle,
    seoDescription
  };
}

/**
 * Generates an executive Turkish service description tailored to sector and service title.
 */
function generateServiceCopy(serviceTitle, industry, companyName) {
  const content = generateAutonomousPageContent({
    title: serviceTitle,
    category: 'service',
    industry,
    companyName
  });
  return content.summary;
}

/**
 * AI Content Enrichment:
 * Automatically fills missing or thin fields with executive-grade enterprise Turkish content
 * for both services, products, and dedicated subpages.
 */
export async function enrichExtractedDataWithAI(extractedData, options = {}) {
  const enriched = JSON.parse(JSON.stringify(extractedData));
  const companyName = enriched.companyName || 'Falcon Enerji';
  const industry = enriched.industry || 'Güneş Enerjisi, Akü & Endüstriyel Enerji Çözümleri';

  // 1. Enrich Slogan if missing
  if (!enriched.slogan || enriched.slogan.trim() === '') {
    if (industry.includes('Enerji') || industry.includes('Solar') || industry.includes('Akü')) {
      enriched.slogan = `Trakya'dan Türkiye'ye: Kesintisiz Enerji, Güçlü Endüstriyel Çözümler`;
    } else if (industry.includes('Lojistik')) {
      enriched.slogan = `Küresel Standartlarda Güvenilir ve Hızlı Tedarik Zinciri Yönetimi`;
    } else {
      enriched.slogan = `Yenilikçi Vizyon, Güvenilir Hizmet ve Sürdürülebilir Başarı`;
    }
    enriched.aiEnrichedFields.push('slogan');
  }

  // 2. Enrich Description if missing or short
  if (!enriched.description || enriched.description.trim().length < 50) {
    enriched.description = `${companyName}, ${industry} alanında uzman kadrosu, yüksek teknolojik altyapısı ve yıllara dayanan sektörel birikimiyle faaliyet göstermektedir. Müşteri memnuniyetini ve operasyonel mükemmeliyeti merkeze alan vizyonumuzla, endüstriyel standartları aşan güvenilir ve sürdürülebilir çözümler sunuyoruz.`;
    enriched.aiEnrichedFields.push('description');
  }

  // 3. Enrich Services: Ensure at least 4-6 rich services with detailed copy, specs, and icons
  if (!enriched.services || enriched.services.length === 0) {
    if (industry.includes('Enerji') || industry.includes('Akü') || industry.includes('Solar')) {
      enriched.services = [
        { title: 'Traksiyoner & Endüstriyel Akü Satışı', icon: 'battery-charging', url: '/hizmetlerimiz/endustriyel-aku-satis/' },
        { title: 'Forklift Kiralama & Satış Hizmetleri', icon: 'truck', url: '/hizmetlerimiz/forklift-kiralama-ve-satis/' },
        { title: 'Güneş Enerjisi (GES) Projelendirme & Kurulum', icon: 'sun', url: '/hizmetlerimiz/solar-sistem-kurulumlari/' },
        { title: 'GES Çatı Temizlik & Periyodik Bakım', icon: 'shield-check', url: '/hizmetlerimiz/ges-cati-temizlik-uygulamalari/' },
        { title: 'Karavan & Marin Enerji Depolama', icon: 'compass', url: '/hizmetlerimiz/karavan-enerji-cozumleri/' },
        { title: 'Forklift Ataşmanları & Yedek Parça', icon: 'tool', url: '/hizmetlerimiz/forklift-atasmanlari-satisi/' }
      ];
    } else {
      enriched.services = [
        { title: 'Stratejik Kurumsal Danışmanlık', icon: 'file-text', url: '/hizmetlerimiz/stratejik-danismanlik/' },
        { title: 'Uçtan Uca Operasyon Yönetimi', icon: 'shield-check', url: '/hizmetlerimiz/operasyon-yonetimi/' },
        { title: 'Teknolojik Altyapı Entegrasyonu', icon: 'cpu', url: '/hizmetlerimiz/altyapi-entegrasyonu/' },
        { title: '7/24 Kesintisiz Teknik Destek', icon: 'zap', url: '/hizmetlerimiz/teknik-destek/' }
      ];
    }
    enriched.aiEnrichedFields.push('services_generated');
  }

  // Enrich each Service with deep autonomous content
  for (const s of enriched.services) {
    const pageContent = generateAutonomousPageContent({
      title: s.title,
      category: 'service',
      industry,
      companyName,
      existingDescription: s.description,
      url: s.url,
      children: s.children || []
    });

    s.slug = s.slug || pageContent.slug;
    s.description = pageContent.summary;
    s.body = pageContent.body;
    s.specs = pageContent.specs;
    s.features = pageContent.features;
    s.workflow = pageContent.workflow;
    s.faqs = pageContent.faqs;
    s.seoTitle = pageContent.seoTitle;
    s.seoDescription = pageContent.seoDescription;
    s.icon = s.icon || inferServiceIcon(s.title);
    s.canonicalUrl = `/tr/hizmetlerimiz/${s.slug}/`;
    s.aliasUrls = [
      `/tr/hizmetler/${s.slug}/`,
      `/tr/hizmetlerimiz/${s.slug}`,
      `/tr/hizmetler/${s.slug}`,
      `/hizmetlerimiz/${s.slug}/`,
      `/hizmetler/${s.slug}/`,
      `/tr/${s.slug}/`,
      `/tr/${s.slug}`,
      `/${s.slug}/`
    ];
  }
  enriched.aiEnrichedFields.push('services_descriptions');
  enriched.aiEnrichedFields.push('services_deep_content');

  // 4. Enrich Products with deep autonomous content
  if (Array.isArray(enriched.products)) {
    for (const p of enriched.products) {
      const pageContent = generateAutonomousPageContent({
        title: p.title,
        category: 'product',
        industry,
        companyName,
        existingDescription: p.description,
        url: p.url,
        children: p.children || []
      });

      p.slug = p.slug || pageContent.slug;
      p.description = pageContent.summary;
      p.body = pageContent.body;
      p.specs = pageContent.specs;
      p.features = pageContent.features;
      p.workflow = pageContent.workflow;
      p.faqs = pageContent.faqs;
      p.seoTitle = pageContent.seoTitle;
      p.seoDescription = pageContent.seoDescription;
      p.icon = p.icon || inferServiceIcon(p.title);
      p.canonicalUrl = `/tr/${p.slug}/`;
      p.aliasUrls = [
        `/tr/urunler/${p.slug}/`,
        `/tr/${p.slug}`,
        `/tr/urunler/${p.slug}`,
        `/${p.slug}/`,
        `/${p.slug}`,
        `/urunler/${p.slug}/`,
        `/urunler/${p.slug}`
      ];
    }
    enriched.aiEnrichedFields.push('products_deep_content');
  }

  // 5. Build Unified Standalone Pages List
  enriched.pages = [
    ...(enriched.services || []),
    ...(enriched.products || [])
  ];

  // 6. Enrich Global FAQs (Sıkça Sorulan Sorular)
  if (!enriched.faqs || enriched.faqs.length === 0) {
    if (industry.includes('Enerji') || industry.includes('Solar') || industry.includes('Akü')) {
      enriched.faqs = [
        {
          question: 'Akü seçiminde ve değişiminde nelere dikkat edilmelidir?',
          answer: 'İşletmenizin çalışma vardiyası, ortam sıcaklığı ve yük kapasitesine göre doğru amper ve voltaj değerleri seçilmelidir. Traksiyoner ve lityum akülerde saf su bakımı ve şarj çevrimleri düzenli takip edilmelidir.'
        },
        {
          question: 'Solar (GES) kurulumu ne kadar sürede tamamlanır?',
          answer: 'Çatı statik incelemesi, mühendislik projelendirmesi ve resmi onay süreçlerinin ardından ortalama 2-4 hafta içerisinde anahtar teslim devreye alınmaktadır.'
        },
        {
          question: 'Trakya dışındaki bölgelere servis ve ürün teslimatı sağlıyor musunuz?',
          answer: 'Evet, merkezimiz Tekirdağ/Çorlu olmakla birlikte Türkiye genelinde anlaşmalı lojistik ağımız ve mobil teknik servis ekiplerimizle kesintisiz hizmet vermekteyiz.'
        },
        {
          question: 'Kiralık forklift filonuzun bakım giderleri kime aittir?',
          answer: 'Kiralama sözleşmelerimiz kapsamında periyodik bakım, yedek parça ve teknik servis hizmetleri tamamen firmamız güvencesinde sunulmaktadır.'
        }
      ];
    } else {
      enriched.faqs = [
        {
          question: 'Hizmetleriniz için nasıl teklif alabilirim?',
          answer: 'Web sitemizdeki online teklif formunu doldurarak veya iletişim numaramızdan müşteri temsilcimize ulaşarak 24 saat içinde detaylı teklif alabilirsiniz.'
        },
        {
          question: 'Kurumsal sözleşme ve garanti şartlarınız nelerdir?',
          answer: 'Tüm projelerimiz SLA standartları ve yasal garanti kapsamı altında sözleşmeli olarak güvenceye alınmaktadır.'
        }
      ];
    }
    enriched.aiEnrichedFields.push('faqs');
  }

  return enriched;
}

/**
 * Maps extracted and AI-enriched data into a complete CorporateGenerator specification.
 */
export function mapToCorporateSpec(enrichedData) {
  const companyName = enrichedData.companyName || 'Falcon Enerji';
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return {
    companyName: enrichedData.companyName,
    industry: enrichedData.industry,
    slogan: enrichedData.slogan,
    description: enrichedData.description,
    navigationTree: enrichedData.navigationTree || [],
    services: enrichedData.services.map(s => ({
      title: s.title,
      description: s.description,
      slug: s.slug,
      icon: s.icon || inferServiceIcon(s.title),
      url: s.url,
      canonicalUrl: s.canonicalUrl,
      aliasUrls: s.aliasUrls,
      body: s.body,
      specs: s.specs,
      features: s.features,
      workflow: s.workflow,
      faqs: s.faqs,
      seoTitle: s.seoTitle,
      seoDescription: s.seoDescription,
      parentCategory: s.parentCategory || null,
      hasNoDirectUrl: s.hasNoDirectUrl || false,
      children: s.children || []
    })),
    products: (enrichedData.products || []).map(p => ({
      title: p.title,
      description: p.description,
      slug: p.slug,
      icon: p.icon || inferServiceIcon(p.title),
      url: p.url,
      canonicalUrl: p.canonicalUrl,
      aliasUrls: p.aliasUrls,
      body: p.body,
      specs: p.specs,
      features: p.features,
      workflow: p.workflow,
      faqs: p.faqs,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      parentCategory: p.parentCategory || null,
      hasNoDirectUrl: p.hasNoDirectUrl || false,
      children: p.children || []
    })),
    pages: enrichedData.pages || [],
    funfacts: enrichedData.funfacts || [],
    faqs: enrichedData.faqs || [],
    contact: {
      phone: enrichedData.contact?.phone || '0 554 507 77 31',
      email: enrichedData.contact?.email || 'bilgi@falconenerji.com',
      address: enrichedData.contact?.address || 'Tekirdağ / Çorlu, Türkiye',
      city: enrichedData.contact?.city || 'Tekirdağ / Çorlu',
      workingHours: 'Hafta İçi: 08:30 - 18:30',
      social: enrichedData.contact?.social || {}
    },
    theme: enrichedData.paletteKey || 'gold',
    targetDir: slug || 'falcon-enerji',
    referenceUrls: enrichedData.sourceUrl ? [enrichedData.sourceUrl] : ['https://falconenerji.com/'],
    layoutPreferences: ['minimal_hero', 'kpi_counters', 'google_reviews', 'faq_accordion', 'interactive_map'],
    inspirationNotes: `${enrichedData.companyName} kurumsal kimliği ve ${enrichedData.brandColor} marka rengine göre modernize edilmiş yeni nesil OnluNet Kurumsal frontend tasarımı.`,
    googleMapsUrl: enrichedData.googleMapsUrl || 'https://maps.google.com/maps?q=Falcon%20Enerji%20Tekirda%C4%9F%20%C3%87orlu&output=embed',
    adminUser: {
      name: 'Yönetici',
      email: enrichedData.contact?.email || 'admin@onlunet.com',
      password: 'AdminPassword2026!'
    },
    meta: {
      brandColor: enrichedData.brandColor,
      paletteKey: enrichedData.paletteKey,
      aiEnrichedFields: enrichedData.aiEnrichedFields || []
    }
  };
}

/**
 * End-to-end site inspection, extraction, and AI modernization pipeline.
 */
export async function inspectAndModernizeWebsite(url, options = {}) {
  const { html, url: resolvedUrl } = await fetchWebsiteHtml(url, options);
  const rawExtracted = extractWebsiteMetadata(html, resolvedUrl);
  const enriched = await enrichExtractedDataWithAI(rawExtracted, options);
  const spec = mapToCorporateSpec(enriched);

  return {
    success: true,
    url: resolvedUrl,
    spec,
    rawExtracted,
    enriched
  };
}
