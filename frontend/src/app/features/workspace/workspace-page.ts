import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  demoList,
  DemoItem,
  RouteInfo,
  screenCopy,
} from '../../core/data/nexodocs-data';
import { Pagination } from '../../core/components/pagination/pagination';

type PageStat = { icon: string; label: string; value: string; detail: string; tone: string };
type OcrStatus = 'QUEUED' | 'PROCESSING' | 'REQUIRES_VALIDATION' | 'VALIDATED' | 'INDEXED';
type TabLink = { label: string; href: string };

@Component({
  selector: 'app-workspace-page',
  imports: [CommonModule, RouterLink, Pagination],
  template: `
    <section class="page">
      @if (isHome) {
        <section class="dashboard-welcome">
          <div>
            <p class="eyebrow">Miércoles, 16 de septiembre de 2026</p>
            <h1>Buenos días, Laura</h1>
            <p class="welcome-copy">Aquí tienes un resumen de lo que está ocurriendo en Acme Consulting.</p>
          </div>
          <div class="hero-actions">
            <a routerLink="/documents/new"><span>＋</span> Crear documento</a>
            <a routerLink="/documents/upload" class="secondary-action"><span>↑</span> Subir archivo</a>
          </div>
        </section>
        <div class="dashboard-grid">
          <article class="dashboard-card task-card">
            <div class="card-heading"><div><span class="card-icon amber">◷</span><div><h2>Mis tareas</h2><p>Requieren tu atención</p></div></div><a routerLink="/dashboard/tasks">Ver todas →</a></div>
            <div class="task-summary"><strong>8</strong><span>pendientes</span><b>3</b><span>alta prioridad</span></div>
            <div class="task-line"><span class="dot amber-dot"></span><div><b>Revisar contrato marco proveedores</b><small>Vence mañana · Legal</small></div><span class="status pending">Pendiente</span></div>
            <div class="task-line"><span class="dot blue-dot"></span><div><b>Aprobar política de seguridad</b><small>Vence en 3 días · Dirección</small></div><span class="status review">En revisión</span></div>
          </article>
          <article class="dashboard-card activity-card">
            <div class="card-heading"><div><span class="card-icon teal">↗</span><div><h2>Actividad reciente</h2><p>Últimos movimientos del tenant</p></div></div><a routerLink="/dashboard/activity">Ver actividad →</a></div>
            <div class="activity-row"><span class="activity-avatar">MG</span><div><b>María González aprobó un documento</b><small>Política de seguridad de la información</small></div><time>Hace 18 min</time></div>
            <div class="activity-row"><span class="activity-avatar blue">CM</span><div><b>Carlos Méndez subió un archivo</b><small>Contrato marco proveedores 2025</small></div><time>Hace 1 h</time></div>
            <div class="activity-row"><span class="activity-avatar purple">AR</span><div><b>Ana López completó un workflow</b><small>Alta de proveedor · EXP-2041</small></div><time>Ayer</time></div>
          </article>
        </div>
        <section class="panel dashboard-documents">
          <div class="panel-title"><div><h2>Documentos recientes</h2><p>Los documentos que han tenido actividad recientemente.</p></div><a routerLink="/documents">Ver todos →</a></div>
          <div class="list document-list">
            @for (item of pagedDocuments(); track item.title) {
              <article>
                <span class="file-icon">{{ fileType(item) }}</span>
                <div><h3>{{ item.title }}</h3><p>{{ item.meta }}</p></div>
                <time>{{ item.date }}</time><span [class]="statusClass(item)">{{ item.status }}</span>
                <div class="row-actions">
                  <button class="more-button" type="button" (click)="toggleRowMenu(item.title)" [attr.aria-expanded]="openRowMenu === item.title" aria-label="Abrir opciones">•••</button>
                  @if (openRowMenu === item.title) {
                    <div class="row-menu">
                      <button type="button" (click)="rowAction('Ver', item.title)">Ver</button>
                      <button type="button" (click)="rowAction('Editar', item.title)">Editar</button>
                      <button type="button" class="danger-action" (click)="rowAction('Eliminar', item.title)">Eliminar</button>
                    </div>
                  }
                </div>
              </article>
            }
          </div>
          <app-pagination
            [total]="documents.length"
            [page]="dashboardPage()"
            [pageSize]="dashboardPageSize()"
            (pageChange)="dashboardPage.set($event)"
            (pageSizeChange)="changeDashboardPageSize($event)"
          />
        </section>
      } @else {
        <header class="module-header">
          <div class="module-icon">{{ moduleIcon }}</div>
          <div class="module-heading">
            <p class="eyebrow">{{ routeInfo.module }} <span>·</span> {{ routeInfo.subcategory }}</p>
            <h1>{{ routeInfo.subcategory }}</h1>
            <p>{{ copy.description }}</p>
          </div>
          @if (isExpedientsModule) {
            <div class="action-menu">
              <button type="button" class="module-action" (click)="actionMenuOpen = !actionMenuOpen" [attr.aria-expanded]="actionMenuOpen">
                <span>＋</span>Nueva acción
              </button>
              @if (actionMenuOpen) {
                <div class="action-menu-panel">
                  <a routerLink="/expedients/new" (click)="actionMenuOpen = false"><b>＋</b><span><strong>Crear expediente</strong><small>Registra una nueva unidad documental</small></span></a>
                  <button type="button" (click)="handleExpedientAction('Importar expedientes')"><b>⇧</b><span><strong>Importar expedientes</strong><small>Preparar una carga masiva de demostración</small></span></button>
                  <button type="button" (click)="handleExpedientAction('Iniciar workflow')"><b>↗</b><span><strong>Iniciar workflow</strong><small>Asocia un proceso al expediente activo</small></span></button>
                </div>
              }
            </div>
          } @else if (!isOcrFlow) {
            <button type="button" class="module-action" (click)="isUploadPage ? triggerFilePicker() : actionMessage = copy.action + ' preparado'"><span>{{ actionIcon }}</span>{{ copy.action }}</button>
          }
        </header>
      }

      @if (!isHome) {
        <div class="stats">
          @for (stat of stats; track stat.label) {
            <article>
              <span class="stat-icon" [class]="stat.tone">{{ stat.icon }}</span>
              <div><small>{{ stat.label }}</small><strong>{{ stat.value }}</strong><p>{{ stat.detail }}</p></div>
            </article>
          }
        </div>
      }

      @if (isScanPage) {
        <section class="panel scan-panel">
          <div class="panel-title"><div><h2>Selecciona el origen del documento</h2><p>La captura es local y queda preparada para una futura integración con OCR.</p></div><span class="status muted">Demo local</span></div>
          <div class="scan-source-grid">
            <article class="scan-source">
              <span class="scan-source-icon">↑</span><h3>Subir archivo</h3><p>Selecciona un PDF o una imagen desde este dispositivo.</p>
              <input #uploadInput type="file" accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff" (change)="onFileSelected($event, 'Carga de archivo')" />
              <button type="button" class="source-button" (click)="uploadInput.click()">Elegir archivo</button>
            </article>
            <article class="scan-source">
              <span class="scan-source-icon">▣</span><h3>Tomar foto</h3><p>Usa la cámara del teléfono para capturar un documento.</p>
              <input #cameraInput type="file" accept="image/*" capture="environment" (change)="onFileSelected($event, 'Cámara móvil')" />
              <button type="button" class="source-button" (click)="cameraInput.click()">Abrir cámara</button>
            </article>
            <article class="scan-source scanner-stub">
              <span class="scan-source-icon">▤</span><h3>Escáner conectado</h3><p>Conecta un escáner de escritorio compatible para importar sus páginas.</p>
              <span class="stub-label">STUB · INTEGRACIÓN DE ESCRITORIO PENDIENTE</span>
              <button type="button" class="source-button secondary-source" (click)="useScannerStub()">Simular conexión</button>
            </article>
          </div>
          @if (selectedFileName !== 'Ningún archivo seleccionado') {
            <div class="scan-selection" role="status"><span>✓</span><div><strong>{{ selectedFileName }}</strong><small>Origen: {{ selectedSource }}</small></div><button type="button" (click)="startOcr()">Iniciar procesamiento OCR</button></div>
          }
        </section>
      } @else if (isOcrFlow) {
        <section class="ocr-workspace">
          <nav class="step-tabs" aria-label="Pasos del procesamiento OCR">
            @for (tab of ocrTabs; track tab.href) {
              <a [routerLink]="tab.href" [class.active]="routeInfo.href === tab.href" [attr.aria-current]="routeInfo.href === tab.href ? 'step' : null"><span>{{ tab.label === 'Validación y extracción' ? '1' : tab.label === 'Indexación' ? '2' : '3' }}</span>{{ tab.label }}</a>
            }
          </nav>
          <div class="ocr-grid">
            <article class="panel ocr-source-card">
              <div class="panel-title"><div><h2>Documento origen</h2><p>Entrada seleccionada para este proceso</p></div><span class="status review">{{ ocrStatus() }}</span></div>
              <div class="ocr-file"><span class="file-icon">PDF</span><div><strong>{{ ocrFileName }}</strong><small>Origen: digitalización local · 2.4 MB</small></div></div>
              <dl class="ocr-details"><div><dt>Identificador</dt><dd>OCR-2026-0098</dd></div><div><dt>Páginas</dt><dd>4 páginas</dd></div><div><dt>Confianza</dt><dd>91.4%</dd></div></dl>
              <p class="simulated-note"><b>Estado real de la demo</b><span>{{ ocrStatusDescription }}</span></p>
            </article>
            <article class="panel ocr-result-card">
              <div class="panel-title"><div><h2>Resultado OCR</h2><p>Texto extraído y resumen para revisión humana</p></div><span class="status ok">Texto disponible</span></div>
              <div class="ocr-summary"><span class="side-kicker">RESUMEN EXTRAÍDO</span><p>Contrato marco de prestación de servicios para proveedores de Acme Consulting, con vigencia anual y cláusulas de renovación.</p></div>
              <div class="extracted-text"><span class="side-kicker">TEXTO EXTRAÍDO</span><p>“Las partes acuerdan establecer las condiciones generales para la prestación de servicios profesionales. La vigencia del presente documento será de doce meses...”</p></div>
              @if (ocrStep === 'validation') {
                <div class="ocr-actions"><button type="button" class="secondary-button" (click)="rejectOcr()">Rechazar resultado</button><button type="button" class="primary-button" (click)="validateOcr()">Confirmar extracción</button></div>
              } @else if (ocrStep === 'indexing') {
                <div class="metadata-preview"><label>Tipo documental <select><option>Contrato</option><option>Informe</option></select></label><label>Área <select><option>Legal</option><option>Compras</option></select></label><button type="button" class="primary-button" (click)="indexOcr()">Guardar indexación</button></div>
              } @else {
                <div class="metadata-preview"><label>Responsable <input value="Laura Martinez" /></label><label>Etiqueta <input value="proveedores-2026" /></label><button type="button" class="primary-button" (click)="correctMetadata()">Confirmar metadatos</button></div>
              }
            </article>
          </div>
        </section>
      } @else if (isFormPage) {
        <div class="content-grid">
          <form class="panel form-panel" (submit)="$event.preventDefault(); actionMessage = 'Borrador guardado localmente'">
            <div class="form-title"><h2>{{ routeInfo.subcategory }}</h2><span class="required-note">* Campos obligatorios</span></div>
            <div class="form-fields">
              <label>Nombre <input placeholder="Ej. Contrato marco proveedores" /></label>
              <label>Responsable <input placeholder="Laura Martinez" /></label>
              <label>Área <select><option>Dirección</option><option>Legal</option><option>Archivo</option></select></label>
              <label>Tipo documental <select><option>Contrato</option><option>Política</option><option>Informe</option></select></label>
            </div>
            @if (isUploadPage) {
              <label class="file-picker">Archivo
                <input #fileInput type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" (change)="onFileSelected($event, 'Carga de archivo')" />
                <button type="button" (click)="fileInput.click()">Seleccionar archivo</button>
                <small>{{ selectedFileName }}</small>
              </label>
            }
            <label>Descripción <textarea rows="5" placeholder="Resumen operativo del documento"></textarea></label>
            <div class="form-actions"><button type="button" class="cancel-button">Cancelar</button><button type="submit">Guardar borrador</button></div>
          </form>
          <aside class="panel note-panel">
            <span class="side-kicker">GUÍA RÁPIDA</span><h2>Completa la información</h2>
            <p>Los datos de clasificación ayudan a encontrar y proteger los documentos de tu organización.</p>
            <ul><li>Usa un nombre descriptivo y único.</li><li>Asigna un responsable para el seguimiento.</li><li>Podrás agregar versiones y permisos después.</li></ul>
            <div class="simulated-note"><b>Operación simulada</b><span>Esta pantalla no guarda datos porque todavía no existe backend ni API autenticada.</span></div>
          </aside>
        </div>
      } @else if (!isHome) {
        <section class="panel list-panel">
          @if (isDocumentsHub) {
            <nav class="internal-tabs" aria-label="Vistas de documentos">
              @for (tab of documentTabs; track tab.href) {
                <a [routerLink]="tab.href" [class.active]="routeInfo.href === tab.href">{{ tab.label }}</a>
              }
            </nav>
          }
          <div class="panel-title"><div><h2>{{ listTitle }}</h2><p>Datos de demostración filtrados por el tenant actual.</p></div>
            <div class="export-menu">
              <button type="button" class="panel-action" (click)="exportMenuOpen = !exportMenuOpen" [attr.aria-expanded]="exportMenuOpen">↓ Exportar</button>
              @if (exportMenuOpen) {
                <div class="row-menu export-options">
                  <button type="button" (click)="exportAs('PDF')">Exportar a PDF</button>
                  <button type="button" (click)="exportAs('Excel')">Exportar a Excel</button>
                </div>
              }
            </div>
          </div>
          @if (isExpedientList) {
            <div class="filter-toolbar" aria-label="Filtros de expedientes">
              <label><span>Estado</span><select [value]="expedientStatus()" (change)="setExpedientStatus($event)"><option value="">Todos</option><option>Activo</option><option>Cerrado</option><option>Archivado</option><option>Bloqueado</option></select></label>
              <label><span>Área</span><select [value]="expedientArea()" (change)="setExpedientArea($event)"><option value="">Todas</option>@for (area of expedientAreas; track area) {<option [value]="area">{{ area }}</option>}</select></label>
              <label><span>Desde</span><input type="date" [value]="dateFrom()" (change)="setDateFrom($event)" /></label>
              <label><span>Hasta</span><input type="date" [value]="dateTo()" (change)="setDateTo($event)" /></label>
            </div>
          }
          <div class="list-toolbar"><label><span>⌕</span><input placeholder="Buscar en este módulo..." [value]="searchTerm()" (input)="setSearchTerm($event)" /></label>@if (!isExpedientList) {<button type="button" (click)="actionMessage = 'Usa las pestañas internas para cambiar el filtro de documentos'">Estado · Área · Fecha</button>}</div>
          <div class="list">
            @for (item of visibleItems(); track item.title) {
              <article>
                <span class="file-icon">{{ fileType(item) }}</span>
                <div class="list-main"><h3>{{ item.title }}</h3><p>{{ item.meta }}</p></div>
                <time>{{ item.date }}</time><span [class]="statusClass(item)">{{ item.status }}</span>
                <div class="row-actions">
                  <button class="more-button" type="button" (click)="toggleRowMenu(item.title)" [attr.aria-expanded]="openRowMenu === item.title" aria-label="Abrir opciones">•••</button>
                  @if (openRowMenu === item.title) {
                    <div class="row-menu">
                      <button type="button" (click)="rowAction('Ver', item.title)">Ver</button>
                      <button type="button" (click)="rowAction('Editar', item.title)">Editar</button>
                      <button type="button" class="danger-action" (click)="rowAction('Eliminar', item.title)">Eliminar</button>
                    </div>
                  }
                </div>
              </article>
            } @empty {
              <div class="empty-state"><strong>No hay resultados con estos filtros</strong><span>Prueba una combinación diferente de estado, área o fecha.</span></div>
            }
          </div>
          <app-pagination [total]="filteredItems().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="changePageSize($event)" />
        </section>
      }

      @if (actionMessage) { <div class="inline-toast" role="status">{{ actionMessage }}</div> }
      <footer class="demo-note"><span>ⓘ</span> Vista de demostración con datos simulados de <b>Acme Consulting</b>. No realiza operaciones persistentes.</footer>
    </section>
  `,
})
export class WorkspacePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;
  readonly routeInfo = this.route.snapshot.data['routeInfo'] as RouteInfo;
  readonly copy = screenCopy(this.routeInfo);
  readonly items = demoList(this.routeInfo.module);
  readonly documents = demoList('Documentos');
  readonly isHome = this.routeInfo.href === '/';
  readonly isFormPage = ['Crear', 'Nuevo', 'Subir'].some((word) => this.routeInfo.subcategory.includes(word));
  readonly isUploadPage = this.routeInfo.subcategory.includes('Subir');
  readonly isExpedientsModule = this.routeInfo.module === 'Expedientes';
  readonly isExpedientList = this.isExpedientsModule && !this.isFormPage;
  readonly isDocumentsHub = this.routeInfo.module === 'Documentos' && !this.isFormPage;
  readonly isScanPage = this.routeInfo.href === '/digitization';
  readonly isOcrFlow = ['/digitization/ocr', '/digitization/validation', '/digitization/indexing', '/digitization/metadata'].includes(this.routeInfo.href);
  readonly ocrStep = this.routeInfo.href === '/digitization/indexing' ? 'indexing' : this.routeInfo.href === '/digitization/metadata' ? 'metadata' : 'validation';
  readonly documentTabs: TabLink[] = [
    { label: 'Todos', href: '/documents' }, { label: 'Recientes', href: '/documents/recent' }, { label: 'Pendientes', href: '/documents/pending' },
    { label: 'En revisión', href: '/documents/in-review' }, { label: 'Aprobados', href: '/documents/approved' }, { label: 'Archivados', href: '/documents/archived' }, { label: 'Papelera', href: '/documents/trash' },
  ];
  readonly ocrTabs: TabLink[] = [
    { label: 'Validación y extracción', href: '/digitization/ocr' }, { label: 'Indexación', href: '/digitization/indexing' }, { label: 'Corrección de metadatos', href: '/digitization/metadata' },
  ];
  readonly expedientAreas = ['Compras', 'Legal', 'Calidad', 'Operaciones'];
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly dashboardPage = signal(1);
  readonly dashboardPageSize = signal(10);
  readonly searchTerm = signal('');
  readonly expedientStatus = signal('');
  readonly expedientArea = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  selectedFileName = 'Ningún archivo seleccionado';
  selectedSource = 'Sin seleccionar';
  actionMessage = '';
  actionMenuOpen = false;
  openRowMenu = '';
  exportMenuOpen = false;
  readonly ocrStatus = signal<OcrStatus>('REQUIRES_VALIDATION');
  readonly ocrFileName = 'contrato-marco-proveedores-2025.pdf';
  readonly stats: PageStat[] = this.buildStats(this.routeInfo.module);

  readonly filteredItems = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const status = this.expedientStatus();
    const area = this.expedientArea();
    const from = this.dateFrom();
    const to = this.dateTo();
    return this.items.filter((item) => {
      const matchesQuery = !query || `${item.title} ${item.meta}`.toLowerCase().includes(query);
      const matchesStatus = !this.isExpedientList || !status || item.status === status;
      const matchesArea = !this.isExpedientList || !area || item.area === area;
      const matchesFrom = !this.isExpedientList || !from || (item.createdAt ?? '') >= from;
      const matchesTo = !this.isExpedientList || !to || (item.createdAt ?? '') <= to;
      const matchesDocumentTab = !this.isDocumentsHub || this.documentMatchesCurrentTab(item);
      return matchesQuery && matchesStatus && matchesArea && matchesFrom && matchesTo && matchesDocumentTab;
    });
  });

  readonly visibleItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.filteredItems().slice(start, start + this.pageSize());
  });

  readonly pagedDocuments = computed(() => {
    const start = (this.dashboardPage() - 1) * this.dashboardPageSize();
    return this.documents.slice(start, start + this.dashboardPageSize());
  });

  get listTitle(): string {
    if (this.isDocumentsHub) return 'Documentos';
    if (this.isExpedientsModule) return 'Expedientes';
    return `${this.routeInfo.module} recientes`;
  }

  get moduleIcon(): string {
    return ({ Documentos: '▤', Expedientes: '▱', Digitalizacion: '⌗', Workflows: '↗', 'Usuarios y equipos': '♙', Auditoria: '◌', Reportes: '▥', Notificaciones: '♢', Configuracion: '⚙', Tenants: '⌂' } as Record<string, string>)[this.routeInfo.module] ?? '✦';
  }

  get actionIcon(): string { return this.isFormPage ? '＋' : '↗'; }
  get ocrStatusDescription(): string {
    return this.ocrStatus() === 'INDEXED' ? 'Resultado indexado y listo para consulta.' : this.ocrStatus() === 'VALIDATED' ? 'Extracción confirmada por revisión humana.' : 'Requiere validación humana antes de indexar.';
  }

  statusClass(item: DemoItem): string {
    const base = 'status ';
    if (['Aprobado', 'Activo', 'Completado'].includes(item.status)) return `${base}ok`;
    if (item.status.includes('revision')) return `${base}review`;
    if (item.status === 'Pendiente') return `${base}pending`;
    if (['Bloqueado', 'Suspendido'].includes(item.status)) return `${base}danger`;
    return `${base}muted`;
  }

  fileType(item: DemoItem): string {
    const type = item.meta.split(' - ')[1] ?? '';
    return type.length <= 4 && type ? type : this.routeInfo.module === 'Workflows' ? 'WF' : 'DOC';
  }

  triggerFilePicker(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event, source: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      input.value = '';
      this.actionMessage = 'El archivo supera el límite de 25 MB';
      return;
    }
    this.selectedFileName = `${file.name} (${this.formatFileSize(file.size)})`;
    this.selectedSource = source;
    this.actionMessage = 'Archivo seleccionado localmente; aún no se ha enviado a un servidor';
  }

  startOcr(): void {
    this.ocrStatus.set('QUEUED');
    this.actionMessage = 'Documento encolado para OCR simulado';
    void this.router.navigateByUrl('/digitization/ocr');
  }

  useScannerStub(): void {
    this.selectedSource = 'Escáner conectado (stub de escritorio)';
    this.selectedFileName = 'captura-escaner-demo.pdf (1.1 MB)';
    this.actionMessage = 'Stub de escáner activado: falta integrar el conector de escritorio';
  }

  handleExpedientAction(action: string): void {
    this.actionMenuOpen = false;
    this.actionMessage = `${action}: acción preparada para la demo local, sin persistencia`;
  }

  setSearchTerm(event: Event): void { this.searchTerm.set((event.target as HTMLInputElement).value); this.resetPage(); }
  setExpedientStatus(event: Event): void { this.expedientStatus.set((event.target as HTMLSelectElement).value); this.resetPage(); }
  setExpedientArea(event: Event): void { this.expedientArea.set((event.target as HTMLSelectElement).value); this.resetPage(); }
  setDateFrom(event: Event): void { this.dateFrom.set((event.target as HTMLInputElement).value); this.resetPage(); }
  setDateTo(event: Event): void { this.dateTo.set((event.target as HTMLInputElement).value); this.resetPage(); }
  resetPage(): void { this.page.set(1); }
  changePageSize(size: number): void { this.pageSize.set(size); this.page.set(1); }
  changeDashboardPageSize(size: number): void { this.dashboardPageSize.set(size); this.dashboardPage.set(1); }

  toggleRowMenu(title: string): void {
    this.openRowMenu = this.openRowMenu === title ? '' : title;
    this.exportMenuOpen = false;
  }

  rowAction(action: string, title: string): void {
    this.openRowMenu = '';
    this.actionMessage = `${action} "${title}": operación preparada para la API`;
  }

  exportAs(format: string): void {
    this.exportMenuOpen = false;
    this.actionMessage = `Exportación a ${format} preparada para la API`;
  }

  validateOcr(): void { this.ocrStatus.set('VALIDATED'); this.actionMessage = 'Extracción confirmada; el documento queda listo para indexar'; }
  rejectOcr(): void { this.ocrStatus.set('PROCESSING'); this.actionMessage = 'Resultado marcado para reprocesamiento manual'; }
  indexOcr(): void { this.ocrStatus.set('INDEXED'); this.actionMessage = 'Documento indexado en el estado local de demostración'; }
  correctMetadata(): void { this.ocrStatus.set('INDEXED'); this.actionMessage = 'Metadatos corregidos y confirmados localmente'; }

  private documentMatchesCurrentTab(item: DemoItem): boolean {
    const href = this.routeInfo.href;
    if (href === '/documents/pending') return item.status === 'Pendiente';
    if (href === '/documents/in-review') return item.status === 'En revision';
    if (href === '/documents/approved') return item.status === 'Aprobado';
    if (href === '/documents/archived') return item.status === 'Archivado';
    if (href === '/documents/trash') return item.status === 'Papelera';
    return true;
  }

  private formatFileSize(size: number): string {
    if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  private buildStats(module: string): PageStat[] {
    const values: Record<string, PageStat[]> = {
      Inicio: [{ icon: '▤', label: 'Registros', value: '1,248', detail: 'Tenant actual', tone: 'teal' }, { icon: '◷', label: 'Pendientes', value: '24', detail: 'Requieren atención', tone: 'amber' }, { icon: '↗', label: 'Actividad mensual', value: '+12.5%', detail: 'Comparado con mayo', tone: 'green' }],
      Documentos: [{ icon: '▤', label: 'Documentos', value: '1,248', detail: '+12 esta semana', tone: 'teal' }, { icon: '◷', label: 'Pendientes', value: '24', detail: '8 requieren acción', tone: 'amber' }, { icon: '✓', label: 'Aprobados', value: '1,106', detail: '88.6% del total', tone: 'green' }],
      Expedientes: [{ icon: '▱', label: 'Expedientes', value: '86', detail: 'Tenant actual', tone: 'teal' }, { icon: '◷', label: 'Pendientes', value: '12', detail: 'Requieren atención', tone: 'amber' }, { icon: '✓', label: 'Activos', value: '64', detail: '74.4% del total', tone: 'green' }],
      Workflows: [{ icon: '↗', label: 'Activos', value: '32', detail: '8 requieren acción', tone: 'blue' }, { icon: '◷', label: 'Tiempo promedio', value: '2.4 días', detail: '-8% este mes', tone: 'teal' }, { icon: '✓', label: 'Completados', value: '148', detail: '96% dentro del plazo', tone: 'green' }],
      Digitalizacion: [{ icon: '⌗', label: 'En cola', value: '18', detail: '126 páginas', tone: 'blue' }, { icon: '✦', label: 'Confianza media', value: '91.4%', detail: 'Extracción OCR', tone: 'green' }, { icon: '!', label: 'Requieren validación', value: '7', detail: 'Confianza menor a 80%', tone: 'amber' }],
      Notificaciones: [{ icon: '♢', label: 'No leídas', value: '6', detail: '2 de alta prioridad', tone: 'amber' }],
    };
    return values[module] ?? values['Inicio'];
  }
}
