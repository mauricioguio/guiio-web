import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, NavigationEnd } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { filter } from 'rxjs';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { CartSidebar } from './components/cart-sidebar/cart-sidebar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Navbar, Footer, CartSidebar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly router = inject(Router);
  private readonly http   = inject(HttpClient);
  protected readonly enProducto = signal(false);

  constructor() {
    // Detect Facebook ad traffic (fbclid = Meta click ID, utm_source = manual UTM)
    const params = new URLSearchParams(window.location.search);
    const isFbAd = params.has('fbclid') ||
      ['facebook', 'fb', 'instagram'].some(s => (params.get('utm_source') ?? '').toLowerCase().includes(s));
    if (isFbAd) sessionStorage.setItem('trafficSource', 'facebook');

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    ).subscribe(e => {
      this.enProducto.set(e.urlAfterRedirects.startsWith('/producto/'));
      (window as any).fbq?.('track', 'PageView');
      const source = sessionStorage.getItem('trafficSource') ?? undefined;
      this.http.post('https://api.guiiouniformes.com/api/track', {
        path: e.urlAfterRedirects,
        ...(source ? { source } : {}),
      }).subscribe({ error: () => null });
    });
  }
}
