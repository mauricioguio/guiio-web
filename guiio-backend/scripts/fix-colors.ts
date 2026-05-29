import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const FIXES: Record<string, string> = {
  'Berengena': '#470123',
};

async function main() {
  const products = await prisma.product.findMany();
  let updated = 0;

  for (const product of products) {
    const colors = (product.colors as any[]) ?? [];
    let changed = false;

    const newColors = colors.map((c: any) => {
      const correctHex = FIXES[c.name];
      if (correctHex && c.hex !== correctHex) {
        changed = true;
        return { ...c, hex: correctHex };
      }
      return c;
    });

    if (!changed) continue;

    await prisma.product.update({ where: { id: product.id }, data: { colors: newColors } });
    console.log(`✅ "${product.name}" corregido`);
    updated++;
  }

  console.log(`\nActualizados: ${updated} productos`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
