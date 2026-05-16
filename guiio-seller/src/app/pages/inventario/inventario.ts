import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SellerApiService, Product } from '../../services/seller-api';
import { AuthService } from '../../services/auth';

function productSizes(p: Product): string[] {
  if (p.type === 'bottom') return p.bottomSizes.length ? p.bottomSizes : ['Único'];
  return p.topSizes.length ? p.topSizes : ['Único'];
}

@Component({
  selector: 'app-inventario',
  imports: [RouterLink],
  templateUrl: './inventario.html',
})
export class Inventario implements OnInit {
  private readonly api = inject(SellerApiService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected products = signal<Product[]>([]);
  protected loading = signal(true);
  protected saving = signal(false);
  protected saved = signal(false);
  protected search = signal('');
  protected selectedCollection = signal('all');

  protected qty = signal<Record<string, number>>({});
  protected dirty = signal(false);

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

  protected totalUnits = computed(() =>
    Object.values(this.qty()).reduce((s, v) => s + v, 0)
  );

  protected totalSKUs = computed(() =>
    Object.values(this.qty()).filter(v => v > 0).length
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

    this.api.getProducts().subscribe({
      next: list => { this.products.set(list); done(); },
      error: done,
    });

    this.api.getInventory(sedeId).subscribe({
      next: ({ items }) => {
        const map: Record<string, number> = {};
        for (const item of items) {
          map[`${item.productId}|${item.size}`] = item.quantity;
        }
        this.qty.set(map);
        done();
      },
      error: done,
    });
  }

  sizesFor(p: Product): string[] { return productSizes(p); }

  getQty(productId: string, size: string): number {
    return this.qty()[`${productId}|${size}`] ?? 0;
  }

  setQty(productId: string, size: string, value: string) {
    const n = parseInt(value, 10);
    const qty = isNaN(n) || n < 0 ? 0 : n;
    this.qty.update(q => ({ ...q, [`${productId}|${size}`]: qty }));
    this.dirty.set(true);
  }

  qtyClass(productId: string, size: string): string {
    const q = this.getQty(productId, size);
    if (q === 0) return 'text-red-400 border-red-900 bg-red-950/30';
    if (q <= 3) return 'text-yellow-400 border-yellow-900 bg-yellow-950/30';
    return 'text-green-400 border-green-900 bg-green-950/20';
  }

  productStock(p: Product): number {
    return this.sizesFor(p).reduce((s, size) => s + this.getQty(p.id, size), 0);
  }

  save() {
    const current = this.qty();
    const items = Object.entries(current).map(([key, quantity]) => {
      const [productId, size] = key.split('|');
      return { productId, size, quantity };
    });
    if (!items.length) return;
    this.saving.set(true);
    this.api.upsertInventory(items).subscribe({
      next: () => {
        this.saving.set(false);
        this.dirty.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 3000);
      },
      error: () => this.saving.set(false),
    });
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  logout() { this.auth.logout(); this.router.navigate(['/login']); }
}
