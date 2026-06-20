import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const result = await prisma.sale.updateMany({
    where: {
      type: 'STOCK',
      NOT: { status: { in: ['COMPLETED', 'CANCELLED'] } },
    },
    data: { status: 'COMPLETED' },
  });
  console.log(`Actualizadas ${result.count} ventas de stock a COMPLETED`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
