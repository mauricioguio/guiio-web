import { Component, inject, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cart';
import { PaymentService } from '../../services/payment';

@Component({
  selector: 'app-cart',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class Cart {
  protected readonly cart = inject(CartService);
  private readonly paymentService = inject(PaymentService);
  protected readonly loadingPayment = signal(false);
  protected readonly paymentError = signal(false);

  checkout() {
    this.loadingPayment.set(true);
    this.paymentError.set(false);

    this.paymentService.createPreference().subscribe({
      next: ({ checkoutUrl }) => {
        window.location.href = checkoutUrl;
      },
      error: () => {
        this.loadingPayment.set(false);
        this.paymentError.set(true);
      },
    });
  }
}
