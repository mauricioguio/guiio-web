import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import html2canvas from 'html2canvas';
import { SellerApiService, FabricarOrder, FabricarItem, SalePayment } from '../../services/seller-api';
import { AuthService } from '../../services/auth';
import { BrandService } from '../../services/brand';

const STATUS_LABELS: Record<string, string> = {
  PENDING:   'Ingreso',
  PRODUCING: 'Cortado',
  READY:     'Armado sin alistar',
  IN_STORE:  'En tienda',
  DELIVERED: 'Listo para enviar',
  COMPLETED: 'Entregado',
  CANCELLED: 'Cancelado',
};

const STATUSES = ['PENDING', 'PRODUCING', 'READY', 'IN_STORE', 'DELIVERED', 'COMPLETED'];

@Component({
  selector: 'app-pedidos',
  imports: [RouterLink],
  templateUrl: './pedidos.html',
})
export class Pedidos implements OnInit {
  @ViewChild('receiptEl') receiptEl!: ElementRef<HTMLDivElement>;

  private readonly api  = inject(SellerApiService);
  readonly auth         = inject(AuthService);
  readonly brand        = inject(BrandService);

  protected orders      = signal<FabricarOrder[]>([]);
  protected loading     = signal(true);
  protected selectedId  = signal<string | null>(null);

  // Payment form
  protected paymentInput  = signal('');
  protected paymentNote   = signal('');
  protected savingPayment = signal(false);

  protected paymentExceedsBalance = computed(() => {
    const order = this.selected();
    if (!order || !this.paymentInput()) return false;
    const amount = parseInt(this.paymentInput().replace(/\D/g, ''), 10);
    return !isNaN(amount) && amount > this.pendingBalance(order);
  });

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
  protected clipboardCopied  = signal(false);
  private receiptBlob: Blob | null = null;

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
    // Valor de lo que se lleva ahora + 25% de depósito sobre lo que queda pendiente.
    // Se usa pendingBalance como techo (no se puede sugerir más de lo que se debe).
    const raw = this.pickupValue(order) + 0.25 * this.remainingValue(order);
    return Math.max(0, Math.min(Math.round(raw), this.pendingBalance(order)));
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
        if (this.pendingBalance(updated) === 0) this.showReceipt(updated, 'delivery', null);
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

  private async captureToCanvas(): Promise<HTMLCanvasElement> {
    const source = this.receiptEl.nativeElement as HTMLElement;
    const clone = source.cloneNode(true) as HTMLElement;
    clone.style.cssText = 'position:absolute;left:0;top:0;width:360px;font-family:sans-serif;z-index:-1;';
    document.body.appendChild(clone);
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    try {
      const scale = 2;
      const canvas = await html2canvas(clone, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
      });
      return canvas;
    } finally {
      document.body.removeChild(clone);
    }
  }

  showCurrentReceipt(order: FabricarOrder) {
    const lastPayment = order.payments.length > 0 ? order.payments[order.payments.length - 1] : null;
    const event = lastPayment ? 'payment' : 'delivery';
    this.showReceipt(order, event, lastPayment);
  }

  async captureReceipt() {
    if (this.capturingReceipt()) return;
    this.capturingReceipt.set(true);
    try {
      const canvas = await this.captureToCanvas();
      const order = this.receiptOrder();
      const link = document.createElement('a');
      link.download = `factura-${order?.orderNumber?.toString().padStart(4, '0') ?? ''}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      this.capturingReceipt.set(false);
    }
  }

  async copyAndOpenWhatsApp() {
    if (this.capturingReceipt()) return;
    this.capturingReceipt.set(true);
    try {
      const canvas = await this.captureToCanvas();
      this.receiptBlob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (this.receiptBlob) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': this.receiptBlob })]);
          this.clipboardCopied.set(true);
          setTimeout(() => this.clipboardCopied.set(false), 6000);
        } catch {
          const url = URL.createObjectURL(this.receiptBlob);
          const a = document.createElement('a');
          const order = this.receiptOrder();
          a.href = url; a.download = `factura-${order?.orderNumber?.toString().padStart(4, '0') ?? ''}.png`; a.click();
          URL.revokeObjectURL(url);
        }
      }
      const phone = this.receiptOrder()?.customerPhone ?? '';
      const digits = phone.replace(/\D/g, '');
      const wa = digits.startsWith('57') ? digits : `57${digits}`;
      const firstName = this.receiptOrder()?.customerName?.split(' ')[0] ?? '';
      const text = firstName ? `Hola ${firstName}, aquí está tu comprobante de ${this.brand.nombre} 🛍️` : 'Hola, aquí está tu comprobante de ${this.brand.nombre} 🛍️';
      if (wa.length >= 10) window.open(`https://web.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(text)}`, '_blank');
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
    if (!n) { this.paymentInput.set(''); return; }
    this.paymentInput.set(parseInt(n, 10).toLocaleString('es-CO'));
  }

  statusClass(s: string) {
    if (s === 'PENDING')   return 'bg-red-500/10 text-red-400 border-red-500/20';
    if (s === 'PRODUCING') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    if (s === 'READY')     return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    if (s === 'IN_STORE')  return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
    if (s === 'DELIVERED') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'COMPLETED') return 'bg-green-500/10 text-green-400 border-green-500/20';
    if (s === 'CANCELLED') return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    return '';
  }
}
