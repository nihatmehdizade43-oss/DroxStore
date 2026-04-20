const fs = require('fs');

let appjs = fs.readFileSync('public/app.js', 'utf8');
appjs = appjs.replace(/₺/g, '$');
appjs = appjs.replace(/toLocaleString\('tr'\)/g, "toLocaleString('en-US')");
appjs = appjs.replace(/toLocaleString\('tr-TR'\)/g, "toLocaleString('en-US')");
fs.writeFileSync('public/app.js', appjs);

let indexhtml = fs.readFileSync('public/index.html', 'utf8');
indexhtml = indexhtml.replace(/₺/g, '$');
indexhtml = indexhtml.replace(/Fiyat \(₺\)/g, 'Fiyat ($)');
fs.writeFileSync('public/index.html', indexhtml);

console.log('Currency UI updated to $');
