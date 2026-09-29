import { Component, computed, input, signal } from '@angular/core';
import { ApiPermission } from '../../../core/api/administration-api.service';
import { ExportColumn } from '../../../core/utils/export-utils';
import { exportRowsToCsv, exportRowsToExcel, exportRowsToPdf } from '../../../core/utils/table-export';
import { ExportFormat, ExportMenu } from '../../../shared';
import { PermissionDetailModal } from './permission-detail-modal';

const MODULE_LABELS: Record<string, string> = {
  audit: 'Auditoría', configuration: 'Configuración', dicom: 'Imágenes DICOM', document: 'Documentos',
  document_version: 'Versiones de documento', expedient: 'Expedientes', medical_note: 'Notas médicas',
  notification: 'Notificaciones', ocr: 'Digitalización y OCR', patient: 'Pacientes', permission: 'Permisos',
  report: 'Reportes', role: 'Roles', task: 'Tareas', tenant: 'Organizaciones', user: 'Usuarios', workflow: 'Flujos de trabajo',
};
const CRITICALITY_LABELS: Record<string, string> = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };

@Component({
  selector: 'app-permissions-catalog',
  imports: [PermissionDetailModal, ExportMenu],
  template: `
    <section class="module-main-card">
      <div class="module-card-header">
        <h2>Catálogo de permisos</h2>
        <p>Permisos globales definidos por el sistema, agrupados por módulo. Solo se pueden consultar y asignar a roles.</p>
      </div>

      <div class="module-filter-bar">
        <div class="module-search-pill">
          <input placeholder="Buscar permiso por código o descripción..." aria-label="Buscar permiso"
                 [value]="search()" (input)="search.set($any($event.target).value)" />
        </div>
        <div class="module-filter-group">
          <select class="filter-btn-pill" aria-label="Filtrar por módulo" [value]="moduleFilter()" (change)="moduleFilter.set($any($event.target).value)">
            <option value="">Todos los módulos</option>
            @for (m of modules(); track m) { <option [value]="m">{{ moduleLabel(m) }}</option> }
          </select>
          <select class="filter-btn-pill" aria-label="Filtrar por criticidad" [value]="criticalityFilter()" (change)="criticalityFilter.set($any($event.target).value)">
            <option value="">Todas las criticidades</option>
            <option value="HIGH">Alta</option><option value="MEDIUM">Media</option><option value="LOW">Baja</option>
          </select>
          <app-export-menu (exportAs)="export($event)" />
        </div>
      </div>

      <div class="admin-table-wrap">
        <table>
          <thead><tr><th>Código</th><th>Descripción</th><th>Criticidad</th><th></th></tr></thead>
          <tbody>
            @for (group of groups(); track group.module) {
              <tr class="group-row"><th colspan="4">Módulo {{ moduleLabel(group.module) }} <span>{{ group.items.length }}</span></th></tr>
              @for (p of group.items; track p.id) {
                <tr>
                  <td><code>{{ p.code }}</code></td>
                  <td>{{ p.description || 'Sin descripción' }}</td>
                  <td><span class="criticality-pill" [class]="p.criticality.toLowerCase()">{{ criticalityLabel(p.criticality) }}</span></td>
                  <td class="actions"><button type="button" class="admin-secondary" (click)="detailId.set(p.id)">Ver detalle</button></td>
                </tr>
              }
            } @empty {
              <tr><td colspan="4" class="admin-empty">No se encontraron permisos</td></tr>
            }
          </tbody>
        </table>
      </div>
      <p class="api-note">{{ filtered().length }} de {{ permissions().length }} permisos</p>
    </section>
    <app-permission-detail-modal [permissionId]="detailId()" (close)="detailId.set(null)" />
  `,
  styles: `
    .group-row th { background: #eef7f5; color: var(--teal-strong); font-size: 11px; letter-spacing: .05em; padding: 9px 16px; text-align: left; text-transform: uppercase; }
    .group-row span { background: #fff; border-radius: 99px; font-size: 10px; margin-left: 6px; padding: 1px 8px; }
    td code { color: #111827; font-family: inherit; font-size: 14px; font-weight: 600; }
    td:nth-child(2) { color: #4b5563; font-size: 14px; font-weight: 400; line-height: 1.5; }
    .actions { text-align: right; }
    .admin-secondary { min-height: 30px; }
    select.filter-btn-pill { appearance: auto; }
  `,
})
export class PermissionsCatalog {
  readonly permissions = input.required<ApiPermission[]>();
  readonly search = signal('');
  readonly moduleFilter = signal('');
  readonly criticalityFilter = signal('');
  readonly detailId = signal<number | null>(null);

  readonly modules = computed(() => [...new Set(this.permissions().map((p) => p.module))].sort());
  readonly filtered = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.permissions().filter((p) =>
      (!this.moduleFilter() || p.module === this.moduleFilter())
      && (!this.criticalityFilter() || p.criticality === this.criticalityFilter())
      && (!query || `${p.code} ${p.description ?? ''}`.toLowerCase().includes(query)));
  });
  readonly groups = computed(() => {
    const byModule = new Map<string, ApiPermission[]>();
    for (const p of this.filtered()) byModule.set(p.module, [...(byModule.get(p.module) ?? []), p]);
    return [...byModule].map(([module, items]) => ({ module, items }));
  });

  moduleLabel(module: string): string { return MODULE_LABELS[module] ?? module; }
  criticalityLabel(value: string): string { return CRITICALITY_LABELS[value] ?? value; }

  private static readonly EXPORT_COLUMNS: ExportColumn[] = [
    { key: 'code', label: 'Código' }, { key: 'description', label: 'Descripción' },
    { key: 'module', label: 'Módulo' }, { key: 'criticality', label: 'Criticidad' },
  ];

  /** Solo los permisos visibles (filtros activos), en el orden agrupado de la tabla. */
  private exportRows() {
    return this.groups().flatMap((g) => g.items).map((p) => ({
      code: p.code, description: p.description ?? '', module: this.moduleLabel(p.module), criticality: this.criticalityLabel(p.criticality),
    }));
  }

  export(format: ExportFormat): void {
    const rows = this.exportRows();
    if (!rows.length) { alert('No hay permisos para exportar con los filtros actuales.'); return; }
    const columns = PermissionsCatalog.EXPORT_COLUMNS;
    if (format === 'csv') exportRowsToCsv(rows, columns, 'permisos_sistema');
    else if (format === 'excel') exportRowsToExcel(rows, columns, 'permisos_sistema');
    else void exportRowsToPdf(rows, columns, 'permisos_sistema', 'Catálogo de permisos del sistema');
  }
}
