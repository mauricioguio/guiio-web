import { Component, inject, signal, computed } from '@angular/core';
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
  protected loading = signal(true);
  protected saving = signal(false);
  protected uploading = signal(false);
  protected showForm = signal(false);
  protected editingId = signal<string | null>(null);
  protected deletingId = signal<string | null>(null);
  protected draft = signal<Draft>(emptyDraft());
  protected productSearch = signal('');
  protected assigningId = signal<string | null>(null);

  protected collectionProducts = computed(() => {
    const name = this.draft().name;
    return this.allProducts().filter(p => p.collection === name);
  });

  protected otherProducts = computed(() => {
    const name = this.draft().name;
    const q = this.productSearch().toLowerCase();
    return this.allProducts().filter(p => {
      if (p.collection === name) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.collection.toLowerCase().includes(q)) return false;
      return true;
    });
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

  assignProduct(product: Product) {
    const collection = this.draft().name;
    if (!collection) return;
    this.assigningId.set(product.id);
    this.productsApi.patchCollection(product.id, collection).subscribe({
      next: updated => {
        this.allProducts.update(list => list.map(p => p.id === updated.id ? updated : p));
        this.assigningId.set(null);
      },
      error: () => this.assigningId.set(null),
    });
  }

  removeFromCollection(product: Product) {
    this.assigningId.set(product.id);
    this.productsApi.patchCollection(product.id, '').subscribe({
      next: updated => {
        this.allProducts.update(list => list.map(p => p.id === updated.id ? updated : p));
        this.assigningId.set(null);
      },
      error: () => this.assigningId.set(null),
    });
  }

  openCreate() {
    this.editingId.set(null);
    this.draft.set(emptyDraft());
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
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingId.set(null);
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
