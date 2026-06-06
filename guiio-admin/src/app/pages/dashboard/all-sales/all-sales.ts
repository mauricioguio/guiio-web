import { Component, inject, signal, computed } from '@angular/core';
import { AllSalesApiService, UnifiedSale } from '../../../services/all-sales-api';

type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const STATUS_LABELS: Record<string, string> = {
  // Online order statuses
  PENDING:   'Pendiente',
  PAID:      'Pagado',
  SHIPPED:   'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
  // Physical sale statuses
  PRODUCING: 'Cortado',
  READY:     'Armado',
  IN_STORE:  'En tienda',
  COMPLETED: 'Completado',
};

@Component({
  selector: 'app-all-sales',
  templateUrl: './all-sales.html',
})
export class AllSales {
  private readonly api = inject(AllSalesApiService);

  protected sales = signal<UnifiedSale[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  protected channelFilter = signal<string>('ALL');
  protected datePreset = signal<DatePreset>('all');
  protected expandedId = signal<string | null>(null);

  protected readonly DATE_PRESETS: { value: DatePreset; label: string }[] = [
    { value: 'all',       label: 'Todo' },
    { value: 'today',     label: 'Hoy' },
    { value: 'yesterday', label: 'Ayer' },
    { value: 'week',      label: 'Esta semana' },
    { value: 'month',     label: 'Este mes' },
  ];

  protected readonly STATUS_LABELS = STATUS_LABELS;

  protected channels = computed(() => {
    const sedeNames = [...new Set(
      this.sales()
        .filter(s => s.channel === 'fisica')
        .map(s => s.channelName)
    )].sort();
    return ['ALL', 'online', ...sedeNames];
  });

  private dateFiltered = computed(() => {
    const preset = this.datePreset();
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;

    if (preset === 'today') {
      from = startOfDay(now);
    } else if (preset === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      from = startOfDay(y);
      to = startOfDay(now);
    } else if (preset === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay());
      from = startOfDay(d);
    } else if (preset === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return this.sales().filter(s => {
      if (s.status === 'CANCELLED') return false;
      const d = new Date(s.createdAt);
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    });
  });

  protected filtered = computed(() => {
    const ch = this.channelFilter();
    if (ch === 'ALL') return this.dateFiltered();
    if (ch === 'online') return this.dateFiltered().filter(s => s.channel === 'online');
    return this.dateFiltered().filter(s => s.channelName === ch);
  });

  protected totalRevenue = computed(() =>
    this.filtered().reduce((s, x) => s + x.total, 0)
  );

  protected totalOnline = computed(() =>
    this.filtered().filter(x => x.channel === 'online').reduce((s, x) => s + x.total, 0)
  );

  protected totalFisica = computed(() =>
    this.filtered().filter(x => x.channel === 'fisica').reduce((s, x) => s + x.total, 0)
  );

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.api.getAll().subscribe({
      next: list => { this.sales.set(list); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  channelLabel(ch: string): string {
    if (ch === 'ALL') return 'Todos';
    if (ch === 'online') return 'Online';
    return ch;
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(v);
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  statusLabel(s: string): string {
    return STATUS_LABELS[s] ?? s;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      PENDING:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
      PAID:      'bg-blue-500/15 text-blue-400 border-blue-500/20',
      SHIPPED:   'bg-purple-500/15 text-purple-400 border-purple-500/20',
      DELIVERED: 'bg-green-500/15 text-green-400 border-green-500/20',
      CANCELLED: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
      PRODUCING: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
      READY:     'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
      IN_STORE:  'bg-purple-500/15 text-purple-400 border-purple-500/20',
      COMPLETED: 'bg-green-500/15 text-green-400 border-green-500/20',
    };
    return map[status] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/20';
  }
}
