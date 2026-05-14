import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Sede } from './sedes-api';

const API_URL = 'https://guiio-backend.onrender.com/api';
const ADMIN_KEY = 'guiio-admin-key-2024';
const headers = { 'x-admin-key': ADMIN_KEY };

export interface InventoryItem {
  id: string;
  sedeId: string;
  productId: string;
  size: string;
  quantity: number;
  productName: string;
  sede: Sede;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<InventoryItem[]>(`${API_URL}/inventory`, { headers });
  }

  upsert(sedeId: string, productId: string, size: string, quantity: number) {
    return this.http.put<InventoryItem>(
      `${API_URL}/inventory`,
      { sedeId, productId, size, quantity },
      { headers },
    );
  }
}
