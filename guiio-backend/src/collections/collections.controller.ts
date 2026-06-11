import {
  Controller, Get, Post, Patch, Delete, Param, Body, HttpCode, UseGuards, Req,
} from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  findAll(@Req() req: any) {
    const isAdmin = req.headers['authorization']?.startsWith('Bearer ');
    return this.collectionsService.findAll(!isAdmin);
  }

  @Patch(':id/active')
  @UseGuards(JwtAuthGuard)
  patchActive(@Param('id') id: string, @Body('active') active: boolean) {
    return this.collectionsService.patchActive(id, active);
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
  @UseGuards(JwtAuthGuard)
  create(@Body() data: any) {
    return this.collectionsService.create(data);
  }

  @Post(':id/products')
  @UseGuards(JwtAuthGuard)
  addProduct(@Param('id') id: string, @Body('productId') productId: string) {
    return this.collectionsService.addProduct(id, productId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() data: any) {
    return this.collectionsService.update(id, data);
  }

  @Delete(':id/products/:productId')
  @UseGuards(JwtAuthGuard)
  removeProduct(@Param('id') id: string, @Param('productId') productId: string) {
    return this.collectionsService.removeProduct(id, productId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.collectionsService.remove(id);
  }
}
