import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

const API_URL = 'https://guiio-backend.onrender.com/api';
const ADMIN_KEY = 'guiio-admin-key-2024';

export interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  topSize: string;
  bottomSize: string;
  color: string;
  product: { name: string; images: string[] };
}

export interface Order {
  id: string;
  reference: string;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  total: number;
  shipping: number;
  discount: number;
  address: string;
  city: string;
  notes: string | null;
  wompiTxId: string | null;
  createdAt: string;
  customer: { id: string; name: string; email: string; phone: string };
  items: OrderItem[];
}

@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly http = inject(HttpClient);
  private readonly headers = new HttpHeaders({ 'X-Admin-Key': ADMIN_KEY });

  getOrders(status?: string) {
    const params: Record<string, string> = status ? { status } : {};
    return this.http.get<Order[]>(`${API_URL}/orders`, { headers: this.headers, params });
  }

  updateStatus(id: string, status: string) {
    return this.http.patch<Order>(
      `${API_URL}/orders/${id}/status`,
      { status },
      { headers: this.headers },
    );
  }
}
