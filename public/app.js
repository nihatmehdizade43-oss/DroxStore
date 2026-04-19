/* ============================================
   DROXSTORE — Frontend App (v3.0 Cloud Pro)
   ============================================ */

const API_BASE = '';
let cart = JSON.parse(localStorage.getItem('drox_cart') || '[]');
let allProducts = [];
let allCategories = [];
let currentFilter = 'all';
let currentProduct = null;
let activeModalImgIdx = 0;
let adminToken = localStorage.getItem('drox_jwt_token') || null;
let customerToken = localStorage.getItem('drox_cust_token') || null;
let customerData = JSON.parse(localStorage.getItem('drox_cust_data') || 'null');
let selectedFiles = [];
let allDiscounts = [];
let activeAppliedDiscount = null;
let globalSettings = { vipThreshold: 20000, qtyDiscountTarget: 3, qtyDiscountPercent: 10, dateDiscountPercent: 8 };

// FIREBASE FRONTEND CONFIG
const pbConfig = {
  apiKey: "AIzaSyAw3XnicSqAHsDYqbDlIwCLugqxjYG6W7g",
  authDomain: "droxstore-c5c58.firebaseapp.com",
  projectId: "droxstore-c5c58",
  storageBucket: "droxstore-c5c58.firebasestorage.app",
  messagingSenderId: "695757369573",
  appId: "1:695757369573:web:70cddb973f98fd3218240c"
};
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(pbConfig);
}

// Secret Admin Access (Ctrl + Alt + A)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
    e.preventDefault();
    openAdminLogin();
  }
});

// Secret Admin Access via Footer (3 taps for mobile)
let footerTapCount = 0;
let footerTapTimer = null;
document.addEventListener('DOMContentLoaded', () => {
  const footerEl = document.querySelector('.footer-bottom');
  if(footerEl) {
    footerEl.addEventListener('click', () => {
      footerTapCount++;
      clearTimeout(footerTapTimer);
      footerTapTimer = setTimeout(() => footerTapCount = 0, 1000);
      if(footerTapCount >= 3) {
        footerTapCount = 0;
        openAdminLogin();
      }
    });
  }
});

// ─── API HELPERS ──────────────────────────────────────────────────
const API = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Yüklenemedi');
    return res.json();
  },
  async authAction(url, method, body = null, isFormData = false) {
    const headers = {};
    if (adminToken && url.includes('/api/auth') === false && !url.includes('/api/customers')) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    } else if (customerToken && url.includes('/api/customers')) {
      headers['Authorization'] = `Bearer ${customerToken}`;
    }
    if (!isFormData) headers['Content-Type'] = 'application/json';
    
    const options = { method, headers };
    if (body) options.body = isFormData ? body : JSON.stringify(body);
    
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type");
    
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'İşlem başarısız');
      return data;
    } else {
      const text = await res.text();
      throw new Error(`Sunucu hatası (${res.status}): Beklenmeyen format.`);
    }
  }
};

// ─── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initLoader();
  initCursor();
  initNavbar();
  initTabs();
  initCart();
  initModal();
  initLanguageMenu();
  updateCartUI();
  await refreshAllData();
});

function initLanguageMenu() {
  // Auto-detect lang on first visit
  const sysLang = navigator.language.substring(0,2);
  const cookieMatch = document.cookie.match(/googtrans=\/tr\/([a-zA-Z-]+)/);
  let currentLang = cookieMatch ? cookieMatch[1] : null;

  if (!localStorage.getItem('lang_initialized')) {
    localStorage.setItem('lang_initialized', 'true');
    // Set auto mapping
    const valid = ['en','de','fr','es','ru','ar','it','pt','zh-CN'];
    if (sysLang !== 'tr' && valid.includes(sysLang) && !currentLang) {
      setLanguage(sysLang);
      return; 
    }
  }

  // Update UI to current lang
  if (currentLang && currentLang !== 'tr') {
    document.getElementById('langCurrent').textContent = currentLang.toUpperCase().substring(0,2);
  } else {
    document.getElementById('langCurrent').textContent = 'TR';
  }

  // Close drop down when clicking outside
  document.addEventListener('click', (e) => {
    if(!e.target.closest('.lang-selector')) {
      document.querySelector('.lang-selector')?.classList.remove('open');
    }
  });
}

function toggleLangMenu() {
  document.querySelector('.lang-selector').classList.toggle('open');
}

