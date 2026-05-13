import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';

interface SaleItem {
  product: string;
  size: string;
  color: string;
  qty: number;
  price: number;
}

interface Sale {
  id: string;
  date: Date;
  client: string;
  items: SaleItem[];
  total: number;
  paymentMethod: 'efectivo' | 'transferencia' | 'datafono';
}

@Component({
  selector: 'app-sales',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './sales.html',
})
export class Sales {
  private readonly fb = inject(FormBuilder);

  protected showForm = signal(false);
  protected sales = signal<Sale[]>([]);
  protected items = signal<SaleItem[]>([]);

  protected readonly form = this.fb.group({
    client: [''],
    paymentMethod: ['efectivo', Validators.required],
    product: ['', Validators.required],
    size: ['', Validators.required],
    color: ['', Validators.required],
    qty: [1, [Validators.required, Validators.min(1)]],
    price: [null as number | null, [Validators.required, Validators.min(1)]],
  });

  addItem() {
    const { product, size, color, qty, price } = this.form.value;
    if (!product || !size || !color || !qty || !price) return;
    this.items.update(list => [...list, {
      product: product!,
      size: size!,
      color: color!,
      qty: qty!,
      price: price!,
    }]);
    this.form.patchValue({ product: '', size: '', color: '', qty: 1, price: null });
  }

  removeItem(index: number) {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  get total() {
    return this.items().reduce((acc, i) => acc + i.price * i.qty, 0);
  }

  saveSale() {
    if (this.items().length === 0) return;
    const { client, paymentMethod } = this.form.value;
    const sale: Sale = {
      id: Date.now().toString(),
      date: new Date(),
      client: client || 'Cliente ocasional',
      items: this.items(),
      total: this.total,
      paymentMethod: (paymentMethod as Sale['paymentMethod']) ?? 'efectivo',
    };
    this.sales.update(list => [sale, ...list]);
    this.items.set([]);
    this.form.reset({ paymentMethod: 'efectivo', qty: 1 });
    this.showForm.set(false);
  }

  formatPrice(value: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }
}
