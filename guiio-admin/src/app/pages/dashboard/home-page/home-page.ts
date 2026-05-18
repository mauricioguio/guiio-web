import { Component, inject, signal, computed } from '@angular/core';
import { CollectionsApiService, Collection } from '../../../services/collections-api';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.html',
})
export class HomePage {
  private readonly api = inject(CollectionsApiService);

  protected collections = signal<Collection[]>([]);
  protected loading = signal(true);
  protected savingId = signal<string | null>(null);
  protected showPicker = signal(false);

  protected featured = computed(() =>
    this.collections().filter(c => c.featured).sort((a, b) => a.order - b.order)
  );

  protected available = computed(() =>
    this.collections().filter(c => !c.featured).sort((a, b) => a.order - b.order)
  );

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getAll().subscribe({
      next: list => { this.collections.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  addToFeatured(col: Collection) {
    const maxOrder = Math.max(0, ...this.featured().map(c => c.order));
    this.savingId.set(col.id);
    this.api.update(col.id, { ...col, featured: true, order: maxOrder + 1 }).subscribe({
      next: updated => {
        this.collections.update(list => list.map(c => c.id === col.id ? updated : c));
        this.savingId.set(null);
        this.showPicker.set(false);
      },
      error: () => this.savingId.set(null),
    });
  }

  removeFromFeatured(col: Collection) {
    this.savingId.set(col.id);
    this.api.update(col.id, { ...col, featured: false }).subscribe({
      next: updated => {
        this.collections.update(list => list.map(c => c.id === col.id ? updated : c));
        this.savingId.set(null);
      },
      error: () => this.savingId.set(null),
    });
  }

  moveUp(col: Collection) {
    const list = this.featured();
    const idx = list.findIndex(c => c.id === col.id);
    if (idx === 0) return;
    const prev = list[idx - 1];
    this.swapOrder(col, prev);
  }

  moveDown(col: Collection) {
    const list = this.featured();
    const idx = list.findIndex(c => c.id === col.id);
    if (idx === list.length - 1) return;
    const next = list[idx + 1];
    this.swapOrder(col, next);
  }

  private swapOrder(a: Collection, b: Collection) {
    const orderA = a.order;
    const orderB = b.order;
    this.savingId.set(a.id);
    this.api.update(a.id, { ...a, order: orderB }).subscribe({
      next: updatedA => {
        this.collections.update(list => list.map(c => c.id === a.id ? updatedA : c));
        this.api.update(b.id, { ...b, order: orderA }).subscribe({
          next: updatedB => {
            this.collections.update(list => list.map(c => c.id === b.id ? updatedB : c));
            this.savingId.set(null);
          },
        });
      },
      error: () => this.savingId.set(null),
    });
  }
}
