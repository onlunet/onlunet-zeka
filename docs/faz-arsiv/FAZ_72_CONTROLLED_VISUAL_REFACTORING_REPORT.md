# FAZ 72 — CONTROLLED VISUAL REFACTORING & DESIGN SYSTEM TOKEN SYNC REPORT
## ONLUNET ZEKA — Mimari Doğrulama, Denetimli Görsel İyileştirme ve Regresyon Koruması

**Tarih**: 2026-09-12  
**Durum**: Tamamlandı & Doğrulandı (89 / 89 Test PASS)  
**Yetki İlkesi**: `AI -> PROPOSAL -> VALIDATION -> AUTHORIZATION -> EXECUTION -> VISUAL REGRESSION`

---

### 1. MEVCUT MİMARİ VE ENTEGRASYON İNCELEMESİ

FAZ 71 kapsamında kurulan Visual Intelligence ve Visual Critic katmanı; web sayfalarını 10 farklı tasarım kategorisinde inceleyen, generic AI şablon desenlerini (`genericDesignSignals`) yakalayan ve açıklanabilir bir Design Quality Score (0–100) üreten sağlam bir görsel analiz altyapısı sağlamıştı.

Ancak bu altyapının en temel mimari garantisi **Sıfır Tasarım Oto-Düzeltmesi (Zero Design Auto-Fix / proposalOnly = true)** idi.

FAZ 72, bu tespitleri rastgele veya kontrolsüz CSS düzenlemelerine dönüştürmek yerine, **mevcut otorite modelini (`execution-authorization.js`, `file-mutation.js`) birebir kullanarak** şu hattı kurmuştur:
1. **Analiz**: Görsel zeka arayüzü tarar ve bulguları çıkarır.
2. **Öneri (Proposal)**: Bulgular yalnızca geçerli CSS değişkenlerine (`--token`) ve izin verilen atomik değişiklik tiplerine dönüştürülür.
3. **Doğrulama (Validation)**: Önerinin şeması, izin verilen tipleri ve hedef dosyadaki mevcut durumun bayatlayıp bayatlamadığı (`STALE_PROPOSAL`) denetlenir.
4. **Yetkilendirme (Authorization)**: İnsan operatör veya yetkili sınır tarafından `AUTHORIZED` kararı verilmeden hiçbir işlem yürütülemez.
5. **Atomik Uygulama (Execution)**: Dosyanın SHA-256 hash'i ve tam anlık görüntüsü (snapshot) alınarak değişiklikler atomik uygulanır.
6. **Görsel Regresyon Döngüsü (Visual Regression Loop)**: Değişiklik sonrası sayfa tekrar yakalanır ve puanlanır. Eğer genel skor düşerse, responsive uyum bozulursa veya kontrast gerilerse sistem **otomatik olarak rollback** yapar.

---

### 2. EKLENEN MODÜLLER

| Modül Yolu | Sorumluluk & Görev | Temel Garantiler |
| :--- | :--- | :--- |
| `src/autonomous/visual-token-system.js` | CSS değişkenlerinin (`:root { --token }`) ayrıştırılması, kategorize edilmesi ve bayatlama denetimi. | `STALE_PROPOSAL` tespiti; 7 token kategorisi (colors, spacing, radius, typography, shadows, effects, layout); sıfır harici kütüphane. |
| `src/autonomous/visual-proposal-engine.js` | Yapılandırılmış ve doğrulanabilir `DesignProposal` sözleşmelerinin üretimi. | `proposalOnly = true`, `executionAuthorized = false` değişmezleri; izin verilen 7 token tipi; zararlı komut kara listesi. |
| `src/autonomous/visual-remediation-policy.js` | Generic AI sinyallerini ve görsel bulguları önceliklendirilmiş token önerilerine eşleme. | Güvenli token düzeltmesi vs. Yapısal tasarım ayrımı; `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` öncelik hiyerarşisi. |
| `src/autonomous/visual-refactoring-engine.js` | Yetkilendirilmiş atomik patch uygulama, anlık görüntü saklama, hash doğrulaması ve rollback. | `AuthorizationDecision.AUTHORIZED` zorunluluğu; `isPathInsideDirectory` çalışma alanı kilidi; geri alınabilir SHA-256 anlık görüntüleri; denetim defteri (`auditLedger`). |
| `src/autonomous/visual-regression-loop.js` | Değişiklik öncesi/sonrası görsel puanlama, regresyon politikası değerlendirmesi ve otomatik geri alma. | 4 faktörlü regresyon koruması (skor kaybı, responsive kaybı, kontrast kaybı, kritik hata artışı); `KEEP` veya `ROLLBACK` kararı. |

