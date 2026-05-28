import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  track(path: string, source?: string) {
    return this.prisma.pageView.create({ data: { path, source: source ?? null } });
  }

  trackCart(data: {
    event: string;
    productId?: string;
    productName?: string;
    price?: number;
    quantity?: number;
  }) {
    return this.prisma.funnelEvent.create({ data });
  }
}
