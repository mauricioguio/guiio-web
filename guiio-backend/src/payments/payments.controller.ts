import { Controller, Post, Get, Param, Body, HttpCode } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePreferenceDto } from './dto/create-preference.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @HttpCode(200)
  createCheckout(@Body() dto: CreatePreferenceDto) {
    return this.paymentsService.createCheckout(dto);
  }

  @Get('status/:id')
  getStatus(@Param('id') id: string) {
    return this.paymentsService.verifyTransaction(id);
  }

  @Post('webhook')
  @HttpCode(200)
  webhook(@Body() payload: any) {
    return this.paymentsService.handleWebhook(payload);
  }
}
