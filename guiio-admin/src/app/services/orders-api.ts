import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://api.guiiouniformes.com/api';

export interface OrderItem {
  id: string; quantity: number; price: number;
  productName: string; topSize: string; bottomSize: string; color: string;
}

export interface Order {
  id: string; reference: string;
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  total: number; shipping: number; discount: number;
  address: string; city: string; notes: string | null; wompiTxId: string | null;
  paymentProvider: string | null;
  createdAt: string;
  customer: { id: string; name: string; email: string; phone: string; cedula?: string | null };
  items: OrderItem[];
}

export interface EditRequestChanges {
  itemsToAdd?: { productName: string; topSize: string; bottomSize: string; color: string; quantity: number; price: number }[];
  itemsToModify?: { itemId: string; quantity?: number; price?: number }[];
  itemsToRemove?: string[];
}

export interface EditRequest {
  id: string;
  orderId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedBy: string;
  reason: string | null;
  changes: EditRequestChanges;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
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

  deleteOrder(id: string) {
    return this.http.delete<void>(`${API_URL}/orders/${id}`);
  }

  getEditRequests(orderId: string) {
    return this.http.get<EditRequest[]>(`${API_URL}/order-edit-requests/order/${orderId}`);
  }

  createEditRequest(orderId: string, changes: EditRequestChanges, reason?: string) {
    return this.http.post<EditRequest>(`${API_URL}/order-edit-requests/admin`, { orderId, changes, reason });
  }

  reviewEditRequest(id: string, approved: boolean, reviewNote?: string) {
    return this.http.patch<{ success: boolean }>(`${API_URL}/order-edit-requests/${id}/review`, { approved, reviewNote });
  }
}
