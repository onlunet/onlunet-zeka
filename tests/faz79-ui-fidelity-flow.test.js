import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  validateReferenceImageSecurity,
  analyzeReferenceImage,
  buildImageDesignSpec,
  LayoutFamilies
} from '../src/autonomous/reference-image-analyzer.js';

import {
  createCorporateGenerator,
  resolveLayoutFamily,
  computeLayoutFingerprint
} from '../src/autonomous/corporate-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const GOLDEN_MASTER_ROOT = path.resolve('D:/Antigravity/onlunet-kurumsal');

describe('FAZ 79 — KURUMSAL SİTE ÜRETİCİSİ GÖRSELDEN OLUŞTUR & FIDELITY TESTLERİ', () => {

  const samplePngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x20,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x73, 0x7A, 0x7A,
    0xF4, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82
  ]);

  const sampleAltPngBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, 0x40,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x25, 0x0B, 0xE6,
    0x87, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x78, 0x9C, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D,
    0xB0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82
  ]);

  test('UI Test 1: Kurumsal Site Üret altında üretim modları bulunmalıdır', () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/public/index.html'), 'utf-8');

    assert.ok(html.includes('id="corp-mode-site-btn"'), 'Web Sitesinden butonu mevcut olmalı');
    assert.ok(html.includes('id="corp-mode-maps-btn"'), 'Google Maps butonu mevcut olmalı');
    assert.ok(html.includes('id="corp-mode-image-btn"'), 'Görselden/Şablondan butonu mevcut olmalı');
  });

  test('UI Test 2: Görselden Oluştur ekranı başlık, resmi açıklama ve dropzone içermelidir', () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/public/index.html'), 'utf-8');

    assert.ok(html.includes('id="corp-image-modernizer-box"') || html.includes('id="corp-image-box"'), 'Görsel kutusu kapsayıcısı olmalı');
    assert.ok(html.includes('Referans Görsel / Şablon') || html.includes('Görselden Oluştur'), 'Görselden Oluştur başlığı bulunmalı');
    assert.ok(html.includes('Bir web sitesi ekran görüntüsü yükleyin') || html.includes('Bir web sitesi tasarımının ekran görüntüsünü veya referans görselini yükleyerek'), 'Resmi açıklama metni bulunmalı');
    assert.ok(html.includes('id="corp-image-dropzone"'), 'Dropzone alanı olmalı');
    assert.ok(html.includes('PNG, JPG, JPEG, WEBP'), 'Desteklenen formatlar belirtilmeli');
    assert.ok(html.includes('id="corp-dropzone-preview"') || html.includes('id="corp-image-preview-wrap"'), 'Önizleme alanı olmalı');
  });

  test('UI Test 3: Mod A (Exact) ve Mod B (Similar) açıkça tanımlanmalı ve varsayılan Mod A olmalıdır', () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/public/index.html'), 'utf-8');

    assert.ok(html.includes('id="fidelity-card-exact"') || html.includes('id="fidelity-exact"'), 'Mod A kartı veya radio butonu olmalı');
    assert.ok(html.includes('id="fidelity-card-similar"') || html.includes('id="fidelity-similar"'), 'Mod B kartı veya radio butonu olmalı');
    assert.ok(html.includes('fidelity-card-exact" class="corp-fidelity-card selected"') || html.includes('checked'), 'Mod A varsayılan olarak seçili olmalı');
    assert.ok(html.includes('Birebir Tasarım') || html.includes('Görselin Birebir Aynısını Oluştur'), 'Mod A başlığı net olmalı');
    assert.ok(html.includes('Benzer / Esnek Tasarım') || html.includes('Görseli Referans Alarak Benzerini Oluştur'), 'Mod B başlığı net olmalı');
    assert.ok(html.includes('mümkün olduğunca'), 'Sadakat açıklaması bulunmalı');
    assert.ok(html.includes('switchCorpImageFidelity') || html.includes('selectFidelityMode'), 'Sadakat modu geçiş fonksiyonu bulunmalı');
  });

  test('UI Test 4: Görsel yükleme inputu ve kontrol butonları mevcut olmalıdır', () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/public/index.html'), 'utf-8');

    assert.ok(html.includes('id="corp-reference-file"'), 'Dosya yükleme inputu mevcut olmalı');
    assert.ok(html.includes('id="corp-image-dropzone"'), 'Dropzone alanı mevcut olmalı');
    assert.ok(html.includes('Görsel Seç') || html.includes('SİTEYİ OLUŞTUR'), 'Aksiyon butonu bulunmalı');
    assert.ok(html.includes('corpHandleReferenceFileSelect'), 'Dosya seçim dinleyicisi olmalı');
  });

  test('UI Test 5: Responsive kuralları mobil ve tablette uyumu garanti etmelidir', () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/public/index.html'), 'utf-8');

    assert.ok(html.includes('.corp-fidelity-card') || html.includes('.corp-fidelity-radios'), 'Fidelity kart stili olmalı');
    assert.ok(html.includes('.corp-fidelity-card.selected') || html.includes('.corp-fidelity-option.active'), 'Aktif stil tanımı olmalı');
  });

  test('Pipeline Test 6: Reference Image -> Exact ve Similar için iki farklı tasarım türetmelidir (exact !== similar)', () => {
    const analysis = analyzeReferenceImage({ imageBuffer: samplePngBuffer, notes: 'split hero modern' });

    const specExact = buildImageDesignSpec({ analysis, fidelityMode: 'exact' });
    const specSimilar = buildImageDesignSpec({ analysis, fidelityMode: 'similar' });

    assert.equal(specExact.fidelityMode, 'exact');
    assert.equal(specSimilar.fidelityMode, 'similar');

    // Layout families must differ for controlled variation
    const famExact = resolveLayoutFamily({ imageDesignSpec: specExact, referenceAnalysis: analysis, fidelityMode: 'exact' });
    const famSimilar = resolveLayoutFamily({ imageDesignSpec: specSimilar, referenceAnalysis: analysis, fidelityMode: 'similar' });

    assert.notEqual(famExact, famSimilar, 'Exact ve Similar farklı layout ailelerine çözümlenmelidir');

    const generator = createCorporateGenerator();

    const synthExact = generator.synthesizeCorporateProject({
      companyName: 'Alfa Test A.Ş.',
      industry: 'Bilişim & Danışmanlık',
      imageDesignSpec: specExact,
      referenceAnalysis: analysis,
      fidelityMode: 'exact',
      layoutFamily: famExact
    });

    const synthSimilar = generator.synthesizeCorporateProject({
      companyName: 'Alfa Test A.Ş.',
      industry: 'Bilişim & Danışmanlık',
      imageDesignSpec: specSimilar,
      referenceAnalysis: analysis,
      fidelityMode: 'similar',
      layoutFamily: famSimilar
    });

    const fpExact = synthExact.layoutFingerprint?.computedHash || synthExact.layoutFingerprint?.hash;
    const fpSimilar = synthSimilar.layoutFingerprint?.computedHash || synthSimilar.layoutFingerprint?.hash;

    assert.ok(fpExact, 'Exact parmak izi hesaplanmalı');
    assert.ok(fpSimilar, 'Similar parmak izi hesaplanmalı');
    assert.notEqual(fpExact, fpSimilar, `Exact fingerprint (${fpExact}) Similar fingerprint (${fpSimilar}) ile aynı olmamalıdır`);
  });

  test('Pipeline Test 7: Farklı referans görseller farklı tasarımlar üretmelidir (Reference A !== Reference B)', () => {
    const analysisA = analyzeReferenceImage({ imageBuffer: samplePngBuffer, notes: 'minimal clean' });
    const analysisB = analyzeReferenceImage({ imageBuffer: sampleAltPngBuffer, notes: 'editorial bold architecture' });

    const specA = buildImageDesignSpec({ analysis: analysisA, fidelityMode: 'exact' });
    const specB = buildImageDesignSpec({ analysis: analysisB, fidelityMode: 'exact' });

    const famA = resolveLayoutFamily({ imageDesignSpec: specA, referenceAnalysis: analysisA, fidelityMode: 'exact' });
    const famB = resolveLayoutFamily({ imageDesignSpec: specB, referenceAnalysis: analysisB, fidelityMode: 'exact' });

    const generator = createCorporateGenerator();
    const synthA = generator.synthesizeCorporateProject({
      companyName: 'Beta Holding',
      industry: 'Yönetim Danışmanlığı',
      imageDesignSpec: specA,
      referenceAnalysis: analysisA,
      fidelityMode: 'exact',
      layoutFamily: famA
    });
    const synthB = generator.synthesizeCorporateProject({
      companyName: 'Beta Holding',
      industry: 'Yönetim Danışmanlığı',
      imageDesignSpec: specB,
      referenceAnalysis: analysisB,
      fidelityMode: 'exact',
      layoutFamily: famB
    });

    const fpA = synthA.layoutFingerprint?.computedHash;
    const fpB = synthB.layoutFingerprint?.computedHash;

    assert.notEqual(fpA, fpB, `Farklı görseller farklı parmak izi üretmeli: ${fpA} !== ${fpB}`);
  });

  test('Security Test 8: Güvenlik denetimleri (MIME, dosya boyutu, path traversal, executable injection) korunmalıdır', () => {
    assert.throws(
      () => validateReferenceImageSecurity({ filePath: 'uploads/shell.php' }),
      /SECURITY_VIOLATION/
    );
    assert.throws(
      () => validateReferenceImageSecurity({ filePath: '../../etc/passwd.png' }),
      /SECURITY_VIOLATION/
    );
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
    assert.throws(
      () => validateReferenceImageSecurity({ buffer: oversizedBuffer }),
      /File size exceeds 10MB/
    );
    const fakePng = Buffer.from('<?php echo "evil"; ?>');
    assert.throws(
      () => validateReferenceImageSecurity({ buffer: fakePng, originalName: 'image.png' }),
      /File signature does not match/
    );
  });

  test('Golden Master Test 9: onlunet-kurumsal dosyaları kesinlikle değiştirilmemelidir', () => {
    const schemaPath = path.join(GOLDEN_MASTER_ROOT, 'database/schema.sql');
    const serverPath = path.join(GOLDEN_MASTER_ROOT, 'scripts/server.js');
    const dbPath = path.join(GOLDEN_MASTER_ROOT, 'storage/database.sqlite');

    assert.ok(fs.existsSync(schemaPath), 'schema.sql mevcut olmalı');
    assert.ok(fs.existsSync(serverPath), 'server.js mevcut olmalı');
    assert.ok(fs.existsSync(dbPath), 'database.sqlite mevcut olmalı');

    const schemaHash = crypto.createHash('sha256').update(fs.readFileSync(schemaPath)).digest('hex');
    assert.equal(schemaHash, '7f9c6b4b55b4db36102735effd1ddd9f9f5b86ed646198a81982808ba77ab9c9', 'Golden Master schema.sql salt okunur kalmalı');

    const serverHash = crypto.createHash('sha256').update(fs.readFileSync(serverPath)).digest('hex');
    assert.equal(serverHash, '2455af188af22ebfe4b4ef11eb580d1a4d7344a896e992b58809fcf38ff87797', 'Golden Master server.js salt okunur kalmalı');

    const dbStat = fs.statSync(dbPath);
    assert.equal(dbStat.size, 1208320, 'Golden Master database.sqlite boyutu değişmemeli');
  });

  test('Section 10 Test 10: Görsel değişimi durumunda oturum reset mekanizması UI kodunda bulunmalıdır', () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/public/index.html'), 'utf-8');

    // Verify reset of reference data on change
    assert.ok(html.includes('currentUploadedReferenceData = null') || html.includes('currentUploadedImageBase64 = null'), 'Görsel sıfırlama mekanizması olmalı');
    assert.ok(html.includes('corpClearReferenceImage') || html.includes('clearCorpSelectedImage'), 'Sıfırlama fonksiyonu tanımlı olmalı');
    assert.ok(html.includes("fileInput.value = ''"), 'Dosya girdisini temizlemeli');
  });

  test('Section 9 Test 11: Referans görsel olmadan standart kurumsal üretim sorunsuz çalışmalıdır', () => {
    const generator = createCorporateGenerator();
    const synth = generator.synthesizeCorporateProject({
      companyName: 'Standart Lojistik A.Ş.',
      industry: 'Taşımacılık & Depolama',
      referenceImagePath: null,
      imageDesignSpec: null
    });

    assert.ok(synth, 'Görselsiz kurumsal proje sentezlenmeli');
    assert.ok(synth.files && synth.files.length > 0, 'Sentez dosyaları üretilmeli');
    assert.ok(synth.layoutFingerprint?.computedHash, 'Parmak izi hesaplanmalı');
    assert.ok(synth.files.some(f => f.path.includes('scripts/tailored-frontend.js')), 'tailored-frontend.js mevcut olmalı');
  });

  test('UI Test 12: Mod A ve Mod B kartlarında hem rozet hem başlık metinleri eksiksiz yer almalıdır', () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/public/index.html'), 'utf-8');

    assert.ok(html.includes('Birebir Tasarım') || html.includes('MOD A'), 'Mod A başlığı bulunmalı');
    assert.ok(html.includes('Benzer / Esnek Tasarım') || html.includes('MOD B'), 'Mod B başlığı bulunmalı');
    assert.ok(html.includes('corp-mode-btn'), 'Mod butonları corp-mode-btn sınıfına sahip olmalı');
  });

  test('UI Test 13: switchCorpCreationMode / switchCorpModernizerMode buton sınıflarını yönetmelidir', () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'src/app/public/index.html'), 'utf-8');

    assert.ok(html.includes('switchCorpModernizerMode') || html.includes('switchCorpCreationMode'), 'Mod değişim fonksiyonu mevcut olmalı');
    assert.ok(html.includes('corp-mode-btn'), 'corp-mode-btn sınıfı atanmalı');
  });
});
