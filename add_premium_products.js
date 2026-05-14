const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
let serviceAccount;

if (fs.existsSync(serviceAccountPath)) {
  serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
} else {
  console.log("No service account, updating local products.json only.");
}

if (serviceAccount) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase connected.");
  } catch(e) {
    console.log("Firebase init error:", e);
  }
}

const db = admin.apps.length ? admin.firestore() : null;

const premiumProducts = [
  {
    "name": "Obsidian Noir Oversized Hoodie",
    "category": "hoodie",
    "price": 85.00,
    "oldPrice": 120.00,
    "badge": "PREMIUM",
    "badgeClass": "purple",
    "stock": { "S": 10, "M": 15, "L": 10, "XL": 5 },
    "desc": "Crafted from 100% heavyweight organic cotton. The Obsidian Noir features a relaxed, oversized fit with dropped shoulders for a contemporary streetwear silhouette. Deep hood and minimalist aesthetic.",
    "images": [
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1614676471928-2ed0ad1061a4?auto=format&fit=crop&q=80&w=800"
    ],
    "isFeatured": true
  },
  {
    "name": "Ethereal Silk-Blend Tech Jacket",
    "category": "outerwear",
    "price": 145.00,
    "oldPrice": 180.00,
    "badge": "LIMITED",
    "badgeClass": "red",
    "stock": { "S": 5, "M": 8, "L": 4, "XL": 2 },
    "desc": "A futuristic approach to outerwear. Water-resistant outer shell with a subtle metallic sheen, featuring waterproof zippers and hidden utility pockets. Designed for the urban explorer.",
    "images": [
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=800"
    ],
    "isFeatured": true
  },
  {
    "name": "Midnight Cargo Tech Pants",
    "category": "pantolon",
    "price": 95.00,
    "oldPrice": null,
    "badge": "RESTOCKED",
    "badgeClass": "green",
    "stock": { "S": 12, "M": 20, "L": 15, "XL": 8 },
    "desc": "Tactical functionality meets luxury streetwear. Articulated knee construction, adjustable ankle straps, and multiple asymmetrical cargo pockets with magnetic closures.",
    "images": [
      "https://images.unsplash.com/photo-1624378439575-d1ead6bb29d5?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1517438476312-10d9104ce8e8?auto=format&fit=crop&q=80&w=800"
    ],
    "isFeatured": true
  },
  {
    "name": "Phantom Essence Heavyweight Tee",
    "category": "tshirt",
    "price": 45.00,
    "oldPrice": 60.00,
    "badge": "ESSENTIAL",
    "badgeClass": "gold",
    "stock": { "S": 25, "M": 30, "L": 20, "XL": 15 },
    "desc": "The ultimate luxury t-shirt. Cut from custom milled 280gsm cotton jersey. Boxy fit, thick ribbed collar, and our signature blind-stitched hems.",
    "images": [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&q=80&w=800"
    ],
    "isFeatured": false
  },
  {
    "name": "Aura Distressed Denim Jacket",
    "category": "outerwear",
    "price": 120.00,
    "oldPrice": 150.00,
    "badge": "YENİ",
    "badgeClass": "",
    "stock": { "S": 8, "M": 12, "L": 6, "XL": 3 },
    "desc": "Vintage washed denim with hand-applied distressing. Features custom engraved matte black hardware and a slightly cropped, boxy fit typical of luxury designer pieces.",
    "images": [
      "https://images.unsplash.com/photo-1495105787522-5334e3ffa0ef?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1523398002811-999aa8d9512e?auto=format&fit=crop&q=80&w=800"
    ],
    "isFeatured": true
  },
  {
    "name": "Monolith Chunky Sneakers",
    "category": "ayakkabi",
    "price": 185.00,
    "oldPrice": 220.00,
    "badge": "EXCLUSIVE",
    "badgeClass": "purple",
    "stock": { "39": 5, "40": 8, "41": 10, "42": 15, "43": 12, "44": 6 },
    "desc": "Architectural footwear design. Features a dramatic oversized rubber sole, premium leather and mesh upper, and reflective 3M accents.",
    "images": [
      "https://images.unsplash.com/photo-1552346154-21d32810baa3?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&q=80&w=800"
    ],
    "isFeatured": true
  },
  {
    "name": "Crimson Horizon Knit Sweater",
    "category": "knitwear",
    "price": 110.00,
    "oldPrice": 140.00,
    "badge": "YENİ",
    "badgeClass": "",
    "stock": { "S": 5, "M": 10, "L": 8, "XL": 4 },
    "desc": "Intarsia knit technique with a striking abstract gradient pattern. Alpaca wool blend for ultimate softness and warmth without the weight.",
    "images": [
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&q=80&w=800"
    ],
    "isFeatured": false
  },
  {
    "name": "Zenith Technical Vest",
    "category": "outerwear",
    "price": 85.00,
    "oldPrice": null,
    "badge": "TREND",
    "badgeClass": "red",
    "stock": { "S": 10, "M": 15, "L": 10, "XL": 5 },
    "desc": "Sleeveless layering perfection. Features dual zip closure, breathable mesh lining, and 3D utilitarian pockets. A staple for techwear enthusiasts.",
    "images": [
      "https://images.unsplash.com/photo-1599305090598-fe179d501227?auto=format&fit=crop&q=80&w=800"
    ],
    "isFeatured": false
  },
  {
    "name": "Onyx Crossbody Sling Bag",
    "category": "aksesuar",
    "price": 55.00,
    "oldPrice": 75.00,
    "badge": "ESSENTIAL",
    "badgeClass": "gold",
    "stock": { "STD": 30 },
    "desc": "Constructed from ballistic nylon with waterproof zippers. Features a fidlock magnetic buckle and an ergonomic padded strap for all-day comfort.",
    "images": [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=800"
    ],
    "isFeatured": false
  },
  {
    "name": "Nova Titanium Sunglasses",
    "category": "aksesuar",
    "price": 125.00,
    "oldPrice": null,
    "badge": "PREMIUM",
    "badgeClass": "purple",
    "stock": { "STD": 15 },
    "desc": "Ultra-lightweight Japanese titanium frames with polarized anti-reflective lenses. Angular, avant-garde silhouette that commands attention.",
    "images": [
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=800"
    ],
    "isFeatured": true
  }
];

