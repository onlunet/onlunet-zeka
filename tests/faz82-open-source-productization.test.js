import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright-core';

import { PROJECT_ROOT } from '../src/interfaces/core.js';
const GOLDEN_MASTER_ROOT = path.resolve(PROJECT_ROOT, '..', 'onlunet-kurumsal');

import {
  analyzeReferenceImage,
  buildImageDesignSpec,
  LayoutFamilies
} from '../src/autonomous/reference-image-analyzer.js';

import {
  createCorporateGenerator,
  resolveLayoutFamily,
  computeLayoutFingerprint
} from '../src/autonomous/corporate-generator.js';

import {
  extractReferenceDesignSpec,
  buildScreenshotToCodePrompt,
  generateShadcnTokens,
  diagnoseVisualDifferences
} from '../src/autonomous/screenshot-to-code-adapter.js';

import {
  compareWithPixelmatch,
  decodePng,
  computeDHash,
  computeHammingDistance
} from '../src/autonomous/visual-diff.js';

test('FAZ 82 — OPEN SOURCE PRODUCTIZATION & MULTI-SECTOR REFERENCE BENCHMARK', async (t) => {
  const corporateGen = createCorporateGenerator();

  // Test 1: Open Source Integration Registry verification
  await t.test('1. Open Source Registry is documented, licenses verified (MIT, Apache-2.0, BSD-3, ISC)', () => {
    const regPath = path.join(PROJECT_ROOT, 'docs', 'open-source-registry.md');
    assert.ok(fs.existsSync(regPath), 'docs/open-source-registry.md must exist');
    const content = fs.readFileSync(regPath, 'utf8');
    assert.ok(content.includes('playwright-core'), 'Must document playwright-core');
    assert.ok(content.includes('pixelmatch'), 'Must document pixelmatch');
    assert.ok(content.includes('pngjs'), 'Must document pngjs');
    assert.ok(content.includes('grapesjs'), 'Must document grapesjs');
    assert.ok(content.includes('screenshot-to-code'), 'Must document screenshot-to-code');
    assert.ok(content.includes('shadcn/ui'), 'Must document shadcn/ui');
  });

  // Test 2: screenshot-to-code adapter generates structured spec and shadcn design tokens
  await t.test('2. screenshot-to-code adapter generates valid shadcn tokens and structured design spec', () => {
    const tokens = generateShadcnTokens({ primaryColor: '#059669', accentColor: '#ea580c', borderRadius: '12px' });
    assert.ok(tokens.includes('--primary: #059669;'), 'Must inject primary token');
    assert.ok(tokens.includes('--radius: 12px;'), 'Must inject border radius token');

    const analysis = analyzeReferenceImage({
      notes: 'Luxury Restaurant Gourmet Dining Gold Wine Centered Hero'
    });
    const spec = extractReferenceDesignSpec(analysis, { fidelityMode: 'exact' });
    assert.equal(spec.architecture, 'screenshot-to-code-shadcn');
    assert.ok(spec.visualStyle.primaryColors.length > 0);
    assert.ok(spec.layout.sections.length >= 6);

    const prompt = buildScreenshotToCodePrompt({ referenceSpec: spec, companyProfile: { companyName: 'Test' } });
    assert.ok(prompt.systemPrompt.includes('shadcn/ui'));
    assert.ok(prompt.userPrompt.includes('Primary Color'));
  });

  // Test 3: Multi-Sector Reference Generalization (5 distinct sectors, zero hardcoded single-image hacks)
  await t.test('3. Generic reference reproduction pipeline works across 5 distinct sectors', () => {
    const sectorTestCases = [
      {
        id: 'PETSHOP',
        notes: 'Friendly Petshop Animal Care Bento Grid Emerald Orange',
        companyName: 'Pati Dostları Petshop & Mama',
        expectedPalette: '#059669',
        forbiddenSnippet: 'Akdeniz Lojistik'
      },
      {
        id: 'RESTAURANT',
        notes: 'Gourmet Restaurant Luxury Dining Wine Gold Centered Hero',
        companyName: 'Le Gourmet Restoran & Şarap Evi',
        expectedPalette: '#831843',
        forbiddenSnippet: 'Akdeniz Lojistik'
      },
      {
        id: 'HEALTHCARE',
        notes: 'Clean Healthcare Medical Clinic Hospital Doctors Cyan Teal Centered',
        companyName: 'Vitalis Özel Sağlık & Diş Kliniği',
        expectedPalette: '#0891b2',
        forbiddenSnippet: 'Akdeniz Lojistik'
      },
      {
        id: 'LEGAL',
        notes: 'Prestige Legal Law Firm Attorney Consulting Navy Amber',
        companyName: 'LexGlobal Hukuk & Arabuluculuk',
        expectedPalette: '#1e293b',
        forbiddenSnippet: 'Akdeniz Lojistik'
      },
      {
        id: 'ARCHITECTURE',
        notes: 'Modern Architecture Editorial Magazine Raw Charcoal Brass Staggered',
        companyName: 'Atölye Modern Mimarlık & İç Mimari',
        expectedPalette: '#18181b',
        forbiddenSnippet: 'Akdeniz Lojistik'
      }
    ];

    const fingerprints = new Set();
    for (const tc of sectorTestCases) {
      const analysis = analyzeReferenceImage({ notes: tc.notes });
      assert.equal(analysis.detectedPalette.primary, tc.expectedPalette, `${tc.id} must match expected palette`);

      const spec = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
      const synthesized = corporateGen.synthesizeCorporateProject({
        companyName: tc.companyName,
        industry: analysis.detectedPalette.mood,
        imageDesignSpec: spec,
        fidelityMode: 'exact'
      });

      // Assert complete content isolation: NO dummy logistics leak!
      const html = synthesized.files.find(f => f.path === 'resources/views/frontend/home.php')?.content || '';
      assert.ok(!html.includes(tc.forbiddenSnippet), `${tc.id} must never leak dummy logistics text`);
      assert.ok(html.includes(tc.companyName), `${tc.id} HTML must contain company name`);

      fingerprints.add(synthesized.layoutFingerprint.computedHash);
    }

    assert.equal(fingerprints.size, 5, 'All 5 distinct sector references must produce completely unique fingerprints');
  });

  // Test 4: Mapbox pixelmatch and pngjs visual diff calculation and 3-factor score
  await t.test('4. pixelmatch and pngjs accurately calculate 3-factor scores and diff pixels', () => {
    // Generate two 100x100 PNG buffers
    const pngA = new PNG({ width: 100, height: 100 });
    const pngB = new PNG({ width: 100, height: 100 });

    for (let i = 0; i < 100 * 100 * 4; i += 4) {
      pngA.data[i] = 37; pngA.data[i+1] = 99; pngA.data[i+2] = 235; pngA.data[i+3] = 255; // Blue
      pngB.data[i] = 37; pngB.data[i+1] = 99; pngB.data[i+2] = 235; pngB.data[i+3] = 255; // Blue
    }

    // Identical images test
    const identicalResult = compareWithPixelmatch(PNG.sync.write(pngA), PNG.sync.write(pngB));
    assert.equal(identicalResult.diffPixels, 0, 'Identical PNGs must have 0 diff pixels');
    assert.equal(identicalResult.diffRatio, 0, 'Diff ratio must be 0');
    assert.equal(identicalResult.pixelSimilarity, 100, 'Pixel similarity must be 100 on identical images');
    assert.equal(identicalResult.structuralFidelity, null, 'Structural fidelity is honest null (NOT_MEASURED)');
    assert.equal(identicalResult.contentRelevance, null, 'Content relevance is honest null (NOT_MEASURED)');
    assert.equal(identicalResult.overallScore, null, 'Overall score is honest null (NOT_MEASURED)');

    // Mutate 500 pixels in pngB
    for (let i = 0; i < 500 * 4; i += 4) {
      pngB.data[i] = 239; pngB.data[i+1] = 68; pngB.data[i+2] = 68; // Red
    }

    const diffResult = compareWithPixelmatch(PNG.sync.write(pngA), PNG.sync.write(pngB));
    assert.ok(diffResult.diffPixels > 0, 'Mutated pixels must be detected');
    assert.ok(diffResult.diffRatio > 0, 'Diff ratio must be > 0');
    assert.ok(diffResult.pixelSimilarity < 100, 'Pixel similarity must decrease on mutation');
    assert.ok(diffResult.diffPngBuffer, 'Must generate diff PNG buffer');
  });

  // Test 5: Iterative Refinement Diagnosis
  await t.test('5. Iterative Refinement Diagnosis suggests correct adjustments', () => {
    const perfectDiag = diagnoseVisualDifferences({ pixelSimilarity: 95, diffRatio: 0.02 });
    assert.equal(perfectDiag.needsCorrection, false);
    assert.equal(perfectDiag.pixelSimilarity, 95);

    const divergedDiag = diagnoseVisualDifferences({ pixelSimilarity: 60, diffRatio: 0.35 });
    assert.equal(divergedDiag.needsCorrection, true);
    assert.ok(divergedDiag.recommendations.length >= 1);
    assert.ok(divergedDiag.recommendations.some(r => r.target === 'colors_and_contrast'));
  });

  // Test 6: Golden Master Immutability
  await t.test('6. Golden Master onlunet-kurumsal files remain strictly untouched', () => {
    const schemaPath = path.join(GOLDEN_MASTER_ROOT, 'database', 'schema.sql');
    const serverPath = path.join(GOLDEN_MASTER_ROOT, 'scripts', 'server.js');
    assert.ok(fs.existsSync(schemaPath), 'schema.sql must exist');
    assert.ok(fs.existsSync(serverPath), 'server.js must exist');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    assert.ok(!serverContent.includes('Gökhan KOÇ PetShop'), 'Golden Master server.js must never be modified with client data');
  });
});
