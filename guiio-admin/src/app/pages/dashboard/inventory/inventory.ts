import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface InventoryProduct {
  id: string;
  name: string;
  collection: string;
  color: string;
  topSize: string;
  bottomSize: string;
  stock: number;
  price: number;
  lowStockThreshold: number;
}

const STORAGE_KEY = 'guiio-inventory';

const INITIAL: InventoryProduct[] = [
  { id: '1', name: 'Conjunto Scrub Clásico', collection: 'Clásica', color: 'Azul rey', topSize: 'S', bottomSize: '28', stock: 5, price: 89000, lowStockThreshold: 3 },
  { id: '2', name: 'Conjunto Scrub Clásico', collection: 'Clásica', color: 'Azul rey', topSize: 'M', bottomSize: '30', stock: 8, price: 89000, lowStockThreshold: 3 },
  { id: '3', name: 'Conjunto Scrub Clásico', collection: 'Clásica', color: 'Verde quirófano', topSize: 'M', bottomSize: '30', stock: 2, price: 89000, lowStockThreshold: 3 },
  { id: '4', name: 'Conjunto Scrub Premium', collection: 'Premium', color: 'Negro', topSize: 'L', bottomSize: '32', stock: 0, price: 119000, lowStockThreshold: 2 },
  { id: '5', name: 'Conjunto Scrub Premium', collection: 'Premium', color: 'Gris', topSize: 'XL', bottomSize: '34', stock: 4, price: 119000, lowStockThreshold: 2 },
];

const EMPTY_FORM = (): Omit<InventoryProduct, 'id'> => ({
  name: '', collection: '', color: '',
  topSize: '', bottomSize: '',
  stock: 0, price: 0, lowStockThreshold: 2,
});

@Component({
  selector: 'app-inventory',
  imports: [FormsModule],
  templateUrl: './inventory.html',
})
export class Inventory {
  protected search = signal('');
  protected showForm = signal(false);
  protected editingId = signal<string | null>(null);
  protected deletingId = signal<string | null>(null);
  protected formData = signal(EMPTY_FORM());

  protected products = signal<InventoryProduct[]>(this.load());

  private load(): InventoryProduct[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : INITIAL;
    } catch {
      return INITIAL;
    }
  }

  private save(products: InventoryProduct[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    this.products.set(products);
  }

  protected filtered = computed(() => {
    const q = this.search().toLowerCase();
    if (!q) return this.products();
    return this.products().filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.color.toLowerCase().includes(q) ||
      p.collection.toLowerCase().includes(q) ||
      p.topSize.toLowerCase().includes(q) ||
      p.bottomSize.toLowerCase().includes(q)
    );
  });

  protected lowStock = computed(() =>
    this.products().filter(p => p.stock > 0 && p.stock <= p.lowStockThreshold).length
  );

  protected outOfStock = computed(() =>
    this.products().filter(p => p.stock === 0).length
  );

  openCreate() {
    this.editingId.set(null);
    this.formData.set(EMPTY_FORM());
    this.showForm.set(true);
  }

  openEdit(product: InventoryProduct) {
    this.editingId.set(product.id);
    this.formData.set({ ...product });
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  saveForm() {
    const data = this.formData();
    if (!data.name || !data.color || !data.topSize) return;
    const id = this.editingId();
    if (id) {
      this.save(this.products().map(p => p.id === id ? { id, ...data } : p));
    } else {
      this.save([...this.products(), { id: Date.now().toString(), ...data }]);
    }
    this.closeForm();
  }

  confirmDelete(id: string) {
    this.deletingId.set(id);
  }

  cancelDelete() {
    this.deletingId.set(null);
  }

  doDelete(id: string) {
    this.save(this.products().filter(p => p.id !== id));
    this.deletingId.set(null);
  }

  stockStatus(p: InventoryProduct): 'out' | 'low' | 'ok' {
    if (p.stock === 0) return 'out';
    if (p.stock <= p.lowStockThreshold) return 'low';
    return 'ok';
  }

  formatPrice(value: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(value);
  }

  patchForm(patch: Partial<Omit<InventoryProduct, 'id'>>) {
    this.formData.update(f => ({ ...f, ...patch }));
  }
}
