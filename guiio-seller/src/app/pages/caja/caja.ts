import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth';

const API = 'https://api.guiiouniformes.com/api';

type Period = 'today' | 'week' | 'month';

interface CashMovement {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  saleId?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

@Component({
  selector: 'app-caja',
  templateUrl: './caja.html',
  imports: [FormsModule, RouterLink, RouterLinkActive],
})
export class Caja implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(AuthService);

  protected balance    = signal<number>(0);
  protected movements  = signal<CashMovement[]>([]);
  protected loading    = signal(true);
  protected saving     = signal(false);
  protected showForm   = signal(false);
  protected period     = signal<Period>('today');

  protected expenseDesc   = '';
  protected expenseAmount = 0;
  protected formError     = '';

  protected readonly PERIODS: { value: Period; label: string }[] = [
    { value: 'today', label: 'Hoy' },
    { value: 'week',  label: 'Esta semana' },
    { value: 'month', label: 'Este mes' },
  ];

  protected readonly totalIncome = computed(() =>
    this.movements().filter(m => m.type === 'INCOME').reduce((s, m) => s + m.amount, 0)
  );

  protected readonly totalExpenses = computed(() =>
    this.movements().filter(m => m.type === 'EXPENSE').reduce((s, m) => s + m.amount, 0)
  );

  private get sedeId(): string {
    return this.auth.currentSede()?.sedeId ?? '';
  }

  private dateRange(): { from: string; to: string } {
    const now = new Date();
    const to  = now.toISOString().slice(0, 10);
    const p   = this.period();
    let from: Date;
    if (p === 'week') {
      from = new Date(now);
      const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
      from.setDate(now.getDate() - day);
    } else if (p === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      from = now;
    }
    return { from: from.toISOString().slice(0, 10), to };
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    const sid = this.sedeId;
    const { from, to } = this.dateRange();

    this.http.get<{ balance: number }>(`${API}/cash/balance`, { params: { sedeId: sid } }).subscribe({
      next: r => this.balance.set(r.balance),
    });

    this.http.get<CashMovement[]>(`${API}/cash/movements`, { params: { sedeId: sid, from, to } }).subscribe({
      next: list => { this.movements.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  changePeriod(p: Period) { this.period.set(p); this.load(); }

  saveExpense() {
    this.formError = '';
    if (!this.expenseDesc.trim()) { this.formError = 'Ingresa una descripción'; return; }
    if (this.expenseAmount <= 0)  { this.formError = 'El monto debe ser mayor a 0'; return; }

    this.saving.set(true);
    this.http.post<CashMovement>(`${API}/cash/expense`, {
      sedeId: this.sedeId,
      amount: this.expenseAmount,
      description: this.expenseDesc.trim(),
      createdBy: this.auth.currentSede()?.sedeName ?? 'seller',
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

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatDate(iso: string) {
    const d = new Date(iso);
    const p = this.period();
    if (p === 'today') {
      return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) + ' ' +
           d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
}
