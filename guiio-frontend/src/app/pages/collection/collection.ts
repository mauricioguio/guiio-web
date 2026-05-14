import { Component, inject, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../services/product';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  selector: 'app-collection',
  imports: [RouterLink, ProductCard],
  templateUrl: './collection.html',
})
export class Collection {
  private readonly productService = inject(ProductService);
  private readonly route = inject(ActivatedRoute);

  private readonly collectionName = toSignal(
    this.route.params.pipe(map(p => p['name'] as string))
  );

  protected readonly products = computed(() => {
    const name = this.collectionName();
    if (!name) return [];
    return this.productService.getAll()().filter(p => p.collection === name);
  });

  protected readonly spotlight = computed(() => {
    const p = this.products()[0];
    if (!p) return null;
    return { name: p.collection, description: p.description, image: p.images?.[0] ?? '' };
  });
}
