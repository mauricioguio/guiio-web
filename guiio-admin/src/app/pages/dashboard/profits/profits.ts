import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ProfitsApiService, ProfitsData, DailyPoint } from '../../../services/profits-api';

type Period = '30d' | '7d' | 'month' | '90d';

@Component({
  selector: 'app-profits',
  templateUrl: './profits.html',
})
export class Profits implements OnInit {
  private readonly api = inject(ProfitsApiService);

  protected data    = signal<ProfitsData | null>(null);
  protected loading = signal(true);
  protected error   = signal(false);
  protected period  = signal<Period>('30d');

  protected readonly PERIODS: { value: Period; label: string }[] = [
    { value: '7d',    label: 'Últimos 7 días' },
    { value: '30d',   label: 'Últimos 30 días' },
    { value: 'month', label: 'Este mes' },
    { value: '90d',   label: 'Últimos 90 días' },
  ];

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(false);
    const { from, to } = this.dateRange();
    this.api.get(from, to).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  changePeriod(p: Period) {
    this.period.set(p);
    this.load();
  }

  private dateRange(): { from: string; to: string } {
    const now  = new Date();
    const to   = now.toISOString().slice(0, 10);
    const p    = this.period();
    let from: Date;
    if (p === '7d')    { from = new Date(now); from.setDate(from.getDate() - 6); }
    else if (p === '90d') { from = new Date(now); from.setDate(from.getDate() - 89); }
    else if (p === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    else               { from = new Date(now); from.setDate(from.getDate() - 29); }
    return { from: from.toISOString().slice(0, 10), to };
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatShort(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v}`;
  }

  // ── SVG chart helpers ──────────────────────────────────────────────────────
  protected readonly CHART_W = 600;
  protected readonly CHART_H = 180;
  protected readonly PAD     = { top: 12, right: 8, bottom: 28, left: 52 };

  protected chartPoints = computed((): { revenue: DailyPoint[]; profit: DailyPoint[]; maxVal: number } => {
    const d = this.data();
    if (!d) return { revenue: [], profit: [], maxVal: 1 };
    const maxVal = Math.max(...d.daily.map(p => p.revenue), 1);
    return { revenue: d.daily, profit: d.daily, maxVal };
  });

  private xFor(i: number, total: number): number {
    const w = this.CHART_W - this.PAD.left - this.PAD.right;
    return this.PAD.left + (total <= 1 ? w / 2 : (i / (total - 1)) * w);
  }

  private yFor(val: number, maxVal: number): number {
    const h = this.CHART_H - this.PAD.top - this.PAD.bottom;
    return this.PAD.top + h - (val / maxVal) * h;
  }

  protected revenuePolyline = computed((): string => {
    const { revenue, maxVal } = this.chartPoints();
    if (!revenue.length) return '';
    return revenue.map((p, i) => `${this.xFor(i, revenue.length)},${this.yFor(p.revenue, maxVal)}`).join(' ');
  });

  protected profitPolyline = computed((): string => {
    const { profit, maxVal } = this.chartPoints();
    if (!profit.length) return '';
    return profit.map((p, i) => `${this.xFor(i, profit.length)},${this.yFor(p.profit, maxVal)}`).join(' ');
  });

  protected revenueArea = computed((): string => {
    const { revenue, maxVal } = this.chartPoints();
    if (!revenue.length) return '';
    const bottom = this.CHART_H - this.PAD.bottom;
    const pts = revenue.map((p, i) => `${this.xFor(i, revenue.length)},${this.yFor(p.revenue, maxVal)}`).join(' ');
    const first = `${this.xFor(0, revenue.length)},${bottom}`;
    const last  = `${this.xFor(revenue.length - 1, revenue.length)},${bottom}`;
    return `${first} ${pts} ${last}`;
  });

  protected chartXLabels = computed(() => {
    const d = this.data();
    if (!d || d.daily.length === 0) return [];
    const days = d.daily;
    const step = Math.max(1, Math.floor(days.length / 5));
    return days
      .filter((_, i) => i % step === 0 || i === days.length - 1)
      .map((p, _, arr) => {
        const idx = days.indexOf(p);
        const date = new Date(p.date + 'T12:00:00');
        return {
          x: this.xFor(idx, days.length),
          y: this.CHART_H - 4,
          label: date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
        };
      });
  });

  protected yGridLines = computed(() => {
    const { maxVal } = this.chartPoints();
    return [0, 0.25, 0.5, 0.75, 1].map(f => ({
      y: this.yFor(f * maxVal, maxVal),
      label: this.formatShort(f * maxVal),
    }));
  });

  hasCostData = computed(() => (this.data()?.topProducts ?? []).some(p => p.cost > 0));
}
