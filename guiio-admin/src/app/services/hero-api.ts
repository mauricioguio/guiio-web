import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://api.guiiouniformes.com/api';

export interface HeroButton { label: string; link: string; variant: 'primary' | 'outline'; }

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

  get() { return this.http.get<HeroSettings>(`${API_URL}/hero`); }
  update(data: Partial<HeroSettings>) { return this.http.patch<HeroSettings>(`${API_URL}/hero`, data); }
}
