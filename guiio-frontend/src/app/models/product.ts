export type ProductType = 'conjunto' | 'top' | 'bottom' | 'otro';

export interface Product {
  id: string;
  name: string;
  collection: string;
  price: number;
  description: string;
  images: string[];
  colors: ProductColor[];
  type: ProductType;
  topSizes: string[];
  bottomSizes: string[];
  gender: 'mujer' | 'hombre' | 'unisex';
  featured: boolean;
  inStock: boolean;
  tags: string[];
}

export interface ProductColor {
  name: string;
  hex: string;
  imageIndex?: number;
}
