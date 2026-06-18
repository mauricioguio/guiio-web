import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const VERAGUAS_ID = 'cmqjjhjjv00002po51yp7kd6y';

// Precio Veraguas por prefijo de nombre de producto
const PRICE_RULES: { prefix: string; price: number }[] = [
  { prefix: 'Scrub Nicolás',   price: 140000 },
  { prefix: 'Scrub Santiago',  price: 140000 },
  { prefix: 'Scrub Matheo',    price: 140000 },
  { prefix: 'Scrub Valentina', price: 140000 },
  { prefix: 'Scrub Antonella', price: 140000 },
  { prefix: 'Scrub Sofía',     price: 140000 },
  { prefix: 'Scrub Luciana',   price: 150000 },
  { prefix: 'Scrub Isabella',  price: 150000 },
  { prefix: 'Bata Salomé',     price: 100000 },
  { prefix: 'Gorro Quirúrgico Clásico Unisex', price: 20000 },
  { prefix: 'Gorro Quirúrgico Para Mujer',     price: 25000 },
];

async function main() {
  const products = await prisma.product.findMany({
    select: { id: true, name: true, price: true },
  });

  let upserted = 0;
  let skipped = 0;

  for (const product of products) {
    const rule = PRICE_RULES.find(r => product.name.startsWith(r.prefix));
    if (!rule) { skipped++; continue; }

    await prisma.sedeProductPrice.upsert({
      where: { sedeId_productId: { sedeId: VERAGUAS_ID, productId: product.id } },
      create: { sedeId: VERAGUAS_ID, productId: product.id, price: rule.price },
      update: { price: rule.price },
    });

    console.log(`✓ ${product.name}: $${product.price.toLocaleString()} → $${rule.price.toLocaleString()}`);
    upserted++;
  }

  console.log(`\n${upserted} precios configurados en Veraguas, ${skipped} productos sin regla (usan precio base)`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
