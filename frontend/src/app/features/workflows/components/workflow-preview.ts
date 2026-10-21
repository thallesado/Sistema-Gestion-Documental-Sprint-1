import { Component, Input, OnChanges, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DocumentApiService } from '../../../core/api/document-api.service';

@Component({
  selector: 'app-workflow-preview', standalone: true, imports: [CommonModule],
  template: `
    @if (loading()) { <p role="status">Cargando archivo…</p> }
    @if (error()) { <p role="alert">{{ error() }}</p> }
    @if (url()) {
      @if (mime() === 'application/pdf') { <iframe [src]="safeUrl()" title="Vista previa del documento" style="width:100%;height:480px;border:1px solid var(--line)"></iframe> }
      @else if (mime().startsWith('image/')) { <img [src]="url()" alt="Documento" style="max-width:100%;max-height:480px;object-fit:contain"> }
      @else { <p>Este formato no tiene visor disponible. Puedes descargar el archivo.</p> }
      <a [href]="url()" [download]="fileName()">Descargar {{ fileName() }}</a>
    }
    @for (v of versions(); track v.id) {
      <p>Versión {{ v.versionNumber }} · {{ v.createdAt | date:'short' }} · {{ v.changeReason || 'Sin resumen registrado' }}</p>
    }
  `,
})
export class WorkflowPreview implements OnChanges, OnDestroy {
  @Input() documentId: string | null = null;
  @Input() version: number | null = null;
  private readonly api = inject(DocumentApiService);
  private readonly sanitizer = inject(DomSanitizer);
  readonly url = signal(''); readonly safeUrl = signal<SafeResourceUrl | null>(null);
  readonly loading = signal(false); readonly error = signal(''); readonly mime = signal('');
  readonly versions = signal<any[]>([]); readonly fileName = signal('documento');
  private generation = 0;
  ngOnChanges(): void {
    this.generation++; const generation = this.generation;
    this.release(); this.error.set(''); this.versions.set([]);
    if (!this.documentId) return;
    this.loading.set(true); const documentId = this.documentId;
    this.api.versions(documentId).subscribe({ next: (list: any[]) => {
      if (generation !== this.generation) return;
      this.versions.set(list);
      const version = this.version ? list.find(v => v.versionNumber === this.version) : [...list].sort((a,b) => b.versionNumber-a.versionNumber)[0];
      if (!version) { this.error.set('El documento no tiene una versión descargable.'); this.loading.set(false); return; }
      this.fileName.set(version.fileName || 'documento');
      this.api.downloadVersion(documentId, version.id).subscribe({ next: blob => {
        if (generation !== this.generation) return;
        const url = URL.createObjectURL(blob); this.url.set(url); this.mime.set(blob.type || version.mimeType || '');
        this.safeUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url)); this.loading.set(false);
      }, error: () => { if (generation === this.generation) { this.error.set('No se pudo descargar el archivo o no tienes permiso.'); this.loading.set(false); } } });
    }, error: () => { this.error.set('No se pudieron consultar las versiones.'); this.loading.set(false); } });
  }
  private release(): void { if (this.url()) URL.revokeObjectURL(this.url()); this.url.set(''); this.safeUrl.set(null); }
  ngOnDestroy(): void { this.generation++; this.release(); }
}
