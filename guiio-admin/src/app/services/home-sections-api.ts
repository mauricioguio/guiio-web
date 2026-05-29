import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';

const API_URL = 'https://guiio-web-production.up.railway.app/api';

export interface HomeSectionsData {
  storyText: string | null;
  storyImage: string | null;
  galleryImages: string[];
}

@Injectable({ providedIn: 'root' })
export class HomeSectionsApiService {
  private readonly http = inject(HttpClient);

  get() {
    return this.http.get<HomeSectionsData>(`${API_URL}/home-sections`).pipe(
      map(d => ({ ...d, galleryImages: (d.galleryImages ?? []) as string[] }))
    );
  }

  update(data: Partial<HomeSectionsData>) {
    return this.http.patch<HomeSectionsData>(`${API_URL}/home-sections`, data);
  }
}
