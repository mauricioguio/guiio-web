import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import html2canvas from 'html2canvas';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SellerApiService, Product, InventoryItem } from '../../services/seller-api';
import { AuthService } from '../../services/auth';

export interface CartItem {
  product: Product;
  size: string;
  quantity: number;
  note: string;
  adjusted?: boolean;
  bordado?: boolean;
  bordadoText?: string;
}

function productSizes(p: Product): string[] {
  if (p.type === 'bottom') return p.bottomSizes.length ? p.bottomSizes : ['Único'];
  return p.topSizes.length ? p.topSizes : ['Único'];
}

@Component({
  selector: 'app-pos',
  imports: [RouterLink],
  templateUrl: './pos.html',
})
export class Pos implements OnInit, OnDestroy {
  private readonly api = inject(SellerApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected products = signal<Product[]>([]);
  protected inventory = signal<InventoryItem[]>([]);
  protected loading = signal(true);
  protected search = signal('');
  protected selectedCollection = signal('all');

  protected cart = signal<CartItem[]>([]);
  protected showReceipt = signal(false);
  protected saleType = signal<'STOCK' | 'FABRICAR'>('STOCK');
  protected customerName = signal('');
  protected customerPhone = signal('');
  protected notes = signal('');
  protected saving = signal(false);
  protected savedSale = signal<string | null>(null);
  protected orderDate = signal(new Date());
  protected deliveryDate = signal<Date>(this.calcDeliveryDate(new Date()));

  protected selectedProduct = signal<Product | null>(null);
  protected selectedSize = signal('');
  protected selectedNote = signal('');
  protected tallaCompleta = signal(true);
  protected selectedTopSize = signal('');
  protected selectedBottomSize = signal('');
  protected selectedBordado = signal(false);
  protected selectedBordadoText = signal('');

  protected abonoEnabled = signal(false);
  protected abonoAmount = signal(0);
  protected netTotal = computed(() => Math.max(0, this.cartTotal() - this.abonoAmount()));

  protected customerSearchState = signal<'idle' | 'searching' | 'found' | 'notfound'>('idle');
  protected registering = signal(false);
  protected adjustedItems = signal(0);
  protected receiptPreview = signal(false);
  protected generatingImage = signal(false);
  protected clipboardCopied = signal(false);
  protected receiptImageUrl = signal<string | null>(null);
  protected receiptWaUrl = signal('');
  private receiptBlob: Blob | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private adjustToast: ReturnType<typeof setTimeout> | null = null;

  @ViewChild('receiptEl') receiptEl!: ElementRef<HTMLDivElement>;

  protected collections = computed(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of this.products()) {
      if (p.collection && !seen.has(p.collection)) { seen.add(p.collection); result.push(p.collection); }
    }
    return result.sort();
  });

  protected filtered = computed(() => {
    const col = this.selectedCollection();
    const q = this.search().toLowerCase();
    return this.products().filter(p => {
      if (col !== 'all' && p.collection !== col) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  protected cartTotal = computed(() =>
    this.cart().reduce((s, i) => s + this.itemPrice(i) * i.quantity, 0)
  );

  itemPrice(i: CartItem): number {
    return i.product.price + (i.bordado ? 10000 : 0);
  }

  protected cartCount = computed(() =>
    this.cart().reduce((s, i) => s + i.quantity, 0)
  );

  ngOnInit() {
    if (!this.auth.isLoggedIn()) { this.router.navigate(['/login']); return; }
    this.loadData();
  }

  private loadData() {
    const sedeId = this.auth.currentSede()!.sedeId;
    this.loading.set(true);
    let pending = 2;
    const done = () => { if (--pending === 0) this.loading.set(false); };
    this.api.getProducts().subscribe({ next: list => { this.products.set(list); done(); }, error: done });
    this.api.getInventory(sedeId).subscribe({
      next: ({ items }) => { this.inventory.set(items); done(); },
      error: done,
    });
  }

  private calcDeliveryDate(from: Date): Date {
    const d = new Date(from);
    d.setDate(d.getDate() + 8);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1); // domingo → lunes
    return d;
  }

  setSaleType(type: 'STOCK' | 'FABRICAR') {
    this.saleType.set(type);
    if (type === 'FABRICAR') {
      this.deliveryDate.set(this.calcDeliveryDate(new Date()));
    } else {
      this.adjustCartToStock();
    }
  }

  private adjustCartToStock() {
    let adjusted = 0;
    const newCart = this.cart()
      .map((item, idx) => {
        const inv = this.inventory().find(i => i.productId === item.product.id && i.size === item.size)?.quantity ?? 0;
        const otherLines = this.cart()
          .filter((it, i) => i !== idx && it.product.id === item.product.id && it.size === item.size)
          .reduce((s, it) => s + it.quantity, 0);
        const max = Math.max(0, inv - otherLines);
        if (item.quantity > max) { adjusted++; return { ...item, quantity: max, adjusted: true }; }
        return { ...item, adjusted: false };
      })
      .filter(item => item.quantity > 0);

    if (adjusted > 0) {
      this.cart.set(newCart);
      this.adjustedItems.set(adjusted);
      if (this.adjustToast) clearTimeout(this.adjustToast);
      this.adjustToast = setTimeout(() => {
        this.adjustedItems.set(0);
        this.cart.update(items => items.map(it => ({ ...it, adjusted: false })));
      }, 5000);
    }
  }

  setDeliveryDate(value: string) {
    if (!value) return;
    const [y, m, d] = value.split('-').map(Number);
    this.deliveryDate.set(new Date(y, m - 1, d));
  }

  deliveryDateInput(): string {
    const d = this.deliveryDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  stockFor(productId: string, size: string): number {
    if (this.saleType() === 'FABRICAR') return Infinity;
    const inv = this.inventory().find(i => i.productId === productId && i.size === size)?.quantity ?? 0;
    const inCart = this.cart().filter(i => i.product.id === productId && i.size === size).reduce((s, i) => s + i.quantity, 0);
    return Math.max(0, inv - inCart);
  }

  rawStockFor(productId: string, size: string): number {
    return this.inventory().find(i => i.productId === productId && i.size === size)?.quantity ?? 0;
  }

  sizesFor(p: Product): string[] { return productSizes(p); }

  openProduct(p: Product) {
    this.selectedProduct.set(p);
    const sizes = productSizes(p);
    this.selectedSize.set(sizes[0] ?? '');
    this.selectedNote.set('');
    this.tallaCompleta.set(true);
    this.selectedTopSize.set('');
    this.selectedBottomSize.set('');
    this.selectedBordado.set(false);
    this.selectedBordadoText.set('');
  }

  addToCart() {
    const p = this.selectedProduct();
    if (!p) return;
    let size: string;
    if (this.saleType() === 'FABRICAR' && !this.tallaCompleta()) {
      const top = this.selectedTopSize().trim();
      const bottom = this.selectedBottomSize().trim();
      if (!top || !bottom) return;
      size = `Blusa ${top} / Pantalón ${bottom}`;
    } else {
      size = this.selectedSize();
      if (!size) return;
    }
    if (this.saleType() === 'STOCK' && this.stockFor(p.id, size) <= 0) return;
    const note = this.selectedNote().trim();
    const bordado = this.selectedBordado();
    const bordadoText = bordado ? this.selectedBordadoText().trim() : '';
    this.cart.update(items => {
      const idx = items.findIndex(i => i.product.id === p.id && i.size === size && i.note === note && !!i.bordado === bordado);
      if (idx >= 0) {
        return items.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it);
      }
      return [...items, { product: p, size, quantity: 1, note, bordado, bordadoText }];
    });
    this.selectedProduct.set(null);
  }

  removeFromCart(idx: number) {
    this.cart.update(items => items.filter((_, i) => i !== idx));
  }

  updateQty(idx: number, qty: number) {
    if (qty <= 0) { this.removeFromCart(idx); return; }
    if (this.saleType() === 'STOCK') {
      const item = this.cart()[idx];
      const inv = this.inventory().find(i => i.productId === item.product.id && i.size === item.size)?.quantity ?? 0;
      const otherLines = this.cart().filter((it, i) => i !== idx && it.product.id === item.product.id && it.size === item.size).reduce((s, it) => s + it.quantity, 0);
      qty = Math.min(qty, inv - otherLines);
      if (qty <= 0) { this.removeFromCart(idx); return; }
    }
    this.cart.update(items => items.map((it, i) => i === idx ? { ...it, quantity: qty, adjusted: false } : it));
  }

  confirmSale() {
    const items = this.cart();
    if (!items.length) return;
    if (!this.customerPhone().trim() || !this.customerName().trim()) return;
    this.saving.set(true);

    const phone = this.customerPhone().trim();
    const digits = phone.replace(/\D/g, '');
    const wa = digits.startsWith('57') ? digits : `57${digits}`;
    const firstName = this.customerName().trim().split(' ')[0];
    const waText = firstName
      ? `Hola ${firstName}, aquí está tu recibo de Guiio 🛍️`
      : 'Hola, aquí está tu recibo de Guiio 🛍️';

    this.api.createSale({
      type: this.saleType(),
      customerName: this.customerName() || undefined,
      customerPhone: phone || undefined,
      notes: [this.notes(), this.abonoEnabled() && this.abonoAmount() > 0 ? `Abono: $${this.abonoAmount().toLocaleString('es-CO')}` : ''].filter(Boolean).join(' | ') || undefined,
      deliveryDate: this.saleType() === 'FABRICAR' ? this.deliveryDateInput() : undefined,
      items: items.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        size: i.size,
        quantity: i.quantity,
        price: this.itemPrice(i),
        note: [i.note, i.bordadoText ? `Bordado: ${i.bordadoText}` : ''].filter(Boolean).join(' | ') || undefined,
      })),
    }).subscribe({
      next: async sale => {
        const blob = await this.captureReceipt();

        this.savedSale.set(sale.id);
        this.cart.set([]);
        this.customerName.set('');
        this.customerPhone.set('');
        this.notes.set('');
        this.customerSearchState.set('idle');
        this.showReceipt.set(false);
        this.saving.set(false);
        this.orderDate.set(new Date());
        this.deliveryDate.set(this.calcDeliveryDate(new Date()));
        this.abonoEnabled.set(false);
        this.abonoAmount.set(0);
        this.loadData();

        if (blob && phone) {
          this.receiptBlob = blob;
          this.receiptWaUrl.set(`https://web.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(waText)}`);
          this.receiptImageUrl.set(URL.createObjectURL(blob));
        }
      },
      error: () => this.saving.set(false),
    });
  }

  async copyAndOpenWhatsApp() {
    const blob = this.receiptBlob;
    const waUrl = this.receiptWaUrl();
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.clipboardCopied.set(true);
      setTimeout(() => this.clipboardCopied.set(false), 6000);
    } catch {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'recibo-guiio.png'; a.click();
      URL.revokeObjectURL(url);
    }
    if (waUrl) window.open(waUrl, '_blank');
    this.closeReceiptOverlay();
  }

  closeReceiptOverlay() {
    if (this.receiptImageUrl()) URL.revokeObjectURL(this.receiptImageUrl()!);
    this.receiptImageUrl.set(null);
    this.receiptBlob = null;
  }

  dismissSuccess() { this.savedSale.set(null); }

  private async captureReceipt(): Promise<Blob | null> {
    const el = this.receiptEl?.nativeElement;
    if (!el) return null;
    this.generatingImage.set(true);
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: null });
      return await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
    } catch {
      return null;
    } finally {
      this.generatingImage.set(false);
    }
  }


  ngOnDestroy() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.adjustToast) clearTimeout(this.adjustToast);
  }

  onPhoneInput(value: string) {
    this.customerPhone.set(value);
    this.customerSearchState.set('idle');
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const trimmed = value.trim();
    if (trimmed.length >= 7) {
      this.customerSearchState.set('searching');
      this.searchTimer = setTimeout(() => this.lookupCustomer(trimmed), 400);
    }
  }

  private lookupCustomer(phone: string) {
    this.api.findCustomer(phone).pipe(catchError(() => of(null))).subscribe(customer => {
      if (customer) {
        this.customerName.set(customer.name);
        this.customerSearchState.set('found');
      } else {
        this.customerSearchState.set('notfound');
      }
    });
  }

  registerCustomer() {
    const phone = this.customerPhone().trim();
    const name = this.customerName().trim();
    if (!phone || !name) return;
    this.registering.set(true);
    this.api.createCustomer(phone, name).subscribe({
      next: () => { this.customerSearchState.set('found'); this.registering.set(false); },
      error: () => this.registering.set(false),
    });
  }

  onAbonoInput(value: string) {
    const n = parseInt(value.replace(/\D/g, ''), 10);
    this.abonoAmount.set(isNaN(n) ? 0 : n);
  }

  abonoInputValue(): string {
    const v = this.abonoAmount();
    return v > 0 ? v.toLocaleString('es-CO') : '';
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatDate(d: Date) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  }

  formatDateShort(d: Date) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(d);
  }

  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
