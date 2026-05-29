import {
  Controller, Get, Patch, Body, UseGuards,
} from '@nestjs/common';
import { HeroService } from './hero.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('hero')
export class HeroController {
  constructor(private readonly heroService: HeroService) {}

  @Get()
  get() {
    return this.heroService.get();
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  update(@Body() data: any) {
    return this.heroService.update(data);
  }
}
