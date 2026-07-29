import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://api.guiiouniformes.com/api';

export interface SaleItem {
  id: string; productId: string; productName: string; size: string;
  quantity: number; price: number; note: string | null; deliveredQty: number;
}

export interface SalePayment { id: string; amount: number; note: string | null; createdAt: string; }

export interface SellerSale {
  id: string; orderNumber: number; type: 'STOCK' | 'FABRICAR'; status: string;
  total: number; customerName: string | null; customerPhone: string | null; notes: string | null;
  deliveryDate: string | null; paymentMethod: string | null; createdAt: string;
  channel: string | null;
  shipping: number;
  shippingName: string | null; shippingCedula: string | null;
  shippingPhone: string | null; shippingAddress: string | null; shippingCity: string | null;
  items: SaleItem[]; payments: SalePayment[]; sede: { id: string; name: string };
}

@Injectable({ providedIn: 'root' })
export class SellerSalesApiService {
  private readonly http = inject(HttpClient);

  getAll() { return this.http.get<SellerSale[]>(`${API_URL}/seller/admin/sales`); }

  updateStatus(saleId: string, status: string) {
    return this.http.patch<SellerSale>(`${API_URL}/seller/admin/sales/${saleId}/status`, { status });
  }

  addPayment(saleId: string, amount: number, note?: string) {
    return this.http.post<SalePayment>(`${API_URL}/seller/admin/fabricar/${saleId}/payment`, { amount, note });
  }

  updateDeliveredQty(saleId: string, items: { itemId: string; deliveredQty: number }[]) {
    return this.http.patch<SellerSale>(`${API_URL}/seller/admin/fabricar/${saleId}/items`, { items });
  }

  updateSale(saleId: string, data: {
    customerName?: string | null;
    customerPhone?: string | null;
    deliveryDate?: string | null;
    paymentMethod?: string | null;
    notes?: string | null;
    items?: { id: string; productName?: string; size?: string; price?: number; note?: string | null }[];
  }) {
    return this.http.patch<SellerSale>(`${API_URL}/seller/admin/sales/${saleId}`, data);
  }

  delete(saleId: string) {
    return this.http.delete<void>(`${API_URL}/seller/admin/sales/${saleId}`);
  }
}
