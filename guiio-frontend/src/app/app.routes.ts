import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then(m => m.Home) },
  { path: 'catalogo', loadComponent: () => import('./pages/catalog/catalog').then(m => m.Catalog) },
  { path: 'catalogo/:gender', loadComponent: () => import('./pages/catalog/catalog').then(m => m.Catalog) },
  { path: 'producto/:id', loadComponent: () => import('./pages/product-detail/product-detail').then(m => m.ProductDetail) },
  { path: 'carrito', loadComponent: () => import('./pages/cart/cart').then(m => m.Cart) },
  { path: 'checkout', loadComponent: () => import('./pages/checkout/checkout').then(m => m.Checkout) },
  { path: 'contacto', loadComponent: () => import('./pages/contact/contact').then(m => m.Contact) },
  { path: 'pago/exitoso', loadComponent: () => import('./pages/payment-success/payment-success').then(m => m.PaymentSuccess) },
  { path: 'pago/fallido', loadComponent: () => import('./pages/payment-failure/payment-failure').then(m => m.PaymentFailure) },
  { path: 'pago/pendiente', loadComponent: () => import('./pages/payment-pending/payment-pending').then(m => m.PaymentPending) },
  { path: 'coleccion/:name', loadComponent: () => import('./pages/collection/collection').then(m => m.Collection) },
  { path: '**', redirectTo: '' },
];
