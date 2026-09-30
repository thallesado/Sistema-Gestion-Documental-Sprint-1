import { Component, output, signal } from '@angular/core';

export type ExportFormat = 'pdf' | 'excel' | 'csv';

/** Botón «Exportar» con menú desplegable. Los estilos `.export-dropdown-*` son globales (styles.css). */
@Component({
  selector: 'app-export-menu',
  template: `
    <div class="export-dropdown-wrapper">
      <button type="button" class="filter-btn-pill" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="menu">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Exportar</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      @if (open()) {
        <div class="export-dropdown-backdrop" (click)="open.set(false)"></div>
        <div class="export-dropdown-popover" role="menu">
          <button type="button" role="menuitem" (click)="choose('pdf')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div><strong>Exportar como PDF</strong><small>Documento listo para imprimir</small></div>
          </button>
          <button type="button" role="menuitem" (click)="choose('excel')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            <div><strong>Exportar como Excel</strong><small>Hoja de cálculo (.xls)</small></div>
          </button>
          <button type="button" role="menuitem" (click)="choose('csv')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            <div><strong>Exportar como CSV</strong><small>Texto separado por comas (.csv)</small></div>
          </button>
        </div>
      }
    </div>
  `,
})
export class ExportMenu {
  readonly exportAs = output<ExportFormat>();
  readonly open = signal(false);

  choose(format: ExportFormat): void {
    this.open.set(false);
    this.exportAs.emit(format);
  }
}
