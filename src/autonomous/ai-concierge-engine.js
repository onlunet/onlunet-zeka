/**
 * ONLUNET ZEKA - AI Site Concierge Engine (24/7 Corporate Knowledge Assistant)
 * Generates an interactive on-page AI chat assistant with domain knowledge, FAQ answers and CRM lead capture.
 */

export function getAiConciergeHtmlAndScript({
  companyName = 'Kurumsal Firma',
  industry = '',
  slogan = '',
  phone = '',
  email = '',
  address = '',
  city = '',
  workingHours = '09:00 - 18:00',
  services = [],
  products = [],
  faqs = [],
  primaryColor = '#2563eb'
} = {}) {
  const cleanPhone = String(phone || '').replace(/\D/g, '') || '905550000000';
  const serviceList = services.map(s => s.title || s).slice(0, 8);
  const productList = products.map(p => p.title || p).slice(0, 8);

  const knowledgeBase = {
    companyName,
    industry,
    slogan,
    phone,
    email,
    address,
    city,
    workingHours,
    services: serviceList,
    products: productList,
    faqs
  };

  return `
<!-- AI Site Concierge Widget -->
<div id="ai-concierge-widget" style="position: fixed; bottom: 90px; right: 24px; z-index: 99990; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <!-- Concierge Open Button -->
  <button id="ai-concierge-toggle" onclick="toggleAiConcierge()" style="background: ${primaryColor}; color: #ffffff; border: none; border-radius: 9999px; padding: 12px 20px; font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; box-shadow: 0 6px 20px rgba(0,0,0,0.25); cursor: pointer; transition: transform 0.2s;">
    <span style="font-size: 1.2rem;">🤖</span>
    <span>Canlı Asistan</span>
  </button>

  <!-- Concierge Chat Window -->
  <div id="ai-concierge-box" style="display: none; width: 360px; max-width: calc(100vw - 32px); height: 480px; max-height: calc(100vh - 120px); background: #ffffff; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.22); border: 1px solid #e2e8f0; overflow: hidden; flex-direction: column; margin-bottom: 12px;">
    
    <!-- Header -->
    <div style="background: ${primaryColor}; color: #ffffff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 1.4rem;">🤖</span>
        <div>
          <strong style="font-size: 0.95rem; display: block;">${companyName} Asistanı</strong>
          <span style="font-size: 0.75rem; opacity: 0.85;">⚡ 7/24 Canlı Bilgi & Destek</span>
        </div>
      </div>
      <button onclick="toggleAiConcierge()" style="background: none; border: none; color: #ffffff; font-size: 1.4rem; cursor: pointer;">&times;</button>
    </div>

    <!-- Messages Log -->
    <div id="ai-concierge-messages" style="flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; background: #f8fafc; font-size: 0.88rem;">
      <div style="align-self: flex-start; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; border-bottom-left-radius: 2px; padding: 10px 14px; max-width: 85%; color: #1e293b; line-height: 1.5;">
        Merhaba! <strong>${companyName}</strong> akıllı asistanıyım. Size çalışma saatlerimiz, ${industry ? industry + ' ' : ''}hizmetlerimiz ve siparişleriniz konusunda nasıl yardımcı olabilirim?
      </div>
    </div>

    <!-- Quick Chips -->
    <div style="padding: 6px 12px; background: #ffffff; border-top: 1px solid #f1f5f9; display: flex; gap: 6px; overflow-x: auto; white-space: nowrap;">
      <button onclick="sendAiQuick('Çalışma saatleriniz nedir?')" style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 9999px; padding: 4px 10px; font-size: 0.75rem; color: #475569; cursor: pointer;">⏰ Saatler</button>
      <button onclick="sendAiQuick('Hangi hizmetleri sunuyorsunuz?')" style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 9999px; padding: 4px 10px; font-size: 0.75rem; color: #475569; cursor: pointer;">⚡ Hizmetler</button>
      <button onclick="sendAiQuick('Adresiniz nerede?')" style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 9999px; padding: 4px 10px; font-size: 0.75rem; color: #475569; cursor: pointer;">📍 Adres</button>
      <button onclick="sendAiQuick('WhatsApp ile görüşmek istiyorum')" style="background: #dcfce7; border: 1px solid #86efac; border-radius: 9999px; padding: 4px 10px; font-size: 0.75rem; color: #166534; cursor: pointer;">💬 WhatsApp</button>
    </div>

    <!-- Input Form -->
    <form onsubmit="handleAiConciergeSubmit(event)" style="padding: 10px 12px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px;">
      <input type="text" id="ai-concierge-input" placeholder="Bir soru sorun..." style="flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 12px; font-size: 0.88rem; outline: none;">
      <button type="submit" style="background: ${primaryColor}; color: #ffffff; border: none; border-radius: 8px; padding: 8px 14px; font-weight: 700; cursor: pointer;">Gönder</button>
    </form>

  </div>
</div>

<script>
(function() {
  var kb = ${JSON.stringify(knowledgeBase)};
  var waPhone = '${cleanPhone}';

  window.toggleAiConcierge = function() {
    var box = document.getElementById('ai-concierge-box');
    if (!box) return;
    var isOpen = box.style.display === 'flex';
    box.style.display = isOpen ? 'none' : 'flex';
    if (!isOpen) {
      document.getElementById('ai-concierge-input').focus();
    }
  };

  window.sendAiQuick = function(txt) {
    var input = document.getElementById('ai-concierge-input');
    if (input) {
      input.value = txt;
      handleAiConciergeSubmit(new Event('submit'));
    }
  };

  window.handleAiConciergeSubmit = function(e) {
    if (e && e.preventDefault) e.preventDefault();
    var input = document.getElementById('ai-concierge-input');
    var msg = (input ? input.value : '').trim();
    if (!msg) return;
    input.value = '';

    appendMsg(msg, 'user');
    
    setTimeout(function() {
      var reply = generateAiResponse(msg, kb);
      appendMsg(reply, 'ai');
    }, 400);
  };

  function appendMsg(text, sender) {
    var log = document.getElementById('ai-concierge-messages');
    if (!log) return;
    var div = document.createElement('div');
    if (sender === 'user') {
      div.style.cssText = 'align-self: flex-end; background: ' + ${JSON.stringify(primaryColor)} + '; color: #ffffff; border-radius: 12px; border-bottom-right-radius: 2px; padding: 10px 14px; max-width: 85%; line-height: 1.5;';
      div.textContent = text;
    } else {
      div.style.cssText = 'align-self: flex-start; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; border-bottom-left-radius: 2px; padding: 10px 14px; max-width: 85%; color: #1e293b; line-height: 1.5;';
      div.innerHTML = text;
    }
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function generateAiResponse(q, data) {
    var lower = q.toLowerCase();
    
    if (lower.includes('saat') || lower.includes('açık') || lower.includes('kapalı') || lower.includes('zaman')) {
      return '⏰ <strong>Çalışma Saatlerimiz:</strong> ' + (data.workingHours || 'Hafta içi 09:00 - 18:00') + '. Müsaitlik durumunda acil talepleriniz için WhatsApp üzerinden de 7/24 yazabilirsiniz.';
    }

    if (lower.includes('nerede') || lower.includes('adres') || lower.includes('konum') || lower.includes('harita')) {
      return '📍 <strong>Adresimiz:</strong> ' + (data.address || data.city || 'Merkez') + '<br><a href="#harita" style="color: ' + ${JSON.stringify(primaryColor)} + '; font-weight: 700; text-decoration: underline;">Haritada Gör &rarr;</a>';
    }

    if (lower.includes('telefon') || lower.includes('numara') || lower.includes('iletişim') || lower.includes('ulaş')) {
      return '📞 <strong>İletişim Hattımız:</strong> <a href="tel:' + data.phone + '" style="font-weight: 700; color: ' + ${JSON.stringify(primaryColor)} + ';">' + data.phone + '</a><br>E-Posta: ' + data.email;
    }

    if (lower.includes('whatsapp') || lower.includes('wp') || lower.includes('yazış') || lower.includes('sipariş')) {
      var waUrl = 'https://wa.me/' + waPhone + '?text=' + encodeURIComponent('Merhaba, ' + data.companyName + ' web sitenizdeki akıllı asistandan ulaşıyorum.');
      return '💬 <a href="' + waUrl + '" target="_blank" style="display: inline-block; background: #25D366; color: #fff; padding: 6px 14px; border-radius: 6px; text-decoration: none; font-weight: 700; margin-top: 4px;">WhatsApp Canlı Destek Başlat &rarr;</a>';
    }

    if (lower.includes('hizmet') || lower.includes('neler') || lower.includes('ürün') || lower.includes('faaliyet')) {
      var items = (data.services || []).concat(data.products || []);
      if (items.length > 0) {
        return '⚡ <strong>Öne Çıkan Faaliyetlerimiz:</strong><br>• ' + items.slice(0, 5).join('<br>• ') + '<br><a href="/tr/hizmetler/" style="color: ' + ${JSON.stringify(primaryColor)} + '; font-weight: 700;">Tümünü İnceleyin &rarr;</a>';
      }
    }

    // Default Fallback with Lead Capture suggestion
    return 'Talebinizle ilgili uzman ekibimiz size hemen dönüş yapabilir. Dilerseniz <a href="#hizli-teklif" style="color: ' + ${JSON.stringify(primaryColor)} + '; font-weight: 700;">Hızlı Teklif Formu</a> doldurabilir veya <a href="https://wa.me/' + waPhone + '" target="_blank" style="color: #16a34a; font-weight: 700;">WhatsApp Hattımızdan</a> anında yazabilirsiniz.';
  }
})();
</script>
`;
}
