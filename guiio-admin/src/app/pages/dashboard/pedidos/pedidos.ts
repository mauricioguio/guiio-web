import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { SellerSalesApiService, SellerSale } from '../../../services/seller-sales-api';
import { OrdersApiService, Order } from '../../../services/orders-api';

interface ItemDraft { id: string; productName: string; size: string; price: number; note: string; }
interface SaleDraft { customerName: string; customerPhone: string; deliveryDate: string; paymentMethod: string; notes: string; items: ItemDraft[]; }
interface SaleChange { label: string; from: string; to: string; }

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

interface PedidoRow {
  id: string;
  kind: 'physical' | 'online';
  group: number;
  sortKey: number;
  sale?: SellerSale;
  order?: Order;
}

@Component({
  selector: 'app-pedidos',
  templateUrl: './pedidos.html',
  imports: [FormsModule],
})
export class Pedidos implements OnInit {
  private readonly physicalApi = inject(SellerSalesApiService);
  private readonly onlineApi   = inject(OrdersApiService);

  protected sales   = signal<SellerSale[]>([]);
  protected orders  = signal<Order[]>([]);
  protected loading = signal(true);

  protected filterChannel = signal<ChannelFilter>('ALL');
  protected filterStatus  = signal('ALL');
  protected searchQuery   = signal('');
  protected expandedId    = signal<string | null>(null);

  protected updatingId   = signal<string | null>(null);
  protected confirmDelete = signal<SellerSale | null>(null);
  protected deletingId   = signal<string | null>(null);

  // Edit state
  protected editingId   = signal<string | null>(null);
  protected editDraft   = signal<SaleDraft | null>(null);
  protected confirmEdit = signal<{ sale: SellerSale; draft: SaleDraft; changes: SaleChange[] } | null>(null);
  protected savingId    = signal<string | null>(null);

  protected updatingOrderId    = signal<string | null>(null);
  protected emailSentPopup     = signal<{ email: string; reference: string } | null>(null);

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

  protected filteredUnified = computed<PedidoRow[]>(() => {
    const ch = this.filterChannel();
    const st = this.filterStatus();
    const q  = this.searchQuery().toLowerCase().trim();
    const rows: PedidoRow[] = [];

    if (ch !== 'online') {
      for (const s of this.sales()) {
        const sch = this.saleChannel(s);
        if (ch !== 'ALL' && sch !== ch) continue;
        if (st !== 'ALL' && s.status !== st) continue;
        if (q) {
          const name  = (s.customerName  ?? '').toLowerCase();
          const phone = (s.customerPhone ?? '').toLowerCase();
          const num   = s.orderNumber.toString();
          if (!name.includes(q) && !phone.includes(q) && !num.includes(q)) continue;
        }
        rows.push({ id: s.id, kind: 'physical', group: this.physicalGroup(s), sortKey: s.orderNumber, sale: s });
      }
    }

    if (ch === 'ALL' || ch === 'online') {
      for (const o of this.orders()) {
        if (st !== 'ALL' && o.status !== st) continue;
        if (q) {
          const name  = o.customer.name.toLowerCase();
          const phone = o.customer.phone.toLowerCase();
          const email = o.customer.email.toLowerCase();
          const ref   = o.reference.toLowerCase();
          if (!name.includes(q) && !phone.includes(q) && !email.includes(q) && !ref.includes(q)) continue;
        }
        rows.push({ id: o.id, kind: 'online', group: this.onlineGroup(o), sortKey: new Date(o.createdAt).getTime(), order: o });
      }
    }

    return rows.sort((a, b) => {
      if (a.group !== b.group) return a.group - b.group;
      if (a.kind !== b.kind) return a.kind === 'physical' ? -1 : 1;
      return b.sortKey - a.sortKey;
    });
  });

  protected totalResults = computed(() => this.filteredUnified().length);

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

