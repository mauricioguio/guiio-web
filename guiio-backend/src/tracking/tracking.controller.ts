import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('track')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post()
  @HttpCode(204)
  track(@Body('path') path: string, @Body('source') source?: string) {
    if (path) this.trackingService.track(path, source).catch(() => null);
    return;
  }

  @Post('cart')
  @HttpCode(204)
  trackCart(
    @Body('event') event: string,
    @Body('productId') productId?: string,
    @Body('productName') productName?: string,
    @Body('price') price?: number,
    @Body('quantity') quantity?: number,
  ) {
    if (event) this.trackingService.trackCart({ event, productId, productName, price, quantity }).catch(() => null);
    return;
  }
}