function setLanguage(lang) {
  if(lang === 'tr') {
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; domain=.${location.hostname}; path=/;`;
  } else {
    document.cookie = `googtrans=/tr/${lang}; path=/`;
    document.cookie = `googtrans=/tr/${lang}; domain=.${location.hostname}; path=/`;
  }
  location.reload();
}

async function refreshAllData() {
  try {
    allCategories = await API.get('/api/categories');
    allProducts = await API.get('/api/products');
    
    try {
      globalSettings = await API.get('/api/settings');
    } catch(err) { console.warn("Ayarlar yüklenemedi", err); }

    try {
      let rawDiscounts = await API.get('/api/discounts');
      const now = new Date();
      // Yalnızca süresi dolmamış olanları (veya süresiz olanları) aktif kabul et
      allDiscounts = rawDiscounts.filter(d => !d.validUntil || new Date(d.validUntil) >= now);
    } catch(err) { console.warn("İndirimler yüklenemedi", err); }
    
    renderCategories();
    renderProducts(currentFilter);
    renderTopDrops();
    renderPublicDiscounts();

    if (adminToken) await refreshAdminPanel();
  } catch (err) {
    console.error('Veri yenileme hatası:', err);
  }
}

// ─── RENDERING ───────────────────────────────────────────────────
function renderCategories() {
  const filters = document.getElementById('productFilters');
  if(!filters) return;
  filters.innerHTML = `<button class="filter-btn ${currentFilter === 'all'?'active':''}" data-cat="all" onclick="setProductFilter('all', this)">Tümü</button>` + 
    allCategories.map(cat => `
      <button class="filter-btn ${currentFilter === cat.slug?'active':''}" data-cat="${cat.slug}" onclick="setProductFilter('${cat.slug}', this)">${cat.name}</button>
    `).join('');

  const select = document.getElementById('prodCategory');
  if(select) {
    select.innerHTML = '<option value="">Seçiniz...</option>' + 
      allCategories.map(cat => `<option value="${cat.slug}">${cat.name}</option>`).join('');
  }

  const adminList = document.getElementById('adminCatList');
  if(adminList) {
    adminList.innerHTML = allCategories.map(cat => `
      <div class="cat-item">
        <span>${cat.name}</span>
        <button onclick="deleteCategory('${cat.id}')">Sil</button>
      </div>
    `).join('');
  }
}

function renderProducts(filter) {
  const grid = document.getElementById('productGrid');
  if(!grid) return;
  const filtered = filter === 'all' ? allProducts : allProducts.filter(p => p.category === filter);

  if (filtered.length === 0) {
    grid.innerHTML = '';
    document.getElementById('emptyStore').style.display = 'flex';
    return;
  }
  document.getElementById('emptyStore').style.display = 'none';
  grid.innerHTML = filtered.map((p, i) => createProductCard(p, i)).join('');
}

function renderTopDrops() {
  const featured = allProducts.filter(p => p.isFeatured);
  const heroGrid = document.querySelector('.cat-grid'); // Reusing category grid for Top Drops if available
  if(heroGrid && featured.length > 0) {
    document.querySelector('#catSection h2').textContent = "TOP DROPS (Öne Çıkanlar)";
    heroGrid.innerHTML = featured.map((p, i) => createProductCard(p, i)).join('');
  } else if (heroGrid) {
    heroGrid.innerHTML = '<p style="color:var(--text); opacity:0.5;">Henüz öne çıkan ürün yok.</p>';
  }
}

function createProductCard(p, i) {
  const mainImage = p.images && p.images.length > 0 ? p.images[0] : '';
  return `
    <div class="product-card" data-id="${p.id}" style="animation-delay:${i * 0.05}s" onclick="openModal('${p.id}')">
      <div class="prod-img-wrap">
        <div class="prod-img-bg">
          <img src="${mainImage}" alt="${p.name}" class="prod-real-img" loading="lazy">
        </div>
        ${p.badge ? `<span class="prod-badge ${p.badgeClass}">${p.badge}</span>` : ''}
        <div class="prod-overlay">
          <button class="overlay-btn" onclick="event.stopPropagation(); quickAdd('${p.id}')">Hızlı Ekle</button>
        </div>
      </div>
      <div class="prod-info">
        <div class="prod-name">${p.name}</div>
        <div class="prod-price">₺${Number(p.price).toLocaleString('tr')}</div>
      </div>
    </div>
  `;
}

function setProductFilter(cat, btn) {
  currentFilter = cat;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderProducts(cat);
}

// ─── UI INTERACTIONS ─────────────────────────────────────────────
function initLoader() {
  setTimeout(() => document.getElementById('loader')?.classList.add('hidden'), 1500);
}
function initNavbar() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => nav?.classList.toggle('scrolled', window.scrollY > 50));
}
function initCursor() {
  const cursor = document.getElementById('cursor');
  const follower = document.getElementById('cursorFollower');
  if(!cursor || !follower) return;
  let mx=0, my=0, fx=0, fy=0;
  document.addEventListener('mousemove', e => {
    mx=e.clientX; my=e.clientY;
    cursor.style.left=mx+'px'; cursor.style.top=my+'px';
  });
  (function anim(){
    fx += (mx-fx)*0.1; fy += (my-fy)*0.1;
    follower.style.left=fx+'px'; follower.style.top=fy+'px';
    requestAnimationFrame(anim);
  })();
}

function initTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab)?.classList.add('active');
    });
  });
}

// ─── PRODUCT MODAL ───────────────────────────────────────────────
function initModal() {
  const mo = document.getElementById('modalOverlay');
  mo?.addEventListener('click', e => { if (e.target === mo) closeModal(); });
}

function openModal(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  currentProduct = p;
  activeModalImgIdx = 0;

  const thumbs = (p.images || []).map((img, i) => `
    <div class="modal-thumb ${i===0?'active':''}" onclick="setModalImg(${i}, this)">
      <img src="${img}" alt="thumb">
    </div>
  `).join('');

  // Sadece stoğu olan bedenleri seçilebilir yap
  const sizesHTML = ['S', 'M', 'L', 'XL'].map(s => {
    const qty = p.stock ? Number(p.stock[s] || 0) : 0;
    const disabled = qty <= 0 ? 'disabled style="opacity:0.3; text-decoration:line-through;"' : '';
    return `<label ${disabled}><input type="radio" name="prodSize" value="${s}" ${disabled}> ${s}</label>`;
  }).join(' ');

  const totalStock = p.stock ? Object.values(p.stock).reduce((a,b)=>Number(a)+Number(b),0) : 0;
  const stockInfo = totalStock > 0 ? `<span style="color:green">Stokta (${totalStock})</span>` : `<span style="color:red">Tükendi</span>`;

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-body">
      <div class="modal-gallery">
        <div class="modal-main-img"><img id="mainModalImg" src="${p.images[0] || ''}"></div>
        <div class="modal-thumbs">${thumbs}</div>
      </div>
      <div class="modal-details">
        <div class="modal-tag">${stockInfo}</div>
        <h2 class="modal-title">${p.name}</h2>
        <div class="modal-price">₺${Number(p.price).toLocaleString('tr')}</div>
        <div class="modal-section-label">Açıklama</div>
        <p class="modal-desc">${p.desc || 'Bu ürün detayına henüz bir açıklama girilmemiş.'}</p>
        <div class="size-selection" style="margin-top:10px; display:flex; gap:10px;">Beden: ${sizesHTML}</div>
        <button class="modal-add-btn" style="margin-top:20px;" onclick="addFromModal()" ${totalStock<=0?'disabled':''}>Sepete Ekle</button>
        <button class="btn-ghost" style="width:100%; border:1px solid var(--border); padding:10px; border-radius:6px; color:var(--text-dim); margin-top:10px;" onclick="openSizeGuide()">📏 Beden Asistanı Kılavuzu</button>
        
        <!-- Yorumlar Gelecek Buraya -->
        <div id="productReviewsArea" class="reviews-section"></div>
      </div>
    </div>
  `;
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  
  fetchAndRenderReviews(id);
}

// ─── REVIEWS LOGIC ───────────────────────────────────────────────
async function fetchAndRenderReviews(productId) {
  const area = document.getElementById('productReviewsArea');
  if(!area) return;
  area.innerHTML = '<i style="color:#888;">Yorumlar yükleniyor...</i>';
  try {
    const reviews = await API.get('/api/reviews/' + productId);
    renderReviews(productId, reviews);
  } catch(e) {
    area.innerHTML = '<span style="color:#ff4d4d">Yorumlar yüklenirken hata oluştu.</span>';
  }
}

function renderReviews(productId, reviews) {
  const area = document.getElementById('productReviewsArea');
  if(!area) return;

  let html = `<h3 style="margin-bottom:10px;">Ürün Değerlendirmeleri (${reviews.length})</h3>`;
  
  if (customerToken && customerData) {
    html += `
      <div class="review-form">
        <h4 style="margin-bottom:10px; font-size:14px;">Değerlendirmenizi Yazın</h4>
        <form onsubmit="submitReview(event, '${productId}')">
          <div class="rating-input">
            <input type="radio" id="star5" name="rating" value="5" required>
            <label for="star5">★</label>
            <input type="radio" id="star4" name="rating" value="4">
            <label for="star4">★</label>
            <input type="radio" id="star3" name="rating" value="3">
            <label for="star3">★</label>
            <input type="radio" id="star2" name="rating" value="2">
            <label for="star2">★</label>
            <input type="radio" id="star1" name="rating" value="1">
            <label for="star1">★</label>
          </div>
          <textarea id="reviewComment" rows="3" placeholder="Bu ürün hakkında ne düşünüyorsunuz?" style="width:100%; border-radius:6px; padding:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); color:white; margin-bottom:10px; font-family:inherit;" required></textarea>
          <button type="submit" class="btn-primary" style="padding: 8px 15px; font-size:12px;">Gönder</button>
        </form>
      </div>
    `;
  } else {
    html += `<div style="padding:10px; background:rgba(255,255,255,0.05); border-radius:6px; font-size:12px; margin-bottom:15px; text-align:center;">
      Yorum yapabilmek için lütfen <a href="#" onclick="closeModal(); openUserDrawer(); return false;" style="color:var(--accent); text-decoration:underline;">giriş yapın</a>.
    </div>`;
  }

  if (reviews.length === 0) {
    html += `<p style="font-size:13px; color:#888; margin-top:15px; text-align:center;">Bu ürün için henüz değerlendirme yapılmamış.</p>`;
  } else {
    let listHtml = reviews.map(r => {
       const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
       const dateStr = new Date(r.timeMs).toLocaleDateString('tr-TR');
       const defaultAvatar = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="%23888" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
       return `
         <div class="review-card">
            <div class="review-header">
              <img src="${r.userPhoto || defaultAvatar}" class="review-avatar">
              <span class="review-name">${r.userName}</span>
              <span class="review-date">${dateStr}</span>
            </div>
            <div class="review-stars">${stars}</div>
            <div class="review-text">${r.comment.replace(/</g, "&lt;")}</div>
         </div>
       `;
    }).join('');
    html += `<div style="margin-top:15px; display:flex; flex-direction:column; gap:8px; max-height: 350px; overflow-y:auto; padding-right:5px;">${listHtml}</div>`;
  }

  area.innerHTML = html;
}

async function submitReview(e, productId) {
  e.preventDefault();
  const form = e.target;
  const ratingInput = form.querySelector('input[name="rating"]:checked');
  const comment = form.querySelector('#reviewComment').value;

  if(!ratingInput) return showToast('Lütfen yıldız ile puan verin.');
  
  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Gönderiliyor...';

  try {
    await API.authAction('/api/reviews', 'POST', {
      productId,
      rating: ratingInput.value,
      comment,
      userName: customerData.name,
      userPhoto: customerData.photoURL
    });
    showToast('Değerlendirmeniz başarıyla eklendi!');
    fetchAndRenderReviews(productId);
  } catch(err) {
    showToast('Hata: ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Gönder';
  }
}


function setModalImg(idx, el) {
  document.getElementById('mainModalImg').src = currentProduct.images[idx];
  document.querySelectorAll('.modal-thumb').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ─── CART & CHECKOUT ─────────────────────────────────────────────
function initCart() {
  document.getElementById('cartBtn')?.addEventListener('click', openCart);
  document.getElementById('cartClose')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
}
function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
  renderCart();
}
function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
}

function addToCart(p, size='M', qty=1) {
  const existing = cart.find(i => i.id === p.id && i.size === size);
  if (existing) existing.qty += qty;
  else cart.push({ id:p.id, name:p.name, price:p.price, qty, image:p.images[0], size:size });
  saveCart(); updateCartUI(); showToast(`"${p.name}" sepete eklendi!`);
}

function quickAdd(id) {
  const p = allProducts.find(x => x.id === id);
  if (p) {
    const availableSizes = ['S', 'M', 'L', 'XL'].filter(s => p.stock && p.stock[s] > 0);
    if(availableSizes.length > 0) addToCart(p, availableSizes[0]);
    else showToast('Ürün stokta yok.');
  }
}

function addFromModal() {
  if (!currentProduct) return;
  const sizeInput = document.querySelector('input[name="prodSize"]:checked');
  if (!sizeInput) return showToast('Lütfen önce beden seçin!');
  addToCart(currentProduct, sizeInput.value);
  closeModal();
}

function removeFromCart(idx) {
  cart.splice(idx, 1); saveCart(); updateCartUI(); renderCart();
}
function saveCart() { localStorage.setItem('drox_cart', JSON.stringify(cart)); }

function updateCartUI() {
  const calc = calculateCartTotals();
  document.getElementById('cartCount').textContent = calc.itemsCount;
  const el = document.getElementById('cartItemCount'); if(el) el.textContent = calc.itemsCount;
  
  const tEl = document.getElementById('cartTotal'); 
  if(tEl) {
    if (calc.discountAmount > 0) {
      tEl.innerHTML = `<span style="text-decoration:line-through; font-size:12px; opacity:0.5; margin-right:5px;">₺${calc.subTotal.toLocaleString('tr')}</span> <span style="color:#4ade80;">₺${calc.finalTotal.toLocaleString('tr')}</span>`;
    } else {
      tEl.textContent = '₺' + calc.subTotal.toLocaleString('tr');
    }
  }
}

function renderCart() {
  const el = document.getElementById('cartItems');
  if (cart.length === 0) { el.innerHTML = '<div class="cart-empty"><p>Sepetin boş</p></div>'; return; }
  el.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-img"><img src="${item.image || ''}"></div>
      <div class="cart-item-info"><strong>${item.name}</strong><span>Beden: ${item.size} | ₺${item.price} x ${item.qty}</span></div>
      <button class="cart-item-remove" onclick="removeFromCart(${idx})">✕</button>
    </div>
  `).join('');
}

function openCheckout() {
  if (cart.length === 0) return showToast('Sepet boş!');
  closeCart();
  refreshCheckoutTotal();
  document.getElementById('checkoutOverlay').classList.add('open');
}
function closeCheckout() {
  document.getElementById('checkoutOverlay').classList.remove('open');
}

function calculateCartTotals() {
  const subTotal = cart.reduce((s,i) => s + (i.price * i.qty), 0);
  const itemsCount = cart.reduce((s,i) => s + i.qty, 0);
  
  let discountPercentage = 0;
  let infoParts = [];

  if (new Date().getDate() === 8 && globalSettings.dateDiscountPercent > 0) {
    discountPercentage += globalSettings.dateDiscountPercent;
    infoParts.push(`Ayın 8'i Özel (%${globalSettings.dateDiscountPercent})`);
  }

  if (itemsCount >= globalSettings.qtyDiscountTarget && globalSettings.qtyDiscountPercent > 0) {
    discountPercentage += globalSettings.qtyDiscountPercent;
    infoParts.push(`${globalSettings.qtyDiscountTarget}+ Ürün Fırsatı (%${globalSettings.qtyDiscountPercent})`);
  }

  if (activeAppliedDiscount) {
    discountPercentage += activeAppliedDiscount.percent;
    infoParts.push(`Kod: ${activeAppliedDiscount.code} (%${activeAppliedDiscount.percent})`);
  }

  const discountAmount = (subTotal * discountPercentage) / 100;
  const finalTotal = Math.max(0, subTotal - discountAmount); // Prevent negative

  return { subTotal, itemsCount, discountPercentage, discountAmount, finalTotal, infoText: infoParts.join(' + ') };
}

