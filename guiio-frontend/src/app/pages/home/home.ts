import { Component, inject, computed } from '@angular/core';
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

  protected readonly slugify = slugify;
  protected readonly cloudinaryUrl = cloudinaryUrl;
}
