import { Component, inject, signal, computed, effect, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { BrandService } from '../../services/brand';
import html2canvas from 'html2canvas';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SellerApiService, Product, InventoryItem, FabricarOrder } from '../../services/seller-api';
import { AuthService } from '../../services/auth';

export interface CartItem {
  product: Product;
  size: string;
  quantity: number;
  note: string;
  adjusted?: boolean;
  bordado?: boolean;
  bordadoText?: string;
  priceOverride?: number;
}

function productSizes(p: Product): string[] {
  if (p.type === 'bottom') return p.bottomSizes.length ? p.bottomSizes : ['Único'];
  return p.topSizes.length ? p.topSizes : ['Único'];
}

@Component({
  selector: 'app-pos',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './pos.html',
})
export class Pos implements OnInit, OnDestroy {
  private readonly api  = inject(SellerApiService);
  readonly auth         = inject(AuthService);
  private readonly router = inject(Router);
  readonly brand        = inject(BrandService);

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
  protected savedOrderNumber = signal<number | null>(null);
  protected predictedOrderNumber = signal<number | null>(null);
  protected orderDate = signal(new Date());
  protected deliveryDate = signal<Date>(this.calcDeliveryDate(new Date()));

  protected selectedProduct = signal<Product | null>(null);
  protected selectedSize = signal('');
  protected selectedNote = signal('');
  protected tallaCompleta = signal(true);
  protected selectedPiezas = signal<'conjunto' | 'top' | 'bottom'>('conjunto');
  protected selectedPriceOverride = signal<number | null>(null);
  protected selectedTopSize = signal('');
  protected selectedBottomSize = signal('');
  protected selectedBordado = signal(false);
  protected selectedBordadoText = signal('');

  protected abonoEnabled = signal(false);
  protected abonoAmount = signal(0);
  protected canceladoEnabled = signal(false);
  protected paymentMethod = signal('');

  protected discountEnabled = signal(false);
  protected discountPanelOpen = signal(false);
  protected discountType = signal<'pct' | 'value'>('pct');
  protected discountValue = signal(0);
  protected discountedKeys = signal<Set<string>>(new Set());
  protected itemOverrides = signal<Map<string, { value: number; type: 'pct' | 'value' }>>(new Map());

  protected customerSearchState = signal<'idle' | 'searching' | 'found' | 'notfound'>('idle');

  // Modo edición de pedido existente
  protected posMode = signal<'new' | 'edit'>('new');
  protected orderSearch = signal('');
  protected orderSearchState = signal<'idle' | 'searching' | 'found' | 'notfound'>('idle');
  protected orderSearchResults = signal<FabricarOrder[]>([]);
  protected editingOrder = signal<FabricarOrder | null>(null);
  protected addingItems = signal(false);
  protected addItemsSuccess = signal(false);
  protected editAbonoAnswer = signal<'yes' | 'no' | null>(null);
  protected editAbonoAmount = signal(0);
  protected editingItemId = signal<string | null>(null);
  protected savingItem = signal(false);
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

  itemPrice(i: CartItem): number {
    const base = i.priceOverride ?? i.product.price;
    return base + (i.bordado ? 10000 : 0);
  }

  itemKey(i: CartItem): string { return `${i.product.id}|${i.size}`; }

  itemEffectivePrice(i: CartItem): number {
    const base = this.itemPrice(i);
    if (!this.discountEnabled() || !this.discountedKeys().has(this.itemKey(i))) return base;
    const override = this.itemOverrides().get(this.itemKey(i));
    const dType = override?.type ?? this.discountType();
    const dValue = override?.value ?? this.discountValue();
    if (dValue <= 0) return base;
    if (dType === 'value') return Math.max(0, base - dValue);
    return Math.max(0, Math.round(base * (1 - Math.min(dValue, 100) / 100)));
  }

  itemDiscountLabel(i: CartItem): string {
    if (!this.discountEnabled() || !this.discountedKeys().has(this.itemKey(i))) return '';
    const override = this.itemOverrides().get(this.itemKey(i));
    const dType = override?.type ?? this.discountType();
    const dValue = override?.value ?? this.discountValue();
    if (dValue <= 0) return '';
    return dType === 'pct' ? `${dValue}%` : this.formatPrice(dValue);
  }

  protected cartTotal = computed(() =>
    this.cart().reduce((s, i) => s + this.itemEffectivePrice(i) * i.quantity, 0)
  );

