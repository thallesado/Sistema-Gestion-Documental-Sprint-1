import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiDocumentType } from '../../core/api/document-api.service';
import { DocStatusItem } from './document-status-grid.component';

@Component({
  selector: 'app-document-filter-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="doc-filter-card">
      <div class="doc-filter-card-left">
        <span class="filter-box-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="13" y2="17"/>
          </svg>
        </span>
        <h3>{{ pageTitle }}</h3>
        <p>{{ scope ? 'Resultados devueltos por el endpoint del usuario.' : 'Documentos disponibles en el tenant autenticado.' }}</p>
      </div>
      <div class="doc-filter-inputs-grid">
        <div class="doc-filter-top-row">
          <div class="doc-input-box doc-search-input">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input placeholder="Buscar por nombre, código o descripción…" [value]="searchFilter" (input)="filterChange.emit({ key: 'search', event: $event })" />
          </div>
          <div class="doc-input-box">
            <select [value]="statusFilter" (change)="filterChange.emit({ key: 'status', event: $event })">
              <option value="">Todos los estados</option>
              @for (s of statuses; track s.code) { <option [value]="s.code">{{ s.label }}</option> }
            </select>
          </div>
          <div class="doc-input-box">
            <select [value]="typeFilter" (change)="filterChange.emit({ key: 'type', event: $event })">
              <option value="">Todos los tipos</option>
              @for (t of types; track t.id) { <option [value]="t.id">{{ t.name }}</option> }
            </select>
          </div>
        </div>
        <div class="doc-filter-bottom-row">
          <div class="doc-input-box" style="max-width: 200px;">
            <select [value]="sortBy" (change)="sortChange.emit($event)">
              <option value="updated">Última actualización</option>
              <option value="name">Nombre</option>
              <option value="created">Fecha de creación</option>
              <option value="version">Versión</option>
            </select>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn-doc-action" (click)="exportCsv.emit()"><span>Exportar CSV</span></button>
            <button type="button" class="btn-doc-action" (click)="clearFilters.emit()"><span>Limpiar filtros</span></button>
          </div>
        </div>
      </div>
    </section>
  `
})
export class DocumentFilterBarComponent {
  @Input() pageTitle = '';
  @Input() scope: string | null = null;
  @Input() searchFilter = '';
  @Input() statusFilter = '';
  @Input() typeFilter = '';
  @Input() sortBy = 'updated';
  @Input() types: ApiDocumentType[] = [];
  @Input() statuses: DocStatusItem[] = [];

  @Output() filterChange = new EventEmitter<{ key: 'search' | 'status' | 'type'; event: Event }>();
  @Output() sortChange = new EventEmitter<Event>();
  @Output() exportCsv = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();
}
