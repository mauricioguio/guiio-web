import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://guiio-backend.onrender.com/api';
const ADMIN_KEY = 'guiio-admin-key-2024';
const headers = { 'x-admin-key': ADMIN_KEY };

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  price: number;
}

export interface SellerSale {
  id: string;
  type: 'STOCK' | 'FABRICAR';
  status: string;
  total: number;
  customerName: string | null;
  notes: string | null;
  createdAt: string;
  items: SaleItem[];
  sede: { id: string; name: string };
}

@Injectable({ providedIn: 'root' })
export class SellerSalesApiService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<SellerSale[]>(`${API_URL}/seller/admin/sales`, { headers });
  }

  updateStatus(saleId: string, status: string) {
    return this.http.patch<SellerSale>(
      `${API_URL}/seller/admin/sales/${saleId}/status`,
      { status },
      { headers },
    );
  }
}
