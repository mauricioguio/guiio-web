import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface OrderItem {
  productName: string;
  color: string;
  topSize: string;
  bottomSize: string;
  quantity: number;
  price: number;
}

interface OrderEmailData {
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerCedula?: string | null;
  address: string;
  city: string;
  notes?: string | null;
  total: number;
  shipping: number;
  discount: number;
  items: OrderItem[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromAddress: string;
  private readonly ownerEmail: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.fromAddress = this.config.get<string>('EMAIL_FROM') ?? 'pedidos@guiiouniformes.com';
    this.ownerEmail = this.config.get<string>('OWNER_EMAIL') ?? 'mauricio_.17@hotmail.com';
  }

  private formatCOP(amount: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
  }

  private buildItemsHtml(items: OrderItem[]) {
    return items.map(item => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;">
          <strong style="color:#111;">${item.productName}</strong><br>
          <span style="color:#666;font-size:13px;">Color: ${item.color} &nbsp;·&nbsp; Blusa: ${item.topSize} &nbsp;·&nbsp; Pantalón: ${item.bottomSize} &nbsp;·&nbsp; Cant: ${item.quantity}</span>
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;text-align:right;white-space:nowrap;">
          <strong style="color:#111;">${this.formatCOP(item.price * item.quantity)}</strong>
        </td>
      </tr>`).join('');
  }

  private customerTemplate(data: OrderEmailData) {
    const subtotal = data.total - data.shipping + data.discount;
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#111;padding:28px 32px;text-align:center;">
            <p style="margin:0;color:#fff;font-size:22px;font-weight:700;letter-spacing:2px;">GUIIO</p>
            <p style="margin:4px 0 0;color:#aaa;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Uniformes</p>
          </td>
        </tr>

        <!-- Confirmación -->
        <tr>
          <td style="padding:32px 32px 0;text-align:center;">
            <p style="margin:0;font-size:28px;">✅</p>
            <h1 style="margin:12px 0 6px;font-size:22px;color:#111;">¡Pedido confirmado!</h1>
            <p style="margin:0;color:#666;font-size:14px;">Hola <strong>${data.customerName}</strong>, recibimos tu pedido correctamente.</p>
            <p style="margin:8px 0 0;color:#999;font-size:12px;">Ref: <strong style="color:#555;">${data.reference}</strong></p>
          </td>
        </tr>

        <!-- Items -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#111;text-transform:uppercase;letter-spacing:1px;">Tu pedido</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${this.buildItemsHtml(data.items)}
              <tr>
                <td style="padding:10px 0;color:#666;font-size:13px;">Subtotal</td>
                <td style="padding:10px 0;text-align:right;color:#666;font-size:13px;">${this.formatCOP(subtotal)}</td>
              </tr>
              ${data.discount > 0 ? `<tr>
                <td style="padding:4px 0;color:#16a34a;font-size:13px;">Descuento 20%</td>
                <td style="padding:4px 0;text-align:right;color:#16a34a;font-size:13px;">−${this.formatCOP(data.discount)}</td>
              </tr>` : ''}
              <tr>
                <td style="padding:4px 0;color:#666;font-size:13px;">Envío</td>
                <td style="padding:4px 0;text-align:right;color:#666;font-size:13px;">${data.shipping === 0 ? '<span style="color:#16a34a;">Gratis</span>' : this.formatCOP(data.shipping)}</td>
              </tr>
              <tr>
                <td style="padding:12px 0 0;font-size:16px;font-weight:700;color:#111;border-top:2px solid #111;">Total pagado</td>
                <td style="padding:12px 0 0;text-align:right;font-size:16px;font-weight:700;color:#111;border-top:2px solid #111;">${this.formatCOP(data.total)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Dirección -->
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#111;text-transform:uppercase;letter-spacing:1px;">Envío a</p>
            <p style="margin:0;font-size:14px;color:#444;">${data.address}</p>
            <p style="margin:2px 0 0;font-size:14px;color:#444;">${data.city}</p>
            ${data.notes ? `<p style="margin:4px 0 0;font-size:13px;color:#888;">Nota: ${data.notes}</p>` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:32px;text-align:center;border-top:1px solid #f0f0f0;margin-top:24px;">
            <p style="margin:0;font-size:13px;color:#888;">¿Tienes preguntas? Escríbenos por WhatsApp</p>
            <p style="margin:8px 0 0;font-size:11px;color:#bbb;">© 2025 Guiio Uniformes · guiiouniformes.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  private ownerTemplate(data: OrderEmailData) {
    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#111;padding:20px 32px;">
            <h2 style="margin:0;color:#fff;font-size:18px;">🛍️ Nueva venta — ${this.formatCOP(data.total)}</h2>
            <p style="margin:4px 0 0;color:#aaa;font-size:12px;">Ref: ${data.reference}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#111;">Cliente</p>
            <p style="margin:0;font-size:14px;color:#444;">${data.customerName} &nbsp;·&nbsp; ${data.customerPhone}</p>
            <p style="margin:2px 0 0;font-size:14px;color:#444;">${data.customerEmail}</p>
            ${data.customerCedula ? `<p style="margin:2px 0 0;font-size:14px;color:#444;">CC: ${data.customerCedula}</p>` : ''}
            <p style="margin:12px 0 4px;font-size:13px;font-weight:600;color:#111;">Envío a</p>
            <p style="margin:0;font-size:14px;color:#444;">${data.address}, ${data.city}</p>
            ${data.notes ? `<p style="margin:4px 0 0;font-size:13px;color:#888;">Nota: ${data.notes}</p>` : ''}
            <p style="margin:16px 0 8px;font-size:13px;font-weight:600;color:#111;">Productos</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${this.buildItemsHtml(data.items)}
            </table>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  async sendOrderConfirmation(data: OrderEmailData) {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY no configurado — correo no enviado');
      return;
    }
    try {
      await this.resend.emails.send({
        from: `Guiio Uniformes <${this.fromAddress}>`,
        to: data.customerEmail,
        subject: `✅ Pedido confirmado — ${data.reference}`,
        html: this.customerTemplate(data),
      });
      await this.resend.emails.send({
        from: `Guiio Uniformes <${this.fromAddress}>`,
        to: this.ownerEmail,
        subject: `🛍️ Nueva venta ${this.formatCOP(data.total)} — ${data.customerName}`,
        html: this.ownerTemplate(data),
      });
      this.logger.log(`Correos enviados para ${data.reference}`);
    } catch (err) {
      this.logger.error('Error enviando correo:', err);
    }
  }
}
