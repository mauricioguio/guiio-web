import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SALITRE_ID  = 'cmp5znnk400001v8q1hn5y11q';
const VERAGUAS_ID = 'cmqjjhjjv00002po51yp7kd6y';

async function main() {
  const salitreCatalog = await prisma.inventory.findMany({
    where: { sedeId: SALITRE_ID },
    select: { productId: true, size: true },
    orderBy: [{ productId: 'asc' }, { size: 'asc' }],
  });

  console.log(`Combinaciones encontradas en Salitre: ${salitreCatalog.length}`);

  for (const item of salitreCatalog) {
    await prisma.inventory.upsert({
      where: {
        sedeId_productId_size: {
          sedeId: VERAGUAS_ID,
          productId: item.productId,
          size: item.size,
        },
      },
      create: {
        sedeId: VERAGUAS_ID,
        productId: item.productId,
        size: item.size,
        quantity: 2,
      },
      update: { quantity: 2 },
    });
  }

  console.log(`✓ ${salitreCatalog.length} referencias upserted en Veraguas (qty=2 cada una)`);

  const total = await prisma.inventory.count({ where: { sedeId: VERAGUAS_ID } });
  console.log(`Total registros en inventario Veraguas: ${total}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
