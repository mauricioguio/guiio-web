import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.collection.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  create(data: any) {
    return this.prisma.collection.create({ data });
  }

  async update(id: string, data: any) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data;
    return this.prisma.collection.update({ where: { id }, data: rest });
  }

  async remove(id: string) {
    await this.prisma.collection.delete({ where: { id } });
    return { deleted: true };
  }

  private serialize(p: any) {
    return { ...p, type: p.type.toLowerCase() };
  }

  async getProducts(collectionId: string, onlyActive = false) {
    const links = await this.prisma.collectionProduct.findMany({
      where: { collectionId },
      include: { product: true },
    });
    const filtered = onlyActive ? links.filter(l => l.product.active) : links;
    return filtered.map(({ product }) => this.serialize(product));
  }

  async getProductsByName(name: string) {
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const target = normalize(name);

    const products = await this.prisma.product.findMany({ where: { active: true } });
    const byField = products
      .filter(p => normalize(p.collection) === target)
      .map(p => this.serialize(p));

    // Also include products explicitly assigned via join table (extra assignments from admin)
    const cols = await this.prisma.collection.findMany();
    const col = cols.find(c => normalize(c.name) === target);
    const byJoin = col ? await this.getProducts(col.id, true) : [];
    const seenIds = new Set(byField.map(p => p.id));

    return [...byField, ...byJoin.filter(p => !seenIds.has(p.id))];
  }

  async addProduct(collectionId: string, productId: string) {
    await this.prisma.collectionProduct.upsert({
      where: { productId_collectionId: { productId, collectionId } },
      create: { productId, collectionId },
      update: {},
    });
    return { added: true };
  }

  async removeProduct(collectionId: string, productId: string) {
    await this.prisma.collectionProduct.deleteMany({
      where: { productId, collectionId },
    });
    return { removed: true };
  }
}
