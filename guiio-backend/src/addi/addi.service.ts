import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddiCheckoutDto } from './dto/create-addi-checkout.dto';

@Injectable()
export class AddiService {
  private readonly logger = new Logger(AddiService.name);
  private readonly apiUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiUrl      = this.config.get<string>('ADDI_API_URL') ?? 'https://api.staging.addi.com.co';
    this.clientId    = this.config.get<string>('ADDI_CLIENT_ID')!;
    this.clientSecret= this.config.get<string>('ADDI_CLIENT_SECRET')!;
    this.frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
  }

  private async getToken(): Promise<string> {
    // Try known ADDI Auth0 audience values
    const audiences = [
      'https://addi.com.co/',
      'https://api.addi.com/',
      'https://addi.com/',
    ];

    for (const audience of audiences) {
      const res = await fetch('https://addi.us.auth0.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type:    'client_credentials',
          client_id:     this.clientId,
          client_secret: this.clientSecret,
          audience,
        }),
      });
      const text = await res.text();
      this.logger.log(`ADDI auth0 audience "${audience}" → ${res.status}: ${text.slice(0, 80)}`);
      if (res.ok) {
        return (JSON.parse(text)).access_token as string;
      }
    }

    throw new Error('ADDI token: no valid audience found');
  }

  async createCheckout(dto: CreateAddiCheckoutDto) {
    const subtotal = dto.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const total    = subtotal - dto.discount + dto.shipping;
    const reference = `GUIIO-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const [firstName, ...rest] = dto.customer.name.trim().split(' ');
    const lastName = rest.join(' ') || firstName;

    const redirectBase = `${this.frontendUrl}/pago/resultado`;
    const token = await this.getToken();

    const body = {
      orderId:     reference,
      totalAmount: total,
      currency:    'COP',
      items: dto.items.map(i => ({
        id:        i.id,
        name:      i.name,
        quantity:  i.quantity,
        unitPrice: i.price,
        photoUrl:  i.image,
      })),
      client: {
        idType:    'CC',
        idNumber:  dto.customer.docNumber,
        firstName,
        lastName,
        email:     dto.customer.email,
        cellphone: dto.customer.phone,
        address: {
          lineOne: dto.customer.address,
          city:    dto.customer.city,
          country: 'CO',
        },
      },
      redirectionUrls: {
        onApproved: `${redirectBase}?addi=approved`,
        onRejected: `${redirectBase}?addi=rejected`,
        onFailed:   `${redirectBase}?addi=failed`,
        onCancelled:`${redirectBase}?addi=cancelled`,
      },
    };

    const res = await fetch(`${this.apiUrl}/v1/checkouts`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ADDI checkout error: ${res.status} ${text}`);
    }

    const data = await res.json() as any;
    const checkoutUrl    = data.checkoutUrl   as string;
    const applicationId  = data.applicationId as string;

    try {
      const fullAddress = dto.customer.reference
        ? `${dto.customer.address} (${dto.customer.reference})`
        : dto.customer.address;

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
          address:         fullAddress,
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
      const orderId = payload?.orderId ?? payload?.order_id;
      const status  = payload?.status;
      if (!orderId || !status) return { received: true };

      const orderStatus =
        status === 'APPROVED' ? 'PAID'
        : status === 'REJECTED' || status === 'CANCELLED' ? 'CANCELLED'
        : null;

      if (orderStatus) {
        await this.prisma.order.updateMany({
          where: { reference: orderId },
          data:  { status: orderStatus as any },
        });
      }
    } catch (err) {
      this.logger.error('ADDI webhook error:', err);
    }
    return { received: true };
  }
}
