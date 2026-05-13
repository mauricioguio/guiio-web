import {
  Controller, Get, Patch, Param, Body, Query,
  CanActivate, ExecutionContext, Injectable, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from './orders.service';

@Injectable()
class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['x-admin-key'];
    return key === this.config.get<string>('ADMIN_API_KEY');
  }
}

@Controller('orders')
@UseGuards(AdminKeyGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  findAll(@Query('status') status?: string) {
    return this.ordersService.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.ordersService.updateStatus(id, status);
  }
}
