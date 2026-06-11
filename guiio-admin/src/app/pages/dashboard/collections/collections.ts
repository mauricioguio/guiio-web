import { Component, inject, signal, computed } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CollectionsApiService, Collection, CollectionPayload } from '../../../services/collections-api';
import { ProductsApiService, Product } from '../../../services/products-api';
import { CloudinaryService } from '../../../services/cloudinary';

interface Draft {
  name: string;
  description: string;
  image: string;
  featured: boolean;
  order: number;
}

const emptyDraft = (): Draft => ({
  name: '', description: '', image: '', featured: false, order: 0,
});

@Component({
  selector: 'app-collections',
  templateUrl: './collections.html',
})
export class Collections {
  private readonly api = inject(CollectionsApiService);
  private readonly productsApi = inject(ProductsApiService);
  private readonly cloudinary = inject(CloudinaryService);

  protected collections = signal<Collection[]>([]);
  protected allProducts = signal<Product[]>([]);
  protected collectionProducts = signal<Product[]>([]);
  protected loading = signal(true);
  protected saving = signal(false);
  protected uploading = signal(false);
  protected showForm = signal(false);
  protected editingId = signal<string | null>(null);
  protected deletingId = signal<string | null>(null);
  protected draft = signal<Draft>(emptyDraft());
  protected productSearch = signal('');
  protected assigningId = signal<string | null>(null);
  protected selectedProductIds = signal<Set<string>>(new Set());
  protected addingBatch = signal(false);

  protected otherProducts = computed(() => {
    const inCollection = new Set(this.collectionProducts().map(p => p.id));
    const q = this.productSearch().toLowerCase();
    return this.allProducts().filter(p => {
      if (inCollection.has(p.id)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  protected allOtherSelected = computed(() => {
    const others = this.otherProducts();
    if (others.length === 0) return false;
    const sel = this.selectedProductIds();
    return others.every(p => sel.has(p.id));
  });

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getAll().subscribe({
      next: list => { this.collections.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.productsApi.getAll().subscribe({
      next: list => this.allProducts.set(list),
    });
  }

  private loadCollectionProducts(id: string) {
    this.api.getProducts(id).subscribe({
      next: list => this.collectionProducts.set(list),
    });
  }

  assignProduct(product: Product) {
    const id = this.editingId();
    if (!id) return;
    this.assigningId.set(product.id);
    this.api.addProduct(id, product.id).subscribe({
      next: () => {
        this.collectionProducts.update(list => [...list, product]);
        this.assigningId.set(null);
      },
      error: () => this.assigningId.set(null),
    });
  }

  removeFromCollection(product: Product) {
    const id = this.editingId();
    if (!id) return;
    this.assigningId.set(product.id);
    this.api.removeProduct(id, product.id).subscribe({
      next: () => {
        this.collectionProducts.update(list => list.filter(p => p.id !== product.id));
        this.assigningId.set(null);
      },
      error: () => this.assigningId.set(null),
    });
  }

  toggleProductSelection(id: string) {
    this.selectedProductIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  toggleSelectAll() {
    if (this.allOtherSelected()) {
      this.selectedProductIds.set(new Set());
    } else {
      this.selectedProductIds.set(new Set(this.otherProducts().map(p => p.id)));
    }
  }

  addSelected() {
    const id = this.editingId();
    if (!id) return;
    const selected = this.selectedProductIds();
    const toAdd = this.otherProducts().filter(p => selected.has(p.id));
    if (toAdd.length === 0) return;
    this.addingBatch.set(true);
    forkJoin(toAdd.map(p => this.api.addProduct(id, p.id))).subscribe({
      next: () => {
        this.collectionProducts.update(list => [...list, ...toAdd]);
        this.selectedProductIds.set(new Set());
        this.addingBatch.set(false);
      },
      error: () => this.addingBatch.set(false),
    });
  }

  openCreate() {
    this.editingId.set(null);
    this.draft.set(emptyDraft());
    this.collectionProducts.set([]);
    this.selectedProductIds.set(new Set());
    this.showForm.set(true);
  }

  openEdit(c: Collection) {
    this.editingId.set(c.id);
    this.draft.set({
      name: c.name,
      description: c.description ?? '',
      image: c.image ?? '',
      featured: c.featured,
      order: c.order,
    });
    this.collectionProducts.set([]);
    this.selectedProductIds.set(new Set());
    this.loadCollectionProducts(c.id);
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingId.set(null);
    this.selectedProductIds.set(new Set());
  }

  patch(p: Partial<Draft>) {
    this.draft.update(d => ({ ...d, ...p }));
  }

  uploadImage(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.cloudinary.upload(file).subscribe({
      next: url => { this.patch({ image: url }); this.uploading.set(false); },
      error: () => this.uploading.set(false),
    });
  }

  save() {
    const d = this.draft();
    if (!d.name) return;
    const payload: CollectionPayload = {
      name: d.name,
      description: d.description || null,
      image: d.image || null,
      featured: d.featured,
      order: d.order,
    };
    this.saving.set(true);
    const id = this.editingId();
    const req = id ? this.api.update(id, payload) : this.api.create(payload);
    req.subscribe({
      next: col => {
        if (id) {
          this.collections.update(list => list.map(c => c.id === id ? col : c));
        } else {
          this.collections.update(list => [...list, col].sort((a, b) => a.order - b.order));
        }
        this.saving.set(false);
        this.closeForm();
      },
      error: () => this.saving.set(false),
    });
  }

  toggleActive(col: Collection) {
    this.api.patchActive(col.id, !col.active).subscribe({
      next: updated => this.collections.update(list => list.map(c => c.id === updated.id ? updated : c)),
    });
  }

  confirmDelete(id: string) { this.deletingId.set(id); }
  cancelDelete() { this.deletingId.set(null); }

  doDelete(id: string) {
    this.api.remove(id).subscribe({
      next: () => {
        this.collections.update(list => list.filter(c => c.id !== id));
        this.deletingId.set(null);
        if (this.editingId() === id) this.closeForm();
      },
    });
  }
}
