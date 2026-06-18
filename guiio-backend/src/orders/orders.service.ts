import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  findAll(status?: string) {
    return this.prisma.order.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        customer: true,
        items: {},
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {},
      },
    });
  }

  async updateStatus(id: string, status: string) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status: status as any },
      include: { customer: true, items: {} },
    });

    if (status === 'SHIPPED' && order.customer.email) {
      await this.email.sendShippedNotification({
        reference: order.reference,
        customerName: order.customer.name,
        customerEmail: order.customer.email,
        customerPhone: order.customer.phone,
        customerCedula: order.customer.cedula ?? null,
        address: order.address,
        city: order.city,
        notes: order.notes ?? null,
        total: order.total,
        shipping: order.shipping,
        discount: order.discount,
        items: order.items.map(i => ({
          productName: i.productName,
          color: i.color,
          topSize: i.topSize,
          bottomSize: i.bottomSize ?? '',
          quantity: i.quantity,
          price: i.price,
        })),
      });
    }

    return order;
  }

  async deleteOrder(id: string) {
    await this.prisma.orderItem.deleteMany({ where: { orderId: id } });
    return this.prisma.order.delete({ where: { id } });
  }
}