---

### 3. DEĞİŞTİRİLEN DOSYALAR

1. **`src/app/server.js`**:
   - FAZ 72 modülleri ve mağazaları eklendi (`visualProposalStore`, `visualExecutionStore`).
   - 7 adet REST uç noktası entegre edildi (`/api/v1/visual/proposals*`, `/api/v1/visual/audit-ledger`).
   - Yetkisiz `/execute` istekleri `403 Forbidden / UNAUTHORIZED` ile sınırlandırıldı.
2. **`src/autonomous/visual-intelligence.js`**:
   - `VisualErrorCodes` genişletildi (`RefactoringErrorCodes`).
   - Multimodal AI başarı durumu ile sezgisel fallback ayrımı netleştirildi.
3. **`tests/visual-refactoring.test.js`**:
   - FAZ 72 için 20 senaryolu kapsamlı test paketi oluşturuldu.

---

### 4. AUTHORIZATION BOUNDARY (YETKİLENDİRME SINIRI)

- **Mevcut Sistemin Yeniden Kullanımı**: Yeni bir paralel yetkilendirme icat edilmemiş, repo bünyesindeki kurumsal `createExecutionAuthorizationContract` (`src/contracts/execution-authorization.js`) yapısı kullanılmıştır.
- **Kesin Sınır Kuralı**:
  - Proposal motoru kendi kendine `executionAuthorized: true` üretemez (böyle bir deneme `UNAUTHORIZED` hatasıyla engellenir).
  - Yürütme motoru (`executeDesignProposal`), gelen nesnede `authorization.decision === 'AUTHORIZED'` görmediği sürece diske tek bir bayt dahi yazmaz.

---

### 5. PROPOSAL SCHEMA (ÖNERİ ŞEMASI)

```json
{
  "proposalId": "prop-1789223400-abcde",
  "projectId": "onlunet-dashboard",
  "sourceAnalysisId": "vis-1789222916733",
  "category": "colorSystem",
  "issue": "Metin Kontrast İyileştirmesi (WCAG AA)",
  "rationale": "--text-dim (#64748b) koyu kanvas üzerinde 4.2:1 kontrast vermektedir. #94a3b8 ile 7.1:1 kontrast sağlanır.",
  "priority": "HIGH",
  "targetFilePath": "src/app/public/index.html",
  "changes": [
    {
      "type": "color_token_update",
      "target": "--text-dim",
      "before": "#64748b",
      "after": "#94a3b8",
      "reason": "WCAG AA 4.5:1 kontrast standardına uyum.",
      "risk": "low"
    }
  ],
  "expectedImpact": {
    "visualScore": "+3",
    "contrast": "improve",
    "aiTemplateRisk": "-0"
  },
  "createdAt": "2026-09-12T14:28:44.000Z",
  "proposalOnly": true,
  "executionAuthorized": false
}
```

---

### 6. ALLOWED CHANGE TYPES (İZİN VERİLEN DEĞİŞİKLİK TİPLERİ)

Yalnızca sınırlı, atomik ve tasarım sistemi değişkenlerini hedefleyen tipler kabul edilir:
1. `design_token_update`
2. `css_variable_update`
3. `color_token_update`
4. `radius_token_update`
5. `spacing_token_update`
6. `typography_token_update`
7. `shadow_token_update`