function refreshCheckoutTotal() {
  const calc = calculateCartTotals();
  const tEl = document.getElementById('chkBtnTotal');
  if(tEl) tEl.textContent = calc.finalTotal.toLocaleString('tr');
  
  const sumEl = document.getElementById('discountSummary');
  if(sumEl) {
    if(calc.discountAmount > 0) {
      sumEl.style.display = 'block';
      sumEl.innerHTML = `Uygulanan İndirimler: <br> <span style="color:#fff;">${calc.infoText}</span> <br> <strong>Toplam Kazanç: ₺${calc.discountAmount.toLocaleString('tr')}</strong>`;
    } else {
      sumEl.style.display = 'none';
      document.getElementById('promoMessage').style.display = 'none';
    }
  }
}

function applyPromoCode() {
  const input = document.getElementById('chkPromoCode');
  const code = input.value.trim().toUpperCase();
  const msgEl = document.getElementById('promoMessage');
  
  if(!code) return;
  
  const discountObj = allDiscounts.find(d => d.code === code);
  if (!discountObj) {
    msgEl.style.display = 'block';
    msgEl.textContent = "Geçersiz veya süresi dolmuş kod.";
    msgEl.style.color = "#ff4d4d";
    activeAppliedDiscount = null;
    return;
  }
  
  activeAppliedDiscount = discountObj;
  msgEl.style.display = 'block';
  msgEl.textContent = `Tebrikler! ${code} kodu ile sepete %${discountObj.percent} ekstra indirim eklendi.`;
  msgEl.style.color = "#4ade80";
  
  refreshCheckoutTotal();
  updateCartUI();
}

// CC & Checkout Logic
document.getElementById('chkName')?.addEventListener('input', function(e) {
  const v = e.target.value.toUpperCase();
  const el = document.getElementById('ccVisName');
  if(el) el.textContent = v || 'AD SOYAD';
});

