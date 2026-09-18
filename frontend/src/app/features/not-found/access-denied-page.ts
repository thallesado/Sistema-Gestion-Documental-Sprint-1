import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied-page',
  imports: [RouterLink],
  template: `
    <main class="not-found">
      <h1>Acceso restringido</h1>
      <p>No tienes permisos para acceder a esta sección.</p>
      <a routerLink="/">Volver al inicio</a>
    </main>
  `,
})
export class AccessDeniedPage {}
