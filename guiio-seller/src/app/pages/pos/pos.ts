import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
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

  protected customerSearchState = signal<'idle' | 'searching' | 'found' | 'notfound'>('idle');
  protected registering = signal(false);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.cart().reduce((s, i) => s + i.product.price * i.quantity, 0)
  );

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

  sizesFor(p: Product): string[] { return productSizes(p); }

  openProduct(p: Product) {
    this.selectedProduct.set(p);
    const sizes = productSizes(p);
    this.selectedSize.set(sizes[0] ?? '');
    this.selectedNote.set('');
  }

  addToCart() {
    const p = this.selectedProduct();
    const size = this.selectedSize();
    if (!p || !size) return;
    if (this.saleType() === 'STOCK' && this.stockFor(p.id, size) <= 0) return;
    const note = this.selectedNote().trim();
    this.cart.update(items => {
      const idx = items.findIndex(i => i.product.id === p.id && i.size === size && i.note === note);
      if (idx >= 0) {
        return items.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it);
      }
      return [...items, { product: p, size, quantity: 1, note }];
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
    this.cart.update(items => items.map((it, i) => i === idx ? { ...it, quantity: qty } : it));
  }

  confirmSale() {
    const items = this.cart();
    if (!items.length) return;
    this.saving.set(true);
    this.api.createSale({
      type: this.saleType(),
      customerName: this.customerName() || undefined,
      customerPhone: this.customerPhone().trim() || undefined,
      notes: this.notes() || undefined,
      deliveryDate: this.saleType() === 'FABRICAR' ? this.deliveryDateInput() : undefined,
      items: items.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        size: i.size,
        quantity: i.quantity,
        price: i.product.price,
        note: i.note || undefined,
      })),
    }).subscribe({
      next: sale => {
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
        this.loadData();
      },
      error: () => this.saving.set(false),
    });
  }

  dismissSuccess() { this.savedSale.set(null); }

  ngOnDestroy() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
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
