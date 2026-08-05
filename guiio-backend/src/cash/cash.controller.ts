import { Controller, Get, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { CashService } from './cash.service';

@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('balance')
  async getBalance(@Query('sedeId') sedeId: string) {
    if (!sedeId) throw new BadRequestException('sedeId requerido');
    const balance = await this.cash.getBalance(sedeId);
    return { balance };
  }

  @Get('movements')
  getMovements(
    @Query('sedeId') sedeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!sedeId) throw new BadRequestException('sedeId requerido');
    return this.cash.getMovements(sedeId, from, to);
  }

  @Post('expense')
  createExpense(@Body() body: { sedeId: string; amount: number; description: string; createdBy?: string }) {
    if (!body.sedeId) throw new BadRequestException('sedeId requerido');
    return this.cash.createExpense(body.sedeId, body.amount, body.description, body.createdBy);
  }

  @Get('stats')
  getStats(
    @Query('sedeId') sedeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!sedeId) throw new BadRequestException('sedeId requerido');
    return this.cash.getPaymentStats(sedeId, from, to);
  }

  @Get('daily')
  getDaily(
    @Query('sedeId') sedeId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!sedeId) throw new BadRequestException('sedeId requerido');
    return this.cash.getDailyRevenue(sedeId, from, to);
  }
}
