import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { SellerSalesApiService, SellerSale } from '../../../services/seller-sales-api';
import { OrdersApiService, Order } from '../../../services/orders-api';

type ChannelFilter = 'ALL' | 'salitre' | 'veraguas' | 'whatsapp' | 'online';

const PHYSICAL_STATUS_LABELS: Record<string, string> = {
  PENDING:   'Ingreso',
  PRODUCING: 'Cortado',
  READY:     'Armado sin alistar',
  IN_STORE:  'En tienda',
  DELIVERED: 'Listo para enviar',
  COMPLETED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const ONLINE_STATUS_LABELS: Record<string, string> = {
  PENDING:   'Pendiente',
  PAID:      'Pagado',
  SHIPPED:   'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const PHYSICAL_STATUSES = ['PENDING', 'PRODUCING', 'READY', 'IN_STORE', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
const ONLINE_STATUSES   = ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const FABRICAR_STATUSES = ['PENDING', 'PRODUCING', 'READY', 'IN_STORE', 'DELIVERED', 'COMPLETED'];

export interface ShippingData {
  label: string;
  name: string | null;
  cedula: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
}

@Component({
  selector: 'app-pedidos',
  templateUrl: './pedidos.html',
})
export class Pedidos implements OnInit {
  private readonly physicalApi = inject(SellerSalesApiService);
  private readonly onlineApi   = inject(OrdersApiService);

  protected sales   = signal<SellerSale[]>([]);
  protected orders  = signal<Order[]>([]);
  protected loading = signal(true);

  protected filterChannel = signal<ChannelFilter>('ALL');
  protected filterStatus  = signal('ALL');
  protected expandedId    = signal<string | null>(null);

  protected updatingId   = signal<string | null>(null);
  protected confirmDelete = signal<SellerSale | null>(null);
  protected deletingId   = signal<string | null>(null);

  protected shippingPopup = signal<ShippingData | null>(null);

  protected readonly physicalStatuses = PHYSICAL_STATUSES;
  protected readonly onlineStatuses   = ONLINE_STATUSES;
  protected readonly fabricarStatuses = FABRICAR_STATUSES;

  private saleChannel(sale: SellerSale): ChannelFilter {
    if (sale.channel === 'whatsapp') return 'whatsapp';
    const name = sale.sede.name.toLowerCase();
    if (name.includes('veraguas')) return 'veraguas';
    return 'salitre';
  }

  // 0=activo (arriba), 1=entregado, 2=listo/enviado, 3=cancelado (abajo)
  private physicalGroup(s: SellerSale): number {
    if (s.status === 'CANCELLED') return 3;
    if (s.status === 'DELIVERED') return 2; // Listo para enviar
    if (s.status === 'COMPLETED') return 1; // Entregado
    return 0;
  }

  private onlineGroup(o: Order): number {
    if (o.status === 'CANCELLED') return 3;
    if (o.status === 'SHIPPED')   return 2;
    if (o.status === 'DELIVERED') return 1;
    return 0;
  }

  protected filteredSales = computed(() => {
    const ch = this.filterChannel();
    const st = this.filterStatus();
    if (ch === 'online') return [];
    return this.sales()
      .filter(s => {
        const sch = this.saleChannel(s);
        if (ch !== 'ALL' && sch !== ch) return false;
        if (st !== 'ALL' && s.status !== st) return false;
        return true;
      })
      .sort((a, b) => {
        const ga = this.physicalGroup(a), gb = this.physicalGroup(b);
        if (ga !== gb) return ga - gb;
        return b.orderNumber - a.orderNumber;
      });
  });

  protected filteredOrders = computed(() => {
    const ch = this.filterChannel();
    const st = this.filterStatus();
    if (ch !== 'ALL' && ch !== 'online') return [];
    return this.orders()
      .filter(o => st === 'ALL' || o.status === st)
      .sort((a, b) => {
        const ga = this.onlineGroup(a), gb = this.onlineGroup(b);
        if (ga !== gb) return ga - gb;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  });

  protected totalResults = computed(() => this.filteredSales().length + this.filteredOrders().length);

  ngOnInit() {
    forkJoin({
      sales:  this.physicalApi.getAll(),
      orders: this.onlineApi.getOrders(),
    }).subscribe({
      next: ({ sales, orders }) => {
        this.sales.set(sales);
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onChannelChange(ch: ChannelFilter) {
    this.filterChannel.set(ch);
    this.filterStatus.set('ALL');
    this.expandedId.set(null);
  }

  updateStatus(sale: SellerSale, status: string) {
    if (sale.status === status) return;
    this.updatingId.set(sale.id);
    this.physicalApi.updateStatus(sale.id, status).subscribe({
      next: updated => {
        this.sales.update(list => list.map(s => s.id === updated.id ? updated : s));
        this.updatingId.set(null);
      },
      error: () => this.updatingId.set(null),
    });
  }

  deleteSale(sale: SellerSale) {
    this.deletingId.set(sale.id);
    this.physicalApi.delete(sale.id).subscribe({
      next: () => {
        this.sales.update(list => list.filter(s => s.id !== sale.id));
        if (this.expandedId() === sale.id) this.expandedId.set(null);
        this.confirmDelete.set(null);
        this.deletingId.set(null);
      },
      error: () => this.deletingId.set(null),
    });
  }

  openShippingPopup(data: ShippingData) {
    this.shippingPopup.set(data);
  }

  daysUntil(deliveryDate: string | null): number | null {
    if (!deliveryDate) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(deliveryDate); d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - today.getTime()) / 86400000);
  }

  urgencyBadge(sale: SellerSale): { text: string; cls: string } | null {
    if (sale.type !== 'FABRICAR') return null;
    const days = this.daysUntil(sale.deliveryDate);
    if (days === null) return null;
    if (days <= 0) return { text: 'Vencido',     cls: 'bg-red-500/20 text-red-400 border border-red-500/30' };
    if (days === 1) return { text: 'Falta 1 día', cls: 'bg-red-500/20 text-red-400 border border-red-500/30' };
    if (days === 2) return { text: 'Faltan 2 días', cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' };
    if (days === 3) return { text: 'Faltan 3 días', cls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' };
    return null;
  }

  urgencyBorder(sale: SellerSale): string {
    if (sale.type !== 'FABRICAR') return 'border-gray-800';
    const days = this.daysUntil(sale.deliveryDate);
    if (days === null) return 'border-gray-800';
    if (days <= 1) return 'border-red-500/50';
    if (days <= 2) return 'border-orange-500/50';
    if (days <= 3) return 'border-yellow-500/50';
    return 'border-gray-800';
  }

  saleChannelBadge(sale: SellerSale): { text: string; cls: string } {
    const ch = this.saleChannel(sale);
    if (ch === 'whatsapp') return { text: 'WhatsApp', cls: 'bg-[#25D366]/15 text-[#25D366] border-[#25D366]/30' };
    if (ch === 'veraguas') return { text: 'Veraguas',  cls: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
    return { text: 'Salitre', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
  }

  totalPaid(sale: SellerSale): number {
    return sale.payments.reduce((s, p) => s + p.amount, 0);
  }

  physicalStatusLabel(s: string) { return PHYSICAL_STATUS_LABELS[s] ?? s; }
  onlineStatusLabel(s: string)   { return ONLINE_STATUS_LABELS[s] ?? s; }

  physicalStatusClass(s: string) {
    if (s === 'PENDING')   return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (s === 'PRODUCING') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    if (s === 'READY')     return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    if (s === 'IN_STORE')  return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (s === 'DELIVERED') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'COMPLETED') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (s === 'CANCELLED') return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }

  onlineStatusClass(s: string) {
    if (s === 'PENDING')   return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    if (s === 'PAID')      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'SHIPPED')   return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (s === 'DELIVERED') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (s === 'CANCELLED') return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  }

  selectClass(s: string) {
    if (s === 'PENDING')   return 'border-red-700 text-red-300 bg-red-500/10';
    if (s === 'PRODUCING') return 'border-orange-700 text-orange-300 bg-orange-500/10';
    if (s === 'READY')     return 'border-yellow-700 text-yellow-300 bg-yellow-500/10';
    if (s === 'IN_STORE')  return 'border-purple-700 text-purple-300 bg-purple-500/10';
    if (s === 'DELIVERED') return 'border-blue-700 text-blue-300 bg-blue-500/10';
    if (s === 'COMPLETED') return 'border-green-700 text-green-300 bg-green-500/10';
    return 'border-gray-700 text-gray-300 bg-gray-800';
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  formatDateShort(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso));
  }
}
