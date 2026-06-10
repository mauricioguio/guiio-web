import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const EMAIL = 'mauricio_.17@hotmail.com';

// Find customer
const { rows: customers } = await client.query(
  `SELECT id, name, email FROM "Customer" WHERE email = $1`,
  [EMAIL]
);

if (customers.length === 0) {
  console.log('No se encontró cliente con ese correo.');
  await client.end();
  process.exit(0);
}

const customer = customers[0];
console.log(`Cliente: ${customer.name} (${customer.email})`);

// Find orders
const { rows: orders } = await client.query(
  `SELECT id, reference, status, total, "createdAt" FROM "Order" WHERE "customerId" = $1 ORDER BY "createdAt" DESC`,
  [customer.id]
);

if (orders.length === 0) {
  console.log('No hay pedidos asociados a este cliente.');
  await client.end();
  process.exit(0);
}

console.log(`\nPedidos a eliminar (${orders.length}):`);
console.table(orders.map(o => ({
  referencia: o.reference,
  estado: o.status,
  total: o.total,
  fecha: o.createdAt,
})));

// Delete order items
const orderIds = orders.map(o => `'${o.id}'`).join(',');
const { rowCount: itemsDeleted } = await client.query(
  `DELETE FROM "OrderItem" WHERE "orderId" IN (${orderIds})`
);

// Delete orders
const { rowCount: ordersDeleted } = await client.query(
  `DELETE FROM "Order" WHERE "customerId" = $1`,
  [customer.id]
);

console.log(`\n✓ Eliminados: ${itemsDeleted} ítems, ${ordersDeleted} pedidos.`);

await client.end();
