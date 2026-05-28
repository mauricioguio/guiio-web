import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

const API_URL = 'https://guiio-web-production.up.railway.app/api';
const ADMIN_KEY = 'guiio-admin-key-2024';

export interface HeroButton {
  label: string;
  link: string;
  variant: 'primary' | 'outline';
}

export interface HeroSettings {
  backgroundImage: string | null;
  backgroundImageMobile: string | null;
  imagePosition: string | null;
  badge: string | null;
  title: string | null;
  subtitle: string | null;
  buttons: HeroButton[];
}

@Injectable({ providedIn: 'root' })
export class HeroApiService {
  private readonly http = inject(HttpClient);
  private readonly headers = new HttpHeaders({ 'X-Admin-Key': ADMIN_KEY });

  get() {
    return this.http.get<HeroSettings>(`${API_URL}/hero`);
  }

  update(data: Partial<HeroSettings>) {
    return this.http.patch<HeroSettings>(`${API_URL}/hero`, data, { headers: this.headers });
  }
}
