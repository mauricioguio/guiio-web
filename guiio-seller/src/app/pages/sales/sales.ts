import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SellerApiService, Sale } from '../../services/seller-api';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-sales',
  imports: [RouterLink],
  templateUrl: './sales.html',
})
export class Sales implements OnInit {
  private readonly api = inject(SellerApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected sales = signal<Sale[]>([]);
  protected loading = signal(true);
  protected selectedSale = signal<Sale | null>(null);

  ngOnInit() {
    if (!this.auth.isLoggedIn()) { this.router.navigate(['/login']); return; }
    this.api.getSales().subscribe({
      next: list => { this.sales.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  statusLabel(s: string) {
    const map: Record<string, string> = {
      COMPLETED: 'Completada',
      PENDING: 'Pendiente',
      PRODUCING: 'En producción',
      READY: 'Lista',
      DELIVERED: 'Entregada',
      CANCELLED: 'Cancelada',
    };
    return map[s] ?? s;
  }

  statusClass(s: string) {
    if (s === 'COMPLETED' || s === 'DELIVERED') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (s === 'CANCELLED') return 'bg-red-500/10 text-red-400 border-red-500/20';
    return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  }

  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
