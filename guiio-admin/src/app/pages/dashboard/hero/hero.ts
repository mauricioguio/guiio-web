import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HeroApiService, HeroButton, HeroSettings } from '../../../services/hero-api';
import { CloudinaryService } from '../../../services/cloudinary';

@Component({
  selector: 'app-hero',
  templateUrl: './hero.html',
  imports: [FormsModule],
})
export class HeroPage {
  private readonly api = inject(HeroApiService);
  private readonly cloudinary = inject(CloudinaryService);

  protected loading = signal(true);
  protected saving = signal(false);
  protected uploadingImage = signal(false);
  protected saved = signal(false);

  protected backgroundImage = signal<string | null>(null);
  protected badge = signal<string>('');
  protected badgeEnabled = signal(true);
  protected title = signal<string>('');
  protected titleEnabled = signal(true);
  protected subtitle = signal<string>('');
  protected subtitleEnabled = signal(true);
  protected buttons = signal<HeroButton[]>([]);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.get().subscribe({
      next: (data) => {
        this.backgroundImage.set(data.backgroundImage);
        this.badge.set(data.badge ?? '');
        this.badgeEnabled.set(!!data.badge);
        this.title.set(data.title ?? '');
        this.titleEnabled.set(!!data.title);
        this.subtitle.set(data.subtitle ?? '');
        this.subtitleEnabled.set(!!data.subtitle);
        this.buttons.set(data.buttons ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onImagePick(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploadingImage.set(true);
    this.cloudinary.upload(file).subscribe({
      next: url => { this.backgroundImage.set(url); this.uploadingImage.set(false); },
      error: () => this.uploadingImage.set(false),
    });
  }

  removeImage() {
    this.backgroundImage.set(null);
  }

  addButton() {
    this.buttons.update(list => [...list, { label: '', link: '', variant: 'primary' }]);
  }

  removeButton(index: number) {
    this.buttons.update(list => list.filter((_, i) => i !== index));
  }

  updateButton(index: number, field: keyof HeroButton, value: string) {
    this.buttons.update(list =>
      list.map((btn, i) => i === index ? { ...btn, [field]: value } : btn)
    );
  }

  save() {
    this.saving.set(true);
    const payload: Partial<HeroSettings> = {
      backgroundImage: this.backgroundImage(),
      badge: this.badgeEnabled() ? (this.badge() || null) : null,
      title: this.titleEnabled() ? (this.title() || null) : null,
      subtitle: this.subtitleEnabled() ? (this.subtitle() || null) : null,
      buttons: this.buttons().filter(b => b.label && b.link),
    };
    this.api.update(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2500);
      },
      error: () => this.saving.set(false),
    });
  }
}
