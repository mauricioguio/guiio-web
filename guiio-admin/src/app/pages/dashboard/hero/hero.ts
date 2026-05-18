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
  protected imagePosition = signal<string>('50% 50%');
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
        this.imagePosition.set(data.imagePosition ?? '50% 50%');
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
    this.cloudinary.uploadRaw(file).subscribe({
      next: url => { this.backgroundImage.set(url); this.uploadingImage.set(false); },
      error: () => this.uploadingImage.set(false),
    });
  }

  removeImage() {
    this.backgroundImage.set(null);
    this.imagePosition.set('50% 50%');
  }

  onFocalPointClick(event: MouseEvent) {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 100);
    this.imagePosition.set(`${x}% ${y}%`);
  }

  focalX() {
    return parseFloat(this.imagePosition().split(' ')[0]) ?? 50;
  }

  focalY() {
    return parseFloat(this.imagePosition().split(' ')[1]) ?? 50;
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
      imagePosition: this.imagePosition(),
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
