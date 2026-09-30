import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DocumentApiService, ApiDocument, ApiDocumentType, ApiDocumentVersion, DocumentCreatePayload } from '../../../core/api/document-api.service';
import { Pagination } from '../../../shared';
import { exportToCsv, exportToJson, exportToPrintView, ExportColumn } from '../../../core/utils/export-utils';
import { DocumentStatusGridComponent, DocStatusItem } from '../../../widgets/documents/document-status-grid.component';
import { DocumentCreateFormComponent } from '../../../widgets/documents/document-create-form.component';
import { DocumentModalsComponent } from '../../../widgets/documents/document-modals.component';
import { DocumentCatalogListComponent } from '../../../widgets/documents/document-catalog-list.component';
import { DocumentFilterBarComponent } from '../../../widgets/documents/document-filter-bar.component';
import { DocumentHeroBannerComponent } from '../../../widgets/documents/document-hero-banner.component';

@Component({
  selector: 'app-document-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Pagination,
    DocumentStatusGridComponent,
    DocumentCreateFormComponent,
    DocumentModalsComponent,
    DocumentCatalogListComponent,
    DocumentFilterBarComponent,
    DocumentHeroBannerComponent
  ],
  template: `
    <section class="page">
      <app-document-hero-banner [isStatuses]="isStatuses" [scope]="scope" [pageTitle]="pageTitle" />

      @if (isStatuses) {
        <app-document-status-grid [statuses]="statuses" />
      } @else {
        @if (isCreateRoute) {
          <app-document-create-form
            [form]="createForm"
            [types]="types()"
            [isUploadRoute]="isUploadRoute"
            [creating]="creating()"
            [createError]="createError()"
            [hasFile]="!!initialFile"
            (submit)="createDocument()"
            (fileChange)="selectInitialFile($event)"
          />
        }

        @if (apiError()) { <div class="notice error" role="alert"><b>No se pudo consultar el catálogo.</b><span>{{ apiError() }}</span><button type="button" (click)="loadTypes()">Reintentar</button></div> }
        @if (loading()) { <div class="notice" role="status">Consultando catálogo documental…</div> }
        @if (actionMessage()) { <div class="notice" role="status">{{ actionMessage() }}</div> }

        <app-document-filter-bar
          [pageTitle]="pageTitle"
          [scope]="scope"
          [searchFilter]="searchFilter()"
          [statusFilter]="statusFilter()"
          [typeFilter]="typeFilter()"
          [sortBy]="sortBy()"
          [types]="types()"
          [statuses]="statuses"
          (filterChange)="setFilter($event.key, $event.event)"
          (sortChange)="setSort($event)"
          (exportCsv)="exportDocuments('Excel')"
          (clearFilters)="clearFilters()"
        />

        <app-document-catalog-list
          [documents]="pagedDocuments()"
          [loading]="loading()"
          [hasItems]="apiDocuments().length > 0"
          (openDetails)="openDetails($event)"
          (loadVersions)="loadVersions($event)"
          (uploadVersion)="uploadVersion($event.doc, $event.event)"
        />

        @if (filteredDocuments().length > pageSize) {
          <app-pagination [page]="page()" [pageSize]="pageSize" [total]="filteredDocuments().length" (pageChange)="page.set($event)" />
        }
      }

      <app-document-modals
        [selectedDoc]="selectedDoc()"
        [showVersionModal]="showVersionModal()"
        [versionTargetDoc]="versionTargetDoc()"
        [versions]="versions()"
        [loadingVersions]="loadingVersions()"
        (closeDetail)="selectedDoc.set(null)"
        (closeVersions)="showVersionModal.set(false)"
      />
    </section>
  `
})
export class DocumentosPage {
  private readonly documentApi = inject(DocumentApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly isCreateRoute = this.route.snapshot.url.some(s => s.path === 'new' || s.path === 'upload');
  readonly isUploadRoute = this.route.snapshot.url.some(s => s.path === 'upload');
  readonly isStatuses = this.route.snapshot.url.some(s => s.path === 'statuses');
  readonly scope = this.route.snapshot.url.some(s => s.path === 'mine') ? 'mine' : null;

  readonly pageTitle = this.scope === 'mine' ? 'Mis documentos' : 'Catálogo documental';
  readonly pageSize = 10;
  readonly page = signal(1);

  readonly apiDocuments = signal<ApiDocument[]>([]);
  readonly types = signal<ApiDocumentType[]>([]);
  readonly versions = signal<ApiDocumentVersion[]>([]);
  readonly selectedDoc = signal<ApiDocument | null>(null);
  readonly versionTargetDoc = signal<ApiDocument | null>(null);

  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly loadingVersions = signal(false);
  readonly showVersionModal = signal(false);

  readonly apiError = signal<string | null>(null);
  readonly createError = signal<string | null>(null);
  readonly actionMessage = signal<string | null>(null);

  readonly searchFilter = signal('');
  readonly statusFilter = signal('');
  readonly typeFilter = signal('');
  readonly sortBy = signal('updated');

  initialFile: File | null = null;
  createForm: DocumentCreatePayload = { name: '', code: '', documentTypeId: '', expedientId: '', issueDate: '', expiryDate: '', description: '', responsibleUserId: '' };

  readonly statuses: DocStatusItem[] = [
    { code: 'DRAFT', label: 'Borrador', tone: 'status-gray', description: 'Documento en edición preliminar.' },
    { code: 'IN_REVIEW', label: 'En revisión', tone: 'status-amber', description: 'Pendiente de validación o control.' },
    { code: 'APPROVED', label: 'Aprobado', tone: 'status-green', description: 'Documento oficial validado y vigente.' },
    { code: 'OBSOLETE', label: 'Obsoleto', tone: 'status-red', description: 'Reemplazado por una versión posterior.' },
    { code: 'ARCHIVED', label: 'Archivado', tone: 'status-blue', description: 'En custodia definitiva.' }
  ];

  readonly filteredDocuments = computed(() => {
    let list = this.apiDocuments();
    const search = this.searchFilter().trim().toLowerCase();
    const status = this.statusFilter();
    const type = this.typeFilter();

    if (search) list = list.filter(d => (d.name ?? '').toLowerCase().includes(search) || (d.code ?? '').toLowerCase().includes(search));
    if (status) list = list.filter(d => d.status === status);
    if (type) list = list.filter(d => d.documentTypeId === type);

    return [...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  });

  readonly pagedDocuments = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredDocuments().slice(start, start + this.pageSize);
  });

