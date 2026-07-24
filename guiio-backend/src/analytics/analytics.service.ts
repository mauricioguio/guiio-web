import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfits(fromStr?: string, toStr?: string) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const now  = new Date();
    const from: Date = fromStr ? new Date(fromStr + 'T05:00:00Z') : new Date(now.getTime() - 30 * msPerDay);
    const to:   Date = toStr   ? new Date(toStr   + 'T04:59:59Z') : now;

    const [onlineAgg, physicalByChannel, dailyOnline, dailyPhysical, topOnline, topPhysical] =
      await Promise.all([

        // Online totals
        this.prisma.$queryRaw<{ revenue: number; cost: number; count: number }[]>`
          SELECT
            COALESCE(SUM(o.total), 0)::float                                             AS revenue,
            COALESCE(SUM(oi.quantity * COALESCE(pc.unit_cost, 0)), 0)::float             AS cost,
            COUNT(DISTINCT o.id)::int                                                    AS count
          FROM "Order" o
          JOIN "OrderItem" oi ON oi."orderId" = o.id
          LEFT JOIN (
            SELECT p2.name, COALESCE(SUM(pci.quantity * pci.amount), 0) AS unit_cost
            FROM "Product" p2
            LEFT JOIN "ProductCostItem" pci ON pci."productId" = p2.id
            GROUP BY p2.name
          ) pc ON LOWER(pc.name) = LOWER(oi."productName")
          WHERE o.status NOT IN ('CANCELLED','PENDING')
            AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
        `,

        // Physical by channel
        this.prisma.$queryRaw<{ channel: string; revenue: number; cost: number; count: number }[]>`
          SELECT
            COALESCE(s.channel, se.name)                                                 AS channel,
            COALESCE(SUM(s.total), 0)::float                                             AS revenue,
            COALESCE(SUM(si.quantity * COALESCE(pc.unit_cost, 0)), 0)::float             AS cost,
            COUNT(DISTINCT s.id)::int                                                    AS count
          FROM "Sale" s
          JOIN "Sede" se ON se.id = s."sedeId"
          JOIN "SaleItem" si ON si."saleId" = s.id
          LEFT JOIN (
            SELECT p2.id, COALESCE(SUM(pci.quantity * pci.amount), 0) AS unit_cost
            FROM "Product" p2
            LEFT JOIN "ProductCostItem" pci ON pci."productId" = p2.id
            GROUP BY p2.id
          ) pc ON pc.id = si."productId"
          WHERE s.status NOT IN ('CANCELLED')
            AND s."createdAt" >= ${from} AND s."createdAt" <= ${to}
          GROUP BY COALESCE(s.channel, se.name)
        `,

        // Daily online
        this.prisma.$queryRaw<{ date: string; revenue: number; cost: number }[]>`
          SELECT
            DATE(o."createdAt" AT TIME ZONE 'America/Bogota')::text AS date,
            COALESCE(SUM(o.total), 0)::float                        AS revenue,
            COALESCE(SUM(oi.quantity * COALESCE(pc.unit_cost, 0)), 0)::float AS cost
          FROM "Order" o
          JOIN "OrderItem" oi ON oi."orderId" = o.id
          LEFT JOIN (
            SELECT p2.name, COALESCE(SUM(pci.quantity * pci.amount), 0) AS unit_cost
            FROM "Product" p2
            LEFT JOIN "ProductCostItem" pci ON pci."productId" = p2.id
            GROUP BY p2.name
          ) pc ON LOWER(pc.name) = LOWER(oi."productName")
          WHERE o.status NOT IN ('CANCELLED','PENDING')
            AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
          GROUP BY DATE(o."createdAt" AT TIME ZONE 'America/Bogota')
        `,

        // Daily physical
        this.prisma.$queryRaw<{ date: string; revenue: number; cost: number }[]>`
          SELECT
            DATE(s."createdAt" AT TIME ZONE 'America/Bogota')::text AS date,
            COALESCE(SUM(s.total), 0)::float                        AS revenue,
            COALESCE(SUM(si.quantity * COALESCE(pc.unit_cost, 0)), 0)::float AS cost
          FROM "Sale" s
          JOIN "SaleItem" si ON si."saleId" = s.id
          LEFT JOIN (
            SELECT p2.id, COALESCE(SUM(pci.quantity * pci.amount), 0) AS unit_cost
            FROM "Product" p2
            LEFT JOIN "ProductCostItem" pci ON pci."productId" = p2.id
            GROUP BY p2.id
          ) pc ON pc.id = si."productId"
          WHERE s.status NOT IN ('CANCELLED')
            AND s."createdAt" >= ${from} AND s."createdAt" <= ${to}
          GROUP BY DATE(s."createdAt" AT TIME ZONE 'America/Bogota')
        `,

        // Top products online
        this.prisma.$queryRaw<{ name: string; revenue: number; cost: number; units: number }[]>`
          SELECT
            oi."productName"                                                              AS name,
            SUM(oi.price * oi.quantity)::float                                           AS revenue,
            COALESCE(SUM(oi.quantity * COALESCE(pc.unit_cost, 0)), 0)::float             AS cost,
            SUM(oi.quantity)::int                                                         AS units
          FROM "OrderItem" oi
          JOIN "Order" o ON o.id = oi."orderId"
          LEFT JOIN (
            SELECT p2.name, COALESCE(SUM(pci.quantity * pci.amount), 0) AS unit_cost
            FROM "Product" p2
            LEFT JOIN "ProductCostItem" pci ON pci."productId" = p2.id
            GROUP BY p2.name
          ) pc ON LOWER(pc.name) = LOWER(oi."productName")
          WHERE o.status NOT IN ('CANCELLED','PENDING')
            AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
          GROUP BY oi."productName"
          ORDER BY revenue DESC
          LIMIT 8
        `,

        // Top products physical
        this.prisma.$queryRaw<{ name: string; revenue: number; cost: number; units: number }[]>`
          SELECT
            si."productName"                                                              AS name,
            SUM(si.price * si.quantity)::float                                           AS revenue,
            COALESCE(SUM(si.quantity * COALESCE(pc.unit_cost, 0)), 0)::float             AS cost,
            SUM(si.quantity)::int                                                         AS units
          FROM "SaleItem" si
          JOIN "Sale" s ON s.id = si."saleId"
          LEFT JOIN (
            SELECT p2.id, COALESCE(SUM(pci.quantity * pci.amount), 0) AS unit_cost
            FROM "Product" p2
            LEFT JOIN "ProductCostItem" pci ON pci."productId" = p2.id
            GROUP BY p2.id
          ) pc ON pc.id = si."productId"
          WHERE s.status NOT IN ('CANCELLED')
            AND s."createdAt" >= ${from} AND s."createdAt" <= ${to}
          GROUP BY si."productName"
          ORDER BY revenue DESC
          LIMIT 8
        `,
      ]);

    // Merge daily buckets
    const dailyMap = new Map<string, { revenue: number; cost: number }>();
    for (const r of [...dailyOnline, ...dailyPhysical]) {
      const key = String(r.date).slice(0, 10);
      const prev = dailyMap.get(key) ?? { revenue: 0, cost: 0 };
      dailyMap.set(key, { revenue: prev.revenue + Number(r.revenue), cost: prev.cost + Number(r.cost) });
    }
    const rangeDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / msPerDay) + 1);
    const daily = Array.from({ length: rangeDays }, (_, i) => {
      const d   = new Date(from.getTime() + i * msPerDay);
      const key = d.toISOString().slice(0, 10);
      const v   = dailyMap.get(key) ?? { revenue: 0, cost: 0 };
      return { date: key, revenue: v.revenue, cost: v.cost, profit: v.revenue - v.cost };
    });

    // Merge top products
    const prodMap = new Map<string, { revenue: number; cost: number; units: number }>();
    for (const p of [...topOnline, ...topPhysical]) {
      const key  = p.name.toLowerCase();
      const prev = prodMap.get(key) ?? { revenue: 0, cost: 0, units: 0 };
      prodMap.set(key, { revenue: prev.revenue + Number(p.revenue), cost: prev.cost + Number(p.cost), units: prev.units + Number(p.units) });
    }
    const topProducts = [...prodMap.entries()]
      .map(([name, v]) => ({ name, ...v, profit: v.revenue - v.cost, margin: v.revenue > 0 ? Math.round((v.revenue - v.cost) / v.revenue * 100) : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    // Build channel summary
    const onlineR = Number(onlineAgg[0]?.revenue ?? 0);
    const onlineC = Number(onlineAgg[0]?.cost    ?? 0);
    const channels = [
      { channel: 'Online', revenue: onlineR, cost: onlineC, count: Number(onlineAgg[0]?.count ?? 0) },
      ...physicalByChannel.map(r => ({ channel: String(r.channel), revenue: Number(r.revenue), cost: Number(r.cost), count: Number(r.count) })),
    ].map(c => ({ ...c, profit: c.revenue - c.cost, margin: c.revenue > 0 ? Math.round((c.revenue - c.cost) / c.revenue * 100) : 0 }));

    const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0);
    const totalCost    = channels.reduce((s, c) => s + c.cost,    0);
    const grossProfit  = totalRevenue - totalCost;
    const grossMarginPct = totalRevenue > 0 ? Math.round(grossProfit / totalRevenue * 100) : 0;

    // Gastos fijos para los meses que caen en el período
    const months = this.monthsInRange(from, to);
    const fixedExpenses = months.length
      ? await this.prisma.fixedExpense.findMany({ where: { month: { in: months } }, orderBy: { month: 'asc' } })
      : [];
    const totalFixedExpenses = fixedExpenses.reduce((s, e) => s + e.amount, 0);
    const netProfit    = grossProfit - totalFixedExpenses;
    const netMarginPct = totalRevenue > 0 ? Math.round(netProfit / totalRevenue * 100) : 0;

    return { totalRevenue, totalCost, grossProfit, grossMarginPct, fixedExpenses, totalFixedExpenses, netProfit, netMarginPct, daily, channels, topProducts };
  }

  private monthsInRange(from: Date, to: Date): string[] {
    const months: string[] = [];
    const cur = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (cur <= end) {
      months.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }

  async getFixedExpenses(month?: string) {
    return this.prisma.fixedExpense.findMany({
      where: month ? { month } : undefined,
      orderBy: [{ month: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createFixedExpense(name: string, amount: number, month: string) {
    return this.prisma.fixedExpense.create({ data: { name, amount, month } });
  }

  async updateFixedExpense(id: string, data: { name?: string; amount?: number; month?: string }) {
    return this.prisma.fixedExpense.update({ where: { id }, data });
  }

  async deleteFixedExpense(id: string) {
    return this.prisma.fixedExpense.delete({ where: { id } });
  }

  async getGeoStats(fromStr?: string, toStr?: string) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const now = new Date();
    const rangeFrom: Date = fromStr ? new Date(fromStr + 'T05:00:00Z') : new Date(now.getTime() - 30 * msPerDay);
    const rangeTo:   Date = toStr   ? new Date(toStr   + 'T04:59:59Z') : now;

    const [topCountries, topCities] = await Promise.all([
      this.prisma.$queryRaw<{ country: string; count: number }[]>`
        SELECT country, COUNT(*)::int AS count
        FROM "PageView"
        WHERE country IS NOT NULL
          AND "createdAt" >= ${rangeFrom} AND "createdAt" <= ${rangeTo}
        GROUP BY country
        ORDER BY count DESC
        LIMIT 15
      `,
      this.prisma.$queryRaw<{ city: string; country: string; count: number }[]>`
        SELECT city, country, COUNT(*)::int AS count
        FROM "PageView"
        WHERE city IS NOT NULL
          AND "createdAt" >= ${rangeFrom} AND "createdAt" <= ${rangeTo}
        GROUP BY city, country
        ORDER BY count DESC
        LIMIT 15
      `,
    ]);

    return {
      topCountries: topCountries.map(r => ({ country: r.country, count: Number(r.count) })),
      topCities:    topCities.map(r => ({ city: r.city, country: r.country, count: Number(r.count) })),
    };
  }

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
