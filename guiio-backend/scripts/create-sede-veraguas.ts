import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const sede = await prisma.sede.create({
    data: { name: 'Veraguas' },
  });
  console.log('Sede creada:', sede);

  const allSedes = await prisma.sede.findMany({ orderBy: { name: 'asc' } });
  console.log('\nSedes activas:');
  allSedes.forEach(s => console.log(` - ${s.name} (${s.id})`));

  await prisma.$disconnect();
  await pool.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
