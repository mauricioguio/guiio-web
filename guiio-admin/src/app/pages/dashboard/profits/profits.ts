import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfitsApiService, ProfitsData, DailyPoint, ExpenseTemplate, FixedExpense } from '../../../services/profits-api';

type Period   = '30d' | '7d' | 'month' | '90d';
type PanelTab = 'recurring' | 'extras';

@Component({
  selector: 'app-profits',
  templateUrl: './profits.html',
  imports: [FormsModule],
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

  // ── Panel de gastos ────────────────────────────────────────────────────────
  protected showPanel   = signal(false);
  protected panelTab    = signal<PanelTab>('recurring');
  protected panelLoading = signal(false);

  // Recurrentes (plantillas)
  protected templates     = signal<ExpenseTemplate[]>([]);
  protected newTplName    = '';
  protected newTplAmount  = 0;
  protected editTplId     = signal<string | null>(null);
  protected editTplName   = '';
  protected editTplAmount = 0;

  protected readonly templatesTotal = computed(() =>
    this.templates().filter(t => t.active).reduce((s, t) => s + t.amount, 0)
  );

  // Adicionales por mes
  protected extrasMonth   = signal(this.currentMonth());
  protected extras        = signal<FixedExpense[]>([]);
  protected newExtName    = '';
  protected newExtAmount  = 0;
  protected editExtId     = signal<string | null>(null);
  protected editExtName   = '';
  protected editExtAmount = 0;

  protected readonly extrasTotal = computed(() =>
    this.extras().reduce((s, e) => s + e.amount, 0)
  );

  // ── Ciclo de vida ──────────────────────────────────────────────────────────
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

  changePeriod(p: Period) { this.period.set(p); this.load(); }

  private dateRange(): { from: string; to: string } {
    const now = new Date();
    const to  = now.toISOString().slice(0, 10);
    let from: Date;
    const p = this.period();
    if (p === '7d')      { from = new Date(now); from.setDate(from.getDate() - 6); }
    else if (p === '90d') { from = new Date(now); from.setDate(from.getDate() - 89); }
    else if (p === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    else                  { from = new Date(now); from.setDate(from.getDate() - 29); }
    return { from: from.toISOString().slice(0, 10), to };
  }

  // ── Panel ──────────────────────────────────────────────────────────────────
  openPanel(tab: PanelTab = 'recurring') {
    this.showPanel.set(true);
    this.panelTab.set(tab);
    this.loadTemplates();
    this.loadExtras();
  }

  switchTab(tab: PanelTab) {
    this.panelTab.set(tab);
    if (tab === 'recurring') this.loadTemplates();
    else this.loadExtras();
  }

  // ── Plantillas recurrentes ─────────────────────────────────────────────────
  loadTemplates() {
    this.panelLoading.set(true);
    this.api.getTemplates().subscribe({
      next: list => { this.templates.set(list); this.panelLoading.set(false); },
      error: ()  => this.panelLoading.set(false),
    });
  }

  addTemplate() {
    const name = this.newTplName.trim();
    if (!name || this.newTplAmount <= 0) return;
    this.api.createTemplate(name, this.newTplAmount).subscribe({
      next: t => {
        this.templates.update(l => [...l, t]);
        this.newTplName = ''; this.newTplAmount = 0;
        this.load();
      },
    });
  }

  startEditTpl(t: ExpenseTemplate) {
    this.editTplId.set(t.id);
    this.editTplName = t.name; this.editTplAmount = t.amount;
  }

  saveEditTpl() {
    const id = this.editTplId();
    if (!id) return;
    this.api.updateTemplate(id, { name: this.editTplName, amount: this.editTplAmount }).subscribe({
      next: updated => {
        this.templates.update(l => l.map(t => t.id === id ? updated : t));
        this.editTplId.set(null);
        this.load();
      },
    });
  }

  toggleTemplate(t: ExpenseTemplate) {
    this.api.updateTemplate(t.id, { active: !t.active }).subscribe({
      next: updated => {
        this.templates.update(l => l.map(x => x.id === t.id ? updated : x));
        this.load();
      },
    });
  }

  deleteTpl(id: string) {
    if (!confirm('¿Eliminar este gasto recurrente?')) return;
    this.api.deleteTemplate(id).subscribe({
      next: () => { this.templates.update(l => l.filter(t => t.id !== id)); this.load(); },
    });
  }

  // ── Adicionales por mes ────────────────────────────────────────────────────
  loadExtras() {
    this.panelLoading.set(true);
    this.api.getExtras(this.extrasMonth()).subscribe({
      next: list => { this.extras.set(list); this.panelLoading.set(false); },
      error: ()  => this.panelLoading.set(false),
    });
  }

  changeExtrasMonth(month: string) { this.extrasMonth.set(month); this.loadExtras(); }

  addExtra() {
    const name = this.newExtName.trim();
    if (!name || this.newExtAmount <= 0) return;
    this.api.createExtra(name, this.newExtAmount, this.extrasMonth()).subscribe({
      next: e => {
        this.extras.update(l => [...l, e]);
        this.newExtName = ''; this.newExtAmount = 0;
        this.load();
      },
    });
  }

  startEditExt(e: FixedExpense) {
    this.editExtId.set(e.id);
    this.editExtName = e.name; this.editExtAmount = e.amount;
  }

  saveEditExt() {
    const id = this.editExtId();
    if (!id) return;
    this.api.updateExtra(id, { name: this.editExtName, amount: this.editExtAmount }).subscribe({
      next: updated => {
        this.extras.update(l => l.map(e => e.id === id ? updated : e));
        this.editExtId.set(null);
        this.load();
      },
    });
  }

  deleteExtra(id: string) {
    if (!confirm('¿Eliminar este gasto adicional?')) return;
    this.api.deleteExtra(id).subscribe({
      next: () => { this.extras.update(l => l.filter(e => e.id !== id)); this.load(); },
    });
  }

  // ── Utilidades ─────────────────────────────────────────────────────────────
  private currentMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  protected monthLabel(month: string): string {
    const [y, m] = month.split('-');
    return new Date(+y, +m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatShort(v: number): string {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v}`;
  }

  // ── SVG chart ──────────────────────────────────────────────────────────────
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
    const pts  = revenue.map((p, i) => `${this.xFor(i, revenue.length)},${this.yFor(p.revenue, maxVal)}`).join(' ');
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
      .map(p => {
        const idx  = days.indexOf(p);
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
