import { Component, inject, signal, computed } from '@angular/core';
import { ProductsApiService, Product, ProductPayload } from '../../../services/products-api';
import { CloudinaryService } from '../../../services/cloudinary';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

interface Draft {
  name: string;
  collection: string;
  price: number;
  description: string;
  type: string;
  gender: string;
  featured: boolean;
  inStock: boolean;
  tagInput: string;
  topSizes: string[];
  bottomSizes: string[];
  images: string[];
}

const emptyDraft = (): Draft => ({
  name: '', collection: '', price: 0, description: '',
  type: 'conjunto', gender: 'mujer',
  featured: false, inStock: true,
  tagInput: '',
  topSizes: [], bottomSizes: [],
  images: [''],
});

@Component({
  selector: 'app-products',
  templateUrl: './products.html',
})
export class Products {
  private readonly api = inject(ProductsApiService);
  private readonly cloudinary = inject(CloudinaryService);

  protected readonly SIZES = SIZES;
  protected products = signal<Product[]>([]);
  protected loading = signal(true);
  protected saving = signal(false);
  protected search = signal('');
  protected showForm = signal(false);
  protected editingId = signal<string | null>(null);
  protected deletingId = signal<string | null>(null);
  protected draft = signal<Draft>(emptyDraft());
  protected uploadingIndex = signal<number | null>(null);
  protected priceInput = signal('');

  protected filtered = computed(() => {
    const q = this.search().toLowerCase();
    return q
      ? this.products().filter(p =>
          p.name.toLowerCase().includes(q) || p.collection.toLowerCase().includes(q)
        )
      : this.products();
  });

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getAll().subscribe({
      next: list => { this.products.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private formatCOP(value: number) {
    return value > 0 ? new Intl.NumberFormat('es-CO').format(value) : '';
  }

  onPriceInput(raw: string) {
    const digits = raw.replace(/\D/g, '');
    this.priceInput.set(raw);
    this.patchDraft({ price: +digits || 0 });
  }

  onPriceFocus() {
    const p = this.draft().price;
    this.priceInput.set(p > 0 ? p.toString() : '');
  }

  onPriceBlur() {
    this.priceInput.set(this.formatCOP(this.draft().price));
  }

  openCreate() {
    this.editingId.set(null);
    this.draft.set(emptyDraft());
    this.priceInput.set('');
    this.showForm.set(true);
  }

  openEdit(p: Product) {
    this.editingId.set(p.id);
    this.priceInput.set(this.formatCOP(p.price));
    this.draft.set({
      name: p.name,
      collection: p.collection,
      price: p.price,
      description: p.description,
      type: p.type,
      gender: p.gender,
      featured: p.featured,
      inStock: p.inStock,
      tagInput: p.tags.join(', '),
      topSizes: [...p.topSizes],
      bottomSizes: [...p.bottomSizes],
      images: p.images.length ? [...p.images] : [''],
    });
    this.showForm.set(true);
  }

  closeForm() {
    this.showForm.set(false);
    this.editingId.set(null);
  }

  save() {
    const d = this.draft();
    const payload: ProductPayload = {
      name: d.name,
      collection: d.collection,
      price: d.price,
      description: d.description,
      type: d.type,
      gender: d.gender,
      featured: d.featured,
      inStock: d.inStock,
      tags: d.tagInput.split(',').map(t => t.trim()).filter(Boolean),
      topSizes: d.topSizes,
      bottomSizes: d.bottomSizes,
      colors: [],
      images: d.images.filter(i => i),
    };
    this.saving.set(true);
    const id = this.editingId();
    const req = id ? this.api.update(id, payload) : this.api.create(payload);
    req.subscribe({
      next: product => {
        if (id) {
          this.products.update(list => list.map(p => p.id === id ? product : p));
        } else {
          this.products.update(list => [product, ...list]);
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
        this.products.update(list => list.filter(p => p.id !== id));
        this.deletingId.set(null);
        if (this.editingId() === id) this.closeForm();
      },
    });
  }

  patchDraft(patch: Partial<Draft>) {
    this.draft.update(d => ({ ...d, ...patch }));
  }

  // Para conjuntos: blusa y pantalón comparten las mismas tallas disponibles.
  // El cliente elige tallas distintas solo al momento del pedido.
  toggleConjuntoSize(size: string) {
    this.draft.update(d => {
      const sizes = d.topSizes.includes(size)
        ? d.topSizes.filter(s => s !== size)
        : [...d.topSizes, size];
      return { ...d, topSizes: sizes, bottomSizes: sizes };
    });
  }

  toggleTopSize(size: string) {
    this.draft.update(d => ({
      ...d,
      topSizes: d.topSizes.includes(size)
        ? d.topSizes.filter(s => s !== size)
        : [...d.topSizes, size],
    }));
  }

  toggleBottomSize(size: string) {
    this.draft.update(d => ({
      ...d,
      bottomSizes: d.bottomSizes.includes(size)
        ? d.bottomSizes.filter(s => s !== size)
        : [...d.bottomSizes, size],
    }));
  }

  addImage() {
    this.draft.update(d => ({ ...d, images: [...d.images, ''] }));
  }

  removeImage(i: number) {
    this.draft.update(d => ({ ...d, images: d.images.filter((_, idx) => idx !== i) }));
  }

  setImage(i: number, url: string) {
    this.draft.update(d => {
      const images = d.images.map((img, idx) => idx === i ? url : img);
      return { ...d, images };
    });
  }

  uploadImage(i: number, event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingIndex.set(i);
    this.cloudinary.upload(file).subscribe({
      next: url => {
        this.setImage(i, url);
        this.uploadingIndex.set(null);
      },
      error: () => this.uploadingIndex.set(null),
    });
  }

  canSave(): boolean {
    const d = this.draft();
    return !!(d.name && d.collection && d.price > 0);
  }

  typeLabel(type: string) {
    return ({ conjunto: 'Conjunto', top: 'Blusa', bottom: 'Pantalón', otro: 'Otro' } as Record<string, string>)[type] ?? type;
  }

  typeBadge(type: string) {
    return ({
      conjunto: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
      top: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
      bottom: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
      otro: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
    } as Record<string, string>)[type] ?? '';
  }

  formatPrice(value: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', maximumFractionDigits: 0,
    }).format(value);
  }
}
