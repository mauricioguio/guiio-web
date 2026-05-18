import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Product } from './products-api';

const API_URL = 'https://guiio-web-production.up.railway.app/api';
const ADMIN_KEY = 'guiio-admin-key-2024';

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  featured: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export type CollectionPayload = Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>;

@Injectable({ providedIn: 'root' })
export class CollectionsApiService {
  private readonly http = inject(HttpClient);
  private readonly headers = new HttpHeaders({ 'X-Admin-Key': ADMIN_KEY });

  getAll() {
    return this.http.get<Collection[]>(`${API_URL}/collections`);
  }

  create(data: CollectionPayload) {
    return this.http.post<Collection>(`${API_URL}/collections`, data, { headers: this.headers });
  }

  update(id: string, data: CollectionPayload) {
    return this.http.patch<Collection>(`${API_URL}/collections/${id}`, data, { headers: this.headers });
  }

  remove(id: string) {
    return this.http.delete(`${API_URL}/collections/${id}`, { headers: this.headers });
  }

  getProducts(collectionId: string) {
    return this.http.get<Product[]>(`${API_URL}/collections/${collectionId}/products`, { headers: this.headers });
  }

  addProduct(collectionId: string, productId: string) {
    return this.http.post<{ added: boolean }>(`${API_URL}/collections/${collectionId}/products`, { productId }, { headers: this.headers });
  }

  removeProduct(collectionId: string, productId: string) {
    return this.http.delete<{ removed: boolean }>(`${API_URL}/collections/${collectionId}/products/${productId}`, { headers: this.headers });
  }
}
