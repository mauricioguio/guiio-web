import {
  Controller, Get, Post, Param, Body, Headers,
  CanActivate, ExecutionContext, Injectable, UseGuards, UnauthorizedException,
} from '@nestjs/common';
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

@Controller('seller')
export class SellerController {
  constructor(
    private readonly sellerService: SellerService,
    private readonly prisma: PrismaService,
  ) {}

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
}
