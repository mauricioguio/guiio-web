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

  selectImage(index: number) {
    this.selectedImageIndex.set(index);
  }

  selectColor(color: ProductColor) {
    this.selectedColor.set(color);
  }

  selectTopSize(size: string) {
    this.selectedTopSize.set(size);
  }

  selectBottomSize(size: string) {
    this.selectedBottomSize.set(size);
  }

  addToCart() {
    const product = this.product();
    const color = this.selectedColor() ?? product?.colors[0];
    const topSize = this.selectedTopSize();
    const bottomSize = this.selectedBottomSize();
    if (!product || !color || !topSize || !bottomSize) return;

    this.cartService.addItem(product, color, topSize, bottomSize);
    this.added.set(true);
    setTimeout(() => this.added.set(false), 2000);
  }

  get canAddToCart() {
    return this.product()?.inStock && this.selectedTopSize() !== null && this.selectedBottomSize() !== null;
  }
}
