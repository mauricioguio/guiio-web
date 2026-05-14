import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Product } from '../models/product';

const API_URL = 'https://guiio-backend.onrender.com/api';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly products = signal<Product[]>(MOCK_PRODUCTS);

  constructor() {
    this.http.get<Product[]>(`${API_URL}/products`).subscribe({
      next: list => { this.products.set(list); },
    });
  }

  getAll() {
    return this.products.asReadonly();
  }

  getFeatured() {
    return computed(() => this.products().filter(p => p.featured));
  }

  getByGender(gender: 'mujer' | 'hombre') {
    return computed(() => this.products().filter(p => p.gender === gender || p.gender === 'unisex'));
  }

  getByCollection(collection: string) {
    return computed(() => this.products().filter(p => p.collection === collection));
  }

  getById(id: string) {
    return computed(() => this.products().find(p => p.id === id));
  }

  getCollections() {
    return computed(() => [...new Set(this.products().map(p => p.collection))]);
  }

  getCollectionSpotlights() {
    return computed(() => {
      const seen = new Map<string, { name: string; description: string; image: string }>();
      for (const p of this.products()) {
        if (!seen.has(p.collection)) {
          seen.set(p.collection, {
            name: p.collection,
            description: p.description,
            image: p.images?.[0] ?? '',
          });
        } else if (!seen.get(p.collection)!.image && p.images?.[0]) {
          seen.set(p.collection, { ...seen.get(p.collection)!, image: p.images[0] });
        }
      }
      return [...seen.values()];
    });
  }
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'luciana-negro',
    name: 'Scrub Luciana Negro',
    collection: 'Luciana',
    type: 'conjunto',
    price: 190000,
    description: 'Scrub femenino con acabado anti-fluidos, diseño elegante y funcional ideal para profesionales de la salud.',
    images: [
      '/assets/img/products/santiago/verde-petroleo-4.png',
      '/assets/img/products/santiago/verde-militar-1.png',
      '/assets/img/products/santiago/azul-cielo-1.png',
      '/assets/img/products/santiago/Berengena-1-1.png',
    ],
    colors: [
      { name: 'Negro', hex: '#1a1a1a' },
      { name: 'Azul Marino', hex: '#1e3a5f' },
      { name: 'Gris', hex: '#6b7280' },
    ],
    topSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    bottomSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    gender: 'mujer',
    featured: true,
    inStock: true,
    tags: ['anti-fluidos', 'elegante'],
  },
  {
    id: 'isabella-azul-turquesa',
    name: 'Scrub Isabella Azul Turquesa',
    collection: 'Isabella',
    type: 'conjunto',
    price: 185000,
    description: 'Scrub femenino que combina elegancia y comodidad, con cortes favorecedores y tela suave de alta calidad.',
    images: [
      '/assets/img/products/santiago/azul-cielo-1.png',
      '/assets/img/products/santiago/verde-petroleo-4.png',
      '/assets/img/products/santiago/Berengena-1-1.png',
      '/assets/img/products/nicolas/hoja-seca-1.png',
    ],
    colors: [
      { name: 'Azul Turquesa', hex: '#0e9f9f' },
      { name: 'Rosa Palo', hex: '#f4a5b0' },
      { name: 'Lila', hex: '#c4b5fd' },
    ],
    topSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    bottomSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    gender: 'mujer',
    featured: true,
    inStock: true,
    tags: ['elegante', 'cómodo'],
  },
  {
    id: 'nicolas-blanco',
    name: 'Scrub Nicolás Blanco',
    collection: 'Nicolás',
    type: 'conjunto',
    price: 170000,
    description: 'Scrub masculino con cuello estructurado tipo camisa, diseño clásico y elegante para el profesional moderno.',
    images: [
      '/assets/img/products/nicolas/hoja-seca-1.png',
      '/assets/img/products/santiago/azul-cielo-1.png',
      '/assets/img/products/santiago/verde-militar-1.png',
      '/assets/img/products/santiago/verde-petroleo-4.png',
    ],
    colors: [
      { name: 'Blanco', hex: '#ffffff' },
      { name: 'Azul Cielo', hex: '#7dd3fc' },
      { name: 'Verde Menta', hex: '#6ee7b7' },
    ],
    topSizes: ['S', 'M', 'L', 'XL', 'XXL'],
    bottomSizes: ['S', 'M', 'L', 'XL', 'XXL'],
    gender: 'hombre',
    featured: true,
    inStock: true,
    tags: ['clásico', 'estructurado'],
  },
  {
    id: 'matheo-azul',
    name: 'Scrub Matheo Azul',
    collection: 'Matheo',
    type: 'conjunto',
    price: 175000,
    description: 'Scrub masculino con material anti-fluidos y diseño stretch para máxima libertad de movimiento.',
    images: [
      '/assets/img/products/santiago/verde-militar-1.png',
      '/assets/img/products/santiago/azul-cielo-1.png',
      '/assets/img/products/santiago/Berengena-1-1.png',
      '/assets/img/products/nicolas/hoja-seca-1.png',
    ],
    colors: [
      { name: 'Azul', hex: '#3b82f6' },
      { name: 'Negro', hex: '#1a1a1a' },
      { name: 'Verde', hex: '#059669' },
    ],
    topSizes: ['S', 'M', 'L', 'XL', 'XXL'],
    bottomSizes: ['S', 'M', 'L', 'XL', 'XXL'],
    gender: 'hombre',
    featured: false,
    inStock: true,
    tags: ['anti-fluidos', 'stretch'],
  },
  {
    id: 'antonella-verde',
    name: 'Scrub Antonella Verde',
    collection: 'Antonella',
    type: 'conjunto',
    price: 188000,
    description: 'Sofisticación y practicidad en un solo scrub. Cuello tipo camisa con acabados premium.',
    images: [
      '/assets/img/products/santiago/Berengena-1-1.png',
      '/assets/img/products/santiago/verde-militar-1.png',
      '/assets/img/products/santiago/azul-cielo-1.png',
      '/assets/img/products/nicolas/hoja-seca-1.png',
    ],
    colors: [
      { name: 'Verde Esmeralda', hex: '#059669' },
      { name: 'Burdeos', hex: '#9f1239' },
      { name: 'Azul Marino', hex: '#1e3a5f' },
    ],
    topSizes: ['XS', 'S', 'M', 'L', 'XL'],
    bottomSizes: ['XS', 'S', 'M', 'L', 'XL'],
    gender: 'mujer',
    featured: false,
    inStock: true,
    tags: ['sofisticado', 'premium'],
  },
  {
    id: 'valentina-lila',
    name: 'Scrub Valentina Lila',
    collection: 'Valentina',
    type: 'conjunto',
    price: 182000,
    description: 'Estilo clásico y moderno en perfecta armonía. Un scrub atemporal para la profesional de hoy.',
    images: [
      '/assets/img/products/santiago/Berengena-1-1.png',
      '/assets/img/products/santiago/azul-cielo-1.png',
      '/assets/img/products/nicolas/hoja-seca-1.png',
      '/assets/img/products/santiago/verde-militar-1.png',
    ],
    colors: [
      { name: 'Lila', hex: '#c4b5fd' },
      { name: 'Azul Turquesa', hex: '#0e9f9f' },
      { name: 'Negro', hex: '#1a1a1a' },
    ],
    topSizes: ['XS', 'S', 'M', 'L', 'XL'],
    bottomSizes: ['XS', 'S', 'M', 'L', 'XL'],
    gender: 'mujer',
    featured: false,
    inStock: true,
    tags: ['clásico', 'atemporal'],
  },
  {
    id: 'luciana-blusa',
    name: 'Blusa Luciana',
    collection: 'Luciana',
    type: 'top',
    price: 105000,
    description: 'Blusa de scrub femenina con acabado anti-fluidos. Disponible por separado para quienes ya tienen el pantalón.',
    images: [
      '/assets/img/products/santiago/verde-petroleo-4.png',
      '/assets/img/products/santiago/azul-cielo-1.png',
    ],
    colors: [
      { name: 'Negro', hex: '#1a1a1a' },
      { name: 'Azul Marino', hex: '#1e3a5f' },
      { name: 'Gris', hex: '#6b7280' },
    ],
    topSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    bottomSizes: [],
    gender: 'mujer',
    featured: false,
    inStock: true,
    tags: ['anti-fluidos', 'pieza separada'],
  },
  {
    id: 'luciana-pantalon',
    name: 'Pantalón Luciana',
    collection: 'Luciana',
    type: 'bottom',
    price: 90000,
    description: 'Pantalón de scrub femenino con cintura elástica y bolsillos funcionales. Combina con cualquier blusa.',
    images: [
      '/assets/img/products/santiago/verde-militar-1.png',
      '/assets/img/products/santiago/Berengena-1-1.png',
    ],
    colors: [
      { name: 'Negro', hex: '#1a1a1a' },
      { name: 'Azul Marino', hex: '#1e3a5f' },
    ],
    topSizes: [],
    bottomSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    gender: 'mujer',
    featured: false,
    inStock: true,
    tags: ['cómodo', 'pieza separada'],
  },
];
