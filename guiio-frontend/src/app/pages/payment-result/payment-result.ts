import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PaymentService } from '../../services/payment';
import { fbqSetUser } from '../../utils/pixel';

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

  private trackPurchase(total: number) {
    const email = localStorage.getItem('pendingUserEmail');
    const phone = localStorage.getItem('pendingUserPhone');
    const name  = localStorage.getItem('pendingUserName');
    localStorage.removeItem('pendingUserEmail');
    localStorage.removeItem('pendingUserPhone');
    localStorage.removeItem('pendingUserName');

    const fire = () => (window as any).fbq?.('track', 'Purchase', { value: total, currency: 'COP' });
    if (email && phone && name) {
      fbqSetUser(email, phone, name).then(fire);
    } else {
      fire();
    }
  }

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;

    // ADDI redirect
    const addi = params.get('addi');
    if (addi) {
      if (addi === 'approved') {
        this.router.navigate(['/pago/exitoso']);
      } else {
        this.router.navigate(['/pago/fallido']);
      }
      return;
    }

    // Wompi redirect — usa transaction_status de la URL directamente
    const txStatus = params.get('transaction_status') ?? params.get('status');
    const wompiId  = params.get('id');

    if (!wompiId && !txStatus) {
      this.router.navigate(['/pago/fallido']);
      return;
    }

    if (txStatus === 'APPROVED') {
      const ref = params.get('reference');
      if (ref) this.paymentService.confirmOrder(ref).subscribe();
      const total = parseFloat(localStorage.getItem('pendingOrderTotal') ?? '0');
      localStorage.removeItem('pendingOrderTotal');
      this.trackPurchase(total);
      this.router.navigate(['/pago/exitoso']);
      return;
    }
    if (txStatus === 'PENDING') {
      this.router.navigate(['/pago/pendiente']);
      return;
    }
    if (txStatus) {
      this.router.navigate(['/pago/fallido']);
      return;
    }

    // Fallback: consulta al backend con el wompiId
    this.paymentService.getTransactionStatus(wompiId!).subscribe({
      next: ({ status }) => {
        if (status === 'APPROVED') {
          const ref = localStorage.getItem('pendingOrderRef');
          if (ref) {
            localStorage.removeItem('pendingOrderRef');
            this.paymentService.confirmOrder(ref).subscribe();
          }
          const total = parseFloat(localStorage.getItem('pendingOrderTotal') ?? '0');
          localStorage.removeItem('pendingOrderTotal');
          this.trackPurchase(total);
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
