import { Component, inject, computed, signal, DestroyRef, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { ProductService } from '../../services/product';
import { CollectionService } from '../../services/collection';
import { HeroService } from '../../services/hero';
import { HomeSectionsService } from '../../services/home-sections';
import { ProductCard } from '../../components/product-card/product-card';
import { slugify } from '../../utils/slugify';
import { cloudinaryUrl } from '../../utils/cloudinary';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard, NgClass],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly productService = inject(ProductService);
  private readonly collectionService = inject(CollectionService);
  private readonly heroService = inject(HeroService);
  private readonly homeSectionsService = inject(HomeSectionsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly hero        = this.heroService.getSettings();
  protected readonly heroLoading = this.heroService.getLoading();
  protected readonly sections = this.homeSectionsService.get();

  protected readonly loading = computed(() =>
    this.productService.getLoading()() || this.collectionService.getLoading()()
  );

  protected readonly featured = computed(() =>
    this.productService.getAll()().filter(p => p.featured)
  );

  protected readonly collections = computed(() =>
    this.collectionService.getAll()().sort((a, b) => a.order - b.order)
  );

  protected readonly featuredCollections = computed(() =>
    this.collectionService.getAll()()
      .filter(c => c.featured)
      .sort((a, b) => a.order - b.order)
  );

  protected readonly mainCollections = computed(() =>
    this.collectionService.getAll()()
      .filter(c => !c.featured)
      .sort((a, b) => a.order - b.order)
  );

  private readonly allProductImages = computed(() =>
    this.productService.getAll()()
      .filter(p => p.images?.length)
      .map(p => (p.images as string[])[0])
  );

  private readonly firstImageByCollection = computed(() => {
    const map = new Map<string, string[]>();
    for (const p of this.productService.getAll()()) {
      if (p.images?.length) {
        const key = p.collection.toLowerCase();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push((p.images as string[])[0]);
      }
    }
    return map;
  });

  protected readonly newIn = computed(() =>
    [...this.productService.getAll()()]
      .filter(p => p.images?.length)
      .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
      .slice(0, 10)
  );

  protected newInIndex   = signal(0);
  protected newInPerView = signal(typeof window !== 'undefined' && window.innerWidth < 768 ? 2 : 3);

  protected readonly newInMaxIndex = computed(() =>
    Math.max(0, this.newIn().length - this.newInPerView())
  );

  protected readonly newInDots = computed(() =>
    Array.from({ length: this.newInMaxIndex() + 1 })
  );

  @HostListener('window:resize')
  onResize() {
    this.newInPerView.set(window.innerWidth < 768 ? 2 : 3);
    this.newInIndex.update(i => Math.min(i, this.newInMaxIndex()));
  }

  protected readonly cycleIndex    = signal(0);
  protected readonly fading        = signal(false);
  protected readonly colCycleIndex = signal(0);
  protected readonly colFading     = signal(false);

  constructor() {
    const fade = (fadingSignal: ReturnType<typeof signal<boolean>>, indexSignal: ReturnType<typeof signal<number>>, getTotal: () => number) => {
      fadingSignal.set(true);
      setTimeout(() => {
        indexSignal.update(i => { const t = getTotal(); return t > 1 ? (i + 1) % t : 0; });
        fadingSignal.set(false);
      }, 350);
    };

    const id    = setInterval(() => fade(this.fading,    this.cycleIndex,    () => this.allProductImages().length), 5000);
    const colId = setInterval(() => fade(this.colFading, this.colCycleIndex, () => {
      return Math.max(...[...this.firstImageByCollection().values()].map(v => v.length), 1);
    }), 5000);

    const niId = setInterval(() => {
      this.newInIndex.update(i => i >= this.newInMaxIndex() ? 0 : i + 1);
    }, 3500);

    this.destroyRef.onDestroy(() => { clearInterval(id); clearInterval(colId); clearInterval(niId); });
  }

  protected colImg(colName: string): string {
    const imgs = this.firstImageByCollection().get(colName.toLowerCase());
    if (!imgs?.length) return '';
    return imgs[this.colCycleIndex() % imgs.length];
  }

  protected cycleImg(slot: number): string {
    const imgs = this.allProductImages();
    if (!imgs.length) return '';
    const half = Math.max(1, Math.floor(imgs.length / 2));
    return imgs[(this.cycleIndex() + slot * half) % imgs.length];
  }

  protected formatPrice(p: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p);
  }

  protected readonly slugify = slugify;
  protected readonly cloudinaryUrl = cloudinaryUrl;
}
