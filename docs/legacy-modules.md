# ONLUNET ZEKA — Legacy & Deprecated Modül Envanteri

**Tarih:** 2026-09-15  
**Durum:** STABILIZATION 1.1 — Güvenli Konsolidasyon ve Mimari Netleştirme  
**Yönetici Kuralı:** Legacy modüller silinmez; geriye dönük uyumluluk ve denetim izi için dondurulmuş olarak izole edilir. Fonksiyonel eşdeğerlik kanıtlanmadıkça birebir "replacement" iddiasında bulunulamaz.

---

## 1. Gerçek Üretim Runtime Yolu (Canonical Authority Path)

ONLUNET ZEKA kurumsal web sitesi üretiminde resmi ve aktif runtime yolu:

```text
server.js (HTTP / API Sınırı)
    ↓
reference-image-analyzer.js (Görsel Analizi & Tasarım Spesifikasyonu Çıkarımı)
    ↓
corporate-generator.js (Üretim Seviyesi HTML/CSS/Site Üretimi)
    ↓
renderDynamicCorporateHome (Bespoke HTML/CSS/PHP Render Çıktısı)
```

### Görev Ayrımı (Pipeline Distinction)
- **`reference-image-analyzer.js`:** Yalnızca görsel analizi, renk paleti tespiti, layout ailesi tespiti ve `ReferenceDesignSpec` çıkarımından sorumludur (`image analysis / design spec extraction`).
- **`corporate-generator.js`:** Spesifikasyonu, sektör arketipini ve şirket profilini alarak gerçek SQLite veritabanı seed eden, şablon artıklarını temizleyen ve standalone site dosyalarını üreten ana motordur (`production HTML/CSS/site generation`).
- **`browser-qa-inspector.js`:** Üretilen sitenin tarayıcı/runtime denetimini yapan bağımsız kalite güvence katmanıdır (`browser/runtime QA`).

---

## 2. Legacy & Deprecated Modüller Tablosu

| Modül Dosyası | Durum | Production Runtime'da Aktif mi? | Son Bilinen Kullanım | Current Production Path | Functional Replacement |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `website-synthesis-engine.js` | **DEPRECATED / LEGACY** | Hayır (Legacy Fallback) | FAZ 73 Sentezleme & Visual Critic | `corporate-generator.js` | **PARTIAL** |
| `layout-graph-engine.js` | **DEPRECATED / LEGACY** | Hayır | FAZ 73 Slot Tabanlı Layout Grafları | `corporate-generator.js` + `reference-image-analyzer.js` | **NOT EQUIVALENT** |
| `visual-composition-engine.js` | **DEPRECATED / LEGACY** | Hayır | FAZ 73 Çoklu Bileşen HTML Birleştirme | `corporate-generator.js` | **NOT EQUIVALENT** |
| `design-system-engine.js` | **DEPRECATED / LEGACY** | Hayır | FAZ 73 Eski Tip CSS Token Üretimi | `screenshot-to-code-adapter.js` (shadcn tokens) | **NOT EQUIVALENT** |
| `design-reasoning-engine.js` | **DEPRECATED / LEGACY** | Hayır | FAZ 73 Heuristic Tasarım Stratejisi | `reference-image-analyzer.js` | **NOT EQUIVALENT** |
| `design-originality-guard.js` | **DEPRECATED / LEGACY** | Hayır | FAZ 73 N-gram & Renk Orijinallik Denetimi | `corporate-generator.js` (Fingerprint Engine) | **NOT EQUIVALENT** |
| `visual-refactoring-engine.js` | **DEPRECATED / LEGACY** | Hayır (Audit Ledger Salt Okunur) | FAZ 72 Görsel CSS Yamalama & Rollback | `browser-qa-inspector.js` (Runtime QA) | **NOT EQUIVALENT** |
| `visual-regression-loop.js` | **DEPRECATED / LEGACY** | Hayır | FAZ 72 Otomatik Regresyon Döngüsü | `browser-qa-inspector.js` (CDP QA) | **NOT EQUIVALENT** |
| `visual-remediation-policy.js`| **DEPRECATED / LEGACY** | Hayır | FAZ 72 Otomatik İyileştirme Politikası | `browser-qa-inspector.js` | **NOT EQUIVALENT** |
| `project-generator.js` | **DEPRECATED / LEGACY** | Hayır (Eski Faz Uyumluluğu) | FAZ 65-70 Statik Şablon Kopyalama | `corporate-generator.js` | **PARTIAL** |
| `project-archetypes.js` | **DEPRECATED / LEGACY** | Hayır | FAZ 65-70 Eski E-Ticaret/SaaS Şablonları | `sector-archetypes.js` / `corporate-generator.js` | **PARTIAL** |

---

## 3. Modül Bazında Detaylı Durum Raporu

