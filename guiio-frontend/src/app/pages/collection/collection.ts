import { Component, inject, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, map, startWith } from 'rxjs';
import { CollectionService, Collection as CollectionInfo } from '../../services/collection';
import { Product } from '../../models/product';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  selector: 'app-collection',
  imports: [RouterLink, ProductCard],
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
    return this.collectionService.getAll()().find(c => c.name === name) ?? null;
  });

  protected readonly products = toSignal(
    this.route.params.pipe(
      map(p => p['name'] as string),
      switchMap(name =>
        this.collectionService.getProductsByName(name).pipe(startWith([] as Product[]))
      )
    )
  );
}
