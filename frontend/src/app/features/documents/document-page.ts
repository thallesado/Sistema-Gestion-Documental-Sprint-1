import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DocumentApiService, ApiDocument, ApiDocumentType, ApiDocumentVersion } from '../../core/api/document-api.service';
import { documents } from '../../core/data/nexodocs-data';

@Component({
  selector: 'app-document-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="document-page">
      <header class="page-header">
        <div><p class="eyebrow">Documentos · {{ isStatuses ? 'Estados' : 'Catálogo' }}</p>
          <h1>{{ isStatuses ? 'Estados documentales' : 'Documentos' }}</h1>
          <p>{{ isStatuses ? 'Consulta el ciclo de vida definido por el dominio documental.' : 'Consulta y organiza la actividad documental del tenant activo.' }}</p>
        </div>
        @if (!isStatuses) { <a class="primary" routerLink="/documents/new">＋ Nuevo documento</a> }
      </header>

      @if (isStatuses) {
        <section class="notice warning"><b>API pendiente</b><span>El backend expone el modelo de estados, pero todavía no publica un endpoint de configuración. Esta vista es demo, no guarda cambios.</span></section>
        <section class="status-grid">
          @for (status of statuses; track status.code) {
            <article class="status-card"><span [class]="'status-dot ' + status.tone"></span><div><b>{{ status.label }}</b><small>{{ status.description }}</small><code>{{ status.code }}</code></div></article>
          }
        </section>
      } @else {
        @if (apiError()) { <div class="notice error" role="alert"><b>No se pudo consultar el catálogo documental.</b><span>{{ apiError() }}</span><button type="button" (click)="loadTypes()">Reintentar</button></div> }
        @if (loading()) { <div class="notice" role="status">Consultando tipos documentales…</div> }
        @if (usingDemo()) { <div class="notice"><b>Modo demo</b><span>La API documental no respondió; estos registros locales son solo referencia visual.</span></div> }
        @if (actionMessage()) { <div class="notice" role="status">{{ actionMessage() }}</div> }
        <section class="panel">
          <div class="toolbar"><div><h2>Actividad reciente</h2><p>{{ types().length ? 'Tipos documentales disponibles en la API.' : 'Documentos de ejemplo para revisar la interfaz.' }}</p></div><input aria-label="Filtrar documentos" placeholder="Buscar…" (input)="filter($event)"></div>
          <div class="document-list">
            @for (item of demoDocuments; track item.title) {
              <article class="document-row"><span class="file">DOC</span><div><b>{{ item.title }}</b><small>{{ item.meta }}</small></div><time>{{ item.date }}</time><span class="pill">{{ item.status }}</span></article>
            }
            @for (item of apiDocuments(); track item.id) {
              <article class="document-row"><span class="file">API</span><div><b>{{ item.name }}</b><small>{{ item.code }} · versión {{ item.currentVersion || 'sin archivo' }}</small>@for (version of versions()[item.id] || []; track version.id) { <button type="button" class="version-link" (click)="download(item, version)">v{{ version.versionNumber }} · {{ version.fileName }}</button> }</div><time>{{ item.createdAt | date:'dd/MM/yyyy' }}</time><span class="pill">{{ item.status }}</span><span class="document-actions"><button type="button" (click)="loadVersions(item)">Versiones</button><label>Subir<input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" (change)="uploadVersion(item, $event)" /></label></span></article>
            }
          </div>
          @if (types().length) { <h3 class="subheading">Tipos documentales del tenant</h3><div class="types">@for (type of types(); track type.id) { <span>{{ type.name }} <code>{{ type.code }}</code></span> }</div> }
        </section>
      }
    </section>
  `,
  styles: [`
    .document-page{max-width:1440px;margin:auto;padding:30px 36px 48px;color:#153a39}.page-header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin-bottom:22px}.eyebrow{color:#087f7b;text-transform:uppercase;font-size:11px;font-weight:800;letter-spacing:.08em}.page-header h1{font-size:34px;letter-spacing:-.04em;margin:6px 0}.page-header p:last-child,.toolbar p{color:#6b8583;font-size:13px;margin:0}.primary{background:#087f7b;color:white;padding:11px 15px;border-radius:9px;text-decoration:none;font-weight:800}.notice{display:flex;gap:10px;flex-wrap:wrap;background:#eef7ff;border:1px solid #cfe3f5;color:#356d9e;border-radius:10px;padding:12px;margin-bottom:15px;font-size:12px}.notice span{flex:1}.notice.error{background:#fff4f3;border-color:#f3d2d0;color:#a65050}.notice.warning{background:#fff8e8;border-color:#f3e1b6;color:#8b671c}.notice button{border:0;background:transparent;text-decoration:underline;color:inherit}.panel{background:#fff;border:1px solid #dcebe8;border-radius:16px;padding:20px}.toolbar{display:flex;justify-content:space-between;gap:15px;align-items:center;margin-bottom:15px}.toolbar h2{font-size:17px;margin:0 0 4px}.toolbar input{border:1px solid #dcebe8;border-radius:9px;padding:11px;min-width:190px}.document-list{display:grid;gap:4px}.document-row{display:grid;grid-template-columns:45px 1fr auto auto auto;gap:12px;align-items:center;padding:13px 8px;border-bottom:1px solid #edf3f1}.file{background:#dff7f3;color:#087f7b;border-radius:8px;padding:8px 4px;text-align:center;font-size:10px;font-weight:800}.document-row div{display:grid;gap:4px}.document-row small,.document-row time{color:#6b8583;font-size:11px}.pill{background:#e8f5ee;color:#28704b;border-radius:99px;padding:5px 8px;font-size:10px;font-weight:800}.document-actions{display:flex;gap:6px}.document-actions button,.document-actions label,.version-link{border:1px solid #bfeae5;background:#fff;color:#087f7b;border-radius:7px;padding:6px;cursor:pointer;font-size:10px}.document-actions input{display:none}.version-link{text-align:left}.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.status-card{background:#fff;border:1px solid #dcebe8;border-radius:14px;padding:17px;display:flex;gap:12px}.status-card div{display:grid;gap:5px}.status-card small{color:#6b8583;font-size:11px}.status-card code,.types code{font-size:10px;color:#087f7b}.status-dot{width:10px;height:10px;border-radius:50%;margin-top:4px;background:#9aa}.status-dot.teal{background:#087f7b}.status-dot.amber{background:#d99a26}.status-dot.blue{background:#4386c5}.status-dot.green{background:#3b9b69}.status-dot.gray{background:#899b9a}.subheading{font-size:14px;margin:22px 0 10px}.types{display:flex;gap:8px;flex-wrap:wrap}.types span{border:1px solid #dcebe8;border-radius:8px;padding:8px;font-size:12px}@media(max-width:700px){.document-page{padding:22px 16px}.page-header,.toolbar{display:grid}.page-header h1{font-size:28px}.status-grid{grid-template-columns:1fr}.document-row{grid-template-columns:42px 1fr}.document-row time,.document-row .pill,.document-actions{grid-column:2}.toolbar input{width:100%;box-sizing:border-box}}
  `],
})
export class DocumentPage {
  private readonly api = inject(DocumentApiService);
  private readonly route = inject(ActivatedRoute);
  readonly isStatuses = this.route.snapshot.routeConfig?.path === 'settings/statuses';
  readonly loading = signal(false);
  readonly apiError = signal('');
  readonly usingDemo = signal(false);
  readonly types = signal<ApiDocumentType[]>([]);
  readonly apiDocuments = signal<ApiDocument[]>([]);
  readonly versions = signal<Record<string, ApiDocumentVersion[]>>({});
  readonly actionMessage = signal('');
  readonly demoDocuments = documents.slice(0, 6);
  readonly statuses = [
    { code: 'DRAFT', label: 'Borrador', description: 'Edición inicial', tone: 'gray' },
    { code: 'PENDING', label: 'Pendiente', description: 'Esperando revisión', tone: 'amber' },
    { code: 'IN_REVIEW', label: 'En revisión', description: 'Validación en curso', tone: 'blue' },
    { code: 'APPROVED', label: 'Aprobado', description: 'Listo para uso', tone: 'green' },
    { code: 'ARCHIVED', label: 'Archivado', description: 'Fuera de circulación', tone: 'teal' },
  ];
  constructor() { if (!this.isStatuses) this.loadTypes(); }
  loadTypes(): void {
    this.loading.set(true); this.apiError.set('');
    this.api.documentTypes().subscribe({ next: response => { this.types.set(response.content); }, error: () => undefined });
    this.api.documents().subscribe({
      next: response => { this.apiDocuments.set(response.content); this.usingDemo.set(false); this.loading.set(false); },
      error: () => { this.usingDemo.set(true); this.apiError.set('La API de documentos no respondió; se conserva la referencia demo.'); this.loading.set(false); },
    });
  }
  filter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.api.documents(value).subscribe({ next: response => this.apiDocuments.set(response.content), error: () => this.usingDemo.set(true) });
  }
  loadVersions(document: ApiDocument): void { this.api.versions(document.id).subscribe({next: versions => this.versions.update(current => ({...current,[document.id]:versions})),error:()=>this.actionMessage.set('No se pudieron cargar las versiones.')}); }
  uploadVersion(document: ApiDocument, event: Event): void { const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;const reason=window.prompt('Motivo de la nueva versión','Carga de archivo');if(!reason){input.value='';return;}this.api.uploadVersion(document.id,file,reason).subscribe({next:()=>{this.actionMessage.set('Versión almacenada con checksum SHA-256.');this.loadVersions(document);this.loadTypes();input.value='';},error:()=>{this.actionMessage.set('No se pudo almacenar la versión.');input.value='';}}); }
  download(document: ApiDocument, version: ApiDocumentVersion): void { this.api.downloadVersion(document.id,version.id).subscribe({next:blob=>{const url=URL.createObjectURL(blob);const link=window.document.createElement('a');link.href=url;link.download=version.fileName;link.click();URL.revokeObjectURL(url);},error:()=>this.actionMessage.set('No se pudo descargar la versión.')}); }
}
