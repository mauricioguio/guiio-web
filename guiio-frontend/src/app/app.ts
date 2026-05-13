import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { CartSidebar } from './components/cart-sidebar/cart-sidebar';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, CartSidebar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private readonly router = inject(Router);

  protected readonly isAdmin = toSignal(
    this.router.events.pipe(map(() => this.router.url.startsWith('/admin'))),
    { initialValue: this.router.url.startsWith('/admin') }
  );
}
