import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  message: string;
}

@Component({
  selector: 'app-contact',
  imports: [FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class Contact {
  protected readonly form = signal<ContactForm>({ name: '', email: '', phone: '', message: '' });
  protected readonly submitted = signal(false);
  protected readonly loading = signal(false);

  updateField(field: keyof ContactForm, value: string) {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  submit() {
    const { name, email, message } = this.form();
    if (!name || !email || !message) return;

    this.loading.set(true);
    setTimeout(() => {
      this.loading.set(false);
      this.submitted.set(true);
      this.form.set({ name: '', email: '', phone: '', message: '' });
    }, 1000);
  }
}
