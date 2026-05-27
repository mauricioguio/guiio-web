import {
  Controller, Get,
  CanActivate, ExecutionContext, Injectable, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnalyticsService } from './analytics.service';

@Injectable()
class AdminKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    return req.headers['x-admin-key'] === this.config.get<string>('ADMIN_API_KEY');
  }
}

@Controller('analytics')
@UseGuards(AdminKeyGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly config: ConfigService,
  ) {}

  @Get('overview')
  getOverview() {
    return this.analyticsService.getOverview();
  }
}
