import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const orders = await (prisma as any).sale.findMany({
    where: { orderNumber: { gte: 14, lte: 24 } },
    select: { id: true, orderNumber: true, customerName: true },
    orderBy: { orderNumber: 'asc' },
  });

  console.log('Pedidos encontrados:');
  console.table(orders);

  if (orders.length === 0) {
    console.log('No se encontraron pedidos en ese rango.');
    return;
  }

  const ids = orders.map((o: any) => o.id);

  const p1 = await (prisma as any).salePayment.deleteMany({ where: { saleId: { in: ids } } });
  const p2 = await (prisma as any).saleItem.deleteMany({ where: { saleId: { in: ids } } });
  const p3 = await (prisma as any).sale.deleteMany({ where: { id: { in: ids } } });

  console.log(`✓ Eliminados: ${p1.count} pagos, ${p2.count} ítems, ${p3.count} pedidos.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
