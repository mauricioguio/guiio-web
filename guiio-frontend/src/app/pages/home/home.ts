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

  protected readonly cycleIndex = signal(0);
  protected readonly fading = signal(false);

  constructor() {
    const id = setInterval(() => {
      this.fading.set(true);
      setTimeout(() => {
        this.cycleIndex.update(i => {
          const total = this.allProductImages().length;
          return total > 1 ? (i + 2) % total : 0;
        });
        this.fading.set(false);
      }, 400);
    }, 4000);
    this.destroyRef.onDestroy(() => clearInterval(id));
  }

  protected cycleImg(offset: number): string {
    const imgs = this.allProductImages();
    if (!imgs.length) return '';
    return imgs[(this.cycleIndex() + offset) % imgs.length];
  }

  protected readonly slugify = slugify;
  protected readonly cloudinaryUrl = cloudinaryUrl;
}
