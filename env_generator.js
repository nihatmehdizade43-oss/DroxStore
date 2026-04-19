const fs = require('fs');
const keyData = fs.readFileSync('./data/serviceAccountKey.json', 'utf8');
const minified = JSON.stringify(JSON.parse(keyData));

const envContent = `CLOUDINARY_CLOUD_NAME=dkw3jfrnl
CLOUDINARY_API_KEY=145517387981247
CLOUDINARY_API_SECRET=VI-IlXTeBRFv_IoK64h0Q0bNn68
JWT_SECRET=super_secret_drox_key_2026_pro
FIREBASE_SERVICE_ACCOUNT=${minified}
`;

fs.writeFileSync('.env.render', envContent);
console.log('.env.render file successfully generated!');