  constructor() {
    this.loadTypes();
    this.loadDocuments();
  }

  loadTypes(): void {
    this.documentApi.types().subscribe({
      next: res => this.types.set(res.content || []),
      error: err => this.apiError.set(err?.message || 'Error al cargar tipos.')
    });
  }

  loadDocuments(): void {
    this.loading.set(true);
    const obs = this.scope === 'mine' ? this.documentApi.mine() : this.documentApi.list();
    obs.subscribe({
      next: res => { this.apiDocuments.set(res.content || []); this.loading.set(false); },
      error: err => { this.apiError.set(err?.message || 'Error al cargar documentos.'); this.loading.set(false); }
    });
  }

  setFilter(key: 'search' | 'status' | 'type', event: Event): void {
    const val = (event.target as HTMLInputElement | HTMLSelectElement).value;
    if (key === 'search') this.searchFilter.set(val);
    else if (key === 'status') this.statusFilter.set(val);
    else if (key === 'type') this.typeFilter.set(val);
    this.page.set(1);
  }

  setSort(event: Event): void { this.sortBy.set((event.target as HTMLSelectElement).value); }
  clearFilters(): void { this.searchFilter.set(''); this.statusFilter.set(''); this.typeFilter.set(''); this.page.set(1); }

  selectInitialFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) this.initialFile = input.files[0];
  }

  createDocument(): void {
    this.creating.set(true);
    this.createError.set(null);
    this.documentApi.create(this.createForm).subscribe({
      next: doc => {
        if (this.isUploadRoute && this.initialFile) {
          this.documentApi.uploadVersion(doc.id, this.initialFile, 'Carga inicial').subscribe({
            next: () => { this.creating.set(false); this.router.navigate(['/documents']); },
            error: err => { this.creating.set(false); this.createError.set(err?.message || 'Error al subir archivo.'); }
          });
        } else {
          this.creating.set(false);
          this.router.navigate(['/documents']);
        }
      },
      error: err => { this.creating.set(false); this.createError.set(err?.message || 'Error al crear documento.'); }
    });
  }

  openDetails(doc: ApiDocument): void { this.selectedDoc.set(doc); }

  loadVersions(doc: ApiDocument): void {
    this.versionTargetDoc.set(doc);
    this.showVersionModal.set(true);
    this.loadingVersions.set(true);
    this.documentApi.versions(doc.id).subscribe({
      next: v => { this.versions.set(v); this.loadingVersions.set(false); },
      error: () => this.loadingVersions.set(false)
    });
  }

  uploadVersion(doc: ApiDocument, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.documentApi.uploadVersion(doc.id, file, 'Nueva versión').subscribe({
      next: () => { this.actionMessage.set(`Nueva versión subida para ${doc.name}`); this.loadDocuments(); },
      error: err => this.actionMessage.set(err?.message || 'Error al subir versión.')
    });
  }

  exportDocuments(format: 'Excel' | 'PDF' | 'JSON'): void {
    const cols: ExportColumn[] = [{ label: 'Código', key: 'code' }, { label: 'Nombre', key: 'name' }, { label: 'Estado', key: 'status' }];
    if (format === 'Excel') exportToCsv(this.filteredDocuments(), 'documentos.csv', cols);
    else if (format === 'JSON') exportToJson(this.filteredDocuments(), 'documentos.json');
    else if (format === 'PDF') exportToPrintView('Catálogo Documental', 'Listado de documentos', this.filteredDocuments(), cols);
  }
}

export const DocumentPage = DocumentosPage;
