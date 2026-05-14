import {
  Controller, Get, Put, Body,
  CanActivate, ExecutionContext, Injectable, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InventoryService } from './inventory.service';

@Injectable()
class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    return req.headers['x-admin-key'] === this.config.get<string>('ADMIN_API_KEY');
  }
}

@Controller('inventory')
@UseGuards(AdminKeyGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  findAll() {
    return this.inventoryService.findAll();
  }

  @Put()
  upsert(@Body() body: { sedeId: string; productId: string; size: string; quantity: number }) {
    return this.inventoryService.upsert(body.sedeId, body.productId, body.size, body.quantity);
  }
}
