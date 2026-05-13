import { Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { OrdersApiService, Order } from '../../../services/orders-api';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PAID: 'Pagado',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const STATUS_NEXT: Record<string, string[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

@Component({
  selector: 'app-orders',
  imports: [DatePipe],
  templateUrl: './orders.html',
})
export class Orders {
  private readonly api = inject(OrdersApiService);

  protected orders = signal<Order[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  protected activeFilter = signal<string>('');
  protected selectedOrder = signal<Order | null>(null);
  protected updatingId = signal<string | null>(null);

  protected readonly STATUS_LABELS = STATUS_LABELS;
  protected readonly STATUS_NEXT = STATUS_NEXT;

  protected readonly FILTERS = [
    { value: '', label: 'Todos' },
    { value: 'PENDING', label: 'Pendientes' },
    { value: 'PAID', label: 'Pagados' },
    { value: 'SHIPPED', label: 'Enviados' },
    { value: 'DELIVERED', label: 'Entregados' },
    { value: 'CANCELLED', label: 'Cancelados' },
  ];

  protected counts = computed(() => {
    const all = this.orders();
    return {
      PENDING: all.filter(o => o.status === 'PENDING').length,
      PAID: all.filter(o => o.status === 'PAID').length,
      SHIPPED: all.filter(o => o.status === 'SHIPPED').length,
    };
  });

  protected filtered = computed(() => {
    const f = this.activeFilter();
    return f ? this.orders().filter(o => o.status === f) : this.orders();
  });

  constructor() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.api.getOrders().subscribe({
      next: orders => { this.orders.set(orders); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  setFilter(value: string) {
    this.activeFilter.set(value);
  }

  openDetail(order: Order) {
    this.selectedOrder.set(order);
  }

  closeDetail() {
    this.selectedOrder.set(null);
  }

  changeStatus(order: Order, newStatus: string) {
    this.updatingId.set(order.id);
    this.api.updateStatus(order.id, newStatus).subscribe({
      next: updated => {
        this.orders.update(list => list.map(o => o.id === updated.id ? { ...o, status: updated.status } : o));
        if (this.selectedOrder()?.id === order.id) {
          this.selectedOrder.update(o => o ? { ...o, status: updated.status } : null);
        }
        this.updatingId.set(null);
      },
      error: () => this.updatingId.set(null),
    });
  }

  statusClass(status: string): string {
    return ({
      PENDING:   'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
      PAID:      'bg-blue-500/15 text-blue-400 border-blue-500/20',
      SHIPPED:   'bg-purple-500/15 text-purple-400 border-purple-500/20',
      DELIVERED: 'bg-green-500/15 text-green-400 border-green-500/20',
      CANCELLED: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
    } as Record<string, string>)[status] ?? '';
  }

  formatPrice(value: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(value);
  }
}
