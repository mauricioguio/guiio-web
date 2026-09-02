import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfits(fromStr?: string, toStr?: string) {
    const msPerDay = 24 * 60 * 60 * 1000;
    const now  = new Date();
    const from: Date = fromStr ? new Date(fromStr + 'T05:00:00Z') : new Date(now.getTime() - 30 * msPerDay);
    const to:   Date = toStr   ? new Date(new Date(toStr + 'T05:00:00Z').getTime() + msPerDay - 1000) : now;

    const [onlineAgg, physicalByChannel, dailyOnline, dailyPhysical, topOnline, topPhysical] =
      await Promise.all([

        // Online totals — CTE pre-agrega costos por pedido para evitar multiplicación con o.total
        this.prisma.$queryRaw<{ revenue: number; cost: number; count: number; units: number }[]>`
          WITH item_costs AS (
            SELECT oi."orderId", COALESCE(SUM(oi.quantity * COALESCE(pc.unit_cost, 0)), 0) AS cost
            FROM "OrderItem" oi
            LEFT JOIN (
              SELECT p2.name, COALESCE(SUM(pci.quantity * pci.amount), 0) AS unit_cost
              FROM "Product" p2
              LEFT JOIN "ProductCostItem" pci ON pci."productId" = p2.id
              GROUP BY p2.name
            ) pc ON LOWER(pc.name) = LOWER(oi."productName")
            GROUP BY oi."orderId"
          ),
          order_units AS (
            SELECT oi2."orderId", SUM(oi2.quantity)::int AS units
            FROM "OrderItem" oi2
            GROUP BY oi2."orderId"
          )
          SELECT
            COALESCE(SUM(o.total), 0)::float   AS revenue,
            COALESCE(SUM(ic.cost), 0)::float   AS cost,
            COUNT(o.id)::int                   AS count,
            COALESCE(SUM(ou.units), 0)::int    AS units
          FROM "Order" o
          LEFT JOIN item_costs ic ON ic."orderId" = o.id
          LEFT JOIN order_units ou ON ou."orderId" = o.id
          WHERE o.status NOT IN ('CANCELLED','PENDING')
            AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
        `,

        // Physical by channel — CTE pre-agrega costos por venta
        this.prisma.$queryRaw<{ channel: string; revenue: number; cost: number; count: number; units: number }[]>`
          WITH item_costs AS (
            SELECT si."saleId", COALESCE(SUM(si.quantity * COALESCE(pc.unit_cost, 0)), 0) AS cost
            FROM "SaleItem" si
            LEFT JOIN (
              SELECT p2.id, COALESCE(SUM(pci.quantity * pci.amount), 0) AS unit_cost
              FROM "Product" p2
              LEFT JOIN "ProductCostItem" pci ON pci."productId" = p2.id
              GROUP BY p2.id
            ) pc ON pc.id = si."productId"
            GROUP BY si."saleId"
          ),
          sale_units AS (
            SELECT si2."saleId", SUM(si2.quantity)::int AS units
            FROM "SaleItem" si2
            GROUP BY si2."saleId"
          )
          SELECT
            COALESCE(s.channel, se.name)         AS channel,
            COALESCE(SUM(s.total), 0)::float     AS revenue,
            COALESCE(SUM(ic.cost), 0)::float     AS cost,
            COUNT(s.id)::int                     AS count,
            COALESCE(SUM(su.units), 0)::int      AS units
          FROM "Sale" s
          JOIN "Sede" se ON se.id = s."sedeId"
          LEFT JOIN item_costs ic ON ic."saleId" = s.id
          LEFT JOIN sale_units su ON su."saleId" = s.id
          WHERE s.status NOT IN ('CANCELLED')
            AND s."createdAt" >= ${from} AND s."createdAt" <= ${to}
          GROUP BY COALESCE(s.channel, se.name)
        `,

        // Daily online — CTE pre-agrega costos por pedido
        this.prisma.$queryRaw<{ date: string; revenue: number; cost: number }[]>`
          WITH item_costs AS (
            SELECT oi."orderId", COALESCE(SUM(oi.quantity * COALESCE(pc.unit_cost, 0)), 0) AS cost
            FROM "OrderItem" oi
            LEFT JOIN (
              SELECT p2.name, COALESCE(SUM(pci.quantity * pci.amount), 0) AS unit_cost
              FROM "Product" p2
              LEFT JOIN "ProductCostItem" pci ON pci."productId" = p2.id
              GROUP BY p2.name
            ) pc ON LOWER(pc.name) = LOWER(oi."productName")
            GROUP BY oi."orderId"
          )
          SELECT
            DATE(o."createdAt" AT TIME ZONE 'America/Bogota')::text AS date,
            COALESCE(SUM(o.total), 0)::float                        AS revenue,
            COALESCE(SUM(ic.cost), 0)::float                        AS cost
          FROM "Order" o
          LEFT JOIN item_costs ic ON ic."orderId" = o.id
          WHERE o.status NOT IN ('CANCELLED','PENDING')
            AND o."createdAt" >= ${from} AND o."createdAt" <= ${to}
          GROUP BY DATE(o."createdAt" AT TIME ZONE 'America/Bogota')
        `,

        // Daily physical — CTE pre-agrega costos por venta
        this.prisma.$queryRaw<{ date: string; revenue: number; cost: number }[]>`
          WITH item_costs AS (
            SELECT si."saleId", COALESCE(SUM(si.quantity * COALESCE(pc.unit_cost, 0)), 0) AS cost
            FROM "SaleItem" si
            LEFT JOIN (
              SELECT p2.id, COALESCE(SUM(pci.quantity * pci.amount), 0) AS unit_cost
              FROM "Product" p2
              LEFT JOIN "ProductCostItem" pci ON pci."productId" = p2.id
              GROUP BY p2.id
            ) pc ON pc.id = si."productId"
            GROUP BY si."saleId"
          )
          SELECT
            DATE(s."createdAt" AT TIME ZONE 'America/Bogota')::text AS date,
            COALESCE(SUM(s.total), 0)::float                        AS revenue,
            COALESCE(SUM(ic.cost), 0)::float                        AS cost
          FROM "Sale" s
          LEFT JOIN item_costs ic ON ic."saleId" = s.id
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
    const totalUnits   = Number(onlineAgg[0]?.units ?? 0) + physicalByChannel.reduce((s, c) => s + Number(c.units ?? 0), 0);
    const grossProfit  = totalRevenue - totalCost;
    const grossMarginPct = totalRevenue > 0 ? Math.round(grossProfit / totalRevenue * 100) : 0;

    // Gastos fijos del período
    const months = this.monthsInRange(
      fromStr ? new Date(fromStr + 'T12:00:00Z') : from,
      toStr   ? new Date(toStr   + 'T12:00:00Z') : to,
    );
    const [templates, extras] = await Promise.all([
      this.prisma.fixedExpenseTemplate.findMany({ where: { active: true }, orderBy: { order: 'asc' } }),
      months.length > 0
        ? this.prisma.fixedExpense.findMany({ where: { month: { in: months } }, orderBy: { month: 'asc' } })
        : this.prisma.fixedExpense.findMany({ where: { id: 'none' } }),
    ]);
    // Recurrentes: cada plantilla activa aplica una vez por mes en el período
    const recurringPerMonth = templates.reduce((s, t) => s + t.amount, 0);
    const totalRecurring    = recurringPerMonth * months.length;
    const totalExtras       = extras.reduce((s, e) => s + e.amount, 0);
    const totalFixedExpenses = totalRecurring + totalExtras;
    const netProfit    = grossProfit - totalFixedExpenses;
    const netMarginPct = totalRevenue > 0 ? Math.round(netProfit / totalRevenue * 100) : 0;

    return {
      totalRevenue, totalCost, grossProfit, grossMarginPct,
      totalUnits,
      templates, recurringPerMonth, totalRecurring,
      extras, totalExtras,
      totalFixedExpenses, netProfit, netMarginPct,
      monthsInRange: months,
      daily, channels, topProducts,
    };
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

  // ── Plantillas recurrentes ────────────────────────────────────────────────

  async getExpenseTemplates() {
    return this.prisma.fixedExpenseTemplate.findMany({ orderBy: { order: 'asc' } });
  }

  async createExpenseTemplate(name: string, amount: number) {
    const count = await this.prisma.fixedExpenseTemplate.count();
    return this.prisma.fixedExpenseTemplate.create({ data: { name, amount, order: count } });
  }

  async updateExpenseTemplate(id: string, data: { name?: string; amount?: number; active?: boolean; order?: number }) {
    return this.prisma.fixedExpenseTemplate.update({ where: { id }, data });
  }

  async deleteExpenseTemplate(id: string) {
    return this.prisma.fixedExpenseTemplate.delete({ where: { id } });
  }

  // ── Gastos adicionales por mes ────────────────────────────────────────────

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
    const rangeTo:   Date = toStr   ? new Date(new Date(toStr + 'T05:00:00Z').getTime() + msPerDay - 1000) : now;

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
    const rangeTo:   Date = toStr   ? new Date(new Date(toStr + 'T05:00:00Z').getTime() + msPerDay - 1000) : now;
    const rangeFilter = { gte: rangeFrom, lte: rangeTo };

    // Days in range for chart buckets
    const rangeDays = Math.max(1, Math.round((rangeTo.getTime() - rangeFrom.getTime()) / msPerDay) + 1);

    const [ordersInRange, ordersToday, paidInRange, paidAll, totalCustomers, pendingOrders, recentPaidOrders, topProducts, rawHourly, adVisits, addToCart, checkout, topCarted, saleRangeAgg, orderRangeAgg, pageViewCount, ordersInPeriod] =
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

        // Funnel events — respetan el rango de fechas seleccionado
        this.prisma.pageView.count({
          where: { source: 'facebook', createdAt: rangeFilter },
        }),

        this.prisma.funnelEvent.count({
          where: { event: 'add_to_cart', createdAt: rangeFilter },
        }),

        this.prisma.funnelEvent.count({
          where: { event: 'initiate_checkout', createdAt: rangeFilter },
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

        // Ingresos de ventas físicas/WhatsApp en el rango
        this.prisma.sale.aggregate({
          where: { status: { not: 'CANCELLED' }, createdAt: rangeFilter },
          _sum: { total: true },
        }),

        // Ingresos de pedidos online confirmados en el rango
        this.prisma.order.aggregate({
          where: { status: { notIn: ['CANCELLED', 'PENDING'] }, createdAt: rangeFilter },
          _sum: { total: true },
        }),

        // Visitas totales al sitio en el rango (para el embudo)
        this.prisma.pageView.count({ where: { createdAt: rangeFilter } }),

        // Pedidos no cancelados en el rango (para "Compraron" en el embudo)
        this.prisma.order.count({
          where: { status: { not: 'CANCELLED' }, createdAt: rangeFilter },
        }),
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

    const saleRangeRevenue  = Number(saleRangeAgg._sum.total  ?? 0);
    const orderRangeRevenue = Number(orderRangeAgg._sum.total ?? 0);

    return {
      ordersToday,
      salesMonth:       saleRangeRevenue + orderRangeRevenue,
      totalCustomers,
      pendingOrders,
      avgOrderValue:    rangePaidCount > 0 ? rangePaidSum / rangePaidCount : 0,
      totalRevenue:     totalPaidSum,
      adVisits:         Number(adVisits),
      addToCart:        Number(addToCart),
      checkout:         Number(checkout),
      pageViewsInRange: Number(pageViewCount),
      ordersInPeriod:   Number(ordersInPeriod),
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

  async getTopViewedProducts(from?: string, to?: string) {
    const rangeFrom = new Date(from ? `${from}T05:00:00Z` : '2020-01-01T05:00:00Z');
    const rangeTo   = to ? new Date(new Date(`${to}T05:00:00Z`).getTime() + 86399000) : new Date();

    const rows = await this.prisma.$queryRaw<{ name: string; collection: string; views: number }[]>`
      SELECT
        p.name,
        p.collection,
        COUNT(pv.id)::int AS views
      FROM "PageView" pv
      JOIN "Product" p ON p.id = SPLIT_PART(pv.path, '/', 3)
      WHERE pv.path LIKE '/producto/%'
        AND pv."createdAt" >= ${rangeFrom}
        AND pv."createdAt" <= ${rangeTo}
      GROUP BY p.id, p.name, p.collection
      ORDER BY views DESC
      LIMIT 10
    `;

    return rows.map(r => ({ name: r.name, collection: r.collection, views: Number(r.views) }));
  }
}
