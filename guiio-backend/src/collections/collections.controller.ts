import {
  Controller, Get, Post, Patch, Delete, Param, Body, HttpCode,
  CanActivate, ExecutionContext, Injectable, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CollectionsService } from './collections.service';

@Injectable()
class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const key = req.headers['x-admin-key'];
    return key === this.config.get<string>('ADMIN_API_KEY');
  }
}

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  findAll() {
    return this.collectionsService.findAll();
  }

  @Get('name/:name/products')
  getProductsByName(@Param('name') name: string) {
    return this.collectionsService.getProductsByName(name);
  }

  @Get(':id/products')
  getProducts(@Param('id') id: string) {
    return this.collectionsService.getProducts(id);
  }

  @Post()
  @HttpCode(201)
  @UseGuards(AdminKeyGuard)
  create(@Body() data: any) {
    return this.collectionsService.create(data);
  }

  @Post(':id/products')
  @UseGuards(AdminKeyGuard)
  addProduct(@Param('id') id: string, @Body('productId') productId: string) {
    return this.collectionsService.addProduct(id, productId);
  }

  @Patch(':id')
  @UseGuards(AdminKeyGuard)
  update(@Param('id') id: string, @Body() data: any) {
    return this.collectionsService.update(id, data);
  }

  @Delete(':id/products/:productId')
  @UseGuards(AdminKeyGuard)
  removeProduct(@Param('id') id: string, @Param('productId') productId: string) {
    return this.collectionsService.removeProduct(id, productId);
  }

  @Delete(':id')
  @UseGuards(AdminKeyGuard)
  remove(@Param('id') id: string) {
    return this.collectionsService.remove(id);
  }
}
