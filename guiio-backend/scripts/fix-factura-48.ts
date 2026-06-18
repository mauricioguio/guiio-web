import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const PAYMENT_ID = 'cmqiokpvk00w912mzmnhi978y';

  // Corregir el pago: de $504.000 a $252.000
  const updated = await prisma.salePayment.update({
    where: { id: PAYMENT_ID },
    data: { amount: 252000, note: 'Abono inicial - corregido' },
  });

  console.log('Pago actualizado:', updated);

  // Verificar estado final del pedido
  const order = await prisma.sale.findFirst({
    where: { orderNumber: 48 },
    include: { payments: true },
  });

  const totalPaid = order!.payments.reduce((s, p) => s + p.amount, 0);
  console.log(`\nTotal pedido: $${order!.total.toLocaleString()}`);
  console.log(`Total pagado: $${totalPaid.toLocaleString()}`);
  console.log(`Saldo pendiente: $${(order!.total - totalPaid).toLocaleString()}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
