import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  template: `
    <main class="not-found">
      <section class="card" aria-labelledby="not-found-title">
        <p class="code" aria-hidden="true">404</p>
        <h1 id="not-found-title">Página no encontrada</h1>
        <p class="detail">La ruta solicitada no existe en el mapa actual de NexoDocs.</p>
        <a class="back" routerLink="/">Volver al inicio</a>
      </section>
    </main>
  `,
  styles: [`
    .not-found { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--mint, #dff7f3); }
    .card { max-width: 440px; width: 100%; padding: 40px 32px; text-align: center; background: var(--surface, #fff);
      border: 1px solid var(--line, #dcebe8); border-radius: 16px; box-shadow: 0 12px 32px rgba(8, 127, 123, 0.12); }
    .code { margin: 0 0 8px; font-size: 56px; font-weight: 800; line-height: 1; color: var(--teal, #087f7b); }
    h1 { margin: 0 0 8px; font-size: 22px; color: var(--ink, #153a39); }
    .detail { margin: 0 0 24px; color: var(--muted, #6b8583); }
    .back { display: inline-block; padding: 10px 20px; border-radius: 10px; font-weight: 600; text-decoration: none;
      color: var(--teal-text, #eafffc); background: var(--teal, #087f7b); }
    .back:hover { background: var(--teal-strong, #05635f); }
    .back:focus-visible { outline: 3px solid var(--teal-muted, #c9f1ec); outline-offset: 2px; }
  `],
})
export class NotFoundPage {}

export { NotFoundPage as NoEncontradoPage };
