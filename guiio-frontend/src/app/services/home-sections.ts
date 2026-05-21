import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://guiio-web-production.up.railway.app/api';

export interface HomeSectionsData {
  storyText: string | null;
  storyImage: string | null;
  galleryImages: string[];
}

@Injectable({ providedIn: 'root' })
export class HomeSectionsService {
  private readonly http = inject(HttpClient);
  private readonly data = signal<HomeSectionsData>({ storyText: null, storyImage: null, galleryImages: [] });

  constructor() {
    this.http.get<HomeSectionsData>(`${API_URL}/home-sections`).subscribe({
      next: d => this.data.set({ ...d, galleryImages: ((d.galleryImages as any) ?? []) }),
    });
  }

  get() { return this.data.asReadonly(); }
}
