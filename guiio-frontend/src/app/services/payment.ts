import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CartService } from './cart';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly cart = inject(CartService);
  private readonly apiUrl = 'http://localhost:3000/api';

  createPreference() {
    const items = this.cart.cartItems().map(item => ({
      id: item.product.id,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      image: item.product.images[0],
      topSize: item.selectedTopSize,
      bottomSize: item.selectedBottomSize,
      color: item.selectedColor.name,
    }));

    return this.http.post<{ checkoutUrl: string }>(`${this.apiUrl}/payments/checkout`, {
      items,
      shipping: this.cart.shipping(),
      discount: this.cart.discount(),
    });
  }
}
