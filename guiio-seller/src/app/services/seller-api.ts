import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth';

const API = 'https://guiio-web-production.up.railway.app/api/seller';

export interface Sede { id: string; name: string; }

export interface ProductColor { name: string; hex: string; }
export interface Product {
  id: string; name: string; price: number; description: string;
  type: string; gender: string; topSizes: string[]; bottomSizes: string[];
  colors: ProductColor[]; images: string[]; inStock: boolean; collection: string;
}

export interface InventoryItem {
  productId: string; size: string; quantity: number;
}

export interface SaleItemPayload {
  productId: string; productName: string;
  size: string; quantity: number; price: number;
  note?: string;
}

export interface SellerCustomer {
  phone: string;
  name: string;
}

export interface Sale {
  id: string; type: string; status: string; total: number;
  customerName: string | null; customerPhone: string | null; notes: string | null;
  createdAt: string;
  items: SaleItemPayload[];
}

@Injectable({ providedIn: 'root' })
export class SellerApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  private get headers(): Record<string, string> {
    const s = this.auth.currentSede();
    return s ? { 'x-sede-id': s.sedeId, 'x-sede-pin': s.pin } : {};
  }

  getSedes() {
    return this.http.get<Sede[]>(`${API}/sedes`);
  }

  login(sedeId: string, pin: string) {
    return this.http.post<{ id: string; name: string }>(`${API}/auth`, { sedeId, pin });
  }

  getProducts() {
    return this.http.get<Product[]>(`${API}/products`, { headers: this.headers });
  }

  getInventory(sedeId: string) {
    return this.http.get<{ items: InventoryItem[]; products: Product[] }>(
      `${API}/inventory/${sedeId}`,
      { headers: this.headers },
    );
  }

  createSale(data: {
    type: 'STOCK' | 'FABRICAR';
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    deliveryDate?: string;
    items: SaleItemPayload[];
  }) {
    return this.http.post<Sale>(`${API}/sales`, data, { headers: this.headers });
  }

  upsertInventory(items: { productId: string; size: string; quantity: number }[]) {
    return this.http.put<{ updated: number }>(`${API}/inventory`, { items }, { headers: this.headers });
  }

  getSales() {
    return this.http.get<Sale[]>(`${API}/sales`, { headers: this.headers });
  }

  findCustomer(phone: string) {
    return this.http.get<SellerCustomer>(`${API}/customers/${encodeURIComponent(phone)}`, { headers: this.headers });
  }

  createCustomer(phone: string, name: string) {
    return this.http.post<SellerCustomer>(`${API}/customers`, { phone, name }, { headers: this.headers });
  }
}
