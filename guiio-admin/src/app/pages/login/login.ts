import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  @ViewChild('usernameInput') usernameInput!: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') passwordInput!: ElementRef<HTMLInputElement>;

  protected readonly error = signal(false);
  protected readonly loading = signal(false);
  protected showPassword = false;

  protected readonly form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  async submit() {
    const u = this.usernameInput.nativeElement.value;
    const p = this.passwordInput.nativeElement.value;
    if (u) this.form.controls.username.setValue(u);
    if (p) this.form.controls.password.setValue(p);
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set(false);

    const { username, password } = this.form.value;
    const ok = await this.auth.login(username!, password!);

    if (ok) {
      this.router.navigate(['/dashboard']);
    } else {
      this.error.set(true);
      this.loading.set(false);
    }
  }
}
