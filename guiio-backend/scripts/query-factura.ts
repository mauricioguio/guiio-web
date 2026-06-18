import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const order = await prisma.sale.findFirst({
    where: { orderNumber: 48 },
    include: {
      items: true,
      payments: { orderBy: { createdAt: 'asc' } },
      sede: { select: { name: true } },
    },
  });
  console.log(JSON.stringify(order, null, 2));
  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
