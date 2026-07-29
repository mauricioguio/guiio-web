import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

const API_URL = 'https://api.guiiouniformes.com/api';

interface AdminClient {
  source: 'online' | 'physical';
  id: string;
  name: string;
  email: string | null;
  phone: string;
  cedula: string | null;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

@Component({
  selector: 'app-clients',
  templateUrl: './clients.html',
  imports: [FormsModule],
})
export class Clients implements OnInit {
  private readonly http = inject(HttpClient);

  protected clients   = signal<AdminClient[]>([]);
  protected loading   = signal(true);
  protected search    = signal('');
  protected filter    = signal<'ALL' | 'online' | 'physical'>('ALL');
  protected expanded  = signal<string | null>(null);

  protected filtered = computed(() => {
    const q = this.search().toLowerCase().trim();
    const f = this.filter();
    return this.clients().filter(c => {
      if (f !== 'ALL' && c.source !== f) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q)
        || c.phone.includes(q)
        || (c.email ?? '').toLowerCase().includes(q);
    });
  });

  ngOnInit() {
    this.http.get<AdminClient[]>(`${API_URL}/seller/admin/customers`).subscribe({
      next: list => { this.clients.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  formatPrice(v: number) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(iso));
  }
}
