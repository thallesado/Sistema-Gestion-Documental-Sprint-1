import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-export-dropdown',
  standalone: true,
  template: `
    <div class="export-dropdown">
      <button type="button" class="module-action" [attr.aria-expanded]="open" (click)="open = !open"><span>↓</span> Exportar <b>⌄</b></button>
      @if (open) {
        <div class="export-menu">
          <button type="button" (click)="choose('PDF')"><strong>PDF</strong><small>Resumen visual con {{ filterSummary }}</small></button>
          <button type="button" (click)="choose('Excel')"><strong>Excel</strong><small>Tabla filtrada con {{ filterSummary }}</small></button>
          <div class="export-stub">STUB · generación futura en API</div>
        </div>
      }
    </div>
  `,
})
export class ExportDropdown {
  @Input() filterSummary = 'filtros actuales';
  @Output() export = new EventEmitter<string>();
  open = false;

  choose(format: string): void {
    this.open = false;
    this.export.emit(format);
  }
}
