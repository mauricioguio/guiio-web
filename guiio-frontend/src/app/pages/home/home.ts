import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../services/product';
import { CollectionService } from '../../services/collection';
import { ProductCard } from '../../components/product-card/product-card';
import { slugify } from '../../utils/slugify';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly productService = inject(ProductService);
  private readonly collectionService = inject(CollectionService);

  protected readonly featured = computed(() =>
    this.productService.getAll()().filter(p => p.featured)
  );

  protected readonly collections = computed(() =>
    this.collectionService.getAll()().sort((a, b) => a.order - b.order)
  );

  protected readonly mainCollections = computed(() =>
    this.collectionService.getAll()()
      .filter(c => !['hombre', 'mujer'].includes(slugify(c.name)))
      .sort((a, b) => a.order - b.order)
  );

  protected readonly slugify = slugify;
}
