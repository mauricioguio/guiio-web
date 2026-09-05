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

  @Post('confirm/:reference')
  @HttpCode(200)
  confirm(@Param('reference') reference: string) {
    return this.paymentsService.confirmOrderByReference(reference);
  }

  @Post('check-wompi/:reference')
  @HttpCode(200)
  checkWompi(@Param('reference') reference: string, @Body() body: { wompiTxId?: string }) {
    return this.paymentsService.checkAndConfirmByReference(reference, body?.wompiTxId);
  }

  @Post('store-wompi-id')
  @HttpCode(200)
  storeWompiId(@Body() body: { reference: string; wompiTxId: string }) {
    return this.paymentsService.storeWompiId(body.reference, body.wompiTxId);
  }
}
