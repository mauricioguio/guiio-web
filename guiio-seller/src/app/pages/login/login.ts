import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SellerApiService, Sede } from '../../services/seller-api';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
})
export class Login implements OnInit {
  private readonly api = inject(SellerApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected sedes = signal<Sede[]>([]);
  protected selectedSede = signal<Sede | null>(null);
  protected pin = signal('');
  protected loading = signal(false);
  protected error = signal('');

  ngOnInit() {
    if (this.auth.isLoggedIn()) { this.router.navigate(['/pos']); return; }
    this.api.getSedes().subscribe({ next: list => this.sedes.set(list) });
  }

  selectSede(sede: Sede) {
    this.selectedSede.set(sede);
    this.pin.set('');
    this.error.set('');
  }

  addDigit(d: string) {
    if (this.pin().length >= 6) return;
    this.pin.update(p => p + d);
  }

  deleteDigit() { this.pin.update(p => p.slice(0, -1)); }

  confirm() {
    const sede = this.selectedSede();
    const p = this.pin();
    if (!sede || !p) return;
    this.loading.set(true);
    this.error.set('');
    this.api.login(sede.id, p).subscribe({
      next: () => {
        this.auth.login({ sedeId: sede.id, sedeName: sede.name, pin: p });
        this.router.navigate(['/pos']);
      },
      error: () => { this.error.set('PIN incorrecto'); this.loading.set(false); },
    });
  }
}
