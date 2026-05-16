import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SellerService {
  constructor(private readonly prisma: PrismaService) {}

  async auth(sedeId: string, pin: string) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede || !sede.pin || sede.pin !== pin) {
      throw new UnauthorizedException('PIN incorrecto');
    }
    return { id: sede.id, name: sede.name };
  }

  async getSedes() {
    return this.prisma.sede.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async getInventory(sedeId: string) {
    const items = await this.prisma.inventory.findMany({
      where: { sedeId },
      include: { sede: { select: { id: true, name: true } } },
    });
    const productIds = [...new Set(items.map(i => i.productId))];
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds }, active: true },
        })
      : [];
    return { items, products: products.map(p => ({ ...p, type: p.type.toLowerCase() })) };
  }

  async getProducts() {
    const products = await this.prisma.product.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return products.map(p => ({ ...p, type: p.type.toLowerCase() }));
  }

  async createSale(sedeId: string, data: {
    type: 'STOCK' | 'FABRICAR';
    customerName?: string;
    notes?: string;
    items: { productId: string; productName: string; size: string; quantity: number; price: number; note?: string }[];
  }) {
    if (!data.items?.length) throw new BadRequestException('La venta debe tener al menos un producto');

    const total = data.items.reduce((s, i) => s + i.price * i.quantity, 0);

    const sale = await this.prisma.sale.create({
      data: {
        sedeId,
        type: data.type,
        status: data.type === 'STOCK' ? 'COMPLETED' : 'PENDING',
        total,
        customerName: data.customerName || null,
        notes: data.notes || null,
        items: { create: data.items },
      },
      include: { items: true, sede: { select: { id: true, name: true } } },
    });

    if (data.type === 'STOCK') {
      for (const item of data.items) {
        await this.prisma.inventory.updateMany({
          where: { sedeId, productId: item.productId, size: item.size },
          data: { quantity: { decrement: item.quantity } },
        });
      }
    }

    return sale;
  }

  async getSales(sedeId: string) {
    return this.prisma.sale.findMany({
      where: { sedeId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllSales() {
    return this.prisma.sale.findMany({
      include: { items: true, sede: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateSaleStatus(saleId: string, status: string) {
    return this.prisma.sale.update({
      where: { id: saleId },
      data: { status: status as any },
      include: { items: true, sede: { select: { id: true, name: true } } },
    });
  }
}
