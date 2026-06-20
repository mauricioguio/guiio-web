import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const PRODUCTS = [
  {
    name: 'Bata Salomé Blanca',
    description: 'Elegancia y pureza en un solo diseño. La Bata Salomé en blanco combina comodidad y estilo profesional para destacarte en cada turno. Confeccionada en tela antifluida de alta calidad, te mantiene fresca, segura y con un look impecable todo el día.',
    colors: [{ name: 'Blanco', hex: '#F5F5F5' }],
  },
  {
    name: 'Bata Salomé Negra',
    description: 'Sofisticación y actitud en tu uniforme de trabajo. La Bata Salomé en negro transmite autoridad y profesionalismo con un diseño moderno y funcional. Tela antifluida premium que se adapta a tu cuerpo y aguanta el ritmo de tu jornada.',
    colors: [{ name: 'Negro', hex: '#1C1C1C' }],
  },
  {
    name: 'Bata Salomé Colores Varios',
    description: 'Expresa tu personalidad con la Bata Salomé en una variedad de colores vibrantes. Diseñada para profesionales de la salud que no se conforman con lo básico, combina estilo y funcionalidad con nuestra tela antifluida de alto rendimiento. Disponible en múltiples colores para coordinar con tu equipo.',
    colors: [
      { name: 'Rosa',    hex: '#F48FB1' },
      { name: 'Lila',    hex: '#B39DDB' },
      { name: 'Azul',    hex: '#64B5F6' },
      { name: 'Verde',   hex: '#81C784' },
      { name: 'Gris',    hex: '#90A4AE' },
    ],
  },
];

async function main() {
  // 1. Crear colección Batas Mujer
  const collection = await prisma.collection.upsert({
    where: { name: 'Batas Mujer' },
    create: {
      name: 'Batas Mujer',
      description: 'Batas profesionales para mujer — diseño, comodidad y estilo en cada turno.',
      featured: false,
      order: 10,
    },
    update: {},
  });
  console.log(`✅ Colección: "${collection.name}" (${collection.id})`);

  // 2. Crear productos y asignarlos a la colección
  for (const data of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: 130000,
        collection: 'Batas Mujer',
        type: 'OTRO',
        gender: 'mujer',
        featured: false,
        inStock: true,
        active: true,
        tags: ['bata', 'mujer', 'salomé', 'antifluido'],
        images: [],
        topSizes: SIZES,
        bottomSizes: [],
        colors: data.colors,
      },
    });
    console.log(`✅ Producto: "${product.name}" (${product.id})`);

    // Asignar a la colección vía join table
    await prisma.collectionProduct.create({
      data: { productId: product.id, collectionId: collection.id },
    });
    console.log(`   → Asignado a "Batas Mujer"`);
  }

  console.log('\n🎉 Listo — 3 productos creados y asignados a Batas Mujer');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
