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
let selectedFiles = [];

// ─── API HELPERS ──────────────────────────────────────────────────
const API = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Yüklenemedi');
    return res.json();
  },
  async authAction(url, method, body = null, isFormData = false) {
    const headers = {};
    if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
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
  updateCartUI();
  await refreshAllData();
});

async function refreshAllData() {
  try {
    allCategories = await API.get('/api/categories');
    allProducts = await API.get('/api/products');
    
    renderCategories();
    renderProducts(currentFilter);
    renderTopDrops();

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
      </div>
    </div>
  `;
  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
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
  const count = cart.reduce((s,i) => s+i.qty, 0);
  document.getElementById('cartCount').textContent = count;
  const el = document.getElementById('cartItemCount'); if(el) el.textContent = count;
  const total = cart.reduce((s,i) => s+(i.price*i.qty), 0);
  const tEl = document.getElementById('cartTotal'); if(tEl) tEl.textContent = '₺'+total.toLocaleString('tr');
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
  document.getElementById('checkoutOverlay').classList.add('open');
}
function closeCheckout() {
  document.getElementById('checkoutOverlay').classList.remove('open');
}

async function submitCheckout(e) {
  e.preventDefault();
  const name = document.getElementById('chkName').value;
  const phone = document.getElementById('chkPhone').value;
  const address = document.getElementById('chkAddress').value;
  const total = cart.reduce((s,i) => s + (i.price * i.qty), 0);

  const btn = e.target.querySelector('button');
  btn.disabled = true; btn.textContent = "Gönderiliyor...";
  
  try {
    const res = await API.authAction('/api/orders', 'POST', {
      customerName: name, phone, address, items: cart, total
    });
    
    showToast('Sipariş başarıyla oluşturuldu! ✅');
    cart = []; saveCart(); updateCartUI();
    e.target.reset();
    closeCheckout();
    await refreshAllData(); // Stokları güncelle
  } catch(err) {
    showToast('Sipariş verilirken hata oluştu: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = "Siparişi Onayla";
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
    if(statTotal) statTotal.textContent = stats.totalProducts;
    
    // Product List
    const pList = document.getElementById('adminProductList');
    pList.innerHTML = allProducts.map(p => {
      const stockTxt = p.stock ? `S:${p.stock.S||0} M:${p.stock.M||0} L:${p.stock.L||0} XL:${p.stock.XL||0}` : 'Stok yok';
      return `
      <div class="admin-product-item">
        <div class="admin-product-thumb"><img src="${p.images?.[0] || ''}"></div>
        <div class="admin-product-details">
          <strong>${p.name} ${p.isFeatured ? '<span style="color:gold;">★</span>' : ''}</strong>
          <span style="font-size:11px;">${p.category} · ₺${p.price} | Stok: ${stockTxt}</span>
        </div>
        <div class="admin-product-actions">
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
          <div><strong>Müşteri:</strong> ${o.customerName} - ${o.phone}</div>
          <div style="margin-bottom:8px;"><strong>Adres:</strong> ${o.address}</div>
          <div class="order-items">
            ${o.items.map(i => `${i.qty}x ${i.name} (Beden: ${i.size})`).join('<br>')}
          </div>
          <button class="admin-delete-btn" style="margin-top:10px; width:100%; border-color:red;" onclick="deleteOrder('${o.id}')">Siparişi Arşivle / Sil</button>
        </div>
      `).join('');
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

// ─── UTILS ───────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
function openLookbook() { document.getElementById('lookbookOverlay').classList.add('open'); document.body.style.overflow='hidden'; }
function closeLookbook() { document.getElementById('lookbookOverlay').classList.remove('open'); document.body.style.overflow=''; }
