import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://api.guiiouniformes.com/api';

export interface ProductColor { name: string; hex: string; }

export interface Product {
  id: string; name: string; collection: string; price: number;
  description: string; type: string; gender: string;
  featured: boolean; inStock: boolean; active: boolean;
  tags: string[]; images: string[]; topSizes: string[];
  bottomSizes: string[]; colors: ProductColor[];
  createdAt: string; updatedAt: string;
}

export type ProductPayload = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'active'>;

export interface CostItem { id: string; productId: string; name: string; amount: number; createdAt: string; }

@Injectable({ providedIn: 'root' })
export class ProductsApiService {
  private readonly http = inject(HttpClient);

  getAll() { return this.http.get<Product[]>(`${API_URL}/products`); }
  getAllAdmin() { return this.http.get<Product[]>(`${API_URL}/products/admin/all`); }
  create(data: ProductPayload) { return this.http.post<Product>(`${API_URL}/products`, data); }
  update(id: string, data: ProductPayload) { return this.http.patch<Product>(`${API_URL}/products/${id}`, data); }
  patchActive(id: string, active: boolean) { return this.http.patch<Product>(`${API_URL}/products/${id}/active`, { active }); }
  patchCollection(id: string, collection: string) { return this.http.patch<Product>(`${API_URL}/products/${id}/collection`, { collection }); }
  remove(id: string) { return this.http.delete(`${API_URL}/products/${id}`); }

  getCostItems(productId: string) { return this.http.get<CostItem[]>(`${API_URL}/products/${productId}/cost-items`); }
  addCostItem(productId: string, name: string, amount: number) { return this.http.post<CostItem>(`${API_URL}/products/${productId}/cost-items`, { name, amount }); }
  updateCostItem(costId: string, name: string, amount: number) { return this.http.patch<CostItem>(`${API_URL}/products/cost-items/${costId}`, { name, amount }); }
  deleteCostItem(costId: string) { return this.http.delete(`${API_URL}/products/cost-items/${costId}`); }
  syncCostItems(sourceId: string, targetIds: string[]) { return this.http.post<{ synced: number }>(`${API_URL}/products/cost-items/sync`, { sourceId, targetIds }); }
}
