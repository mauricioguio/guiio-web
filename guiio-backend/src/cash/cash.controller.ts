import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CashService } from './cash.service';

@Controller('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('balance')
  async getBalance() {
    const balance = await this.cash.getBalance();
    return { balance };
  }

  @Get('movements')
  getMovements(@Query('from') from?: string, @Query('to') to?: string) {
    return this.cash.getMovements(from, to);
  }

  @Post('expense')
  createExpense(@Body() body: { amount: number; description: string; createdBy?: string }) {
    return this.cash.createExpense(body.amount, body.description, body.createdBy);
  }

  @Get('stats')
  getStats(@Query('from') from?: string, @Query('to') to?: string) {
    return this.cash.getPaymentStats(from, to);
  }

  @Get('daily')
  getDaily(@Query('from') from?: string, @Query('to') to?: string) {
    return this.cash.getDailyRevenue(from, to);
  }
}
