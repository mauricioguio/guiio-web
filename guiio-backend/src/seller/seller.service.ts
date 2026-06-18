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
    const [items, sede] = await Promise.all([
      this.prisma.inventory.findMany({
        where: { sedeId },
        include: { sede: { select: { id: true, name: true } } },
      }),
      this.prisma.sede.findUnique({ where: { id: sedeId }, select: { bordadoPrice: true } }),
    ]);
    const productIds = [...new Set(items.map(i => i.productId))];
    const [products, sedePrices] = await Promise.all([
      productIds.length
        ? this.prisma.product.findMany({ where: { id: { in: productIds }, active: true } })
        : [],
      productIds.length
        ? this.prisma.sedeProductPrice.findMany({ where: { sedeId, productId: { in: productIds } } })
        : [],
    ]);
    const priceMap = new Map<string, number>(sedePrices.map(p => [p.productId, p.price] as [string, number]));
    return {
      items,
      bordadoPrice: sede?.bordadoPrice ?? 10000,
      products: products.map(p => ({
        ...p,
        type: p.type.toLowerCase(),
        price: priceMap.get(p.id) ?? p.price,
      })),
    };
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
    channel?: string;
    shipping?: number;
    shippingName?: string;
    shippingCedula?: string;
    shippingPhone?: string;
    shippingAddress?: string;
    shippingCity?: string;
    initialPayment?: number;
    items: { productId: string; productName: string; size: string; quantity: number; price: number; note?: string }[];
  }) {
    if (!data.items?.length) throw new BadRequestException('La venta debe tener al menos un producto');

    const total = data.items.reduce((s, i) => s + i.price * i.quantity, 0) + (data.shipping || 0);
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
        channel: data.channel || null,
        shipping: data.shipping || 0,
        shippingName: data.shippingName || null,
        shippingCedula: data.shippingCedula || null,
        shippingPhone: data.shippingPhone || null,
        shippingAddress: data.shippingAddress || null,
        shippingCity: data.shippingCity || null,
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

  async getOnlineOrders() {
    return this.prisma.order.findMany({
      where: { status: { not: 'CANCELLED' } },
      include: { customer: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createSaleEditRequest(saleId: string, requestedBy: string, changes: any, reason?: string) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new Error('Pedido no encontrado');
    const pending = await this.prisma.saleEditRequest.findFirst({ where: { saleId, status: 'PENDING' } });
    if (pending) throw new Error('Ya hay una solicitud pendiente para este pedido');
    return this.prisma.saleEditRequest.create({ data: { saleId, requestedBy, reason, changes } });
  }

  async getSaleEditRequests(saleId: string) {
    return this.prisma.saleEditRequest.findMany({ where: { saleId }, orderBy: { createdAt: 'desc' } });
  }

  async getPendingSaleEditRequests(empresa = 'GUIIO') {
    return this.prisma.saleEditRequest.findMany({
      where: { status: 'PENDING', sale: { sede: { empresa } } },
      include: { sale: { include: { items: true, sede: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewSaleEditRequest(id: string, approved: boolean, reviewNote?: string) {
    const req = await this.prisma.saleEditRequest.findUnique({ where: { id }, include: { sale: { include: { items: true } } } });
    if (!req) throw new Error('Solicitud no encontrada');
    if (req.status !== 'PENDING') throw new Error('Esta solicitud ya fue revisada');

    await this.prisma.saleEditRequest.update({
      where: { id },
      data: { status: approved ? 'APPROVED' : 'REJECTED', reviewNote, reviewedAt: new Date() },
    });

    if (!approved) return { success: true };

    const changes = req.changes as any;

    if (changes.itemsToRemove?.length) {
      await this.prisma.saleItem.deleteMany({ where: { id: { in: changes.itemsToRemove }, saleId: req.saleId } });
    }
    for (const mod of changes.itemsToModify ?? []) {
      await this.prisma.saleItem.update({
        where: { id: mod.itemId },
        data: {
          ...(mod.quantity !== undefined && { quantity: mod.quantity }),
          ...(mod.price !== undefined && { price: mod.price }),
        },
      });
    }
    if (changes.itemsToAdd?.length) {
      await this.prisma.saleItem.createMany({ data: changes.itemsToAdd.map((i: any) => ({ ...i, saleId: req.saleId })) });
    }

    const updatedItems = await this.prisma.saleItem.findMany({ where: { saleId: req.saleId } });
    const newTotal = updatedItems.reduce((s, i) => s + i.price * i.quantity, 0);
    await this.prisma.sale.update({ where: { id: req.saleId }, data: { total: newTotal } });

    return { success: true };
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
        where: { status: { not: 'CANCELLED' as any } },
        include: { customer: true, items: true },
      }),
      this.prisma.sale.findMany({
        where: { sede: { empresa }, status: { not: 'CANCELLED' as any } },
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

  async deleteSale(id: string) {
    await this.prisma.saleItem.deleteMany({ where: { saleId: id } });
    await this.prisma.salePayment.deleteMany({ where: { saleId: id } });
    return this.prisma.sale.delete({ where: { id } });
  }

  async editSaleItem(saleId: string, itemId: string, data: { size?: string; note?: string | null; price?: number; productName?: string }) {
    await this.prisma.saleItem.update({
      where: { id: itemId, saleId },
      data: {
        ...(data.productName !== undefined && { productName: data.productName }),
        ...(data.size !== undefined && { size: data.size }),
        ...(data.note !== undefined && { note: data.note || null }),
        ...(data.price !== undefined && { price: data.price }),
      },
    });
    const allItems = await this.prisma.saleItem.findMany({ where: { saleId } });
    const newTotal = allItems.reduce((s, i) => s + i.price * i.quantity, 0);
    return this.prisma.sale.update({
      where: { id: saleId },
      data: { total: newTotal },
      include: { items: true, payments: { orderBy: { createdAt: 'asc' } }, sede: { select: { id: true, name: true } } },
    });
  }

  async searchFabricarOrders(sedeId: string, q: string) {
    const orderNum = parseInt(q.trim(), 10);
    const searchOr: any[] = [
      { customerName: { contains: q, mode: 'insensitive' } },
      { customerPhone: { contains: q } },
    ];
    if (!isNaN(orderNum)) searchOr.push({ orderNumber: orderNum });

    return this.prisma.sale.findMany({
      where: {
        sedeId,
        AND: [
          {
            OR: [
              { type: 'FABRICAR', status: { notIn: ['COMPLETED', 'CANCELLED'] } },
              { type: 'STOCK', status: 'PENDING' },
            ],
          },
          { OR: searchOr },
        ],
      },
      include: { items: true, payments: { orderBy: { createdAt: 'asc' } }, sede: { select: { id: true, name: true } } },
      take: 5,
      orderBy: [{ deliveryDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async addItemsToOrder(saleId: string, items: { productId: string; productName: string; size: string; quantity: number; price: number; note?: string }[]) {
    await this.prisma.saleItem.createMany({
      data: items.map(i => ({
        saleId,
        productId: i.productId,
        productName: i.productName,
        size: i.size,
        quantity: i.quantity,
        price: i.price,
        note: i.note || null,
        deliveredQty: 0,
      })),
    });
    const allItems = await this.prisma.saleItem.findMany({ where: { saleId } });
    const newTotal = allItems.reduce((s, i) => s + i.price * i.quantity, 0);
    return this.prisma.sale.update({
      where: { id: saleId },
      data: { total: newTotal },
      include: { items: true, payments: { orderBy: { createdAt: 'asc' } }, sede: { select: { id: true, name: true } } },
    });
  }
}
