import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

@Component({
  selector: 'app-export-dropdown',
  standalone: true,
  template: `
    <div class="export-dropdown-wrapper">
      <button type="button" class="module-action" [attr.aria-expanded]="open()" (click)="toggle($event)">
        <span>↓</span> Exportar <b>⌄</b>
      </button>
      @if (open()) {
        <div class="export-dropdown-backdrop" (click)="open.set(false)"></div>
        <div class="export-dropdown-popover">
          <button type="button" (click)="choose('Excel')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
            <div><strong>Exportar a Excel</strong><small>Tabla con {{ filterSummary }}</small></div>
          </button>
          <button type="button" (click)="choose('PDF')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            <div><strong>Exportar a PDF</strong><small>Resumen visual con {{ filterSummary }}</small></div>
          </button>
          <button type="button" (click)="choose('JSON')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            <div><strong>Exportar a JSON</strong><small>Estructura de datos .json</small></div>
          </button>
        </div>
      }
    </div>
  `,
})
export class ExportDropdown {
  @Input() filterSummary = 'filtros actuales';
  @Output() export = new EventEmitter<string>();
  readonly open = signal(false);

  toggle(event?: Event): void {
    if (event) event.stopPropagation();
    this.open.update((v) => !v);
  }

  choose(format: string): void {
    this.open.set(false);
    this.export.emit(format);
  }
}
