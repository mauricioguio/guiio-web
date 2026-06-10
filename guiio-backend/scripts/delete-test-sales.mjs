import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_MEQt2ITwPG0B@ep-hidden-meadow-ac2c2jfg.sa-east-1.aws.neon.tech/neondb?sslmode=require',
});

await client.connect();

// Ver ventas que se borrarán (no son de hoy en zona Colombia)
const preview = await client.query(`
  SELECT id, "createdAt" AT TIME ZONE 'America/Bogota' AS fecha_bogota, "customerName", total
  FROM "Sale"
  WHERE DATE("createdAt" AT TIME ZONE 'America/Bogota') < '2026-05-21'
  ORDER BY "createdAt" DESC
`);

if (preview.rows.length === 0) {
  console.log('No hay ventas anteriores al 21/05 para eliminar.');
  await client.end();
  process.exit(0);
}

console.log(`\nVentas a eliminar (${preview.rows.length}):`);
for (const r of preview.rows) {
  console.log(`  ${r.id} | ${r.fecha_bogota.toISOString().slice(0,16)} | ${r.customerName ?? '(sin nombre)'} | $${r.total}`);
}

// Confirmar con argumento --confirm
if (!process.argv.includes('--confirm')) {
  console.log('\nPara eliminar, corre el script con --confirm');
  await client.end();
  process.exit(0);
}

const result = await client.query(`
  DELETE FROM "Sale"
  WHERE DATE("createdAt" AT TIME ZONE 'America/Bogota') < '2026-05-21'
`);

console.log(`\nEliminadas ${result.rowCount} ventas.`);
await client.end();
