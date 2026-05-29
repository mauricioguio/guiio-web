import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PREDEFINED_COLORS = [
  { name: 'Palo Rosa',       hex: '#e8b5be' },
  { name: 'Azul Rey',        hex: '#3554b7' },
  { name: 'Vinotinto',       hex: '#7a1e2d' },
  { name: 'Beige',           hex: '#e1d5d5' },
  { name: 'Turquesa',        hex: '#378db6' },
  { name: 'Verde Hoja Seca', hex: '#bdced6' },
  { name: 'Gris Perla',      hex: '#d4d7e6' },
  { name: 'Azul Oscuro',     hex: '#212e51' },
  { name: 'Verde Petróleo',  hex: '#2e6d89' },
  { name: 'Blanco',          hex: '#ffffff' },
  { name: 'Negro',           hex: '#000000' },
  { name: 'Lila',            hex: '#c1b3d4' },
  { name: 'Verde Jade',      hex: '#1f5e70' },
  { name: 'Rojo',            hex: '#c20423' },
  { name: 'Berengena',       hex: '#470123' },
  { name: 'Azul Cielo',      hex: '#70afe4' },
  { name: 'Gris Ratón',      hex: '#463e49' },
  { name: 'Verde Oliva',     hex: '#4a4726' },
  { name: 'Verde Militar',   hex: '#4a4726' },
  { name: 'Verde Menta',     hex: '#abd8dd' },
  { name: 'Morado',          hex: '#b13bab' },
  { name: 'Fucsia',          hex: '#ed0085' },
];

function detectColors(name: string) {
  const lower = name.toLowerCase();
  return PREDEFINED_COLORS.filter(c => lower.includes(c.name.toLowerCase()));
}

async function main() {
  const products = await prisma.product.findMany();
  let updated = 0;

  for (const product of products) {
    const existing = (product.colors as any[]) ?? [];
    if (existing.length > 0) continue; // ya tiene colores, no tocar

    const detected = detectColors(product.name);
    if (!detected.length) {
      console.log(`⚠️  Sin coincidencia: "${product.name}"`);
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { colors: detected },
    });

    console.log(`✅ "${product.name}" → ${detected.map(c => c.name).join(', ')}`);
    updated++;
  }

  console.log(`\nActualizados: ${updated} / ${products.length} productos`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
