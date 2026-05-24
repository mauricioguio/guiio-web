import { Component, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ProductService } from '../../services/product';
import { CartService } from '../../services/cart';
import { ProductColor } from '../../models/product';
import { ProductCard } from '../../components/product-card/product-card';

type SizeChart = { max: number; size: string }[];

// ── MUJER ──
// Blusa: intervalos de 4cm entre tallas
const TOP_CHART_F: SizeChart = [
  { max: 87,  size: 'XS' },
  { max: 92,  size: 'S'  },
  { max: 97,  size: 'M'  },
  { max: 102, size: 'L'  },
  { max: 107, size: 'XL' },
  { max: 112, size: 'XXL'},
  { max: 9999,size: 'XXXL'},
];
// Cintura blusa: busto - 8cm (corte semi-entallado), intervalos de 4cm
const WAIST_TOP_CHART_F: SizeChart = [
  { max: 79,  size: 'XS' },
  { max: 84,  size: 'S'  },
  { max: 89,  size: 'M'  },
  { max: 94,  size: 'L'  },
  { max: 99,  size: 'XL' },
  { max: 104, size: 'XXL'},
  { max: 9999,size: 'XXXL'},
];
// Cintura pantalón: intervalos de 5cm
const WAIST_CHART_F: SizeChart = [
  { max: 77,  size: 'XS' },
  { max: 83,  size: 'S'  },
  { max: 89,  size: 'M'  },
  { max: 95,  size: 'L'  },
  { max: 101, size: 'XL' },
  { max: 107, size: 'XXL'},
  { max: 9999,size: 'XXXL'},
];
const BOTTOM_CHART_F: SizeChart = [
  { max: 93,  size: 'XS' },
  { max: 97,  size: 'S'  },
  { max: 101, size: 'M'  },
  { max: 105, size: 'L'  },
  { max: 109, size: 'XL' },
  { max: 113, size: 'XXL'},
  { max: 9999,size: 'XXXL'},
];

// ── HOMBRE ──
const TOP_CHART_M: SizeChart = [
  { max: 88,  size: 'XS' },
  { max: 94,  size: 'S'  },
  { max: 100, size: 'M'  },
  { max: 106, size: 'L'  },
  { max: 112, size: 'XL' },
  { max: 118, size: 'XXL'},
  { max: 9999,size: 'XXXL'},
];
const WAIST_CHART_M: SizeChart = [
  { max: 76,  size: 'XS' },
  { max: 82,  size: 'S'  },
  { max: 88,  size: 'M'  },
  { max: 94,  size: 'L'  },
  { max: 100, size: 'XL' },
  { max: 106, size: 'XXL'},
  { max: 9999,size: 'XXXL'},
];
const BOTTOM_CHART_M: SizeChart = [
  { max: 88,  size: 'XS' },
  { max: 94,  size: 'S'  },
  { max: 100, size: 'M'  },
  { max: 106, size: 'L'  },
  { max: 112, size: 'XL' },
  { max: 118, size: 'XXL'},
  { max: 9999,size: 'XXXL'},
];

const SIZE_ORDER = ['XS','S','M','L','XL','XXL','XXXL'];

function largerSize(a: string, b: string): string {
  return SIZE_ORDER.indexOf(a.toUpperCase()) >= SIZE_ORDER.indexOf(b.toUpperCase()) ? a : b;
}

function measurementToSize(cm: number, chart: SizeChart): string {
  return chart.find(r => cm <= r.max)?.size ?? chart[chart.length - 1].size;
}

function findClosest(recommended: string, available: string[]): string | null {
  if (!available.length) return null;
  const upper = recommended.toUpperCase();
  const exact = available.find(s => s.toUpperCase() === upper);
  if (exact) return exact;
  const order = SIZE_ORDER;
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
  imports: [CurrencyPipe, RouterLink, FormsModule, ProductCard],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss',
})
export class ProductDetail {
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly route = inject(ActivatedRoute);

  private readonly productId = toSignal(this.route.params.pipe(map(p => p['id'] as string)));
  protected readonly product = computed(() => this.productService.getById(this.productId() ?? '')());
  protected readonly loading = this.productService.getLoading();

  protected readonly sameCollectionWithPhotos = computed(() => {
    const p = this.product();
    if (!p) return [];
    return this.productService.getAll()()
      .filter(x => x.id !== p.id && x.collection === p.collection && x.images?.length > 0);
  });

  protected readonly sameCollectionWithoutPhotos = computed(() => {
    const p = this.product();
    if (!p) return [];
    return this.productService.getAll()()
      .filter(x => x.id !== p.id && x.collection === p.collection && !(x.images?.length > 0));
  });

  protected readonly otherReferences = computed(() => {
    const p = this.product();
    if (!p) return [];
    return this.productService.getAll()()
      .filter(x =>
        x.id !== p.id &&
        x.collection !== p.collection &&
        x.images?.length > 0 &&
        (p.gender === 'unisex' || x.gender === p.gender || x.gender === 'unisex')
      );
  });

  protected readonly selectedColor = signal<ProductColor | null>(null);
  protected readonly selectedTopSize = signal<string | null>(null);
  protected readonly selectedBottomSize = signal<string | null>(null);
  protected readonly selectedImageIndex = signal(0);
  protected readonly added = signal(false);

  // Size calculator
  protected showSizeCalc = signal(false);
  protected calcBust  = signal<number | null>(null);
  protected calcHip   = signal<number | null>(null);
  protected calcWaist = signal<number | null>(null);

  private get isMale() { return this.product()?.gender === 'hombre'; }

  protected readonly calcTopResult = computed(() => {
    const bust  = this.calcBust();
    const waist = this.calcWaist();
    const p = this.product();
    if (!p?.topSizes.length) return null;
    const bustChart  = this.isMale ? TOP_CHART_M    : TOP_CHART_F;
    const waistChart = this.isMale ? TOP_CHART_M    : WAIST_TOP_CHART_F;
    const bustSize  = bust  && bust  > 50 && bust  < 200 ? measurementToSize(bust,  bustChart)  : null;
    const waistSize = waist && waist > 50 && waist < 200 ? measurementToSize(waist, waistChart) : null;
    if (!bustSize && !waistSize) return null;
    const recommended = bustSize && waistSize ? largerSize(bustSize, waistSize) : (bustSize ?? waistSize!);
    return findClosest(recommended, p.topSizes);
  });

  protected readonly calcBottomResult = computed(() => {
    const hip   = this.calcHip();
    const waist = this.calcWaist();
    const p = this.product();
    if (!p?.bottomSizes.length) return null;
    // Tanto hombre como mujer: el pantalón se basa solo en cadera
    const chart = this.isMale ? BOTTOM_CHART_M : BOTTOM_CHART_F;
    if (!hip || hip < 50 || hip > 200) return null;
    return findClosest(measurementToSize(hip, chart), p.bottomSizes);
  });

  openCalc() {
    this.calcBust.set(null);
    this.calcHip.set(null);
    this.calcWaist.set(null);
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
