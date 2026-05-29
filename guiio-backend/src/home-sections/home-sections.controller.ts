import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { HomeSectionsService } from './home-sections.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('home-sections')
export class HomeSectionsController {
  constructor(private readonly service: HomeSectionsService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  update(@Body() data: any) {
    return this.service.update(data);
  }
}
