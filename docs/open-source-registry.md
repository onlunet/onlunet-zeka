# ONLUNET ZEKA — Open Source Integration & Productization Registry (FAZ 83 Doğrulanmış Sürüm)

## 1. Mimari İlke (Core Philosophy)
> **SIFIR GEREKSİZ KOD, MAKSİMUM KANITLANMIŞ AÇIK KAYNAK ALTYAPI.**
> Kendi kodumuzu sadece ONLUNET ZEKA'nın özgün iş mantığı, güvenlik sınırları ve kurumsal orkestrasyonunda tutuyoruz.
> Açık kaynak projelerin kullanım durumunu abartmadan, gerçek entegrasyon ile mimari esinlenmeyi net olarak ayırıyoruz.

---

## 2. Repo Audit & Karar Matrisi (KEEP / REPLACE / WRAP / REMOVE)

| Kategori | Mevcut Implementation | Karar | Statü & Yeni Entegrasyon |
| :--- | :--- | :---: | :--- |
| **AI Provider / Router** | `src/app/ai-gateway.js`, `src/providers/` | **KEEP** | **ACTIVE (Özgün)**: Çoklu hesap havuzu, kota optimizasyonu, otomatik model keşfi ve failover. |
| **LLM Orchestration** | `src/autonomous/phase-engine.js` | **KEEP** | **ACTIVE (Özgün)**: Kurumsal iş akışları, onay mekanizmaları ve faz geçişleri. |
| **Vision / Image Analysis** | `src/autonomous/reference-image-analyzer.js` | **WRAP / DECOUPLE** | **PATTERN INSPIRED / INTERNAL ADAPTER**: `abi/screenshot-to-code` multimodal görsel istemleme ve yapısal ayrıştırma yaklaşımları uyarlandı. Tekil hash/sektör hileleri kaldırıldı. |
| **Reference Image Analysis** | `src/autonomous/reference-image-analyzer.js` | **WRAP / ENHANCE** | **ACTIVE**: Sektör tespiti ile görsel layout yapısı birbirinden tamamen ayrıldı. `ReferenceDesignSpec` oluşturuldu. |
| **Design Reasoning** | `src/autonomous/design-reasoning-engine.js` | **KEEP** | **ACTIVE**: Sektörel iş modeli ve kurumsal strateji motoru. |
| **Layout Generation** | `src/autonomous/layout-graph-engine.js` | **KEEP / WRAP** | **ACTIVE**: Sektörden bağımsız, referansın gerçek görsel yapısını takip eden layout mimarisi. |
| **Design System** | `src/autonomous/design-system-engine.js` | **WRAP** | **DESIGN TOKEN INSPIRATION**: `shadcn/ui` CSS token ve renk değişkenleri (`--primary`, `--radius`, `--card` vb.). |
| **Component Generation** | `src/autonomous/corporate-generator.js` | **WRAP** | **DESIGN TOKEN INSPIRATION**: `shadcn/ui` bileşen desenleri (Button, Card, Accordion, Badge, Nav, Lead Form). |
| **Frontend Generation** | `src/autonomous/corporate-generator.js` | **ENHANCE** | **ACTIVE**: Çok sektörlü, responsive, sıfır-hardcode kurumsal HTML/CSS üretim motoru. |
| **Browser Automation** | `src/autonomous/visual-capture-engine.js` | **WRAP** | **ACTIVE DEPENDENCY**: `playwright-core` (Microsoft, Apache-2.0). |
| **Screenshot Capture** | `src/autonomous/visual-capture-engine.js` | **WRAP** | **ACTIVE DEPENDENCY**: `playwright-core` ile 1440x900, 768x1024, 375x812 çoklu viewport yakalama. |
| **Visual Comparison** | `src/autonomous/visual-diff.js` | **REPLACE** | **ACTIVE DEPENDENCY**: `pixelmatch` (Mapbox, ISC) ve `pngjs` (MIT) ile algısal piksel diffing ve diff PNG üretimi. |
| **Web Builder / Editor** | `src/app/public/admin-editor.html`, `server.js` | **WRAP** | **ACTIVE RUNTIME FEATURE**: `grapesjs` (BSD-3-Clause) editör arayüzü, `GET /api/projects/:id/content` ve `POST /api/projects/save-frontend` uçtan uca çalışır. |
| **Forms & CRM** | `src/app/public/index.html`, CRM endpoints | **KEEP** | **ACTIVE**: `/api/v1/leads` CRM API ve kurumsal lead formu uyumluluğu korundu. |
| **Security & Isolation** | `src/policies/`, Golden Master Guard | **KEEP** | **ACTIVE**: `D:\Antigravity\onlunet-kurumsal` (Golden Master) salt-okunur koruması ve port izolasyonu. |
| **Specific Petshop Hacks**| Sabit hash, Gökhan KOÇ, Balıkesir | **REMOVE** | **REMOVED (Sıfır Hile)**: Tek bir görsele veya dükkana özel tüm kurallar ve dosya yolları silindi. |

---

## 3. Açık Kaynak Kütüphaneler & Projelerin Gerçek Statüleri