### 3.1 `corporate-generator.js`
- **Current Production Generator:** **YES**
- **Mimari Not:** Mevcut sistemin ana üretim motorudur ancak eski modüllerin tüm iç soyutlamalarını ve fonksiyonlarını birebir devraldığı iddia edilmez; bağımsız ve doğrudan bir kurumsal sentez yaklaşımı uygular.

### 3.2 `website-synthesis-engine.js`
- **Neden Legacy:** FAZ 73 deneysel 6 adımlı slot tabanlı sentez motoru.
- **Current Production Path:** `corporate-generator.js`
- **Functional Replacement:** `PARTIAL`

### 3.3 `layout-graph-engine.js`
- **Neden Legacy:** Sabit slot düğümleri üzerinden layout hesaplama denemesi.
- **Current Production Path:** `corporate-generator.js` + `reference-image-analyzer.js`
- **Functional Replacement:** `NOT EQUIVALENT`

### 3.4 `visual-composition-engine.js`
- **Neden Legacy:** Slot içeriklerini string bazlı birleştiren erken dönem prototip.
- **Current Production Path:** `corporate-generator.js`
- **Functional Replacement:** `NOT EQUIVALENT`

### 3.5 `design-system-engine.js`
- **Neden Legacy:** Katı CSS kuralları üreten eski token mekanizması.
- **Current Production Path:** `screenshot-to-code-adapter.js` (shadcn tokens)
- **Functional Replacement:** `NOT EQUIVALENT`

### 3.6 `design-reasoning-engine.js`
- **Neden Legacy:** Metin bazlı kural çıkarımı.
- **Current Production Path:** `reference-image-analyzer.js`
- **Functional Replacement:** `NOT EQUIVALENT`

### 3.7 `design-originality-guard.js`
- **Neden Legacy:** Yüzeysel n-gram ve histogram denetimi.
- **Current Production Path:** `corporate-generator.js` (Layout Fingerprint)
- **Functional Replacement:** `NOT EQUIVALENT`

### 3.8 `visual-refactoring-engine.js`
- **Neden Legacy:** DOM CSS seçicilerini regex ile yamama motoru. Primary production path'in parçası değildir.
- **Current QA Path:** `browser-qa-inspector.js`
- **Functional Replacement:** `NOT EQUIVALENT`

### 3.9 `visual-regression-loop.js` & `visual-remediation-policy.js`
- **Neden Legacy:** Eski headless CSS patch döngüsü.
- **Current QA Path:** `browser-qa-inspector.js` (CDP-based headless DevTools QA Loop)
- **Functional Replacement:** `NOT EQUIVALENT`

### 3.10 `project-generator.js` & `project-archetypes.js`
- **Neden Legacy:** Altın kalıbı doğrudan ham kopyalayan eski nesil statik jeneratörler.
- **Current Production Path:** `corporate-generator.js`
- **Functional Replacement:** `PARTIAL`

---

## 4. Dondurulmuş Alan Verileri (Frozen Domain Data)

Aşağıdaki dosyalar **FROZEN DOMAIN DATA** olarak sınıflandırılmıştır. Üzerlerinde refactor veya silme yapılmaz:
- `src/autonomous/sector-presets.js`: Kurumsal sektör renkleri, tipografi ve başlık önayarları.
- `src/autonomous/sector-archetypes.js`: Sektörel terminoloji, modül yapıları ve yasaklı kelime filtreleri.

---

## 5. Layout Family Hash Mekanizması Dokümantasyonu

`corporate-generator.js` içerisinde bulunan:
```javascript
const hash = ...
families[Math.abs(hash) % families.length]
```
mantığına dair teknik not:
- **PURPOSE:** Referans görsel bulunmadığı durumlarda deterministik layout çeşitliliği sağlamak.
- **NOT:** Bu bir gerçek yapay zeka tasarım zekası (design intelligence) değildir; psödo-rastlantısal deterministik dağıtım kuralıdır.
- **FUTURE:** Referans görsel ve kullanıcı girdisi odaklı (`reference-aware generation`) pipeline tarafından zaman içinde tamamen bypass edilmelidir.

---

## 6. Metrik ve Kalite Raporlama Standardı

- **Pixel Similarity (`pixelSimilarity`):** Mapbox pixelmatch motoru ile referans ve üretilen sayfa arasındaki gerçek piksel benzerlik yüzdesi (0-100).
- **Structural Fidelity (`structuralFidelity`):** `null` / `NOT_MEASURED` (Görsel boyut delta'sı gerçek yapısal fidelity değildir).
- **Content Relevance (`contentRelevance`):** `null` / `NOT_MEASURED` (Piksel farkı semantik içerik uyumunu ölçemez).
- **Overall Score (`overallScore`):** `null` / `NOT_MEASURED` (Sahte ağırlıklı ortalama formülü kaldırılmıştır).
