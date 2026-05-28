import { Component, inject, signal, computed, effect, untracked } from '@angular/core';
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

// ── MUJER ── (medidas reales del cuerpo de la cliente)
const TOP_CHART_F: SizeChart = [
  { max: 79,  size: 'XXS'},
  { max: 85,  size: 'XS' },
  { max: 90,  size: 'S'  },
  { max: 95,  size: 'M'  },
  { max: 100, size: 'L'  },
  { max: 105, size: 'XL' },
  { max: 112, size: 'XXL'},
  { max: 9999,size: 'XXXL'},
];
const WAIST_TOP_CHART_F: SizeChart = [
  { max: 67,  size: 'XXS'},
  { max: 72,  size: 'XS' },
  { max: 78,  size: 'S'  },
  { max: 84,  size: 'M'  },
  { max: 91,  size: 'L'  },
  { max: 100, size: 'XL' },
  { max: 108, size: 'XXL'},
  { max: 9999,size: 'XXXL'},
];
const BOTTOM_CHART_F: SizeChart = [
  { max: 89,  size: 'XXS'},
  { max: 94,  size: 'XS' },
  { max: 99,  size: 'S'  },
  { max: 104, size: 'M'  },
  { max: 110, size: 'L'  },
  { max: 116, size: 'XL' },
  { max: 123, size: 'XXL'},
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

const SIZE_ORDER = ['XXS','XS','S','M','L','XL','XXL','XXXL'];

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
  protected readonly productService = inject(ProductService);
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
  protected showSizeCalc   = signal(false);
  protected calcBust       = signal<number | null>(null);
  protected calcHip        = signal<number | null>(null);
  protected calcWaist      = signal<number | null>(null);
  protected chatHistory    = signal<{ role: 'user' | 'model'; text: string }[]>([]);
  protected chatLoading    = signal(false);
  protected chatInputValue = '';
  protected fitPreference  = signal<'ajustado' | 'normal' | 'suelto' | null>(null);
  protected readonly fitOptions = [
    { value: 'ajustado' as const, label: '😊 Ajustado' },
    { value: 'normal'   as const, label: '👌 Normal'   },
    { value: 'suelto'   as const, label: '😌 Suelto'   },
  ];

  // Collections that offer all 3 fit options
  private readonly ALL_FIT_COLLECTIONS  = ['sofia', 'valentina', 'antonella'];
  // Collections that are always fitted (ajustado only)
  private readonly FITTED_COLLECTIONS   = ['luciana', 'isabella'];

  protected readonly availableFitOptions = computed(() => {
    const p = this.product();
    if (!p) return this.fitOptions;
    const col = (p.collection ?? '').toLowerCase();
    if (p.gender === 'hombre') {
      return [{ value: 'normal' as const, label: '👌 Normal' }];
    }
    if (this.FITTED_COLLECTIONS.some(c => col.includes(c))) {
      return [{ value: 'ajustado' as const, label: '😊 Ajustado' }];
    }
    if (this.ALL_FIT_COLLECTIONS.some(c => col.includes(c))) {
      return this.fitOptions;
    }
    // Default for other women's collections: all options
    return this.fitOptions;
  });

  private prefTimer: any    = null;
  private measureTimer: any = null;
  protected readonly aiErrored = signal(false);

  constructor() {
    // Re-call AI when fit preference changes (if advice already shown and no error)
    effect(() => {
      const fit = this.fitPreference();
      const hasHistory = untracked(() => this.chatHistory().length > 0);
      const loading    = untracked(() => this.chatLoading());
      const hasMeasure = untracked(() => !!(this.calcBust() || this.calcWaist() || this.calcHip()));
      const errored    = untracked(() => this.aiErrored());
      if (!fit || !hasHistory || loading || !hasMeasure || errored) return;
      clearTimeout(this.prefTimer);
      this.prefTimer = setTimeout(() => this.requestAiAdvice(), 400);
    });

    // Re-call AI when measurements change (debounced, only if advice already shown and no error)
    effect(() => {
      const bust  = this.calcBust();
      const waist = this.calcWaist();
      const hip   = this.calcHip();
      const fit        = untracked(() => this.fitPreference());
      const hasHistory = untracked(() => this.chatHistory().length > 0);
      const loading    = untracked(() => this.chatLoading());
      const errored    = untracked(() => this.aiErrored());
      if (!fit || !hasHistory || loading || errored || (!bust && !waist && !hip)) return;
      clearTimeout(this.measureTimer);
      this.measureTimer = setTimeout(() => this.requestAiAdvice(), 1500);
    });
  }

  private get isMale() { return this.product()?.gender === 'hombre'; }

  protected readonly calcBustSize = computed(() => {
    const v = this.calcBust();
    if (!v || v < 50 || v > 200) return null;
    return measurementToSize(v, this.isMale ? TOP_CHART_M : TOP_CHART_F);
  });

  protected readonly calcWaistSize = computed(() => {
    const v = this.calcWaist();
    if (!v || v < 50 || v > 200) return null;
    // Men's tops are boxy — waist uses same chart as chest
    return measurementToSize(v, this.isMale ? TOP_CHART_M : WAIST_TOP_CHART_F);
  });

  protected readonly calcHipSize = computed(() => {
    const v = this.calcHip();
    if (!v || v < 50 || v > 200) return null;
    return measurementToSize(v, this.isMale ? BOTTOM_CHART_M : BOTTOM_CHART_F);
  });

  protected readonly calcTopResult = computed(() => {
    const bust  = this.calcBust();
    const waist = this.calcWaist();
    const p = this.product();
    if (!p?.topSizes.length) return null;
    const bustChart  = this.isMale ? TOP_CHART_M : TOP_CHART_F;
    // Men's tops are boxy — waist and chest use the same chart
    const waistChart = this.isMale ? TOP_CHART_M : WAIST_TOP_CHART_F;
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
    this.chatHistory.set([]);
    this.chatInputValue = '';
    this.aiErrored.set(false);
    const opts = this.availableFitOptions();
    this.fitPreference.set(opts.length === 1 ? opts[0].value : null);
    this.showSizeCalc.set(true);
  }

  private callAdvice(history: { role: 'user' | 'model'; text: string }[]) {
    const p = this.product();
    if (!p) return;
    this.chatLoading.set(true);
    this.productService.getSizeAdvice({
      bust: this.calcBust(), waist: this.calcWaist(), hip: this.calcHip(),
      gender: p.gender, type: p.type, productName: p.name,
      topSizes: p.topSizes, bottomSizes: p.bottomSizes,
      fitPreference: this.fitPreference(),
      history,
    }).subscribe({
      next: ({ advice, isError }) => {
        this.aiErrored.set(!!isError);
        this.chatHistory.update(h => [...h, { role: 'model', text: advice }]);
        this.chatLoading.set(false);
      },
      error: () => {
        this.aiErrored.set(true);
        this.chatHistory.update(h => [...h, { role: 'model', text: 'No se pudo conectar. Intenta de nuevo.' }]);
        this.chatLoading.set(false);
      },
    });
  }

  requestAiAdvice() {
    this.aiErrored.set(false);
    this.chatHistory.set([]);
    this.callAdvice([]);
  }

  sendFollowUp() {
    const text = this.chatInputValue.trim();
    if (!text || this.chatLoading()) return;
    this.aiErrored.set(false);
    this.chatInputValue = '';
    const newHistory = [...this.chatHistory(), { role: 'user' as const, text }];
    this.chatHistory.set(newHistory);
    this.callAdvice(newHistory);
  }

  protected readonly contextTableRows = computed(() => {
    const rec = this.calcTopResult() ?? this.calcBottomResult();
    const isMale = this.product()?.gender === 'hombre';
    const all: string[][] = isMale ? [
      ['XS','≤88','≤88','≤88'],['S','89–94','89–94','89–94'],['M','95–100','95–100','95–100'],
      ['L','101–106','101–106','101–106'],['XL','107–112','107–112','107–112'],['XXL','113+','113+','113+'],
    ] : [
      ['XXS','75–79','63–67','85–89'],['XS','80–85','68–72','90–94'],['S','86–90','73–78','95–99'],['M','91–95','79–84','100–104'],
      ['L','96–100','85–91','105–110'],['XL','101–105','92–100','111–116'],['XXL','106–112','101–108','117+'],
    ];
    if (!rec) return all;
    const i = all.findIndex(r => r[0] === rec);
    if (i === -1) return all;
    return all.slice(Math.max(0, i - 1), Math.min(all.length, i + 2));
  });

  protected readonly highlightedSize = computed(() => this.calcTopResult() ?? this.calcBottomResult());

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
