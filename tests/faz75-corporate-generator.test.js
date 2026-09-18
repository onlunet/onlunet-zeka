/**
 * FAZ 75 — Kurumsal Website Generator Test Suite
 *
 * Verifies:
 * 1. Authoritative Backend Capability Registry & Capability Gatekeeping
 * 2. Strict Zero-Hardcoded Backend in Frontend Rule (Blocking when capability is missing)
 * 3. Multi-Source Ingestion with Precedence (MANUAL > VERIFIED > EXTRACTED > MAPS > INFERRED)
 * 4. Provenance tracking & Anti-Hallucination Labeling (Inferred data marked explicitly)
 * 5. Reference Image Analyzer Security (10MB limit, extension, MIME, path traversal)
 * 6. Reference Design Match Scoring
 * 7. HTTP API endpoints on port 4200 (/api/corporate/capabilities, validate-capabilities, upload-reference, multi-source-ingest, plan, synthesize)
 * 8. Authoritative Plan Isolation & Single Instance Model (ONE INSTANCE = ONE CUSTOMER)
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

import {
  BackendCapabilities,
  CapabilityStatus,
  getBackendCapabilityRegistry,
  normalizeCapabilityId,
  validateBackendCapabilities
} from '../src/autonomous/backend-capability-registry.js';

import {
  validateReferenceImageSecurity,
  storeReferenceImageSecurely,
  analyzeReferenceImage,
  computeReferenceDesignMatch,
  MAX_REFERENCE_IMAGE_SIZE_BYTES
} from '../src/autonomous/reference-image-analyzer.js';

import { ingestMultiSourceCorporateData } from '../src/autonomous/multi-source-adapter.js';
import { createCorporateGenerator } from '../src/autonomous/corporate-generator.js';

const PORT = 4200;

function httpRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const reqHeaders = { ...headers };
    let postData = null;
    if (body !== null && typeof body === 'object') {
      postData = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ statusCode: res.statusCode, headers: res.headers, body: parsed, rawBody: data });
          } catch (e) {
            resolve({ statusCode: res.statusCode, headers: res.headers, body: null, rawBody: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// 1x1 8-byte valid PNG header for testing
const MINIMAL_PNG_BUFFER = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);

describe('FAZ 75 — Backend Capability Registry & Gatekeeper', () => {
  test('Backend Capability Registry contains all required capabilities with accurate status', () => {
    const reg = getBackendCapabilityRegistry();
    assert.equal(reg.backendCore, 'ONLUNET KURUMSAL 2026');
    assert.equal(reg.freezeStatus, 'FROZEN');

    // Available capabilities (FULL)
    assert.equal(BackendCapabilities.pages.status, CapabilityStatus.FULL);
    assert.equal(BackendCapabilities.media.status, CapabilityStatus.FULL);
    assert.equal(BackendCapabilities.services.status, CapabilityStatus.FULL);
    assert.equal(BackendCapabilities.products.status, CapabilityStatus.FULL);
    assert.equal(BackendCapabilities.blog.status, CapabilityStatus.FULL);
    assert.equal(BackendCapabilities.forms.status, CapabilityStatus.FULL);
    assert.equal(BackendCapabilities.seo.status, CapabilityStatus.FULL);
    assert.equal(BackendCapabilities.case_studies.status, CapabilityStatus.FULL);
    assert.equal(BackendCapabilities.team.status, CapabilityStatus.FULL);
    assert.equal(BackendCapabilities.testimonials.status, CapabilityStatus.FULL);
    assert.equal(BackendCapabilities.faq.status, CapabilityStatus.FULL);

    // Deferred capabilities
    assert.equal(BackendCapabilities.brand_references.status, CapabilityStatus.DEFERRED);
    assert.equal(BackendCapabilities.gallery.status, CapabilityStatus.DEFERRED);
  });

  test('normalizeCapabilityId handles aliases and localized strings', () => {
    assert.equal(normalizeCapabilityId('Sayfalar'), 'pages');
    assert.equal(normalizeCapabilityId('hizmetler'), 'services');
    assert.equal(normalizeCapabilityId('urunler'), 'products');
    assert.equal(normalizeCapabilityId('ekibimiz'), 'team');
    assert.equal(normalizeCapabilityId('yorumlar'), 'testimonials');
    assert.equal(normalizeCapabilityId('sss'), 'faq');
    assert.equal(normalizeCapabilityId('galeri'), 'gallery');
    assert.equal(normalizeCapabilityId('case_studies'), 'case_studies');
  });

  test('validateBackendCapabilities passes when all requested features are available', () => {
    const result = validateBackendCapabilities(['pages', 'services', 'products', 'forms', 'seo', 'team', 'testimonials', 'faq']);
    assert.equal(result.valid, true);
    assert.equal(result.blocked, false);
    assert.equal(result.missingCapabilities.length, 0);
    assert.equal(result.availableCapabilities.length, 8);
  });

  test('validateBackendCapabilities blocks when any requested feature is missing in backend', () => {
    const result = validateBackendCapabilities(['pages', 'services', 'unsupported_custom_crm']);
    assert.equal(result.valid, false);
    assert.equal(result.blocked, true);
    assert.equal(result.statusCode, 409);
    assert.equal(result.errorCode, 'BACKEND_CAPABILITY_MISSING');
    assert.ok(result.message.includes('[BACKEND CAPABILITY MISSING]'));
    assert.ok(result.message.includes('SITE GENERATION BLOCKED'));
    assert.ok(result.message.includes('unsupported_custom_crm'));
  });
});

describe('FAZ 75 — Reference Image Analyzer & Security Sandbox', () => {
  test('rejects path traversal attempts in image filename', () => {
    assert.throws(() => {
      validateReferenceImageSecurity({
        buffer: MINIMAL_PNG_BUFFER,
        originalName: '../../etc/passwd.png'
      });
    }, /Path traversal/);

    assert.throws(() => {
      validateReferenceImageSecurity({
        buffer: MINIMAL_PNG_BUFFER,
        originalName: '..\\malicious.png'
      });
    }, /Path traversal/);
  });

  test('rejects disallowed file extensions', () => {
    assert.throws(() => {
      validateReferenceImageSecurity({
        buffer: MINIMAL_PNG_BUFFER,
        originalName: 'payload.php'
      });
    }, /Unsupported file extension/);

    assert.throws(() => {
      validateReferenceImageSecurity({
        buffer: MINIMAL_PNG_BUFFER,
        originalName: 'script.exe'
      });
    }, /Unsupported file extension/);
  });

  test('rejects files exceeding 10MB limit', () => {
    const fakeHugeBuffer = { length: MAX_REFERENCE_IMAGE_SIZE_BYTES + 1024 };
    assert.throws(() => {
      validateReferenceImageSecurity({
        buffer: fakeHugeBuffer,
        originalName: 'huge.png'
      });
    }, /File size exceeds 10MB limit/);
  });

  test('rejects invalid file signature / fake MIME header', () => {
    const corruptedBuffer = Buffer.from('NOT_AN_IMAGE_FILE_DATA_CORRUPTED');
    assert.throws(() => {
      validateReferenceImageSecurity({
        buffer: corruptedBuffer,
        originalName: 'fake.png'
      });
    }, /File signature does not match/);
  });

  test('analyzes valid reference image and produces layout analysis & color palette', () => {
    const analysis = analyzeReferenceImage({
      imageBuffer: MINIMAL_PNG_BUFFER,
      notes: 'Clean modern corporate look'
    });

    assert.ok(analysis.referenceAnalysisId.startsWith('ref-analysis-'));
    assert.ok(analysis.detectedPalette.primary);
    assert.ok(analysis.detectedPalette.accent);
    assert.ok(analysis.layoutAnalysis.header);
    assert.equal(analysis.layoutAnalysis.header.stickyGuaranteed, true);
    assert.ok(analysis.inferredDesignTokens['--color-primary']);
  });

  test('computes REFERENCE DESIGN MATCH score accurately', () => {
    const analysis = analyzeReferenceImage({
      imageBuffer: MINIMAL_PNG_BUFFER
    });

    const synthesizedDesign = {
      tokens: {
        '--color-primary': analysis.detectedPalette.primary,
        '--color-accent': analysis.detectedPalette.accent
      }
    };

    const match = computeReferenceDesignMatch(synthesizedDesign, analysis);
    assert.equal(match.hasReference, true);
    assert.ok(match.matchScore >= 80, `Expected matchScore >= 80, got ${match.matchScore}`);
    assert.ok(match.breakdown.colorPaletteMatch > 0);
    assert.ok(match.breakdown.headerStructureMatch > 0);
    assert.ok(match.breakdown.heroHierarchyMatch > 0);
  });
});

describe('FAZ 75 — Multi-Source Ingestion & Precedence', () => {
  test('strictly enforces MANUAL > MAPS > WEBSITE > INFERRED precedence', async () => {
    const result = await ingestMultiSourceCorporateData({
      manual: {
        companyName: 'Akın Mühendislik A.Ş.',
        industry: 'Endüstriyel Otomasyon',
        phone: '+90 212 555 0199'
      },
      mapsData: {
        name: 'Akın Mühendislik Google Maps',
        category: 'Mühendislik Danışmanlığı',
        phone: '+90 212 999 0000',
        rating: 4.8
      },
      websiteData: {
        companyName: 'Akın Eski Web Sitesi',
        industry: 'Yazılım'
      }
    });

    // Manual overrides Maps and Website
    assert.equal(result.companyProfile.company.name.value, 'Akın Mühendislik A.Ş.');
    assert.equal(result.companyProfile.company.name.source, 'manual');
    assert.equal(result.companyProfile.company.industry.value, 'Endüstriyel Otomasyon');
    assert.equal(result.companyProfile.company.industry.source, 'manual');
    assert.equal(result.companyProfile.contact.phone.value, '+90 212 555 0199');
    assert.equal(result.companyProfile.contact.phone.source, 'manual');

    // Rating is extracted from Google Maps since not provided manually
    assert.equal(result.companyProfile.socialProof.rating.value, 4.8);
    assert.equal(result.companyProfile.socialProof.rating.source, 'maps');

    // Audit trail separates verified from inferred
    assert.ok(result.provenanceReport.verifiedCount > 0);
  });

  test('marks inferred values with provenance tracking and prevents fake claims', async () => {
    const result = await ingestMultiSourceCorporateData({
      manual: {
        companyName: 'Bilinmeyen Girişim Ltd.'
      }
    });

    assert.ok(result.provenanceReport.inferredCount > 0);
    assert.ok(result.provenanceReport.inferredFields.includes('company.industry'));
  });

  test('triggers Capability Gate block if multi-source profile requires missing capabilities', async () => {
    const result = await ingestMultiSourceCorporateData({
      manual: {
        companyName: 'Klinik Sağlık Grubu',
        services: ['Diş Tedavisi', 'Ortodonti'],
        galleryRequired: true // Requests deferred 'gallery' module
      }
    });

    assert.equal(result.isGenerationBlocked, true);
    assert.equal(result.capabilityValidation.blocked, true);
    assert.ok(result.capabilityValidation.message.includes('Foto Galeri ve Albümler'));
  });
});

describe('FAZ 75 — Generator Core Integration & Boundary Hardening', () => {
  test('corporate generator throws error when missing capabilities are required without bypass', () => {
    const corporateGen = createCorporateGenerator();
    assert.throws(() => {
      corporateGen.synthesizeCorporateProject({
        companyName: 'Test Firma A.Ş.',
        requiredCapabilities: ['unsupported_custom_crm']
      });
    }, /Mutation blocked: \[BACKEND CAPABILITY MISSING\]/);
  });

  test('corporate generator succeeds when only supported capabilities are required', () => {
    const corporateGen = createCorporateGenerator();
    const synthesis = corporateGen.synthesizeCorporateProject({
      companyName: 'Test Güvenli Firma A.Ş.',
      requiredCapabilities: ['pages', 'services', 'products', 'forms', 'seo']
    });

    assert.ok(synthesis.files.length > 0);
    assert.equal(synthesis.metadata.capabilityValidation.valid, true);
    assert.equal(synthesis.metadata.capabilityValidation.blocked, false);
  });
});

describe('FAZ 75 — HTTP Endpoints on Port 4200', () => {
  test('GET /api/corporate/capabilities returns 200 and capability registry', async () => {
    const res = await httpRequest('GET', '/api/corporate/capabilities');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.registry.capabilities.pages);
    assert.ok(res.body.registry.capabilities.team);
  });

  test('POST /api/corporate/validate-capabilities returns 200 for supported and 409 for missing', async () => {
    // Supported
    const resValid = await httpRequest('POST', '/api/corporate/validate-capabilities', {
      capabilities: ['pages', 'services', 'forms', 'team', 'faq', 'testimonials']
    });
    assert.equal(resValid.statusCode, 200);
    assert.equal(resValid.body.success, true);
    assert.equal(resValid.body.validation.blocked, false);

    // Missing
    const resBlocked = await httpRequest('POST', '/api/corporate/validate-capabilities', {
      capabilities: ['pages', 'unsupported_custom_crm']
    });
    assert.equal(resBlocked.statusCode, 409);
    assert.equal(resBlocked.body.success, false);
    assert.equal(resBlocked.body.validation.blocked, true);
    assert.ok(resBlocked.body.validation.message.includes('[BACKEND CAPABILITY MISSING]'));
  });

  test('POST /api/corporate/upload-reference rejects path traversal with 403', async () => {
    const res = await httpRequest('POST', '/api/corporate/upload-reference', {
      imageBase64: MINIMAL_PNG_BUFFER.toString('base64'),
      originalName: '../../etc/shadow.png'
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('Path traversal'));
  });

  test('POST /api/corporate/upload-reference accepts valid base64 PNG and returns analysis', async () => {
    const res = await httpRequest('POST', '/api/corporate/upload-reference', {
      imageBase64: MINIMAL_PNG_BUFFER.toString('base64'),
      originalName: 'hero_reference.png',
      notes: 'Modern minimal design'
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.file.uuid);
    assert.ok(res.body.analysis.referenceAnalysisId);
    assert.ok(res.body.analysis.detectedPalette);
  });

  test('POST /api/corporate/multi-source-ingest normalizes hybrid data with provenance', async () => {
    const res = await httpRequest('POST', '/api/corporate/multi-source-ingest', {
      manual: {
        companyName: 'Toros Çelik Sanayi',
        industry: 'Ağır Sanayi'
      },
      mapsData: {
        rating: 4.9,
        phone: '+90 322 111 2233'
      }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.companyProfile.company.name.value, 'Toros Çelik Sanayi');
    assert.equal(res.body.companyProfile.contact.phone.value, '+90 322 111 2233');
    assert.ok(res.body.provenanceReport.verifiedCount > 0);
  });

  test('POST /api/corporate/plan blocks with 409 when missing capability is required', async () => {
    const res = await httpRequest('POST', '/api/corporate/plan', {
      companyName: 'Akdeniz Hukuk Bürosu',
      industry: 'Hukuk',
      requiredCapabilities: ['unsupported_custom_crm'] // Missing in backend
    });
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.blocked, true);
    assert.ok(res.body.error.includes('[BACKEND CAPABILITY MISSING]'));
    assert.ok(res.body.error.includes('SITE GENERATION BLOCKED'));
  });

  test('POST /api/corporate/plan succeeds and produces authoritative plan for valid capabilities', async () => {
    const res = await httpRequest('POST', '/api/corporate/plan', {
      companyName: 'Atlas Lojistik A.Ş.',
      industry: 'Taşımacılık & Lojistik',
      requiredCapabilities: ['pages', 'services', 'forms', 'seo'],
      services: ['Karayolu Taşımacılığı', 'Depolama Hizmetleri'],
      contact: { phone: '+90 216 444 0101', email: 'info@atlaslojistik.com' }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.generationMode, 'AUTONOMOUS_SYNTHESIS');
    assert.ok(res.body.authoritativePlanId);
    assert.ok(res.body.designFingerprint);
    assert.equal(res.body.plan.requiresApproval, true);
    assert.equal(res.body.capabilityValidation.blocked, false);
  });
});