---

### 7. FORBIDDEN OPERATIONS (YASAKLANMIŞ İŞLEMLER)

Aşağıdaki işlemler yapısal olarak engellenmiş olup, tespit edildiğinde `FORBIDDEN_OPERATION` fırlatılır:
- `execute_command` (Kabuk / Terminal komutu çalıştırma)
- `shell_execution`
- `arbitrary_file_write` (Rastgele dosya yazma)
- `file_deletion` (Dosya silme)
- `package_install` / `npm_install` (Paket / bağımlılık kurma)
- `arbitrary_html_rewrite` (Komple HTML yapısını baştan yazma)
- `arbitrary_js_rewrite` (JavaScript iş mantığını değiştirme)

---

### 8. ROLLBACK MEKANİZMASI

1. **Ön-Görüntü (Snapshot)**: Her patch uygulanmadan önce dosyanın ham içeriği ve SHA-256 hash'i bellekte `patchSnapshots` haritasına kaydedilir.
2. **Geri Yükleme (`rollbackVisualPatch`)**:
   - Hedef dosya çalışma alanı sınırları içindeyse (`isPathInsideDirectory`) orijinal içerik diske geri yazılır.
   - Geri yazılan içeriğin SHA-256 hash'i pre-patch hash ile karşılaştırılır; eşleşmezse `ROLLBACK_FAILED` fırlatılır.
   - Denetim defterindeki (`auditLedger`) ilgili kayıt `ROLLED_BACK` olarak güncellenir ve `rollbackAvailable = false` yapılır.

---

### 9. VISUAL REGRESSION MEKANİZMASI (GÖRSEL REGRESYON DÖNGÜSÜ)

Uygulanan her değişikliğin ardından sistem kapalı döngüde (`runVisualRegressionCycle`) kalite denetimi yapar:
- **Genel Skor Düşüş Koruması**: Genel skor 1 puandan fazla düşerse (`overallDiff < -1`) reddedilir.
- **Responsive Kalite Koruması**: Mobil veya tablet puanı 5 puandan fazla gerilerse (`responsiveDiff < -5`) reddedilir.
- **Kontrast Koruması**: Renk veya kontrast skoru 5 puandan fazla gerilerse (`colorDiff < -5`) reddedilir.
- **Kritik Hata Artış Koruması**: Yeni bir kritik bulgu oluşursa (`afterCritical > beforeCritical`) reddedilir.
- **Karar Algoritması**:
  - Şartlar sağlanırsa: **`KEEP`** (Değişiklik korunur).
  - Herhangi bir regresyon varsa: **`ROLLBACK`** (Değişiklik anında ve otomatik olarak geri alınır).

---

### 10. HTTP API UÇ NOKTALARI

| Metot | Uç Nokta | Açıklama | Yetki Gereksinimi |
| :--- | :--- | :--- | :---: |
| `POST` | `/api/v1/visual/proposals` | Analiz bulgularından yapılandırılmış token önerileri üretir. | Hayır (Salt Okunur Öneri) |
| `GET` | `/api/v1/visual/proposals` | Üretilmiş önerileri listeler. | Hayır |
| `GET` | `/api/v1/visual/proposals/:id` | Tekil öneri detayını döner. | Hayır |
| `POST` | `/api/v1/visual/proposals/:id/validate` | Öneri şemasını ve hedef dosyadaki bayatlama durumunu denetler. | Hayır |
| `POST` | `/api/v1/visual/proposals/:id/authorize` | İnsan onayıyla öneriye yetkilendirme sözleşmesi bağlar. | Evet (Operatör) |
| `POST` | `/api/v1/visual/proposals/:id/execute` | Yetkili öneriyi görsel regresyon döngüsüyle uygular. | **ZORUNLU (AUTHORIZED)** |
| `GET` | `/api/v1/visual/proposals/:id/result` | Uygulama ve regresyon sonucunu döner. | Hayır |
| `GET` | `/api/v1/visual/audit-ledger` | Değiştirilemez denetim defterini sorgular. | Hayır |

