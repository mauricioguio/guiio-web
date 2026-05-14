import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'catalogo/:gender', renderMode: RenderMode.Server },
  { path: 'producto/:id', renderMode: RenderMode.Server },
  { path: 'coleccion/:name', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Prerender },
];
