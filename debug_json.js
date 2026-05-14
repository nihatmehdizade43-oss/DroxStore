const fs = require('fs');
require('dotenv').config();

const b64Key = process.env.FIREBASE_SERVICE_ACCOUNT_B64.trim().replace(/\s/g, '');
const decoded = Buffer.from(b64Key, 'base64').toString('utf8');

console.log("--- DECODED START ---");
console.log(decoded);
console.log("--- DECODED END ---");

const fixedDecoded = decoded.replace(/"([^"]*)"/g, (match, p1) => {
    return '"' + p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
});

console.log("--- FIXED START ---");
console.log(fixedDecoded);
console.log("--- FIXED END ---");

try {
    JSON.parse(fixedDecoded);
    console.log("✅ JSON.parse success!");
} catch (e) {
    console.log("❌ JSON.parse failed:", e.message);
    // Find where it failed
    const pos = parseInt(e.message.match(/position (\d+)/)?.[1]);
    if (pos) {
        console.log("Error around:", fixedDecoded.substring(pos - 20, pos + 20));
    }
}
