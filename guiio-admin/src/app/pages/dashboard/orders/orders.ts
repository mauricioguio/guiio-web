import { Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdersApiService, Order, EditRequest, EditRequestChanges } from '../../../services/orders-api';

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'all';

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

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
  imports: [DatePipe, FormsModule],
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
  protected confirmDelete = signal<Order | null>(null);
  protected deletingId = signal<string | null>(null);

  // Edit requests
  protected editRequests = signal<EditRequest[]>([]);
  protected loadingEditRequests = signal(false);
  protected showEditForm = signal(false);
  protected submittingEdit = signal(false);
  protected reviewingId = signal<string | null>(null);
  protected reviewNote = signal('');

  // Edit form state
  protected editReason = signal('');
  protected itemRemovals = signal<Set<string>>(new Set());
  protected itemModifications = signal<Map<string, { quantity?: number; price?: number }>>(new Map());
  protected newItems = signal<{ productName: string; topSize: string; bottomSize: string; color: string; quantity: number; price: number }[]>([]);

  protected datePreset = signal<DatePreset>('all');
  protected customFrom = signal<string>('');
  protected customTo = signal<string>('');

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

  protected readonly DATE_PRESETS: { value: DatePreset; label: string }[] = [
    { value: 'all',       label: 'Todo' },
    { value: 'today',     label: 'Hoy' },
    { value: 'yesterday', label: 'Ayer' },
    { value: 'week',      label: 'Esta semana' },
    { value: 'month',     label: 'Este mes' },
    { value: 'custom',    label: 'Personalizado' },
  ];

  private dateRange = computed<{ from: Date | null; to: Date | null }>(() => {
    const now = new Date();
    const preset = this.datePreset();
    if (preset === 'today') {
      return { from: startOfDay(now), to: null };
    }
    if (preset === 'yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: startOfDay(now) };
    }
    if (preset === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - d.getDay());
      return { from: startOfDay(d), to: null };
    }
    if (preset === 'month') {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
    }
    if (preset === 'custom') {
      const from = this.customFrom() ? new Date(this.customFrom() + 'T00:00:00') : null;
      const to   = this.customTo()   ? new Date(this.customTo()   + 'T23:59:59') : null;
      return { from, to };
    }
    return { from: null, to: null };
  });

  private dateFiltered = computed(() => {
    const { from, to } = this.dateRange();
    return this.orders().filter(o => {
      const d = new Date(o.createdAt);
      if (from && d < from) return false;
      if (to   && d > to)   return false;
      return true;
    });
  });

  protected filtered = computed(() => {
    const f = this.activeFilter();
    if (f) return this.dateFiltered().filter(o => o.status === f);
    return this.dateFiltered().filter(o => o.status !== 'CANCELLED');
  });

  protected counts = computed(() => {
    const all = this.dateFiltered();
    return {
      PENDING: all.filter(o => o.status === 'PENDING').length,
      PAID:    all.filter(o => o.status === 'PAID').length,
      SHIPPED: all.filter(o => o.status === 'SHIPPED').length,
    };
  });

  protected totalFiltered = computed(() =>
    this.filtered()
      .filter(o => o.status === 'PAID')
      .reduce((sum, o) => sum + o.total, 0)
  );

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.api.getOrders().subscribe({
      next: orders => { this.orders.set(orders); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  setFilter(value: string) { this.activeFilter.set(value); }
  setDatePreset(p: DatePreset) { this.datePreset.set(p); }

  openDetail(order: Order) {
    this.selectedOrder.set(order);
    this.showEditForm.set(false);
    this.editRequests.set([]);
    this.loadEditRequests(order.id);
  }

  closeDetail() {
    this.selectedOrder.set(null);
    this.showEditForm.set(false);
    this.editRequests.set([]);
  }

  loadEditRequests(orderId: string) {
    this.loadingEditRequests.set(true);
    this.api.getEditRequests(orderId).subscribe({
      next: list => { this.editRequests.set(list); this.loadingEditRequests.set(false); },
      error: () => this.loadingEditRequests.set(false),
    });
  }

  openEditForm() {
    const order = this.selectedOrder();
    if (!order) return;
    this.editReason.set('');
    this.itemRemovals.set(new Set());
    this.itemModifications.set(new Map(order.items.map(i => [i.id, { quantity: i.quantity, price: i.price }])));
    this.newItems.set([]);
    this.showEditForm.set(true);
  }

  toggleRemoval(itemId: string) {
    this.itemRemovals.update(s => {
      const n = new Set(s);
      n.has(itemId) ? n.delete(itemId) : n.add(itemId);
      return n;
    });
  }

  setItemMod(itemId: string, field: 'quantity' | 'price', value: number) {
    this.itemModifications.update(m => {
      const n = new Map(m);
      n.set(itemId, { ...n.get(itemId), [field]: value });
      return n;
    });
  }

  addNewItem() {
    this.newItems.update(list => [...list, { productName: '', topSize: '', bottomSize: '', color: '', quantity: 1, price: 0 }]);
  }

  removeNewItem(i: number) {
    this.newItems.update(list => list.filter((_, idx) => idx !== i));
  }

  submitEditRequest() {
    const order = this.selectedOrder();
    if (!order || this.submittingEdit()) return;

    const changes: EditRequestChanges = {};

    const removals = [...this.itemRemovals()];
    if (removals.length) changes.itemsToRemove = removals;

    const mods = [...this.itemModifications().entries()]
      .filter(([id]) => !this.itemRemovals().has(id))
      .filter(([id, mod]) => {
        const orig = order.items.find(i => i.id === id);
        return orig && (mod.quantity !== orig.quantity || mod.price !== orig.price);
      })
      .map(([itemId, mod]) => ({ itemId, ...mod }));
    if (mods.length) changes.itemsToModify = mods;

    const newItems = this.newItems().filter(i => i.productName.trim());
    if (newItems.length) changes.itemsToAdd = newItems;

    if (!removals.length && !mods.length && !newItems.length) return;

    this.submittingEdit.set(true);
    this.api.createEditRequest(order.id, changes, this.editReason() || undefined).subscribe({
      next: req => {
        this.editRequests.update(list => [req, ...list]);
        this.showEditForm.set(false);
        this.submittingEdit.set(false);
      },
      error: () => this.submittingEdit.set(false),
    });
  }

  reviewRequest(id: string, approved: boolean) {
    if (this.reviewingId()) return;
    const order = this.selectedOrder();
    this.reviewingId.set(id);
    this.api.reviewEditRequest(id, approved, this.reviewNote() || undefined).subscribe({
      next: () => {
        this.editRequests.update(list => list.map(r =>
          r.id === id ? { ...r, status: approved ? 'APPROVED' : 'REJECTED', reviewedAt: new Date().toISOString() } : r,
        ));
        if (approved && order) {
          this.api.getOrders().subscribe(orders => {
            this.orders.set(orders);
            const updated = orders.find(o => o.id === order.id);
            if (updated) this.selectedOrder.set(updated);
          });
        }
        this.reviewNote.set('');
        this.reviewingId.set(null);
      },
      error: () => this.reviewingId.set(null),
    });
  }

  hasPendingRequest() {
    return this.editRequests().some(r => r.status === 'PENDING');
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

  deleteOrder(order: Order) {
    this.deletingId.set(order.id);
    this.api.deleteOrder(order.id).subscribe({
      next: () => {
        this.orders.update(list => list.filter(o => o.id !== order.id));
        this.confirmDelete.set(null);
        this.deletingId.set(null);
        if (this.selectedOrder()?.id === order.id) this.selectedOrder.set(null);
      },
      error: () => this.deletingId.set(null),
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
