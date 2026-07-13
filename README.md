# 🛍️ DROXSTORE - Premium E-Ticarət Platforması

**Modern, Əlverişli və Güclü Onlayn Mağaza**

---

## 🚀 Xüsusiyyətlər

### 🎨 Frontend
- ✨ Premium dizayn və smooth animasiyalar
- 📱 Tam responsive (mobil və desktop)
- 🔍 Canlı məhsul axtarışı
- 🛒 Real-time səbət sistemi
- ⭐ Məhsul qiymətləndirmə və şərhlər
- 🔐 Google OAuth ilə giriş
- 💬 WhatsApp ilə birbaşa sifariş

### ⚙️ Backend
- 🔥 Firebase Firestore verilənlər bazası
- 🖼️ Cloudinary şəkil hostinqi
- 🔒 JWT autentifikasiya
- 📊 Admin paneli (statistika və idarəetmə)
- 🏷️ Kateqoriya idarəetməsi
- 💰 İndirim kod sistemi
- 📱 Bildiriş sistemi

### 🛡️ Təhlükəsizlik
- Firebase Admin SDK
- JWT token autentifikasiya
- Cloudinary təhlükəsiz şəkil yükləmə
- CORS konfiqurasiyası

---

## 📦 Quraşdırma

### 1. Klonlama
```bash
git clone https://github.com/nihatmehdizade43-oss/DroxStore.git
cd DroxStore
```

### 2. Asılılıqları Yüklə
```bash
npm install
```

### 3. Environment Dəyişənləri
`.env` faylı yarat və aşağıdakıları əlavə et:

```env
# Firebase
FIREBASE_SERVICE_ACCOUNT_B64=your_base64_encoded_service_account

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Admin
ADMIN_PASS=your_admin_password
JWT_SECRET=your_jwt_secret

# WhatsApp
WHATSAPP_NUMBER=994553229166
```

### 4. Serveri Başlat
```bash
npm start
```

Server `http://localhost:3000` ünvanında işə düşəcək.

---

## 🌐 Deploy

### Vercel Deploy
```bash
# Vercel CLI yüklə (bir dəfə)
npm i -g vercel

# Deploy et
vercel

# Production-a deploy et
vercel --prod
```

### Firebase Console Quraşdırması
1. [Firebase Console](https://console.firebase.google.com/) aç
2. Proyektini seç: **droxstore-c5c58**
3. **Authentication** → **Settings** → **Authorized domains**
4. Domain əlavə et: `droxstore.vercel.app` və ya custom domain

Daha ətraflı: [FIREBASE_SETUP.md](./FIREBASE_SETUP.md)

---

## 🎯 Admin Panel

### Giriş
- **Desktop:** `Ctrl + Alt + A` 
- **Mobil:** Footer-ə 3 dəfə toxun
- **Default:** `admin` / `admin123`

### Admin Panel Xüsusiyyətləri
- 📊 Real-time statistika
- ➕ Məhsul əlavə et (çox şəkilli)
- 📝 Kateqoriya idarəetməsi
- 💸 İndirim kodları
- 👥 Müştəri siyahısı
- 📢 Bildiriş göndər

---

## 📱 İstifadə

### Məhsul Əlavə Etmə
1. Admin panelinə daxil ol
2. **"Məhsul Əlavə Et"** tab-ına get
3. Məhsul məlumatlarını daxil et:
   - Məhsul adı
   - Kateqoriya seç
   - Qiymət (AZN)
   - Ən çox 5 şəkil yüklə
   - Bədən stokları (S, M, L, XL)
   - Təsvir
4. **"Əlavə Et"** düyməsinə bas
5. Məhsul avtomatik ana səhifədə görünəcək ✅

### Kateqoriya Əlavə Etmə
1. Admin panel → **"Kateqoriyalar"**
2. Yeni kateqoriya adı yaz
3. **"Əlavə Et"** düyməsinə bas

---

## 🔧 Texnologiyalar

### Backend
- **Node.js** + **Express.js**
- **Firebase Admin SDK** (Firestore)
- **Cloudinary** (Image CDN)
- **Multer** (File upload)
- **JWT** (Authentication)

### Frontend
- **Vanilla JavaScript** (No framework!)
- **CSS3** (Custom animations)
- **Firebase Auth** (Google OAuth)
- **Responsive Design**

---

## 📞 Əlaqə

**Developer:** Nihat Mehdizadə  
**Email:** nihatmehdizade43@gmail.com  
**WhatsApp:** +994 55 322 91 66

---

## 📄 Lisenziya

© 2026 DroxStore. Bütün hüquqlar qorunur.

---

## 🎉 Son Versiya: v4.0

### Yeniliklər:
- ✅ Google OAuth inteqrasiyası
- ✅ WhatsApp sifariş sistemi
- ✅ Çox şəkilli məhsul yükləmə
- ✅ Cloudinary CDN
- ✅ Real-time bildirişlər
- ✅ Mobil responsive dizayn
- ✅ Admin paneli təkmilləşdirmələri

**Uğurlu satışlar! 🚀**
