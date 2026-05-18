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

  async getProducts(collectionId: string) {
    const links = await this.prisma.collectionProduct.findMany({
      where: { collectionId },
      include: { product: true },
    });
    return links.map(({ product }) => this.serialize(product));
  }

  async getProductsByName(name: string) {
    const col = await this.prisma.collection.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (!col) return [];
    return this.getProducts(col.id);
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
