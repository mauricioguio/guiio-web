import { Component, inject, signal, computed } from '@angular/core';
import { AnalyticsApiService, OverviewData, DailySale } from '../../../services/analytics-api';

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

@Component({
  selector: 'app-overview',
  templateUrl: './overview.html',
})
export class Overview {
  private readonly api = inject(AnalyticsApiService);

  protected data    = signal<OverviewData | null>(null);
  protected loading = signal(true);
  protected error   = signal(false);

  protected readonly CHART_W = 600;
  protected readonly CHART_H = 120;
  protected readonly PAD     = 8;

  protected chartPoints = computed(() => {
    const daily = this.data()?.dailySales;
    if (!daily || daily.length === 0) return '';
    const max = Math.max(...daily.map(d => d.total), 1);
    const w = this.CHART_W - this.PAD * 2;
    const h = this.CHART_H - this.PAD * 2;
    return daily
      .map((d, i) => {
        const x = this.PAD + (i / (daily.length - 1)) * w;
        const y = this.PAD + h - (d.total / max) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  protected chartArea = computed(() => {
    const pts = this.chartPoints();
    if (!pts) return '';
    const first = pts.split(' ')[0];
    const last  = pts.split(' ').at(-1)!;
    const fx = first.split(',')[0];
    const lx = last.split(',')[0];
    const bottom = this.CHART_H - this.PAD;
    return `${fx},${bottom} ${pts} ${lx},${bottom}`;
  });

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.api.getOverview().subscribe({
      next:  d  => { this.data.set(d); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  fmt(value: number) { return COP.format(value); }

  fmtDate(iso: string) {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
  }

  totalVisits = computed(() =>
    (this.data()?.hourlySessions ?? []).reduce((s, h) => s + h.count, 0),
  );

  maxVisits = computed(() =>
    Math.max(...(this.data()?.hourlySessions ?? []).map(h => h.count), 1),
  );

  chartLabels = computed(() => {
    const daily = this.data()?.dailySales ?? [];
    if (daily.length === 0) return [];
    const w = this.CHART_W - this.PAD * 2;
    const indices = [0, Math.floor(daily.length / 4), Math.floor(daily.length / 2), Math.floor(daily.length * 3 / 4), daily.length - 1];
    return indices.map(i => ({
      x: this.PAD + (i / (daily.length - 1)) * w,
      label: this.fmtDate(daily[i].date),
    }));
  });
}
