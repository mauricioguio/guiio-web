import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const women = await prisma.product.findMany({
    where: { gender: 'mujer', active: true },
    select: { id: true, name: true, topSizes: true, bottomSizes: true, type: true },
  });

  console.log(`Found ${women.length} women's products`);

  let updated = 0;
  for (const p of women) {
    const newTop = p.topSizes.includes('XXS') ? p.topSizes : ['XXS', ...p.topSizes];
    const newBot = p.bottomSizes.includes('XXS') ? p.bottomSizes : ['XXS', ...p.bottomSizes];

    const changed =
      newTop.length !== p.topSizes.length || newBot.length !== p.bottomSizes.length;

    if (changed) {
      await prisma.product.update({
        where: { id: p.id },
        data: { topSizes: newTop, bottomSizes: newBot },
      });
      console.log(`✓ ${p.name}`);
      updated++;
    }
  }

  console.log(`\nDone: ${updated} products updated.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
