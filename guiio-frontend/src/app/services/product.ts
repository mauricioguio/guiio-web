import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Product } from '../models/product';

const API_URL = 'https://guiio-web-production.up.railway.app/api';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly products = signal<Product[]>([]);
  private readonly _loading = signal(true);

  constructor() {
    this.http.get<Product[]>(`${API_URL}/products`).subscribe({
      next: list => { this.products.set(list); this._loading.set(false); },
      error: () => { this._loading.set(false); },
    });
  }

  getAll() {
    return this.products.asReadonly();
  }

  getLoading() {
    return this._loading.asReadonly();
  }

  getFeatured() {
    return computed(() => this.products().filter(p => p.featured));
  }

  getByGender(gender: 'mujer' | 'hombre') {
    return computed(() => this.products().filter(p => p.gender === gender || p.gender === 'unisex'));
  }

  getByCollection(collection: string) {
    return computed(() => this.products().filter(p => p.collection === collection));
  }

  getById(id: string) {
    return computed(() => this.products().find(p => p.id === id));
  }

  getCollections() {
    return computed(() => [...new Set(this.products().map(p => p.collection))]);
  }

  getCollectionSpotlights() {
    return computed(() => {
      const seen = new Map<string, { name: string; description: string; image: string }>();
      for (const p of this.products()) {
        if (!seen.has(p.collection)) {
          seen.set(p.collection, {
            name: p.collection,
            description: p.description,
            image: p.images?.[0] ?? '',
          });
        } else if (!seen.get(p.collection)!.image && p.images?.[0]) {
          seen.set(p.collection, { ...seen.get(p.collection)!, image: p.images[0] });
        }
      }
      return [...seen.values()];
    });
  }
}