---

### 11. TEST SONUÇLARI

Tüm testler Node.js yerel test koşucusu (`node --test`) ile çalıştırılmış ve **sıfır hata** ile tamamlanmıştır:

```
▶ ONLUNET ZEKA — Autonomous Browser QA Inspector & Self-Healing Engine (FAZ 69)
  ✔ 14 / 14 test PASS (23976 ms)

▶ ONLUNET ZEKA — Visual Capture Engine Test Suite (FAZ 70)
  ✔ 13 / 13 test PASS (24076 ms)

▶ ONLUNET ZEKA — Visual Intelligence & AI Critic Test Suite (FAZ 71)
  ✔ 42 / 42 test PASS (29720 ms)

▶ ONLUNET ZEKA — Controlled Visual Refactoring & Token Sync (FAZ 72)
  ✔ 1. proposal schema validation (valid proposal accepts normalized schema)
  ✔ 2. invalid proposal rejection (rejects missing fields and empty changes)
  ✔ 3. unauthorized execution rejection (rejects missing or denied authorization)
  ✔ 4. arbitrary file modification rejection (rejects non-CSS variable targets)
  ✔ 5. arbitrary shell command rejection (rejects commands and scripts)
  ✔ 6. stale proposal rejection (rejects when before value mismatches target file)
  ✔ 7. token update execution (safely updates token in target file)
  ✔ 8. atomic rollback (restores pre-patch file content and matches hash)
  ✔ 9. visual score comparison (evaluates score differences accurately)
  ✔ 10. regression guard (triggers rollback when overall score drops)
  ✔ 11. responsive regression guard (rejects when responsive score drops >5 points)
  ✔ 12. contrast regression guard (rejects when color/contrast score drops >5 points)
  ✔ 13. successful keep decision (runVisualRegressionCycle retains improved patch)
  ✔ 14. failed visual improvement -> rollback (automatically reverts regressed patch)
  ✔ 15. concurrent proposal isolation (independent patches do not collide)
  ✔ 16. external CWD safety (execution preserves clean working directory)
  ✔ 17. audit record creation (execution and rollback produce immutable ledger records)
  ✔ 18. authorization boundary invariant (cannot forge executionAuthorized = true)
  ✔ 19. proposalOnly invariant (proposals always maintain proposalOnly = true)
  ✔ 20. no auto-fix from Visual Intelligence (analyzeScreenshot never writes to disk)
  ✔ 20 / 20 test PASS (85 ms)

Toplam Doğrulanan Test: 89 / 89 PASS (%100 Başarı)
Süre: ~30 saniye
```

---

### 12. MEVCUT DASHBOARD ÜZERİNDE DRY-RUN VAKA ANALİZİ

ONLUNET ZEKA'nın kendi paneli (`src/app/public/index.html`) üzerinde FAZ 71'de saptanan bulgular esas alınarak kontrollü bir simülasyon çalıştırılmıştır:

```
Hedef Dosya: D:\Antigravity\ONLUNET ZEKA\src\app\public\index.html
Orijinal SHA-256: 2fc49c114b61ec43ccc4723c965e696f303f381054e93aee73aee527f62bfc9c
Çıkarılan Token Sayısı: 47 (36 Renk, 4 Radius, 7 Efekt/Gölge)
```

#### Üretilen Kontrollü Öneriler:
1. **[HIGH] Metin Kontrast İyileştirmesi (`--text-dim`)**:
   - `before`: `#64748b` -> `after`: `#94a3b8`
   - Gerekçe: WCAG AA 4.5:1 kontrast standardına tam uyum (4.2:1 -> 7.1:1).
   - Beklenen Etki: `visualScore: +3`, `contrast: improve`.
2. **[LOW] Rozet Köşe Yuvarlaklığı Disiplini (`--radius-full`)**:
   - `before`: `9999px` -> `after`: `6px`
   - Gerekçe: Modern AI SaaS şablonu algısı yaratan aşırı yuvarlak rozetleri kurumsal sisteme çekmek.
   - Beklenen Etki: `visualScore: +1`, `aiTemplateRisk: -2`.
