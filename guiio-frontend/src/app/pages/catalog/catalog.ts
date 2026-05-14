import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ProductService } from '../../services/product';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  selector: 'app-catalog',
  imports: [ProductCard],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
})
export class Catalog {
  private readonly productService = inject(ProductService);
  private readonly route = inject(ActivatedRoute);

  private readonly routeGender = toSignal(
    this.route.params.pipe(map(p => p['gender'] as 'mujer' | 'hombre' | undefined))
  );

  protected readonly allProducts = this.productService.getAll();
  protected readonly collections = this.productService.getCollections();

  protected readonly selectedGender = signal<'mujer' | 'hombre' | 'todos'>('todos');
  protected readonly selectedCollection = signal<string>(
    this.route.snapshot.queryParams['coleccion'] ?? 'todas'
  );

  protected readonly filteredProducts = computed(() => {
    const gender = this.routeGender() ?? this.selectedGender();
    const collection = this.selectedCollection();
    return this.allProducts().filter(p => {
      const genderMatch = gender === 'todos' || p.gender === gender || p.gender === 'unisex';
      const collectionMatch = collection === 'todas' || p.collection === collection;
      return genderMatch && collectionMatch;
    });
  });

  protected readonly activeGender = computed(() => this.routeGender() ?? this.selectedGender());

  setGender(gender: 'mujer' | 'hombre' | 'todos') {
    this.selectedGender.set(gender);
  }

  setCollection(collection: string) {
    this.selectedCollection.set(collection);
  }
}
