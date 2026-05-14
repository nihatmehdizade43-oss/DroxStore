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
  
  // Firebase Service Account configuration
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
// Yerel uploads klasörü iptal! Artık Cloudinary üzerinden sunulacak.

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
  // DB yoksa hata verme, devam et (endpointler kendi içinde fallback yapacak)
  next();
}

// Firebase Müşteri Doğrulama Middleware
async function authenticateFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    // Eğer token yoksa ama yerel moddaysak devam etmesine izin verebiliriz 
    // veya sadece anonim kullanıcı gibi davranabiliriz.
    return res.status(401).json({ error: 'Yetkilendirme gerekli' });
  }

  try {
    if (admin) {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      next();
    } else {
      // Firebase Admin yoksa yerel geliştirme için basit bir UID ata
      req.user = { uid: 'local_user_dev', email: 'local@droxstore.com', name: 'Yerel Kullanıcı' };
      next();
    }
  } catch(err) {
    console.error('Auth Token Error:', err.message);
    res.status(403).json({ error: 'Geçersiz veya süresi dolmuş oturum' });
  }
}

// ═══════════════════════════════════════════════════════════════
// ═══ API: CUSTOMERS (SYNCHRONIZE & PROFILE) ═══════════════════
// ═══════════════════════════════════════════════════════════════
app.post('/api/customers/sync', [checkDb, authenticateFirebaseToken], async (req, res) => {
  try {
    const uid = req.user.uid;
    const { email, name, photoURL } = req.body;
    
    let finalPhotoURL = photoURL || null;
    let address = {};
    let totalSpent = 0;

    if (db) {
      const docRef = db.collection('customers').doc(uid);
      const doc = await docRef.get();
      
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
        const existingData = doc.data();
        address = existingData.address || {};
        if (!existingData.photoURL && finalPhotoURL) {
          await docRef.update({ photoURL: finalPhotoURL, name: name || existingData.name });
        } else {
          finalPhotoURL = existingData.photoURL || finalPhotoURL;
        }
      }

      const ordersSnap = await db.collection('orders').where('email', '==', email || req.user.email).get();
      ordersSnap.forEach(orderDoc => {
        totalSpent += parseFloat(orderDoc.data().total || 0);
      });
    }

    res.json({ 
      success: true, 
      user: {
        uid, 
        email: email || req.user.email, 
        name: name || (req.user.name || 'İsimsiz Üye'), 
        photoURL: finalPhotoURL, 
        address, 
        totalSpent 
      } 
    });
  } catch(err) {
    console.error('Customer sync error:', err);
    res.status(500).json({error: err.message});
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

// ═══════════════════════════════════════════════════════════════
// ═══ API: SETTINGS & DISCOUNTS ════════════════════════════════
// ═══════════════════════════════════════════════════════════════
app.get('/api/settings', async (req, res) => {
  try {
    if (db) {
      const doc = await db.collection('settings').doc('global').get();
      if (doc.exists) return res.json(doc.data());
    }
    res.json(getLocalData(SETTINGS_PATH, { vipThreshold: 500, qtyDiscountTarget: 3, qtyDiscountPercent: 10, dateDiscountPercent: 8, printfulToken: '', printfulMargin: 50 }));
  } catch (err) {
    res.json({ vipThreshold: 500, qtyDiscountTarget: 3, qtyDiscountPercent: 10, dateDiscountPercent: 8 });
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

app.get('/api/discounts', async (req, res) => {
  try {
    if (db) {
      const snapshot = await db.collection('discounts').get();
      return res.json(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }
    res.json([]);
  } catch (err) {
    res.json([]);
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══ API: CATEGORIES ══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
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
    let st = {};
    if (db) {
      const doc = await db.collection('settings').doc('global').get();
      if (doc.exists) st = doc.data();
    }
    if (!st.printfulToken) {
      st = getLocalData(SETTINGS_PATH, {});
    }
    
    const pToken = st.printfulToken;
    const margin = parseFloat(st.printfulMargin) || 50;
    const usdToAzn = parseFloat(process.env.USD_TO_AZN_RATE || '1.70');

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
    let syncedProducts = [];

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
         
         if (v.files) {
           v.files.forEach(f => {
             if (f.type === 'preview' && f.preview_url && !imagesList.includes(f.preview_url)) {
               imagesList.push(f.preview_url);
             }
           });
         }
         
         const splitName = v.name.split('/');
         if(splitName.length > 1) {
            let sizePart = splitName[1].replace(')', '').trim();
            if(!sizes.includes(sizePart)) sizes.push(sizePart);
         }
      });

      if (imagesList.length === 0 && details.sync_product.thumbnail_url) {
        imagesList.push(details.sync_product.thumbnail_url);
      }

      if(sizes.length === 0) sizes = ["S", "M", "L", "XL"];
      
      // Satış Fiyatı Hesaplama: (Printful USD Fiyatı) * (Kar Marjı) * (USD->AZN Kuru)
      // Örn: 10$ * 1.5 * 1.7 = 25.5 AZN
      let finalPrice = (maxRetailPrice * (1 + (margin / 100)) * usdToAzn);
      
      // Kullanıcının "30 AZN altı" isteği için limit koyalım (Opsiyonel ama istenmişti)
      if (finalPrice > 30) finalPrice = 29.90;
      finalPrice = Math.ceil(finalPrice);

      const stockData = {};
      sizes.forEach(s => { stockData[s] = 999; });

      const productData = {
        id: `printful_${p.id}`,
        name: details.sync_product.name,
        desc: 'Printful Özel Tasarım Premium Baskılı Ürün.',
        price: finalPrice,
        category: 'Printful',
        sizes: sizes,
        stock: stockData,
        images: imagesList,
        isPrintful: true,
        printfulId: p.id,
        updatedAt: new Date().toISOString()
      };

      if (db) {
        const existQuery = await db.collection('products').where('printfulId', '==', p.id).get();
        if (existQuery.empty) {
          productData.createdAt = admin.firestore.FieldValue.serverTimestamp();
          await db.collection('products').add(productData);
        } else {
          const dId = existQuery.docs[0].id;
          await db.collection('products').doc(dId).update(productData);
        }
      }
      syncedProducts.push(productData);
    }

    // Her durumda yerel dosyaya da yazalım (Admin paneli için)
    const localProds = getLocalData(PRODUCTS_PATH, []);
    const merged = [...localProds];
    
    syncedProducts.forEach(sp => {
      const idx = merged.findIndex(m => m.printfulId === sp.printfulId || m.id === sp.id);
      if (idx !== -1) merged[idx] = { ...merged[idx], ...sp };
      else merged.push(sp);
    });
    
    saveLocalData(PRODUCTS_PATH, merged);

    res.json({ success: true, count: syncedProducts.length });
  } catch (err) {
    console.error('Printful sync error:', err);
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
// ═══ API: PAYRIFF PAYMENT ═════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
const PAYRIFF_API_KEY = process.env.PAYRIFF_API_KEY || 'your_payriff_api_key';
const PAYRIFF_SECRET_KEY = process.env.PAYRIFF_SECRET_KEY || 'your_payriff_secret_key';
const PAYRIFF_MERCHANT_ID = process.env.PAYRIFF_MERCHANT_ID || 'your_merchant_id';
const PAYRIFF_SUCCESS_URL = process.env.PAYRIFF_SUCCESS_URL || 'https://drox-store.vercel.app/payment-success.html';
const PAYRIFF_ERROR_URL = process.env.PAYRIFF_ERROR_URL || 'https://drox-store.vercel.app/payment-error.html';

// Payriff ödeme başlat — sipariş bilgilerini pending olarak kaydet, Payriff'e yönlendir
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

    // Payriff payload — USD fiyatı AZN'ye çevir
    const USD_TO_AZN = parseFloat(process.env.USD_TO_AZN_RATE || '1.70');
    const amountAzn = (parseFloat(total) * USD_TO_AZN).toFixed(2);

    const payload = {
      body: {
        amount: parseFloat(amountAzn),
        currencyType: 'AZN',
        description: `DroxStore Siparis #${orderId.substring(0,8)}`,
        directPay: true,
        installmentLevel: 0,
        language: 'EN',
        merchantId: PAYRIFF_MERCHANT_ID,
        approveURL: PAYRIFF_SUCCESS_URL + '?order=' + orderId,
        cancelURL: PAYRIFF_ERROR_URL + '?order=' + orderId,
        declineURL: PAYRIFF_ERROR_URL + '?order=' + orderId
      },
      merchantId: PAYRIFF_MERCHANT_ID
    };

    const response = await fetch('https://api.payriff.com/api/v2/createOrder', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': PAYRIFF_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const resData = await response.json();

    if (resData.code === '00' && resData.payload && resData.payload.paymentUrl) {
      res.json({
        success: true,
        orderId,
        paymentUrl: resData.payload.paymentUrl
      });
    } else {
      throw new Error(resData.message || 'Payriff order creation failed');
    }

  } catch (err) {
    console.error('Payriff start error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Payriff callback — ödeme sonucu (Not: Payriff genelde server-to-server callback yapar)
app.post('/api/payment/callback', async (req, res) => {
  try {
    // Payriff callback yapısı (örnek: { payload: { orderId, orderStatus, sessionId } })
    const { payload } = req.body;
    if (!payload) return res.status(400).send('Bad Request');

    const { orderId, orderStatus } = payload;
    if (!db || !orderId) return res.status(400).send('Bad data');

    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();
    if (!orderDoc.exists) return res.status(404).send('Order not found');

    if (orderStatus === 'APPROVED') {
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
        paidAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
      console.log(`✅ Payriff ödeme onaylandı: ${orderId}`);
    } else {
      await orderRef.update({ status: 'Ödeme Başarısız' });
      console.log(`❌ Payriff ödeme başarısız: ${orderId} — ${orderStatus}`);
    }

    res.send('OK');
  } catch (err) {
    console.error('Payriff callback error:', err);
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

if (require.main === module) {
  app.listen(PORT, () => console.log(`🚀 DroxStore Cloud Server running on port ${PORT}`));
}
module.exports = app;
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
