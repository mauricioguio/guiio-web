import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://api.guiiouniformes.com/api';

interface InventoryReturn {
  id: string;
  sedeId: string;
  sede: { id: string; name: string };
  status: string;
  notes: string | null;
  createdAt: string;
  items: { productId: string; productName: string; size: string; quantity: number }[];
}

@Component({
  selector: 'app-devoluciones',
  templateUrl: './devoluciones.html',
  imports: [],
})
export class Devoluciones implements OnInit {
  private readonly http = inject(HttpClient);

  protected returns  = signal<InventoryReturn[]>([]);
  protected loading  = signal(true);
  protected markingId = signal<string | null>(null);

  ngOnInit() {
    this.http.get<InventoryReturn[]>(`${API_URL}/seller/admin/returns`).subscribe({
      next: list => { this.returns.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  markReceived(ret: InventoryReturn) {
    if (this.markingId()) return;
    this.markingId.set(ret.id);
    this.http.patch<InventoryReturn>(`${API_URL}/seller/admin/returns/${ret.id}/received`, {}).subscribe({
      next: updated => {
        this.returns.update(list => list.map(r => r.id === updated.id ? updated : r));
        this.markingId.set(null);
      },
      error: () => this.markingId.set(null),
    });
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }
}
