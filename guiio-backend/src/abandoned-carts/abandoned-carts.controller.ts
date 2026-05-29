import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AbandonedCartsService } from './abandoned-carts.service';
import type { SaveCartDto } from './abandoned-carts.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('abandoned-carts')
export class AbandonedCartsController {
  constructor(private readonly service: AbandonedCartsService) {}

  @Post()
  save(@Body() dto: SaveCartDto) {
    return this.service.save(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.service.findAll();
  }
}
