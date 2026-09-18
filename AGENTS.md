# ONLUNET ZEKA — Kurumsal Proje Üretim & Sistem Kuralları (Corporate Rules)

Bu kurallar, ONLUNET ZEKA bünyesinde oluşturulan tüm kurumsal web projelerinde ve ajan etkileşimlerinde **istisnasız ve kalıcı olarak geçerlidir**.

---

## 🔒 1. Altın Şablon İmmutability & Proje İzolasyonu
- **`D:\Antigravity\onlunet-kurumsal` (Golden Master)**: Kesinlikle salt-okunurdur (READ-ONLY). Hiçbir dosya değiştirilemez, silinemez veya üzerine yazılamaz.
- **Bağımsız Proje Mimarisi**: Üretilen her firma sitesi `projeler/<slug>` altına tam teşekküllü bağımsız bir kopya olarak açılır. Kendi `storage/database.sqlite` veritabanına, kendi `scripts/server.js` sunucusuna ve kendi `scripts/tailored-frontend.js` modülüne sahiptir.
- **Port İzolasyonu**:
  - `onlunet-kurumsal` (Ana kalıp): Port `8000`
  - `ONLUNET ZEKA` (Dashboard & Orkestratör): Port `4200`
  - Yeni oluşturulan projeler: Standart Port `8080` (veya dinamik boş port). Projelerin portları birbirine karışamaz.

---

## 🧹 2. Şablon Artıklarını Temizleme (Template Dummy Purge)
- Yeni proje üretilirken `onlunet-kurumsal`dan gelen sahte müşteri adayları (`leads`), test logları, B2B radar kayıtları ve kıyaslama kullanıcıları veritabanından (`DELETE FROM`) otomatik temizlenir.
- Firma adı, iletişim bilgileri, tema renkleri ve ilk yönetici kullanıcısı şirkete özel olarak SQLite veritabanına otomatik seed edilir.

---

## 🛡️ 3. Opak & Yapışkan Header Garantisi (Solid Opaque Sticky Header)
- Tüm kurumsal sitelerde sayfa aşağı kaydırıldığında içeriklerin menü yazılarıyla iç içe girmesi kesinlikle yasaktır.
- Header her zaman:
  - `position: sticky !important; top: 0 !important; z-index: 9999 !important;`
  - `background: #ffffff !important;` (Koyu modda `#0f172a !important;`)
  - `border-bottom: 1px solid #e2e8f0 !important;`
  - `backdrop-filter: blur(16px) !important;`
  özelliklerine sahip olmalıdır.

---

## 🌐 4. Sıfır SEO Kaybı: Tam Bağımsız Sayfa & Kategori Üretimi
- Referans bir web sitesi URL'si (`https://firma.com/`) verildiğinde:
  - Sitedeki tüm menü, hizmet ve ürün kategorileri taranır.
  - Sadece ana sayfa değil, bulunan her hizmet ve ürün bağımsız bir URL (`/tr/hizmetlerimiz/<slug>/`, `/tr/<slug>/` veya `/tr/urunler/<slug>/`) ile çalışan **ayrı bir standalone sayfa** olarak üretilir.
  - Orijinal sitedeki eski linklerin bozulmaması için çoklu dil önekleri ve alias URL eşleştirmeleri tanımlanır (200 OK).
  - `scripts/server.js` içerisindeki `tailoredFrontend.getPage(subPath, lang)` kancası ile tüm alt sayfalar 404'e düşmeden doğrudan karşılanır.

---

## ✍️ 5. Sıfır Boş İçerik Garantisi (Zero Thin-Content Guarantee)
- Menüde başlığı olup içeriği boş, zayıf veya tek cümlelik olan tüm sayfalar yapay zeka tarafından sektöre ve başlığa özel olarak doldurulur:
  - **Yönetici Özeti (Summary)**: 2-3 cümlelik kurumsal özet.
  - **Derin Teknik Gövde (Body)**: 3 paragraflık mühendislik & uzmanlık makalesi.
  - **Teknik Tablo (Specs)**: 5 maddelik kapasite, tolerans, standart tablosu.
  - **Kurumsal Avantajlar (Features)**: 4 adet ikonlu değer kartı.
  - **4 Adımlı Uygulama Süreci (Workflow)**: Keşiften teslime operasyonel yol haritası.
  - **Sıkça Sorulan Sorular (FAQs)**: İlgili hizmete/ürüne özel 3-4 akordeon SSS.
  - **Hızlı Teklif Formu**: Sağ kolonda sticky lead formu (`/api/v1/leads` CRM API entegreli).
  - **SEO Başlığı & Meta Açıklaması**.