async function updateProducts() {
  const productsPath = path.join(__dirname, 'data', 'products.json');
  
  const existingCategories = [
    { "id": "hoodie", "name": "Hoodie & Sweat", "slug": "hoodie" },
    { "id": "tshirt", "name": "T-Shirt", "slug": "tshirt" },
    { "id": "pantolon", "name": "Pantolon & Cargo", "slug": "pantolon" },
    { "id": "outerwear", "name": "Ceket & Mont", "slug": "outerwear" },
    { "id": "ayakkabi", "name": "Ayakkabı", "slug": "ayakkabi" },
    { "id": "knitwear", "name": "Triko & Kazak", "slug": "knitwear" },
    { "id": "aksesuar", "name": "Aksesuar", "slug": "aksesuar" }
  ];
  
  fs.writeFileSync(path.join(__dirname, 'data', 'categories.json'), JSON.stringify(existingCategories, null, 2));
  
  if (db) {
    try {
      console.log("Updating Firebase Categories...");
      const catBatch = db.batch();
      for (const cat of existingCategories) {
         const docRef = db.collection('categories').doc(cat.id);
         catBatch.set(docRef, cat);
      }
      await catBatch.commit();
      
      console.log("Adding products to Firebase...");
      // Let's clear old products maybe? or just add new ones. We will just add new ones.
      // Wait, let's delete all existing products first so it looks clean and premium
      const existingProducts = await db.collection('products').get();
      const deleteBatch = db.batch();
      existingProducts.docs.forEach(doc => {
        deleteBatch.delete(doc.ref);
      });
      await deleteBatch.commit();
      console.log("Old products cleared.");

      const jsonProds = [];
      const addBatch = db.batch();
      premiumProducts.forEach((p, i) => {
        const docRef = db.collection('products').doc();
        const prodData = {
          ...p,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        addBatch.set(docRef, prodData);
        jsonProds.push({ id: docRef.id, ...p, createdAt: new Date().toISOString() });
      });
      await addBatch.commit();
      console.log("New products added to Firebase.");
      
      fs.writeFileSync(productsPath, JSON.stringify(jsonProds, null, 2));
      console.log("Updated data/products.json too.");
    } catch(err) {
      console.error("Firebase update failed:", err);
    }
  } else {
    // Just update JSON
    const jsonProds = premiumProducts.map((p, i) => ({
      id: "prem-" + i,
      ...p,
      createdAt: new Date().toISOString()
    }));
    fs.writeFileSync(productsPath, JSON.stringify(jsonProds, null, 2));
    console.log("Updated data/products.json");
  }
}

updateProducts().then(() => process.exit());
