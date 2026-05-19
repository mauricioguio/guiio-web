import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ProductService } from '../../services/product';
import { CartService } from '../../services/cart';
import { ProductColor } from '../../models/product';

// Bust → top size (cm ranges)
const TOP_CHART: { max: number; size: string }[] = [
  { max: 82,  size: 'XS' },
  { max: 87,  size: 'S'  },
  { max: 92,  size: 'M'  },
  { max: 97,  size: 'L'  },
  { max: 102, size: 'XL' },
  { max: 107, size: 'XXL'},
  { max: 9999,size: 'XXXL'},
];

// Hip → bottom size (cm ranges)
const BOTTOM_CHART: { max: number; size: string }[] = [
  { max: 88,  size: 'XS' },
  { max: 93,  size: 'S'  },
  { max: 98,  size: 'M'  },
  { max: 103, size: 'L'  },
  { max: 108, size: 'XL' },
  { max: 113, size: 'XXL'},
  { max: 9999,size: 'XXXL'},
];

function measurementToSize(cm: number, chart: typeof TOP_CHART): string {
  return chart.find(r => cm <= r.max)?.size ?? chart[chart.length - 1].size;
}

function findClosest(recommended: string, available: string[]): string | null {
  if (!available.length) return null;
  const upper = recommended.toUpperCase();
  const exact = available.find(s => s.toUpperCase() === upper);
  if (exact) return exact;
  const order = ['XS','S','M','L','XL','XXL','XXXL'];
  const idx = order.indexOf(upper);
  if (idx === -1) return available[0];
  // search outward from recommended index
  for (let d = 1; d <= order.length; d++) {
    const up   = available.find(s => s.toUpperCase() === order[idx + d]);
    const down = available.find(s => s.toUpperCase() === order[idx - d]);
    if (up)   return up;
    if (down) return down;
  }
  return available[0];
}

@Component({
  selector: 'app-product-detail',
  imports: [CurrencyPipe, RouterLink, FormsModule],
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

  // Size calculator
  protected showSizeCalc = signal(false);
  protected calcBust = signal<number | null>(null);
  protected calcHip  = signal<number | null>(null);

  protected readonly calcTopResult = computed(() => {
    const bust = this.calcBust();
    const p = this.product();
    if (!bust || bust < 50 || bust > 200 || !p?.topSizes.length) return null;
    return findClosest(measurementToSize(bust, TOP_CHART), p.topSizes);
  });

  protected readonly calcBottomResult = computed(() => {
    const hip = this.calcHip();
    const p = this.product();
    if (!hip || hip < 50 || hip > 200 || !p?.bottomSizes.length) return null;
    return findClosest(measurementToSize(hip, BOTTOM_CHART), p.bottomSizes);
  });

  openCalc() {
    this.calcBust.set(null);
    this.calcHip.set(null);
    this.showSizeCalc.set(true);
  }

  applyCalcSizes() {
    const top = this.calcTopResult();
    const bot = this.calcBottomResult();
    if (top) this.selectedTopSize.set(top);
    if (bot) this.selectedBottomSize.set(bot);
    this.showSizeCalc.set(false);
  }

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
    this.cartService.addItem(product, color, this.selectedTopSize() ?? '', this.selectedBottomSize() ?? '');
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
