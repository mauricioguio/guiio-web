import { Component } from '@angular/core';

@Component({
  selector: 'app-clients',
  template: `
    <div class="p-8">
      <h2 class="text-white text-xl font-semibold mb-4">Clientes</h2>
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <p class="text-gray-500 text-sm">Los clientes registrados aparecerán aquí una vez conectada la base de datos.</p>
      </div>
    </div>
  `,
})
export class Clients {}