function formatCardNum(el) {
  let v = el.value.replace(/\D/g, '');
  let formatted = v.match(/.{1,4}/g)?.join(' ') || '';
  el.value = formatted;
  const vis = document.getElementById('ccVisNum');
  if(vis) vis.textContent = formatted || '#### #### #### ####';
  const type = document.querySelector('.cc-type');
  if(type) {
    if(v.startsWith('4')) type.textContent = 'VISA';
    else if(v.startsWith('5')) type.textContent = 'MASTER';
    else type.textContent = 'CARD';
  }
}
function formatCardExp(el) {
  let v = el.value.replace(/\D/g, '');
  if (v.length > 2) v = v.substring(0,2) + '/' + v.substring(2,4);
  el.value = v;
  const vis = document.getElementById('ccVisExp');
  if(vis) vis.textContent = v || 'AA/YY';
}
function formatCardCvv(el) {
  let v = el.value.replace(/\D/g, '');
  el.value = v;
  const vis = document.getElementById('ccVisCvv');
  if(vis) vis.textContent = v || '***';
}
function flipCard(back) {
  const box = document.getElementById('ccBox');
  if(box) {
    if(back) box.classList.add('flipped');
    else box.classList.remove('flipped');
  }
}

async function processCheckout() {
  const nameStr = document.getElementById('chkName').value;
  const phone = document.getElementById('chkPhone').value;
  
  const country = document.getElementById('chkCountry').value;
  const city = document.getElementById('chkCity').value;
  const line1 = document.getElementById('chkLine1').value;
  const line2 = document.getElementById('chkLine2').value;
  const zip = document.getElementById('chkZip').value;

  if(!nameStr || !phone || !country || !city || !line1 || !zip) {
    showToast('Lütfen teslimat alanlarını (Adres Satırı 2 hariç) eksiksiz doldurunuz.');
    return;
  }

  const address = `${line1}\n${line2 ? line2 + '\n' : ''}${zip} ${city}\n${country}`;
  
  const ccNum = document.getElementById('ccNum').value.trim();
  const ccExp = document.getElementById('ccExp').value.trim();
  const ccCvv = document.getElementById('ccCvv').value.trim();

  if(!nameStr || !phone || !address || ccNum.length < 19 || ccExp.length < 5 || ccCvv.length < 3) {
    return showToast('Lütfen teslimat ve kart bilgilerinizi eksiksiz girin.');
  }

  // STRICT VALIDATION (Luhn Algorithm & Experiation Check)
  const isLuhnValid = (num) => {
    let arr = (num + '').split('').reverse().map(x => parseInt(x, 10));
    let lastDigit = arr.splice(0, 1)[0];
    let sum = arr.reduce((acc, val, i) => (i % 2 !== 0 ? acc + val : acc + ((val * 2) % 9 || 9)), 0);
    return sum > 0 && (sum + lastDigit) % 10 === 0;
  };

  const strippedNum = ccNum.replace(/\\s/g, '');
  if (!isLuhnValid(strippedNum)) {
    return showToast('Bankanız işlemi reddetti: Geçersiz kredi kartı numarası.', 'error');
  }

  const [expMonth, expYear] = ccExp.split('/');
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = parseInt(now.getFullYear().toString().substr(-2));
  
  if (parseInt(expMonth) > 12 || parseInt(expMonth) < 1 || parseInt(expYear) < currentYear || (parseInt(expYear) === currentYear && parseInt(expMonth) < currentMonth)) {
    return showToast('Geçersiz veya süresi dolmuş SKT. Lütfen tekrar kontrol edin.', 'error');
  }

  const calc = calculateCartTotals();
  const total = calc.finalTotal;
  const appliedDiscountInfo = calc.infoText;
  const btn = document.getElementById('chkSubmitBtn');
  btn.disabled = true; 
  btn.textContent = "Ödeme Alınıyor...";

  // Ödeme animasyonu / Iyzico Mock bekleme süresi
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    await API.authAction('/api/orders', 'POST', {
      customerName: nameStr, phone, address, items: cart, total, appliedDiscountInfo
    });
    
    showToast('Ödeme Başarılı! Siparişiniz oluşturuldu. ✅');
    cart = []; activeAppliedDiscount = null; saveCart(); updateCartUI();
    
    ['chkName', 'chkPhone', 'chkLine1', 'chkLine2', 'chkZip', 'chkCountry', 'chkCity', 'ccNum', 'ccExp', 'ccCvv', 'chkPromoCode'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = '';
    });
    document.getElementById('promoMessage').style.display = 'none';
    document.getElementById('discountSummary').style.display = 'none';
    document.getElementById('ccVisNum').textContent = '#### #### #### ####';
    document.getElementById('ccVisName').textContent = 'AD SOYAD';
    document.getElementById('ccVisExp').textContent = 'AA/YY';
    document.getElementById('ccVisCvv').textContent = '***';
    flipCard(false);

    closeCheckout();
    await refreshAllData(); 
    
    // Professional Redirect to Live Tracking
    showToast('Sipariş Onaylandı! Kargo takibine yönlendiriliyorsunuz.', 'success');
    setTimeout(() => {
      const uiTracker = document.getElementById('activeTrackerUI');
      const noMsg = document.getElementById('noActiveOrderMsg');
      const orderNum = document.getElementById('activeOrderNumber');
      if(uiTracker && noMsg && orderNum) {
        uiTracker.style.display = 'block';
        noMsg.style.display = 'none';
        orderNum.innerText = 'Sipariş No: #DX-' + Math.floor(Math.random()*90000 + 10000);
        openUserDrawer();
        const orderTabBtn = document.querySelector('.user-dash-tab[data-target="tab-user-orders"]');
        if (orderTabBtn) orderTabBtn.click();
      }
    }, 1500);

  } catch(err) {
    showToast('Sipariş verilirken hata oluştu: ' + err.message);
  } finally {
    btn.disabled = false; 
    btn.innerHTML = `Siparişi Onayla · ₺<span id="chkBtnTotal">${total.toLocaleString('tr')}</span>`;
  }
}

// ─── CUSTOMER AUTH & UI ──────────────────────────────────────────
function openUserDrawer() {
  document.getElementById('userOverlay').classList.add('open');
  document.getElementById('userDrawer').classList.add('open');
  refreshUserUI();
}
function closeUserDrawer() {
  document.getElementById('userOverlay').classList.remove('open');
  document.getElementById('userDrawer').classList.remove('open');
}
document.getElementById('userOverlay')?.addEventListener('click', closeUserDrawer);

function switchUserTab(tab) {
  if(tab === 'login') {
    document.getElementById('userLoginForm').style.display = 'flex';
    document.getElementById('userRegForm').style.display = 'none';
    document.getElementById('tabLogin').style.backgroundColor = 'rgba(255,255,255,0.05)';
    document.getElementById('tabRegister').style.backgroundColor = 'transparent';
    document.getElementById('tabLogin').style.borderColor = 'var(--accent)';
    document.getElementById('tabRegister').style.borderColor = 'var(--border)';
  } else {
    document.getElementById('userLoginForm').style.display = 'none';
    document.getElementById('userRegForm').style.display = 'flex';
    document.getElementById('tabLogin').style.backgroundColor = 'transparent';
    document.getElementById('tabRegister').style.backgroundColor = 'rgba(255,255,255,0.05)';
    document.getElementById('tabLogin').style.borderColor = 'var(--border)';
    document.getElementById('tabRegister').style.borderColor = 'var(--accent)';
  }
}

