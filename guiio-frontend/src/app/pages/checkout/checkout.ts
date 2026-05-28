import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { CartService } from '../../services/cart';
import { PaymentService } from '../../services/payment';

@Component({
  selector: 'app-checkout',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly cart = inject(CartService);
  private readonly paymentService = inject(PaymentService);

  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly paymentMethod = signal<'wompi' | 'addi'>('wompi');

  protected readonly form = this.fb.group({
    name:      ['', [Validators.required, Validators.minLength(3)]],
    email:     ['', [Validators.required, Validators.email]],
    phone:     ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
    docNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{6,12}$/)]],
    address:   ['', [Validators.required, Validators.minLength(5)]],
    reference: [''],
    city:      ['', Validators.required],
    notes:     [''],
  });

  selectMethod(method: 'wompi' | 'addi') {
    this.paymentMethod.set(method);
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(false);

    const v = this.form.getRawValue();

    if (this.paymentMethod() === 'addi') {
      this.paymentService.createAddiCheckout({
        name:      v.name!,
        email:     v.email!,
        phone:     v.phone!,
        address:   v.address!,
        city:      v.city!,
        docNumber: v.docNumber!,
        reference: v.reference,
        notes:     v.notes,
      }).subscribe({
        next: ({ checkoutUrl }) => { window.location.href = checkoutUrl; },
        error: () => { this.loading.set(false); this.error.set(true); },
      });
    } else {
      this.paymentService.createPreference({
        name:      v.name!,
        email:     v.email!,
        phone:     v.phone!,
        cedula:    v.docNumber,
        address:   v.address!,
        reference: v.reference,
        city:      v.city!,
        notes:     v.notes,
      }).subscribe({
        next: ({ checkoutUrl, reference }) => {
          localStorage.setItem('pendingOrderRef', reference);
          window.location.href = checkoutUrl;
        },
        error: () => { this.loading.set(false); this.error.set(true); },
      });
    }
  }

  isInvalid(field: string) {
    const control = this.form.get(field);
    return control?.invalid && control?.touched;
  }
}
