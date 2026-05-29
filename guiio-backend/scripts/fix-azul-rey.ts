import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const products = await prisma.product.findMany();
  let updated = 0;

  for (const product of products) {
    const colors = (product.colors as any[]) ?? [];
    const idx = colors.findIndex((c: any) => c.name === 'Azul Rey');
    if (idx === -1) continue;
    if (colors[idx].hex === '#3554b7') continue;

    colors[idx] = { ...colors[idx], hex: '#3554b7' };
    await prisma.product.update({ where: { id: product.id }, data: { colors } });
    console.log(`✅ "${product.name}" → Azul Rey corregido`);
    updated++;
  }

  console.log(`\nActualizados: ${updated} productos`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