  updateOnlineStatus(order: Order, status: string) {
    if (order.status === status) return;
    this.updatingOrderId.set(order.id);
    this.onlineApi.updateStatus(order.id, status).subscribe({
      next: updated => {
        this.orders.update(list => list.map(o => o.id === updated.id ? { ...o, status: updated.status } : o));
        this.updatingOrderId.set(null);
        if (status === 'PAID' && order.customer.email) {
          this.emailSentPopup.set({ email: order.customer.email, reference: order.reference });
          setTimeout(() => this.emailSentPopup.set(null), 6000);
        }
        if (status === 'SHIPPED' && order.customer.email) {
          this.emailSentPopup.set({ email: order.customer.email, reference: order.reference });
          setTimeout(() => this.emailSentPopup.set(null), 6000);
        }
      },
      error: () => this.updatingOrderId.set(null),
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

  paymentProviderLabel(p: string | null): string {
    if (!p) return '';
    const lower = p.toLowerCase();
    if (lower === 'addi')  return 'Addi';
    if (lower === 'wompi') return 'Wompi';
    return p;
  }

  paymentProviderClass(p: string | null): string {
    const lower = (p ?? '').toLowerCase();
    if (lower === 'addi')  return 'bg-[#FF4B6E]/15 text-[#FF4B6E] border-[#FF4B6E]/30';
    if (lower === 'wompi') return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
    return 'bg-gray-500/15 text-gray-400 border-gray-500/20';
  }

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

  selectOnlineClass(s: string) {
    if (s === 'PENDING')   return 'border-yellow-700 text-yellow-300 bg-yellow-500/10';
    if (s === 'PAID')      return 'border-blue-700 text-blue-300 bg-blue-500/10';
    if (s === 'SHIPPED')   return 'border-purple-700 text-purple-300 bg-purple-500/10';
    if (s === 'DELIVERED') return 'border-green-700 text-green-300 bg-green-500/10';
    return 'border-gray-700 text-gray-300 bg-gray-800';
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

  startEdit(sale: SellerSale) {
    const deliveryDate = sale.deliveryDate ? new Date(sale.deliveryDate).toISOString().slice(0, 10) : '';
    this.editDraft.set({
      customerName: sale.customerName ?? '', customerPhone: sale.customerPhone ?? '',
      deliveryDate, paymentMethod: sale.paymentMethod ?? '', notes: sale.notes ?? '',
      items: sale.items.map(i => ({ id: i.id, productName: i.productName, size: i.size, price: i.price, note: i.note ?? '' })),
    });
    this.editingId.set(sale.id);
  }

  cancelEdit() { this.editingId.set(null); this.editDraft.set(null); }

  prepareSave(sale: SellerSale) {
    const draft = this.editDraft();
    if (!draft) return;
    const changes = this.buildDiff(sale, draft);
    if (changes.length === 0) { this.cancelEdit(); return; }
    this.confirmEdit.set({ sale, draft, changes });
  }

  confirmSave() {
    const ctx = this.confirmEdit();
    if (!ctx) return;
    const { sale, draft } = ctx;
    this.savingId.set(sale.id);
    const origDate = sale.deliveryDate ? new Date(sale.deliveryDate).toISOString().slice(0, 10) : '';
    const payload: any = {};
    if (draft.customerName  !== (sale.customerName  ?? '')) payload.customerName  = draft.customerName  || null;
    if (draft.customerPhone !== (sale.customerPhone ?? '')) payload.customerPhone = draft.customerPhone || null;
    if (draft.deliveryDate  !== origDate)                   payload.deliveryDate  = draft.deliveryDate  || null;
    if (draft.paymentMethod !== (sale.paymentMethod ?? '')) payload.paymentMethod = draft.paymentMethod || null;
    if (draft.notes         !== (sale.notes         ?? '')) payload.notes         = draft.notes         || null;
    const changedItems = draft.items.map(di => {
      const orig = sale.items.find(i => i.id === di.id)!;
      const upd: any = { id: di.id };
      if (di.productName !== orig.productName) upd.productName = di.productName;
      if (di.size        !== orig.size)        upd.size        = di.size;
      if (di.price       !== orig.price)       upd.price       = di.price;
      if (di.note        !== (orig.note ?? '')) upd.note       = di.note || null;
      return Object.keys(upd).length > 1 ? upd : null;
    }).filter(Boolean);
    if (changedItems.length) payload.items = changedItems;
    this.physicalApi.updateSale(sale.id, payload).subscribe({
      next: updated => {
        this.sales.update(list => list.map(s => s.id === updated.id ? updated : s));
        this.confirmEdit.set(null); this.editingId.set(null); this.editDraft.set(null); this.savingId.set(null);
      },
      error: () => this.savingId.set(null),
    });
  }

  private buildDiff(sale: SellerSale, draft: SaleDraft): SaleChange[] {
    const changes: SaleChange[] = [];
    const origDate = sale.deliveryDate ? new Date(sale.deliveryDate).toISOString().slice(0, 10) : '';
    if (draft.customerName  !== (sale.customerName  ?? '')) changes.push({ label: 'Nombre cliente', from: sale.customerName  ?? '—', to: draft.customerName  || '—' });
    if (draft.customerPhone !== (sale.customerPhone ?? '')) changes.push({ label: 'Teléfono',       from: sale.customerPhone ?? '—', to: draft.customerPhone || '—' });
    if (draft.deliveryDate  !== origDate)                   changes.push({ label: 'Fecha entrega',  from: origDate           || '—', to: draft.deliveryDate  || '—' });
    if (draft.paymentMethod !== (sale.paymentMethod ?? '')) changes.push({ label: 'Método de pago', from: sale.paymentMethod ?? '—', to: draft.paymentMethod || '—' });
    if (draft.notes         !== (sale.notes         ?? '')) changes.push({ label: 'Notas',          from: sale.notes         ?? '—', to: draft.notes         || '—' });
    for (const di of draft.items) {
      const orig = sale.items.find(i => i.id === di.id); if (!orig) continue;
      const lbl = orig.productName.length > 22 ? orig.productName.slice(0, 22) + '…' : orig.productName;
      if (di.productName !== orig.productName) changes.push({ label: `${lbl} — nombre`, from: orig.productName, to: di.productName });
      if (di.size        !== orig.size)        changes.push({ label: `${lbl} — talla`,  from: orig.size, to: di.size });
      if (di.price       !== orig.price)       changes.push({ label: `${lbl} — precio`, from: this.formatPrice(orig.price), to: this.formatPrice(di.price) });
      if (di.note        !== (orig.note ?? '')) changes.push({ label: `${lbl} — nota`,  from: orig.note ?? '—', to: di.note || '—' });
    }
    return changes;
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  formatDateShort(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso));
  }

  formatOnlineSize(topSize: string, bottomSize: string, legStyle?: string | null): string {
    let size = '';
    if (topSize && bottomSize) size = `Blusa ${topSize} / Pantalón ${bottomSize}`;
    else if (topSize)          size = `Talla ${topSize}`;
    else if (bottomSize)       size = `Talla ${bottomSize}`;
    if (legStyle) size += ` · Bota ${legStyle}`;
    return size;
  }
}
