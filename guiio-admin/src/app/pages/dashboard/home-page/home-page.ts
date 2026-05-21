import { Component, inject, signal, computed } from '@angular/core';
import { CollectionsApiService, Collection } from '../../../services/collections-api';
import { HomeSectionsApiService, HomeSectionsData } from '../../../services/home-sections-api';
import { CloudinaryService } from '../../../services/cloudinary';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.html',
})
export class HomePage {
  private readonly api = inject(CollectionsApiService);
  private readonly sectionsApi = inject(HomeSectionsApiService);
  private readonly cloudinary = inject(CloudinaryService);

  protected sections = signal<HomeSectionsData>({ storyText: null, storyImage: null, galleryImages: [] });
  protected savingSections = signal(false);
  protected uploadingStory = signal(false);
  protected uploadingGallery = signal(false);

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

  constructor() {
    this.load();
    this.sectionsApi.get().subscribe({ next: data => this.sections.set(data) });
  }

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

  uploadStoryImage(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingStory.set(true);
    this.cloudinary.upload(file).subscribe({
      next: (url: string) => {
        this.sections.update(s => ({ ...s, storyImage: url }));
        this.sectionsApi.update({ storyImage: url }).subscribe();
        this.uploadingStory.set(false);
      },
      error: () => this.uploadingStory.set(false),
    });
  }

  updateStoryText(text: string) {
    this.sections.update(s => ({ ...s, storyText: text }));
    this.sectionsApi.update({ storyText: text }).subscribe();
  }

  uploadGalleryImage(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (!files.length) return;
    this.uploadingGallery.set(true);
    let done = 0;
    files.forEach(file => {
      this.cloudinary.upload(file).subscribe({
        next: (url: string) => {
          this.sections.update(s => ({ ...s, galleryImages: [...s.galleryImages, url] }));
          this.sectionsApi.update({ galleryImages: [...this.sections().galleryImages] }).subscribe();
          done++;
          if (done === files.length) this.uploadingGallery.set(false);
        },
        error: () => { done++; if (done === files.length) this.uploadingGallery.set(false); },
      });
    });
  }

  removeGalleryImage(url: string) {
    const updated = this.sections().galleryImages.filter(i => i !== url);
    this.sections.update(s => ({ ...s, galleryImages: updated }));
    this.sectionsApi.update({ galleryImages: updated }).subscribe();
  }

  uploadGalleryAt(event: Event, index: number) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingGallery.set(true);
    this.cloudinary.upload(file).subscribe({
      next: (url: string) => {
        const imgs = [...this.sections().galleryImages];
        imgs[index] = url;
        this.sections.update(s => ({ ...s, galleryImages: imgs }));
        this.sectionsApi.update({ galleryImages: imgs }).subscribe();
        this.uploadingGallery.set(false);
      },
      error: () => this.uploadingGallery.set(false),
    });
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
