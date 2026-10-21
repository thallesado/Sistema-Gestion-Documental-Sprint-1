import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Temporary body of the screens created by the sprint scaffold. Each owner replaces the whole page. */
@Component({
  selector: 'app-under-construction',
  imports: [RouterLink],
  template: `
    <main class="not-found">
      <h1>{{ title() }}</h1>
      <p>Esta pantalla está en construcción y todavía no está disponible.</p>
      <a routerLink="/">Volver al inicio</a>
    </main>
  `,
})
export class UnderConstruction {
  readonly title = input.required<string>();
}
