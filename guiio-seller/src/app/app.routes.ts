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
  {
    path: 'inventario',
    loadComponent: () => import('./pages/inventario/inventario').then(m => m.Inventario),
    canActivate: [authGuard],
  },
  {
    path: 'pedidos',
    loadComponent: () => import('./pages/pedidos/pedidos').then(m => m.Pedidos),
    canActivate: [authGuard],
  },
  {
    path: 'pedidos-online',
    loadComponent: () => import('./pages/pedidos-online/pedidos-online').then(m => m.PedidosOnline),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'pos' },
];
