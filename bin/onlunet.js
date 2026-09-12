#!/usr/bin/env node
/**
 * ONLUNET ZEKA - Command Line Interface (CLI)
 * Project Generation & Server Launcher
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectGenerator, TemplateMetadata } from '../src/autonomous/project-generator.js';
import { createApplicationServer } from '../src/app/server.js';

const args = process.argv.slice(2);
const command = args[0] || 'help';

function printHelp() {
  console.log(`
============================================================
⚡ ONLUNET ZEKA — Otonom Proje & Kod Üretim CLI
============================================================

KULLANIM:
  node bin/onlunet.js <komut> [seçenekler]

KOMUTLAR:
  start                  Web Sunucusunu ve Arayüzünü Başlatır (varsayılan port: 4200)
  create <istek>         Belirtilen doğal dil isteğiyle otonom proje üretir
  templates              Kullanılabilir proje şablonlarını listeler
  help                   Bu yardım mesajını görüntüler

SEÇENEKLER:
  --dir <hedef_dizin>    Projenin oluşturulacağı klasör (varsayılan: projects/<proje-adı>)
  --name <proje_adı>     Projenin adı (varsayılan: otomatik türetilir)
  --type <şablon_tipi>   express-api | web-app | python-cli | fullstack-todo
  --port <port>          Sunucu portu (varsayılan: 4200)
  --dry-run              Diske yazmadan simülasyon yapar

ÖRNEKLER:
  node bin/onlunet.js start
  node bin/onlunet.js create "Express REST API projesi üret" --name siparis-api
  node bin/onlunet.js create "Modern responsive web dashboard" --type web-app
  node bin/onlunet.js create "Python CLI veri işleme aracı" --dir ./my-python-tool
============================================================
`);
}

function parseArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith('--')) {
    return args[idx + 1];
  }
  return defaultValue;
}

async function handleTemplates() {
  console.log('\n📦 MEVCUT PROJE ŞABLONLARI:\n');
  TemplateMetadata.forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.id}] ${t.name}`);
    console.log(`     Kategori: ${t.category} | Dil: ${t.language}`);
    console.log(`     Açıklama: ${t.description}\n`);
  });
}

async function handleStart() {
  const port = parseInt(parseArg('--port', process.env.PORT || '4200'), 10);
  const server = createApplicationServer();
  server.listen(port, () => {
    console.log(`\n============================================================`);
    console.log(`🚀 ONLUNET ZEKA Sunucusu Başlatıldı!`);
    console.log(`📡 Web Arayüzü: http://localhost:${port}`);
    console.log(`⚡ Durum: Hazır & Proje Üretimi Aktif`);
    console.log(`============================================================\n`);
  });
}

async function handleCreate() {
  const prompt = args[1];
  if (!prompt || prompt.startsWith('--')) {
    console.error('❌ Hata: Proje açıklaması (prompt) belirtilmelidir.');
    console.log('Örnek: node bin/onlunet.js create "Express REST API projesi üret"');
    process.exit(1);
  }

  const name = parseArg('--name');
  const type = parseArg('--type');
  const dir = parseArg('--dir', name ? `projects/${name}` : 'projects/yeni-proje');
  const dryRun = args.includes('--dry-run');

  console.log(`\n⚡ ONLUNET ZEKA Otonom Proje Üretimi Başlatılıyor...`);
  console.log(`📝 İstek: "${prompt}"`);
  console.log(`📁 Hedef Dizin: ${dir}`);

  const generator = createProjectGenerator();
  const synthesis = await generator.synthesizeProject({
    prompt,
    projectName: name,
    projectType: type,
    targetDirectory: dir
  });

  console.log(`\n✨ Proje Tasarlandı: ${synthesis.projectName} (${synthesis.projectType})`);
  console.log(`📄 Dosya Sayısı: ${synthesis.files.length}`);
  synthesis.files.forEach(f => console.log(`   + ${path.join(synthesis.targetDirectory, f.path)}`));

  const plan = generator.createProjectPlan({
    synthesis,
    workspaceRoot: process.cwd()
  });

  console.log(`\n🔒 ONLUNET ZEKA Denetimli Mutasyon ile Diske Yazılıyor...`);
  const result = await generator.applyProjectPlan({
    plan,
    workspaceRoot: process.cwd(),
    approval: true,
    dryRun
  });

  if (result.success) {
    console.log(`\n============================================================`);
    console.log(`🎉 PROJE BAŞARIYLA ÜRETİLDİ VE DOĞRULANDI!`);
    console.log(`📊 Yazılan Dosya: ${result.writtenFiles.length} adet`);
    console.log(`💾 Toplam Boyut: ${result.totalBytesWritten} bayt`);
    console.log(`\n🚀 ÇALIŞTIRMA TALİMATLARI:`);
    console.log(`   cd ${synthesis.targetDirectory}`);
    if (synthesis.projectType === 'python-cli') {
      console.log(`   python -m unittest discover tests`);
      console.log(`   python main.py --help`);
    } else if (synthesis.projectType === 'web-app') {
      console.log(`   start index.html`);
    } else {
      console.log(`   npm test`);
      console.log(`   npm start`);
    }
    console.log(`============================================================\n`);
  } else {
    console.error(`❌ Hata: Proje üretimi başarısız oldu.`);
    result.failedFiles.forEach(f => console.error(`   - ${f.file}: ${f.reason}`));
    process.exit(1);
  }
}

// Main Dispatcher
async function main() {
  switch (command) {
    case 'start':
    case 'serve':
      await handleStart();
      break;
    case 'create':
    case 'generate':
      await handleCreate();
      break;
    case 'templates':
    case 'list':
      await handleTemplates();
      break;
    case 'help':
    default:
      printHelp();
      break;
  }
}

main().catch(err => {
  console.error('❌ Beklenmeyen hata:', err);
  process.exit(1);
});
