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
const PORT = process.env.PORT || 3000;

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

// Firebase Müşteri Doğrulama Middleware
async function authenticateFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Yetkilendirme gerekli' });
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch(err) {
    res.status(403).json({ error: 'Geçersiz müşteri oturumu' });
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ API: CUSTOMERS (SYNCHRONIZE & PROFILE) ═══════════════════
// ═══════════════════════════════════════════════════════════════
app.post('/api/customers/sync', [checkDb, authenticateFirebaseToken], async (req, res) => {
  try {
    const uid = req.user.uid;
    const { email, name, photoURL } = req.body;
    
    const docRef = db.collection('customers').doc(uid);
    const doc = await docRef.get();
    
    let finalPhotoURL = photoURL || null;
    let address = {};

    // Eğer Fotoğraf URL'si Google/Açık Link ve Cloudinary'de değilse Cloudinary'ye at:
    if (photoURL && typeof photoURL === 'string' && !photoURL.includes('cloudinary.com')) {
      try {
        const uploadRes = await cloudinary.uploader.upload(photoURL, {
          folder: 'droxstore_customers'
        });
        finalPhotoURL = uploadRes.secure_url;
      } catch(e) {
        console.warn("Cloudinary Upload Hatası:", e.message);
      }
    }

    if (!doc.exists) {
      await docRef.set({
        email: email || req.user.email,
        name: name || req.user.name || 'İsimsiz Üye',
        photoURL: finalPhotoURL,
        address: {},
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Zaten var, Sadece adresi ve mevcut fotoyu alalım (eğer boşsa güncelle)
      const existingData = doc.data();
      address = existingData.address || {};
      if (!existingData.photoURL && finalPhotoURL) {
        await docRef.update({ photoURL: finalPhotoURL, name: name || existingData.name });
      } else {
        finalPhotoURL = existingData.photoURL || finalPhotoURL;
      }
    }

    // VIP Sistem: Kullanıcının toplam sipariş tutarını hesapla
    let totalSpent = 0;
    const ordersSnap = await db.collection('orders').where('email', '==', email || req.user.email).get();
    ordersSnap.forEach(orderDoc => {
      totalSpent += parseFloat(orderDoc.data().total || 0);
    });

    res.json({ success: true, user: { uid, email: email || req.user.email, name, photoURL: finalPhotoURL, address, totalSpent } });
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.post('/api/customers/address', [checkDb, authenticateFirebaseToken], async (req, res) => {
  try {
    const uid = req.user.uid;
    const { address } = req.body;
    await db.collection('customers').doc(uid).update({ address });
    res.json({ success: true, address });
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

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

// Ürün Düzenleme (Admin)
app.put('/api/products/:id', [checkDb, authenticateToken], async (req, res) => {
  try {
    const docRef = db.collection('products').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Ürün bulunamadı' });

    const { name, category, price, desc, sizes, stock } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (category !== undefined) updateData.category = category;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (desc !== undefined) updateData.desc = desc.trim();
    if (sizes !== undefined) updateData.sizes = sizes;
    if (stock !== undefined) updateData.stock = stock;
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await docRef.update(updateData);
    res.json({ success: true, message: 'Ürün güncellendi' });
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
    const { customerName, phone, address, items, total, appliedDiscountInfo, email } = req.body;

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
      email: email || null,
      phone,
      address,
      items,
      total,
      appliedDiscountInfo: appliedDiscountInfo || '',
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
    const usersSnap = await db.collection('customers').get();

    let totalStock = 0;
    productsSnap.docs.forEach(doc => {
      const stock = doc.data().stock;
      if (stock) { Object.values(stock).forEach(v => totalStock += Number(v)); }
    });

    let totalSales = 0;
    let totalRevenue = 0;
    ordersSnap.docs.forEach(doc => {
      const order = doc.data();
      totalRevenue += parseFloat(order.total || 0);
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => totalSales += parseInt(item.qty || 1));
      }
    });

    res.json({
      totalProducts: productsSnap.size,
      totalOrders: ordersSnap.size,
      totalStock,
      totalUsers: usersSnap.size,
      totalSales,
      totalRevenue
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══ API: DISCOUNTS (FIREBASE) ════════════════════════════════
// ═══════════════════════════════════════════════════════════════
app.get('/api/discounts', checkDb, async (req, res) => {
  try {
    const snapshot = await db.collection('discounts').orderBy('createdAt', 'desc').get();
    const discounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(discounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/discounts', [checkDb, authenticateToken], async (req, res) => {
  try {
    const { code, percent, validDays } = req.body;
    if (!code || !percent) return res.status(400).json({ error: 'Kod ve İndirim Yüzdesi gerekli' });

    const codeUpper = code.toUpperCase().trim();
    
    // Check if code exists
    const existing = await db.collection('discounts').where('code', '==', codeUpper).get();
    if (!existing.empty) return res.status(400).json({ error: 'Bu indirim kodu zaten mevcut!' });

    // Expiry calculation
    let validUntil = null;
    if (validDays && parseInt(validDays) > 0) {
        validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + parseInt(validDays));
    }

    const newDiscRef = db.collection('discounts').doc();
    const discData = {
      code: codeUpper,
      percent: parseFloat(percent),
      validUntil: validUntil ? validUntil.toISOString() : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    await newDiscRef.set(discData);

    res.status(201).json({ id: newDiscRef.id, ...discData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/discounts/:id', [checkDb, authenticateToken], async (req, res) => {
  try {
    await db.collection('discounts').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══ API: SETTINGS (FIREBASE) ═════════════════════════════════
// ═══════════════════════════════════════════════════════════════
app.get('/api/settings', checkDb, async (req, res) => {
  try {
    const docRef = db.collection('settings').doc('general');
    const doc = await docRef.get();
    if (!doc.exists) {
      const defaults = { 
        vipThreshold: 20000, qtyDiscountTarget: 3, qtyDiscountPercent: 10, dateDiscountPercent: 8,
        printfulToken: '', usdToTlRate: 33.0, printfulMargin: 50
      };
      await docRef.set(defaults);
      return res.json(defaults);
    }
    res.json(doc.data());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', [checkDb, authenticateToken], async (req, res) => {
  try {
    const newSettings = req.body;
    await db.collection('settings').doc('general').set(newSettings, { merge: true });
    res.json({ success: true, settings: newSettings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══ API: PRINTFUL INTEGRATION ════════════════════════════════
// ═══════════════════════════════════════════════════════════════
app.post('/api/printful/sync', [checkDb, authenticateToken], async (req, res) => {
  try {
    const docRef = db.collection('settings').doc('general');
    const doc = await docRef.get();
    const st = doc.exists ? doc.data() : {};
    
    const pToken = st.printfulToken;
    const rate = parseFloat(st.usdToTlRate) || 33.0;
    const margin = parseFloat(st.printfulMargin) || 50;

    if (!pToken) {
      return res.status(400).json({ error: "Sistem Ayarlarından Printful Token eklemelisiniz." });
    }

    const headers = { 'Authorization': `Bearer ${pToken}` };
    const prRes = await fetch('https://api.printful.com/store/products', { headers });
    const prData = await prRes.json();
    
    if (prData.code !== 200) {
      return res.status(400).json({ error: "Printful API Hatası: " + (prData.error || prData.message || JSON.stringify(prData)) });
    }

    const products = prData.result;
    let syncedCount = 0;

    for (const p of products) {
      const detailRes = await fetch(`https://api.printful.com/store/products/${p.id}`, { headers });
      const detailData = await detailRes.json();
      const details = detailData.result;
      
      if (!details || !details.sync_variants) continue;
      
      let maxRetailPrice = 0;
      let sizes = [];
      let imagesList = [];
      
      details.sync_variants.forEach(v => {
         const rp = parseFloat(v.retail_price) || 0;
         if (rp > maxRetailPrice) maxRetailPrice = rp;
         
         // Varyantın mockup resmini topla
         if (v.files) {
           v.files.forEach(f => {
             if (f.type === 'preview' && f.preview_url && !imagesList.includes(f.preview_url)) {
               imagesList.push(f.preview_url);
             }
           });
         }
         
         // Varyant isimden bedeni ayıklama - Printful yapısında genelde "/" dan sonra yazar
         const splitName = v.name.split('/');
         if(splitName.length > 1) {
            let sizePart = splitName[1].replace(')', '').trim();
            if(!sizes.includes(sizePart)) sizes.push(sizePart);
         }
      });

      // Eğer varyantlardan resim gelemediyse, ürün thumbnail'ini kullan
      if (imagesList.length === 0 && details.sync_product.thumbnail_url) {
        imagesList.push(details.sync_product.thumbnail_url);
      }

      if(sizes.length === 0) sizes = ["Standart", "S", "M", "L", "XL"];
      
      // Türkiye Satış Fiyatı Hesaplama: (Printful USD Fiyatı) * KUR * (1 + Kar Marjı)
      const finalPriceTl = Math.ceil(maxRetailPrice * rate * (1 + (margin / 100)));

      // Sonsuz stok yapısı
      const stockData = {};
      sizes.forEach(s => { stockData[s] = 999; });

      const productData = {
        name: details.sync_product.name,
        desc: 'Printful Özel Tasarım Premium Baskılı Ürün.',
        price: finalPriceTl,
        category: 'Printful Tasarımları',
        sizes: sizes,
        stock: stockData,
        images: imagesList, // Printful mockup görselleri
        isPrintful: true,
        printfulId: p.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const existQuery = await db.collection('products').where('printfulId', '==', p.id).get();
      
      if (existQuery.empty) {
        productData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        await db.collection('products').add(productData);
      } else {
        const dId = existQuery.docs[0].id;
        await db.collection('products').doc(dId).update(productData);
      }
      
      syncedCount++;
    }

    res.json({ success: true, message: `${syncedCount} adet Printful ürünü başarıyla senkronize edildi.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══ API: REVIEWS (FIREBASE) ══════════════════════════════════
// ═══════════════════════════════════════════════════════════════
app.get('/api/reviews/:productId', checkDb, async (req, res) => {
  try {
    const snapshot = await db.collection('reviews')
                             .where('productId', '==', req.params.productId)
                             .get();

    // Firebase'de composite index hatasından kaçınmak için mem. filter + sort yapıyoruz
    const reviews = snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data, 
        timeMs: data.createdAt ? data.createdAt.toMillis() : Date.now() 
      };
    }).sort((a,b) => b.timeMs - a.timeMs);

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reviews', [checkDb, authenticateFirebaseToken, upload.single('image')], async (req, res) => {
  try {
    const { productId, rating, comment, userName, userPhoto } = req.body;
    if (!productId || !rating) return res.status(400).json({ error: 'Eksik bilgi (Puan veya Ürün kimliği yok)' });
    
    const uid = req.user.uid;
    const reviewData = {
      productId,
      uid,
      userName: userName || 'Anonim Müşteri',
      userPhoto: userPhoto || null,
      rating: Math.max(1, Math.min(5, parseInt(rating))),
      comment: (comment || '').trim(),
      imageUrl: req.file ? req.file.path : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('reviews').add(reviewData);
    res.status(201).json({ success: true, review: { id: docRef.id, ...reviewData } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══ API: EPOINT PAYMENT ══════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
const crypto = require('crypto');

const EPOINT_PUBLIC_KEY  = process.env.EPOINT_PUBLIC_KEY  || 'i000201384';
const EPOINT_PRIVATE_KEY = process.env.EPOINT_PRIVATE_KEY || 'pfVkzADrheI8JDf8BkhTvec';
const EPOINT_SUCCESS_URL = process.env.EPOINT_SUCCESS_URL || 'https://droxstore.onrender.com/payment-success.html';
const EPOINT_ERROR_URL   = process.env.EPOINT_ERROR_URL   || 'https://droxstore.onrender.com/payment-error.html';
const EPOINT_CALLBACK    = process.env.EPOINT_CALLBACK    || 'https://droxstore.onrender.com/api/payment/callback';

// ePoint imza oluşturma — HMAC-SHA1
function epointSignature(data) {
  return crypto.createHmac('sha1', EPOINT_PRIVATE_KEY).update(data).digest('base64');
}

// Ödeme başlat — sipariş bilgilerini pending olarak kaydet, ePoint'e yönlendir
app.post('/api/payment/start', checkDb, async (req, res) => {
  try {
    const { customerName, phone, address, items, total, appliedDiscountInfo, email } = req.body;

    if (!customerName || !phone || !address || !items || items.length === 0) {
      return res.status(400).json({ error: 'Eksik sipariş bilgisi.' });
    }

    // Pending sipariş kaydet
    const orderRef = db.collection('orders').doc();
    const orderId  = orderRef.id;

    await orderRef.set({
      customerName,
      email: email || null,
      phone,
      address,
      items,
      total,
      appliedDiscountInfo: appliedDiscountInfo || '',
      status: 'Ödeme Bekleniyor',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // ePoint payload — TL fiyatı AZN'ye çevir
    const TL_TO_AZN = parseFloat(process.env.TL_TO_AZN_RATE || '0.054');
    const amountAzn = (parseFloat(total) * TL_TO_AZN).toFixed(2);

    const payload = {
      public_key:  EPOINT_PUBLIC_KEY,
      amount:      amountAzn,
      currency:    'AZN',
      language:    'en',
      order_id:    orderId,
      description: `DroxStore Siparis #${orderId.substring(0,8)}`,
      success_url: EPOINT_SUCCESS_URL + '?order=' + orderId,
      error_url:   EPOINT_ERROR_URL   + '?order=' + orderId,
      result_url:  EPOINT_CALLBACK
    };

    const payloadJson = JSON.stringify(payload);
    const data      = Buffer.from(payloadJson).toString('base64');
    const signature = epointSignature(payloadJson);

    res.json({
      success: true,
      orderId,
      data,
      signature,
      epointUrl: 'https://epoint.az/api/1/request'
    });

  } catch (err) {
    console.error('ePoint start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ePoint callback — ödeme sonucu
app.post('/api/payment/callback', async (req, res) => {
  try {
    const { data, signature } = req.body;
    if (!data || !signature) return res.status(400).send('Bad Request');

    // İmza doğrula — HMAC-SHA1
    const expectedSig = epointSignature(Buffer.from(data, 'base64').toString('utf8'));
    if (expectedSig !== signature) {
      console.warn('ePoint: Geçersiz imza!');
      return res.status(403).send('Invalid signature');
    }

    const payload = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    const { order_id, status, transaction } = payload;

    if (!db || !order_id) return res.status(400).send('Bad data');

    const orderRef = db.collection('orders').doc(order_id);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) return res.status(404).send('Order not found');

    if (status === 'success') {
      // Stok düş + siparişi onayla
      const orderData = orderDoc.data();
      const batch = db.batch();

      for (const item of (orderData.items || [])) {
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

      batch.update(orderRef, {
        status: 'Ödendi',
        transactionId: transaction || null,
        paidAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
      console.log(`✅ ePoint ödeme onaylandı: ${order_id}`);
    } else {
      await orderRef.update({ status: 'Ödeme Başarısız' });
      console.log(`❌ ePoint ödeme başarısız: ${order_id} — ${status}`);
    }

    res.send('OK');
  } catch (err) {
    console.error('ePoint callback error:', err);
    res.status(500).send('Error');
  }
});

// Sipariş durumu sorgula (frontend polling için)
app.get('/api/payment/status/:orderId', checkDb, async (req, res) => {
  try {
    const doc = await db.collection('orders').doc(req.params.orderId).get();
    if (!doc.exists) return res.status(404).json({ error: 'Sipariş bulunamadı' });
    const { status, transactionId } = doc.data();
    res.json({ status, transactionId: transactionId || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Catch-all: SPA fallback ─────────────────────────────────────
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 DroxStore Cloud Server running on port ${PORT}`));
// --- SUPPORT TICKETS API ---
let supportTickets = [];
app.post('/api/support/ticket', (req, res) => {
  const ticket = { id: Date.now().toString(), issue: req.body.issue, user: req.body.user, date: new Date().toISOString() };
  supportTickets.push(ticket);
  res.json({ success: true });
});
app.get('/api/support/tickets', (req, res) => {
  res.json(supportTickets);
});
app.delete('/api/support/tickets/:id', (req, res) => {
  supportTickets = supportTickets.filter(t => t.id !== req.params.id);
  res.json({ success: true });
});