function refreshUserUI() {
  if (customerToken && customerData) {
    document.getElementById('userLoggedOut').style.display = 'none';
    document.getElementById('userLoggedIn').style.display = 'block';
    document.getElementById('loggedUserName').textContent = customerData.name.split(' ')[0] || customerData.name;
    
    // VIP Badge kontrolü
    if (customerData.totalSpent >= globalSettings.vipThreshold) {
      document.getElementById('vipBadge').style.display = 'block';
    } else {
      document.getElementById('vipBadge').style.display = 'none';
    }
    
    // Avatar handler
    if (customerData.photoURL) {
      document.getElementById('userAvatarContainer').style.display = 'block';
      document.getElementById('userAvatar').src = customerData.photoURL;
    } else {
      document.getElementById('userAvatarContainer').style.display = 'none';
    }

    // Address & Checkout Data Sync
    const addr = customerData.address || {};
    document.getElementById('savedCountry').value = addr.country || '';
    document.getElementById('savedCity').value = addr.city || '';
    document.getElementById('savedLine1').value = addr.line1 || '';
    document.getElementById('savedLine2').value = addr.line2 || '';
    document.getElementById('savedZip').value = addr.zip || '';
    
    const chkName = document.getElementById('chkName');
    const chkEmail = document.getElementById('chkEmail');
    
    if(chkName) chkName.value = customerData.name || '';
    if(chkEmail) chkEmail.value = customerData.email || '';
    
    if(document.getElementById('chkCountry')) {
      document.getElementById('chkCountry').value = addr.country || '';
      document.getElementById('chkCity').value = addr.city || '';
      document.getElementById('chkLine1').value = addr.line1 || '';
      document.getElementById('chkLine2').value = addr.line2 || '';
      document.getElementById('chkZip').value = addr.zip || '';
    }

  } else {
    document.getElementById('userLoggedOut').style.display = 'block';
    document.getElementById('userLoggedIn').style.display = 'none';
    switchUserTab('login');
  }
}

// ─── AUTH SYNC TO BACKEND ───────────────────────────────────────
async function syncFirebaseUserWithBackend(user, nameStr) {
  try {
    const token = await user.getIdToken();
    customerToken = token;
    
    // Sync with backend (Creates Firestore record, uploads photo if needed)
    const data = await API.authAction('/api/customers/sync', 'POST', {
      email: user.email,
      name: nameStr || user.displayName || 'İsimsiz Üye',
      photoURL: user.photoURL || null
    });

    customerData = data.user;
    localStorage.setItem('drox_cust_token', customerToken);
    localStorage.setItem('drox_cust_data', JSON.stringify(customerData));
    
    refreshUserUI();
    showToast('Giriş başarılı! 🎉 Hoşgeldiniz.');
  } catch (err) {
    showToast('Sunucu ile eşitlenirken hata oluştu.');
    console.error(err);
  }
}

// ─── GOOGLE LOGIN ───────────────────────────────────────────────
async function handleGoogleLogin() {
  const btn = document.getElementById('btnGoogleLogin');
  btn.disabled = true; btn.style.opacity = '0.5';
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await firebase.auth().signInWithPopup(provider);
    await syncFirebaseUserWithBackend(result.user, result.user.displayName);
  } catch (err) {
    showToast('Google Girişi iptal edildi veya hata oluştu.');
  } finally {
    btn.disabled = false; btn.style.opacity = '1';
  }
}

