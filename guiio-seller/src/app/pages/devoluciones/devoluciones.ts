import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SellerApiService } from '../../services/seller-api';
import { Navbar } from '../../components/navbar/navbar';

interface InventoryRow {
  productId: string;
  productName: string;
  size: string;
  quantity: number;
  returning: number;
}

interface ReturnRecord {
  id: string;
  status: string;
  notes: string | null;
  createdAt: string;
  sede: { id: string; name: string };
  items: { productId: string; productName: string; size: string; quantity: number }[];
}

@Component({
  selector: 'app-devoluciones',
  templateUrl: './devoluciones.html',
  imports: [FormsModule, Navbar],
})
export class Devoluciones implements OnInit {
  private readonly api = inject(SellerApiService);

  protected returns     = signal<ReturnRecord[]>([]);
  protected inventory   = signal<InventoryRow[]>([]);
  protected loading     = signal(true);
  protected loadingInv  = signal(false);
  protected saving      = signal(false);
  protected showForm    = signal(false);
  protected formNotes   = signal('');

  protected itemsToReturn = computed(() =>
    this.inventory().filter(r => r.returning > 0)
  );

  protected canSubmit = computed(() => this.itemsToReturn().length > 0);

  ngOnInit() {
    this.loadHistory();
  }

  private loadHistory() {
    this.loading.set(true);
    this.api.getMyReturns().subscribe({
      next: list => { this.returns.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openForm() {
    this.showForm.set(true);
    this.formNotes.set('');
    this.loadingInv.set(true);
    this.api.getMyInventory().subscribe({
      next: rows => {
        this.inventory.set(rows.map(r => ({ ...r, returning: 0 })));
        this.loadingInv.set(false);
      },
      error: () => this.loadingInv.set(false),
    });
  }

  closeForm() { this.showForm.set(false); }

  setReturning(row: InventoryRow, qty: number) {
    const clamped = Math.max(0, Math.min(qty, row.quantity));
    this.inventory.update(list =>
      list.map(r => r.productId === row.productId && r.size === row.size
        ? { ...r, returning: clamped } : r)
    );
  }

  submit() {
    if (!this.canSubmit() || this.saving()) return;
    this.saving.set(true);
    this.api.createReturn({
      notes: this.formNotes() || undefined,
      items: this.itemsToReturn().map(r => ({
        productId: r.productId,
        productName: r.productName,
        size: r.size,
        quantity: r.returning,
      })),
    }).subscribe({
      next: ret => {
        this.returns.update(list => [ret, ...list]);
        this.saving.set(false);
        this.closeForm();
      },
      error: () => this.saving.set(false),
    });
  }

  formatDate(iso: string) {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  }
}
