const fs = require('fs');
let idx = fs.readFileSync('public/index.html', 'utf8');

// Revert Dollar back to TL
// We changed ₺ to $ before. So let's replace \$ back to ₺.
idx = idx.replace(/\$/g, '₺');
idx = idx.replace(/Fiyat \(₺\)/g, 'Fiyat (₺)');
idx = idx.replace(/Local Currency Rate/g, 'Dolar -> TL Kuru');

// Add AZERBAYCAN to lang menu if not exists
if (!idx.includes('🇦🇿 AZ')) {
  idx = idx.replace('<a href="#" onclick="setLanguage(\'tr\')">🇹🇷 TR</a>', '<a href="#" onclick="setLanguage(\'tr\')">🇹🇷 TR</a>\n        <a href="#" onclick="setLanguage(\'az\')">🇦🇿 AZ</a>');
}

// Add map location button to checkout
const checkoutAddrStr = '<input type="text" id="chkCountry" placeholder="Ülke" required style="flex:1;">';
if (idx.includes(checkoutAddrStr) && !idx.includes('findLocation()')) {
  idx = idx.replace(
    checkoutAddrStr,
    `<button class="btn-ghost" type="button" onclick="findLocation()" style="border:1px solid var(--accent); padding:0 12px; border-radius:8px; color:var(--accent); font-size:16px;" title="Konumumu Bul">📍</button>\n              <input type="text" id="chkCountry" placeholder="Ülke" required style="flex:1;">`
  );
}

// Add map location button to user profile address
const profileAddrStr = '<input type="text" id="savedCountry" placeholder="Ülke" style="flex:1;">';
if (idx.includes(profileAddrStr) && !idx.includes('findSavedLocation()')) {
  idx = idx.replace(
    profileAddrStr,
    `<button class="btn-ghost" type="button" onclick="findSavedLocation()" style="border:1px solid var(--accent); padding:0 12px; border-radius:6px; color:var(--accent); font-size:16px;" title="Konumumu Bul">📍</button>\n          <input type="text" id="savedCountry" placeholder="Ülke" style="flex:1;">`
  );
}

// Add AI Support HTML
const aiTarget = '<button class="btn-ghost" style="width:100%; border:1px solid var(--border); padding:15px; margin-bottom: 15px; border-radius:8px;" onclick="closeUserDrawer(); window.location.hash=\'products\'">Koleksiyona Devam Et</button>';
if (idx.includes(aiTarget) && !idx.includes('AI DESTEK ASİSTANI')) {
  const aiHtml = `
      <!-- AI Support Section in Profile -->
      <div class="checkout-fields" style="margin-bottom:20px; text-align:left; border:1px solid rgba(255,255,255,0.05); padding:15px; border-radius:10px; background:rgba(0,0,0,0.2);">
        <label style="font-size:12px; color:var(--accent); font-weight:bold; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
          <span>AI DESTEK ASİSTANI</span>
          <span style="font-size:10px; background:var(--accent); color:#000; padding:2px 6px; border-radius:4px;">BETA</span>
        </label>
        <div id="aiChatBox" style="height: 150px; overflow-y: auto; background: rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:10px; margin-bottom:10px; font-size:13px; display:flex; flex-direction:column; gap:8px;">
          <div style="background: rgba(255,255,255,0.05); padding:8px; border-radius:8px; align-self:flex-start; max-width:80%;">
            Merhaba DroxStore Premium üyesi! Size nasıl yardımcı olabilirim?
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <input type="text" id="aiChatInput" placeholder="Sorunuzu yazın..." style="flex:1;" onkeypress="if(event.key==='Enter') sendAiMessage()">
          <button class="btn-primary" onclick="sendAiMessage()" style="padding: 0 15px;">Gönder</button>
        </div>
        <div style="margin-top:10px; text-align:center;">
          <button class="btn-ghost" style="font-size:11px; padding:4px 8px; border:1px solid rgba(255,255,255,0.2); color:#ccc; border-radius:4px;" onclick="escalateToAdmin()">Çözülemedi - Destek Talebi Oluştur</button>
        </div>
      </div>
  `;
  idx = idx.replace(aiTarget, aiHtml + '\\n      ' + aiTarget);
}

fs.writeFileSync('public/index.html', idx, 'utf8');

// Now for app.js
let appjs = fs.readFileSync('public/app.js', 'utf8');
appjs = appjs.replace(/\$/g, '₺');

// Clean up any rogue functions from previous attempts if they exist
const removeBlocks = ["function sendAiMessage", "function findLocation"];
removeBlocks.forEach(blk => {
  const i = appjs.indexOf(blk);
  if (i > -1) {
    appjs = appjs.substring(0, i);
  }
});


