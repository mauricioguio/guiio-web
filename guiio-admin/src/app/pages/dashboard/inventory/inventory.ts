import { Component, inject, signal, computed } from '@angular/core';
import { SedesApiService, Sede } from '../../../services/sedes-api';
import { InventoryApiService, InventoryItem } from '../../../services/inventory-api';
import { ProductsApiService, Product } from '../../../services/products-api';

interface InventoryRow {
  productId: string;
  productName: string;
  size: string;
  quantities: Record<string, number>;
  total: number;
}

function productSizes(p: Product): string[] {
  if (p.type === 'bottom') return p.bottomSizes.length ? p.bottomSizes : ['Único'];
  return p.topSizes.length ? p.topSizes : ['Único'];
}

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.html',
})
export class Inventory {
  private readonly sedesApi = inject(SedesApiService);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly productsApi = inject(ProductsApiService);

  protected sedes = signal<Sede[]>([]);
  protected products = signal<Product[]>([]);
  protected inventoryItems = signal<InventoryItem[]>([]);
  protected loading = signal(true);

  protected search = signal('');
  protected selectedView = signal<string>('all');
  protected showSedesPanel = signal(false);
  protected sedeNameInput = signal('');
  protected editingSedeId = signal<string | null>(null);
  protected deletingSedeId = signal<string | null>(null);
  protected savingSede = signal(false);

  protected editingCell = signal<{ productId: string; size: string; sedeId: string } | null>(null);
  protected editValue = signal('');
  protected savingCell = signal(false);

  protected visibleSedes = computed(() => {
    const v = this.selectedView();
    return v === 'all' ? this.sedes() : this.sedes().filter(s => s.id === v);
  });

  protected rows = computed((): InventoryRow[] => {
    const q = this.search().toLowerCase();
    const result: InventoryRow[] = [];
    for (const p of this.products()) {
      if (q && !p.name.toLowerCase().includes(q)) continue;
      for (const size of productSizes(p)) {
        const quantities: Record<string, number> = {};
        for (const sede of this.sedes()) {
          const item = this.inventoryItems().find(
            i => i.productId === p.id && i.size === size && i.sedeId === sede.id,
          );
          quantities[sede.id] = item?.quantity ?? 0;
        }
        const total = Object.values(quantities).reduce((a, b) => a + b, 0);
        result.push({ productId: p.id, productName: p.name, size, quantities, total });
      }
    }
    return result;
  });

  protected totalUnits = computed(() =>
    this.rows().reduce((sum, r) => sum + r.total, 0),
  );

  constructor() {
    this.loadAll();
  }

  private loadAll() {
    this.loading.set(true);
    let pending = 3;
    const done = () => { if (--pending === 0) this.loading.set(false); };

    this.sedesApi.getAll().subscribe({ next: list => { this.sedes.set(list); done(); }, error: done });
    this.productsApi.getAll().subscribe({ next: list => { this.products.set(list); done(); }, error: done });
    this.inventoryApi.getAll().subscribe({ next: list => { this.inventoryItems.set(list); done(); }, error: done });
  }

  // ── Cell editing ──

  startEdit(productId: string, size: string, sedeId: string) {
    const row = this.rows().find(r => r.productId === productId && r.size === size);
    this.editValue.set((row?.quantities[sedeId] ?? 0).toString());
    this.editingCell.set({ productId, size, sedeId });
  }

  saveCell(productId: string, size: string, sedeId: string) {
    const quantity = Math.max(0, parseInt(this.editValue(), 10) || 0);
    const row = this.rows().find(r => r.productId === productId && r.size === size);
    if (quantity === (row?.quantities[sedeId] ?? 0)) {
      this.editingCell.set(null);
      return;
    }
    this.savingCell.set(true);
    this.inventoryApi.upsert(sedeId, productId, size, quantity).subscribe({
      next: item => {
        this.inventoryItems.update(items => {
          const idx = items.findIndex(
            i => i.productId === productId && i.size === size && i.sedeId === sedeId,
          );
          return idx >= 0
            ? items.map((it, i) => (i === idx ? item : it))
            : [...items, item];
        });
        this.savingCell.set(false);
        this.editingCell.set(null);
      },
      error: () => this.savingCell.set(false),
    });
  }

  isEditing(productId: string, size: string, sedeId: string): boolean {
    const c = this.editingCell();
    return !!c && c.productId === productId && c.size === size && c.sedeId === sedeId;
  }

  // ── Sedes CRUD ──

  openAddSede() {
    this.editingSedeId.set(null);
    this.sedeNameInput.set('');
  }

  openEditSede(sede: Sede) {
    this.editingSedeId.set(sede.id);
    this.sedeNameInput.set(sede.name);
  }

  saveSede() {
    const name = this.sedeNameInput().trim();
    if (!name) return;
    this.savingSede.set(true);
    const id = this.editingSedeId();
    const req = id
      ? this.sedesApi.update(id, { name })
      : this.sedesApi.create(name);
    req.subscribe({
      next: sede => {
        if (id) {
          this.sedes.update(list => list.map(s => s.id === id ? sede : s));
        } else {
          this.sedes.update(list => [...list, sede]);
        }
        this.savingSede.set(false);
        this.sedeNameInput.set('');
        this.editingSedeId.set(null);
      },
      error: () => this.savingSede.set(false),
    });
  }

  confirmDeleteSede(id: string) { this.deletingSedeId.set(id); }
  cancelDeleteSede() { this.deletingSedeId.set(null); }

  doDeleteSede(id: string) {
    this.sedesApi.remove(id).subscribe({
      next: () => {
        this.sedes.update(list => list.filter(s => s.id !== id));
        this.inventoryItems.update(items => items.filter(i => i.sedeId !== id));
        this.deletingSedeId.set(null);
        if (this.selectedView() === id) this.selectedView.set('all');
      },
    });
  }
}
