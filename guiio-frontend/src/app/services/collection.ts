import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Product } from '../models/product';

const API_URL = 'https://api.guiiouniformes.com/api';

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  featured: boolean;
  order: number;
}

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly http = inject(HttpClient);
  private readonly collections = signal<Collection[]>([]);
  private readonly _loading = signal(true);

  constructor() {
    this.http.get<Collection[]>(`${API_URL}/collections`).subscribe({
      next: list => { this.collections.set(list); this._loading.set(false); },
      error: () => { this._loading.set(false); },
    });
  }

  getAll() {
    return this.collections.asReadonly();
  }

  getLoading() {
    return this._loading.asReadonly();
  }

  getProductsByName(name: string) {
    return this.http.get<Product[]>(`${API_URL}/collections/name/${encodeURIComponent(name)}/products`);
  }
}