// Add AI JS
appjs += `\n
// --- AI SUPPORT SYSTEM & GEO LOCATION ---
function sendAiMessage() {
  const input = document.getElementById('aiChatInput');
  const text = input.value.trim();
  if(!text) return;

  const chatBox = document.getElementById('aiChatBox');
  const userMsg = document.createElement('div');
  userMsg.style.cssText = 'background: rgba(255,255,255,0.1); padding:8px; border-radius:8px; align-self:flex-end; max-width:80%; color:var(--accent);';
  userMsg.innerText = text;
  chatBox.appendChild(userMsg);
  
  input.value = '';
  chatBox.scrollTop = chatBox.scrollHeight;

  setTimeout(() => {
    const aiMsg = document.createElement('div');
    aiMsg.style.cssText = 'background: rgba(255,255,255,0.05); padding:8px; border-radius:8px; align-self:flex-start; max-width:80%;';
    
    const lower = text.toLowerCase();
    if(lower.includes('kargo') || lower.includes('teslimat')) {
      aiMsg.innerText = 'Kargolarımız sipariş onaylandıktan sonra 1-3 iş günü içerisinde kargoya verilir. Yurtiçi kargo ile çalışıyoruz.';
    } else if(lower.includes('iade') || lower.includes('değişim')) {
      aiMsg.innerText = 'DroxStore Premium üyeleri için 30 gün koşulsuz iade ve değişim hakkı bulunmaktadır.';
    } else if(lower.includes('beden')) {
      aiMsg.innerText = 'Beden tablomuza ürün detay sayfalarından ulaşabilirsiniz. Genellikle regular fit kalıp kullanıyoruz.';
    } else if(lower.includes('iletişim')) {
      aiMsg.innerText = 'Bize destek@droxstore.com adresinden veya profilinizdeki Destek Talebi sayfasından ulaşabilirsiniz.';
    } else {
      aiMsg.innerText = 'Size nasıl yardımcı olabileceğimi daha iyi anlamam için detay verebilir misiniz? Veya aşağıdan bir destek talebi oluşturup doğrudan admin yetkilisi ile görüşebilirsiniz.';
    }
    
    chatBox.appendChild(aiMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 1000);
}

function escalateToAdmin() {
  const chatBox = document.getElementById('aiChatBox');
  const userText = prompt('Destek talebinizi kısaca açıklayın:', 'Son siparişim hakkında sorun yaşıyorum');
  if(!userText) return;
  
  fetch('/api/support/ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue: userText, user: typeof loggedInUser !== 'undefined' && loggedInUser ? loggedInUser.email : 'Bilinmeyen Kullanıcı' })
  }).catch(e => console.log(e));

  const sysMsg = document.createElement('div');
  sysMsg.style.cssText = 'background: rgba(255,100,100,0.2); padding:8px; border-radius:8px; align-self:center; width:90%; text-align:center; font-size:11px; margin-top:5px;';
  sysMsg.innerText = '✅ Destek talebiniz admin ekibine iletildi. En kısa sürede dönüş sağlanacaktır.';
  chatBox.appendChild(sysMsg);
  chatBox.scrollTop = chatBox.scrollHeight;
  if(typeof showToast === 'function') showToast('Destek talebi oluşturuldu.', 'success');
}

async function loadSupportTickets() {
  const list = document.getElementById('adminSupportList');
  if(!list) return;
  
  try {
    const res = await fetch('/api/support/tickets');
    if(!res.ok) return;
    const tickets = await res.json();
    
    list.innerHTML = '';
    if(tickets.length === 0) {
      list.innerHTML = '<p style="color:#888; font-size:13px;">Şu an aktif destek talebi bulunmuyor.</p>';
      return;
    }
    
    tickets.forEach(t => {
      const el = document.createElement('div');
      el.className = 'order-card';
      el.innerHTML = \`
        <div class="order-header">
          <span>Kullanıcı: \${t.user}</span>
          <button class="btn-ghost" style="font-size:10px; padding:2px 8px; border:1px solid var(--accent); color:var(--accent); border-radius:4px;" onclick="resolveTicket('\${t.id}')">Çözüldü İşaretle</button>
        </div>
        <div class="order-items">
          Sorun: \${t.issue}<br>
          Tarih: \${new Date(t.date).toLocaleString('tr-TR')}
        </div>
      \`;
      list.appendChild(el);
    });
  } catch(e) {
    console.log(e);
  }
}

async function resolveTicket(id) {
  try {
    await fetch('/api/support/tickets/' + id, { method: 'DELETE' });
    if(typeof showToast === 'function') showToast('Talep çözüldü olarak işaretlendi', 'success');
    loadSupportTickets();
  } catch(e) { console.log(e); }
}

const _originalSwitchAdminTab = window.switchAdminTab;
if(typeof _originalSwitchAdminTab !== 'function') {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      if(target === 'tab-support') {
        loadSupportTickets();
      }
    });
  });
}

// Map Location functions
function findLocation() {
  if (navigator.geolocation) {
    if(typeof showToast === 'function') showToast('Konum bulunuyor...', '');
    navigator.geolocation.getCurrentPosition(position => {
      fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + position.coords.latitude + '&lon=' + position.coords.longitude)
        .then(res => res.json())
        .then(data => {
          if(data.address) {
             document.getElementById('chkCountry').value = data.address.country || '';
             document.getElementById('chkCity').value = data.address.city || data.address.town || data.address.state || '';
             document.getElementById('chkZip').value = data.address.postcode || '';
             document.getElementById('chkLine1').value = data.address.road || '';
             if(typeof showToast === 'function') showToast('Konum başarıyla alındı!', 'success');
          }
        });
    }, err => {
       if(typeof showToast === 'function') showToast('Konum izni reddedildi.', 'error');
    });
  } else {
    alert("Tarayıcınız konum özelliğini desteklemiyor.");
  }
}

function findSavedLocation() {
  if (navigator.geolocation) {
    if(typeof showToast === 'function') showToast('Konum bulunuyor...', '');
    navigator.geolocation.getCurrentPosition(position => {
      fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + position.coords.latitude + '&lon=' + position.coords.longitude)
        .then(res => res.json())
        .then(data => {
          if(data.address) {
             document.getElementById('savedCountry').value = data.address.country || '';
             document.getElementById('savedCity').value = data.address.city || data.address.town || data.address.state || '';
             document.getElementById('savedZip').value = data.address.postcode || '';
             document.getElementById('savedLine1').value = data.address.road || '';
             if(typeof showToast === 'function') showToast('Konum güncellendi, lütfen kaydedin.', 'success');
          }
        });
    });
  }
}
`;

fs.writeFileSync('public/app.js', appjs, 'utf8');

console.log("All fixes applied successfully.");
