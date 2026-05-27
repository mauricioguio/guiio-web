import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateAddiCheckoutDto } from './dto/create-addi-checkout.dto';

@Injectable()
export class AddiService {
  private readonly logger = new Logger(AddiService.name);
  private readonly apiUrl: string;
  private readonly authUrl: string;
  private readonly allySlug: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {
    this.apiUrl       = this.config.get<string>('ADDI_API_URL')   ?? 'https://api.addi.com';
    this.authUrl      = this.config.get<string>('ADDI_AUTH_URL')  ?? 'https://auth.addi.com/oauth/token';
    this.allySlug     = this.config.get<string>('ADDI_ALLY_SLUG') ?? 'guiiouniformes-ecommerce';
    this.clientId     = this.config.get<string>('ADDI_CLIENT_ID')!;
    this.clientSecret = this.config.get<string>('ADDI_CLIENT_SECRET')!;
    this.frontendUrl  = this.config.get<string>('FRONTEND_URL')   ?? 'http://localhost:4200';
  }

  private async getToken(): Promise<string> {
    const res = await fetch(this.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type:    'client_credentials',
        client_id:     this.clientId,
        client_secret: this.clientSecret,
        audience:      'https://api.addi.com',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ADDI token error: ${res.status} ${text}`);
    }

    const data = await res.json() as any;
    return data.access_token as string;
  }

  async createCheckout(dto: CreateAddiCheckoutDto) {
    const subtotal  = dto.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const total     = subtotal - dto.discount + dto.shipping;
    const reference = `GUIIO-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const [firstName, ...rest] = dto.customer.name.trim().split(' ');
    const lastName = rest.join(' ') || firstName;

    const addressLine = dto.customer.reference
      ? `${dto.customer.address} (${dto.customer.reference})`
      : dto.customer.address;

    const token = await this.getToken();

    const body = {
      clientApplicationCode: reference,
      allySlug:              this.allySlug,
      totalAmount:           total,
      currency:              'COP',
      country:               'CO',
      redirectUrls: {
        successUrl:  `${this.frontendUrl}/pago/exitoso`,
        declinedUrl: `${this.frontendUrl}/pago/fallido`,
        canceledUrl: `${this.frontendUrl}/pago/fallido`,
      },
      client: {
        idType:    'CC',
        idNumber:  dto.customer.docNumber,
        firstName,
        lastName,
        email:     dto.customer.email,
        cellphone: dto.customer.phone,
      },
      shippingAddress: {
        line1:   addressLine,
        city:    dto.customer.city,
        country: 'CO',
      },
      items: dto.items.map(i => ({
        sku:       i.id,
        name:      i.name,
        quantity:  i.quantity,
        unitPrice: i.price,
      })),
    };

    const res = await fetch(`${this.apiUrl}/applications`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ADDI application error: ${res.status} ${text}`);
    }

    const data = await res.json() as any;
    const checkoutUrl   = data.applicationUrl as string;
    const applicationId = data.id             as string;

    try {
      const customer = await this.prisma.customer.upsert({
        where:  { email: dto.customer.email },
        update: { name: dto.customer.name, phone: dto.customer.phone },
        create: { name: dto.customer.name, email: dto.customer.email, phone: dto.customer.phone },
      });

      await this.prisma.order.create({
        data: {
          reference,
          total,
          shipping:        dto.shipping,
          discount:        dto.discount,
          address:         addressLine,
          city:            dto.customer.city,
          notes:           dto.customer.notes ?? null,
          paymentProvider: 'addi',
          wompiTxId:       applicationId,
          customerId:      customer.id,
          items: {
            create: dto.items.map(item => ({
              quantity:    item.quantity,
              price:       item.price,
              productName: item.name,
              topSize:     item.topSize,
              bottomSize:  item.bottomSize,
              color:       item.color,
            })),
          },
        },
      });
    } catch (err) {
      this.logger.error('Error saving ADDI order to DB:', err);
    }

    return { checkoutUrl, reference, total };
  }

  async handleWebhook(payload: any) {
    try {
      const reference = payload?.clientApplicationCode ?? payload?.orderId;
      const status    = payload?.status;
      if (!reference || !status) return { received: true };

      const orderStatus =
        status === 'APPROVED' ? 'PAID'
        : status === 'REJECTED' || status === 'CANCELLED' ? 'CANCELLED'
        : null;

      if (orderStatus) {
        await this.prisma.order.updateMany({
          where: { reference },
          data:  { status: orderStatus as any },
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
      this.logger.error('ADDI webhook error:', err);
    }
    return { received: true };
  }
}
