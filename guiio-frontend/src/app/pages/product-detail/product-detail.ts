import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ProductService } from '../../services/product';
import { CartService } from '../../services/cart';
import { ProductColor } from '../../models/product';

@Component({
  selector: 'app-product-detail',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetail {
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly route = inject(ActivatedRoute);

  private readonly productId = toSignal(this.route.params.pipe(map(p => p['id'] as string)));
  protected readonly product = computed(() => this.productService.getById(this.productId() ?? '')());

  protected readonly selectedColor = signal<ProductColor | null>(null);
  protected readonly selectedTopSize = signal<string | null>(null);
  protected readonly selectedBottomSize = signal<string | null>(null);
  protected readonly selectedImageIndex = signal(0);
  protected readonly added = signal(false);

  selectImage(index: number) { this.selectedImageIndex.set(index); }
  selectColor(color: ProductColor) { this.selectedColor.set(color); }
  selectTopSize(size: string) { this.selectedTopSize.set(size); }
  selectBottomSize(size: string) { this.selectedBottomSize.set(size); }

  get canAddToCart(): boolean {
    const p = this.product();
    if (!p?.inStock) return false;
    switch (p.type) {
      case 'conjunto': return !!this.selectedTopSize() && !!this.selectedBottomSize();
      case 'top':      return !!this.selectedTopSize();
      case 'bottom':   return !!this.selectedBottomSize();
      case 'otro':     return p.topSizes.length === 0 || !!this.selectedTopSize();
    }
  }

  addToCart() {
    const product = this.product();
    if (!product || !this.canAddToCart) return;

    const color = this.selectedColor() ?? product.colors[0] ?? { name: '', hex: '' };
    const topSize = this.selectedTopSize() ?? '';
    const bottomSize = this.selectedBottomSize() ?? '';

    this.cartService.addItem(product, color, topSize, bottomSize);
    this.added.set(true);
    setTimeout(() => this.added.set(false), 2000);
  }

  get buttonLabel(): string {
    const p = this.product();
    if (!p) return '';
    if (!p.inStock) return 'Agotado';
    if (this.added()) return '✓ Agregado al carrito';
    switch (p.type) {
      case 'conjunto':
        if (!this.selectedTopSize()) return 'Selecciona primero la talla de la blusa';
        if (!this.selectedBottomSize()) return 'Selecciona la talla del pantalón';
        break;
      case 'top':
        if (!this.selectedTopSize()) return 'Selecciona la talla';
        break;
      case 'bottom':
        if (!this.selectedBottomSize()) return 'Selecciona la talla';
        break;
      case 'otro':
        if (p.topSizes.length > 0 && !this.selectedTopSize()) return 'Selecciona la talla';
        break;
    }
    return 'Agregar al carrito';
  }
}
