import { Component, inject, signal, computed, OnInit } from '@angular/core';
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
  protected filterMonth = signal('all');
  protected filterType = signal<'all' | 'STOCK' | 'FABRICAR'>('all');

  protected availableMonths = computed(() => {
    const months = new Set<string>();
    for (const s of this.sales()) months.add(s.createdAt.slice(0, 7));
    return Array.from(months).sort().reverse();
  });

  protected filteredSales = computed(() => {
    let list = this.sales();
    const m = this.filterMonth();
    const t = this.filterType();
    if (m !== 'all') list = list.filter(s => s.createdAt.startsWith(m));
    if (t !== 'all') list = list.filter(s => s.type === t);
    return list;
  });

  protected stats = computed(() => {
    const s = this.filteredSales();
    const total = s.reduce((sum, x) => sum + x.total, 0);
    const count = s.length;
    const units = s.flatMap(x => x.items).reduce((sum, i) => sum + i.quantity, 0);
    const stockSales = s.filter(x => x.type === 'STOCK');
    const fabricarSales = s.filter(x => x.type === 'FABRICAR');
    const stockTotal = stockSales.reduce((sum, x) => sum + x.total, 0);
    const fabricarTotal = fabricarSales.reduce((sum, x) => sum + x.total, 0);
    return {
      total, count, units,
      avg: count ? Math.round(total / count) : 0,
      stockCount: stockSales.length, stockTotal,
      fabricarCount: fabricarSales.length, fabricarTotal,
      stockPct: total ? Math.round((stockTotal / total) * 100) : 0,
    };
  });

  protected monthlySummary = computed(() => {
    const typeFilter = this.filterType();
    const src = typeFilter === 'all' ? this.sales() : this.sales().filter(s => s.type === typeFilter);
    const byMonth = new Map<string, { stock: number; fabricar: number; count: number }>();
    for (const sale of src) {
      const key = sale.createdAt.slice(0, 7);
      const m = byMonth.get(key) ?? { stock: 0, fabricar: 0, count: 0 };
      if (sale.type === 'STOCK') m.stock += sale.total;
      else m.fabricar += sale.total;
      m.count++;
      byMonth.set(key, m);
    }
    const arr = Array.from(byMonth.entries())
      .map(([month, d]) => ({ month, total: d.stock + d.fabricar, ...d }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
    const maxTotal = Math.max(...arr.map(m => m.total), 1);
    return arr.map(m => ({ ...m, pct: Math.round((m.total / maxTotal) * 100) }));
  });

  protected topProducts = computed(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const sale of this.filteredSales()) {
      for (const item of sale.items) {
        const p = map.get(item.productName) ?? { name: item.productName, qty: 0, revenue: 0 };
        p.qty += item.quantity;
        p.revenue += item.price * item.quantity;
        map.set(item.productName, p);
      }
    }
    const arr = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
    const maxRev = Math.max(...arr.map(p => p.revenue), 1);
    return arr.map(p => ({ ...p, pct: Math.round((p.revenue / maxRev) * 100) }));
  });

  ngOnInit() {
    if (!this.auth.isLoggedIn()) { this.router.navigate(['/login']); return; }
    this.api.getSales().subscribe({
      next: list => { this.sales.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggleMonth(m: string) {
    this.filterMonth.set(this.filterMonth() === m ? 'all' : m);
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  formatMonth(m: string): string {
    const [y, mo] = m.split('-');
    const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${names[parseInt(mo) - 1]} ${y.slice(2)}`;
  }

  formatMonthLong(m: string): string {
    const [y, mo] = m.split('-');
    const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${names[parseInt(mo) - 1]} ${y}`;
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
    return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
  }

  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
