import {
  Controller, Get, Post, Put, Patch, Delete, Param, Body, Headers, Request,
  CanActivate, ExecutionContext, Injectable, UseGuards, UnauthorizedException,
} from '@nestjs/common';
import { SellerService } from './seller.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

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
    req.sedeId  = sedeId;
    req.empresa = sede.empresa ?? 'GUIIO';
    return true;
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
  findCustomer(@Param('phone') phone: string, @Request() req: any) {
    return this.sellerService.findCustomer(phone, req.empresa);
  }

  @Post('customers')
  @UseGuards(SellerGuard)
  createCustomer(@Body('phone') phone: string, @Body('name') name: string, @Request() req: any) {
    return this.sellerService.createCustomer(phone, name, req.empresa);
  }

  @Get('sedes')
  getSedes(@Headers('x-empresa') empresa?: string) {
    return this.sellerService.getSedes(empresa ?? 'GUIIO');
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
  @UseGuards(JwtAuthGuard)
  getAllSales(@Request() req: any) {
    return this.sellerService.getAllSales(req.user?.empresa ?? 'GUIIO');
  }

  @Get('admin/unified-sales')
  @UseGuards(JwtAuthGuard)
  getUnifiedSales(@Request() req: any) {
    return this.sellerService.getUnifiedSales(req.user?.empresa ?? 'GUIIO');
  }

  @Patch('admin/sales/:id/status')
  @UseGuards(JwtAuthGuard)
  updateSaleStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.sellerService.updateSaleStatus(id, status);
  }

  @Delete('admin/sales/:id')
  @UseGuards(JwtAuthGuard)
  deleteSale(@Param('id') id: string) {
    return this.sellerService.deleteSale(id);
  }

  @Get('online-orders')
  @UseGuards(SellerGuard)
  getOnlineOrders() {
    return this.sellerService.getOnlineOrders();
  }

  // ── Sale edit requests (seller) ───────────────────────────────────────────

  @Post('fabricar/:id/edit-request')
  @UseGuards(SellerGuard)
  createSaleEditRequest(
    @Param('id') saleId: string,
    @Body('changes') changes: any,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const sedeName = req.sedeName ?? req.sedeId;
    return this.sellerService.createSaleEditRequest(saleId, sedeName, changes, reason);
  }

  @Get('fabricar/:id/edit-requests')
  @UseGuards(SellerGuard)
  getSaleEditRequests(@Param('id') saleId: string) {
    return this.sellerService.getSaleEditRequests(saleId);
  }

  // ── Sale edit requests (admin) ────────────────────────────────────────────

  @Get('admin/sale-edit-requests/pending')
  @UseGuards(JwtAuthGuard)
  getPendingSaleEditRequests(@Request() req: any) {
    return this.sellerService.getPendingSaleEditRequests(req.user?.empresa ?? 'GUIIO');
  }

  @Patch('admin/sale-edit-requests/:id/review')
  @UseGuards(JwtAuthGuard)
  reviewSaleEditRequest(
    @Param('id') id: string,
    @Body('approved') approved: boolean,
    @Body('reviewNote') reviewNote?: string,
  ) {
    return this.sellerService.reviewSaleEditRequest(id, approved, reviewNote);
  }

  @Get('next-order-number')
  @UseGuards(SellerGuard)
  getNextOrderNumber(@Request() req: any) {
    return this.sellerService.getNextOrderNumber(req.empresa);
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
  @UseGuards(JwtAuthGuard)
  addPaymentAdmin(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body('note') note?: string,
  ) {
    return this.sellerService.addPayment(id, amount, note);
  }

  @Patch('admin/fabricar/:id/items')
  @UseGuards(JwtAuthGuard)
  updateDeliveredQtyAdmin(
    @Param('id') id: string,
    @Body('items') items: { itemId: string; deliveredQty: number }[],
  ) {
    return this.sellerService.updateDeliveredQty(id, items);
  }
}
