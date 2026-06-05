import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://api.guiiouniformes.com/api';

export interface UnifiedSaleItem {
  productName: string; quantity: number; price: number; size: string;
}

export interface UnifiedSale {
  id: string;
  channel: 'online' | 'fisica';
  channelName: string;
  customerName: string | null;
  customerPhone: string | null;
  total: number;
  status: string;
  createdAt: string;
  itemCount: number;
  items: UnifiedSaleItem[];
  paymentMethod: string | null;
  reference?: string;
  orderNumber?: number;
  type?: string;
}

@Injectable({ providedIn: 'root' })
export class AllSalesApiService {
  private readonly http = inject(HttpClient);
  getAll() { return this.http.get<UnifiedSale[]>(`${API_URL}/seller/admin/unified-sales`); }
}
