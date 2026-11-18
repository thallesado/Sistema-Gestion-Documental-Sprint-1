import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { DocumentOperationsApi, OperationPage, OperationRow, operationError } from '../../core/api/document-operations-api.service';
import { PermissionService } from '../../core/auth/permission.service';

@Component({
  selector: 'app-translations-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  styleUrl: './operations.css',
  template: `
<main class="operations">
  <header class="hero">
    <span class="eyebrow">DOCUMENTOS · REVISIÓN EDITORIAL Y DERIVADOS</span>
    <h1>Traducción documental</h1>
    <p>Revisa y edita segmentos lado a lado con el original. La creación de solicitudes y la publicación de copias derivadas están deshabilitadas hasta implementar la traducción real.</p>
    <nav class="links">
      @if(can('document:read')){<a routerLink="/documents">Todos los documentos</a>}
      @if(can('delivery:read')){<a routerLink="/deliveries">Entregas externas</a>}
      @if(can('mail-intake:read')){<a routerLink="/mail-intake">Buzón documental</a>}
      @if(can('physical:read')){<a routerLink="/physical-archive">Archivo físico</a>}
      <a routerLink="/translations">Traducciones</a>
    </nav>
  </header>

  @if(error()){<div class="error" role="alert">{{error()}}</div>}
  @if(message()){<div class="success" role="status">{{message()}}</div>}

  <section class="card">
    <form class="filters" (ngSubmit)="page=0;load()">
      <input name="search" [(ngModel)]="search" placeholder="Buscar por código o título" aria-label="Buscar solicitudes de traducción">
      <select name="status" [(ngModel)]="status" aria-label="Estado">
        <option value="">Todos los estados</option>
        <option value="REVIEW_PENDING">Pendiente de revisión</option>
        <option value="CHANGES_REQUESTED">Cambios solicitados</option>
        <option value="PUBLISHED">Publicado</option>
        <option value="FAILED">Fallido</option>
        <option value="CANCELLED">Cancelado</option>
      </select>
      <button [disabled]="loading()">Buscar</button>
      @if(creationEnabled && can('translation:create')){
        <button type="button" class="primary" (click)="openNewDialog()">Nueva traducción</button>
      }
      @if(can('translation:configure')){
        <button type="button" (click)="openGlossaryDialog()">Glosario técnico</button>
      }
    </form>
  </section>

  @if(loading()){<p role="status">Cargando traducciones…</p>}

  <section class="card table-wrap">
    <table>
      <thead>
        <tr>
          <th>DOCUMENTO ORIGEN</th>
          <th>VERSIÓN / IDIOMAS</th>
          <th>SOLICITADO POR</th>
          <th>ESTADO</th>
          <th>ACCIÓN</th>
        </tr>
      </thead>
      <tbody>
        @for(r of rows(); track r.id){
          <tr>
            <td>
              <strong>{{r['document_code']}}</strong><br>{{r['document_name']}}
            </td>
            <td>
              v{{r['version_number']}} · {{r['source_language']?.toUpperCase()}} &rarr; {{r['target_language']?.toUpperCase()}}
              @if(r['is_outdated']){
                <br><span class="badge warning" title="El original tiene una versión posterior">Desactualizado (v{{r['doc_current_version']}} vigente)</span>
              }
            </td>
            <td>{{r['requester_name'] || 'Usuario'}}<br><small>{{r['created_at'] | date:'short'}}</small></td>
            <td><span class="badge" [class.success]="r['status']==='PUBLISHED'" [class.warning]="r['status']==='REVIEW_PENDING'">{{label(r['status'])}}</span></td>
            <td>
              <a [routerLink]="['/translations', r.id]">Revisar y ver segmentos</a>
            </td>
          </tr>
        } @empty {
          <tr>
            <td colspan="5" class="empty">{{loading() ? 'Consultando…' : 'No hay solicitudes de traducción registradas.'}}</td>
          </tr>
        }
      </tbody>
    </table>

    <div class="pagination">
      <span>{{total()}} solicitudes</span>
      <button [disabled]="page===0||loading()" (click)="page=page-1;load()">Anterior</button>
      <span>Página {{page+1}}</span>
      <button [disabled]="(page+1)*20>=total()||loading()" (click)="page=page+1;load()">Siguiente</button>
    </div>
  </section>

  <!-- Modal: Nueva Traducción -->
  <dialog #newDialog>
    <div class="dialog-head">
      <h2>Nueva solicitud de traducción</h2>
      <button (click)="newDialog.close()" aria-label="Cerrar modal">Cerrar</button>
    </div>
    @if(error()){<p role="alert" class="error">{{error()}}</p>}
    <form (ngSubmit)="submitRequest()" #nf="ngForm">
      <div class="grid">
        <label class="wide">
          Documento aprobado
          <select name="selectedDoc" [(ngModel)]="newReq.docIndex" (change)="onDocSelected()" required>
            <option value="">Selecciona un documento</option>
            @for(d of options()['documents']||[]; track d.id; let i = $index){
              <option [value]="i">{{d.code}} · {{d.name}} (v{{d.version_number}})</option>
            }
          </select>
        </label>
        <label>
          Idioma origen
          <select name="sourceLang" [(ngModel)]="newReq.sourceLanguage" required>
            @for(l of options()['languages']||[]; track l.code){
              <option [value]="l.code">{{l.name}}</option>
            }
          </select>
        </label>
        <label>
          Idioma destino
          <select name="targetLang" [(ngModel)]="newReq.targetLanguage" required>
            @for(l of options()['languages']||[]; track l.code){
              <option [value]="l.code">{{l.name}}</option>
            }
          </select>
        </label>
        <label class="check wide">
          <input type="checkbox" name="consent" [(ngModel)]="newReq.consent" required>
          Confirmo que el documento puede ser procesado por el motor de traducción y que se requerirá revisión humana antes de publicar.
        </label>
      </div>
      <div class="actions">
        <button type="button" (click)="newDialog.close()">Cancelar</button>
        <button class="primary" [disabled]="nf.invalid||busy()">Iniciar traducción</button>
      </div>
    </form>
  </dialog>

  <!-- Panel de Revisión Lado a Lado -->
  @if(detail(); as d){
    <section class="card" #reviewSection>
      <div class="dialog-head">
        <div>
          <span class="eyebrow">REVISIÓN LADO A LADO · {{d['source_language']?.toUpperCase()}} &rarr; {{d['target_language']?.toUpperCase()}}</span>
          <h2>{{d['document_code']}} · {{d['document_name']}}</h2>
        </div>
        <a routerLink="/translations">Cerrar revisión</a>
      </div>

      <p>
        <span class="badge" [class.success]="d['status']==='PUBLISHED'">{{label(d['status'])}}</span>
        · Solicitado: {{d['created_at'] | date:'medium'}} · Caracteres: {{d['char_count']}}
      </p>

      @if(d['is_outdated']){
        <div class="notice" role="alert">
          <strong>Atención:</strong> El documento original ha recibido una nueva versión (v{{d['doc_current_version']}}) posterior a la versión utilizada en esta traducción (v{{d['version_number']}}). La copia generada reflejará la versión histórica.
        </div>
      }

      <div class="actions" style="margin-bottom: 1.5rem;">
        @if(creationEnabled && can('translation:publish') && d['status'] !== 'PUBLISHED' && d['status'] !== 'CANCELLED'){
          <button class="primary" [disabled]="busy()" (click)="publishTranslation(d)">Publicar copia derivada</button>
        }
        @if(d['status'] === 'REVIEW_PENDING' && can('translation:create')){
          <button class="danger" [disabled]="busy()" (click)="cancelTranslation(d)">Cancelar solicitud</button>
        }
        @if(d['status'] === 'PUBLISHED'){
          <span class="badge success">Copia derivada publicada en el módulo de Documentos</span>
        }
      </div>

      <h3>Segmentos para revisión editorial</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 8%;">ORDEN</th>
              <th style="width: 44%;">TEXTO ORIGINAL ({{d['source_language']?.toUpperCase()}})</th>
              <th style="width: 48%;">TRADUCCIÓN EDITABLE ({{d['target_language']?.toUpperCase()}})</th>
            </tr>
          </thead>
          <tbody>
            @for(s of d['segments']||[]; track s.id){
              <tr>
                <td><strong>#{{s.segment_order}}</strong><br><small>{{label(s.status)}}</small></td>
                <td><div style="white-space: pre-wrap; font-size: 0.95rem;">{{s.source_text}}</div></td>
                <td>
                  @if(can('translation:review') && (d['status'] === 'REVIEW_PENDING' || d['status'] === 'CHANGES_REQUESTED')){
                    <textarea rows="3" [(ngModel)]="s.reviewed_text" style="width: 100%; margin-bottom: 0.5rem;"></textarea>
                    <div style="display: flex; gap: 0.5rem;">
                      <button type="button" [disabled]="busy()" (click)="saveSegment(d.id, s, 'MODIFIED')">Guardar edición</button>
                      <button type="button" class="primary" [disabled]="busy()" (click)="saveSegment(d.id, s, 'ACCEPTED')">Aceptar segmento</button>
                    </div>
                  } @else {
                    <div style="white-space: pre-wrap; font-size: 0.95rem;">{{s.reviewed_text || s.translated_text}}</div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  }

  <!-- Modal: Glosario Técnico -->
  <dialog #glossaryDialog>
    <div class="dialog-head">
      <h2>Glosario técnico de traducción</h2>
      <button (click)="glossaryDialog.close()" aria-label="Cerrar modal">Cerrar</button>
    </div>
    <form (ngSubmit)="saveGlossaryTerm()" #gf="ngForm">
      <div class="grid">
        <label>
          Término origen
          <input name="srcTerm" [(ngModel)]="newGlossary.sourceTerm" required maxlength="200" placeholder="Ej: Clinical Episode">
        </label>
        <label>
          Traducción aprobada
          <input name="tgtTerm" [(ngModel)]="newGlossary.targetTerm" required maxlength="200" placeholder="Ej: Episodio Clínico">
        </label>
      </div>
      <div class="actions">
        <button class="primary" [disabled]="gf.invalid||busy()">Guardar término</button>
      </div>
    </form>
    <h3>Términos guardados</h3>
    <ul>
      @for(g of options()['glossary']||[]; track g.id){
        <li>
          <strong>{{g.source_term}}</strong> &rarr; {{g.target_term}}
          <button (click)="deleteGlossaryTerm(g.id)">Eliminar</button>
        </li>
      } @empty {
        <li class="empty">No hay términos registrados en el glosario.</li>
      }
    </ul>
  </dialog>
</main>
`
})
export class TranslationsPage {
  readonly api = inject(DocumentOperationsApi);
  readonly permissions = inject(PermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  @ViewChild('newDialog') newDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('glossaryDialog') glossaryDialog!: ElementRef<HTMLDialogElement>;

  readonly rows = signal<OperationRow[]>([]);
  readonly total = signal(0);
  readonly options = signal<Record<string, any>>({});
  readonly detail = signal<OperationRow | null>(null);
  readonly error = signal('');
  readonly message = signal('');
  readonly loading = signal(false);
  readonly busy = signal(false);

  search = '';
  status = '';
  page = 0;

  newReq: any = { docIndex: '', sourceLanguage: 'en', targetLanguage: 'es', consent: false };
  newGlossary: any = { sourceTerm: '', targetTerm: '', sourceLanguage: 'en', targetLanguage: 'es' };

  constructor() {
    this.load();
    this.route.paramMap.subscribe(p => {
      const id = p.get('id');
      if (id) this.loadDetail(id);
      else this.detail.set(null);
    });
  }

  /** DocumentTranslationService.create/publish responden 503 hasta implementar la traducción real. */
  readonly creationEnabled = false;

  can(p: string): boolean {
    return this.permissions.can(p);
  }

  label(s: string): string {
    return ({
      QUEUED: 'En cola',
      EXTRACTING: 'Extrayendo texto',
      TRANSLATING: 'Traduciendo',
      REVIEW_PENDING: 'Pendiente de revisión',
      PUBLISHED: 'Publicado',
      CHANGES_REQUESTED: 'Cambios solicitados',
      CANCELLED: 'Cancelado',
      FAILED: 'Fallido',
      TRANSLATED: 'Traducido',
      ACCEPTED: 'Aceptado',
      MODIFIED: 'Modificado',
      REJECTED: 'Rechazado'
    } as Record<string, string>)[s] || s;
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      list: this.api.get<OperationPage>('translations/requests', { search: this.search, status: this.status, page: this.page }),
      options: this.api.get<Record<string, any>>('translations/options')
    }).subscribe({
      next: r => {
        this.rows.set(r.list.content);
        this.total.set(r.list.totalElements);
        this.options.set(r.options);
        this.loading.set(false);
      },
      error: e => {
        this.error.set(operationError(e));
        this.loading.set(false);
      }
    });
  }

  loadDetail(id: string): void {
    this.api.get<OperationRow>('translations/requests/' + id).subscribe({
      next: r => {
        for (const s of r['segments'] || []) {
          if (!s.reviewed_text) s.reviewed_text = s.translated_text;
        }
        this.detail.set(r);
      },
      error: e => this.error.set(operationError(e))
    });
  }

  openNewDialog(): void {
    this.newReq = { docIndex: '', sourceLanguage: 'en', targetLanguage: 'es', consent: false };
    this.error.set('');
    this.newDialog.nativeElement.showModal();
  }

  onDocSelected(): void {
    // defaults source language to en
  }

  submitRequest(): void {
    const docs = this.options()['documents'] || [];
    const doc = docs[this.newReq.docIndex];
    if (!doc) return;

    this.busy.set(true);
    this.error.set('');
    this.api.post<OperationRow>('translations/requests', {
      documentId: doc.id,
      versionId: doc.version_id,
      sourceLanguage: this.newReq.sourceLanguage,
      targetLanguage: this.newReq.targetLanguage,
      consent: this.newReq.consent
    }).subscribe({
      next: r => {
        this.busy.set(false);
        this.message.set('Solicitud de traducción iniciada correctamente.');
        this.newDialog.nativeElement.close();
        this.load();
        void this.router.navigate(['/translations', r.id]);
      },
      error: e => {
        this.busy.set(false);
        this.error.set(operationError(e));
      }
    });
  }

  saveSegment(reqId: string, segment: any, status: string): void {
    this.busy.set(true);
    this.error.set('');
    this.api.patch('translations/requests/' + reqId + '/segments/' + segment.id, {
      reviewedText: segment.reviewed_text,
      status: status
    }).subscribe({
      next: () => {
        this.busy.set(false);
        segment.status = status;
        this.message.set('Segmento actualizado.');
      },
      error: e => {
        this.busy.set(false);
        this.error.set(operationError(e));
      }
    });
  }

  publishTranslation(d: OperationRow): void {
    const title = prompt('Título para el documento derivado:', '[' + d['target_language']?.toUpperCase() + '] ' + d['document_name']);
    if (title === null) return;

    this.busy.set(true);
    this.error.set('');
    this.api.post('translations/requests/' + d.id + '/publish', { title }).subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set('Copia derivada publicada con éxito en el módulo documental.');
        this.load();
        this.loadDetail(d.id);
      },
      error: e => {
        this.busy.set(false);
        this.error.set(operationError(e));
      }
    });
  }

  cancelTranslation(d: OperationRow): void {
    const reason = prompt('Indica el motivo de cancelación:');
    if (reason === null) return;

    this.busy.set(true);
    this.api.post('translations/requests/' + d.id + '/cancel', { reason }).subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set('Solicitud cancelada.');
        this.load();
        this.loadDetail(d.id);
      },
      error: e => {
        this.busy.set(false);
        this.error.set(operationError(e));
      }
    });
  }

  openGlossaryDialog(): void {
    this.newGlossary = { sourceTerm: '', targetTerm: '', sourceLanguage: 'en', targetLanguage: 'es' };
    this.glossaryDialog.nativeElement.showModal();
  }

  saveGlossaryTerm(): void {
    this.busy.set(true);
    this.api.post('translations/glossary', this.newGlossary).subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set('Término añadido al glosario.');
        this.newGlossary = { sourceTerm: '', targetTerm: '', sourceLanguage: 'en', targetLanguage: 'es' };
        this.load();
      },
      error: e => {
        this.busy.set(false);
        this.error.set(operationError(e));
      }
    });
  }

  deleteGlossaryTerm(id: string): void {
    if (!confirm('¿Eliminar este término del glosario?')) return;
    this.busy.set(true);
    this.api.delete('translations/glossary/' + id).subscribe({
      next: () => {
        this.busy.set(false);
        this.message.set('Término eliminado.');
        this.load();
      },
      error: e => {
        this.busy.set(false);
        this.error.set(operationError(e));
      }
    });
  }
}
