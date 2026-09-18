import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DocumentApiService, ApiDocument, ApiDocumentType, ApiDocumentVersion, DocumentCreatePayload } from '../../core/api/document-api.service';
import { UserSelectorComponent } from '../../core/components/user-selector/user-selector';

@Component({
  selector: 'app-document-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UserSelectorComponent],
  template: `
    <section class="document-page">
      <header class="page-header">
        <div><p class="eyebrow">Documentos · {{ isStatuses ? 'Estados' : 'Catálogo' }}</p>
          <h1>{{ isStatuses ? 'Estados documentales' : 'Todos los documentos' }}</h1>
          <p>{{ isStatuses ? 'Consulta el ciclo de vida definido por el dominio documental.' : 'Consulta los documentos disponibles en el tenant autenticado.' }}</p>
        </div>
        @if (!isStatuses) { <a class="primary" routerLink="/documents/new">＋ Nuevo documento</a> }
      </header>

      @if (isStatuses) {
        <section class="notice warning"><b>Configuración no disponible</b><span>El backend expone el modelo de estados, pero todavía no publica un endpoint para configurarlos.</span></section>
        <section class="status-grid">
          @for (status of statuses; track status.code) {
            <article class="status-card"><span [class]="'status-dot ' + status.tone"></span><div><b>{{ status.label }}</b><small>{{ status.description }}</small><code>{{ status.code }}</code></div></article>
          }
        </section>
      } @else {
        @if (isCreateRoute) {
          <form class="panel create-form" (ngSubmit)="createDocument()">
            <h2>{{ isUploadRoute ? 'Subir archivo' : 'Nuevo documento' }}</h2>
            <p class="form-note">Los metadatos se crean en el tenant autenticado. El responsable se envía como identificador, nunca como texto libre.</p>
            @if (createError()) { <div class="notice error" role="alert">{{ createError() }}</div> }
            <div class="form-grid">
              <label>Nombre<input name="documentName" [(ngModel)]="createForm.name" required maxlength="255" /></label>
              <label>Código<input name="documentCode" [(ngModel)]="createForm.code" required maxlength="60" /></label>
              <label>Tipo documental<select name="documentTypeId" [(ngModel)]="createForm.documentTypeId" required><option value="">Selecciona un tipo</option>@for (type of types(); track type.id) { <option [value]="type.id">{{ type.name }} · {{ type.code }}</option> }</select></label>
              <label>Expediente (opcional)<input name="expedientId" [(ngModel)]="createForm.expedientId" placeholder="UUID del expediente" /></label>
              <label>Fecha de emisión<input type="date" name="issueDate" [(ngModel)]="createForm.issueDate" /></label>
              <label>Fecha de vencimiento<input type="date" name="expiryDate" [(ngModel)]="createForm.expiryDate" /></label>
              <app-user-selector label="Responsable (opcional)" [(value)]="createForm.responsibleUserId" />
              <label class="full-width">Descripción<textarea name="description" rows="4" [(ngModel)]="createForm.description" maxlength="10000"></textarea></label>
              @if (isUploadRoute) { <label class="full-width">Archivo inicial<input type="file" name="initialFile" accept=".pdf,.png,.jpg,.jpeg,.docx" (change)="selectInitialFile($event)" /><small class="form-note">El archivo se almacena como una nueva versión después de crear los metadatos.</small></label> }
            </div>
            <div class="form-actions"><a routerLink="/documents" class="secondary-action">Cancelar</a><button class="primary-action" type="submit" [disabled]="creating() || !createForm.name.trim() || !createForm.code.trim() || !createForm.documentTypeId || (isUploadRoute && !initialFile)">{{ creating() ? 'Guardando…' : (isUploadRoute ? 'Crear y subir' : 'Crear documento') }}</button></div>
          </form>
        }
        @if (apiError()) { <div class="notice error" role="alert"><b>No se pudo consultar el catálogo documental.</b><span>{{ apiError() }}</span><button type="button" (click)="loadTypes()">Reintentar</button></div> }
        @if (loading()) { <div class="notice" role="status">Consultando tipos documentales…</div> }
        @if (actionMessage()) { <div class="notice" role="status">{{ actionMessage() }}</div> }
        <section class="panel">
          <div class="toolbar"><div><h2>{{ pageTitle }}</h2><p>{{ scope ? 'Resultados devueltos por el endpoint de documentos del usuario.' : 'Documentos disponibles en el tenant autenticado.' }}</p></div><div class="filters"><input aria-label="Buscar por nombre o código" placeholder="Nombre o código…" [value]="search()" (input)="setSearch($event)"><select aria-label="Filtrar por estado" [value]="statusFilter()" (change)="setStatus($event)"><option value="">Todos los estados</option><option value="DRAFT">Borrador</option><option value="PENDING">Pendiente</option><option value="IN_REVIEW">En revisión</option><option value="APPROVED">Aprobado</option><option value="ARCHIVED">Archivado</option></select><input aria-label="Filtrar por tipo" placeholder="Tipo documental" [value]="typeFilter()" (input)="setFilter('type', $event)"><input aria-label="Filtrar por categoría" placeholder="Categoría" [value]="categoryFilter()" (input)="setFilter('category', $event)"><input aria-label="Filtrar por responsable" placeholder="Responsable" [value]="responsibleFilter()" (input)="setFilter('responsible', $event)"><input aria-label="Filtrar por creador" placeholder="Creador" [value]="creatorFilter()" (input)="setFilter('creator', $event)"><input aria-label="Filtrar por área" placeholder="Área" [value]="areaFilter()" (input)="setFilter('area', $event)"><input aria-label="Filtrar por expediente" placeholder="Expediente" [value]="expedientFilter()" (input)="setFilter('expedient', $event)"><label class="date-filter">Desde <input type="date" aria-label="Fecha desde" [value]="dateFrom()" (change)="setFilter('dateFrom', $event)"></label><label class="date-filter">Hasta <input type="date" aria-label="Fecha hasta" [value]="dateTo()" (change)="setFilter('dateTo', $event)"></label><select aria-label="Ordenar documentos" [value]="sortBy()" (change)="setSort($event)"><option value="updated">Última actualización</option><option value="name">Nombre</option><option value="created">Fecha de creación</option><option value="version">Versión</option></select><button type="button" class="clear-filter" (click)="clearFilters()">Limpiar filtros</button></div></div>
          <div class="document-list">
            @for (item of pagedDocuments(); track item.id) {
              <article class="document-row" tabindex="0" role="button" (click)="openDetails(item)" (keydown.enter)="openDetails(item)"><span class="file">API</span><div><b class="document-name">{{ item.name }}</b><small>{{ item.code }} · versión {{ item.currentVersion || 'sin archivo' }}</small>@for (version of versions()[item.id] || []; track version.id) { <button type="button" class="version-link" (click)="$event.stopPropagation(); download(item, version)">v{{ version.versionNumber }} · {{ version.fileName }}</button> }</div><time>{{ item.createdAt | date:'dd/MM/yyyy' }}</time><span class="pill">{{ item.status }}</span><span class="document-actions"><button type="button" (click)="$event.stopPropagation(); loadVersions(item)">Versiones</button><label (click)="$event.stopPropagation()">Subir<input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" (change)="uploadVersion(item, $event)" /></label></span></article>
            } @empty {
              @if (!loading()) { <div class="empty-state">{{ apiDocuments().length ? 'No hay documentos que coincidan con los filtros.' : 'La API no devolvió documentos para este tenant.' }}</div> }
            }
          </div>
          @if (filteredDocuments().length) { <nav class="pagination" aria-label="Paginación de documentos"><label>Documentos por página <select [value]="pageSize()" (change)="setPageSize($event)"><option [value]="5">5</option><option [value]="10">10</option><option [value]="25">25</option><option [value]="50">50</option><option [value]="100">100</option></select></label><button type="button" (click)="previousPage()" [disabled]="page() === 0">Anterior</button><span>Página {{ page() + 1 }} de {{ totalPages() }}</span><button type="button" (click)="nextPage()" [disabled]="page() + 1 >= totalPages()">Siguiente</button></nav> }
          @if (types().length) { <h3 class="subheading">Tipos documentales del tenant</h3><div class="types">@for (type of types(); track type.id) { <span>{{ type.name }} <code>{{ type.code }}</code></span> }</div> }
        </section>
        @if (selectedDocument()) { <div class="modal-backdrop drawer-backdrop" role="presentation" (click)="closeDetails()"><aside class="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="document-detail-title" (click)="$event.stopPropagation()"><button class="drawer-close" type="button" aria-label="Cerrar detalle" (click)="closeDetails()">×</button><p class="eyebrow">Detalle documental</p><h2 id="document-detail-title">{{ selectedDocument()?.name }}</h2><dl><dt>Código</dt><dd>{{ selectedDocument()?.code }}</dd><dt>Tipo / categoría</dt><dd>{{ selectedDocument()?.documentTypeId }} · {{ selectedDocument()?.category || 'No disponible' }}</dd><dt>Descripción</dt><dd>{{ selectedDocument()?.description || 'Sin descripción disponible.' }}</dd><dt>Estado</dt><dd><span class="pill">{{ selectedDocument()?.status }}</span></dd><dt>Responsable</dt><dd>{{ selectedDocument()?.responsibleUserName || selectedDocument()?.responsibleUserId || 'No disponible' }}</dd><dt>Creador / área</dt><dd>{{ selectedDocument()?.creatorName || selectedDocument()?.creatorId || 'No disponible' }} · {{ selectedDocument()?.area || 'No disponible' }}</dd><dt>Expediente</dt><dd>{{ selectedDocument()?.expedientCode || selectedDocument()?.expedientId || 'No vinculado' }}</dd><dt>Versión actual</dt><dd>{{ selectedDocument()?.currentVersion || 'Sin archivo' }}</dd><dt>Creado</dt><dd>{{ selectedDocument()?.createdAt | date:'dd/MM/yyyy HH:mm' }}</dd><dt>Última actualización</dt><dd>{{ selectedDocument()?.updatedAt | date:'dd/MM/yyyy HH:mm' }}</dd></dl><p class="tenant-disclaimer">Las transiciones habilitadas se validan de forma definitiva en el backend según tus permisos.</p><div class="drawer-actions"><button type="button" (click)="loadVersions(selectedDocument()!)">Cargar historial</button><label>Subir versión<input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" (change)="uploadVersion(selectedDocument()!, $event)" /></label></div>@if (allowedStatusTransitions(selectedDocument()!).length) { <div class="status-actions"><span>Cambiar estado</span>@for (status of allowedStatusTransitions(selectedDocument()!); track status) { <button type="button" (click)="changeStatus(selectedDocument()!, status)" [disabled]="changingStatus()">{{ statusLabel(status) }}</button> }</div> } @if (detailLoading()) { <p class="drawer-note">Cargando historial…</p> } @if (detailError()) { <p class="drawer-error" role="alert">{{ detailError() }}</p> } @if (versions()[selectedDocument()!.id]; as history) { <h3>Historial de versiones</h3>@if (!history.length) { <p class="drawer-note">No hay versiones disponibles.</p> } @for (version of history; track version.id) { <button class="history-item" type="button" (click)="download(selectedDocument()!, version)">v{{ version.versionNumber }} · {{ version.fileName }}<small>{{ version.createdAt | date:'dd/MM/yyyy HH:mm' }} · {{ version.changeReason }}</small></button> } }</aside></div> }
        @if (uploadFile()) { <div class="modal-backdrop" role="presentation"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="version-title"><h2 id="version-title">Nueva versión</h2><p>Archivo seleccionado: <b>{{ uploadFile()?.name }}</b></p><label>Motivo del cambio<textarea rows="3" [(ngModel)]="uploadReason" required></textarea></label><div class="modal-actions"><button type="button" (click)="cancelUpload()">Cancelar</button><button class="primary-action" type="button" (click)="confirmUpload()" [disabled]="!uploadReason.trim() || uploading()">Guardar versión</button></div></section></div> }
      }
    </section>
  `,
  styles: [`
    .document-page{max-width:1440px;margin:auto;padding:30px 36px 48px;color:#153a39}.page-header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:22px}.eyebrow{color:#087f7b;text-transform:uppercase;font-size:11px;font-weight:800;letter-spacing:.08em}.page-header h1{font-size:34px;letter-spacing:-.04em;margin:6px 0}.page-header p:last-child,.toolbar p{color:#6b8583;font-size:13px;margin:0}.primary{background:#087f7b;color:white;padding:11px 15px;border-radius:9px;text-decoration:none;font-weight:800}.notice{display:flex;gap:10px;flex-wrap:wrap;background:#eef7ff;border:1px solid #cfe3f5;color:#356d9e;border-radius:10px;padding:12px;margin-bottom:15px;font-size:12px}.notice span{flex:1}.notice.error{background:#fff4f3;border-color:#f3d2d0;color:#a65050}.notice.warning{background:#fff8e8;border-color:#f3e1b6;color:#8b671c}.notice button{border:0;background:transparent;text-decoration:underline;color:inherit}.panel{background:#fff;border:1px solid #dcebe8;border-radius:16px;padding:20px}.toolbar{display:flex;justify-content:space-between;gap:15px;align-items:center;margin-bottom:15px}.toolbar h2{font-size:17px;margin:0 0 4px}.filters{display:flex;gap:7px;flex-wrap:wrap}.toolbar input,.toolbar select{border:1px solid #dcebe8;border-radius:9px;padding:10px;min-width:170px}.document-list{display:grid;gap:4px}.document-row{display:grid;grid-template-columns:45px 1fr auto auto auto;gap:12px;align-items:center;padding:13px 8px;border-bottom:1px solid #edf3f1;cursor:pointer}.document-row:focus{outline:2px solid #087f7b;outline-offset:-2px}.file{background:#dff7f3;color:#087f7b;border-radius:8px;padding:8px 4px;text-align:center;font-size:10px;font-weight:800}.document-row div{display:grid;gap:4px}.document-name{color:#087f7b}.document-row small,.document-row time{color:#6b8583;font-size:11px}.pill{background:#e8f5ee;color:#28704b;border-radius:99px;padding:5px 8px;font-size:10px;font-weight:800}.document-actions{display:flex;gap:6px}.document-actions button,.document-actions label,.version-link{border:1px solid #bfeae5;background:#fff;color:#087f7b;border-radius:7px;padding:6px;cursor:pointer;font-size:10px}.document-actions input{display:none}.version-link{text-align:left}.pagination{display:flex;justify-content:center;gap:14px;align-items:center;padding:17px;font-size:12px;color:#6b8583;flex-wrap:wrap}.pagination label{display:flex;align-items:center;gap:6px}.pagination select{border:1px solid #dcebe8;border-radius:7px;padding:6px}.pagination button,.modal-actions button,.drawer-actions button,.drawer-actions label,.status-actions button{border:1px solid #bfeae5;background:white;color:#087f7b;border-radius:7px;padding:7px 11px;cursor:pointer;font-size:11px}.pagination button:disabled,.status-actions button:disabled{opacity:.45;cursor:not-allowed}.modal-backdrop{position:fixed;inset:0;background:#153a3966;display:grid;place-items:center;padding:20px;z-index:20}.modal{background:white;border-radius:14px;padding:22px;max-width:480px;width:100%;box-shadow:0 18px 50px #153a3940}.modal h2{margin-top:0}.modal label{display:grid;gap:7px;font-size:12px;font-weight:700}.modal textarea{border:1px solid #dcebe8;border-radius:8px;padding:9px;resize:vertical}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.modal-actions .primary-action{background:#087f7b;color:white}.drawer-backdrop{display:flex;justify-content:flex-end;padding:0}.detail-drawer{background:#fff;height:100%;max-width:470px;overflow:auto;padding:32px 28px;position:relative;width:100%;box-shadow:-10px 0 30px #153a3940}.drawer-close{background:transparent;border:0;color:#6b8583;cursor:pointer;font-size:28px;position:absolute;right:18px;top:12px}.detail-drawer h2{font-size:26px;margin:5px 0 22px}.detail-drawer dl{display:grid;gap:7px;grid-template-columns:145px 1fr;font-size:12px}.detail-drawer dt{color:#6b8583;font-weight:800}.detail-drawer dd{margin:0;overflow-wrap:anywhere}.status-actions{border-top:1px solid #edf3f1;display:flex;flex-wrap:wrap;gap:8px;margin-top:18px;padding-top:16px}.status-actions span{align-self:center;color:#6b8583;font-size:11px;font-weight:800;width:100%}.tenant-disclaimer,.drawer-note,.drawer-error{font-size:11px;line-height:1.5;margin:20px 0}.tenant-disclaimer{background:#eef7ff;border-radius:8px;color:#356d9e;padding:10px}.drawer-error{color:#a65050}.drawer-actions{display:flex;flex-wrap:wrap;gap:8px}.drawer-actions input{display:none}.detail-drawer h3{font-size:14px;margin:25px 0 10px}.history-item{background:#f8fbfa;border:1px solid #dcebe8;border-radius:8px;color:#153a39;cursor:pointer;display:grid;gap:4px;margin:5px 0;padding:9px;text-align:left;width:100%}.history-item small{color:#6b8583}.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.status-card{background:#fff;border:1px solid #dcebe8;border-radius:14px;padding:17px;display:flex;gap:12px}.status-card div{display:grid;gap:5px}.status-card small{color:#6b8583;font-size:11px}.status-card code,.types code{font-size:10px;color:#087f7b}.status-dot{width:10px;height:10px;border-radius:50%;margin-top:4px;background:#9aa}.status-dot.teal{background:#087f7b}.status-dot.amber{background:#d99a26}.status-dot.blue{background:#4386c5}.status-dot.green{background:#3b9b69}.status-dot.gray{background:#899b9a}.subheading{font-size:14px;margin:22px 0 10px}.types{display:flex;gap:8px;flex-wrap:wrap}.types span{border:1px solid #dcebe8;border-radius:8px;padding:8px;font-size:12px}@media(max-width:700px){.document-page{padding:22px 16px}.page-header,.toolbar{display:grid}.page-header h1{font-size:28px}.status-grid{grid-template-columns:1fr}.document-row{grid-template-columns:42px 1fr}.document-row time,.document-row .pill,.document-actions{grid-column:2}.toolbar input,.toolbar select{width:100%;box-sizing:border-box}.detail-drawer{max-width:none}}
  `],
})
export class DocumentPage {
  private readonly api = inject(DocumentApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly isStatuses = this.route.snapshot.routeConfig?.path === 'settings/statuses';
  readonly isCreateRoute = ['documents/new', 'documents/upload'].includes(this.route.snapshot.routeConfig?.path || '');
  readonly isUploadRoute = this.route.snapshot.routeConfig?.path === 'documents/upload';
  readonly createError = signal('');
  readonly creating = signal(false);
  createForm: DocumentCreatePayload & { responsibleUserId: string } = { documentTypeId: '', code: '', name: '', description: '', responsibleUserId: '' };
  initialFile: File | null = null;
  readonly scope = ((): 'mine' | 'shared' | undefined => {
    const path = this.route.snapshot.routeConfig?.path;
    return path === 'documents/mine' ? 'mine' : path === 'documents/shared' ? 'shared' : undefined;
  })();
  readonly pageTitle = this.scope === 'mine' ? 'Mis documentos' : this.scope === 'shared' ? 'Compartidos conmigo' : 'Todos los documentos';
  readonly loading = signal(false);
  readonly apiError = signal('');
  readonly types = signal<ApiDocumentType[]>([]);
  readonly apiDocuments = signal<ApiDocument[]>([]);
  readonly totalDocuments = signal(0);
  readonly versions = signal<Record<string, ApiDocumentVersion[]>>({});
  readonly actionMessage = signal('');
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly typeFilter = signal('');
  readonly categoryFilter = signal('');
  readonly responsibleFilter = signal('');
  readonly creatorFilter = signal('');
  readonly areaFilter = signal('');
  readonly expedientFilter = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly sortBy = signal('updated');
  readonly page = signal(0);
  readonly pageSize = signal(10);
  readonly selectedDocument = signal<ApiDocument | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly uploadFile = signal<File | null>(null);
  uploadDocument: ApiDocument | null = null;
  uploadReason = '';
  readonly uploading = signal(false);
  readonly changingStatus = signal(false);
  readonly filteredDocuments = () => {
    const query = this.search().trim().toLowerCase();
    const matches = (value: string | null | undefined, filter: string) => !filter || (value || '').toLowerCase().includes(filter.toLowerCase());
    return [...this.apiDocuments()].filter(item => (!query || `${item.name} ${item.code}`.toLowerCase().includes(query))
      && (!this.statusFilter() || item.status === this.statusFilter())
      && matches(item.documentTypeId, this.typeFilter()) && matches(item.category, this.categoryFilter())
      && matches(item.responsibleUserName || item.responsibleUserId, this.responsibleFilter())
      && matches(item.creatorName || item.creatorId, this.creatorFilter()) && matches(item.area, this.areaFilter())
      && matches(item.expedientCode || item.expedientId, this.expedientFilter())
      && (!this.dateFrom() || (item.effectiveDate || item.createdAt) >= this.dateFrom())
      && (!this.dateTo() || (item.effectiveDate || item.createdAt).slice(0, 10) <= this.dateTo())).sort((a,b) => {
      if (this.sortBy() === 'name') return a.name.localeCompare(b.name);
      if (this.sortBy() === 'version') return (b.currentVersion || 0) - (a.currentVersion || 0);
      const field = this.sortBy() === 'created' ? 'createdAt' : 'updatedAt';
      return b[field].localeCompare(a[field]);
    });
  };
  readonly pagedDocuments = () => this.filteredDocuments();
  readonly totalPages = () => Math.max(1, Math.ceil(this.totalDocuments() / this.pageSize()));
  readonly statuses = [
    { code: 'DRAFT', label: 'Borrador', description: 'Edición inicial', tone: 'gray' },
    { code: 'PENDING', label: 'Pendiente', description: 'Esperando revisión', tone: 'amber' },
    { code: 'IN_REVIEW', label: 'En revisión', description: 'Validación en curso', tone: 'blue' },
    { code: 'APPROVED', label: 'Aprobado', description: 'Listo para uso', tone: 'green' },
    { code: 'ARCHIVED', label: 'Archivado', description: 'Fuera de circulación', tone: 'teal' },
  ];
  constructor() { if (!this.isStatuses) this.loadTypes(); }
  selectInitialFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] || null;
    const error = this.fileValidationError(file);
    this.initialFile = error ? null : file;
    this.createError.set(error);
  }
  createDocument(): void {
    this.createError.set('');
    if (!this.createForm.documentTypeId || !this.createForm.name.trim() || !this.createForm.code.trim()) return;
    if (this.isUploadRoute && !this.initialFile) {
      this.createError.set('Selecciona un archivo PDF, PNG, JPEG o DOCX de hasta 25 MB.');
      return;
    }
    const payload: DocumentCreatePayload = { ...this.createForm };
    if (!payload.description?.trim()) delete payload.description;
    if (!payload.expedientId?.trim()) delete payload.expedientId;
    if (!payload.responsibleUserId?.trim()) delete payload.responsibleUserId;
    this.creating.set(true);
    this.api.createDocument(payload).subscribe({
      next: document => {
        if (!this.initialFile) {
          this.creating.set(false);
          this.router.navigateByUrl('/documents');
          return;
        }
        this.api.uploadVersion(document.id, this.initialFile, 'Carga inicial').subscribe({
          next: () => { this.creating.set(false); this.router.navigateByUrl('/documents'); },
          error: () => {
            this.creating.set(false);
            this.createError.set(`El documento ${document.code} fue creado, pero no se pudo almacenar el archivo inicial. Puedes subirlo desde su detalle.`);
          },
        });
      },
      error: error => {
        this.creating.set(false);
        this.createError.set(error?.error?.message || 'No se pudo crear el documento. Revisa los datos e inténtalo nuevamente.');
      },
    });
  }
  loadTypes(): void {
    this.loading.set(true); this.apiError.set('');
    this.api.documentTypes().subscribe({ next: response => { this.types.set(response.content); }, error: () => undefined });
    this.api.documents(this.search(), this.statusFilter() || undefined, this.page(), this.pageSize(), this.scope).subscribe({
      next: response => {
        this.apiDocuments.set(response.content);
        this.totalDocuments.set(response.totalElements);
        this.apiError.set('');
        this.loading.set(false);
      },
      error: error => {
        this.apiDocuments.set([]);
        this.totalDocuments.set(0);
        this.apiError.set(error instanceof Error ? error.message : 'La API de documentos no respondió.');
        this.loading.set(false);
      },
    });
  }
  setSearch(event: Event): void { this.search.set((event.target as HTMLInputElement).value); this.page.set(0); this.loadTypes(); }
  setStatus(event: Event): void { this.statusFilter.set((event.target as HTMLSelectElement).value); this.page.set(0); this.loadTypes(); }
  setFilter(field: 'type' | 'category' | 'responsible' | 'creator' | 'area' | 'expedient' | 'dateFrom' | 'dateTo', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    ({ type: this.typeFilter, category: this.categoryFilter, responsible: this.responsibleFilter, creator: this.creatorFilter, area: this.areaFilter, expedient: this.expedientFilter, dateFrom: this.dateFrom, dateTo: this.dateTo }[field]).set(value);
    this.page.set(0);
  }
  clearFilters(): void {
    this.search.set(''); this.statusFilter.set(''); this.typeFilter.set(''); this.categoryFilter.set('');
    this.responsibleFilter.set(''); this.creatorFilter.set(''); this.areaFilter.set(''); this.expedientFilter.set('');
    this.dateFrom.set(''); this.dateTo.set('');
    this.sortBy.set('updated'); this.page.set(0); this.loadTypes();
  }
  setSort(event: Event): void { this.sortBy.set((event.target as HTMLSelectElement).value); this.page.set(0); }
  setPageSize(event: Event): void { this.pageSize.set(Number((event.target as HTMLSelectElement).value)); this.page.set(0); this.loadTypes(); }
  previousPage(): void { this.page.update(value => Math.max(0, value - 1)); this.loadTypes(); }
  nextPage(): void { this.page.update(value => Math.min(this.totalPages() - 1, value + 1)); this.loadTypes(); }
  openDetails(document: ApiDocument): void { this.selectedDocument.set(document); this.detailError.set(''); this.loadVersions(document); }
  closeDetails(): void { this.selectedDocument.set(null); }
  loadVersions(document: ApiDocument): void { this.detailLoading.set(true); this.detailError.set(''); this.api.versions(document.id).subscribe({next: versions => { this.versions.update(current => ({...current,[document.id]:versions})); this.detailLoading.set(false); },error:()=>{ this.detailLoading.set(false); this.detailError.set('No se pudo cargar el historial de versiones.'); this.actionMessage.set('No se pudieron cargar las versiones.'); }}); }
  uploadVersion(document: ApiDocument, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    const error = this.fileValidationError(file);
    if (error) {
      this.actionMessage.set(error);
      input.value = '';
      return;
    }
    this.uploadDocument = document;
    this.uploadFile.set(file);
    this.uploadReason = 'Carga de archivo';
    input.value = '';
  }
  cancelUpload(): void { this.uploadDocument=null; this.uploadFile.set(null); this.uploadReason=''; }
  confirmUpload(): void { const document=this.uploadDocument;const file=this.uploadFile();if(!document || !file || !this.uploadReason.trim())return;this.uploading.set(true);this.api.uploadVersion(document.id,file,this.uploadReason.trim()).subscribe({next:()=>{this.actionMessage.set('Versión almacenada correctamente.');this.loadVersions(document);this.loadTypes();this.uploading.set(false);this.cancelUpload();},error:()=>{this.actionMessage.set('No se pudo almacenar la versión.');this.uploading.set(false);}}); }
  download(document: ApiDocument, version: ApiDocumentVersion): void { this.api.downloadVersion(document.id,version.id).subscribe({next:blob=>{const url=URL.createObjectURL(blob);const link=window.document.createElement('a');link.href=url;link.download=version.fileName;link.click();URL.revokeObjectURL(url);},error:()=>this.actionMessage.set('No se pudo descargar la versión.')}); }
  changeStatus(document: ApiDocument, status: string): void {
    this.changingStatus.set(true);
    this.detailError.set('');
    this.api.changeStatus(document.id, status).subscribe({
      next: updated => {
        this.selectedDocument.set(updated);
        this.apiDocuments.update(items => items.map(item => item.id === updated.id ? updated : item));
        this.actionMessage.set(`Estado actualizado a ${this.statusLabel(updated.status)}.`);
        this.changingStatus.set(false);
      },
      error: error => {
        this.detailError.set(error?.error?.message || 'No se pudo actualizar el estado. Verifica los permisos y la transición.');
        this.changingStatus.set(false);
      },
    });
  }
  allowedStatusTransitions(document: ApiDocument): string[] {
    return ({
      DRAFT: ['PENDING', 'TRASHED'],
      PENDING: ['IN_REVIEW', 'REJECTED'],
      IN_REVIEW: ['APPROVED', 'REJECTED'],
      REJECTED: ['DRAFT', 'TRASHED'],
      APPROVED: ['CURRENT', 'ARCHIVED'],
      CURRENT: ['ARCHIVED', 'VOIDED'],
      ARCHIVED: ['CURRENT'],
      VOIDED: [],
      TRASHED: [],
    } as Record<string, string[]>)[document.status] ?? [];
  }
  statusLabel(status: string): string {
    return ({
      DRAFT: 'Borrador', PENDING: 'Pendiente', IN_REVIEW: 'En revisión',
      APPROVED: 'Aprobado', CURRENT: 'Vigente', ARCHIVED: 'Archivado',
      REJECTED: 'Rechazado', TRASHED: 'Papelera', VOIDED: 'Anulado',
    } as Record<string, string>)[status] ?? status;
  }
  private fileValidationError(file: File | null): string {
    if (!file) return 'Selecciona un archivo.';
    if (file.size > 25 * 1024 * 1024) return 'El archivo supera el límite de 25 MB.';
    const allowed = new Set([
      'application/pdf', 'image/jpeg', 'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    return allowed.has(file.type) ? '' : 'Solo se admiten archivos PDF, JPEG, PNG o DOCX.';
  }
}
