import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://guiio-web-production.up.railway.app/api';

export interface OrderItem {
  id: string; quantity: number; price: number;
  productName: string; topSize: string; bottomSize: string; color: string;
}

export interface Order {
  id: string; reference: string;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  total: number; shipping: number; discount: number;
  address: string; city: string; notes: string | null; wompiTxId: string | null;
  createdAt: string;
  customer: { id: string; name: string; email: string; phone: string; cedula?: string | null };
  items: OrderItem[];
}

@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);

  getOrders(status?: string) {
    const params: Record<string, string> = status ? { status } : {};
    return this.http.get<Order[]>(`${API_URL}/orders`, { params });
  }

  updateStatus(id: string, status: string) {
    return this.http.patch<Order>(`${API_URL}/orders/${id}/status`, { status });
  }
}
