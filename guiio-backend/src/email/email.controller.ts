import { Controller, Post } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly email: EmailService) {}

  @Post('test')
  async test() {
    await this.email.sendOrderConfirmation({
      reference:     'TEST-001',
      customerName:  'Cliente de Prueba',
      customerEmail: 'mauricio_.17@hotmail.com',
      customerPhone: '3001234567',
      address:       'Calle 123 # 45-67',
      city:          'Bogotá',
      notes:         'Esto es un correo de prueba',
      total:         150000,
      shipping:      0,
      discount:      0,
      items: [
        { productName: 'Uniforme Santiago', color: 'Azul cielo', topSize: 'M', bottomSize: 'M', quantity: 1, price: 150000 },
      ],
    });
    return { sent: true };
  }
}
