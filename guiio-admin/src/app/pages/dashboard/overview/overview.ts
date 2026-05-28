import { Component, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AnalyticsApiService, OverviewData, DailySale } from '../../../services/analytics-api';

const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

@Component({
  selector: 'app-overview',
  templateUrl: './overview.html',
  imports: [DecimalPipe],
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

  protected readonly H_W = 600;
  protected readonly H_H = 80;
  protected readonly H_PAD = 8;

  protected hourlyPath = computed(() => {
    const sessions = this.data()?.hourlySessions;
    if (!sessions || sessions.length === 0) return '';
    const max = Math.max(...sessions.map(s => s.count), 1);
    const w = this.H_W - this.H_PAD * 2;
    const h = this.H_H - this.H_PAD * 2;
    const pts = sessions.map((s, i) => ({
      x: this.H_PAD + (i / (sessions.length - 1)) * w,
      y: this.H_PAD + h - (s.count / max) * h,
    }));
    let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  });

  protected hourlyArea = computed(() => {
    const path = this.hourlyPath();
    if (!path) return '';
    const bottom = this.H_H - this.H_PAD;
    return `${path} L ${(this.H_W - this.H_PAD).toFixed(1)},${bottom} L ${this.H_PAD},${bottom} Z`;
  });

  protected hourlyLabels = computed(() => {
    const sessions = this.data()?.hourlySessions ?? [];
    if (sessions.length === 0) return [];
    const w = this.H_W - this.H_PAD * 2;
    return [0, 6, 12, 18, 23].map(i => ({
      x: this.H_PAD + (i / (sessions.length - 1)) * w,
      label: `${String(i).padStart(2, '0')}:00`,
    }));
  });

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
