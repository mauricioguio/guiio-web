import { Component, inject, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map } from 'rxjs';
import { CollectionService, Collection as CollectionInfo } from '../../services/collection';
import { Product } from '../../models/product';
import { ProductCard } from '../../components/product-card/product-card';
import { slugify } from '../../utils/slugify';

@Component({
  selector: 'app-collection',
  imports: [RouterLink, ProductCard, CurrencyPipe],
  templateUrl: './collection.html',
})
export class Collection {
  private readonly route = inject(ActivatedRoute);
  private readonly collectionService = inject(CollectionService);

  private readonly collectionName = toSignal(
    this.route.params.pipe(map(p => p['name'] as string))
  );

  protected readonly collectionInfo = computed<CollectionInfo | null>(() => {
    const name = this.collectionName();
    if (!name) return null;
    return this.collectionService.getAll()().find(c => slugify(c.name) === slugify(name)) ?? null;
  });

  protected readonly products = toSignal(
    this.route.params.pipe(
      map(p => p['name'] as string),
      switchMap(name =>
        this.collectionService.getProductsByName(name)
      )
    )
  );

  protected readonly withPhotos = computed(() =>
    (this.products() ?? []).filter(p => p.images.some(i => i))
  );

  protected readonly withoutPhotos = computed(() =>
    (this.products() ?? []).filter(p => !p.images.some(i => i))
  );
}
