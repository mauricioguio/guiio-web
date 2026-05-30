import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../services/cart';

@Component({
  selector: 'app-payment-pending',
  imports: [RouterLink],
  templateUrl: './payment-pending.html',
  styleUrl: './payment-pending.scss',
})
export class PaymentPending implements OnInit {
  private readonly cart = inject(CartService);

  ngOnInit() {
    this.cart.clearCart();
  }
}
