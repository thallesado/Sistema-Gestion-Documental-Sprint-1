import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiDocument, ApiDocumentVersion } from '../../core/api/document-api.service';
import { UserSelectorComponent } from '../../shared';

@Component({
  selector: 'app-document-modals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- DETAIL MODAL -->
    @if (selectedDoc()) {
      <div class="modal-backdrop" (click)="closeDetail.emit()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h3>{{ selectedDoc()?.name }}</h3>
            <button class="icon-btn" (click)="closeDetail.emit()">✕</button>
          </header>
          <div class="modal-body">
            <dl class="doc-meta-grid">
              <div><dt>Código:</dt><dd>{{ selectedDoc()?.code }}</dd></div>
              <div><dt>Tipo:</dt><dd>{{ selectedDoc()?.category || selectedDoc()?.documentTypeId }}</dd></div>
              <div><dt>Estado:</dt><dd><span class="badge">{{ selectedDoc()?.status }}</span></dd></div>
              <div><dt>Versión actual:</dt><dd>v{{ selectedDoc()?.currentVersion || selectedDoc()?.version || 1 }}</dd></div>
              <div><dt>Emisión:</dt><dd>{{ selectedDoc()?.effectiveDate || selectedDoc()?.createdAt || '—' }}</dd></div>
              <div><dt>Vencimiento:</dt><dd>{{ selectedDoc()?.updatedAt || '—' }}</dd></div>
              <div><dt>Creado por:</dt><dd>{{ selectedDoc()?.creatorName || selectedDoc()?.creatorId || 'Sistema' }}</dd></div>
              <div><dt>Responsable:</dt><dd>{{ selectedDoc()?.responsibleUserName || selectedDoc()?.responsibleUserId || 'Sin asignar' }}</dd></div>
            </dl>
            @if (selectedDoc()?.description) {
              <div class="doc-description">
                <h4>Descripción</h4>
                <p>{{ selectedDoc()?.description }}</p>
              </div>
            }
          </div>
          <footer class="modal-footer">
            <button class="btn-primary" (click)="closeDetail.emit()">Cerrar</button>
          </footer>
        </div>
      </div>
    }

    <!-- VERSIONS MODAL -->
    @if (showVersionModal()) {
      <div class="modal-backdrop" (click)="closeVersions.emit()">
        <div class="modal-card modal-lg" (click)="$event.stopPropagation()">
          <header class="modal-header">
            <h3>Historial de versiones · {{ versionTargetDoc()?.name }}</h3>
            <button class="icon-btn" (click)="closeVersions.emit()">✕</button>
          </header>
          <div class="modal-body">
            @if (loadingVersions()) { <p>Cargando historial…</p> }
            @if (!loadingVersions() && versions().length === 0) { <p class="empty-state">No se registraron versiones adicionales.</p> }
            @if (versions().length > 0) {
              <table class="data-table">
                <thead><tr><th>Versión</th><th>Archivo</th><th>Tamaño</th><th>Motivo</th><th>Fecha</th></tr></thead>
                <tbody>
                  @for (v of versions(); track v.id) {
                    <tr>
                      <td><strong>v{{ v.versionNumber }}</strong></td>
                      <td>{{ v.fileName }}</td>
                      <td>{{ v.fileSizeBytes ? (v.fileSizeBytes / 1024 | number:'1.1-1') + ' KB' : '—' }}</td>
                      <td>{{ v.changeReason || 'Versión documental' }}</td>
                      <td>{{ v.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
          <footer class="modal-footer">
            <button class="btn-primary" (click)="closeVersions.emit()">Cerrar</button>
          </footer>
        </div>
      </div>
    }
  `
})
export class DocumentModalsComponent {
  readonly selectedDoc = input<ApiDocument | null>(null);
  readonly showVersionModal = input<boolean>(false);
  readonly versionTargetDoc = input<ApiDocument | null>(null);
  readonly versions = input<ApiDocumentVersion[]>([]);
  readonly loadingVersions = input<boolean>(false);

  readonly closeDetail = output<void>();
  readonly closeVersions = output<void>();
}
