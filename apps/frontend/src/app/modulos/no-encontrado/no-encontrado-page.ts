import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <main class="not-found">
      <h1>Pagina no encontrada</h1>
      <p>La ruta solicitada no existe en el mapa actual de NexoDocs.</p>
      <a routerLink="/">Volver al resumen</a>
    </main>
  `,
})
export class NotFoundPage {}

export { NotFoundPage as NoEncontradoPage };
