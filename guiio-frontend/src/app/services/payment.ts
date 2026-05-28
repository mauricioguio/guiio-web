import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CartService } from './cart';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly cart = inject(CartService);
  private readonly apiUrl = 'https://api.guiiouniformes.com/api';

  getTransactionStatus(wompiId: string) {
    return this.http.get<{ status: string }>(`${this.apiUrl}/payments/status/${wompiId}`);
  }

  confirmOrder(reference: string) {
    return this.http.post<{ ok: boolean }>(`${this.apiUrl}/payments/confirm/${reference}`, {});
  }

  private buildItems() {
    return this.cart.cartItems().map(item => ({
      id:         item.product.id,
      name:       item.product.name,
      price:      item.product.price,
      quantity:   item.quantity,
      image:      item.product.images[0],
      topSize:    item.selectedTopSize,
      bottomSize: item.selectedBottomSize,
      color:      item.selectedColor?.name ?? '',
    }));
  }

  createPreference(customer: {
    name: string; email: string; phone: string;
    cedula?: string | null;
    address: string; reference?: string | null;
    city: string; notes?: string | null;
  }) {
    return this.http.post<{ checkoutUrl: string; reference: string; total: number }>(
      `${this.apiUrl}/payments/checkout`,
      { items: this.buildItems(), shipping: this.cart.shipping(), discount: this.cart.discount(), customer },
    );
  }

  createAddiCheckout(customer: {
    name: string; email: string; phone: string;
    address: string; city: string; docNumber: string;
    reference?: string | null; notes?: string | null;
  }) {
    return this.http.post<{ checkoutUrl: string; reference: string; total: number }>(
      `${this.apiUrl}/addi/checkout`,
      { items: this.buildItems(), shipping: this.cart.shipping(), discount: this.cart.discount(), customer },
    );
  }
}
