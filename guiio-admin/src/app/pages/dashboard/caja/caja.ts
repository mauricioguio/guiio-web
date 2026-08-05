import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

const API = 'https://api.guiiouniformes.com/api';

type Period = '7d' | '30d' | 'month' | '90d' | 'custom';

interface CashMovement {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  saleId?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

interface PaymentStat {
  method: string | null;
  total: number;
  count: number;
}

interface DailyPoint {
  date: string;
  efectivo: number;
  transferencia: number;
  otro: number;
}

@Component({
  selector: 'app-caja',
  templateUrl: './caja.html',
  imports: [FormsModule],
})
export class Caja implements OnInit {
  private readonly http = inject(HttpClient);

  protected balance   = signal<number>(0);
  protected movements = signal<CashMovement[]>([]);
  protected stats     = signal<PaymentStat[]>([]);
  protected daily     = signal<DailyPoint[]>([]);
  protected loading   = signal(true);
  protected saving    = signal(false);
  protected showForm  = signal(false);

  protected period      = signal<Period>('30d');
  protected customFrom  = '';
  protected customTo    = '';

  protected expenseDesc   = '';
  protected expenseAmount = 0;
  protected formError     = '';

  protected readonly PERIODS: { value: Period; label: string }[] = [
    { value: '7d',    label: 'Últimos 7 días' },
    { value: '30d',   label: 'Últimos 30 días' },
    { value: 'month', label: 'Este mes' },
    { value: '90d',   label: 'Últimos 90 días' },
  ];

  // ── Computed stats ────────────────────────────────────────────────────────
  protected readonly totalRevenue = computed(() =>
    this.stats().reduce((s, r) => s + r.total, 0)
  );

  protected readonly effectivo = computed(() =>
    this.stats().find(s => s.method === 'EFECTIVO') ?? { method: 'EFECTIVO', total: 0, count: 0 }
  );

  protected readonly transferencia = computed(() =>
    this.stats().find(s => s.method === 'TRANSFERENCIA') ?? { method: 'TRANSFERENCIA', total: 0, count: 0 }
  );

  protected readonly otroStats = computed(() =>
    this.stats().filter(s => s.method !== 'EFECTIVO' && s.method !== 'TRANSFERENCIA')
  );

  protected readonly cashInPeriod = computed(() =>
    this.movements().filter(m => m.type === 'INCOME').reduce((s, m) => s + m.amount, 0)
  );

  protected readonly expensesInPeriod = computed(() =>
    this.movements().filter(m => m.type === 'EXPENSE').reduce((s, m) => s + m.amount, 0)
  );

  ngOnInit() { this.loadAll(); }

  private dateRange(): { from: string; to: string } {
    const now = new Date();
    const p   = this.period();
    if (p === 'custom') {
      return { from: this.customFrom, to: this.customTo };
    }
    const to = now.toISOString().slice(0, 10);
    let from: Date;
    if      (p === '7d')    { from = new Date(now); from.setDate(from.getDate() - 6); }
    else if (p === '90d')   { from = new Date(now); from.setDate(from.getDate() - 89); }
    else if (p === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    else                    { from = new Date(now); from.setDate(from.getDate() - 29); }
    return { from: from.toISOString().slice(0, 10), to };
  }

  loadAll() {
    this.loading.set(true);
    const { from, to } = this.dateRange();
    const params = { from, to };

    this.http.get<{ balance: number }>(`${API}/cash/balance`).subscribe({
      next: r => this.balance.set(r.balance),
    });

    this.http.get<CashMovement[]>(`${API}/cash/movements`, { params }).subscribe({
      next: list => this.movements.set(list),
    });

    this.http.get<PaymentStat[]>(`${API}/cash/stats`, { params }).subscribe({
      next: s => this.stats.set(s),
    });

    this.http.get<DailyPoint[]>(`${API}/cash/daily`, { params }).subscribe({
      next: d => { this.daily.set(d); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  changePeriod(p: Period) { this.period.set(p); this.loadAll(); }

  applyCustom() {
    if (!this.customFrom || !this.customTo) return;
    this.period.set('custom');
    this.loadAll();
  }

  saveExpense() {
    this.formError = '';
    if (!this.expenseDesc.trim()) { this.formError = 'Ingresa una descripción'; return; }
    if (this.expenseAmount <= 0)  { this.formError = 'El monto debe ser mayor a 0'; return; }

    this.saving.set(true);
    this.http.post<CashMovement>(`${API}/cash/expense`, {
      amount: this.expenseAmount,
      description: this.expenseDesc.trim(),
      createdBy: 'admin',
    }).subscribe({
      next: m => {
        this.movements.update(l => [m, ...l]);
        this.balance.update(b => b - m.amount);
        this.expenseDesc = '';
        this.expenseAmount = 0;
        this.showForm.set(false);
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  pct(value: number): number {
    const total = this.totalRevenue();
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  methodLabel(m: string | null) {
    if (m === 'EFECTIVO')     return 'Efectivo';
    if (m === 'TRANSFERENCIA') return 'Transferencia';
    return m ?? 'Otro';
  }
}
