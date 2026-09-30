import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { AdministrationApiService, ApiPermission } from '../../../core/api/administration-api.service';

@Component({
  selector: 'app-permission-detail-modal',
  imports: [CommonModule],
  template: `
    @if (permissionId != null) {
      <div class="modal-backdrop" role="presentation">
        <section class="admin-modal confirmation" role="dialog" aria-modal="true" aria-labelledby="permission-detail-title">
          <h2 id="permission-detail-title">Detalle del permiso</h2>
          @if (loading()) { <p class="admin-empty">Cargando…</p> }
          @else if (error()) { <div class="admin-state error" role="alert">{{ error() }}</div> }
          @else if (permission(); as p) {
            <dl class="permission-detail">
              <dt>Clave</dt><dd><code>{{ p.code }}</code></dd>
              <dt>Módulo</dt><dd>{{ p.module }}</dd>
              <dt>Acción</dt><dd>{{ p.action }}</dd>
              <dt>Descripción</dt><dd>{{ p.description || 'Sin descripción.' }}</dd>
              <dt>Criticidad</dt><dd><span class="criticality-pill" [class]="p.criticality.toLowerCase()">{{ criticalityLabel(p.criticality) }}</span></dd>
            </dl>
          }
          <div class="form-actions"><button class="admin-secondary" type="button" (click)="close.emit()">Cerrar</button></div>
        </section>
      </div>
    }
  `,
})
export class PermissionDetailModal implements OnChanges {
  private readonly api = inject(AdministrationApiService);
  @Input() permissionId: number | null = null;
  @Output() readonly close = new EventEmitter<void>();
  readonly permission = signal<ApiPermission | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnChanges(): void {
    if (this.permissionId == null) { this.permission.set(null); return; }
    this.loading.set(true);
    this.error.set('');
    this.permission.set(null);
    this.api.permissionDetail(this.permissionId).subscribe({
      next: (permission) => { this.permission.set(permission); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('No se pudo cargar el detalle del permiso.'); },
    });
  }

  criticalityLabel(value: string): string {
    return value === 'HIGH' ? 'Alta' : value === 'LOW' ? 'Baja' : 'Media';
  }
}
