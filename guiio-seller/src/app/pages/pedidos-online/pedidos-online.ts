import { Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SellerApiService, OnlineOrder, EditRequestChanges } from '../../services/seller-api';
import { AuthService } from '../../services/auth';
import { Navbar } from '../../components/navbar/navbar';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', PAID: 'Pagado', SHIPPED: 'Enviado',
  DELIVERED: 'Entregado', CANCELLED: 'Cancelado',
};

@Component({
  selector: 'app-pedidos-online',
  imports: [Navbar, FormsModule, DatePipe],
  templateUrl: './pedidos-online.html',
})
export class PedidosOnline {
  private readonly api = inject(SellerApiService);
  readonly auth = inject(AuthService);

  protected orders = signal<OnlineOrder[]>([]);
  protected loading = signal(true);
  protected selectedId = signal<string | null>(null);
  protected showEditForm = signal(false);
  protected submitting = signal(false);
  protected submitted = signal(false);

  // Form state
  protected editReason = signal('');
  protected itemRemovals = signal<Set<string>>(new Set());
  protected itemMods = signal<Map<string, { quantity: number; price: number }>>(new Map());
  protected newItems = signal<{ productName: string; topSize: string; bottomSize: string; color: string; quantity: number; price: number }[]>([]);

  protected readonly STATUS_LABELS = STATUS_LABELS;

  protected selected = computed(() => this.orders().find(o => o.id === this.selectedId()) ?? null);

  constructor() { this.load(); }

  private load() {
    this.loading.set(true);
    this.api.getOnlineOrders().subscribe({
      next: list => { this.orders.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openOrder(order: OnlineOrder) {
    this.selectedId.set(order.id);
    this.resetForm(order);
    this.showEditForm.set(false);
    this.submitted.set(false);
  }

  closeOrder() { this.selectedId.set(null); }

  openForm() {
    const o = this.selected();
    if (o) this.resetForm(o);
    this.showEditForm.set(true);
  }

  private resetForm(order: OnlineOrder) {
    this.editReason.set('');
    this.itemRemovals.set(new Set());
    this.itemMods.set(new Map(order.items.map(i => [i.id, { quantity: i.quantity, price: i.price }])));
    this.newItems.set([]);
  }

  toggleRemoval(id: string) {
    this.itemRemovals.update(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  setMod(id: string, field: 'quantity' | 'price', v: number) {
    this.itemMods.update(m => { const n = new Map(m); n.set(id, { ...n.get(id)!, [field]: v }); return n; });
  }

  addItem() {
    this.newItems.update(l => [...l, { productName: '', topSize: '', bottomSize: '', color: '', quantity: 1, price: 0 }]);
  }

  removeItem(i: number) { this.newItems.update(l => l.filter((_, idx) => idx !== i)); }

  submit() {
    const order = this.selected();
    if (!order || this.submitting()) return;

    const changes: EditRequestChanges = {};
    const removals = [...this.itemRemovals()];
    if (removals.length) changes.itemsToRemove = removals;

    const mods = [...this.itemMods().entries()]
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

    this.submitting.set(true);
    this.api.createEditRequest(order.id, changes, this.editReason() || undefined).subscribe({
      next: () => { this.submitted.set(true); this.showEditForm.set(false); this.submitting.set(false); },
      error: () => this.submitting.set(false),
    });
  }

  statusClass(s: string) {
    return ({
      PENDING: 'bg-yellow-500/10 text-yellow-400', PAID: 'bg-blue-500/10 text-blue-400',
      SHIPPED: 'bg-purple-500/10 text-purple-400', DELIVERED: 'bg-green-500/10 text-green-400',
      CANCELLED: 'bg-gray-500/10 text-gray-400',
    } as Record<string, string>)[s] ?? '';
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }
}
