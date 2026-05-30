import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }
}