3. **[MEDIUM] Neon İndigo Parlama Sakinleştirmesi (`--primary-glow`)**:
   - `before`: `rgba(99, 102, 241, 0.28)` -> `after`: `rgba(99, 102, 241, 0.12)`
   - Gerekçe: Göz yoran neon parıltıyı azaltarak kurumsal ciddiyeti güçlendirmek.
   - Beklenen Etki: `visualScore: +2`, `aiTemplateRisk: -5`.

#### Yapısal / Tasarımcı İncelemesine Bırakılan Maddeler (Otomatik Değişiklik Yapılmadı):
- **Header Bilgi Yoğunluğu**: 768px altında butonların ikon-menüye daraltılması (mimari HTML/JS düzenlemesi gerekir).
- **Kart Tekrarı**: Asimetrik metrik kartları ve derinlikli hiyerarşi (yaratıcı içerik tasarımı gerekir).
- **Yıkıcı Aksiyon Hiyerarşisi**: "Durdur" butonuna `ghost-danger` stili verilmesi.

#### Sıfır Dosya Değişikliği Doğrulaması:
- Simülasyon sonrası `src/app/public/index.html` dosyasının SHA-256 hash'i: `2fc49c114b61ec43ccc4723c965e696f303f381054e93aee73aee527f62bfc9c`
- **Dosya kesinlikle değiştirilmemiştir (Zero Production Mutation Garantisi).**

#### Görsel Regresyon Simülasyonu:
- **Before Score**: 84 / 100 (`PROFESSIONAL`)
- **Simulated After Score**: 88 / 100 (`PROFESSIONAL`)
- **Net İyileşme**: +4 puan
- **Regresyon Kararı**: **`KEEP`**

---

### 13. KALAN RİSKLER VE GÜVENLİK SINIRLARI

1. **Karmaşık CSS Yapıları**: CSS değişkeni yerine sabit `px` veya `color` kullanılmış eski bileşenler doğrudan token mekanizmasıyla güncellenemez; önce CSS değişkenine bağlanmalıdır.
2. **Çoklu Dosya Senkronizasyonu**: Bir token birden fazla stylesheet dosyasında yineleniyorsa, patch tüm bu dosyaları atomik olarak kapsamalıdır.
3. **Kullanıcı Onay Darboğazı**: `executionAuthorized: false` kuralı gereği, hiçbir görsel iyileştirme operatör onayı olmadan canlıya geçemez; bu bir güvenlik avantajı olmakla birlikte insan döngüsü gerektirir.

---

### 14. NİHAİ MİMARİ HÜKÜM VE SONRAKİ FAZ GEÇİŞİ

- **Hüküm**: **FAZ 72 — CONTROLLED VISUAL REFACTORING & DESIGN SYSTEM TOKEN SYNC EKSİKSİZ VE KUSURSUZ TAMAMLANMIŞTIR.**
- **Mevcut Durum**:
  - Görsel denetimler güvenli, atomik ve ölçülebilir token önerilerine dönüştürülebilmektedir.
  - Otorite ayrımı korunmuş (`proposalOnly = true`, yetkisiz çalıştırma imkansız), sistemin kendi kendine kontrolsüz kod yazması engellenmiştir.
  - Kötü sonuçlanan veya regresyona yol açan her müdahale otomatik geri alınmaktadır.
  - Canlı dashboard ve altın şablon dokunulmazlığı korunmuştur.

**Sonraki Faz Önerisi**:
Sistem artık güvenli bir şekilde tasarım token'larını test edip iyileştirebildiğine göre, web sitesi üretim motorunda üretilen kurumsal sitelerin tasarım sistemi tutarlılığını fabrika çıkışında denetleyen ve sertifikalandıran **FAZ 73 — Design System Compliance & Quality Certification Engine** aşamasına geçilebilir.
