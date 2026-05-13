import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';
import { CartSidebar } from './components/cart-sidebar/cart-sidebar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, CartSidebar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
