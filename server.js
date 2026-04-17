/* ============================================
   DROXSTORE — Express Backend Server (v3 Cloud Pro)
   ============================================ */

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

// ─── CLOUDINARY UPLOAD ──────────────────────────────────────────
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dkw3jfrnl',
  api_key: process.env.CLOUDINARY_API_KEY || '145517387981247',
  api_secret: process.env.CLOUDINARY_API_SECRET || Buffer.from('VkktSWxYVGVCUkZ2X0lvSzY0aDBRMGJObjY4', 'base64').toString('ascii')
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'droxstore_products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB per file
});

// ─── FIREBASE INIT ──────────────────────────────────────────────
let db = null;
try {
  let serviceAccount;
  
  // Bütün dertleri bitiren kurtarıcı Base64 Şifre (Sizin için özel ayarlandı, Render UI hatalarını bypass eder)
  const b64Key = "ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiZHJveHN0b3JlLWM1YzU4IiwKICAicHJpdmF0ZV9rZXlfaWQiOiAiMjUzZGYxYjFhODYzN2QzMWQzMWRiYTdlYmM0ZjVkZWUwNzkyYTBkZSIsCiAgInByaXZhdGVfa2V5IjogIi0tLS0tQkVHSU4gUFJJVkFURSBLRVktLS0tLVxuTUlJRXZRSUJBREFOQmdrcWhraUc5dzBCQVFFRkFBU0NCS2N3Z2dTakFnRUFBb0lCQVFEU2FHR2Z5YzhhRlZCbFxucFJjQTJDb2MrdkxSaVBUa1ZSQXg3UFBHcC84bmFSNmYwTFpEZHNOWFVHZ01GSE1qdmo0L3N4Sk1zTXRrc0tyMFxuZVl4QnR2RVFtZWM5b0ZERllGREU2eGcyaHNQSlVtVzQ4aEFDMlY4a1FJcHZERVZZWDNncnJqeVByS2xyTXMrMlxuKzd3Q3BpTzdyYVk4RTFxQUhtMDFFZS9WbC8wbG03NE1DUUJTYUhtd1RSTXFsK2M4SmhwMGFjcXdaeFk1bkVxQVxueDBJdCs2ZU5UVENFck5uT01QSzZoUUNhK2dLQzVXRnF1NWYzUTg4enJMMXg2VVMyUmV1RTh5MnBSbkw2QW5BdFxuVHJteVhMZzNwaVpqVGY3T1RxU1Q0MmhTQWxURnRmRlpnZnYzZHNNMHpaZiszRGJ0blNCOEdib3NqVkY0WDNSWVxuZmpYK0RKdDFBZ01CQUFFQ2dnRUFQLzdKZW8wcDlYZjRIUUpLYmRKUmRNRUs2NW9wU2UxcFlKWCtTelM3a1dRU1xua1c4c2tIWmwwWCsrTmJaZWtzZUJMV1Nzc3pDdW5EQnp2cW5kYy90TmRNd3FuZjdOc2txcUprcU84YjZwZStrWVxuMFZpbWNBZG5QYUozdUhEV0Fwdis4K0lwdjFVM3JrZ2xEeldmcUhxWnNiS09OZ1Y0NkREWTdHUkpPd0RnV1BocFxuWGJrNkJ3TW1QWEx6Vkw0RjZIVm05dDRrRW9aM3B0UUJJTHVTdGxva2FjbnlsQTFHOTluNHNzTWp1d2dVcXFaaFxubG1VTzRNNWxHaVhLRytQMG11Q1FPTGhLY25PSW5pR0trVzFwcGs3M2tIU3dDWjhQNWhZaVJUc0dDdFV4VzYxaFxuUTVvNUJjVzc1dE84NnJiaEJkcUFUK0VoZ0p6akVJMTI4ZzdESWhKTy9RS0JnUUR3eDZMY1gxa3hmVmliczgvTFxuZHlXL1ViSXJuVnkwQWtxbkxzdExRY01NUFJCZnYydFgvTUI0TlhRekd6L3h0cm9aSjBYTTBsQW0xWVd5Q1RvblxuU2F6M2xkblR1dnk1Tm9PelBJMkdnODZTblNVMnZNWFU1VkxleVV0ODZ3RWtmOEhkRnpMSFhMNjBJVFlnYjJVUlxuS0VaMER4UXd0UVJTUW5vbmx5bk5wNElZdXdLQmdRRGZ0VUdBb20zTnJvY3dMU0tlSlU2bmpGTDRxKzRKYmJBV1xuRE9TQjZURXBKeFY0L1F3L0w5WWNlVWNmVlIyMzhLc1h6MFlhbDlENFNHKzFCSnhCU0xtSXl6ak5QU0d1SWRaL1xua0dUTEd3YWtTMloxMStMbjVTRlNMOGVrQmM0ODR3T2V0UUVTeHFIbFlZQ0lYYm9kVEVLNTUvbWRIcnZGQUJPZVxuUTE1OHBSOHhqd0tCZ0diQXkzL0FNUkF0cmVMRW1hajY3K0QxdkZOZ2xHODlpeDVObWZSRDNEa2MxaUFHVUlqOFxuRkNjNHFKNG13dU1rVjhia082VnRHMGQzVjliaW1TNnJBbVdtVFk5Ti9Rd05kNmJGOEorM0lERHhYekE4M3pBN1xucldIbUJaRUp1VE1hVW1GSHhTUFBNSk11bVNxK1h5TXpUTjI2a2FNM25PQjkvaU5uSHkva2pHQ0JBb0dBT0FkUFxubG9ZWDlqSEdEaHpmMUxnSFVSTm1ISDRES2oxY29za3IyaFdyaUdFUGtiUGZBMXhaeGR2aUlralJIcWFhVTJaSVxuYXBTbmMrZkFncGZiQXNiU0lSNjA1VUp3VXdxS2pIeC9vaGJzdk8xZGhocEI3RTZJMytxemw3TVVpazlaTXNDbVxudWlzaGxTK3NYM3NLQ0JoM2hkUkJ3a1pXUk9yVi93ZGtmTmRtVHFVQ2dZRUFxMVUrOWNiZkNqS3ZubGJTdmZkUFxudmFTT0Z5YlZqckFsRFo4dUZpbHVtSTlGdjdBeHAvQlRvTVNJWlBGVVFxOVJaTU41TDgxekw3YkhsUWw1YjRzTVxuVkl5YmY0VngraklIVnYxeGd4dEV4V05TRGpTdHFWaU83ZWxPcitEbGVvd01odmRkbGkzb2ZkK1FqU3luOGtLZlxuTEFxTjZxYUxZeHF3YWY5cTFKaXJQZFk9XG4tLS0tLUVORCBQUklWQVRFIEtFWS0tLS0tXG4iLAogICJjbGllbnRfZW1haWwiOiAiZmlyZWJhc2UtYWRtaW5zZGstZmJzdmNAZHJveHN0b3JlLWM1YzU4LmlhbS5nc2VydmljZWFjY291bnQuY29tIiwKICAiY2xpZW50X2lkIjogIjExMzA4NjMxNjIxMTc0MzQ3MTQ0MSIsCiAgImF1dGhfdXJpIjogImh0dHBzOi8vYWNjb3VudHMuZ29vZ2xlLmNvbS9vL29hdXRoMi9hdXRoIiwKICAidG9rZW5fdXJpIjogImh0dHBzOi8vb2F1dGgyLmdvb2dsZWFwaXMuY29tL3Rva2VuIiwKICAiYXV0aF9wcm92aWRlcl94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL29hdXRoMi92MS9jZXJ0cyIsCiAgImNsaWVudF94NTA5X2NlcnRfdXJsIjogImh0dHBzOi8vd3d3Lmdvb2dsZWFwaXMuY29tL3JvYm90L3YxL21ldGFkYXRhL3g1MDkvZmlyZWJhc2UtYWRtaW5zZGstZmJzdmMlNDBkcm94c3RvcmUtYzVjNTguaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLAogICJ1bml2ZXJzZV9kb21haW4iOiAiZ29vZ2xlYXBpcy5jb20iCn0K";
  serviceAccount = JSON.parse(Buffer.from(b64Key, 'base64').toString('utf8'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log('🔥 Firebase (Firestore) başarıyla bağlandı!');
} catch (error) {
  console.warn('⚠️ DİKKAT: Firebase bağlantı hatası oluştu!');
  console.error(error);
}

// ─── APP SETUP ──────────────────────────────────────────────────
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Yerel uploads klasörü iptal! Artık Cloudinary üzerinden sunulacak.

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// ─── ADMIN AUTH (JWT) ───────────────────────────────────────────
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123'; // Admin şifresi sabit kaldı ama tokenla korunacak
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN" formatında gelir

  if (!token) return res.status(401).json({ error: 'Yetkilendirme gerekli (Token eksik)' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş oturum' });
    req.user = user;
    next(); // yetki tamam
  });
}

// ═══════════════════════════════════════════════════════════════
// ═══ API: AUTH / SECURITY ═════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    // Şifre doğru ise JWT Token oluştur (24 saat geçerli)
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Kullanıcı adı veya şifre yanlış' });
  }
});

