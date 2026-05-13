import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'crypto';
import { CreatePreferenceDto } from './dto/create-preference.dto';

@Injectable()
export class PaymentsService {
  private readonly publicKey: string;
  private readonly integritySecret: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
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

    console.log('CHECKOUT URL:', checkoutUrl);
    return { checkoutUrl, reference, total };
  }
}
