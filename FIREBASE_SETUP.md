# 🔥 Firebase Console Quraşdırması

## Google Girişini Aktivləşdirmək Üçün

Saytda Google ilə giriş işləməsi üçün Firebase Console-da aşağıdakı addımları yerinə yetir:

### 1️⃣ Firebase Console-a Daxil Ol
🔗 [Firebase Console](https://console.firebase.google.com/)

### 2️⃣ "droxstore-c5c58" Proyektini Seç

### 3️⃣ Authentication Bölməsinə Get
- Sol tərəfdə **"Build"** → **"Authentication"** bölməsinə daxil ol

### 4️⃣ "Sign-in method" Tab-ına Keç

### 5️⃣ Google Provideri Aktivləşdir
- **"Google"** sətirində **"Enable"** et (əgər hələ deaktivdirsə)
- Email seç və **Save** et

### 6️⃣ Authorized Domains Əlavə Et
- **Settings** (⚙️) düyməsinə bas (sağ üstdə)
- **"Authorized domains"** bölməsinə get
- **"Add domain"** düyməsinə bas
- Aşağıdakı domainləri əlavə et:

```
droxstore.onrender.com
```

- **"Add"** düyməsinə bas

### 7️⃣ Yoxla
- Render.com-da deploy bitəndən sonra:
  - `https://droxstore.onrender.com` ünvanına get
  - "Google ile Devam Et" düyməsinə bas
  - Google hesabını seç
  - Uğurla giriş etməli olursan ✅

---

## ⚠️ Yadda Saxla
- **Localhost** üçün artıq quraşdırma lazım deyil (avtomatik authorized)
- Hər yeni domain üçün (məsələn: custom domain) Firebase Console-da authorized domains-ə əlavə etməlisən
- Google giriş işləməzsə tarayıcının **Console** (F12) bölməsinə bax və səhv mesajını yoxla

---

## 📞 Əlaqə
Problem olarsa:
- Firebase Console-da **"Authorized domains"** siyahısına `droxstore.onrender.com` əlavə etdiyindən əmin ol
- Deploy bitənə qədər 1-2 dəqiqə gözlə
- Səhifəni refresh et (Ctrl + F5)