- Bu içerikler SQLite `cms_contents` ve `cms_translations` tablolarına da kalıcı olarak işlenir.

---

## 📂 6. Açılır Menü (Dropdown) & Tek Satır Garantisi
- Header navigasyonunda çoklu alt kategoriye sahip Hizmetler ve Ürünler asla düz metin veya kontrolsüz liste olarak dökülemez.
- `.dropdown-menu`:
  - Varsayılan olarak `display: none !important; position: absolute !important;` olmalıdır.
  - Yalnızca fare üzerine geldiğinde (`:hover`), odaklanıldığında (`:focus-within`) veya mobilde dokunulduğunda (`.is-open`) açılmalıdır.
  - Geniş listeler için `max-height: 440px; overflow-y: auto;` ile pencere taşması engellenmelidir.
  - Fare menüye geçerken kapanmaması için görünmez hover köprüsü (`::after`) yer almalıdır.
- **Yazı Kırılmasını Önleme (No-Wrap)**:
  - `.nav-links > li > a` elemanlarında `white-space: nowrap !important;` zorunludur; "Ana Sayfa", "Kurumsal" gibi bağlantılar asla iki satıra bölünemez.
- **Dokunmatik Uyum**:
  - Dokunmatik ekranlarda tıklandığında açılmalı, dışarı tıklandığında otomatik kapanmalıdır.

---

