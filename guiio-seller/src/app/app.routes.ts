import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './services/auth';

const authGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login']);
};

export const routes: Routes = [
  { path: '', redirectTo: 'pos', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then(m => m.Login),
  },
  {
    path: 'pos',
    loadComponent: () => import('./pages/pos/pos').then(m => m.Pos),
    canActivate: [authGuard],
  },
  {
    path: 'ventas',
    loadComponent: () => import('./pages/sales/sales').then(m => m.Sales),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'pos' },
];
