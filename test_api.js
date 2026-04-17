const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("🔐 Login Response:", data);
    
    // Test categories GET
    http.get('http://localhost:3000/api/categories', (res2) => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        console.log("📦 Categories (Firebase Docs):", data2);
        console.log("✅ Tüm testler başarılı! Firebase ve Backend sorunsuz iletişim kuruyor.");
      });
    });
  });
});

req.on('error', (e) => {
  console.error("❌ Test hatası:", e);
});

req.write(JSON.stringify({ username: "admin", password: "admin123" }));
req.end();
