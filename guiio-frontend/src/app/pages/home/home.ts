import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../services/product';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  selector: 'app-home',
  imports: [RouterLink, ProductCard],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly productService = inject(ProductService);
  private readonly allProducts = this.productService.getAll();

  protected readonly featured = computed(() =>
    this.allProducts().filter(p => p.featured)
  );

  protected readonly collectionSpotlights = computed(() => {
    const seen = new Map<string, { name: string; description: string; image: string }>();
    for (const p of this.allProducts()) {
      if (!seen.has(p.collection)) {
        seen.set(p.collection, {
          name: p.collection,
          description: p.description,
          image: p.images?.[0] ?? '',
        });
      } else if (!seen.get(p.collection)!.image && p.images?.[0]) {
        seen.set(p.collection, { ...seen.get(p.collection)!, image: p.images[0] });
      }
    }
    return [...seen.values()];
  });
}
