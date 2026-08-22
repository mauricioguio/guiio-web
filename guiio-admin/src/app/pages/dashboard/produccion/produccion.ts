import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

const API_URL = 'https://api.guiiouniformes.com/api';

export interface ProductionItem {
  productName: string;
  size: string;
  quantity: number;
  note: string | null;
}

export interface ProductionOrder {
  id: string;
  ref: string;
  source: 'online' | 'whatsapp' | 'fabricar';
  channelName: string;
  customerName: string | null;
  customerPhone: string | null;
  createdAt: string;
  deliveryDate: string | null;
  status: string;
  notes: string | null;
  items: ProductionItem[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:   'Ingreso',
  PRODUCING: 'Cortado',
  READY:     'Armado sin alistar',
  IN_STORE:  'En tienda',
  DELIVERED: 'Listo para enviar',
  COMPLETED: 'Entregado',
  CANCELLED: 'Cancelado',
  PAID:      'Pagado',
  SHIPPED:   'Enviado',
};

@Component({
  selector: 'app-produccion',
  templateUrl: './produccion.html',
  imports: [FormsModule],
})
export class Produccion implements OnInit {
  private readonly http = inject(HttpClient);

  protected orders   = signal<ProductionOrder[]>([]);
  protected loading  = signal(true);
  protected search   = signal('');
  protected filterSource = signal<'ALL' | 'online' | 'whatsapp' | 'fabricar'>('ALL');
  protected filterStatus = signal('ALL');
  protected hideCompleted = signal(true);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statuses = ['PENDING', 'PRODUCING', 'READY', 'IN_STORE', 'DELIVERED', 'COMPLETED', 'PAID', 'SHIPPED'];

  protected filtered = computed(() => {
    const q   = this.search().toLowerCase().trim();
    const src = this.filterSource();
    const st  = this.filterStatus();
    const hc  = this.hideCompleted();

    return this.orders().filter(o => {
      if (src !== 'ALL' && o.source !== src) return false;
      if (st  !== 'ALL' && o.status !== st)  return false;
      if (hc && (o.status === 'COMPLETED' || o.status === 'DELIVERED')) return false;
      if (q) {
        const haystack = [
          o.customerName, o.customerPhone, o.ref,
          ...o.items.map(i => i.productName + ' ' + i.size),
          o.notes,
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  });

  ngOnInit() {
    this.http.get<ProductionOrder[]>(`${API_URL}/seller/admin/production-orders`).subscribe({
      next: list => { this.orders.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short' }).format(new Date(iso));
  }

  formatDelivery(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeZone: 'UTC' }).format(new Date(iso));
  }

  daysUntil(iso: string): number {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(iso); d.setUTCHours(12, 0, 0, 0);
    return Math.ceil((d.getTime() - today.getTime()) / 86400000);
  }

  deliveryClass(iso: string): string {
    const days = this.daysUntil(iso);
    if (days <= 0)  return 'text-red-400 font-semibold';
    if (days <= 2)  return 'text-orange-400 font-semibold';
    if (days <= 4)  return 'text-yellow-400';
    return 'text-gray-300';
  }

  sourceLabel(s: string) {
    if (s === 'online')   return 'Online';
    if (s === 'whatsapp') return 'WhatsApp';
    return 'Tienda';
  }

  statusLabel(s: string) { return STATUS_LABELS[s] ?? s; }

  statusClass(s: string) {
    if (s === 'PENDING')   return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (s === 'PRODUCING') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    if (s === 'READY')     return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    if (s === 'IN_STORE')  return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (s === 'DELIVERED') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'COMPLETED') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (s === 'PAID')      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'SHIPPED')   return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }
}
