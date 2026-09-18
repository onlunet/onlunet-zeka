/**
 * ONLUNET ZEKA - Sector-Specific Interactive ROI & Cost Calculator Engine
 * Generates sector-tailored interactive calculators with instant WhatsApp and CRM lead conversion.
 */

export function getSectorCalculatorHtmlAndScript({
  archetype = 'generic',
  companyName = 'Kurumsal Firma',
  phone = '',
  palette = { primary: '#2563eb', gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }
} = {}) {
  const cleanPhone = String(phone || '').replace(/\D/g, '') || '905550000000';
  const archId = (archetype && (archetype.id || archetype)).toLowerCase();

  let calcTitle = 'İnteraktif Maliyet & Bütçe Hesaplayıcı';
  let calcSubtitle = 'İhtiyacınıza en uygun paket ve bütçe planlamasını saniyeler içinde hesaplayın.';
  let calcType = 'corporate';

  if (archId.includes('pet') || archId.includes('hayvan')) {
    calcTitle = '🐾 Evcil Dostunuz İçin Aylık Beslenme & Gider Hesaplayıcı';
    calcSubtitle = 'Dostunuzun türü, kilosu ve tercihine göre aylık tahmini mama ve kum ihtiyacını hesaplayın.';
    calcType = 'petshop';
  } else if (archId.includes('solar') || archId.includes('enerji') || archId.includes('ges')) {
    calcTitle = '⚡ Güneş Enerjisi (GES) Tasarruf & Amortisman Hesaplayıcı';
    calcSubtitle = 'Aylık elektrik faturanıza ve çatı alanınıza göre yıllık kazancınızı ve amortisman sürenizi görün.';
    calcType = 'solar';
  } else if (archId.includes('lojistik') || archId.includes('nakliyat') || archId.includes('tasima')) {
    calcTitle = '🚚 Mesafe & Hacim Bazlı Nakliye Maliyet Hesaplayıcı';
    calcSubtitle = 'Taşınacak mesafe, oda/palet sayısı ve kat durumuna göre anlık tahmini taşıma ücreti alın.';
    calcType = 'logistics';
  } else if (archId.includes('oto') || archId.includes('servis') || archId.includes('bakim')) {
    calcTitle = '🚗 Periyodik Araç Bakım & Servis Maliyet Hesaplayıcı';
    calcSubtitle = 'Araç segmenti, motor hacmi ve bakım paketine göre ortalama servis maliyetini hesaplayın.';
    calcType = 'auto';
  }

  return `
<!-- Interactive ROI / Cost Calculator Section -->
<section id="maliyet-hesapla" class="sector-calculator-section" style="padding: 70px 20px; background: #f8fafc; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0;">
  <div style="max-width: 960px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 40px;">
      <span style="color: ${palette.primary}; font-weight: 700; text-transform: uppercase; font-size: 0.85rem; letter-spacing: 1px;">İnteraktif Hesaplama</span>
      <h2 style="font-size: 2.2rem; color: #0f172a !important; font-weight: 800; margin-top: 8px;">${calcTitle}</h2>
      <p style="color: #64748b; font-size: 1rem; max-width: 650px; margin: 10px auto 0;">
        ${calcSubtitle}
      </p>
    </div>

    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); padding: 36px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 36px; align-items: center;">
      
      <!-- Input Controls Column -->
      <div id="calc-inputs-container">
        ${renderInputsForType(calcType, palette)}
      </div>

      <!-- Live Result Card Column -->
      <div style="background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%); border-radius: 16px; padding: 30px; color: #ffffff; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.15); display: flex; flex-direction: column; justify-content: space-between; min-height: 280px;">
        <div>
          <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700;">Tahmini Hesaplama Sonucu</span>
          <div id="calc-result-main" style="font-size: 2.8rem; font-weight: 900; color: #38bdf8; margin: 14px 0 6px; font-family: monospace;">--- ₺</div>
          <div id="calc-result-sub" style="font-size: 0.88rem; color: #cbd5e1; line-height: 1.5;">Değerleri seçtiğinizde anlık güncellenir.</div>
        </div>

        <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 10px;">
          <button onclick="submitCalculatorToWhatsApp()" style="background: #25D366; color: #ffffff; border: none; border-radius: 10px; padding: 12px; font-weight: 800; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(37,211,102,0.35);">
            <span>💬</span> Bu Teklifi WhatsApp'a Gönder
          </button>
          <a href="#hizli-teklif" style="background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.2); border-radius: 10px; padding: 10px; font-weight: 600; font-size: 0.85rem; text-decoration: none; display: inline-block;">
            📋 Resmi Teklif Formuna Aktar
          </a>
        </div>
      </div>

    </div>
  </div>
</section>

<script>
(function() {
  var calcType = '${calcType}';
  var companyName = ${JSON.stringify(companyName)};
  var waPhone = '${cleanPhone}';

  function calculate() {
    var mainEl = document.getElementById('calc-result-main');
    var subEl = document.getElementById('calc-result-sub');
    if (!mainEl) return;

    if (calcType === 'petshop') {
      var petType = document.getElementById('calc-pet-type') ? document.getElementById('calc-pet-type').value : 'cat';
      var weight = parseFloat(document.getElementById('calc-pet-weight') ? document.getElementById('calc-pet-weight').value : 5);
      var segment = document.getElementById('calc-food-segment') ? document.getElementById('calc-food-segment').value : 'super_premium';
      
      var baseKg = petType === 'cat' ? (weight * 0.4) : (weight * 0.8);
      var pricePerKg = segment === 'super_premium' ? 280 : (segment === 'premium' ? 180 : 120);
      var monthlyFood = Math.round(baseKg * pricePerKg);
      var monthlyLitter = petType === 'cat' ? 220 : 0;
      var total = monthlyFood + monthlyLitter;

      mainEl.textContent = total.toLocaleString('tr-TR') + ' ₺ / ay';
      subEl.innerHTML = '🐾 <strong>' + Math.round(baseKg) + ' kg</strong> mama' + (petType === 'cat' ? ' + 10L bentonit kum' : '') + ' dahil tahmini aylık tüketim.';
      window.lastCalculatedOffer = 'Aylık ' + Math.round(baseKg) + ' kg ' + segment + ' mama ve bakım paketi (' + total.toLocaleString('tr-TR') + ' TL/ay)';
    } else if (calcType === 'solar') {
      var bill = parseFloat(document.getElementById('calc-solar-bill') ? document.getElementById('calc-solar-bill').value : 3000);
      var roofM2 = parseFloat(document.getElementById('calc-solar-roof') ? document.getElementById('calc-solar-roof').value : 100);
      
      var annualSaving = Math.round(bill * 12 * 0.85);
      var paybackYears = (Math.round((roofM2 * 2500 / annualSaving) * 10) / 10).toFixed(1);

      mainEl.textContent = annualSaving.toLocaleString('tr-TR') + ' ₺ / yıl';
      subEl.innerHTML = '⚡ Yıllık net elektrik tasarrufu. Tahmini amortisman süresi: <strong>' + paybackYears + ' Yıl</strong>.';
      window.lastCalculatedOffer = 'Yıllık ' + annualSaving.toLocaleString('tr-TR') + ' TL tasarruflu GES Çatı Sistemi (Amortisman: ' + paybackYears + ' yıl)';
    } else if (calcType === 'logistics') {
      var km = parseFloat(document.getElementById('calc-log-km') ? document.getElementById('calc-log-km').value : 150);
      var rooms = document.getElementById('calc-log-rooms') ? document.getElementById('calc-log-rooms').value : '2_1';
      var floor = parseInt(document.getElementById('calc-log-floor') ? document.getElementById('calc-log-floor').value : 2);

      var baseFee = rooms === '1_1' ? 6000 : (rooms === '2_1' ? 9500 : (rooms === '3_1' ? 13500 : 18000));
      var kmFee = km * 28;
      var floorFee = floor * 400;
      var total = Math.round(baseFee + kmFee + floorFee);

      mainEl.textContent = total.toLocaleString('tr-TR') + ' ₺';
      subEl.innerHTML = '🚚 ' + km + ' km mesafe, asansörlü taşıma ve sigorta dahil tahmini nakliye ücreti.';
      window.lastCalculatedOffer = rooms + ' Ev/Ofis Taşıma (' + km + ' km, ' + floor + '. Kat): ' + total.toLocaleString('tr-TR') + ' TL';
    } else if (calcType === 'auto') {
      var segment = document.getElementById('calc-auto-seg') ? document.getElementById('calc-auto-seg').value : 'c_sedan';
      var pkg = document.getElementById('calc-auto-pkg') ? document.getElementById('calc-auto-pkg').value : 'periyodik';

      var baseCost = segment === 'b_hatchback' ? 2200 : (segment === 'c_sedan' ? 2900 : (segment === 'suv' ? 3800 : 4900));
      if (pkg === 'agir') baseCost = baseCost * 2.4;
      if (pkg === 'fren_disk') baseCost = baseCost + 2200;

      mainEl.textContent = Math.round(baseCost).toLocaleString('tr-TR') + ' ₺';
      subEl.innerHTML = '🚗 Orijinal parça & motor yağı dahil garantili servis paketi.';
      window.lastCalculatedOffer = segment + ' için ' + pkg + ' servis bakımı: ' + Math.round(baseCost).toLocaleString('tr-TR') + ' TL';
    } else {
      var scope = document.getElementById('calc-corp-scope') ? document.getElementById('calc-corp-scope').value : 'standart';
      var support = document.getElementById('calc-corp-sup') ? document.getElementById('calc-corp-sup').value : '12';
      var total = (scope === 'basic' ? 12000 : (scope === 'standart' ? 24000 : 45000)) + (parseInt(support) * 750);

      mainEl.textContent = total.toLocaleString('tr-TR') + ' ₺';
      subEl.innerHTML = '🏢 Kurumsal çözüm ve ' + support + ' ay SLA teknik destek dahil paket.';
      window.lastCalculatedOffer = scope + ' Kurumsal Paket (' + support + ' ay destek): ' + total.toLocaleString('tr-TR') + ' TL';
    }
  }

  window.submitCalculatorToWhatsApp = function() {
    var offer = window.lastCalculatedOffer || 'İnteraktif hesaplama teklif talebi';
    var msg = '*İNTERAKTİF HESAPLAMA TEKLİF TALEBİ* — ' + companyName + '\\n';
    msg += '--------------------------------\\n';
    msg += '📊 *Hesaplanan Detay:* ' + offer + '\\n';
    msg += 'Lütfen en uygun güncel fiyat ve detayları iletiniz.';
    var url = 'https://wa.me/' + waPhone + '?text=' + encodeURIComponent(msg);
    window.open(url, '_blank');
  };

  document.addEventListener('DOMContentLoaded', function() {
    var inputs = document.querySelectorAll('#calc-inputs-container input, #calc-inputs-container select');
    inputs.forEach(function(inp) {
      inp.addEventListener('input', calculate);
      inp.addEventListener('change', calculate);
    });
    calculate();
  });
})();
</script>
`;
}

