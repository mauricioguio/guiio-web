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

  async getSedes(empresa = 'GUIIO') {
    return this.prisma.sede.findMany({
      where: { active: true, empresa },
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
      orderBy: { name: 'asc' },
    });
    return products.map(p => ({ ...p, type: p.type.toLowerCase() }));
  }

  async findCustomer(phone: string, empresa = 'GUIIO') {
    return this.prisma.sellerCustomer.findUnique({ where: { phone } });
  }

  async createCustomer(phone: string, name: string, empresa = 'GUIIO') {
    return this.prisma.sellerCustomer.upsert({
      where: { phone },
      update: { name },
      create: { phone, name, empresa },
    });
  }

  async createSale(sedeId: string, data: {
    type: 'STOCK' | 'FABRICAR';
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    deliveryDate?: string;
    paymentMethod?: string;
    initialPayment?: number;
    items: { productId: string; productName: string; size: string; quantity: number; price: number; note?: string }[];
  }) {
    if (!data.items?.length) throw new BadRequestException('La venta debe tener al menos un producto');

    const total = data.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const hasAbono = data.initialPayment && data.initialPayment > 0;
    if (hasAbono && data.initialPayment! > total) throw new BadRequestException('El abono no puede exceder el total del pedido');

    // STOCK sin abono → COMPLETED inmediatamente; STOCK con abono o FABRICAR → PENDING
    const status = data.type === 'STOCK' && !hasAbono ? 'COMPLETED' : 'PENDING';

    // Items de STOCK se marcan como entregados al crear (salen del inventario en el momento)
    const itemsData = data.items.map(item => ({
      ...item,
      deliveredQty: data.type === 'STOCK' ? item.quantity : 0,
    }));

    const sale = await this.prisma.sale.create({
      data: {
        sedeId,
        type: data.type,
        status,
        total,
        customerName: data.customerName || null,
        customerPhone: data.customerPhone || null,
        notes: data.notes || null,
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        paymentMethod: data.paymentMethod || null,
        items: { create: itemsData },
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

    if (hasAbono) {
      await this.prisma.salePayment.create({
        data: { saleId: sale.id, amount: data.initialPayment! },
      });
    }

    return sale;
  }

  async upsertInventory(sedeId: string, items: { productId: string; size: string; quantity: number }[]) {
    await Promise.all(items.map(item =>
      this.prisma.inventory.upsert({
        where: { sedeId_productId_size: { sedeId, productId: item.productId, size: item.size } },
        update: { quantity: item.quantity },
        create: { sedeId, productId: item.productId, size: item.size, quantity: item.quantity },
      })
    ));
    return { updated: items.length };
  }

  async getSales(sedeId: string) {
    return this.prisma.sale.findMany({
      where: { sedeId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllSales(empresa = 'GUIIO') {
    return this.prisma.sale.findMany({
      where: { sede: { empresa } },
      include: { items: true, payments: { orderBy: { createdAt: 'asc' } }, sede: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFabricarOrders(sedeId: string) {
    return this.prisma.sale.findMany({
      where: {
        sedeId,
        OR: [
          { type: 'FABRICAR', status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          { type: 'STOCK', status: 'PENDING' },
        ],
      },
      include: { items: true, payments: { orderBy: { createdAt: 'asc' } }, sede: { select: { id: true, name: true } } },
      orderBy: [{ deliveryDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getFabricarOrder(id: string) {
    return this.prisma.sale.findUnique({
      where: { id },
      include: { items: true, payments: { orderBy: { createdAt: 'asc' } }, sede: { select: { id: true, name: true } } },
    });
  }

  async addPayment(saleId: string, amount: number, note?: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { payments: true },
    });
    if (!sale) throw new BadRequestException('Pedido no encontrado');
    const totalPaid = sale.payments.reduce((s, p) => s + p.amount, 0);
    const maxAllowed = sale.total - totalPaid;
    if (amount <= 0) throw new BadRequestException('El monto debe ser mayor a cero');
    if (amount > maxAllowed) throw new BadRequestException(`El abono no puede exceder el saldo pendiente`);

    const payment = await this.prisma.salePayment.create({
      data: { saleId, amount, note: note || null },
    });
    if (totalPaid + amount >= sale.total) {
      await this.prisma.sale.update({ where: { id: saleId }, data: { status: 'COMPLETED' } });
    }
    return payment;
  }

  async updateDeliveredQty(saleId: string, items: { itemId: string; deliveredQty: number }[]) {
    await Promise.all(items.map(({ itemId, deliveredQty }) =>
      this.prisma.saleItem.update({ where: { id: itemId }, data: { deliveredQty } }),
    ));
    return this.getFabricarOrder(saleId);
  }

  async getNextOrderNumber(empresa = 'GUIIO'): Promise<{ nextOrderNumber: number }> {
    const last = await this.prisma.sale.findFirst({
      where: { sede: { empresa } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });
    return { nextOrderNumber: (last?.orderNumber ?? 0) + 1 };
  }

  async updateSaleStatus(saleId: string, status: string) {
    return this.prisma.sale.update({
      where: { id: saleId },
      data: { status: status as any },
      include: { items: true, sede: { select: { id: true, name: true } } },
    });
  }

  async getUnifiedSales(empresa = 'GUIIO') {
    const [orders, sales] = await Promise.all([
      this.prisma.order.findMany({
        include: { customer: true, items: true },
      }),
      this.prisma.sale.findMany({
        where: { sede: { empresa } },
        include: { items: true, sede: true },
      }),
    ]);

    const normalized = [
      ...orders.map(o => ({
        id: o.id,
        channel: 'online' as const,
        channelName: 'Online',
        customerName: o.customer?.name ?? null,
        customerPhone: o.customer?.phone ?? null,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
        itemCount: o.items.length,
        items: o.items.map(i => ({
          productName: i.productName,
          quantity: i.quantity,
          price: i.price,
          size: [i.topSize, i.bottomSize].filter(Boolean).join('/'),
        })),
        paymentMethod: o.paymentProvider ?? null,
        reference: o.reference,
        orderNumber: undefined,
        type: undefined,
      })),
      ...sales.map(s => ({
        id: s.id,
        channel: 'fisica' as const,
        channelName: s.sede.name,
        customerName: s.customerName ?? null,
        customerPhone: s.customerPhone ?? null,
        total: s.total,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        itemCount: s.items.length,
        items: s.items.map(i => ({
          productName: i.productName,
          quantity: i.quantity,
          price: i.price,
          size: i.size,
        })),
        paymentMethod: s.paymentMethod ?? null,
        reference: undefined,
        orderNumber: s.orderNumber,
        type: s.type,
      })),
    ];

    return normalized.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
}
