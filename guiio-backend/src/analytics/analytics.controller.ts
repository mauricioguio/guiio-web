import { Controller, Get, Post, Patch, Delete, Query, Param, Body, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  getOverview(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getOverview(from, to);
  }

  @Get('geo')
  getGeoStats(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getGeoStats(from, to);
  }

  @Get('profits')
  getProfits(@Query('from') from?: string, @Query('to') to?: string) {
    return this.analyticsService.getProfits(from, to);
  }

  // ── Gastos fijos ──────────────────────────────────────────────────────────

  @Get('fixed-expenses')
  getFixedExpenses(@Query('month') month?: string) {
    return this.analyticsService.getFixedExpenses(month);
  }

  @Post('fixed-expenses')
  createFixedExpense(@Body() body: { name: string; amount: number; month: string }) {
    return this.analyticsService.createFixedExpense(body.name, body.amount, body.month);
  }

  @Patch('fixed-expenses/:id')
  updateFixedExpense(@Param('id') id: string, @Body() body: { name?: string; amount?: number; month?: string }) {
    return this.analyticsService.updateFixedExpense(id, body);
  }

  @Delete('fixed-expenses/:id')
  deleteFixedExpense(@Param('id') id: string) {
    return this.analyticsService.deleteFixedExpense(id);
  }
}
