import { Injectable, signal, computed, effect } from '@angular/core';
import { CartItem } from '../models/cart-item';
import { Product, ProductColor } from '../models/product';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly items = signal<CartItem[]>(this.loadFromStorage());
  readonly isOpen = signal(false);

  readonly cartItems = this.items.asReadonly();

  readonly totalItems = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0)
  );

  readonly subtotal = computed(() =>
    this.items().reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  );

  readonly hasDiscount = computed(() => this.totalItems() >= 2);

  readonly discount = computed(() => {
    if (!this.hasDiscount()) return 0;
    const sorted = [...this.items()].sort((a, b) => a.product.price - b.product.price);
    return sorted[0].product.price * 0.2;
  });

  readonly shipping = computed(() => this.subtotal() >= 500000 ? 0 : 10000);

  readonly total = computed(() => this.subtotal() - this.discount() + this.shipping());

  constructor() {
    effect(() => {
      localStorage.setItem('guiio-cart', JSON.stringify(this.items()));
    });
  }

  private loadFromStorage(): CartItem[] {
    try {
      const saved = localStorage.getItem('guiio-cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  addItem(product: Product, color: ProductColor, topSize: string, bottomSize: string) {
    this.items.update(items => {
      const existing = items.find(
        i => i.product.id === product.id &&
             i.selectedColor.name === color.name &&
             i.selectedTopSize === topSize &&
             i.selectedBottomSize === bottomSize
      );
      if (existing) {
        return items.map(i => i === existing ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...items, { product, quantity: 1, selectedColor: color, selectedTopSize: topSize, selectedBottomSize: bottomSize }];
    });
    (window as any).fbq?.('track', 'AddToCart', {
      content_name: product.name,
      content_ids: [product.id],
      content_type: 'product',
      value: product.price,
      currency: 'COP',
    });
    this.isOpen.set(true);
  }

  removeItem(index: number) {
    this.items.update(items => items.filter((_, i) => i !== index));
  }

  updateQuantity(index: number, quantity: number) {
    if (quantity <= 0) {
      this.removeItem(index);
      return;
    }
    this.items.update(items =>
      items.map((item, i) => i === index ? { ...item, quantity } : item)
    );
  }

  clearCart() {
    this.items.set([]);
  }

  toggleCart() {
    this.isOpen.update(v => !v);
  }
}
