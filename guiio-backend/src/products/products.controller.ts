import {
  Controller, Get, Post, Patch, Delete, Param, Body, HttpCode,
  CanActivate, ExecutionContext, Injectable, UseGuards, Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductsService } from './products.service';

@Injectable()
class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['x-admin-key'];
    return key === this.config.get<string>('ADMIN_API_KEY');
  }
}

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  findAll(@Req() req: any) {
    const isAdmin = req.headers['x-admin-key'] === this.config.get<string>('ADMIN_API_KEY');
    return this.productsService.findAll(!isAdmin);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(AdminKeyGuard)
  create(@Body() data: any) {
    return this.productsService.create(data);
  }

  @Patch(':id/active')
  @UseGuards(AdminKeyGuard)
  patchActive(@Param('id') id: string, @Body('active') active: boolean) {
    return this.productsService.patchActive(id, active);
  }

  @Patch(':id')
  @UseGuards(AdminKeyGuard)
  update(@Param('id') id: string, @Body() data: any) {
    return this.productsService.update(id, data);
  }

  @Delete(':id')
  @UseGuards(AdminKeyGuard)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
