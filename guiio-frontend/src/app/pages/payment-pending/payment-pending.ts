import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart';
import { PaymentService } from '../../services/payment';

@Component({
  selector: 'app-payment-pending',
  imports: [RouterLink],
  templateUrl: './payment-pending.html',
  styleUrl: './payment-pending.scss',
})
export class PaymentPending implements OnInit, OnDestroy {
  private readonly cart = inject(CartService);
  private readonly payment = inject(PaymentService);
  private readonly router = inject(Router);

  private pollInterval: any;
  private pollCount = 0;
  private readonly maxPolls = 40; // 2 minutos (40 × 3s)

  ngOnInit() {
    this.cart.clearCart();
    const reference = localStorage.getItem('pendingAddiRef');
    if (reference) {
      this.pollStatus(reference);
    }
  }

  private pollStatus(reference: string) {
    this.pollInterval = setInterval(() => {
      this.pollCount++;
      this.payment.getAddiOrderStatus(reference).subscribe({
        next: ({ status }) => {
          if (status === 'PAID') {
            localStorage.removeItem('pendingAddiRef');
            clearInterval(this.pollInterval);
            this.router.navigate(['/pago/exitoso']);
          } else if (status === 'CANCELLED') {
            localStorage.removeItem('pendingAddiRef');
            clearInterval(this.pollInterval);
            this.router.navigate(['/pago/fallido']);
          } else if (this.pollCount >= this.maxPolls) {
            clearInterval(this.pollInterval);
          }
        },
        error: () => {
          if (this.pollCount >= this.maxPolls) clearInterval(this.pollInterval);
        },
      });
    }, 3000);
  }

  ngOnDestroy() {
    clearInterval(this.pollInterval);
  }
}
