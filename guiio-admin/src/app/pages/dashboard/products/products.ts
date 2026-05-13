import { Component } from '@angular/core';

@Component({
  selector: 'app-products',
  template: `
    <div class="p-8">
      <h2 class="text-white text-xl font-semibold mb-4">Productos</h2>
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <p class="text-gray-500 text-sm">La gestión de productos del catálogo online aparecerá aquí.</p>
      </div>
    </div>
  `,
})
export class Products {}
