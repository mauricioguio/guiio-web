import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class BrandService {
  readonly empresa: string;
  readonly nombre: string;

  constructor() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('dimag')) {
      this.empresa = 'DIMAG';
      this.nombre  = 'Dimag';
    } else {
      this.empresa = 'GUIIO';
      this.nombre  = 'Guiio';
    }
  }
}
