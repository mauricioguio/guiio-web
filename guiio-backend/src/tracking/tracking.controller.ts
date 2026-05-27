import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('track')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post()
  @HttpCode(204)
  track(@Body('path') path: string) {
    if (path) this.trackingService.track(path).catch(() => null);
    return;
  }
}
