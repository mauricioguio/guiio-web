import {
  Controller, Get, Post, Patch, Param, Body, Headers,
  CanActivate, ExecutionContext, Injectable, UseGuards, UnauthorizedException,
} from '@nestjs/common';
import { OrderEditRequestsService } from './order-edit-requests.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
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
    req.sedeName = sede.name;
    return true;
  }
}

@Controller('order-edit-requests')
export class OrderEditRequestsController {
  constructor(private readonly service: OrderEditRequestsService) {}

  // Seller: crear solicitud de modificación
  @Post()
  @UseGuards(SellerGuard)
  create(
    @Headers('x-sede-id') sedeId: string,
    @Body('orderId') orderId: string,
    @Body('changes') changes: any,
    @Body('reason') reason?: string,
    @Body('requestedBy') requestedBy?: string,
  ) {
    return this.service.createRequest(orderId, requestedBy ?? sedeId, changes, reason);
  }

  // Admin: ver solicitudes pendientes
  @Get('pending')
  @UseGuards(JwtAuthGuard)
  findPending() {
    return this.service.findPending();
  }

  // Admin/Seller: historial de modificaciones de un pedido
  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  findByOrder(@Param('orderId') orderId: string) {
    return this.service.findByOrder(orderId);
  }

  // Admin: aprobar o rechazar
  @Patch(':id/review')
  @UseGuards(JwtAuthGuard)
  review(
    @Param('id') id: string,
    @Body('approved') approved: boolean,
    @Body('reviewNote') reviewNote?: string,
  ) {
    return this.service.review(id, approved, reviewNote);
  }
}
