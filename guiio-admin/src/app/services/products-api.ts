import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

const API_URL = 'https://guiio-backend.onrender.com/api';
const ADMIN_KEY = 'guiio-admin-key-2024';

export interface ProductColor {
  name: string;
  hex: string;
}

export interface Product {
  id: string;
  name: string;
  collection: string;
  price: number;
  description: string;
  type: string;
  gender: string;
  featured: boolean;
  inStock: boolean;
  active: boolean;
  tags: string[];
  images: string[];
  topSizes: string[];
  bottomSizes: string[];
  colors: ProductColor[];
  createdAt: string;
  updatedAt: string;
}

export type ProductPayload = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'active'>;

@Injectable({ providedIn: 'root' })
export class ProductsApiService {
  private readonly http = inject(HttpClient);
  private readonly headers = new HttpHeaders({ 'X-Admin-Key': ADMIN_KEY });

  getAll() {
    return this.http.get<Product[]>(`${API_URL}/products`, { headers: this.headers });
  }

  create(data: ProductPayload) {
    return this.http.post<Product>(`${API_URL}/products`, data, { headers: this.headers });
  }

  update(id: string, data: ProductPayload) {
    return this.http.patch<Product>(`${API_URL}/products/${id}`, data, { headers: this.headers });
  }

  patchActive(id: string, active: boolean) {
    return this.http.patch<Product>(`${API_URL}/products/${id}/active`, { active }, { headers: this.headers });
  }

  remove(id: string) {
    return this.http.delete(`${API_URL}/products/${id}`, { headers: this.headers });
  }
}
