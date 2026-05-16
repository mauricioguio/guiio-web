import {
  Controller, Get, Post, Patch, Param, Body, Headers,
  CanActivate, ExecutionContext, Injectable, UseGuards, UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SellerService } from './seller.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
class SellerGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const sedeId = req.headers['x-sede-id'];
    const pin = req.headers['x-sede-pin'];
    if (!sedeId || !pin) throw new UnauthorizedException('Credenciales requeridas');
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede || !sede.pin || sede.pin !== pin) throw new UnauthorizedException('PIN incorrecto');
    req.sedeId = sedeId;
    return true;
  }
}

@Injectable()
class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    return req.headers['x-admin-key'] === this.config.get<string>('ADMIN_API_KEY');
  }
}

@Controller('seller')
export class SellerController {
  constructor(
    private readonly sellerService: SellerService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('customers/:phone')
  @UseGuards(SellerGuard)
  findCustomer(@Param('phone') phone: string) {
    return this.sellerService.findCustomer(phone);
  }

  @Post('customers')
  @UseGuards(SellerGuard)
  createCustomer(@Body('phone') phone: string, @Body('name') name: string) {
    return this.sellerService.createCustomer(phone, name);
  }

  @Get('sedes')
  getSedes() {
    return this.sellerService.getSedes();
  }

  @Post('auth')
  auth(@Body('sedeId') sedeId: string, @Body('pin') pin: string) {
    return this.sellerService.auth(sedeId, pin);
  }

  @Get('products')
  @UseGuards(SellerGuard)
  getProducts() {
    return this.sellerService.getProducts();
  }

  @Get('inventory/:sedeId')
  @UseGuards(SellerGuard)
  getInventory(@Param('sedeId') sedeId: string) {
    return this.sellerService.getInventory(sedeId);
  }

  @Post('sales')
  @UseGuards(SellerGuard)
  createSale(
    @Headers('x-sede-id') sedeId: string,
    @Body() body: any,
  ) {
    return this.sellerService.createSale(sedeId, body);
  }

  @Get('sales')
  @UseGuards(SellerGuard)
  getSales(@Headers('x-sede-id') sedeId: string) {
    return this.sellerService.getSales(sedeId);
  }

  @Get('admin/sales')
  @UseGuards(AdminKeyGuard)
  getAllSales() {
    return this.sellerService.getAllSales();
  }

  @Patch('admin/sales/:id/status')
  @UseGuards(AdminKeyGuard)
  updateSaleStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.sellerService.updateSaleStatus(id, status);
  }
}
