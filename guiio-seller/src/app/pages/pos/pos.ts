import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SellerApiService, Product, InventoryItem } from '../../services/seller-api';
import { AuthService } from '../../services/auth';

export interface CartItem {
  product: Product;
  size: string;
  quantity: number;
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
export class Pos implements OnInit {
  private readonly api = inject(SellerApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected products = signal<Product[]>([]);
  protected inventory = signal<InventoryItem[]>([]);
  protected loading = signal(true);
  protected search = signal('');
  protected selectedCollection = signal('all');

  protected cart = signal<CartItem[]>([]);
  protected showCart = signal(false);
  protected saleType = signal<'STOCK' | 'FABRICAR'>('STOCK');
  protected customerName = signal('');
  protected notes = signal('');
  protected saving = signal(false);
  protected savedSale = signal<string | null>(null);

  protected selectedProduct = signal<Product | null>(null);
  protected selectedSize = signal('');

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

  stockFor(productId: string, size: string): number {
    if (this.saleType() === 'FABRICAR') return Infinity;
    const sedeId = this.auth.currentSede()!.sedeId;
    const item = this.inventory().find(
      i => i.productId === productId && i.size === size
    );
    return item?.quantity ?? 0;
  }

  sizesFor(p: Product): string[] { return productSizes(p); }

  openProduct(p: Product) {
    this.selectedProduct.set(p);
    const sizes = productSizes(p);
    this.selectedSize.set(sizes[0] ?? '');
  }

  addToCart() {
    const p = this.selectedProduct();
    const size = this.selectedSize();
    if (!p || !size) return;
    this.cart.update(items => {
      const idx = items.findIndex(i => i.product.id === p.id && i.size === size);
      if (idx >= 0) {
        return items.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it);
      }
      return [...items, { product: p, size, quantity: 1 }];
    });
    this.selectedProduct.set(null);
    this.showCart.set(true);
  }

  removeFromCart(idx: number) {
    this.cart.update(items => items.filter((_, i) => i !== idx));
  }

  updateQty(idx: number, qty: number) {
    if (qty <= 0) { this.removeFromCart(idx); return; }
    this.cart.update(items => items.map((it, i) => i === idx ? { ...it, quantity: qty } : it));
  }

  confirmSale() {
    const items = this.cart();
    if (!items.length) return;
    this.saving.set(true);
    this.api.createSale({
      type: this.saleType(),
      customerName: this.customerName() || undefined,
      notes: this.notes() || undefined,
      items: items.map(i => ({
        productId: i.product.id,
        productName: i.product.name,
        size: i.size,
        quantity: i.quantity,
        price: i.product.price,
      })),
    }).subscribe({
      next: sale => {
        this.savedSale.set(sale.id);
        this.cart.set([]);
        this.customerName.set('');
        this.notes.set('');
        this.showCart.set(false);
        this.saving.set(false);
        this.loadData();
      },
      error: () => this.saving.set(false),
    });
  }

  dismissSuccess() { this.savedSale.set(null); }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