### 1. `playwright-core`
- **Repository**: [microsoft/playwright](https://github.com/microsoft/playwright)
- **Version**: `^1.58.0`
- **License**: Apache-2.0
- **Actual Runtime Usage**: Headless tarayıcı yönetimi, çoklu viewport (1440x900, 768x1024, 375x812) screenshot yakalama.
- **Integration Type**: **ACTIVE RUNTIME / TEST DEPENDENCY** (package.json içinde yüklü)
- **Files Using It**: `tests/faz82-open-source-productization.test.js`, `scratch/run_productization_benchmark.mjs`, test suites.
- **Replacement Of**: Ham WebSocket/CDP kod karmaşası.

### 2. `pixelmatch`
- **Repository**: [mapbox/pixelmatch](https://github.com/mapbox/pixelmatch)
- **Version**: `^7.1.0`
- **License**: ISC
- **Actual Runtime Usage**: İki görsel (referans vs üretilen frontend) arasındaki piksel farklarını anti-aliasing algılamasıyla hesaplama ve diff PNG görseli oluşturma.
- **Integration Type**: **ACTIVE RUNTIME / TEST DEPENDENCY** (package.json içinde yüklü)
- **Files Using It**: `src/autonomous/visual-diff.js`, test suites, visual QA pipeline.
- **Replacement Of**: Özgün yaklaşık renk farkı hesaplama mantığı.

### 3. `pngjs`
- **Repository**: [pngjs/pngjs](https://github.com/pngjs/pngjs)
- **Version**: `^7.0.0`
- **License**: MIT
- **Actual Runtime Usage**: PNG dosyalarını saf JavaScript ile çözme, piksel analizi (geometri/renk çıkarımı) ve diff PNG görseli kaydetme.
- **Integration Type**: **ACTIVE RUNTIME / TEST DEPENDENCY** (package.json içinde yüklü)
- **Files Using It**: `src/autonomous/visual-diff.js`, `src/autonomous/reference-image-analyzer.js`.
- **Replacement Of**: Manuel buffer slicing / harici resim bağımlılıkları.

### 4. `grapesjs`
- **Repository**: [GrapesJS/grapes](https://github.com/GrapesJS/grapes)
- **Version**: `^0.22.0`
- **License**: BSD-3-Clause
- **Actual Runtime Usage**: AI tarafından üretilen sitelerin son kullanıcı tarafından görsel olarak düzenlenmesini sağlayan Web Builder / Editor katmanı.
- **Integration Type**: **ACTIVE RUNTIME FEATURE (Web Builder / Editor)** (package.json içinde yüklü)
- **Files Using It**: `src/app/public/admin-editor.html`, `src/app/server.js` (`/admin/editor`, `/vendor/grapesjs/*`, `/api/projects/:id/content`, `/api/projects/save-frontend`).
- **Replacement Of**: Sıfırdan yazılması planlanan wysiwyg / visual canvas motoru.

### 5. `screenshot-to-code`
- **Repository**: [abi/screenshot-to-code](https://github.com/abi/screenshot-to-code)
- **License**: MIT
- **Actual Runtime Usage**: Proje Python/FastAPI ve React tabanlı bir tam uygulamadır; Node.js package dependency **DEĞİLDİR**. Projenin multimodal layout istemleme (prompt engineering), semantik bölüm hiyerarşisi ve görsel teşhis mimarisi Node.js içinde saf adaptör olarak uyarlanmıştır.
- **Integration Type**: **PATTERN INSPIRED / INTERNAL ADAPTER** (npm dependency DEĞİLDİR)
- **Files Using It**: `src/autonomous/screenshot-to-code-adapter.js`, `src/autonomous/reference-image-analyzer.js`.

### 6. `shadcn/ui`
- **Repository**: [shadcn-ui/ui](https://github.com/shadcn-ui/ui)
- **License**: MIT
- **Actual Runtime Usage**: `shadcn/ui` bir npm paketi **DEĞİLDİR** (CLI ile kopyalanan bileşen desenidir). Projenin `--primary`, `--card`, `--radius`, `--accent` vb. CSS tasarım değişkenleri (design tokens) ve erişilebilir bileşen desenleri kurumsal jeneratöre entegre edilmiştir.
- **Integration Type**: **DESIGN TOKEN & COMPONENT PRIMITIVES INSPIRATION** (npm dependency DEĞİLDİR)
- **Files Using It**: `src/autonomous/screenshot-to-code-adapter.js`, `src/autonomous/corporate-generator.js`, `src/autonomous/design-system-engine.js`.

---

## 4. Güvenlik ve Bağımlılık Denetimi (Security & Audit)
- **`npm audit` Sonucu**: 0 Güvenlik Açığı (0 vulnerabilities found).
- **Lisans Uyumluluğu**: Yüklü paketlerin tümü ticari kullanıma uygun izin verici lisanslara sahiptir (MIT, Apache-2.0, BSD-3-Clause, ISC); copyleft/GPL/AGPL kısıtlaması bulunmamaktadır.
- **Altın Şablon İzolasyonu**: `D:\Antigravity\onlunet-kurumsal` (Golden Master) kesinlikle READ-ONLY kalmaktadır; hiçbir paket master kalıbı değiştiremez.
