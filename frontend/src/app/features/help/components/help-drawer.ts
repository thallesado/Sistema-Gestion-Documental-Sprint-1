import { Component, HostListener, inject } from '@angular/core';
import { HelpService } from '../help.service';

/** Side panel of the help center. Placeholder created by the sprint scaffold; task H1 (Mauricio) fills it. */
@Component({
  selector: 'app-help-drawer',
  template: `
    @if (help.isOpen()) {
      <aside class="help-drawer" role="dialog" aria-label="Centro de ayuda">
        <header>
          <h2>Centro de ayuda</h2>
          <button type="button" (click)="help.close()" aria-label="Cerrar el centro de ayuda">✕</button>
        </header>
        <p>El centro de ayuda estará disponible próximamente.</p>
      </aside>
    }
  `,
  styles: [`
    .help-drawer { background: #fff; border-left: 1px solid #dcebe8; bottom: 0; box-shadow: -8px 0 24px rgba(10, 50, 48, 0.12); max-width: 100%; padding: 20px; position: fixed; right: 0; top: 0; width: 380px; z-index: 900; }
    .help-drawer header { align-items: center; display: flex; justify-content: space-between; }
    .help-drawer h2 { font-size: 16px; margin: 0; }
    .help-drawer button { background: transparent; border: 0; cursor: pointer; font-size: 16px; padding: 4px 8px; }
    .help-drawer p { color: #557774; font-size: 13px; }
  `],
})
export class HelpDrawer {
  readonly help = inject(HelpService);

  @HostListener('document:keydown.escape')
  closeOnEscape(): void {
    if (this.help.isOpen()) this.help.close();
  }
}
