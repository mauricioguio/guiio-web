import { Controller, Get, Patch, Body, CanActivate, ExecutionContext, Injectable, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HomeSectionsService } from './home-sections.service';

@Injectable()
class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    return req.headers['x-admin-key'] === this.config.get<string>('ADMIN_API_KEY');
  }
}

@Controller('home-sections')
export class HomeSectionsController {
  constructor(private readonly service: HomeSectionsService) {}

  @Get()
  get() {
    return this.service.get();
  }

  @Patch()
  @UseGuards(AdminKeyGuard)
  update(@Body() data: any) {
    return this.service.update(data);
  }
}
