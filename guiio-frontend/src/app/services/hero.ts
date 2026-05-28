import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://api.guiiouniformes.com/api';

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

const DEFAULT: HeroSettings = {
  backgroundImage: null,
  backgroundImageMobile: null,
  imagePosition: 'center center',
  badge: 'Uniformes médicos premium',
  title: 'Así como tú cuidas de ellos, nosotros cuidamos de ti',
  subtitle: 'Más de 18 años confeccionando uniformes de alta calidad para profesionales de la salud.',
  buttons: [
    { label: 'Colección Mujer', link: '/coleccion/mujer', variant: 'primary' },
    { label: 'Colección Hombre', link: '/coleccion/hombre', variant: 'outline' },
  ],
};

@Injectable({ providedIn: 'root' })
export class HeroService {
  private readonly http = inject(HttpClient);
  private readonly settings = signal<HeroSettings>(DEFAULT);

  constructor() {
    this.http.get<HeroSettings>(`${API_URL}/hero`).subscribe({
      next: data => this.settings.set(data),
    });
  }

  getSettings() {
    return this.settings.asReadonly();
  }
}
