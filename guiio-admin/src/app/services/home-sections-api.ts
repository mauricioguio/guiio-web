import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

const API_URL = 'https://guiio-web-production.up.railway.app/api';
const ADMIN_KEY = 'guiio-admin-key-2024';

export interface HomeSectionsData {
  storyText: string | null;
  storyImage: string | null;
  galleryImages: string[];
}

@Injectable({ providedIn: 'root' })
export class HomeSectionsApiService {
  private readonly http = inject(HttpClient);
  private readonly headers = new HttpHeaders({ 'X-Admin-Key': ADMIN_KEY });

  get() {
    return this.http.get<HomeSectionsData>(`${API_URL}/home-sections`);
  }

  update(data: Partial<HomeSectionsData>) {
    return this.http.patch<HomeSectionsData>(`${API_URL}/home-sections`, data, { headers: this.headers });
  }
}
