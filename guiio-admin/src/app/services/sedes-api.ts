import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

const API_URL = 'https://guiio-backend.onrender.com/api';
const ADMIN_KEY = 'guiio-admin-key-2024';
const headers = { 'x-admin-key': ADMIN_KEY };

export interface Sede {
  id: string;
  name: string;
  pin: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SedesApiService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<Sede[]>(`${API_URL}/sedes`);
  }

  create(name: string) {
    return this.http.post<Sede>(`${API_URL}/sedes`, { name }, { headers });
  }

  update(id: string, data: { name?: string; active?: boolean; pin?: string | null }) {
    return this.http.patch<Sede>(`${API_URL}/sedes/${id}`, data, { headers });
  }

  remove(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${API_URL}/sedes/${id}`, { headers });
  }
}
