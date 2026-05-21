import { Component, inject, computed, signal, DestroyRef } from '@angular/core';
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

  protected readonly hero = this.heroService.getSettings();
  protected readonly sections = this.homeSectionsService.get();

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
      .flatMap(p => p.images as string[])
  );

  private readonly imagesByCollection = computed(() => {
    const map = new Map<string, string[]>();
    for (const p of this.productService.getAll()()) {
      if (p.images?.length) {
        const key = p.collection.toLowerCase();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(...(p.images as string[]));
      }
    }
    return map;
  });

  protected readonly cycleIndex = signal(0);
  protected readonly fading = signal(false);
  protected readonly colCycleIndex = signal(0);
  protected readonly colFading = signal(false);

  constructor() {
    const id = setInterval(() => {
      this.fading.set(true);
      setTimeout(() => {
        this.cycleIndex.update(i => {
          const total = this.allProductImages().length;
          return total > 1 ? (i + 2) % total : 0;
        });
        this.fading.set(false);
      }, 800);
    }, 5000);

    const colId = setInterval(() => {
      this.colFading.set(true);
      setTimeout(() => {
        this.colCycleIndex.update(i => i + 1);
        this.colFading.set(false);
      }, 800);
    }, 5000);

    this.destroyRef.onDestroy(() => { clearInterval(id); clearInterval(colId); });
  }

  protected cycleImg(offset: number): string {
    const imgs = this.allProductImages();
    if (!imgs.length) return '';
    return imgs[(this.cycleIndex() + offset) % imgs.length];
  }

  protected colImg(colName: string, offset = 0): string {
    const name = colName.toLowerCase();
    if (name === 'hombre' || name === 'mujer') return '';
    const imgs = this.imagesByCollection().get(name);
    if (!imgs?.length) return '';
    return imgs[(this.colCycleIndex() + offset) % imgs.length];
  }

  protected readonly slugify = slugify;
  protected readonly cloudinaryUrl = cloudinaryUrl;
}
