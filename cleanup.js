const fs = require('fs');

try {
  let index = fs.readFileSync('public/index.html', 'utf8');
  const startStr = '<!-- AI Support Section in Profile -->';
  const start = index.indexOf(startStr);
  const endStr = '<button class="btn-ghost" style="width:100%; border:1px solid var(--border); padding:15px; margin-bottom: 15px; border-radius:8px;" onclick="closeUserDrawer(); window.location.hash=\'products\'">Koleksiyona Devam Et</button>';
  const end = index.indexOf(endStr);
  
  if (start !== -1 && end !== -1) {
    index = index.substring(0, start) + index.substring(end);
    console.log('Removed AI HTML');
  }

  // Convert TRY to USD
  index = index.replace(/₺/g, '$');
  // Specifically fix any static text that mentioned TL/TRY defaults
  index = index.replace(/Fiyat \(₺\)/g, 'Fiyat ($)');
  index = index.replace(/Dolar -> TL Kuru/g, 'Local Currency Rate');
  
  fs.writeFileSync('public/index.html', index, 'utf8');

  let app = fs.readFileSync('public/app.js', 'utf8');
  app = app.replace(/₺/g, '$');
  app = app.replace(/ Fiyat \(₺\) /g, ' Fiyat ($) ');
  fs.writeFileSync('public/app.js', app, 'utf8');

  console.log('Reverted AI and changed currency to Dollar');
} catch (err) {
  console.error(err);
}
