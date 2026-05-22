import {
  Controller, Get, Post, Put, Patch, Param, Body, Headers,
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

  @Put('inventory')
  @UseGuards(SellerGuard)
  upsertInventory(
    @Headers('x-sede-id') sedeId: string,
    @Body('items') items: { productId: string; size: string; quantity: number }[],
  ) {
    return this.sellerService.upsertInventory(sedeId, items);
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

  @Get('next-order-number')
  @UseGuards(SellerGuard)
  getNextOrderNumber() {
    return this.sellerService.getNextOrderNumber();
  }

  @Post('admin/delete-orders-by-range')
  @UseGuards(AdminKeyGuard)
  deleteOrdersByRange(@Body('from') from: number, @Body('to') to: number) {
    return this.sellerService.deleteOrdersByRange(from, to);
  }

  // ── Fabricar orders (seller) ──────────────────────────────────────────────

  @Get('fabricar')
  @UseGuards(SellerGuard)
  getFabricarOrders(@Headers('x-sede-id') sedeId: string) {
    return this.sellerService.getFabricarOrders(sedeId);
  }

  @Get('fabricar/:id')
  @UseGuards(SellerGuard)
  getFabricarOrder(@Param('id') id: string) {
    return this.sellerService.getFabricarOrder(id);
  }

  @Post('fabricar/:id/payment')
  @UseGuards(SellerGuard)
  addPayment(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body('note') note?: string,
  ) {
    return this.sellerService.addPayment(id, amount, note);
  }

  @Patch('fabricar/:id/items')
  @UseGuards(SellerGuard)
  updateDeliveredQty(
    @Param('id') id: string,
    @Body('items') items: { itemId: string; deliveredQty: number }[],
  ) {
    return this.sellerService.updateDeliveredQty(id, items);
  }

  @Patch('fabricar/:id/status')
  @UseGuards(SellerGuard)
  updateFabricarStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.sellerService.updateSaleStatus(id, status);
  }

  // ── Fabricar orders (admin) ───────────────────────────────────────────────

  @Post('admin/fabricar/:id/payment')
  @UseGuards(AdminKeyGuard)
  addPaymentAdmin(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body('note') note?: string,
  ) {
    return this.sellerService.addPayment(id, amount, note);
  }

  @Patch('admin/fabricar/:id/items')
  @UseGuards(AdminKeyGuard)
  updateDeliveredQtyAdmin(
    @Param('id') id: string,
    @Body('items') items: { itemId: string; deliveredQty: number }[],
  ) {
    return this.sellerService.updateDeliveredQty(id, items);
  }
}
