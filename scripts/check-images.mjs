const API = 'https://guiio-web-production.up.railway.app/api';
const ADMIN_KEY = 'guiio-admin-key-2024';
const headers = { 'x-admin-key': ADMIN_KEY };

const res = await fetch(`${API}/products`, { headers });
const products = await res.json();

const urlSamples = new Set();
for (const p of products) {
  for (const img of p.images) {
    if (img) urlSamples.add(img);
    if (urlSamples.size >= 10) break;
  }
  if (urlSamples.size >= 10) break;
}

console.log('Ejemplos de URLs almacenadas:');
for (const url of urlSamples) console.log(' ', url);
