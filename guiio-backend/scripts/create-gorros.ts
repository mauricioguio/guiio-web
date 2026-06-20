import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const COLORS_COMUNES = [
  { name: 'Azul Cielo',  hex: '#64B5F6' },
  { name: 'Verde',       hex: '#81C784' },
  { name: 'Blanco',      hex: '#F5F5F5' },
  { name: 'Azul Marino', hex: '#3554b7' },
  { name: 'Gris',        hex: '#90A4AE' },
];

const PRODUCTS = [
  {
    name: 'Gorro Quirúrgico Clásico Unisex',
    description: 'El esencial de cada quirófano. Nuestro Gorro Quirúrgico Clásico ofrece cobertura total, ajuste seguro y transpirabilidad para largas jornadas. Confeccionado en tela antifluida de alta calidad, ideal para médicos, enfermeros y personal de salud. Talla única que se adapta cómodamente a cualquier cabeza.',
    price: 35000,
    gender: 'unisex',
  },
  {
    name: 'Gorro Quirúrgico Para Mujer',
    description: 'Diseñado especialmente para las profesionales de la salud. Este gorro cuenta con un compartimento trasero para recoger y proteger el cabello largo, manteniéndolo completamente cubierto y seguro durante todo el procedimiento. Cómodo, funcional y con acabados pensados para la mujer que no sacrifica estilo por protocolo. Talla única.',
    price: 40000,
    gender: 'mujer',
  },
];

async function main() {
  // 1. Crear colección Gorros
  const collection = await prisma.collection.upsert({
    where: { name: 'Gorros' },
    create: {
      name: 'Gorros',
      description: 'Gorros quirúrgicos para todo el equipo de salud — comodidad, protección y estilo en cada turno.',
      featured: false,
      order: 11,
    },
    update: {},
  });
  console.log(`✅ Colección: "${collection.name}" (${collection.id})`);

  // 2. Crear productos
  for (const data of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        collection: 'Gorros',
        type: 'OTRO',
        gender: data.gender,
        featured: false,
        inStock: true,
        active: true,
        tags: ['gorro', 'quirúrgico', 'antifluido', data.gender],
        images: [],
        topSizes: ['Único'],
        bottomSizes: [],
        colors: COLORS_COMUNES,
      },
    });
    console.log(`✅ Producto: "${product.name}" (${product.id})`);

    await prisma.collectionProduct.create({
      data: { productId: product.id, collectionId: collection.id },
    });
    console.log(`   → Asignado a "Gorros"`);
  }

  console.log('\n🎉 Listo — 2 gorros creados y asignados a la colección Gorros');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