function renderInputsForType(type, palette) {
  if (type === 'petshop') {
    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">Evcil Dostunuzun Türü:</label>
          <select id="calc-pet-type" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; background: #f8fafc; color: #0f172a;">
            <option value="cat">🐱 Kedi (Yetişkin / Kısır / Yavru)</option>
            <option value="dog_small">🐶 Küçük Irk Köpek (0-10 kg)</option>
            <option value="dog_large">🐕 Orta & Büyük Irk Köpek (10-35 kg)</option>
          </select>
        </div>
        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">Dostunuzun Kilosu (kg):</label>
          <input type="number" id="calc-pet-weight" value="4.5" min="1" max="60" step="0.5" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; background: #f8fafc; color: #0f172a;">
        </div>
        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">Mama Segmenti / Kalite Tercihi:</label>
          <select id="calc-food-segment" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; background: #f8fafc; color: #0f172a;">
            <option value="super_premium">⭐ Süper Premium (Royal Canin, Pro Plan, N&D)</option>
            <option value="premium">🌿 Premium Standart</option>
            <option value="economic">🏷️ Ekonomik Paket</option>
          </select>
        </div>
      </div>
    `;
  }

  if (type === 'solar') {
    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">Aylık Ortalama Elektrik Faturanız (₺):</label>
          <input type="number" id="calc-solar-bill" value="3500" min="500" max="250000" step="250" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; background: #f8fafc; color: #0f172a;">
        </div>
        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">Kullanılabilir Çatı / Saha Alanı (m²):</label>
          <input type="number" id="calc-solar-roof" value="120" min="20" max="5000" step="10" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; background: #f8fafc; color: #0f172a;">
        </div>
        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">Tesis Türü:</label>
          <select id="calc-solar-type" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; background: #f8fafc; color: #0f172a;">
            <option value="mesken">🏠 Müstakil Ev / Villa Çatı GES</option>
            <option value="ticari">🏭 Ticarethane & Fabrika Çatı GES</option>
            <option value="tarimsal">🌾 Tarımsal Sulama & Arazi</option>
          </select>
        </div>
      </div>
    `;
  }

  if (type === 'logistics') {
    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">Taşıma Mesafesi (km):</label>
          <input type="number" id="calc-log-km" value="120" min="5" max="2500" step="10" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; background: #f8fafc; color: #0f172a;">
        </div>
        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">Eşya / Hacim Kapsamı:</label>
          <select id="calc-log-rooms" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; background: #f8fafc; color: #0f172a;">
            <option value="1_1">📦 1+1 Daire / Küçük Ofis</option>
            <option value="2_1" selected>📦 2+1 Standart Daire</option>
            <option value="3_1">📦 3+1 Geniş Aile Dairesi</option>
            <option value="villa">🏢 Villa / Fabrika / Ağır Yük</option>
          </select>
        </div>
        <div>
          <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">Bina Kat Sayısı & Asansör Durumu:</label>
          <input type="number" id="calc-log-floor" value="3" min="0" max="25" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; background: #f8fafc; color: #0f172a;">
        </div>
      </div>
    `;
  }

  // Generic / Corporate
  return `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      <div>
        <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">Hizmet & Proje Kapsamı:</label>
        <select id="calc-corp-scope" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; background: #f8fafc; color: #0f172a;">
          <option value="basic">🚀 Başlangıç / Temel Paket</option>
          <option value="standart" selected>⚡ Standart Kurumsal Paket</option>
          <option value="enterprise">🏢 Enterprise / Özel Entegrasyon</option>
        </select>
      </div>
      <div>
        <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 6px;">Teknik Destek & Bakım Süresi (Ay):</label>
        <select id="calc-corp-sup" style="width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.92rem; background: #f8fafc; color: #0f172a;">
          <option value="6">6 Ay SLA Garantisi</option>
          <option value="12" selected>12 Ay Tam Kapsamlı Destek</option>
          <option value="24">24 Ay Öncelikli Kurumsal Destek</option>
        </select>
      </div>
    </div>
  `;
}
