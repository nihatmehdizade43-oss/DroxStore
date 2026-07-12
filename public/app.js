/* ============================================
   DROXSTORE — Frontend App (v4.0 Azerbaijani WhatsApp & Notifications)
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
let globalSettings = { vipThreshold: 500, qtyDiscountTarget: 3, qtyDiscountPercent: 10, dateDiscountPercent: 8, whatsappNumber: '994553229166' };
let allNotifications = [];
let lastSeenNotifTime = parseInt(localStorage.getItem('drox_last_notif') || '0');

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
    if (!res.ok) throw new Error('Yüklənə bilmədi');
    return res.json();
  },
  async authAction(url, method, body = null, isFormData = false) {
    const headers = {};
    if (adminToken && !url.includes('/api/auth') && !url.includes('/api/customers') && !url.includes('/api/reviews')) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    } else if (customerToken && (url.includes('/api/customers') || url.includes('/api/reviews'))) {
      headers['Authorization'] = `Bearer ${customerToken}`;
    }
    if (!isFormData) headers['Content-Type'] = 'application/json';
    
    const options = { method, headers };
    if (body) options.body = isFormData ? body : JSON.stringify(body);
    
    const res = await fetch(url, options);
    const contentType = res.headers.get("content-type");
    
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Əməliyyat uğursuz oldu');
      return data;
    } else {
      const text = await res.text();
      throw new Error(`Server xətası (${res.status})`);
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
  initSearch();
  initReveal();
  updateCartUI();
  await refreshAllData();
  initRouter();

  // Google Redirect sonucunu yakala
  if (typeof firebase !== 'undefined') {
    firebase.auth().getRedirectResult().then(async (result) => {
      if (result && result.user) {
        await syncFirebaseUserWithBackend(result.user, result.user.displayName);
        showToast(`Xoş gəldiniz, ${result.user.displayName}! 🎉`);
        refreshUserUI();
      }
    }).catch((err) => {
      console.error('Redirect auth error:', err);
    });

    // Zaten giriş yapmış kullanıcıyı otomatik yükle
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user && !customerToken) {
        try {
          const token = await user.getIdToken(true);
          customerToken = token;
          const data = await API.authAction('/api/customers/sync', 'POST', {
            email: user.email,
            name: user.displayName || '',
            photoURL: user.photoURL || null
          });
          customerData = data.user;
          localStorage.setItem('drox_cust_token', customerToken);
          localStorage.setItem('drox_cust_data', JSON.stringify(customerData));
          refreshUserUI();
        } catch(e) { console.warn('Auth state sync error:', e); }
      }
    });
  }

  // Mandatory registration check
  if (!customerToken && !customerData) {
    setTimeout(() => {
      openUserDrawer();
      showToast('Xahiş edirik, davam etmək üçün qeydiyyatdan keçin və ya giriş edin.');
    }, 2000);
  }

  // Notification polling
  setInterval(loadNotifications, 60000);
});

// ─── SPA ROUTER ──────────────────────────────────────────────────
function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash || '#home';
  const sections = document.querySelectorAll('.app-view');
  
  sections.forEach(s => {
    s.style.display = 'none';
    s.classList.remove('active-view');
  });

  if (hash === '#home') {
    showView('home-view');
    showView('catSection');
  } else if (hash.startsWith('#products')) {
    showView('products');
    const hero = document.querySelector('.hero');
    if (hero) hero.style.display = 'none';
  } else if (hash === '#about') {
    showView('about-view');
  } else if (hash === '#contact') {
    showView('contact-view');
  } else if (hash === '#auth') {
    showView('home-view');
    openUserDrawer();
    window.location.hash = '';
  } else if (hash === '#admin') {
    openAdminLogin();
    window.location.hash = '';
  } else {
    showView('home-view');
    showView('catSection');
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showView(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'block';
    el.classList.add('active-view');
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    setTimeout(() => {
      el.style.transition = "all 0.5s ease";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }, 50);
  }
}

function initSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  
  if (!searchInput || !searchResults) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (query.length < 2) {
      searchResults.classList.remove('active');
      return;
    }

    const filtered = allProducts.filter(p => 
      p.name.toLowerCase().includes(query) || 
      p.category.toLowerCase().includes(query)
    ).slice(0, 5);

    if (filtered.length > 0) {
      searchResults.innerHTML = filtered.map(p => `
        <div class="search-item" onclick="openModal('${p.id}')">
          <img src="${p.images?.[0] || ''}" alt="${p.name}">
          <div class="search-item-info">
            <div class="search-item-name">${p.name}</div>
            <div class="search-item-price">${Number(p.price).toLocaleString()} AZN</div>
          </div>
        </div>
      `).join('');
      searchResults.classList.add('active');
    } else {
      searchResults.innerHTML = '<div class="search-item">Məhsul tapılmadı.</div>';
      searchResults.classList.add('active');
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      searchResults.classList.remove('active');
    }
  });
}

function initReveal() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  setTimeout(() => {
    document.querySelectorAll('.hero-title .line').forEach((line, i) => {
      setTimeout(() => line.style.opacity = "1", i * 200);
      setTimeout(() => line.style.transform = "translateY(0)", i * 200);
    });
  }, 500);

  document.querySelectorAll('section, .product-card, .cat-card').forEach(el => {
    el.style.opacity = "0";
    el.style.transform = "translateY(30px)";
    el.style.transition = "all 0.8s cubic-bezier(0.19, 1, 0.22, 1)";
    observer.observe(el);
  });
}

const style = document.createElement('style');
style.textContent = `
  .revealed {
    opacity: 1 !important;
    transform: translateY(0) !important;
  }
`;
document.head.appendChild(style);

async function refreshAllData() {
  try {
    allCategories = await API.get('/api/categories');
    allProducts = await API.get('/api/products');
    
    try {
      globalSettings = await API.get('/api/settings');
    } catch(err) { console.warn("Ayarlar yüklənə bilmədi", err); }

    try {
      allDiscounts = await API.get('/api/discounts');
    } catch(err) { console.warn("Endirimlər yüklənə bilmədi", err); }
    
    await loadNotifications();
    renderCategories();
    renderProducts(currentFilter);
    renderTopDrops();

    if (adminToken) await refreshAdminPanel();
  } catch (err) {
    console.error('Data yeniləmə xətası:', err);
  }
}

// ─── RENDERING ───────────────────────────────────────────────────
function renderCategories() {
  const filters = document.getElementById('productFilters');
  if(!filters) return;
  filters.innerHTML = `<button class="filter-btn ${currentFilter === 'all'?'active':''}" data-cat="all" onclick="setProductFilter('all', this)">Hamısı</button>` + 
    allCategories.map(cat => `
      <button class="filter-btn ${currentFilter === cat.slug?'active':''}" data-cat="${cat.slug}" onclick="setProductFilter('${cat.slug}', this)">${cat.name}</button>
    `).join('');

  const select = document.getElementById('prodCategory');
  if(select) {
    select.innerHTML = '<option value="">Seçin...</option>' + 
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
    const emptyStore = document.getElementById('emptyStore');
    if (emptyStore) emptyStore.style.display = 'flex';
    return;
  }
  const emptyStore = document.getElementById('emptyStore');
  if (emptyStore) emptyStore.style.display = 'none';
  grid.innerHTML = filtered.map((p, i) => createProductCard(p, i)).join('');

  document.querySelectorAll('.product-card').forEach(el => {
    if (!el.classList.contains('revealed')) {
      el.style.opacity = "0";
      el.style.transform = "translateY(30px)";
      el.style.transition = "all 0.8s cubic-bezier(0.19, 1, 0.22, 1)";
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      observer.observe(el);
    }
  });
}

function renderTopDrops() {
  const featured = allProducts.filter(p => p.isFeatured);
  const heroGrid = document.getElementById('catGridArea');
  if(heroGrid && featured.length > 0) {
    heroGrid.innerHTML = featured.map((p, i) => createProductCard(p, i)).join('');
  } else if (heroGrid) {
    heroGrid.innerHTML = '<p style="color:var(--text); opacity:0.5; text-align:center; width:100%;">Hələ ki öne çıxan məhsul yoxdur.</p>';
  }
}

function createProductCard(p, i) {
  const mainImage = p.images && p.images.length > 0 ? p.images[0] : '';
  const badgeHtml = p.badge ? `<span class="prod-badge ${p.badgeClass || ''}">${p.badge}</span>` : '';
  
  return `
    <div class="product-card" data-id="${p.id}" onclick="openModal('${p.id}')">
      <div class="prod-img-wrap">
        <div class="prod-img-bg">
          <img src="${mainImage}" alt="${p.name}" class="prod-real-img" loading="lazy">
        </div>
        ${badgeHtml}
        <button class="wishlist-btn" onclick="event.stopPropagation(); toggleWishlist('${p.id}', this)" style="position: absolute; top: 16px; right: 16px; background: rgba(0,0,0,0.5); border: none; color: white; border-radius: 50%; width: 32px; height: 32px; font-size: 16px; cursor: pointer; z-index: 5; transition: transform 0.2s, color 0.2s;">🤍</button>
        <div class="prod-overlay">
          <button class="overlay-btn" onclick="event.stopPropagation(); quickAdd('${p.id}')">Səbətə Əlavə Et</button>
        </div>
      </div>
      <div class="prod-info">
        <div class="prod-name">${p.name}</div>
        <div style="font-size:11px; color:var(--accent); opacity:0.7; margin-top:2px; font-family:var(--font-ui); font-weight:600;">${p.productCode || ''}</div>
        <div class="prod-meta">
          <div class="prod-price">${Number(p.price).toLocaleString()} AZN</div>
        </div>
      </div>
    </div>
  `;
}

function toggleWishlist(id, btn) {
  const isWished = btn.textContent === '💛';
  if (isWished) {
    btn.textContent = '🤍';
    showToast('Favorilərdən çıxarıldı');
  } else {
    btn.textContent = '💛';
    btn.style.color = 'var(--accent)';
    btn.style.transform = 'scale(1.2)';
    setTimeout(() => btn.style.transform = 'scale(1)', 200);
    showToast('Favorilərə əlavə edildi');
  }
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
      const targetContent = document.getElementById(tab.dataset.tab);
      if (targetContent) targetContent.classList.add('active');
      if (tab.dataset.tab === 'tab-notifications') {
        loadAdminNotifications();
      }
    });
  });
}

// ─── PRODUCT MODAL ───────────────────────────────────────────────
function initModal() {
  const mo = document.getElementById('modalOverlay');
  mo?.addEventListener('click', e => { if (e.target === mo) closeModal(); });
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeCart();
      closeUserDrawer();
      closeNotifications();
    }
  });
}

function openModal(id) {
  // Giriş yoxdursa, modalı açma, qeydiyyat drawer-ini aç
  if (!customerToken && !customerData) {
    openUserDrawer();
    showToast('Xahiş edirik, məhsula baxmaq üçün daxil olun.');
    return;
  }

  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  currentProduct = p;
  activeModalImgIdx = 0;

  const thumbs = (p.images || []).map((img, i) => `
    <div class="modal-thumb ${i===0?'active':''}" onclick="setModalImg(${i}, this)">
      <img src="${img}" alt="thumb">
    </div>
  `).join('');

  const sizesHTML = ['S', 'M', 'L', 'XL'].map(s => {
    const qty = p.stock ? Number(p.stock[s] || 0) : 0;
    const disabled = qty <= 0 ? 'disabled style="opacity:0.3; text-decoration:line-through;"' : '';
    return `<label ${disabled}><input type="radio" name="prodSize" value="${s}" ${disabled}> ${s}</label>`;
  }).join(' ');

  const totalStock = p.stock ? Object.values(p.stock).reduce((a,b)=>Number(a)+Number(b),0) : 0;
  const stockInfo = totalStock > 0 ? `<span style="color:#25D366; font-weight:bold;">Stokda var (${totalStock} ədəd)</span>` : `<span style="color:red; font-weight:bold;">Tükənib</span>`;

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-body">
      <div class="modal-gallery">
        <div class="modal-main-img"><img id="mainModalImg" src="${p.images[0] || ''}"></div>
        <div class="modal-thumbs">${thumbs}</div>
      </div>
      <div class="modal-details">
        <div class="modal-tag">${stockInfo}</div>
        <h2 class="modal-title">${p.name}</h2>
        <div style="font-size:12px; color:var(--accent); font-weight:600; margin-bottom:10px;">Kod: ${p.productCode || '---'}</div>
        <div class="modal-price">${Number(p.price).toLocaleString()} AZN</div>
        <div class="modal-section-label">Açıqlama</div>
        <p class="modal-desc">${p.desc || 'Bu məhsul üçün hələ təsvir daxil edilməyib.'}</p>
        <div class="size-selection" style="margin-top:15px; display:flex; gap:10px; font-weight:bold;">Bədən: ${sizesHTML}</div>
        <div style="display:flex; gap:10px; margin-top:20px;">
          <button class="modal-add-btn" onclick="addFromModal()" ${totalStock<=0?'disabled':''} style="flex:1;">Səbətə Əlavə Et</button>
          <button class="modal-add-btn" onclick="orderSingleViaWhatsApp()" style="flex:1; background:#25D366; border-color:#25D366; color:white;">📱 WhatsApp ilə Al</button>
        </div>
        <button class="btn-ghost" style="width:100%; border:1px solid var(--border); padding:10px; border-radius:6px; color:var(--text-dim); margin-top:15px; cursor:pointer;" onclick="openSizeGuide()">📏 Bədən Ölçüsü Kılavuzu</button>
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
  area.innerHTML = '<i style="color:#888;">Rəylər yüklənir...</i>';
  try {
    const reviews = await API.get('/api/reviews/' + productId);
    renderReviews(productId, reviews);
  } catch(e) {
    area.innerHTML = '<span style="color:#ff4d4d">Rəylər yüklənərkən xəta baş verdi.</span>';
  }
}

function renderReviews(productId, reviews) {
  const area = document.getElementById('productReviewsArea');
  if(!area) return;

  let html = `<h3 style="margin-bottom:10px;">Məhsul Rəyləri (${reviews.length})</h3>`;
  
  if (customerToken && customerData) {
    html += `
      <div class="review-form">
        <h4 style="margin-bottom:10px; font-size:14px;">Məhsulu Qiymətləndirin</h4>
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
          <textarea id="reviewComment" rows="3" placeholder="Məhsul haqqında fikirləriniz..." style="width:100%; border-radius:6px; padding:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.3); color:white; margin-bottom:10px; font-family:inherit;" required></textarea>
          <input type="file" id="reviewImage" accept="image/*" style="width:100%; margin-bottom:10px; padding:8px; background:rgba(255,255,255,0.05); border-radius:6px; border:1px solid rgba(255,255,255,0.1); color:white; font-size:12px;">
          <button type="submit" class="btn-primary" style="padding: 8px 15px; font-size:12px; cursor:pointer;">Gönder</button>
        </form>
      </div>
    `;
  }

  if (reviews.length === 0) {
    html += `<p style="font-size:13px; color:#888; margin-top:15px; text-align:center;">Bu məhsul üçün hələ heç bir rəy yazılmayıb.</p>`;
  } else {
    let listHtml = reviews.map(r => {
       const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
       const dateStr = new Date(r.timeMs).toLocaleDateString('az-AZ');
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
            ${r.imageUrl ? `<div style="margin-top:10px;"><img src="${r.imageUrl}" style="max-height:120px; border-radius:8px; object-fit:contain; background:rgba(0,0,0,0.5);"></div>` : ''}
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
  const imageInput = form.querySelector('#reviewImage');

  if(!ratingInput) return showToast('Zəhmət olmasa ulduz seçin.');
  
  const btn = form.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Göndərilir...';

  try {
    const formData = new FormData();
    formData.append('productId', productId);
    formData.append('rating', ratingInput.value);
    formData.append('comment', comment);
    formData.append('userName', customerData.name);
    formData.append('userPhoto', customerData.photoURL || '');
    if (imageInput && imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }

    await API.authAction('/api/reviews', 'POST', formData, true);
    showToast('Rəyiniz uğurla əlavə edildi!');
    fetchAndRenderReviews(productId);
  } catch(err) {
    showToast('Xəta: ' + err.message);
  } finally {
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

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function closeUserDrawer() {
  document.getElementById('userDrawer')?.classList.remove('open');
  document.getElementById('userOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ─── CART & WHATSAPP ORDERS ──────────────────────────────────────
function initCart() {
  document.getElementById('cartBtn')?.addEventListener('click', () => {
    if (!customerToken && !customerData) {
      openUserDrawer();
      showToast('Zəhmət olmasa səbətə baxmaq üçün daxil olun.');
      return;
    }
    openCart();
  });
  document.getElementById('cartClose')?.addEventListener('click', closeCart);
  document.getElementById('cartOverlay')?.addEventListener('click', closeCart);
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').add('open');
  document.body.style.overflow = 'hidden';
  renderCart();
}

function addToCart(p, size='M', qty=1) {
  if (!customerToken && !customerData) {
    openUserDrawer();
    showToast('Məhsul əlavə etmək üçün daxil olmalısınız.');
    return;
  }
  const existing = cart.find(i => i.id === p.id && i.size === size);
  if (existing) existing.qty += qty;
  else cart.push({ id:p.id, name:p.name, price:p.price, qty, image:p.images[0], size:size });
  saveCart(); updateCartUI(); showToast(`"${p.name}" səbətə əlavə edildi!`);
}

function quickAdd(id) {
  const p = allProducts.find(x => x.id === id);
  if (p) {
    const availableSizes = ['S', 'M', 'L', 'XL'].filter(s => p.stock && p.stock[s] > 0);
    if(availableSizes.length > 0) addToCart(p, availableSizes[0]);
    else showToast('Məhsul anbarda yoxdur.');
  }
}

function addFromModal() {
  if (!currentProduct) return;
  const sizeInput = document.querySelector('input[name="prodSize"]:checked');
  const size = sizeInput ? sizeInput.value : 'M';
  addToCart(currentProduct, size);
  closeModal();
}

function removeFromCart(idx) {
  cart.splice(idx, 1); saveCart(); updateCartUI(); renderCart();
}
function saveCart() { localStorage.setItem('drox_cart', JSON.stringify(cart)); }

function calculateCartTotals() {
  const subTotal = cart.reduce((s,i) => s + (i.price * i.qty), 0);
  const itemsCount = cart.reduce((s,i) => s + i.qty, 0);
  return { subTotal, itemsCount, finalTotal: subTotal };
}

function updateCartUI() {
  const calc = calculateCartTotals();
  document.getElementById('cartCount').textContent = calc.itemsCount;
  const el = document.getElementById('cartItemCount'); if(el) el.textContent = calc.itemsCount;
  const tEl = document.getElementById('cartTotal'); 
  if(tEl) tEl.textContent = calc.subTotal.toLocaleString() + ' AZN';
}

function renderCart() {
  const el = document.getElementById('cartItems');
  if (cart.length === 0) { el.innerHTML = '<div class="cart-empty" style="text-align:center; padding:45px 0; color:#888;"><p>Səbətiniz boşdur</p></div>'; return; }
  el.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-img"><img src="${item.image || ''}"></div>
      <div class="cart-item-info"><strong>${item.name}</strong><span>Bədən: ${item.size} | ${Number(item.price).toLocaleString()} AZN x ${item.qty}</span></div>
      <button class="cart-item-remove" onclick="removeFromCart(${idx})">✕</button>
    </div>
  `).join('');
}

// WhatsApp Order Logic
function orderViaWhatsApp() {
  if (cart.length === 0) return showToast('Səbətiniz boşdur!');
  
  const num = globalSettings.whatsappNumber || '994553229166';
  let message = 'Salam! DroxStore saytından bu məhsulları sifariş etmək istəyirəm:\n\n';
  let total = 0;

  cart.forEach((item, idx) => {
    const orig = allProducts.find(p => p.id === item.id);
    const code = orig ? orig.productCode : '---';
    message += `${idx + 1}. [Kod: ${code}] ${item.name} - Bədən: ${item.size} - Say: ${item.qty} - Qiymət: ${item.price} AZN\n`;
    total += item.price * item.qty;
  });

  message += `\n💰 Ümumi məbləğ: ${total} AZN`;
  if (customerData) {
    message += `\n👤 Müştəri: ${customerData.name} (${customerData.email})`;
  }

  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${num}?text=${encoded}`, '_blank');
  
  // Səbəti təmizlə
  cart = [];
  saveCart();
  updateCartUI();
  closeCart();
  showToast('WhatsApp-a yönləndirilirsiniz...');
}

function orderSingleViaWhatsApp() {
  if (!currentProduct) return;
  const sizeInput = document.querySelector('input[name="prodSize"]:checked');
  const size = sizeInput ? sizeInput.value : 'M';
  const num = globalSettings.whatsappNumber || '994553229166';
  
  let message = 'Salam! DroxStore saytından bu məhsulu almaq istəyirəm:\n\n';
  message += `📦 Məhsul: ${currentProduct.name}\n`;
  message += `📌 Kod: ${currentProduct.productCode || '---'}\n`;
  message += `📏 Seçilən Bədən: ${size}\n`;
  message += `💰 Qiymət: ${currentProduct.price} AZN`;
  
  if (customerData) {
    message += `\n\n👤 Alıcı: ${customerData.name}`;
  }

  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${num}?text=${encoded}`, '_blank');
  closeModal();
  showToast('WhatsApp-a yönləndirilirsiniz...');
}

// ─── BİLDİRİŞLƏR SİSTEMİ (FRONTEND) ──────────────────────────────
async function loadNotifications() {
  try {
    allNotifications = await API.get('/api/notifications');
    updateNotifBadge();
  } catch(e) { console.warn('Bildirişlər yüklənə bilmədi', e); }
}

function updateNotifBadge() {
  const count = allNotifications.filter(n => {
    const ts = n.createdAt?._seconds ? n.createdAt._seconds * 1000 : 0;
    return ts > lastSeenNotifTime;
  }).length;
  const badge = document.getElementById('notifCount');
  if (badge) {
    if (count > 0) { badge.style.display = 'flex'; badge.textContent = count; }
    else { badge.style.display = 'none'; }
  }
}

function openNotifications() {
  if (!customerToken && !customerData) {
    openUserDrawer();
    showToast('Xahiş edirik, bildirişləri görmək üçün daxil olun.');
    return;
  }
  document.getElementById('notifDrawer')?.classList.add('open');
  document.getElementById('notifOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  
  lastSeenNotifTime = Date.now();
  localStorage.setItem('drox_last_notif', lastSeenNotifTime.toString());
  updateNotifBadge();
  renderNotifications();
}

function closeNotifications() {
  document.getElementById('notifDrawer')?.classList.remove('open');
  document.getElementById('notifOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

function renderNotifications() {
  const list = document.getElementById('notifList');
  if (!list) return;
  if (allNotifications.length === 0) {
    list.innerHTML = '<p style="color:#888; text-align:center; padding:40px 0;">Hələ heç bir bildiriş yoxdur.</p>';
    return;
  }
  list.innerHTML = allNotifications.map(n => {
    const icon = n.type === 'new_product' ? '🆕' : n.type === 'discount' ? '🏷️' : '📢';
    return `
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:15px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong style="color:var(--accent);">${icon} ${n.title}</strong>
        </div>
        <p style="font-size:13px; color:#ccc; margin:0; line-height:1.5;">${n.message}</p>
      </div>
    `;
  }).join('');
}

async function sendAdminNotification() {
  const title = document.getElementById('notifTitle')?.value.trim();
  const message = document.getElementById('notifMessage')?.value.trim();
  const type = document.getElementById('notifType')?.value || 'announcement';
  if (!title || !message) return showToast('Xahiş edirik, başlıq və mesaj daxil edin!');
  try {
    await API.authAction('/api/notifications', 'POST', { title, message, type });
    showToast('Bildiriş göndərildi! ✅');
    document.getElementById('notifTitle').value = '';
    document.getElementById('notifMessage').value = '';
    await loadNotifications();
    loadAdminNotifications();
  } catch(err) { showToast('Xəta: ' + err.message); }
}

async function loadAdminNotifications() {
  const list = document.getElementById('adminNotifList');
  if (!list) return;
  if (allNotifications.length === 0) { list.innerHTML = '<p style="color:#888;">Bildiriş tapılmadı.</p>'; return; }
  list.innerHTML = allNotifications.map(n => {
    const icon = n.type === 'new_product' ? '🆕' : n.type === 'discount' ? '🏷️' : '📢';
    return `
      <div class="order-card">
        <div class="order-header">
          <span>${icon} ${n.title}</span>
          <button class="admin-delete-btn" onclick="deleteNotification('${n.id}')">Sil</button>
        </div>
        <div class="order-items">${n.message}</div>
      </div>
    `;
  }).join('');
}

async function deleteNotification(id) {
  if (!confirm('Bu bildirişi silmək istəyirsiniz?')) return;
  try {
    await API.authAction('/api/notifications/' + id, 'DELETE');
    showToast('Bildiriş silindi');
    await loadNotifications();
    loadAdminNotifications();
  } catch(err) { showToast(err.message); }
}

// ─── CUSTOMER AUTH & UI ──────────────────────────────────────────
function openUserDrawer() {
  document.getElementById('userDrawer')?.classList.add('open');
  document.getElementById('userOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  refreshUserUI();
}

function switchUserTab(tab) {
  const l = document.getElementById('userLoginForm');
  const r = document.getElementById('userRegForm');
  const f = document.getElementById('userForgotForm');
  const tl = document.getElementById('tabLogin');
  const tr = document.getElementById('tabRegister');
  
  if(l) l.style.display = 'none';
  if(r) r.style.display = 'none';
  if(f) f.style.display = 'none';
  
  tl?.classList.remove('active');
  tr?.classList.remove('active');

  if(tab === 'login') {
    if(l) l.style.display = 'flex';
    tl?.classList.add('active');
  } else if (tab === 'register') {
    if(r) r.style.display = 'flex';
    tr?.classList.add('active');
  } else if (tab === 'forgot') {
    if(f) f.style.display = 'flex';
  }
}

function refreshUserUI() {
  if (customerToken && customerData) {
    document.getElementById('userLoggedOut').style.display = 'none';
    document.getElementById('userLoggedIn').style.display = 'block';
    document.getElementById('loggedUserName').textContent = customerData.name.split(' ')[0] || customerData.name;
    
    const emailEl = document.getElementById('loggedUserEmail');
    if (emailEl) {
      if (customerData.email && customerData.email.includes('@droxstore.guest')) {
        emailEl.textContent = 'E-poçt: (Doldurulmayıb)';
      } else {
        emailEl.textContent = customerData.email || 'Profilinizə xoş gəldiniz';
      }
    }
    
    if (customerData.photoURL) {
      document.getElementById('userAvatarContainer').style.display = 'block';
      document.getElementById('userAvatar').src = customerData.photoURL;
    } else {
      document.getElementById('userAvatarContainer').style.display = 'none';
    }
  } else {
    document.getElementById('userLoggedOut').style.display = 'block';
    document.getElementById('userLoggedIn').style.display = 'none';
    switchUserTab('login');
  }
}

async function syncFirebaseUserWithBackend(user, nameStr) {
  try {
    const token = await user.getIdToken(true);
    customerToken = token;
    
    const data = await API.authAction('/api/customers/sync', 'POST', {
      email: user.email,
      name: nameStr || user.displayName || 'İsimsiz Üye',
      photoURL: user.photoURL || null
    });

    if (data && data.user) {
      customerData = data.user;
      localStorage.setItem('drox_cust_token', customerToken);
      localStorage.setItem('drox_cust_data', JSON.stringify(customerData));
      refreshUserUI();
    }
  } catch (err) {
    console.error('Sync Error:', err);
    localStorage.setItem('drox_cust_token', customerToken);
    refreshUserUI();
  }
}

async function handleGoogleLogin() {
  const btn = document.getElementById('btnGoogleLogin');
  if(!btn) return;
  btn.disabled = true; 
  btn.style.opacity = '0.6';
  
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await firebase.auth().signInWithPopup(provider);
    if (result && result.user) {
      await syncFirebaseUserWithBackend(result.user, result.user.displayName);
      showToast(`Xoş gəldiniz, ${result.user.displayName}! 🎉`);
      refreshUserUI();
      closeUserDrawer();
    }
  } catch (err) {
    console.error('Google Auth Error:', err);
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      showToast('Yönləndirilirsiniz, zəhmət olmasa gözləyin...');
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await firebase.auth().signInWithRedirect(provider);
      } catch (redirErr) {
        showToast('Yönləndirmə xətası: ' + redirErr.message);
      }
    } else if (err.code === 'auth/unauthorized-domain') {
      showToast('Bu domen Firebase konsolunda təsdiqlənməyib. Qeydiyyatsız girişdən istifadə edə bilərsiniz.');
    } else {
      showToast('Giriş xətası: ' + err.message);
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}

async function handleUserRegister(e) {
  e.preventDefault();
  const name = document.getElementById('rName').value;
  
  // Create a fake guest email & password for Firebase Auth
  const email = `guest_${Date.now()}@droxstore.guest`;
  const password = `guest_${Date.now()}_pwd`;
  
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Qeydiyyat edilir...';
  try {
    const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
    await result.user.updateProfile({ displayName: name });
    
    // Auto-login instantly after registration
    await syncFirebaseUserWithBackend(result.user, name);
    showToast('Qeydiyyat uğurludur və giriş edildi! 🎉');
    closeUserDrawer();
    
    document.getElementById('rName').value = '';
  } catch(err) {
    let errMsg = err.message;
    if (err.code === 'auth/email-already-in-use') errMsg = 'Bu e-poçt ilə artıq hesab mövcuddur.';
    else if (err.code === 'auth/invalid-email') errMsg = 'E-poçt ünvanı düzgün deyil.';
    else if (err.code === 'auth/weak-password') errMsg = 'Şifrə çox zəifdir (ən azı 6 simvol olmalıdır).';
    showToast('Qeydiyyat xətası: ' + errMsg);
  } finally {
    btn.disabled = false; btn.textContent = 'Hesab Yarat';
  }
}

function checkPwdStrength(val) {
  const bar = document.getElementById('pwdBar');
  if(!bar) return;
  let score = 0;
  if(val.length > 5) score++;
  if(/[A-Z]/.test(val)) score++;
  if(/[0-9]/.test(val)) score++;
  
  if(score === 0) { bar.style.width = '0%'; }
  else if(score === 1) { bar.style.width = '33%'; bar.style.backgroundColor = 'red'; }
  else if(score === 2) { bar.style.width = '66%'; bar.style.backgroundColor = 'orange'; }
  else if(score >= 3) { bar.style.width = '100%'; bar.style.backgroundColor = '#25D366'; }
}

async function handleUserLogin(e) {
  e.preventDefault();
  const email = document.getElementById('lEmail').value;
  const password = document.getElementById('lPass').value;
  
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Giriş edilir...';
  try {
    const result = await firebase.auth().signInWithEmailAndPassword(email, password);
    
    await syncFirebaseUserWithBackend(result.user, result.user.displayName);
    showToast('Uğurla giriş etdiniz! 🎉');
    closeUserDrawer();
  } catch(err) {
    let errMsg = err.message;
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
      errMsg = 'E-poçt və ya şifrə yanlışdır.';
    } else if (err.code === 'auth/invalid-email') {
      errMsg = 'E-poçt ünvanı düzgün deyil.';
    }
    showToast('Giriş xətası: ' + errMsg);
  } finally {
    btn.disabled = false; btn.textContent = 'Giriş Yap';
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('fEmail').value;
  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = 'Göndərilir...';
  try {
    await firebase.auth().sendPasswordResetEmail(email);
    showToast('Şifrə sıfırlama linki e-poçtunuza göndərildi! Poçtunuzu yoxlayın.');
    document.getElementById('fEmail').value = '';
    switchUserTab('login');
  } catch(err) {
    showToast('Xəta: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Sıfırlama Linki Göndər';
  }
}

function handleUserLogout() {
  firebase.auth().signOut().then(() => {
    customerToken = null; customerData = null;
    localStorage.removeItem('drox_cust_token');
    localStorage.removeItem('drox_cust_data');
    refreshUserUI();
    showToast('Uğurla çıxış etdiniz.');
  });
}

function quickLocalLogin() {
  const name = prompt('Zəhmət olmasa adınızı daxil edin:');
  if (!name || !name.trim()) return showToast('Ad boş ola bilməz.');
  
  customerData = {
    uid: 'guest_' + Date.now(),
    name: name.trim(),
    email: 'guest_' + Date.now() + '@droxstore.com',
    photoURL: null,
    address: {}
  };
  customerToken = 'guest_token_' + Date.now();
  
  localStorage.setItem('drox_cust_token', customerToken);
  localStorage.setItem('drox_cust_data', JSON.stringify(customerData));
  
  showToast(`Xoş gəldiniz, ${customerData.name}! 🎉`);
  refreshUserUI();
  closeUserDrawer();
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
    showToast('Admin girişi uğurludur! 🔓');
    await refreshAllData();
    openAdminPanel();
  } catch (err) {
    const errEl = document.getElementById('adminLoginError');
    if(errEl) { errEl.textContent = 'İstifadəçi adı və ya şifrə yanlışdır.'; errEl.style.display = 'block'; }
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
  closeAdminPanel(); showToast('Çıxış edildi');
}
function openAdminLogin() {
  if (adminToken) return openAdminPanel();
  document.getElementById('adminLoginOverlay').classList.add('open');
}
function closeAdminLogin() {
  document.getElementById('adminLoginOverlay')?.classList.remove('open');
}

// ─── ADMIN: DASHBOARD ────────────────────────────────────────────
async function refreshAdminPanel() {
  try {
    if(!adminToken) return;
    const stats = await API.authAction('/api/stats', 'GET');
    const statTotal = document.getElementById('statTotal');
    const statUsers = document.getElementById('statUsers');
    if(statTotal) statTotal.textContent = stats.totalProducts;
    if(statUsers) statUsers.textContent = stats.totalUsers || 0;
    
    // Product List
    const pList = document.getElementById('adminProductList');
    pList.innerHTML = allProducts.map(p => {
      const stockTxt = p.stock ? `S:${p.stock.S||0} M:${p.stock.M||0} L:${p.stock.L||0} XL:${p.stock.XL||0}` : 'Stok yoxdur';
      return `
      <div class="admin-product-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid rgba(255,255,255,0.05);">
        <div class="admin-product-thumb" style="width:40px; height:40px; border-radius:6px; overflow:hidden;"><img src="${p.images?.[0] || ''}" style="width:100%; height:100%; object-fit:cover;"></div>
        <div class="admin-product-details" style="flex:1; margin-left:15px;">
          <strong>[${p.productCode || 'DRX-X'}] ${p.name}</strong><br>
          <span style="font-size:11px; color:#888;">${p.category} · ${p.price} AZN | Anbar: ${stockTxt}</span>
        </div>
        <div class="admin-product-actions" style="display:flex; gap:5px;">
          <button class="admin-delete-btn" style="border-color:#6366f1; color:#6366f1;" onclick="openEditProduct('${p.id}')">Düzenle</button>
          <button class="admin-delete-btn" onclick="deleteProduct('${p.id}')">Sil</button>
        </div>
      </div>
      `;
    }).join('');

    // Discounts List
    const dList = document.getElementById('adminDiscountList');
    if(dList) {
      if(allDiscounts.length === 0) dList.innerHTML = "Aktiv endirim kodu yoxdur.";
      else dList.innerHTML = allDiscounts.map(d => {
        const untilTxt = d.validUntil ? new Date(d.validUntil).toLocaleDateString('az-AZ') + ' Bitiş' : 'Sınırsız';
        return `
        <div class="cat-item">
          <span><strong>${d.code}</strong> - %${d.percent} (${untilTxt})</span>
          <button onclick="deleteDiscount('${d.id}')">Sil</button>
        </div>
      `}).join('');
    }

    // Customers List
    const cList = document.getElementById('adminCustomersList');
    if (cList) {
      try {
        const customers = await API.authAction('/api/admin/customers', 'GET');
        if (customers.length === 0) {
          cList.innerHTML = '<p style="color:#888;">Heç bir müştəri tapılmadı.</p>';
        } else {
          cList.innerHTML = customers.map(c => {
            const dateStr = c.createdAt?._seconds ? new Date(c.createdAt._seconds * 1000).toLocaleDateString('az-AZ') : 'Tarix yoxdur';
            return `
              <div class="order-card" style="margin-bottom:10px;">
                <div class="order-header">
                  <span>${c.name}</span>
                  <span style="color:#888; font-size:12px;">Qeydiyyat: ${dateStr}</span>
                </div>
                <div class="order-items">📧 ${c.email}</div>
              </div>
            `;
          }).join('');
        }
      } catch (err) {
        cList.innerHTML = '<p style="color:red;">Müştəriləri yükləmək mümkün olmadı.</p>';
      }
    }

    // System Settings Populate
    if(document.getElementById('set_whatsappNumber')) {
      document.getElementById('set_whatsappNumber').value = globalSettings.whatsappNumber || '994553229166';
      document.getElementById('set_vipThreshold').value = globalSettings.vipThreshold || 500;
    }

  } catch (err) { console.error('Admin panel hatası:', err); }
}

// ─── ADMIN: ADD PRODUCT ──────────────────────────────────────────
function handleMultiImageUpload(event) {
  const files = Array.from(event.target.files);
  if (files.length > 5) return showToast('Ən çox 5 şəkil seçə bilərsiniz!');
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
  handleMultiImageUpload({target: {files: selectedFiles}});
}

async function handleAddProduct(e) {
  e.preventDefault();
  if (selectedFiles.length === 0) return showToast('Ən azı 1 şəkil seçin!');

  const btn = e.target.querySelector('.admin-submit-btn');
  btn.disabled = true; btn.textContent = 'Yüklənir (Cloudinary)...';

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
    showToast('Məhsul uğurla əlavə edildi! ✅');
    
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
  if (!confirm('Bu məhsulu silmək istədiyinizdən əminsiniz?')) return;
  try {
    await API.authAction(`/api/products/${id}`, 'DELETE');
    showToast('Məhsul silindi');
    await refreshAllData();
  } catch (err) { showToast(err.message); }
}

function openEditProduct(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return showToast('Məhsul tapılmadı');
  
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
  
  if (!name || !category || isNaN(price)) return showToast('Bütün vacib xanaları doldurun.');
  
  try {
    await API.authAction(`/api/products/${id}`, 'PUT', { name, category, price, desc, stock });
    showToast('Məhsul uğurla yeniləndi! ✅');
    closeEditProduct();
    await refreshAllData();
  } catch(err) {
    showToast('Yeniləmə xətası: ' + err.message);
  }
}

async function addNewCategory() {
  const name = document.getElementById('newCatName').value.trim();
  if (!name) return;
  try {
    await API.authAction('/api/categories', 'POST', { name });
    document.getElementById('newCatName').value = '';
    showToast('Kateqoriya əlavə edildi');
    await refreshAllData();
  } catch (err) { showToast(err.message); }
}
async function deleteCategory(id) {
  if (!confirm('Bu kateqoriyanı silmək istəyirsiniz?')) return;
  try {
    await API.authAction(`/api/categories/${id}`, 'DELETE');
    showToast('Kateqoriya silindi');
    await refreshAllData();
  } catch (err) { showToast(err.message); }
}

async function addNewDiscount() {
  const code = document.getElementById('newDiscountCode').value.trim();
  const percent = document.getElementById('newDiscountPercent').value;
  const validDays = document.getElementById('newDiscountDays').value;
  if(!code || !percent) return showToast('Kod və faizi daxil edin');
  try {
    await API.authAction('/api/discounts', 'POST', { code, percent, validDays });
    document.getElementById('newDiscountCode').value = '';
    document.getElementById('newDiscountPercent').value = '';
    document.getElementById('newDiscountDays').value = '';
    showToast('Endirim kodu uğurla əlavə edildi!');
    await refreshAllData();
  } catch(err) {
    showToast(err.message);
  }
}

async function saveSystemSettings() {
  const whatsappNumber = document.getElementById('set_whatsappNumber').value.trim();
  const vipThreshold = parseFloat(document.getElementById('set_vipThreshold').value);
  
  if (!whatsappNumber || isNaN(vipThreshold)) {
    return showToast('Xahiş edirik, ayarları düzgün daxil edin.');
  }
  
  try {
    const payload = { whatsappNumber, vipThreshold };
    await API.authAction('/api/settings', 'POST', payload);
    showToast('Sistem ayarları uğurla yadda saxlanıldı! 🚀');
    await refreshAllData();
  } catch(err) {
    showToast('Ayarlar yadda saxlanılmadı: ' + err.message);
  }
}

async function deleteDiscount(id) {
  if(!confirm('Bu endirim kodunu silmək istəyirsiniz?')) return;
  try {
    await API.authAction(`/api/discounts/${id}`, 'DELETE');
    showToast('Endirim kodu silindi.');
    await refreshAllData();
  } catch(err) {
    showToast(err.message);
  }
}

function openPromotions() {
  document.getElementById('promotionsOverlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closePromotions() {
  document.getElementById('promotionsOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

// ─── UTILS ───────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (t) {
    t.textContent = msg; 
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }
}
function openLookbook() { 
  document.getElementById('lookbookOverlay')?.classList.add('open'); 
  document.body.style.overflow='hidden'; 
}
function closeLookbook() { 
  document.getElementById('lookbookOverlay')?.classList.remove('open'); 
  document.body.style.overflow=''; 
}

// --- AI SUPPORT SYSTEM ---
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
    
    if (lower.includes('salam') || lower.includes('merhaba') || lower.includes('hey')) {
      aiMsg.innerText = 'Salam! DroxStore premium dəstək asistanıdır. Ölçü, çatdırılma, qaytarma və ya digər mövzularda necə kömək edə bilərəm?';
    } else if (lower.includes('kargo') || lower.includes('çatdırılma') || lower.includes('ne vaxt')) {
      aiMsg.innerText = 'Çatdırılma 1-2 iş günü ərzində sürətli kuryer və ya poçt vasitəsilə həyata keçirilir.';
    } else if (lower.includes('qaytar') || lower.includes('dəyiş') || lower.includes('iade')) {
      aiMsg.innerText = 'DROX STORE-dan aldığınız bütün məhsulları 45 gün ərzində asanlıqla dəyişdirə bilərsiniz. Məhsulun yuyulmamış və etiketinin üzərində olması lazımdır.';
    } else if (lower.includes('beden') || lower.includes('olcu') || lower.includes('dar') || lower.includes('bol')) {
      aiMsg.innerText = 'Kalıplarımız standartdır (Regular Fit). Əgər oversize olmasını istəyirsinizsə, bir bədən böyük sifariş etməyi məsləhət görürük.';
    } else if (lower.includes('təşəkkür') || lower.includes('sag ol') || lower.includes('çox sağol')) {
      aiMsg.innerText = 'Xoşdur! Hər zaman kömək etməyə hazıram, xoş alış-verişlər!';
    } else {
      aiMsg.innerText = 'Bu suala tam cavab verə bilmədim. İstəsəniz, aşağıdakı "Canlı Dəstək / Menecerə Bağlan" düyməsinə klikləyərək adminlə əlaqə yarada bilərsiniz.';
    }
    
    chatBox.appendChild(aiMsg);
    chatBox.scrollTop = chatBox.scrollHeight;
  }, 1000);
}

function escalateToAdmin() {
  const chatBox = document.getElementById('aiChatBox');
  const userText = prompt('Destək sorğunuzu qısaca daxil edin:', 'Sifariş haqqında sualım var');
  if(!userText) return;
  
  fetch('/api/support/ticket', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue: userText, user: customerData ? customerData.email : 'Qonaq İstifadəçi' })
  }).catch(e => console.log(e));

  const sysMsg = document.createElement('div');
  sysMsg.style.cssText = 'background: rgba(255,100,100,0.2); padding:8px; border-radius:8px; align-self:center; width:90%; text-align:center; font-size:11px; margin-top:5px;';
  sysMsg.innerText = '✅ Dəstək sorğunuz adminə göndərildi. Ən qısa zamanda əlaqə saxlanacaq.';
  chatBox.appendChild(sysMsg);
  chatBox.scrollTop = chatBox.scrollHeight;
  showToast('Sorğu yaradıldı.', 'success');
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
      list.innerHTML = '<p style="color:#888; font-size:13px;">Aktiv dəstək sorğusu yoxdur.</p>';
      return;
    }
    
    tickets.forEach(t => {
      const el = document.createElement('div');
      el.className = 'order-card';
      el.innerHTML = `
        <div class="order-header">
          <span>İstifadəçi: ${t.user}</span>
          <button class="btn-ghost" style="font-size:10px; padding:2px 8px; border:1px solid var(--accent); color:var(--accent); border-radius:4px;" onclick="resolveTicket('${t.id}')">Həll Olundu İşarələ</button>
        </div>
        <div class="order-items">
          Sorun: ${t.issue}<br>
          Tarih: ${new Date(t.date).toLocaleString('az-AZ')}
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
    showToast('Sorğu həll edilmiş kimi qeyd olundu', 'success');
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
    <h2 style="font-family:var(--font-display); font-size:32px; color:var(--accent);">BƏDƏN ASİSTANI</h2>
    <p style="color:#888; font-size:13px; margin-bottom:20px;">Lütfən boy və çəkinizi daxil edin ki, ən uyğun ölçünü təyin edək.</p>
    <div class="checkout-fields">
      <input type="number" id="sgHeight" placeholder="Boy (cm) Örn: 180" class="sg-input">
      <input type="number" id="sgWeight" placeholder="Çəki (kg) Örn: 75" class="sg-input">
      <button class="btn-primary" onclick="calculateSize()" style="margin-top:10px;">Ölçünü tap</button>
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
    resultDiv.innerHTML = 'Düzgün dəyərlər daxil edin.';
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
  resultDiv.innerHTML = 'Məsləhət Görülən: <span style="color:#25D366;">' + size + '</span><div style="font-size:11px; color:#aaa; margin-top:10px;">(Regular Fit ölçüsü əsas götürülmüşdür. Oversize geyinmək istəyirsinizsə, bir bədən böyük seçə bilərsiniz.)</div>';
}

// ─── MOBİL DOKUNMA OPTİMİZASYONLARI ─────────────────────────────
(function initMobileTouch() {
  if ('ontouchstart' in window) {
    document.body.style.cursor = 'auto';
    const c = document.getElementById('cursor');
    const cf = document.getElementById('cursorFollower');
    if (c) c.style.display = 'none';
    if (cf) cf.style.display = 'none';
  }

  document.addEventListener('touchstart', function(e) {
    const card = e.target.closest('.product-card');
    if (card) {
      document.querySelectorAll('.product-card.touch-active').forEach(c => {
        if (c !== card) c.classList.remove('touch-active');
      });
    }
  }, { passive: true });

  let touchStartY = 0;
  document.addEventListener('touchstart', function(e) {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    const modal = document.getElementById('modalOverlay');
    const swipeDown = e.changedTouches[0].clientY - touchStartY > 80;

    if (swipeDown) {
      if (modal && modal.classList.contains('open')) closeModal();
    }
  }, { passive: true });

  document.querySelectorAll('input, textarea, select').forEach(el => {
    if (parseFloat(getComputedStyle(el).fontSize) < 16) {
      el.style.fontSize = '16px';
    }
  });
})();
