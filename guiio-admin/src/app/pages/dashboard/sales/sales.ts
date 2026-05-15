import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { SellerSalesApiService, SellerSale } from '../../../services/seller-sales-api';

const STATUSES = ['PENDING', 'PRODUCING', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

@Component({
  selector: 'app-sales',
  templateUrl: './sales.html',
})
export class Sales implements OnInit {
  private readonly api = inject(SellerSalesApiService);

  protected sales = signal<SellerSale[]>([]);
  protected loading = signal(true);
  protected filterType = signal<'ALL' | 'STOCK' | 'FABRICAR'>('ALL');
  protected filterStatus = signal('ALL');
  protected expandedId = signal<string | null>(null);
  protected updatingId = signal<string | null>(null);

  protected readonly statuses = STATUSES;

  protected filtered = computed(() => {
    const type = this.filterType();
    const status = this.filterStatus();
    return this.sales().filter(s => {
      if (type !== 'ALL' && s.type !== type) return false;
      if (status !== 'ALL' && s.status !== status) return false;
      return true;
    });
  });

  ngOnInit() {
    this.api.getAll().subscribe({
      next: list => { this.sales.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  updateStatus(sale: SellerSale, status: string) {
    this.updatingId.set(sale.id);
    this.api.updateStatus(sale.id, status).subscribe({
      next: updated => {
        this.sales.update(list => list.map(s => s.id === updated.id ? updated : s));
        this.updatingId.set(null);
      },
      error: () => this.updatingId.set(null),
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
      COMPLETED: 'Completada', PENDING: 'Pendiente', PRODUCING: 'En producción',
      READY: 'Lista', DELIVERED: 'Entregada', CANCELLED: 'Cancelada',
    };
    return map[s] ?? s;
  }

  statusClass(s: string) {
    if (s === 'COMPLETED' || s === 'DELIVERED') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (s === 'CANCELLED') return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (s === 'READY') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  }
}
