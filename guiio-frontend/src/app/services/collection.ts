import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Product } from '../models/product';

const API_URL = 'https://guiio-backend.onrender.com/api';

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

  constructor() {
    this.http.get<Collection[]>(`${API_URL}/collections`).subscribe({
      next: list => this.collections.set(list),
    });
  }

  getAll() {
    return this.collections.asReadonly();
  }

  getProductsByName(name: string) {
    return this.http.get<Product[]>(`${API_URL}/collections/name/${encodeURIComponent(name)}/products`);
  }
}