// ─── EMAIL LOGIN & REGISTER ─────────────────────────────────────
async function handleUserRegister(e) {
  e.preventDefault();
  const name = document.getElementById('rName').value;
  const email = document.getElementById('rEmail').value;
  const password = document.getElementById('rPass').value;
  
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Kayıt Olunuyor...';
  try {
    const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
    // İsim soyisim bilgisini Firebase profilinde sakla
    await result.user.updateProfile({ displayName: name });
    // Onay e-postası gönder
    await result.user.sendEmailVerification();
    // Otomatik girişi iptal et
    await firebase.auth().signOut();
    
    switchUserTab('login');
    showToast('Kayıt başarılı! Lütfen giriş yapmadan önce e-postanıza gelen linke tıklayarak hesabınızı onaylayın.');
    
    // Formu temizle
    document.getElementById('rName').value = '';
    document.getElementById('rEmail').value = '';
    document.getElementById('rPass').value = '';
  } catch(err) {
    showToast('Kayıt başarısız: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Hesap Oluştur';
  }
}

async function handleUserLogin(e) {
  e.preventDefault();
  const email = document.getElementById('lEmail').value;
  const password = document.getElementById('lPass').value;
  
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Giriş Yapılıyor...';
  try {
    const result = await firebase.auth().signInWithEmailAndPassword(email, password);
    
    // E-posta onayı kontrolü (sadece email şifre ile girenler için geçerli)
    if (!result.user.emailVerified) {
      await firebase.auth().signOut();
      showToast('Giriş başarısız: Lütfen e-postanıza gelen link ile hesabınızı onaylayın.');
      btn.disabled = false; btn.textContent = 'Giriş Yap';
      return;
    }
    
    await syncFirebaseUserWithBackend(result.user, result.user.displayName);
  } catch(err) {
    showToast('Giriş reddedildi: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Giriş Yap';
  }
}

function handleUserLogout() {
  firebase.auth().signOut().then(() => {
    customerToken = null; customerData = null;
    localStorage.removeItem('drox_cust_token');
    localStorage.removeItem('drox_cust_data');
    refreshUserUI();
    showToast('Çıkış yapıldı.');
  });
}

// ─── ADDRESS UPDATE ─────────────────────────────────────────────
async function saveUserAddress() {
  const address = {
    country: document.getElementById('savedCountry').value.trim(),
    city: document.getElementById('savedCity').value.trim(),
    line1: document.getElementById('savedLine1').value.trim(),
    line2: document.getElementById('savedLine2').value.trim(),
    zip: document.getElementById('savedZip').value.trim()
  };

  if(document.getElementById('chkCountry')) {
    document.getElementById('chkCountry').value = address.country;
    document.getElementById('chkCity').value = address.city;
    document.getElementById('chkLine1').value = address.line1;
    document.getElementById('chkLine2').value = address.line2;
    document.getElementById('chkZip').value = address.zip;
  }

  if (customerToken && customerData) {
    try {
      await API.authAction('/api/customers/address', 'POST', { address });
      customerData.address = address;
      localStorage.setItem('drox_cust_data', JSON.stringify(customerData));
      showToast('Detaylı adresiniz buluta kaydedildi! 📍');
    } catch(err) {
      showToast('Adres kaydedilemedi.');
    }
  }
}

// ─── ADMIN AUTH & PANEL ──────────────────────────────────────────
async function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('adminUser').value;
  const password = document.getElementById('adminPass').value;
  try {
    const data = await API.authAction('/api/auth/login', 'POST', { username, password });
    adminToken = data.token;
    localStorage.setItem('drox_jwt_token', adminToken);
    
    document.getElementById('adminLoginOverlay').classList.remove('open');
    showToast('Admin girişi başarılı! 🔓');
    await refreshAllData();
    openAdminPanel();
  } catch (err) {
    const errEl = document.getElementById('adminLoginError');
    if(errEl) { errEl.textContent = 'Giriş reddedildi'; errEl.style.display = 'block'; }
  }
}

function openAdminPanel() {
  if (!adminToken) return openAdminLogin();
  document.getElementById('adminPanelOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  refreshAdminPanel();
}
function closeAdminPanel() {
  document.getElementById('adminPanelOverlay').classList.remove('open');
  document.body.style.overflow = '';
}
function adminLogout() {
  adminToken = null; localStorage.removeItem('drox_jwt_token');
  closeAdminPanel(); showToast('Çıkış yapıldı');
}
function openAdminLogin() {
  if (adminToken) return openAdminPanel();
  document.getElementById('adminLoginOverlay').classList.add('open');
}
function closeAdminLogin() {
  document.getElementById('adminLoginOverlay').classList.remove('open');
}

// ─── ADMIN: DASHBOARD / ORDERS ───────────────────────────────────
async function refreshAdminPanel() {
  try {
    if(!adminToken) return;
    const stats = await API.authAction('/api/stats', 'GET');
    const statTotal = document.getElementById('statTotal');
    const statUsers = document.getElementById('statUsers');
    const statSales = document.getElementById('statSales');
    const statRevenue = document.getElementById('statRevenue');
    if(statTotal) statTotal.textContent = stats.totalProducts;
    if(statUsers) statUsers.textContent = stats.totalUsers || 0;
    if(statSales) statSales.textContent = stats.totalSales || 0;
    if(statRevenue) statRevenue.textContent = (stats.totalRevenue || 0).toLocaleString('tr-TR') + '₺';
    
    // Product List
    const pList = document.getElementById('adminProductList');
    pList.innerHTML = allProducts.map(p => {
      const stockTxt = p.stock ? `S:${p.stock.S||0} M:${p.stock.M||0} L:${p.stock.L||0} XL:${p.stock.XL||0}` : 'Stok yok';
      return `
      <div class="admin-product-item">
        <div class="admin-product-thumb"><img src="${p.images?.[0] || ''}"></div>
        <div class="admin-product-details">
          <strong>${p.name} ${p.isFeatured ? '<span style="color:gold;">★</span>' : ''} ${p.isPrintful ? '<span style="color:#6366f1; font-size:10px;">PRINTFUL</span>' : ''}</strong>
          <span style="font-size:11px;">${p.category} · ₺${p.price} | Stok: ${stockTxt}</span>
        </div>
        <div class="admin-product-actions" style="display:flex; gap:5px;">
          <button class="admin-delete-btn" style="border-color:#6366f1; color:#6366f1;" onclick="openEditProduct('${p.id}')">Düzenle</button>
          <button class="admin-delete-btn" onclick="deleteProduct('${p.id}')">Sil</button>
        </div>
      </div>
      `;
    }).join('');

    // Order List
    const orders = await API.authAction('/api/orders', 'GET');
    const oList = document.getElementById('adminOrderList');
    if(oList) {
      if(orders.length === 0) oList.innerHTML = "Henüz sipariş yok.";
      else oList.innerHTML = orders.map(o => `
        <div class="order-card">
          <div class="order-header">
            <span>Sipariş #${o.id.substring(0,6)}</span>
            <span>₺${o.total}</span>
          </div>
          <div><strong style="color:var(--accent);">Müşteri:</strong> ${o.customerName} - ${o.phone}</div>
          <div style="margin-top:8px; margin-bottom:8px; padding: 10px; background: rgba(0,0,0,0.3); border-left: 2px solid var(--accent); border-radius:4px;">
            <strong style="color:var(--accent); font-size:11px; display:block; margin-bottom:4px; letter-spacing:1px;">TESLİMAT ADRESİ</strong>
            ${o.address.replace(/\n/g, '<br>')}
          </div>
          <div class="order-items">
            ${o.items.map(i => `${i.qty}x ${i.name} (Beden: ${i.size})`).join('<br>')}
          </div>
          <button class="admin-delete-btn" style="margin-top:10px; width:100%; border-color:red;" onclick="deleteOrder('${o.id}')">Siparişi Arşivle / Sil</button>
        </div>
      `).join('');
    }

    // Discounts List
    const dList = document.getElementById('adminDiscountList');
    if(dList) {
      if(allDiscounts.length === 0) dList.innerHTML = "Aktif kupon yok.";
      else dList.innerHTML = allDiscounts.map(d => {
        const untilTxt = d.validUntil ? new Date(d.validUntil).toLocaleDateString('tr') + ' Bitiş' : 'Süresiz';
        return `
        <div class="cat-item">
          <span><strong>${d.code}</strong> - %${d.percent} (${untilTxt})</span>
          <button onclick="deleteDiscount('${d.id}')">Sil</button>
        </div>
      `}).join('');
    }

    // System Settings Populate
    const st = globalSettings;
    if(document.getElementById('set_vipThreshold')) {
      document.getElementById('set_vipThreshold').value = st.vipThreshold || 20000;
      document.getElementById('set_qtyTarget').value = st.qtyDiscountTarget || 3;
      document.getElementById('set_qtyPercent').value = st.qtyDiscountPercent || 10;
      document.getElementById('set_datePercent').value = st.dateDiscountPercent || 8;
      document.getElementById('set_printfulToken').value = st.printfulToken || '';
      document.getElementById('set_usdRate').value = st.usdToTlRate || 33.0;
      document.getElementById('set_printfulMargin').value = st.printfulMargin || 50;
    }

  } catch (err) { console.error('Admin panel hatası:', err); }
}

async function deleteOrder(id) {
  if (!confirm('Siparişi veritabanından silmek istiyor musunuz?')) return;
  try {
    await API.authAction(`/api/orders/${id}`, 'DELETE');
    showToast('Sipariş silindi');
    await refreshAdminPanel();
  } catch (err) { showToast(err.message); }
}

// ─── ADMIN: ADD PRODUCT ──────────────────────────────────────────
function handleMultiImageUpload(event) {
  const files = Array.from(event.target.files);
  if (files.length > 5) return showToast('En fazla 5 görsel!');
  selectedFiles = files;
  
  const area = document.getElementById('imagePreviewArea');
  const ph = document.getElementById('uploadPlaceholder');
  if (files.length === 0) { area.innerHTML=''; ph.style.display='flex'; return; }
  ph.style.display='none';
  
  area.innerHTML = files.map((file, i) => `
    <div class="preview-item">
      <img src="${URL.createObjectURL(file)}">
      <button type="button" class="remove-preview" onclick="removePreview(${i})">✕</button>
    </div>
  `).join('');
}
function removePreview(idx) {
  selectedFiles.splice(idx, 1);
  handleMultiImageUpload({target: {files: selectedFiles}}); // re-render
}

async function handleAddProduct(e) {
  e.preventDefault();
  if (selectedFiles.length === 0) return showToast('En az 1 görsel seçin!');

  const btn = e.target.querySelector('.admin-submit-btn');
  btn.disabled = true; btn.textContent = 'Yükleniyor (Cloudinary)...';

  try {
    const formData = new FormData();
    formData.append('name', document.getElementById('prodName').value);
    formData.append('category', document.getElementById('prodCategory').value);
    formData.append('price', document.getElementById('prodPrice').value);
    formData.append('desc', document.getElementById('prodDesc').value);
    formData.append('badge', document.getElementById('prodBadge').value);
    formData.append('isFeatured', document.getElementById('prodFeatured').checked);

    const stockData = {
      S: Number(document.getElementById('s_stock').value || 0),
      M: Number(document.getElementById('m_stock').value || 0),
      L: Number(document.getElementById('l_stock').value || 0),
      XL: Number(document.getElementById('xl_stock').value || 0)
    };
    formData.append('stock', JSON.stringify(stockData));

    selectedFiles.forEach(file => formData.append('images', file));

    await API.authAction('/api/products', 'POST', formData, true);
    showToast('Ürün başarıyla yayında! ✅');
    
    e.target.reset();
    selectedFiles = [];
    document.getElementById('imagePreviewArea').innerHTML='';
    document.getElementById('uploadPlaceholder').style.display='flex';
    await refreshAllData();
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Ürünü Yayınla';
  }
}

async function deleteProduct(id) {
  if (!confirm('Ürünü silmek istiyor musunuz?')) return;
  try {
    await API.authAction(`/api/products/${id}`, 'DELETE');
    showToast('Ürün Firebase\'den silindi');
    await refreshAllData();
  } catch (err) { showToast(err.message); }
}

function openEditProduct(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return showToast('Ürün bulunamadı');
  
  document.getElementById('editProdId').value = id;
  document.getElementById('editProdName').value = product.name || '';
  document.getElementById('editProdCategory').value = product.category || '';
  document.getElementById('editProdPrice').value = product.price || 0;
  document.getElementById('editProdDesc').value = product.desc || '';
  document.getElementById('editStockS').value = product.stock?.S || 0;
  document.getElementById('editStockM').value = product.stock?.M || 0;
  document.getElementById('editStockL').value = product.stock?.L || 0;
  document.getElementById('editStockXL').value = product.stock?.XL || 0;
  
  document.getElementById('editProductOverlay').classList.add('open');
}
function closeEditProduct() {
  document.getElementById('editProductOverlay').classList.remove('open');
}
async function saveEditProduct() {
  const id = document.getElementById('editProdId').value;
  const name = document.getElementById('editProdName').value.trim();
  const category = document.getElementById('editProdCategory').value.trim();
  const price = parseFloat(document.getElementById('editProdPrice').value);
  const desc = document.getElementById('editProdDesc').value.trim();
  const stock = {
    S: Number(document.getElementById('editStockS').value || 0),
    M: Number(document.getElementById('editStockM').value || 0),
    L: Number(document.getElementById('editStockL').value || 0),
    XL: Number(document.getElementById('editStockXL').value || 0)
  };
  
  if (!name || !category || isNaN(price)) return showToast('Lütfen tüm alanları doldurun.');
  
  try {
    await API.authAction(`/api/products/${id}`, 'PUT', { name, category, price, desc, stock });
    showToast('Ürün başarıyla güncellendi! ✅');
    closeEditProduct();
    await refreshAllData();
  } catch(err) {
    showToast('Güncelleme hatası: ' + err.message);
  }
}
async function addNewCategory() {
  const name = document.getElementById('newCatName').value.trim();
  if (!name) return;
  try {
    await API.authAction('/api/categories', 'POST', { name });
    document.getElementById('newCatName').value = '';
    showToast('Kategori Firebase\'e eklendi');
    await refreshAllData();
  } catch (err) { showToast(err.message); }
}
async function deleteCategory(id) {
  if (!confirm('Kategoriyi Firebase\'den silmek istiyor musunuz?')) return;
  try {
    await API.authAction(`/api/categories/${id}`, 'DELETE');
    showToast('Kategori silindi');
    await refreshAllData();
  } catch (err) { showToast(err.message); }
}

async function addNewDiscount() {
  const code = document.getElementById('newDiscountCode').value.trim();
  const percent = document.getElementById('newDiscountPercent').value;
  const validDays = document.getElementById('newDiscountDays').value;
  if(!code || !percent) return showToast('Kod ve yüzdeyi girin');
  try {
    await API.authAction('/api/discounts', 'POST', { code, percent, validDays });
    document.getElementById('newDiscountCode').value = '';
    document.getElementById('newDiscountPercent').value = '';
    document.getElementById('newDiscountDays').value = '';
    showToast('İndirim kodu oluşturuldu!');
    await refreshAllData();
  } catch(err) {
    showToast(err.message);
  }
}

async function saveSystemSettings() {
  const vipThreshold = parseFloat(document.getElementById('set_vipThreshold').value);
  const qtyDiscountTarget = parseInt(document.getElementById('set_qtyTarget').value);
  const qtyDiscountPercent = parseFloat(document.getElementById('set_qtyPercent').value);
  const dateDiscountPercent = parseFloat(document.getElementById('set_datePercent').value);
  
  const printfulToken = document.getElementById('set_printfulToken').value.trim();
  const usdToTlRate = parseFloat(document.getElementById('set_usdRate').value);
  const printfulMargin = parseFloat(document.getElementById('set_printfulMargin').value);
  
  if (isNaN(vipThreshold) || isNaN(qtyDiscountTarget) || isNaN(qtyDiscountPercent) || isNaN(dateDiscountPercent) || isNaN(usdToTlRate) || isNaN(printfulMargin)) {
    return showToast('Lütfen ayarları sayısal olarak doldurun.');
  }
  
  try {
    const payload = { vipThreshold, qtyDiscountTarget, qtyDiscountPercent, dateDiscountPercent, printfulToken, usdToTlRate, printfulMargin };
    const res = await API.authAction('/api/settings', 'POST', payload);
    globalSettings = res.settings;
    showToast('Özel ayarlar kaydedildi ve tüm ağa yansıtıldı! 🚀');
    await refreshAllData();
  } catch(err) {
    showToast('Ayarlar kaydedilemedi: ' + err.message);
  }
}

async function syncPrintfulProducts() {
  await saveSystemSettings(); // Önce formu kaydet
  
  const btn = document.querySelector(`button[onclick="syncPrintfulProducts()"]`);
  if(btn) { btn.disabled = true; btn.textContent = 'Senkronize Ediliyor... Lütfen Bekleyin ⏳'; }
  
  try {
    const res = await API.authAction('/api/printful/sync', 'POST', {});
    showToast(res.message || 'Ürünler Başarıyla Çekildi!');
    await refreshAllData();
  } catch(err) {
    showToast('Printful Hata: ' + err.message);
  } finally {
    if(btn) { btn.disabled = false; btn.textContent = '🔄 Printful Ayarlarını Kaydet ve Ürünleri Çek'; }
  }
}

async function deleteDiscount(id) {
  if(!confirm('İndirim kodunu silmek istediğinize emin misiniz?')) return;
  try {
    await API.authAction(`/api/discounts/${id}`, 'DELETE');
    showToast('İndirim kodu silindi.');
    await refreshAllData();
  } catch(err) {
    showToast(err.message);
  }
}

function openPromotions() {
  document.getElementById('promotionsOverlay').classList.add('open');
}
function closePromotions() {
  document.getElementById('promotionsOverlay').classList.remove('open');
}
function renderPublicDiscounts() {
  const el = document.getElementById('publicDiscountsList');
  if(!el) return;
  if(allDiscounts.length === 0) {
    el.innerHTML = '<span style="color:#aaa; font-size:13px;">Şu an aktif bir indirim kodu bulunmamaktadır. Etkinlikleri takip edin!</span>';
    return;
  }
  el.innerHTML = allDiscounts.map(d => `
    <div style="background: rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
        <div><strong style="color:var(--accent); font-size: 16px;">${d.code}</strong> <br> <span style="font-size:12px; color:#888;">Sepette %${d.percent} Ekstra İndirim</span></div>
        <button class="btn-ghost" style="padding: 4px 10px; font-size: 11px; border: 1px solid var(--accent);" onclick="copyToClipboard('${d.code}')">Kopyala</button>
    </div>
  `).join('');
}
function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast(text + ' Kopyalandı!');
}

// ─── UTILS ───────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
function openLookbook() { document.getElementById('lookbookOverlay').classList.add('open'); document.body.style.overflow='hidden'; }
function closeLookbook() { document.getElementById('lookbookOverlay').classList.remove('open'); document.body.style.overflow=''; }

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
    
    // Akıllı Yanıt Mantığı
    if (lower.includes('merhaba') || lower.includes('selam') || lower.includes('hey')) {
      aiMsg.innerText = 'Merhaba! DroxStore Premium hizmetlerine hoş geldiniz. Size sipariş, kargo, iade veya ürün bedenleri hakkında nasıl yardımcı olabilirim?';
    } else if (lower.includes('kargo') || lower.includes('teslimat') || lower.includes('ne zaman') || lower.includes('gelir')) {
      aiMsg.innerText = 'Siparişleriniz genellikle onaylandıktan sonraki 1-3 iş günü içerisinde kargoya teslim edilmektedir. Takip numarası sistemdeki mail adresinize anında iletilir.';
    } else if (lower.includes('iade') || lower.includes('değişim') || lower.includes('garanti') || lower.includes('iptal')) {
      aiMsg.innerText = 'DroxStore üzerinden satın aldığınız tüm ürünlerde koşulsuz 30 gün iade ve değişim garantisi mevcuttur. Lütfen ürünü yıkamadan orijinal kutusunda saklayın.';
    } else if (lower.includes('beden') || lower.includes('kalıp') || lower.includes('dar') || lower.includes('bol') || lower.includes('ölçü')) {
      aiMsg.innerText = 'Kalıplarımız genel olarak \'Regular Fit\' şeklindedir. Eğer oversize (bol) durmasını istiyorsanız bir beden büyük almanızı tavsiye ederiz. Detaylı ölçü tablosu ürün fotoğraflarında yer almaktadır.';
    } else if (lower.includes('iletişim') || lower.includes('telefon') || lower.includes('ulaşım') || lower.includes('müşteri hizmetleri')) {
      aiMsg.innerText = 'Bize destek@droxstore.com adresinden ulaşabilir veya admin yetkilimizin direkt görebileceği şekilde alt kısımdan "Destek Talebi" oluşturabilirsiniz.';
    } else if (lower.includes('teşekkür') || lower.includes('sağol') || lower.includes('tamam')) {
      aiMsg.innerText = 'Rica ederim! Her zaman buradayım, iyi alışverişler dilerim.';
    } else if (lower.includes('indirim') || lower.includes('kampanya') || lower.includes('promosyon')) {
      aiMsg.innerText = 'Premium üyelerimize özel otomatik sepet indirimleri uygulanıyor. Ayrıca süreli kuponlar için "Kampanyalar" sayfasını kontrol edebilirsiniz.';
    } else {
      aiMsg.innerText = 'Bu konuyu tam anlayamadım ama endişelenmeyin! Bu sorunu doğrudan site yöneticimizle çözmek isterseniz, aşağıdaki "Çözülemedi - Destek Talebi Oluştur" butonuna tıklayabilirsiniz. Ekibimiz anında panelinden görecektir.';
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
      el.innerHTML = `
        <div class="order-header">
          <span>Kullanıcı: ${t.user}</span>
          <button class="btn-ghost" style="font-size:10px; padding:2px 8px; border:1px solid var(--accent); color:var(--accent); border-radius:4px;" onclick="resolveTicket('${t.id}')">Çözüldü İşaretle</button>
        </div>
        <div class="order-items">
          Sorun: ${t.issue}<br>
          Tarih: ${new Date(t.date).toLocaleString('tr-TR')}
        </div>
      `;
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

// --- GEO CURRENCY AUTO RATE ---
let geoCurrencyTriggered = false;
async function detectGeoCurrency() {
  if(geoCurrencyTriggered) return;
  geoCurrencyTriggered = true;
  try {
    const res = await fetch('https://ipapi.co/json/');
    const data = await res.json();
    if(data.country_code && data.country_code !== 'TR') {
       if(document.getElementById('langCurrent').innerText === 'TR') {
         if(typeof showToast === 'function') showToast(data.country_name + ' tespit edildi. Fiyatlar otomatik çevriliyor.', 'success');
         if(typeof setLanguage === 'function') setLanguage(data.country_code === 'AZ' ? 'az' : 'en');
       }
    }
  } catch(e) { console.log('Geo detection failed', e); }
}
document.addEventListener('DOMContentLoaded', () => { setTimeout(detectGeoCurrency, 1500); });

// --- PROFILE DASHBOARD TABS ---
document.addEventListener('click', e => {
  if (e.target.classList.contains('user-dash-tab')) {
    document.querySelectorAll('.user-dash-tab').forEach(t => t.classList.remove('active', 'border-bottom'));
    e.target.classList.add('active');
    e.target.style.borderBottom = '2px solid var(--accent)';
    e.target.style.color = 'var(--accent)';
    
    document.querySelectorAll('.user-dash-tab').forEach(t => {
      if(t !== e.target) {
        t.style.borderBottom = 'none';
        t.style.color = '';
      }
    });

    const targetId = e.target.getAttribute('data-target');
    document.querySelectorAll('.user-dash-content').forEach(c => {
       c.className = 'user-dash-content';
       c.style.display = 'none';
    });
    const targetDiv = document.getElementById(targetId);
    if(targetDiv) {
      targetDiv.classList.add('active');
      targetDiv.style.display = 'block';
    }
  }
});

// --- SMART SIZE RECOMMENDER ---
function openSizeGuide() {
  const overlay = document.getElementById('modalOverlay');
  const modalContent = document.getElementById('modalContent');
  modalContent.innerHTML = `
    <h2 style="font-family:var(--font-display); font-size:32px; color:var(--accent);">BEDEN ASİSTANI</h2>
    <p style="color:#888; font-size:13px; margin-bottom:20px;">Lütfen boy ve kilonuzu girerek sistemin size en uygun bedeni önermesini sağlayın.</p>
    <div class="checkout-fields">
      <input type="number" id="sgHeight" placeholder="Boy (cm) Örn: 180" class="sg-input">
      <input type="number" id="sgWeight" placeholder="Kilo (kg) Örn: 75" class="sg-input">
      <button class="btn-primary" onclick="calculateSize()" style="margin-top:10px;">Bedenimi Bul</button>
    </div>
    <div id="sgResult" style="margin-top:20px; font-size:36px; color:var(--accent); font-family:var(--font-display);
         background:rgba(255,255,255,0.05); padding:20px; border-radius:12px; border:1px solid rgba(255,255,255,0.1); display:none;">
    </div>
  `;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function calculateSize() {
  const h = parseInt(document.getElementById('sgHeight').value);
  const w = parseInt(document.getElementById('sgWeight').value);
  const resultDiv = document.getElementById('sgResult');
  
  if(!h || !w || h<100 || w<30) {
    resultDiv.style.display = 'block';
    resultDiv.style.fontSize = '14px';
    resultDiv.innerHTML = 'Lütfen geçerli değerler girin (Örn: Boy 180, Kilo 75).';
    return;
  }
  
  let size = 'M';
  if(h > 185 && w > 90) size = 'XXL';
  else if((h > 180 && w > 82) || (w > 88)) size = 'XL';
  else if((h > 175 && w > 75) || (w > 80)) size = 'L';
  else if((h > 165 && w > 60)) size = 'M';
  else size = 'S';
  
  resultDiv.style.display = 'block';
  resultDiv.style.fontSize = '32px';
  resultDiv.innerHTML = 'Önerilen Beden: <span style="color:#4ade80;">' + size + '</span><div style="font-size:11px; color:#aaa; margin-top:10px;">(Regular Fit kalıp baz alınmıştır. Oversize duruş isterseniz bir beden büyük tercih edebilirsiniz.)</div>';
}