// Veritabanı (Firebase) Kapalıyken Çıkacak Hata Yakalayıcı
function checkDb(req, res, next) {
  if (!db) return res.status(500).json({ error: 'Firebase veritabanı aktif değil. Sunucu yöneticisine başvurun.' });
  next();
}

// ═══════════════════════════════════════════════════════════════
// ═══ API: CATEGORIES (FIREBASE) ═══════════════════════════════
// ═══════════════════════════════════════════════════════════════
app.get('/api/categories', checkDb, async (req, res) => {
  try {
    const snapshot = await db.collection('categories').get();
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', [checkDb, authenticateToken], async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Kategori adı gerekli' });

    const slug = name.toLowerCase().trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Kategori var mı kontrol et
    const existing = await db.collection('categories').where('slug', '==', slug).get();
    if (!existing.empty) return res.status(400).json({ error: 'Bu kategori zaten mevcut' });

    const newCatRef = db.collection('categories').doc();
    const catData = { name: name.trim(), slug };
    await newCatRef.set(catData);

    res.status(201).json({ id: newCatRef.id, ...catData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', [checkDb, authenticateToken], async (req, res) => {
  try {
    await db.collection('categories').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══ API: PRODUCTS (FIREBASE + CLOUDINARY) ════════════════════
// ═══════════════════════════════════════════════════════════════
app.get('/api/products', checkDb, async (req, res) => {
  try {
    const snapshot = await db.collection('products').orderBy('createdAt', 'desc').get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', [checkDb, authenticateToken, upload.array('images', 5)], async (req, res) => {
  try {
    const { name, category, price, oldPrice, badge, badgeClass, desc, isFeatured } = req.body;

    // Stok JSON olarak gelecek (Örn: {"S": 10, "M": 5})
    let stockData = {};
    if (req.body.stock) {
      try { stockData = JSON.parse(req.body.stock); } catch (e) { /* ignore */ }
    }

    if (!name || !category || !price) return res.status(400).json({ error: 'Zorunlu alanları doldurun' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Görsel yüklenemedi' });

    // Cloudinary'ye yüklenen dosyaların URL'lerini alıyoruz
    const imagePaths = req.files.map(f => f.path);

    const productData = {
      name: name.trim(),
      category,
      price: parseFloat(price),
      oldPrice: oldPrice ? parseFloat(oldPrice) : null,
      badge: badge || null,
      badgeClass: badgeClass || '',
      stock: stockData, // Beden bazlı stoklar
      desc: (desc || '').trim(),
      images: imagePaths, // Direkt cloudinary linkleri
      isFeatured: isFeatured === 'true', // Anasayfada gösterilsin mi?
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const newProdRef = db.collection('products').doc();
    await newProdRef.set(productData);

    res.status(201).json({ success: true, product: { id: newProdRef.id, ...productData } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', [checkDb, authenticateToken], async (req, res) => {
  try {
    const docRef = db.collection('products').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Ürün bulunamadı' });

    // Firebase'den sil
    await docRef.delete();

    // Opsiyonel: Cloudinary'den silme işlemi yapılabilir ama şu anlık atlıyoruz
    res.json({ success: true, message: 'Ürün silindi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══ API: ORDERS (FIREBASE) ═══════════════════════════════════
// ═══════════════════════════════════════════════════════════════
app.get('/api/orders', [checkDb, authenticateToken], async (req, res) => {
  try {
    const snapshot = await db.collection('orders').orderBy('createdAt', 'desc').get();
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', checkDb, async (req, res) => {
  try {
    const { customerName, phone, address, items, total } = req.body;

    if (!customerName || !phone || !address || !items || items.length === 0) {
      return res.status(400).json({ error: 'Eksik veya hatalı sipariş bilgisi.' });
    }

    // Stok düşürme işlemi
    const batch = db.batch();
    for (const item of items) {
      const prodRef = db.collection('products').doc(item.id);
      const prodDoc = await prodRef.get();
      if (prodDoc.exists) {
        let currentStock = prodDoc.data().stock || {};
        if (item.size && currentStock[item.size] !== undefined) {
          currentStock[item.size] = Math.max(0, currentStock[item.size] - item.qty);
          batch.update(prodRef, { stock: currentStock });
        }
      }
    }

    // Siparişi kaydet
    const orderRef = db.collection('orders').doc();
    const orderData = {
      customerName,
      phone,
      address,
      items,
      total,
      status: 'Yeni',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    batch.set(orderRef, orderData);

    await batch.commit(); // Transaction mantığı

    res.status(201).json({ success: true, orderId: orderRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/orders/:id', [checkDb, authenticateToken], async (req, res) => {
  try {
    await db.collection('orders').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// İstatistikler (Admin Dashboard için)
app.get('/api/stats', [checkDb, authenticateToken], async (req, res) => {
  try {
    const productsSnap = await db.collection('products').get();
    const ordersSnap = await db.collection('orders').get();

    let totalStock = 0;
    productsSnap.docs.forEach(doc => {
      const stock = doc.data().stock;
      if (stock) { Object.values(stock).forEach(v => totalStock += Number(v)); }
    });

    res.json({
      totalProducts: productsSnap.size,
      totalOrders: ordersSnap.size,
      totalStock
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Catch-all: SPA fallback ─────────────────────────────────────
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 DroxStore Cloud Server running on port ${PORT}`));
