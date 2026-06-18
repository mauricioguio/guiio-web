import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(fromStr?: string, toStr?: string) {
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;

    // Colombia = UTC-5: shift now to Colombia local time, extract date, shift back to UTC
    const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;
    const nowColombia = new Date(now.getTime() - COLOMBIA_OFFSET_MS);
    const startOfToday = new Date(
      Date.UTC(nowColombia.getUTCFullYear(), nowColombia.getUTCMonth(), nowColombia.getUTCDate())
      + COLOMBIA_OFFSET_MS,
    );
    const startOfTomorrow = new Date(startOfToday.getTime() + msPerDay);

    const thirtyDaysAgo = new Date(now.getTime() - 30 * msPerDay);

    // Date range for filtered stats
    const rangeFrom: Date = fromStr ? new Date(fromStr + 'T05:00:00Z') : thirtyDaysAgo;
    const rangeTo:   Date = toStr   ? new Date(toStr   + 'T04:59:59Z') : now;
    const rangeFilter = { gte: rangeFrom, lte: rangeTo };

    // Days in range for chart buckets
    const rangeDays = Math.max(1, Math.round((rangeTo.getTime() - rangeFrom.getTime()) / msPerDay) + 1);

    const [ordersInRange, ordersToday, paidInRange, paidAll, totalCustomers, pendingOrders, recentPaidOrders, topProducts, rawHourly, adVisitsToday, addToCartToday, checkoutToday, topCarted] =
      await Promise.all([
        this.prisma.order.count({ where: { createdAt: rangeFilter } }),

        this.prisma.order.count({ where: { createdAt: { gte: startOfToday, lt: startOfTomorrow } } }),

        this.prisma.order.aggregate({
          where: { status: 'PAID', createdAt: rangeFilter },
          _sum: { total: true },
          _count: { _all: true },
        }),

        this.prisma.order.aggregate({
          where: { status: 'PAID' },
          _sum: { total: true },
          _count: { _all: true },
        }),

        this.prisma.customer.count(),

        this.prisma.order.count({ where: { status: 'PENDING' } }),

        this.prisma.order.findMany({
          where: { status: 'PAID', createdAt: rangeFilter },
          select: { createdAt: true, total: true },
        }),

        this.prisma.$queryRaw<{ productName: string; revenue: number; quantity: number }[]>`
          SELECT oi."productName",
                 SUM(oi.price * oi.quantity) AS revenue,
                 SUM(oi.quantity)            AS quantity
          FROM   "OrderItem" oi
          JOIN   "Order"     o  ON o.id = oi."orderId"
          WHERE  o.status = 'PAID'
          GROUP  BY oi."productName"
          ORDER  BY revenue DESC
          LIMIT  5
        `,

        this.prisma.$queryRaw<{ hour: number; count: number }[]>`
          SELECT EXTRACT(HOUR FROM "createdAt")::int AS hour,
                 COUNT(*)::int                       AS count
          FROM   "PageView"
          WHERE  "createdAt" >= NOW() - INTERVAL '24 hours'
          GROUP  BY hour
          ORDER  BY hour
        `,

        this.prisma.pageView.count({
          where: { source: 'facebook', createdAt: { gte: startOfToday } },
        }),

        this.prisma.funnelEvent.count({
          where: { event: 'add_to_cart', createdAt: { gte: startOfToday } },
        }),

        this.prisma.funnelEvent.count({
          where: { event: 'initiate_checkout', createdAt: { gte: startOfToday } },
        }),

        this.prisma.$queryRaw<{ productName: string; count: number }[]>`
          SELECT "productName",
                 COUNT(*)::int AS count
          FROM   "FunnelEvent"
          WHERE  event = 'add_to_cart'
            AND  "createdAt" >= NOW() - INTERVAL '30 days'
            AND  "productName" IS NOT NULL
          GROUP  BY "productName"
          ORDER  BY count DESC
          LIMIT  5
        `,
      ]);

    // Build daily buckets for selected range (oldest → newest)
    const dailySales: { date: string; total: number; count: number }[] = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(rangeTo.getTime() - i * msPerDay);
      dailySales.push({ date: d.toISOString().slice(0, 10), total: 0, count: 0 });
    }
    for (const order of recentPaidOrders) {
      const key = order.createdAt.toISOString().slice(0, 10);
      const bucket = dailySales.find(b => b.date === key);
      if (bucket) {
        bucket.total += order.total;
        bucket.count += 1;
      }
    }

    const totalPaidCount = paidAll._count._all;
    const totalPaidSum   = paidAll._sum.total ?? 0;
    const rangePaidCount = paidInRange._count._all;
    const rangePaidSum   = paidInRange._sum.total ?? 0;

    // Build 24-hour slots (0-23)
    const hourlyMap = new Map<number, number>();
    for (const row of rawHourly) hourlyMap.set(Number(row.hour), Number(row.count));
    const hourlySessions = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: hourlyMap.get(h) ?? 0,
    }));

    return {
      ordersToday,
      salesMonth:      rangePaidSum,
      totalCustomers,
      pendingOrders,
      avgOrderValue:   rangePaidCount > 0 ? rangePaidSum / rangePaidCount : 0,
      totalRevenue:    totalPaidSum,
      adVisitsToday,
      addToCartToday,
      checkoutToday,
      dailySales,
      hourlySessions,
      topProducts: topProducts.map(p => ({
        name:     p.productName,
        revenue:  Number(p.revenue),
        quantity: Number(p.quantity),
      })),
      topCarted: topCarted.map(p => ({
        name:  p.productName,
        count: Number(p.count),
      })),
    };
  }
}
