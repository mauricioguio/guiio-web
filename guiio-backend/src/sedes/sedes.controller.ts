import {
  Controller, Get, Post, Patch, Delete, Param, Body, HttpCode,
  CanActivate, ExecutionContext, Injectable, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SedesService } from './sedes.service';

@Injectable()
class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    return req.headers['x-admin-key'] === this.config.get<string>('ADMIN_API_KEY');
  }
}

@Controller('sedes')
export class SedesController {
  constructor(
    private readonly sedesService: SedesService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  findAll() {
    return this.sedesService.findAll();
  }

  @Post()
  @HttpCode(201)
  @UseGuards(AdminKeyGuard)
  create(@Body() body: { name: string }) {
    return this.sedesService.create(body);
  }

  @Patch(':id')
  @UseGuards(AdminKeyGuard)
  update(@Param('id') id: string, @Body() body: { name?: string; active?: boolean }) {
    return this.sedesService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminKeyGuard)
  remove(@Param('id') id: string) {
    return this.sedesService.remove(id);
  }
}
