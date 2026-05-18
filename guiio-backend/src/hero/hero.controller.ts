import {
  Controller, Get, Patch, Body,
  CanActivate, ExecutionContext, Injectable, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HeroService } from './hero.service';

@Injectable()
class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    return req.headers['x-admin-key'] === this.config.get<string>('ADMIN_API_KEY');
  }
}

@Controller('hero')
export class HeroController {
  constructor(private readonly heroService: HeroService) {}

  @Get()
  get() {
    return this.heroService.get();
  }

  @Patch()
  @UseGuards(AdminKeyGuard)
  update(@Body() data: any) {
    return this.heroService.update(data);
  }
}
