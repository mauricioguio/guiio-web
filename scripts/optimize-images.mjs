const API = 'https://guiio-web-production.up.railway.app/api';
const ADMIN_KEY = 'guiio-admin-key-2024';
const headers = { 'x-admin-key': ADMIN_KEY, 'Content-Type': 'application/json' };

function optimizeUrl(url) {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  // Replace any existing upload transformation with the full optimized version
  return url.replace(/\/upload\/(f_auto,q_auto(?:,w_\d+,c_limit)?\/)?/, '/upload/f_auto,q_auto,w_1200,c_limit/');
}

const res = await fetch(`${API}/products`, { headers });
const products = await res.json();

console.log(`Total productos: ${products.length}`);

let updated = 0;
let skipped = 0;

for (const p of products) {
  const newImages = p.images.map(optimizeUrl);
  const changed = newImages.some((url, i) => url !== p.images[i]);

  if (!changed) { skipped++; continue; }

  const body = JSON.stringify({ ...p, images: newImages });
  const r = await fetch(`${API}/products/${p.id}`, { method: 'PATCH', headers, body });

  if (r.ok) {
    console.log(`✓ ${p.name}`);
    updated++;
  } else {
    console.log(`✗ ${p.name} - error ${r.status}`);
  }
}

console.log(`\nActualizados: ${updated} | Sin cambios: ${skipped}`);
