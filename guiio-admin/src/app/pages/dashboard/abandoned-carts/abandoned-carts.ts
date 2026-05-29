import { Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://api.guiiouniformes.com/api';

interface CartItem {
  id: string; name: string; price: number; quantity: number;
  color: string; topSize: string; bottomSize: string;
}

interface AbandonedCart {
  id: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  city: string | null;
  items: CartItem[];
  total: number;
  createdAt: string;
}

@Component({
  selector: 'app-abandoned-carts',
  imports: [DatePipe],
  templateUrl: './abandoned-carts.html',
})
export class AbandonedCarts {
  private readonly http = inject(HttpClient);

  protected carts = signal<AbandonedCart[]>([]);
  protected loading = signal(true);
  protected error = signal(false);
  protected selected = signal<AbandonedCart | null>(null);

  protected totalLost = computed(() =>
    this.carts().reduce((sum, c) => sum + c.total, 0)
  );

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.http.get<AbandonedCart[]>(`${API_URL}/abandoned-carts`).subscribe({
      next: data => { this.carts.set(data); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  openDetail(c: AbandonedCart) { this.selected.set(c); }
  closeDetail() { this.selected.set(null); }
}
