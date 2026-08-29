import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

const API_URL = 'https://api.guiiouniformes.com/api';

interface Sede { id: string; name: string; }

interface InventoryRow {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  returning: number; // user-entered qty to return
}

interface ReturnItem {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
}

interface InventoryReturn {
  id: string;
  sedeId: string;
  sede: { id: string; name: string };
  status: string;
  notes: string | null;
  createdAt: string;
  items: ReturnItem[];
}

@Component({
  selector: 'app-devoluciones',
  templateUrl: './devoluciones.html',
  imports: [FormsModule],
})
export class Devoluciones implements OnInit {
  private readonly http = inject(HttpClient);

  // Lists
  protected sedes    = signal<Sede[]>([]);
  protected returns  = signal<InventoryReturn[]>([]);
  protected loading  = signal(true);

  // New return form
  protected showForm      = signal(false);
  protected selectedSedeId = signal('');
  protected inventory     = signal<InventoryRow[]>([]);
  protected loadingInv    = signal(false);
  protected formNotes     = signal('');
  protected saving        = signal(false);

  // Confirm modal
  protected confirmOpen   = signal(false);

  // Marking received
  protected markingId     = signal<string | null>(null);

  protected itemsToReturn = computed(() =>
    this.inventory().filter(r => r.returning > 0)
  );

  protected canSubmit = computed(() =>
    this.selectedSedeId() !== '' && this.itemsToReturn().length > 0
  );

  ngOnInit() {
    this.http.get<Sede[]>(`${API_URL}/seller/sedes`).subscribe(list => this.sedes.set(list));
    this.loadReturns();
  }

  private loadReturns() {
    this.loading.set(true);
    this.http.get<InventoryReturn[]>(`${API_URL}/seller/admin/returns`).subscribe({
      next: list => { this.returns.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openForm() {
    this.showForm.set(true);
    this.selectedSedeId.set('');
    this.inventory.set([]);
    this.formNotes.set('');
  }

  closeForm() {
    this.showForm.set(false);
    this.confirmOpen.set(false);
  }

  onSedeChange(sedeId: string) {
    this.selectedSedeId.set(sedeId);
    if (!sedeId) { this.inventory.set([]); return; }
    this.loadingInv.set(true);
    this.http.get<Omit<InventoryRow,'returning'>[]>(`${API_URL}/seller/admin/inventory/${sedeId}`).subscribe({
      next: rows => {
        this.inventory.set(rows.map(r => ({ ...r, returning: 0 })));
        this.loadingInv.set(false);
      },
      error: () => this.loadingInv.set(false),
    });
  }

  setReturning(row: InventoryRow, qty: number) {
    const clamped = Math.max(0, Math.min(qty, row.quantity));
    this.inventory.update(list =>
      list.map(r => r.productId === row.productId && r.size === row.size
        ? { ...r, returning: clamped } : r)
    );
  }

  openConfirm() { this.confirmOpen.set(true); }
  closeConfirm() { this.confirmOpen.set(false); }

  submitReturn() {
    if (!this.canSubmit() || this.saving()) return;
    this.saving.set(true);
    const body = {
      sedeId: this.selectedSedeId(),
      notes: this.formNotes() || null,
      items: this.itemsToReturn().map(r => ({
        productId: r.productId,
        productName: r.productName,
        size: r.size,
        quantity: r.returning,
      })),
    };
    this.http.post<InventoryReturn>(`${API_URL}/seller/admin/returns`, body).subscribe({
      next: ret => {
        this.returns.update(list => [ret, ...list]);
        this.saving.set(false);
        this.closeForm();
      },
      error: () => this.saving.set(false),
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

  sedeName(sedeId: string) {
    return this.sedes().find(s => s.id === sedeId)?.name ?? sedeId;
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }

  formatDateShort(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short' }).format(new Date(iso));
  }
}