## 🛡️ 7. Reklam & Analitik CSP Uyumluluk Garantisi (Content Security Policy)
- Google Ads, Google Analytics (GA4), GTM (Google Tag Manager), DoubleClick ve Meta Pixel (Facebook) izleme kodlarının tarayıcı konsolunda CSP engeline takılması kesinlikle yasaktır.
- `scripts/server.js` içerisindeki `getSecurityHeaders()` fonksiyonu aşağıdaki direktifleri eksiksiz ve açık (explicit) olarak içermelidir:
  - `script-src` ve `script-src-elem`: `'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://tagmanager.google.com https://www.google-analytics.com https://ssl.google-analytics.com https://googleads.g.doubleclick.net https://*.doubleclick.net https://www.googleadservices.com https://*.googleadservices.com https://www.google.com https://*.google.com https://connect.facebook.net https://*.facebook.net https://cdnjs.cloudflare.com data: blob:`
  - `connect-src`: `'self' https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://www.google.com https://*.google.com https://googleads.g.doubleclick.net https://*.doubleclick.net https://www.googleadservices.com https://*.googleadservices.com https://www.facebook.com https://*.facebook.com https://connect.facebook.net https://*.facebook.net https://wa.me https://api.whatsapp.com data: blob:`
  - `img-src`: `'self' data: blob: https: http:` (Harici CDN görselleri, dinamik logolar, 1x1 piksel izleme GIF'leri)
  - `style-src`: `'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://tagmanager.google.com`
  - `font-src`: `'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com`
  - `frame-src`: `'self' https://www.googletagmanager.com https://www.google.com https://*.google.com https://maps.google.com https://www.youtube.com https://player.vimeo.com`

---

## 🤖 8. Otonom Tarayıcı Konsol Denetimi & Kendi Kendini Onarma Garantisi (Self-Healing Browser QA Loop)
- Üretilen veya başlatılan her kurumsal sitede arka planda çalışan otonom tarayıcı denetleyicisi (`src/autonomous/browser-qa-inspector.js`):
  - Sistemdeki Google Chrome veya Microsoft Edge tarayıcısını **Chrome DevTools Protocol (CDP)** ile headless bağlar.
  - Sitenin tüm ana ve alt sayfalarını (`/tr/`, `/tr/hizmetlerimiz/*`, `/tr/*`, `/tr/iletisim/`, `/admin/login`) gerçek kullanıcı gibi tarar.
  - Tarayıcı konsolunda oluşan JavaScript hatalarını (`Runtime.exceptionThrown`, `console.error`), 404 eksik kaynakları (`Network.responseReceived`) ve CSP ihlallerini yakalar.
- **Kendi Kendini Onarma (Self-Healing)**:
  - Eksik kaynaklar (404 favicon, görsel, CSS) için anında fallback üretir veya veritabanını düzeltir.
  - CSP ihlallerinde engellenen domaini güvenlik başlıklarına otomatik ekler.
  - Sayfaları tekrar tarayarak konsolu 0 hataya ulaştırır.
- **Sonsuz Döngü Koruması (Circuit Breaker)**:
  - Maksimum 3 iterasyon sınırı (`maxIterations: 3`) zorunludur. Çözülemeyen hata kaldığında sonsuz döngüye girmeden durur ve net rapor sunar.
- **Bitti Bildirimi & Canlı Açma**:
  - Konsol tamamen temizlendiğinde (0 hata) kullanıcıya **"Bitti"** haberi verilir ve site kullanıcının varsayılan masaüstü tarayıcısında otomatik açılır.

---

## 🎯 9. Sektörel Derinlik & Eksik Veri Doğrulama Protokolü (Pre-Design Sector Intelligence & Gap Verification)
- Bundan sonra üretilen **tüm kurumsal site tasarımlarında** bu sorgu ve doğrulama sistemi zorunlu ve kalıcıdır.
- **Süreç Adımları:**
  1. **Derin Faaliyet & Arketip Tespiti**: Verilen URL veya Google Haritalar verisinden firmanın gerçek faaliyet konusu (örn. kedi/köpek maması, medikal, güneş enerjisi, oto servis vb.) ayrıştırılır. Asla ezbere genel danışmanlık şablonu atanmaz; sektöre özel arketip devreye alınır.
  2. **Boşluk & Eksik Veri Analizi**: Sektörün olmazsa olmaz parametreleri (öne çıkan markalar, adrese teslimat/kurye, doğrudan WhatsApp sipariş/randevu hattı, ek hizmetler, fiyat politikası) taranır.
  3. **Şablon Çıkarma & Kullanıcıya Doğrulama/Soru Kapısı**: Tasarıma ve kod yazımına başlamadan önce çıkarılan şablon/sayfa ağacı kullanıcıya sunulur. Eksik veriler için net uyarı verilerek sorular yöneltilir.
  4. **Kullanıcı Onayından Sonra İnşa**: Yalnızca kullanıcı eksik verileri tamamladığında veya şablonu onayladığında site tasarlanmaya, kodlanmaya ve SQLite veritabanına işlenmeye başlanır.

---

## 🗄️ 10. Database-First Admin Senkronizasyonu & Eksiksiz Veritabanı Doldurma Garantisi (Database-First CMS & Real-Time Reactivity)
- Üretilen tüm projelerde frontend ve admin paneli asla birbirinden bağımsız veya statik/kopuk çalışamaz.
- **Tek Gerçek Kaynak (Single Source of Truth - SQLite)**:
  - Taranan ve üretilen tüm hizmetler (`cms_contents` + `cms_translations` type='service'), ürünler (type='product'), kurumsal sayfalar (type='page'), blog rehberleri (type='blog'), referanslar (`case_studies`), müşteri yorumları (`testimonials`) ve şirket iletişim/tema bilgileri (`site_settings`) SQLite veritabanına eksiksiz seed edilir.
  - Sunucu yönlendirmesinde (`scripts/server.js`) tüm alt sayfalar, hizmetler, ürünler, bloglar ve iletişim alanları önce SQLite veritabanından sorgulanır (Database-First).
- **Çift Yönlü Canlı Reaktivite**:
  - Admin panelinde (`/admin/cms`, `/admin/case-studies`, `/admin/testimonials`, `/admin/agency`, `/admin/appearance`, `/admin/menus` vb.) yapılan herhangi bir başlık, metin, görsel, tema rengi veya ayar değişikliği canlı sitede **anında ve sunucu yeniden başlatılmadan** güncellenir.
  - Sabit kodlanmış renkler (`#2563eb`, `#1e40af` vb.) yerine `site_settings` tablosundaki `theme.primary_color`, `theme.primary_hover` ve `theme.accent_color` değişkenleri dinamik işlenir.



