import { Controller, Post, Get, Body, Param, HttpCode } from '@nestjs/common';
import { AddiService } from './addi.service';
import { CreateAddiCheckoutDto } from './dto/create-addi-checkout.dto';

@Controller('addi')
export class AddiController {
  constructor(private readonly addiService: AddiService) {}

  @Post('checkout')
  @HttpCode(200)
  createCheckout(@Body() dto: CreateAddiCheckoutDto) {
    return this.addiService.createCheckout(dto);
  }

  @Get('status/:reference')
  getStatus(@Param('reference') reference: string) {
    return this.addiService.getOrderStatus(reference);
  }

  @Post('webhook')
  @HttpCode(200)
  webhook(@Body() payload: any) {
    return this.addiService.handleWebhook(payload);
  }
}
