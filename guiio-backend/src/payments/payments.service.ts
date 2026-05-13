import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePreferenceDto } from './dto/create-preference.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly publicKey: string;
  private readonly integritySecret: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.publicKey = this.config.get<string>('WOMPI_PUBLIC_KEY')!;
    this.integritySecret = this.config.get<string>('WOMPI_INTEGRITY_SECRET')!;
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
  }

  async createCheckout(dto: CreatePreferenceDto) {
    const subtotal = dto.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const total = subtotal - dto.discount + dto.shipping;
    const amountInCents = total * 100;

    const reference = `GUIIO-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const currency = 'COP';
    const redirectUrl = `${this.frontendUrl}/pago/exitoso`;

    const signature = createHash('sha256')
      .update(`${reference}${amountInCents}${currency}${this.integritySecret}`)
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
        update: { name: dto.customer.name, phone: dto.customer.phone },
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
              topSize: item.topSize,
              bottomSize: item.bottomSize,
              color: item.color,
              productId: item.id,
            })),
          },
        },
      });
    } catch (err) {
      this.logger.error('Error saving order to DB:', err);
    }

    return { checkoutUrl, reference, total };
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
      }
    } catch (err) {
      this.logger.error('Webhook error:', err);
    }
    return { received: true };
  }
}
