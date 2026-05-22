import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import html2canvas from 'html2canvas';
import { SellerApiService, FabricarOrder, FabricarItem, SalePayment } from '../../services/seller-api';
import { AuthService } from '../../services/auth';

const STATUS_LABELS: Record<string, string> = {
  PENDING:   'Ingreso',
  PRODUCING: 'Cortado',
  READY:     'Armado sin alistar',
  DELIVERED: 'Listo para enviar',
  COMPLETED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const STATUSES = ['PENDING', 'PRODUCING', 'READY', 'DELIVERED', 'COMPLETED'];

@Component({
  selector: 'app-pedidos',
  imports: [RouterLink],
  templateUrl: './pedidos.html',
})
export class Pedidos implements OnInit {
  @ViewChild('receiptEl') receiptEl!: ElementRef<HTMLDivElement>;

  private readonly api  = inject(SellerApiService);
  readonly auth         = inject(AuthService);

  protected orders      = signal<FabricarOrder[]>([]);
  protected loading     = signal(true);
  protected selectedId  = signal<string | null>(null);

  // Payment form
  protected paymentInput  = signal('');
  protected paymentNote   = signal('');
  protected savingPayment = signal(false);

  // Delivery form — Map<itemId, qty>
  protected deliveryQty   = signal<Map<string, number>>(new Map());
  protected savingDelivery = signal(false);

  // Status change
  protected updatingStatus = signal(false);

  // Receipt
  protected receiptOrder    = signal<FabricarOrder | null>(null);
  protected receiptEvent    = signal<'payment' | 'delivery' | null>(null);
  protected receiptPayment  = signal<SalePayment | null>(null);
  protected receiptPreview  = signal(false);
  protected capturingReceipt = signal(false);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statuses     = STATUSES;

  protected selected = computed(() =>
    this.orders().find(o => o.id === this.selectedId()) ?? null,
  );

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.api.getFabricarOrders().subscribe({
      next: list => { this.orders.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openOrder(order: FabricarOrder) {
    this.selectedId.set(order.id);
    const qty = new Map<string, number>();
    order.items.forEach(i => qty.set(i.id, i.deliveredQty));
    this.deliveryQty.set(qty);
    this.paymentInput.set('');
    this.paymentNote.set('');
  }

  closeOrder() {
    this.selectedId.set(null);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  totalPaid(order: FabricarOrder): number {
    return order.payments.reduce((s, p) => s + p.amount, 0);
  }

  pendingBalance(order: FabricarOrder): number {
    return Math.max(0, order.total - this.totalPaid(order));
  }

  totalDelivered(order: FabricarOrder): number {
    return order.items.reduce((s, i) => s + i.deliveredQty, 0);
  }

  totalUnits(order: FabricarOrder): number {
    return order.items.reduce((s, i) => s + i.quantity, 0);
  }

  isFullyDelivered(order: FabricarOrder): boolean {
    return order.items.every(i => i.deliveredQty >= i.quantity);
  }

  deliveryQtyFor(itemId: string): number {
    return this.deliveryQty().get(itemId) ?? 0;
  }

  setDeliveryQty(itemId: string, qty: number, max: number, min = 0) {
    const clamped = Math.max(min, Math.min(qty, max));
    this.deliveryQty.update(m => { const n = new Map(m); n.set(itemId, clamped); return n; });
    const order = this.selected();
    if (order && this.hasDeliveryChanges(order)) {
      const suggested = this.suggestedPayment(order);
      this.paymentInput.set(suggested > 0 ? suggested.toLocaleString('es-CO') : '');
    }
  }

  hasDeliveryChanges(order: FabricarOrder): boolean {
    return order.items.some(i => this.deliveryQtyFor(i.id) !== i.deliveredQty);
  }

  pickupValue(order: FabricarOrder): number {
    return order.items.reduce((s, i) =>
      s + Math.max(0, this.deliveryQtyFor(i.id) - i.deliveredQty) * i.price, 0);
  }

  remainingValue(order: FabricarOrder): number {
    return order.items.reduce((s, i) =>
      s + Math.max(0, i.quantity - this.deliveryQtyFor(i.id)) * i.price, 0);
  }

  suggestedPayment(order: FabricarOrder): number {
    const allWillBeDelivered = order.items.every(i => this.deliveryQtyFor(i.id) >= i.quantity);
    if (allWillBeDelivered) return this.pendingBalance(order);
    return Math.round(this.pickupValue(order) + 0.25 * this.remainingValue(order));
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  saveDelivery() {
    const order = this.selected();
    if (!order || this.savingDelivery()) return;
    const items = order.items.map(i => ({ itemId: i.id, deliveredQty: this.deliveryQtyFor(i.id) }));
    this.savingDelivery.set(true);
    this.api.updateDeliveredQty(order.id, items).subscribe({
      next: updated => {
        this.orders.update(list => list.map(o => o.id === updated.id ? updated : o));
        const qty = new Map<string, number>();
        updated.items.forEach(i => qty.set(i.id, i.deliveredQty));
        this.deliveryQty.set(qty);
        this.savingDelivery.set(false);
      },
      error: () => this.savingDelivery.set(false),
    });
  }

  savePayment() {
    const order = this.selected();
    const raw = this.paymentInput().replace(/\D/g, '');
    const amount = parseInt(raw, 10);
    if (!order || isNaN(amount) || amount <= 0 || this.savingPayment()) return;
    this.savingPayment.set(true);

    const doSavePayment = (currentOrder: FabricarOrder) => {
      this.api.addPayment(currentOrder.id, amount, this.paymentNote() || undefined).subscribe({
        next: payment => {
          this.orders.update(list => list.map(o =>
            o.id === currentOrder.id ? { ...o, payments: [...o.payments, payment] } : o,
          ));
          this.paymentInput.set('');
          this.paymentNote.set('');
          this.savingPayment.set(false);
          const updated = this.orders().find(o => o.id === currentOrder.id)!;
          this.showReceipt(updated, 'payment', payment);
        },
        error: () => this.savingPayment.set(false),
      });
    };

    // Si hay cambios de entrega pendientes, guardarlos primero
    if (this.hasDeliveryChanges(order)) {
      const items = order.items.map(i => ({ itemId: i.id, deliveredQty: this.deliveryQtyFor(i.id) }));
      this.api.updateDeliveredQty(order.id, items).subscribe({
        next: updatedOrder => {
          this.orders.update(list => list.map(o => o.id === updatedOrder.id ? updatedOrder : o));
          const qty = new Map<string, number>();
          updatedOrder.items.forEach(i => qty.set(i.id, i.deliveredQty));
          this.deliveryQty.set(qty);
          doSavePayment(updatedOrder);
        },
        error: () => this.savingPayment.set(false),
      });
    } else {
      doSavePayment(order);
    }
  }

  changeStatus(status: string) {
    const order = this.selected();
    if (!order || order.status === status || this.updatingStatus()) return;
    this.updatingStatus.set(true);
    this.api.updateFabricarStatus(order.id, status).subscribe({
      next: updated => {
        this.orders.update(list =>
          status === 'COMPLETED' || status === 'CANCELLED'
            ? list.filter(o => o.id !== updated.id)
            : list.map(o => o.id === updated.id ? updated : o),
        );
        this.updatingStatus.set(false);
        if (status === 'COMPLETED' || status === 'CANCELLED') this.selectedId.set(null);
      },
      error: () => this.updatingStatus.set(false),
    });
  }

  // ── Receipt ──────────────────────────────────────────────────────────────

  showReceipt(order: FabricarOrder, event: 'payment' | 'delivery', payment: SalePayment | null) {
    this.receiptOrder.set(order);
    this.receiptEvent.set(event);
    this.receiptPayment.set(payment);
    this.receiptPreview.set(true);
  }

  closeReceipt() {
    this.receiptPreview.set(false);
    this.receiptOrder.set(null);
    this.receiptEvent.set(null);
    this.receiptPayment.set(null);
  }

  async captureReceipt() {
    if (this.capturingReceipt()) return;
    this.capturingReceipt.set(true);
    try {
      const canvas = await html2canvas(this.receiptEl.nativeElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      const order = this.receiptOrder();
      link.download = `factura-${order?.orderNumber?.toString().padStart(4, '0') ?? ''}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      this.capturingReceipt.set(false);
    }
  }

  // ── Formatters ───────────────────────────────────────────────────────────

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  formatDateShort(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso));
  }

  onPaymentInput(raw: string) {
    const n = raw.replace(/\D/g, '');
    this.paymentInput.set(n ? parseInt(n, 10).toLocaleString('es-CO') : '');
  }

  statusClass(s: string) {
    if (s === 'PENDING')   return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (s === 'PRODUCING') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    if (s === 'READY')     return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    if (s === 'DELIVERED') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'COMPLETED') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (s === 'CANCELLED') return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    return '';
  }
}