  protected abonoExceedsTotal = computed(() => this.abonoEnabled() && this.abonoAmount() > this.cartTotal());

  protected discountAmount = computed(() =>
    this.cart().reduce((s, i) => {
      const base = this.itemPrice(i) * i.quantity;
      const eff = this.itemEffectivePrice(i) * i.quantity;
      return s + (base - eff);
    }, 0)
  );

  protected allDiscounted = computed(() =>
    this.cart().length > 0 && this.cart().every(i => this.discountedKeys().has(this.itemKey(i)))
  );

  protected netTotal = computed(() => Math.max(0, this.cartTotal() - this.abonoAmount()));

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
    // Fallback local: si el API aún no está desplegado, usar el último número guardado
    const localLast = localStorage.getItem('lastOrderNumber');
    if (localLast) this.predictedOrderNumber.set(parseInt(localLast, 10) + 1);
    this.api.getNextOrderNumber().subscribe({
      next: ({ nextOrderNumber }) => this.predictedOrderNumber.set(nextOrderNumber),
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
    this.editingItemId.set(null);
    this.selectedProduct.set(p);
    const sizes = productSizes(p);
    this.selectedSize.set(sizes[0] ?? '');
    this.selectedNote.set('');
    this.tallaCompleta.set(true);
    this.selectedPiezas.set('conjunto');
    this.selectedPriceOverride.set(null);
    this.selectedTopSize.set('');
    this.selectedBottomSize.set('');
    this.selectedBordado.set(false);
    this.selectedBordadoText.set('');
  }

  openEditItem(item: { id: string; productId: string; productName: string; size: string; price: number; note: string | null }) {
    const product = this.products().find(p => p.id === item.productId);
    if (!product) return;

    this.editingItemId.set(item.id);
    this.selectedProduct.set(product);

    // Parsear nota y bordado
    const parts = (item.note ?? '').split(' | ');
    const bordadoPart = parts.find(p => p.startsWith('Bordado: '));
    const plainNote = parts.filter(p => !p.startsWith('Bordado: ')).join(' | ');
    this.selectedNote.set(plainNote);
    this.selectedBordado.set(!!bordadoPart);
    this.selectedBordadoText.set(bordadoPart ? bordadoPart.replace('Bordado: ', '') : '');

    // Parsear talla
    const size = item.size;
    if (size.startsWith('Blusa') || size.startsWith('Pantalón')) {
      this.tallaCompleta.set(false);
      if (size.includes(' / ')) {
        const [top, bottom] = size.split(' / ');
        this.selectedPiezas.set('conjunto');
        this.selectedTopSize.set(top.replace('Blusa ', ''));
        this.selectedBottomSize.set(bottom.replace('Pantalón ', ''));
        this.selectedPriceOverride.set(null);
      } else if (size.startsWith('Blusa')) {
        this.selectedPiezas.set('top');
        this.selectedTopSize.set(size.replace('Blusa ', ''));
        this.selectedBottomSize.set('');
        this.selectedPriceOverride.set(item.price);
      } else {
        this.selectedPiezas.set('bottom');
        this.selectedBottomSize.set(size.replace('Pantalón ', ''));
        this.selectedTopSize.set('');
        this.selectedPriceOverride.set(item.price);
      }
    } else {
      this.tallaCompleta.set(true);
      this.selectedSize.set(size);
      this.selectedPiezas.set('conjunto');
      this.selectedTopSize.set('');
      this.selectedBottomSize.set('');
      this.selectedPriceOverride.set(null);
    }
  }

  addToCart() {
    const p = this.selectedProduct();
    if (!p) return;
    let size: string;
    if (this.saleType() === 'FABRICAR' && !this.tallaCompleta()) {
      const piezas = this.selectedPiezas();
      const top = this.selectedTopSize().trim();
      const bottom = this.selectedBottomSize().trim();
      if (piezas === 'conjunto') {
        if (!top || !bottom) return;
        size = `Blusa ${top} / Pantalón ${bottom}`;
      } else if (piezas === 'top') {
        if (!top) return;
        size = `Blusa ${top}`;
      } else {
        if (!bottom) return;
        size = `Pantalón ${bottom}`;
      }
    } else {
      size = this.selectedSize();
      if (!size) return;
    }
    const note = this.selectedNote().trim();
    const bordado = this.selectedBordado();
    const bordadoText = bordado ? this.selectedBordadoText().trim() : '';
    const priceOverride = this.selectedPriceOverride();
    const fullNote = [note, bordadoText ? `Bordado: ${bordadoText}` : ''].filter(Boolean).join(' | ') || null;

    // Modo edición de ítem existente
    const editId = this.editingItemId();
    if (editId && this.posMode() === 'edit') {
      const order = this.editingOrder();
      if (!order || this.savingItem()) return;
      const price = priceOverride != null ? priceOverride : p.price + (bordado ? 10000 : 0);
      this.savingItem.set(true);
      this.selectedProduct.set(null);
      this.api.editSaleItem(order.id, editId, { size, note: fullNote, price }).subscribe({
        next: updated => {
          this.editingOrder.set(updated);
          this.editingItemId.set(null);
          this.savingItem.set(false);
        },
        error: () => this.savingItem.set(false),
      });
      return;
    }

    if (this.saleType() === 'STOCK' && this.stockFor(p.id, size) <= 0) return;
    const newItem: CartItem = { product: p, size, quantity: 1, note, bordado, bordadoText, ...(priceOverride != null ? { priceOverride } : {}) };
    this.cart.update(items => {
      const idx = items.findIndex(i => i.product.id === p.id && i.size === size && i.note === note && !!i.bordado === bordado);
      if (idx >= 0) {
        return items.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it);
      }
      return [...items, newItem];
    });
    if (this.discountEnabled()) {
      this.discountedKeys.update(keys => new Set([...keys, this.itemKey(newItem)]));
    }
    this.selectedProduct.set(null);
  }

