import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth';
import { BrandService } from '../../services/brand';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
})
export class Navbar {
  protected readonly auth  = inject(AuthService);
  protected readonly brand = inject(BrandService);
  private  readonly router = inject(Router);

  protected menuOpen = signal(false);

  toggleMenu() { this.menuOpen.update(v => !v); }
  closeMenu()  { this.menuOpen.set(false); }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
