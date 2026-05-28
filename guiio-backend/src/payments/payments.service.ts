import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePreferenceDto } from './dto/create-preference.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly publicKey: string;
  private readonly integritySecret: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {
    this.publicKey = this.config.get<string>('WOMPI_PUBLIC_KEY')!;
    this.integritySecret = this.config.get<string>('WOMPI_INTEGRITY_SECRET')!;
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
  }

  async createCheckout(dto: CreatePreferenceDto) {
    const subtotal = dto.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const total = subtotal - dto.discount + dto.shipping;
    const amountInCents = Math.round(total * 100);

    const reference = `GUIIO-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const currency = 'COP';
    const redirectUrl = `${this.frontendUrl}/pago/resultado`;

    const integritySecret = this.integritySecret?.trim();
    const sigString = `${reference}${amountInCents}${currency}${integritySecret}`;

    const signature = createHash('sha256')
      .update(sigString)
      .digest('hex');

    const checkoutUrl =
      `https://checkout.wompi.co/p/` +
      `?public-key=${encodeURIComponent(this.publicKey)}` +
      `&currency=${currency}` +
      `&amount-in-cents=${amountInCents}` +
      `&reference=${encodeURIComponent(reference)}` +
      `&signature:integrity=${signature}` +
      `&redirect-url=${encodeURIComponent(redirectUrl)}`;

    try {
      const fullAddress = dto.customer.reference
        ? `${dto.customer.address} (${dto.customer.reference})`
        : dto.customer.address;

      const customer = await this.prisma.customer.upsert({
        where: { email: dto.customer.email },
        update: { phone: dto.customer.phone },
        create: {
          name: dto.customer.name,
          email: dto.customer.email,
          phone: dto.customer.phone,
        },
      });

      await this.prisma.order.create({
        data: {
          reference,
          total,
          shipping: dto.shipping,
          discount: dto.discount,
          address: fullAddress,
          city: dto.customer.city,
          notes: dto.customer.notes ?? null,
          customerId: customer.id,
          items: {
            create: dto.items.map(item => ({
              quantity: item.quantity,
              price: item.price,
              productName: item.name,
              topSize: item.topSize,
              bottomSize: item.bottomSize,
              color: item.color,
            })),
          },
        },
      });
    } catch (err) {
      this.logger.error('Error saving order to DB:', err);
    }

    return { checkoutUrl, reference, total };
  }

  async verifyTransaction(wompiId: string): Promise<{ status: string }> {
    const apiBase = this.publicKey.startsWith('pub_test_')
      ? 'https://sandbox.wompi.co/v1'
      : 'https://api.wompi.co/v1';
    const res = await fetch(`${apiBase}/transactions/${wompiId}`, {
      headers: { Authorization: `Bearer ${this.publicKey}` },
    });
    const json = await res.json() as any;
    return { status: json?.data?.status ?? 'ERROR' };
  }

  async confirmOrderByReference(reference: string) {
    this.logger.log(`confirmOrder llamado para: ${reference}`);
    try {
      const order = await this.prisma.order.findUnique({
        where: { reference },
        include: { customer: true, items: true },
      });
      this.logger.log(`Order encontrada: ${order ? order.status : 'NO ENCONTRADA'}`);
      if (!order || order.status === 'PAID') return { ok: true };

      await this.prisma.order.update({
        where: { reference },
        data: { status: 'PAID' as any },
      });

      await this.email.sendOrderConfirmation({
        reference: order.reference,
        customerName: order.customer.name,
        customerEmail: order.customer.email,
        customerPhone: order.customer.phone,
        address: order.address,
        city: order.city,
        notes: order.notes,
        total: order.total,
        shipping: order.shipping,
        discount: order.discount,
        items: order.items,
      });
    } catch (err) {
      this.logger.error('confirmOrderByReference error:', err);
    }
    return { ok: true };
  }

  async handleWebhook(payload: any) {
    try {
      const event = payload?.data?.transaction;
      if (!event) return { received: true };

      const { reference, status, id: wompiTxId } = event;
      if (!reference) return { received: true };

      const orderStatus =
        status === 'APPROVED' ? 'PAID'
        : status === 'VOIDED' || status === 'ERROR' ? 'CANCELLED'
        : null;

      if (orderStatus) {
        await this.prisma.order.updateMany({
          where: { reference },
          data: { status: orderStatus as any, wompiTxId },
        });

        if (orderStatus === 'PAID') {
          const order = await this.prisma.order.findUnique({
            where: { reference },
            include: { customer: true, items: true },
          });
          if (order) {
            await this.email.sendOrderConfirmation({
              reference: order.reference,
              customerName: order.customer.name,
              customerEmail: order.customer.email,
              customerPhone: order.customer.phone,
              address: order.address,
              city: order.city,
              notes: order.notes,
              total: order.total,
              shipping: order.shipping,
              discount: order.discount,
              items: order.items,
            });
          }
        }
      }
    } catch (err) {
      this.logger.error('Webhook error:', err);
    }
    return { received: true };
  }
}
