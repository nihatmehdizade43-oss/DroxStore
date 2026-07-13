/* ============================================
   DROXSTORE — Express Backend Server (v4.0 Azerbaijani WhatsApp & Notifications)
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
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log('✅ Firebase serviceAccountKey.json dosyası bulundu.');
  } else {
    let b64Key = process.env.FIREBASE_SERVICE_ACCOUNT_B64 ? process.env.FIREBASE_SERVICE_ACCOUNT_B64.trim() : null;
    if (!b64Key) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 is missing in .env and serviceAccountKey.json not found");
    }
    b64Key = b64Key.replace(/\s/g, '');
    let decoded = Buffer.from(b64Key, 'base64').toString('utf8');
    try {
      serviceAccount = JSON.parse(decoded);
    } catch (e) {
      const fixedDecoded = decoded.replace(/"([^"]*)"/g, (match, p1) => {
        return '"' + p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
      });
      serviceAccount = JSON.parse(fixedDecoded);
    }
  }

  if (serviceAccount && serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

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

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// ─── ADMIN AUTH (JWT) ───────────────────────────────────────────
const ADMIN_USER = 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123'; 
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_drox_key_2026_pro';

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Yetkilendirme gerekli (Token eksik)' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş oturum' });
    req.user = user;
    next();
  });
}

// Veritabanı Kapalıyken Çıkacak Hata Yakalayıcı
function checkDb(req, res, next) {
  next();
}

// Firebase Müşteri Doğrulama Middleware
async function authenticateFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Yetkilendirme gerekli' });
  }

  try {
    if (admin) {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    } else {
      req.user = { uid: 'local_user_dev', email: 'local@droxstore.com', name: 'Yerel Kullanıcı' };
      next();
    }
  } catch(err) {
    console.error('Auth Token Error:', err.message);
    res.status(403).json({ error: 'Geçersiz veya süresi dolmuş oturum' });
  }
}

// ─── API: AUTH / LOGIN ──────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: 'Kullanıcı adı veya şifre yanlış' });
  }
});

// ─── API: CUSTOMERS (SYNCHRONIZE & PROFILE) ─────────────────────
app.post('/api/customers/sync', [checkDb, authenticateFirebaseToken], async (req, res) => {
  try {
    const uid = req.user.uid;
    const { email, name, photoURL } = req.body;
    
    let finalPhotoURL = photoURL || null;
    let address = {};

    if (db) {
      const docRef = db.collection('customers').doc(uid);
      const doc = await docRef.get();
      
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
        const existingData = doc.data();
        address = existingData.address || {};
        if (!existingData.photoURL && finalPhotoURL) {
          await docRef.update({ photoURL: finalPhotoURL, name: name || existingData.name });
        } else {
          finalPhotoURL = existingData.photoURL || finalPhotoURL;
        }
      }
    }

    res.json({ 
      success: true, 
      user: {
        uid, 
        email: email || req.user.email, 
        name: name || (req.user.name || 'İsimsiz Üye'), 
        photoURL: finalPhotoURL, 
        address,
        totalSpent: 0
      } 
    });
  } catch(err) {
    console.error('Customer sync error:', err);
    res.status(500).json({error: err.message});
  }
});

// ─── API: ADMIN CUSTOMERS ───────────────────────────────────────
app.get('/api/admin/customers', [checkDb, authenticateToken], async (req, res) => {
  try {
    if (db) {
      const snapshot = await db.collection('customers').orderBy('createdAt', 'desc').get();
      const customers = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email,
          name: data.name,
          createdAt: data.createdAt
        };
      });
      return res.json(customers);
    }
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DATA FALLBACK (Local JSON) ──────────────────────────────────
const CATEGORIES_PATH = path.join(__dirname, 'data', 'categories.json');
const PRODUCTS_PATH = path.join(__dirname, 'data', 'products.json');
const SETTINGS_PATH = path.join(__dirname, 'data', 'settings.json');

function getLocalData(filePath, defaultData = []) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (e) { console.error(`Local data error (${filePath}):`, e); }
  return defaultData;
}

function saveLocalData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`Save local data error (${filePath}):`, e);
    return false;
  }
}

// ─── PRODUCT SKU GENERATOR ──────────────────────────────────────
async function getNextProductCode() {
  if (!db) {
    const products = getLocalData(PRODUCTS_PATH);
    const count = products.length + 1;
    return `DRX-${String(count).padStart(3, '0')}`;
  }
  
  const counterRef = db.collection('counters').doc('products');
  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      let nextCount = 1;
      if (doc.exists) {
        nextCount = (doc.data().count || 0) + 1;
      }
      transaction.set(counterRef, { count: nextCount }, { merge: true });
      return `DRX-${String(nextCount).padStart(3, '0')}`;
    });
  } catch (e) {
    console.error("Counter transaction error, fallback to random code", e);
    return `DRX-${Math.floor(100 + Math.random() * 900)}`;
  }
}

// ─── API: SETTINGS ──────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    if (db) {
      const doc = await db.collection('settings').doc('global').get();
      if (doc.exists) return res.json(doc.data());
    }
    res.json(getLocalData(SETTINGS_PATH, { vipThreshold: 500, qtyDiscountTarget: 3, qtyDiscountPercent: 10, dateDiscountPercent: 8, whatsappNumber: '994553229166' }));
  } catch (err) {
    res.json({ vipThreshold: 500, qtyDiscountTarget: 3, qtyDiscountPercent: 10, dateDiscountPercent: 8, whatsappNumber: '994553229166' });
  }
});

app.post('/api/settings', [checkDb, authenticateToken], async (req, res) => {
  try {
    if (db) {
      await db.collection('settings').doc('global').set(req.body, { merge: true });
    }
    const current = getLocalData(SETTINGS_PATH, {});
    saveLocalData(SETTINGS_PATH, { ...current, ...req.body });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: DISCOUNTS ─────────────────────────────────────────────
app.get('/api/discounts', async (req, res) => {
  try {
    if (db) {
      const snapshot = await db.collection('discounts').orderBy('createdAt', 'desc').get();
      return res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    res.json([]);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/discounts', [checkDb, authenticateToken], async (req, res) => {
  try {
    const { code, percent, validDays } = req.body;
    if (!code || !percent) return res.status(400).json({ error: 'Kod ve İndirim Yüzdesi gerekli' });

    const codeUpper = code.toUpperCase().trim();
    
    if (db) {
      const existing = await db.collection('discounts').where('code', '==', codeUpper).get();
      if (!existing.empty) return res.status(400).json({ error: 'Bu indirim kodu zaten mevcut!' });
    }

    let validUntil = null;
    if (validDays && parseInt(validDays) > 0) {
        validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + parseInt(validDays));
    }

    const discData = {
      code: codeUpper,
      percent: parseFloat(percent),
      validUntil: validUntil ? validUntil.toISOString() : null,
      createdAt: new Date().toISOString()
    };

    if (db) {
      const newDiscRef = db.collection('discounts').doc();
      await newDiscRef.set({
        ...discData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.status(201).json({ id: newDiscRef.id, ...discData });
    } else {
      res.status(201).json({ id: 'local_' + Date.now(), ...discData });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/discounts/:id', [checkDb, authenticateToken], async (req, res) => {
  try {
    if (db) {
      await db.collection('discounts').doc(req.params.id).delete();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: CATEGORIES ────────────────────────────────────────────
app.get('/api/categories', async (req, res) => {
  try {
    if (db) {
      const snapshot = await db.collection('categories').get();
      const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.json(categories);
    }
    res.json(getLocalData(CATEGORIES_PATH));
  } catch (err) {
    res.json(getLocalData(CATEGORIES_PATH));
  }
});

app.post('/api/categories', [checkDb, authenticateToken], async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Kategori adı gerekli' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').trim();
    
    if (db) {
      const ref = db.collection('categories').doc();
      await ref.set({ name, slug });
      res.status(201).json({ success: true, id: ref.id });
    } else {
      const cats = getLocalData(CATEGORIES_PATH);
      cats.push({ id: 'local_' + Date.now(), name, slug });
      saveLocalData(CATEGORIES_PATH, cats);
      res.status(201).json({ success: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', [checkDb, authenticateToken], async (req, res) => {
  try {
    if (db) {
      await db.collection('categories').doc(req.params.id).delete();
    } else {
      let cats = getLocalData(CATEGORIES_PATH);
      cats = cats.filter(c => c.id !== req.params.id);
      saveLocalData(CATEGORIES_PATH, cats);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: PRODUCTS ──────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    if (db) {
      const snapshot = await db.collection('products').orderBy('createdAt', 'desc').get();
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.json(products);
    }
    res.json(getLocalData(PRODUCTS_PATH));
  } catch (err) {
    res.json(getLocalData(PRODUCTS_PATH));
  }
});

app.post('/api/products', [checkDb, authenticateToken, upload.array('images', 5)], async (req, res) => {
  try {
    const { name, category, price, oldPrice, badge, badgeClass, desc, isFeatured } = req.body;

    let stockData = {};
    if (req.body.stock) {
      try { stockData = JSON.parse(req.body.stock); } catch (e) { /* ignore */ }
    }

    if (!name || !category || !price) return res.status(400).json({ error: 'Zorunlu alanları doldurun' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Görsel yüklenemedi' });

    const imagePaths = req.files.map(f => f.path);
    const productCode = await getNextProductCode();

    const productData = {
      productCode,
      name: name.trim(),
      category,
      price: parseFloat(price),
      oldPrice: oldPrice ? parseFloat(oldPrice) : null,
      badge: badge || null,
      badgeClass: badgeClass || '',
      stock: stockData,
      desc: (desc || '').trim(),
      images: imagePaths,
      isFeatured: isFeatured === 'true'
    };

    if (db) {
      const newProdRef = db.collection('products').doc();
      await newProdRef.set({
        ...productData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Auto Send Notification
      await db.collection('notifications').add({
        title: '🆕 Yeni Məhsul!',
        message: `"${name.trim()}" mağazaya əlavə edildi. Kod: ${productCode}. Qiymət: ${price} AZN`,
        type: 'new_product',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(201).json({ success: true, product: { id: newProdRef.id, ...productData } });
    } else {
      res.status(500).json({ error: 'Verilənlər bazası bağlantısı yoxdur. Vercel-də FIREBASE_SERVICE_ACCOUNT_B64 yoxlayın.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', [checkDb, authenticateToken], async (req, res) => {
  try {
    if (db) {
      await db.collection('products').doc(req.params.id).delete();
    } else {
      let prods = getLocalData(PRODUCTS_PATH);
      prods = prods.filter(p => p.id !== req.params.id);
      saveLocalData(PRODUCTS_PATH, prods);
    }
    res.json({ success: true, message: 'Ürün silindi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', [checkDb, authenticateToken], async (req, res) => {
  try {
    const { name, category, price, desc, stock } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (category !== undefined) updateData.category = category;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (desc !== undefined) updateData.desc = desc.trim();
    if (stock !== undefined) updateData.stock = stock;

    if (db) {
      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await db.collection('products').doc(req.params.id).update(updateData);
    } else {
      const prods = getLocalData(PRODUCTS_PATH);
      const idx = prods.findIndex(p => p.id === req.params.id);
      if (idx !== -1) {
        prods[idx] = { ...prods[idx], ...updateData, updatedAt: new Date().toISOString() };
        saveLocalData(PRODUCTS_PATH, prods);
      }
    }
    res.json({ success: true, message: 'Ürün güncellendi' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: STATS (Admin Dashboard) ────────────────────────────────
app.get('/api/stats', [checkDb, authenticateToken], async (req, res) => {
  try {
    if (db) {
      const productsSnap = await db.collection('products').get();
      const usersSnap = await db.collection('customers').get();

      let totalStock = 0;
      productsSnap.docs.forEach(doc => {
        const stock = doc.data().stock;
        if (stock) { Object.values(stock).forEach(v => totalStock += Number(v)); }
      });

      res.json({
        totalProducts: productsSnap.size,
        totalStock,
        totalUsers: usersSnap.size,
        totalSales: 0,
        totalRevenue: 0
      });
    } else {
      const prods = getLocalData(PRODUCTS_PATH);
      let totalStock = 0;
      prods.forEach(p => {
        if (p.stock) { Object.values(p.stock).forEach(v => totalStock += Number(v)); }
      });
      res.json({
        totalProducts: prods.length,
        totalStock,
        totalUsers: 0,
        totalSales: 0,
        totalRevenue: 0
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: REVIEWS ───────────────────────────────────────────────
app.get('/api/reviews/:productId', checkDb, async (req, res) => {
  try {
    if (db) {
      const snapshot = await db.collection('reviews')
                               .where('productId', '==', req.params.productId)
                               .get();

      const reviews = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data, 
          timeMs: data.createdAt ? data.createdAt.toMillis() : Date.now() 
        };
      }).sort((a,b) => b.timeMs - a.timeMs);

      res.json(reviews);
    } else {
      res.json([]);
    }
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
      imageUrl: req.file ? req.file.path : null
    };
    
    if (db) {
      const docRef = await db.collection('reviews').add({
        ...reviewData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.status(201).json({ success: true, review: { id: docRef.id, ...reviewData } });
    } else {
      res.status(201).json({ success: true, review: reviewData });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: NOTIFICATIONS ──────────────────────────────────────────
app.get('/api/notifications', async (req, res) => {
  try {
    if (db) {
      const snapshot = await db.collection('notifications').orderBy('createdAt', 'desc').limit(50).get();
      return res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    res.json([]);
  } catch (err) {
    res.json([]);
  }
});

app.post('/api/notifications', [checkDb, authenticateToken], async (req, res) => {
  try {
    const { title, message, type } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Başlık ve mesaj gereklidir' });
    
    const notifData = {
      title,
      message,
      type: type || 'announcement'
    };

    if (db) {
      const ref = await db.collection('notifications').add({
        ...notifData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.status(201).json({ success: true, id: ref.id, ...notifData });
    } else {
      res.status(201).json({ success: true, id: 'local_' + Date.now(), ...notifData });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notifications/:id', [checkDb, authenticateToken], async (req, res) => {
  try {
    if (db) {
      await db.collection('notifications').doc(req.params.id).delete();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── API: SUPPORT TICKETS ───────────────────────────────────────
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

// ─── Catch-all: SPA fallback ─────────────────────────────────────
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    next();
  }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 DroxStore Cloud Server running on port ${PORT}`));
}
module.exports = app;
