import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface EditChanges {
  itemsToAdd?: { productName: string; topSize: string; bottomSize: string; color: string; quantity: number; price: number }[];
  itemsToModify?: { itemId: string; quantity?: number; price?: number }[];
  itemsToRemove?: string[];
}

@Injectable()
export class OrderEditRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(
    orderId: string,
    requestedBy: string,
    changes: EditChanges,
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const pending = await this.prisma.orderEditRequest.findFirst({
      where: { orderId, status: 'PENDING' },
    });
    if (pending) throw new BadRequestException('Ya hay una solicitud pendiente para este pedido');

    return this.prisma.orderEditRequest.create({
      data: { orderId, requestedBy, reason, changes: changes as any },
    });
  }

  findPending() {
    return this.prisma.orderEditRequest.findMany({
      where: { status: 'PENDING' },
      include: { order: { include: { customer: true, items: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  findByOrder(orderId: string) {
    return this.prisma.orderEditRequest.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async review(id: string, approved: boolean, reviewNote?: string) {
    const request = await this.prisma.orderEditRequest.findUnique({
      where: { id },
      include: { order: { include: { items: true } } },
    });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== 'PENDING') throw new BadRequestException('Esta solicitud ya fue revisada');

    await this.prisma.orderEditRequest.update({
      where: { id },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        reviewNote,
        reviewedAt: new Date(),
      },
    });

    if (!approved) return { success: true };

    const changes = request.changes as EditChanges;
    const order = request.order;

    // Aplicar cambios al pedido
    if (changes.itemsToRemove?.length) {
      await this.prisma.orderItem.deleteMany({
        where: { id: { in: changes.itemsToRemove }, orderId: order.id },
      });
    }

    for (const mod of changes.itemsToModify ?? []) {
      await this.prisma.orderItem.update({
        where: { id: mod.itemId },
        data: {
          ...(mod.quantity !== undefined && { quantity: mod.quantity }),
          ...(mod.price !== undefined && { price: mod.price }),
        },
      });
    }

    if (changes.itemsToAdd?.length) {
      await this.prisma.orderItem.createMany({
        data: changes.itemsToAdd.map(item => ({ ...item, orderId: order.id })),
      });
    }

    // Recalcular total
    const updatedItems = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
    const newTotal = updatedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    await this.prisma.order.update({
      where: { id: order.id },
      data: { total: newTotal },
    });

    return { success: true };
  }
}
