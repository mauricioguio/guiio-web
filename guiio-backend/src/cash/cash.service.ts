import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  async createIncome(sedeId: string, amount: number, description: string, saleId: string) {
    return this.prisma.cashMovement.create({
      data: { sedeId, type: 'INCOME', amount, description, saleId },
    });
  }

  async createExpense(sedeId: string, amount: number, description: string, createdBy?: string) {
    return this.prisma.cashMovement.create({
      data: { sedeId, type: 'EXPENSE', amount, description, createdBy },
    });
  }

  async getBalance(sedeId: string): Promise<number> {
    const [income, expense] = await Promise.all([
      this.prisma.cashMovement.aggregate({ where: { sedeId, type: 'INCOME' }, _sum: { amount: true } }),
      this.prisma.cashMovement.aggregate({ where: { sedeId, type: 'EXPENSE' }, _sum: { amount: true } }),
    ]);
    return (income._sum.amount ?? 0) - (expense._sum.amount ?? 0);
  }

  private colRange(from?: string, to?: string) {
    const msDay = 86_400_000;
    const gte = from ? new Date(from + 'T05:00:00Z') : undefined;
    const lte = to   ? new Date(new Date(to + 'T05:00:00Z').getTime() + msDay - 1000) : undefined;
    return { gte, lte };
  }

  async getMovements(sedeId: string, from?: string, to?: string) {
    const where: any = { sedeId };
    if (from || to) {
      const { gte, lte } = this.colRange(from, to);
      where.createdAt = {};
      if (gte) where.createdAt.gte = gte;
      if (lte) where.createdAt.lte = lte;
    }
    return this.prisma.cashMovement.findMany({ where, orderBy: { createdAt: 'desc' } });
  }

  async getPaymentStats(sedeId: string, from?: string, to?: string) {
    const where: any = { sedeId, paymentMethod: { not: null } };
    if (from || to) {
      const { gte, lte } = this.colRange(from, to);
      where.createdAt = {};
      if (gte) where.createdAt.gte = gte;
      if (lte) where.createdAt.lte = lte;
    }

    const rows = await this.prisma.sale.groupBy({
      by: ['paymentMethod'],
      where,
      _sum: { total: true },
      _count: { id: true },
    });

    return rows.map(r => ({
      method: r.paymentMethod,
      total: r._sum.total ?? 0,
      count: r._count.id,
    }));
  }

  async getDailyRevenue(sedeId: string, from?: string, to?: string) {
    const where: any = { sedeId };
    if (from || to) {
      const { gte, lte } = this.colRange(from, to);
      where.createdAt = {};
      if (gte) where.createdAt.gte = gte;
      if (lte) where.createdAt.lte = lte;
    }

    const sales = await this.prisma.sale.findMany({
      where: { ...where, paymentMethod: { not: null } },
      select: { createdAt: true, total: true, paymentMethod: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDate = new Map<string, { efectivo: number; transferencia: number; otro: number }>();
    for (const s of sales) {
      const d = s.createdAt.toISOString().slice(0, 10);
      const prev = byDate.get(d) ?? { efectivo: 0, transferencia: 0, otro: 0 };
      const m = (s.paymentMethod ?? '').toUpperCase();
      if (m === 'EFECTIVO')           prev.efectivo      += s.total;
      else if (m === 'TRANSFERENCIA') prev.transferencia += s.total;
      else                            prev.otro          += s.total;
      byDate.set(d, prev);
    }

    return Array.from(byDate.entries()).map(([date, v]) => ({ date, ...v }));
  }
}
