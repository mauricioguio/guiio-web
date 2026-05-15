import { Injectable, signal, computed } from '@angular/core';

export interface SellerSession {
  sedeId: string;
  sedeName: string;
  pin: string;
}

const SESSION_KEY = 'seller_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session = signal<SellerSession | null>(this.loadSession());

  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly currentSede = computed(() => this.session());

  private loadSession(): SellerSession | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  login(session: SellerSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.session.set(session);
  }

  logout() {
    localStorage.removeItem(SESSION_KEY);
    this.session.set(null);
  }
}
