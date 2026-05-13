import { Injectable, signal, computed } from '@angular/core';

export type UserRole = 'admin' | 'vendedor';

export interface AppUser {
  id: string;
  username: string;
  password: string;
  role: UserRole;
}

const USERS_KEY = 'guiio-admin-users';
const SESSION_KEY = 'guiio-admin-session';

const DEFAULT_ADMIN: AppUser = {
  id: 'admin-default',
  username: 'admin',
  password: 'guiio2024*',
  role: 'admin',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _currentUser = signal<AppUser | null>(this.loadSession());

  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoggedIn = computed(() => this._currentUser() !== null);
  readonly isAdmin = computed(() => this._currentUser()?.role === 'admin');

  private loadSession(): AppUser | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.id && parsed.role) {
        return parsed as AppUser;
      }
      localStorage.removeItem(SESSION_KEY);
      return null;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  private getUsers(): AppUser[] {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      const stored: AppUser[] = raw ? JSON.parse(raw) : [];
      const hasAdmin = stored.some(u => u.id === DEFAULT_ADMIN.id);
      return hasAdmin ? stored : [DEFAULT_ADMIN, ...stored];
    } catch {
      return [DEFAULT_ADMIN];
    }
  }

  private saveUsers(users: AppUser[]) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  login(username: string, password: string): boolean {
    const user = this.getUsers().find(u => u.username === username && u.password === password);
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      this._currentUser.set(user);
      return true;
    }
    return false;
  }

  logout() {
    localStorage.removeItem(SESSION_KEY);
    this._currentUser.set(null);
  }

  getVendedores(): AppUser[] {
    return this.getUsers().filter(u => u.role === 'vendedor');
  }

  createVendedor(username: string, password: string): { ok: boolean; error?: string } {
    const users = this.getUsers();
    if (users.some(u => u.username === username)) {
      return { ok: false, error: 'El usuario ya existe' };
    }
    const newUser: AppUser = {
      id: Date.now().toString(),
      username,
      password,
      role: 'vendedor',
    };
    this.saveUsers([...users, newUser]);
    return { ok: true };
  }

  deleteVendedor(id: string) {
    const users = this.getUsers().filter(u => u.id !== id);
    this.saveUsers(users);
  }

  changePassword(id: string, newPassword: string) {
    const users = this.getUsers().map(u => u.id === id ? { ...u, password: newPassword } : u);
    this.saveUsers(users);
    const current = this._currentUser();
    if (current?.id === id) {
      const updated = { ...current, password: newPassword };
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      this._currentUser.set(updated);
    }
  }
}