  removeFromCart(idx: number) {
    const item = this.cart()[idx];
    if (item) {
      const key = this.itemKey(item);
      this.discountedKeys.update(keys => { const s = new Set(keys); s.delete(key); return s; });
      this.itemOverrides.update(m => { const nm = new Map(m); nm.delete(key); return nm; });
    }
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
      ? `Hola ${firstName}, aquí está tu recibo de ${this.brand.nombre} 🛍️`
      : 'Hola, aquí está tu recibo de ${this.brand.nombre} 🛍️';

    this.api.createSale({
      type: this.saleType(),
      customerName: this.customerName() || undefined,
      customerPhone: phone || undefined,
      paymentMethod: this.paymentMethod() || undefined,
      notes: [
        this.notes(),
        this.discountEnabled() && this.discountAmount() > 0
          ? `Descuento: ${this.discountType() === 'pct' ? this.discountValue() + '%' : '$' + this.discountValue().toLocaleString('es-CO')}`
          : '',
        this.canceladoEnabled() ? 'Cancelado' : '',
      ].filter(Boolean).join(' | ') || undefined,
      deliveryDate: this.saleType() === 'FABRICAR' ? this.deliveryDateInput() : undefined,
      initialPayment: this.abonoEnabled() && this.abonoAmount() > 0 ? Math.min(this.abonoAmount(), this.cartTotal()) : undefined,
      items: items.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        size: i.size,
        quantity: i.quantity,
        price: this.itemEffectivePrice(i),
        note: [i.note, i.bordadoText ? `Bordado: ${i.bordadoText}` : ''].filter(Boolean).join(' | ') || undefined,
      })),
    }).subscribe({
      next: async sale => {
        this.savedOrderNumber.set(sale.orderNumber);
        localStorage.setItem('lastOrderNumber', sale.orderNumber.toString());
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
        this.canceladoEnabled.set(false);
        this.paymentMethod.set('');
        this.discountEnabled.set(false);
        this.discountPanelOpen.set(false);
        this.discountValue.set(0);
        this.discountedKeys.set(new Set());
        this.itemOverrides.set(new Map());
        this.predictedOrderNumber.set(null);
        this.loadData();

        if (blob) {
          this.receiptBlob = blob;
          if (phone && wa.length >= 10) {
            this.receiptWaUrl.set(`https://web.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(waText)}`);
          }
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
    this.receiptWaUrl.set('');
    this.receiptBlob = null;
  }

  dismissSuccess() { this.savedSale.set(null); this.savedOrderNumber.set(null); }

  openCheckout() {
    this.showReceipt.set(true);
  }

  private async captureReceipt(): Promise<Blob | null> {
    const el = this.receiptEl?.nativeElement;
    if (!el) return null;
    this.generatingImage.set(true);
    // Primer rAF: deja que Angular pinte savedOrderNumber en el DOM antes de clonar.
    await new Promise<void>(r => requestAnimationFrame(() => r()));
    const clone = el.cloneNode(true) as HTMLElement;
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
      return await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
    } catch {
      return null;
    } finally {
      document.body.removeChild(clone);
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
        this.customerName.set('');
        this.customerSearchState.set('notfound');
      }
    });
  }

  priceOverrideInputValue(): string {
    const v = this.selectedPriceOverride();
    return v != null && v > 0 ? v.toLocaleString('es-CO') : '';
  }

  onPriceOverrideInput(raw: string) {
    const n = parseInt(raw.replace(/\D/g, ''), 10);
    this.selectedPriceOverride.set(isNaN(n) ? null : n);
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

  onDiscountInput(value: string) {
    let n = parseInt(value.replace(/\D/g, ''), 10);
    if (isNaN(n)) n = 0;
    if (this.discountType() === 'pct') n = Math.min(n, 100);
    this.discountValue.set(n);
  }

  discountInputValue(): string {
    const v = this.discountValue();
    return v > 0 ? v.toLocaleString('es-CO') : '';
  }

  toggleDiscount() {
    if (this.discountPanelOpen()) {
      this.discountPanelOpen.set(false);
    } else {
      this.discountPanelOpen.set(true);
      if (!this.discountEnabled()) {
        this.discountEnabled.set(true);
        this.discountedKeys.set(new Set(this.cart().map(i => this.itemKey(i))));
      }
    }
  }

  itemOverrideType(i: CartItem): 'pct' | 'value' {
    return this.itemOverrides().get(this.itemKey(i))?.type ?? this.discountType();
  }

  itemOverrideInputValue(i: CartItem): string {
    const v = this.itemOverrides().get(this.itemKey(i))?.value ?? 0;
    return v > 0 ? v.toLocaleString('es-CO') : '';
  }

  onItemOverrideInput(item: CartItem, raw: string) {
    const n = parseInt(raw.replace(/\D/g, ''), 10);
    const key = this.itemKey(item);
    const type = this.itemOverrides().get(key)?.type ?? this.discountType();
    this.itemOverrides.update(map => {
      const m = new Map(map);
      if (isNaN(n) || n === 0) {
        m.delete(key);
      } else {
        m.set(key, { value: n, type });
      }
      return m;
    });
  }

  toggleItemOverrideType(item: CartItem) {
    const key = this.itemKey(item);
    this.itemOverrides.update(map => {
      const m = new Map(map);
      const existing = m.get(key);
      const cur = existing?.type ?? this.discountType();
      m.set(key, { value: existing?.value ?? 0, type: cur === 'pct' ? 'value' : 'pct' });
      return m;
    });
  }

  toggleAllDiscounted(checked: boolean) {
    this.discountedKeys.set(checked ? new Set(this.cart().map(i => this.itemKey(i))) : new Set());
  }

  toggleItemDiscounted(item: CartItem) {
    const key = this.itemKey(item);
    this.discountedKeys.update(keys => {
      const s = new Set(keys);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
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

  setMode(mode: 'new' | 'edit') {
    this.posMode.set(mode);
    this.cart.set([]);
    this.editingOrder.set(null);
    this.orderSearch.set('');
    this.orderSearchState.set('idle');
    this.orderSearchResults.set([]);
    this.addItemsSuccess.set(false);
    this.editAbonoAnswer.set(null);
    this.editAbonoAmount.set(0);
    this.discountEnabled.set(false);
    this.discountPanelOpen.set(false);
    this.discountValue.set(0);
    this.discountedKeys.set(new Set());
    this.itemOverrides.set(new Map());
    if (mode === 'edit') this.saleType.set('FABRICAR');
  }

  onOrderSearch(value: string) {
    this.orderSearch.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const q = value.trim();
    if (q.length >= 2) {
      this.orderSearchState.set('searching');
      this.searchTimer = setTimeout(() => this.doSearchOrders(q), 400);
    } else {
      this.orderSearchState.set('idle');
      this.orderSearchResults.set([]);
    }
  }

  private doSearchOrders(q: string) {
    this.api.searchFabricarOrders(q).subscribe({
      next: orders => {
        this.orderSearchResults.set(orders);
        this.orderSearchState.set(orders.length > 0 ? 'found' : 'notfound');
      },
      error: () => this.orderSearchState.set('notfound'),
    });
  }

  selectOrderToEdit(order: FabricarOrder) {
    this.editingOrder.set(order);
    this.orderSearchResults.set([]);
    this.cart.set([]);
    this.addItemsSuccess.set(false);
    this.editAbonoAnswer.set(null);
    this.editAbonoAmount.set(0);
  }

  clearEditingOrder() {
    this.editingOrder.set(null);
    this.orderSearch.set('');
    this.orderSearchState.set('idle');
    this.orderSearchResults.set([]);
    this.cart.set([]);
    this.editAbonoAnswer.set(null);
    this.editAbonoAmount.set(0);
  }

  onEditAbonoInput(raw: string) {
    const n = parseInt(raw.replace(/\D/g, ''), 10);
    this.editAbonoAmount.set(isNaN(n) ? 0 : n);
  }

  editAbonoInputValue(): string {
    const v = this.editAbonoAmount();
    return v > 0 ? v.toLocaleString('es-CO') : '';
  }

  confirmAddItems() {
    const order = this.editingOrder();
    const items = this.cart();
    if (!order || !items.length || this.addingItems()) return;
    if (this.editAbonoAnswer() === null) return;
    const abono = this.editAbonoAnswer() === 'yes' ? this.editAbonoAmount() : 0;
    if (this.editAbonoAnswer() === 'yes' && abono < 10000) return;

    this.addingItems.set(true);
    this.api.addItemsToOrder(order.id, items.map(i => ({
      productId: i.product.id,
      productName: i.product.name,
      size: i.size,
      quantity: i.quantity,
      price: this.itemEffectivePrice(i),
      note: i.note || undefined,
    }))).subscribe({
      next: updated => {
        if (abono >= 10000) {
          this.api.addPayment(order.id, abono).subscribe({
            next: () => this.finishAddItems(updated, abono),
            error: () => this.finishAddItems(updated, abono),
          });
        } else {
          this.finishAddItems(updated, 0);
        }
      },
      error: () => this.addingItems.set(false),
    });
  }

  private async finishAddItems(updated: FabricarOrder, abono: number) {
    // Populate receipt signals so the receipt div renders the new items
    this.savedOrderNumber.set(updated.orderNumber);
    this.customerName.set(updated.customerName ?? '');
    this.customerPhone.set(updated.customerPhone ?? '');
    if (updated.deliveryDate) {
      const d = new Date(updated.deliveryDate);
      this.deliveryDate.set(d);
    }
    if (abono > 0) {
      this.abonoEnabled.set(true);
      this.abonoAmount.set(abono);
    }

    // Capture receipt while cart still has new items
    const blob = await this.captureReceipt();

    // Clear state
    this.editingOrder.set(updated);
    this.cart.set([]);
    this.addingItems.set(false);
    this.editAbonoAnswer.set(null);
    this.editAbonoAmount.set(0);
    this.abonoEnabled.set(false);
    this.abonoAmount.set(0);
    this.discountEnabled.set(false);
    this.discountPanelOpen.set(false);
    this.discountValue.set(0);
    this.discountedKeys.set(new Set());
    this.itemOverrides.set(new Map());
    this.addItemsSuccess.set(true);
    setTimeout(() => this.addItemsSuccess.set(false), 4000);

    if (blob) {
      this.receiptBlob = blob;
      const phone = updated.customerPhone ?? '';
      const digits = phone.replace(/\D/g, '');
      const wa = digits.startsWith('57') ? digits : `57${digits}`;
      const firstName = (updated.customerName ?? '').trim().split(' ')[0];
      const waText = firstName
        ? `Hola ${firstName}, aquí está el comprobante de los nuevos ítems agregados a tu pedido en ${this.brand.nombre} 🛍️`
        : `Hola, aquí está el comprobante de los nuevos ítems de tu pedido en ${this.brand.nombre} 🛍️`;
      if (phone && wa.length >= 10) {
        this.receiptWaUrl.set(`https://web.whatsapp.com/send?phone=${wa}&text=${encodeURIComponent(waText)}`);
      }
      this.receiptImageUrl.set(URL.createObjectURL(blob));
    }
  }

  editingOrderTotal = () => {
    const order = this.editingOrder();
    if (!order) return 0;
    return order.items.reduce((s, i) => s + i.price * i.quantity, 0);
  };

  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
