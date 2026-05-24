import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentService } from '../../services/payment';

@Component({
  selector: 'app-payment-result',
  imports: [],
  template: `
    <div class="min-h-screen bg-gray-50 flex items-center justify-center">
      <div class="text-center">
        <div class="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600 text-sm">Verificando tu pago...</p>
      </div>
    </div>
  `,
})
export class PaymentResult implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly paymentService = inject(PaymentService);

  ngOnInit() {
    const wompiId = this.route.snapshot.queryParamMap.get('id');
    if (!wompiId) {
      this.router.navigate(['/pago/fallido']);
      return;
    }

    this.paymentService.getTransactionStatus(wompiId).subscribe({
      next: ({ status }) => {
        if (status === 'APPROVED') {
          this.router.navigate(['/pago/exitoso']);
        } else if (status === 'PENDING') {
          this.router.navigate(['/pago/pendiente']);
        } else {
          this.router.navigate(['/pago/fallido']);
        }
      },
      error: () => this.router.navigate(['/pago/fallido']),
    });
  }
}
