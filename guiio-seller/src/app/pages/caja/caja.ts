import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth';

const API = 'https://api.guiiouniformes.com/api';

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

  protected expenseDesc   = '';
  protected expenseAmount = 0;
  protected formError     = '';

  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly todayMovements = computed(() =>
    this.movements().filter(m => m.createdAt.slice(0, 10) === this.today)
  );

  protected readonly todayIncome = computed(() =>
    this.todayMovements().filter(m => m.type === 'INCOME').reduce((s, m) => s + m.amount, 0)
  );

  protected readonly todayExpenses = computed(() =>
    this.todayMovements().filter(m => m.type === 'EXPENSE').reduce((s, m) => s + m.amount, 0)
  );

  ngOnInit() { this.load(); }

  private get sedeId(): string {
    return this.auth.currentSede()?.sedeId ?? '';
  }

  load() {
    this.loading.set(true);
    const sid = this.sedeId;
    this.http.get<{ balance: number }>(`${API}/cash/balance`, { params: { sedeId: sid } }).subscribe({
      next: r => this.balance.set(r.balance),
    });
    this.http.get<CashMovement[]>(`${API}/cash/movements`, { params: { sedeId: sid, from: this.today, to: this.today } }).subscribe({
      next: list => { this.movements.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

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

  formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }
}
