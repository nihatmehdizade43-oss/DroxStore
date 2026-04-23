const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    // Replace corrupted TL symbol
    content = content.replace(/Γé║/g, '$');
    content = content.replace(/₺/g, '$');
    
    // Replace Turkish localization with English
    content = content.replace(/toLocaleString\(['"]tr['"]\)/g, "toLocaleString('en-US')");
    content = content.replace(/toLocaleString\(['"]tr-TR['"]\)/g, "toLocaleString('en-US')");
    
    if (content !== original) {
        fs.writeFileSync(filePath, content);
        console.log(`✅ Updated: ${filePath}`);
    }
}

const filesToFix = [
    'public/app.js',
    'public/index.html',
    'public/shipping.html',
    'admin_funcs.txt',
    'server.js'
];

filesToFix.forEach(f => replaceInFile(path.join(process.cwd(), f)));
console.log('Done.');
