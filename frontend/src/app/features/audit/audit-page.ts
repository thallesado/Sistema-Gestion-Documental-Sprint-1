import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DemoSessionState } from '../../core/state/demo-session';
import { RouteInfo } from '../../core/data/nexodocs-data';
import { ApiAuditEvent, AuditApiService } from '../../core/api/audit-api.service';
import { AuditEventDrawer, AuditDrawerDetail } from './components/audit-event-drawer';
import { AuditFilterField, AuditFilters } from './components/audit-filters';
import { AuditPagination } from './components/audit-pagination';
import {
  ApprovalRecord,
  approvals,
  AuditEvent,
  auditEvents,
  AuditView,
  AccessSession,
  accessSessions,
  CreationActivity,
  documentCreations,
  DeletionRecord,
  deletions,
  DownloadRecord,
  downloads,
  ModificationRecord,
  modifications,
  PermissionRecord,
  permissionChanges,
  auditViewFromPath,
} from './data/audit-mock';

@Component({
  selector: 'app-audit-page',
  standalone: true,
  imports: [CommonModule, AuditEventDrawer, AuditFilters, AuditPagination],
  template: `
    <section class="page audit-page">
      <header class="audit-page-header">
        <div class="audit-title">
          <div class="audit-module-icon">◌</div>
          <div><p class="eyebrow">Auditoría <span>·</span> {{ pageTitle }}</p><h1>{{ pageTitle }}</h1><p>{{ pageDescription }}</p></div>
        </div>
        <div class="audit-header-actions">
          @if (isSuperAdmin()) {
            <label class="audit-tenant-selector"><span>Tenant visual</span><select [value]="tenant()" (change)="changeTenant($event)"><option>Acme Consulting</option><option>Clínica Central</option><option>Universidad del Valle</option></select></label>
          }
          <button type="button" class="audit-export-button" (click)="exportAudit()">↓ Exportar</button>
        </div>
      </header>

      <div class="audit-searchbar">
        <label><span aria-hidden="true">⌕</span><input [value]="globalSearch()" (input)="setGlobalSearch($event)" placeholder="Buscar en este módulo: usuario, documento, IP o acción..." aria-label="Buscar en el módulo Auditoría" /></label>
        <span class="audit-search-note">{{ usingApi() ? 'Auditoría persistente' : 'Referencia visual' }} · {{ tenant() }}</span>
      </div>

      @if (view === 'general') {
        <app-audit-filters [fields]="generalFilters" [values]="filterValues()" (valuesChange)="setFilters($event)" />
        <div class="audit-general-layout">
          <section class="audit-feed-card">
            <div class="audit-section-heading"><div><span class="section-kicker">TRAZABILIDAD EN VIVO</span><h2>Actividad reciente</h2><p>Registro cronológico de acciones relevantes del tenant.</p></div><span class="live-indicator"><i></i> Demo local</span></div>
            <div class="audit-timeline">
              @for (event of visibleEvents(); track event.id) {
                <button type="button" class="audit-event-row" (click)="openEvent(event)">
                  <span class="audit-event-icon" [class]="event.tone">{{ event.icon }}</span><span class="audit-event-line"></span>
                  <span class="audit-event-main"><span class="audit-event-top"><b>{{ event.user }}</b><span class="audit-action-badge" [class]="actionClass(event.action)">{{ event.action }}</span></span><strong>{{ event.resource }}</strong><small>{{ event.module }} · {{ event.timestamp }} · {{ event.ip }}</small></span>
                  <span class="audit-result" [class]="resultClass(event.result)">{{ event.result }}</span><span class="audit-chevron">›</span>
                </button>
              } @empty { <div class="audit-empty">No hay eventos para los filtros actuales.</div> }
            </div>
            <app-audit-pagination [total]="filteredEvents().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="changePageSize($event)" />
          </section>
          <aside class="audit-control-card">
            <span class="section-kicker">LECTURA DE CONTROL</span><h2>Salud de la trazabilidad</h2><p>La actividad se presenta como una bitácora inmutable de demostración.</p>
            <div class="control-status"><span class="control-check">✓</span><div><strong>Registro operativo</strong><small>{{ filteredEvents().length }} eventos visibles</small></div></div>
            <div class="control-list"><div><span>Acciones exitosas</span><b>{{ successfulEvents() }}</b></div><div><span>Requieren atención</span><b class="warning-text">{{ attentionEvents() }}</b></div><div><span>Retención de muestra</span><b>7 años</b></div></div>
            <div class="audit-legend"><span><i class="teal"></i> Acción completada</span><span><i class="amber"></i> Pendiente</span><span><i class="rose"></i> Rechazada</span></div>
          </aside>
        </div>
      } @else if (view === 'access') {
        <app-audit-filters [fields]="accessFilters" [values]="filterValues()" (valuesChange)="setFilters($event)" />
        <div class="access-summary-strip">
          <div><span class="summary-icon teal">◉</span><span><small>Sesiones activas</small><b>{{ activeSessions() }}</b></span></div>
          <div><span class="summary-icon blue">⌁</span><span><small>IPs observadas</small><b>{{ uniqueIps() }}</b></span></div>
          <div><span class="summary-icon amber">!</span><span><small>Bloqueadas hoy</small><b>{{ blockedSessions() }}</b></span></div>
          <div class="technical-summary"><span class="section-kicker">RESUMEN TÉCNICO</span><b>RLS pendiente de API</b><small>El navegador no valida sesiones reales.</small></div>
        </div>
        <section class="audit-panel access-ledger">
          <div class="audit-section-heading"><div><span class="section-kicker">SEGURIDAD</span><h2>Sesiones y accesos</h2><p>Cada fila representa una sesión simulada y sus acciones.</p></div><span class="security-chip">◉ Monitoreo local</span></div>
          <div class="audit-table-wrap"><table class="audit-table"><thead><tr><th>Usuario</th><th>Estado</th><th>Inicio / fin</th><th>Duración</th><th>Dispositivo e IP</th><th>Acciones</th><th></th></tr></thead><tbody>
            @for (session of visibleSessions(); track session.id) { <tr (click)="openSession(session)"><td><b>{{ session.user }}</b><small>{{ session.role }}</small></td><td><span class="audit-result" [class]="sessionStatusClass(session.status)">{{ session.status }}</span></td><td><b>{{ session.start }}</b><small>{{ session.end }}</small></td><td>{{ session.duration }}</td><td><b>{{ session.device }}</b><small>{{ session.ip }} · {{ session.browser }}</small></td><td>{{ session.actions }}</td><td><button type="button" class="table-link" (click)="openSession(session); $event.stopPropagation()">Detalle</button></td></tr> }
          </tbody></table></div>
          <app-audit-pagination [total]="filteredSessions().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="changePageSize($event)" />
        </section>
      } @else if (view === 'creation') {
        <app-audit-filters [fields]="creationFilters" [values]="filterValues()" (valuesChange)="setFilters($event)" />
        <section class="creation-board">
          @for (group of creationGroups(); track group.label) { <div class="creation-group"><div class="date-divider"><span>{{ group.label }}</span><i></i><b>{{ group.items.length }} actividades</b></div>
            @for (item of group.items; track item.id) { <article class="creation-card"><span class="creation-doc-icon">{{ item.type.slice(0, 3).toUpperCase() }}</span><div class="creation-content"><div class="creation-card-top"><span class="audit-action-badge creation-badge">Documento creado</span><time>{{ item.date }}</time></div><h2>{{ item.document }}</h2><p>{{ item.type }} · {{ item.area }} · {{ item.origin }}</p><div class="creation-meta"><span><i class="mini-avatar">{{ initials(item.creator) }}</i>{{ item.creator }}</span><span class="audit-result" [class]="resultClass(item.status)">{{ item.status }}</span></div></div><div class="creation-actions"><button type="button" (click)="viewCreation(item, 'Ver documento')">Ver documento</button><button type="button" (click)="viewCreation(item, 'Ver usuario')">Ver usuario</button><button type="button" class="icon-action" aria-label="Ver evento" (click)="viewCreation(item, 'Ver evento')">›</button></div></article> }
          </div> }
          <app-audit-pagination [total]="filteredCreations().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="changePageSize($event)" />
        </section>
      } @else if (view === 'modifications') {
        <app-audit-filters [fields]="modificationFilters" [values]="filterValues()" (valuesChange)="setFilters($event)" />
        <div class="modification-split">
          <section class="audit-panel modification-list"><div class="audit-section-heading"><div><span class="section-kicker">HISTORIAL</span><h2>Versiones recientes</h2><p>Selecciona un registro para inspeccionar el diff.</p></div></div>
            @for (item of filteredModifications(); track item.id) { <button type="button" class="modification-item" [class.selected]="selectedModificationId() === item.id" (click)="selectModification(item)"><span class="modification-file">v{{ item.version.slice(1) }}</span><span><b>{{ item.document }}</b><small>{{ item.user }} · {{ item.timestamp }}</small><em>{{ item.summary }}</em></span><span>›</span></button> }
            <app-audit-pagination [total]="filteredModifications().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="changePageSize($event)" />
          </section>
          @if (selectedModification()) { <section class="audit-panel diff-detail"><div class="audit-section-heading"><div><span class="section-kicker">COMPARACIÓN DE VERSIONES</span><h2>{{ selectedModification()!.document }}</h2><p>{{ selectedModification()!.user }} · {{ selectedModification()!.timestamp }}</p></div><button type="button" class="outline-button" (click)="compareVersions()">Comparar {{ selectedModification()!.previousVersion }} / {{ selectedModification()!.version }}</button></div><div class="version-line"><span>{{ selectedModification()!.previousVersion }}</span><i></i><b>{{ selectedModification()!.version }} actual</b></div><div class="diff-grid"><div><h3>Antes · {{ selectedModification()!.previousVersion }}</h3>@for (field of selectedModification()!.fields; track field.field) { <div class="diff-field before"><small>{{ field.field }}</small><span>{{ field.before }}</span></div> }</div><div><h3>Después · {{ selectedModification()!.version }}</h3>@for (field of selectedModification()!.fields; track field.field) { <div class="diff-field after"><small>{{ field.field }}</small><span>{{ field.after }}</span></div> }</div></div><div class="simulated-note"><b>Comparador documental</b><span>Stub visual: la comparación binaria completa estará disponible cuando exista el endpoint de versiones.</span></div></section> }
        </div>
      } @else if (view === 'downloads') {
        <app-audit-filters [fields]="downloadFilters" [values]="filterValues()" (valuesChange)="setFilters($event)" />
        <section class="audit-panel download-ledger"><div class="audit-section-heading"><div><span class="section-kicker">DOWNLOAD LEDGER</span><h2>Descargas registradas</h2><p>Consulta quién obtuvo una copia y desde qué contexto técnico.</p></div><span class="ledger-count">{{ filteredDownloads().length }} registros</span></div><div class="audit-table-wrap"><table class="audit-table"><thead><tr><th>Archivo</th><th>Versión</th><th>Usuario / rol</th><th>Fecha</th><th>Contexto técnico</th><th>Tamaño</th><th></th></tr></thead><tbody>@for (item of visibleDownloads(); track item.id) { <tr (click)="openDownload(item)"><td><b>{{ item.document }}</b><small>{{ item.type }} · {{ item.id }}</small></td><td><span class="version-badge">{{ item.version }}</span></td><td><b>{{ item.user }}</b><small>{{ item.role }}</small></td><td>{{ item.date }}</td><td><b>{{ item.device }}</b><small>{{ item.ip }} · {{ item.browser }}</small></td><td>{{ item.size }}</td><td><button type="button" class="table-link" (click)="openDownload(item); $event.stopPropagation()">Detalle</button></td></tr> }</tbody></table></div><app-audit-pagination [total]="filteredDownloads().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="changePageSize($event)" /></section>
      } @else if (view === 'approvals') {
        <app-audit-filters [fields]="approvalFilters" [values]="filterValues()" (valuesChange)="setFilters($event)" />
        <section class="approval-board">@for (item of filteredApprovals(); track item.id) {         <article class="approval-card"><div class="approval-card-heading"><div><span class="section-kicker">{{ item.workflow }}</span><h2>{{ item.document }}</h2><small>{{ item.date }} · {{ item.duration }}</small></div><span class="audit-result" [class]="resultClass(item.status)">{{ item.status }}</span></div><div class="approval-stepper">@for (step of item.steps; track step; let index = $index) { <div class="approval-step" [class.done]="index < item.currentStep" [class.current]="index === item.currentStep"><span>{{ index < item.currentStep ? '✓' : index + 1 }}</span><b>{{ step }}</b><small>{{ item.participants[index] || 'Pendiente' }}</small></div>@if (index < item.steps.length - 1) { <i></i> } }</div><div class="approval-footer"><span><i class="mini-avatar">{{ initials(item.user) }}</i> Última acción por <b>{{ item.user }}</b></span><button type="button" class="table-link" (click)="openApproval(item)">Ver detalle →</button></div></article> }<app-audit-pagination [total]="filteredApprovals().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="changePageSize($event)" /></section>
      } @else if (view === 'deletions') {
        <div class="critical-banner"><span>!</span><div><b>Zona de acciones críticas</b><small>Las eliminaciones son lógicas y quedan registradas. Restaurar requiere permiso y una API autenticada.</small></div></div>
        <app-audit-filters [fields]="deletionFilters" [values]="filterValues()" (valuesChange)="setFilters($event)" />
        <section class="deletion-list">@for (item of filteredDeletions(); track item.id) { <article class="deletion-card"><span class="deletion-mark">!</span><div class="deletion-main"><div><span class="audit-action-badge deletion-badge">{{ item.kind }}</span><time>{{ item.date }}</time></div><h2>{{ item.resource }}</h2><p>{{ item.reason }} · Ejecutado por {{ item.deletedBy }}</p></div><span class="audit-result" [class]="item.status === 'Ejecutado' ? 'success' : 'warning'">{{ item.status }}</span><button type="button" class="table-link" (click)="openDeletion(item)">Detalle</button>@if (item.restoreAllowed) { <button type="button" class="restore-button" (click)="restore(item)">Restaurar</button> }</article> }<app-audit-pagination [total]="filteredDeletions().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="changePageSize($event)" /></section>
      } @else {
        <app-audit-filters [fields]="permissionFilters" [values]="filterValues()" (valuesChange)="setFilters($event)" />
        <section class="audit-panel permission-panel"><div class="audit-section-heading"><div><span class="section-kicker">RBAC AUDIT</span><h2>Cambios de permisos</h2><p>Antes y después de cada modificación de roles o permisos.</p></div><span class="rbac-chip">RBAC visual</span></div><div class="audit-table-wrap"><table class="audit-table permission-table"><thead><tr><th>Usuario afectado</th><th>Modificador</th><th>Rol antes / después</th><th>Permisos agregados</th><th>Permisos eliminados</th><th>Fecha</th><th></th></tr></thead><tbody>@for (item of filteredPermissions(); track item.id) { <tr (click)="openPermission(item)"><td><b>{{ item.affectedUser }}</b><small>{{ item.resource }}</small></td><td>{{ item.modifiedBy }}</td><td><span class="role-before">{{ item.previousRole }}</span><span class="role-arrow">→</span><span class="role-after">{{ item.newRole }}</span></td><td>@for (permission of item.added; track permission) { <span class="permission-pill added">+ {{ permission }}</span> } @if (!item.added.length) { <span class="muted-cell">—</span> }</td><td>@for (permission of item.removed; track permission) { <span class="permission-pill removed">− {{ permission }}</span> } @if (!item.removed.length) { <span class="muted-cell">—</span> }</td><td>{{ item.date }}</td><td><button type="button" class="table-link" (click)="openPermission(item); $event.stopPropagation()">Detalle</button></td></tr> }</tbody></table></div><app-audit-pagination [total]="filteredPermissions().length" [page]="page()" [pageSize]="pageSize()" (pageChange)="page.set($event)" (pageSizeChange)="changePageSize($event)" /></section>
      }

      @if (actionMessage()) { <div class="inline-toast audit-toast" role="status">{{ actionMessage() }}</div> }
      <footer class="demo-note"><span>ⓘ</span> {{ usingApi() ? 'Eventos persistentes aislados por el tenant autenticado.' : 'Referencia visual local: la API de auditoría no respondió.' }}</footer>
    </section>
    <app-audit-event-drawer [detail]="drawerDetail()" (closed)="drawerDetail.set(null)" (actionSelected)="drawerAction($event)" />
  `,
})
export class AuditPage {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(DemoSessionState);
  private readonly auditApi = inject(AuditApiService);
  readonly routeInfo = this.route.snapshot.data['routeInfo'] as RouteInfo;
  readonly view: AuditView = auditViewFromPath(this.routeInfo.href);
  readonly tenant = signal(this.session.tenant());
  readonly isSuperAdmin = computed(() => this.session.role() === 'Superadministrador');
  readonly globalSearch = signal('');
  readonly filterValues = signal<Record<string, string>>({});
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly drawerDetail = signal<AuditDrawerDetail | null>(null);
  readonly actionMessage = signal('');
  readonly auditSource = signal<AuditEvent[]>(auditEvents);
  readonly usingApi = signal(false);
  readonly selectedModificationId = signal(modifications[0]?.id ?? '');

  readonly generalFilters: AuditFilterField[] = [
    { key: 'dateFrom', label: 'Desde', type: 'date' }, { key: 'dateTo', label: 'Hasta', type: 'date' },
    { key: 'user', label: 'Usuario', placeholder: 'Nombre o correo' }, { key: 'action', label: 'Acción', type: 'select', options: ['Aprobó documento', 'Modificó documento', 'Descargó archivo', 'Intentó acceder', 'Creó expediente', 'Cambió permisos'] },
    { key: 'module', label: 'Módulo', type: 'select', options: ['Documentos', 'Usuarios', 'Expedientes'] }, { key: 'result', label: 'Resultado', type: 'select', options: ['Exitoso', 'Rechazado', 'Pendiente'] },
  ];
  readonly accessFilters: AuditFilterField[] = [{ key: 'user', label: 'Usuario', placeholder: 'Buscar usuario' }, { key: 'date', label: 'Fecha', type: 'date' }, { key: 'status', label: 'Estado', type: 'select', options: ['Activa', 'Cerrada', 'Bloqueada'] }, { key: 'device', label: 'Dispositivo', placeholder: 'Tipo o modelo' }, { key: 'ip', label: 'IP', placeholder: '10.24...' }];
  readonly creationFilters: AuditFilterField[] = [{ key: 'date', label: 'Fecha', type: 'date' }, { key: 'creator', label: 'Creador', placeholder: 'Nombre' }, { key: 'area', label: 'Área', type: 'select', options: ['Dirección', 'Compras', 'Legal', 'Calidad'] }, { key: 'type', label: 'Tipo', type: 'select', options: ['Política', 'Acta', 'Expediente', 'Cotización', 'Informe'] }, { key: 'origin', label: 'Origen', type: 'select', options: ['Plantilla institucional', 'Carga de archivo', 'Creación manual'] }];
  readonly modificationFilters: AuditFilterField[] = [{ key: 'user', label: 'Usuario', placeholder: 'Nombre' }, { key: 'date', label: 'Fecha', type: 'date' }, { key: 'version', label: 'Versión', placeholder: 'v4' }];
  readonly downloadFilters: AuditFilterField[] = [{ key: 'user', label: 'Usuario', placeholder: 'Nombre' }, { key: 'document', label: 'Archivo', placeholder: 'Nombre o ID' }, { key: 'type', label: 'Tipo', type: 'select', options: ['PDF', 'DOCX', 'XLSX'] }, { key: 'date', label: 'Fecha', type: 'date' }];
  readonly approvalFilters: AuditFilterField[] = [{ key: 'status', label: 'Estado', type: 'select', options: ['Aprobado', 'Pendiente', 'Rechazado'] }, { key: 'user', label: 'Usuario', placeholder: 'Participante' }, { key: 'type', label: 'Tipo', placeholder: 'Workflow' }, { key: 'date', label: 'Fecha', type: 'date' }];
  readonly deletionFilters: AuditFilterField[] = [{ key: 'kind', label: 'Tipo de baja', type: 'select', options: ['Soft delete', 'Anulación', 'Archivado'] }, { key: 'user', label: 'Usuario', placeholder: 'Ejecutado por' }, { key: 'date', label: 'Fecha', type: 'date' }];
  readonly permissionFilters: AuditFilterField[] = [{ key: 'affectedUser', label: 'Usuario afectado', placeholder: 'Nombre' }, { key: 'modifiedBy', label: 'Modificador', placeholder: 'Nombre' }, { key: 'role', label: 'Rol', placeholder: 'Rol anterior o nuevo' }, { key: 'date', label: 'Fecha', type: 'date' }];

  readonly filteredEvents = computed(() => this.auditSource().filter((item) => this.matches(item, { user: item.user, action: item.action, module: item.module, result: item.result, date: this.isoDate(item.timestamp) })));
  readonly visibleEvents = computed(() => this.slice(this.filteredEvents()));
  readonly filteredSessions = computed(() => accessSessions.filter((item) => this.matches(item, { user: item.user, status: item.status, device: item.device, ip: item.ip, date: this.isoDate(item.start) })));
  readonly visibleSessions = computed(() => this.slice(this.filteredSessions()));
  readonly filteredCreations = computed(() => documentCreations.filter((item) => this.matches(item, { creator: item.creator, area: item.area, type: item.type, origin: item.origin, date: item.date })));
  readonly creationGroups = computed(() => this.groupCreations(this.slice(this.filteredCreations())));
  readonly filteredModifications = computed(() => modifications.filter((item) => this.matches(item, { user: item.user, date: this.isoDate(item.timestamp), version: item.version })));
  readonly filteredDownloads = computed(() => downloads.filter((item) => this.matches(item, { user: item.user, document: item.document, type: item.type, date: this.isoDate(item.date) })));
  readonly visibleDownloads = computed(() => this.slice(this.filteredDownloads()));
  readonly filteredApprovals = computed(() => approvals.filter((item) => this.matches(item, { status: item.status, user: `${item.user} ${item.participants.join(' ')}`, type: item.workflow, date: this.isoDate(item.date) })));
  readonly filteredDeletions = computed(() => deletions.filter((item) => this.matches(item, { kind: item.kind, user: item.deletedBy, date: this.isoDate(item.date) })));
  readonly filteredPermissions = computed(() => permissionChanges.filter((item) => this.matches(item, { affectedUser: item.affectedUser, modifiedBy: item.modifiedBy, role: `${item.previousRole} ${item.newRole}`, date: this.isoDate(item.date) })));

  readonly activeSessions = computed(() => accessSessions.filter((item) => item.status === 'Activa' && this.matchesTenant(item.tenant)).length);
  readonly blockedSessions = computed(() => accessSessions.filter((item) => item.status === 'Bloqueada' && this.matchesTenant(item.tenant)).length);
  readonly uniqueIps = computed(() => new Set(accessSessions.filter((item) => this.matchesTenant(item.tenant)).map((item) => item.ip)).size);
  readonly successfulEvents = computed(() => this.filteredEvents().filter((item) => item.result === 'Exitoso').length);
  readonly attentionEvents = computed(() => this.filteredEvents().filter((item) => item.result !== 'Exitoso').length);
  readonly selectedModification = computed(() => modifications.find((item) => item.id === this.selectedModificationId()));

  constructor() {
    if (this.view === 'general') {
      this.auditApi.events().subscribe({
        next: page => { this.auditSource.set(page.content.map(event => this.mapApiEvent(event))); this.usingApi.set(true); },
        error: () => this.usingApi.set(false),
      });
    }
  }

  get pageTitle(): string { return ({ general: 'Registro general', access: 'Accesos', creation: 'Creación de documentos', modifications: 'Modificaciones', downloads: 'Descargas', approvals: 'Aprobaciones', deletions: 'Eliminaciones', permissions: 'Cambios de permisos' } as Record<AuditView, string>)[this.view]; }
  get pageDescription(): string { return ({ general: 'Una vista cronológica y trazable de las acciones relevantes.', access: 'Supervisa sesiones, dispositivos y señales técnicas de acceso.', creation: 'Sigue la actividad documental desde su origen hasta su publicación.', modifications: 'Inspecciona versiones y cambios campo por campo.', downloads: 'Ledger de archivos descargados y contexto de cada copia.', approvals: 'Visualiza el avance, duración y participantes de cada aprobación.', deletions: 'Revisa operaciones destructivas y su posibilidad de restauración.', permissions: 'Controla la evolución RBAC con una lectura before / after.' } as Record<AuditView, string>)[this.view]; }

  setGlobalSearch(event: Event): void { this.globalSearch.set((event.target as HTMLInputElement).value); this.page.set(1); }
  setFilters(values: Record<string, string>): void { this.filterValues.set(values); this.page.set(1); }
  changePageSize(size: number): void { this.pageSize.set(size); this.page.set(1); }
  changeTenant(event: Event): void { this.tenant.set((event.target as HTMLSelectElement).value); this.page.set(1); this.actionMessage.set('Tenant visual cambiado; el backend deberá validar el tenant autenticado'); }

  exportAudit(): void { this.actionMessage.set('Exportación preparada como stub; falta un endpoint autenticado de auditoría'); }
  compareVersions(): void { this.actionMessage.set('Comparación binaria preparada como stub; requiere endpoint de versiones'); }
  restore(item: DeletionRecord): void { this.actionMessage.set(`Restauración de "${item.resource}" preparada como stub, sin persistencia`); }
  drawerAction(action: string): void { this.actionMessage.set(`${action}: handler visual preparado para la futura API`); }
  selectModification(item: ModificationRecord): void { this.selectedModificationId.set(item.id); }

  openEvent(item: AuditEvent): void {
    this.drawerDetail.set({ eyebrow: `${item.module} · ${item.id}`, title: item.action, subtitle: item.resource, status: item.result, statusClass: this.resultClass(item.result), fields: [{ label: 'ID de evento', value: item.id }, { label: 'Fecha y hora', value: item.timestamp }, { label: 'Usuario / rol', value: `${item.user} · ${item.role}` }, { label: 'Tenant', value: item.tenant }, { label: 'Módulo', value: item.module }, { label: 'IP', value: item.ip }, { label: 'Dispositivo', value: item.device }, { label: 'Navegador', value: item.browser }], details: item.details, before: item.before, after: item.after, actions: [{ label: 'Ver usuario', kind: 'secondary' }, { label: 'Ver documento', kind: 'secondary' }, { label: 'Ver expediente', kind: 'primary' }] });
  }
  openSession(item: AccessSession): void { this.drawerDetail.set({ eyebrow: `Acceso · ${item.id}`, title: item.user, subtitle: `${item.status} · ${item.tenant}`, status: item.status, statusClass: this.sessionStatusClass(item.status), fields: [{ label: 'Inicio', value: item.start }, { label: 'Fin', value: item.end }, { label: 'Duración', value: item.duration }, { label: 'Acciones', value: String(item.actions) }, { label: 'Dispositivo', value: item.device }, { label: 'IP', value: item.ip }, { label: 'Navegador', value: item.browser }, { label: 'Tenant', value: item.tenant }], details: 'Sesión de demostración: la señal de autenticación y el cierre de sesión deberán provenir de la API.', actions: [{ label: 'Ver usuario', kind: 'primary' }] }); }
  viewCreation(item: CreationActivity, action: string): void { if (action === 'Ver evento') { this.drawerDetail.set({ eyebrow: `Creación · ${item.id}`, title: 'Documento creado', subtitle: item.document, status: item.status, statusClass: this.resultClass(item.status), fields: [{ label: 'Fecha', value: item.date }, { label: 'Creador', value: item.creator }, { label: 'Área', value: item.area }, { label: 'Tipo', value: item.type }, { label: 'Origen', value: item.origin }, { label: 'Tenant', value: item.tenant }], details: 'La creación está simulada y no persiste en el repositorio.' }); } else { this.actionMessage.set(`${action} "${item.document}": navegación preparada para la futura API`); } }
  openDownload(item: DownloadRecord): void { this.drawerDetail.set({ eyebrow: `Descarga · ${item.id}`, title: item.document, subtitle: `${item.version} · ${item.type}`, fields: [{ label: 'Documento', value: item.document }, { label: 'Versión', value: item.version }, { label: 'Usuario / rol', value: `${item.user} · ${item.role}` }, { label: 'Fecha', value: item.date }, { label: 'IP', value: item.ip }, { label: 'Dispositivo', value: item.device }, { label: 'Navegador', value: item.browser }, { label: 'Tamaño / tenant', value: `${item.size} · ${item.tenant}` }], details: 'La descarga representa un registro mock del ledger; el archivo no se transfiere desde este prototipo.', actions: [{ label: 'Ver documento', kind: 'primary' }, { label: 'Ver usuario', kind: 'secondary' }] }); }
  openApproval(item: ApprovalRecord): void { this.drawerDetail.set({ eyebrow: `Workflow · ${item.id}`, title: item.document, subtitle: item.workflow, status: item.status, statusClass: this.resultClass(item.status), fields: [{ label: 'Duración', value: item.duration }, { label: 'Paso actual', value: `${item.currentStep} de ${item.steps.length}` }, { label: 'Participantes', value: item.participants.join(', ') }, { label: 'Última acción', value: item.user }, { label: 'Tenant', value: item.tenant }], details: `Stepper de aprobación con ${item.steps.length} etapas. Los tiempos son datos de demostración.`, actions: [{ label: 'Ver documento', kind: 'primary' }, { label: 'Ver expediente', kind: 'secondary' }] }); }
  openDeletion(item: DeletionRecord): void { this.drawerDetail.set({ eyebrow: `Operación crítica · ${item.id}`, title: item.resource, subtitle: item.kind, status: item.status, statusClass: item.status === 'Ejecutado' ? 'success' : 'warning', fields: [{ label: 'Tipo', value: item.kind }, { label: 'Fecha', value: item.date }, { label: 'Ejecutado por', value: item.deletedBy }, { label: 'Motivo', value: item.reason }, { label: 'Restaurable', value: item.restoreAllowed ? 'Sí · permiso visual aplicable' : 'No' }, { label: 'Tenant', value: item.tenant }], details: 'La operación es únicamente visual. La restauración deberá comprobar permisos en backend.', actions: item.restoreAllowed ? [{ label: 'Restaurar', kind: 'primary' }, { label: 'Ver documento', kind: 'secondary' }] : [{ label: 'Ver documento', kind: 'secondary' }] }); }
  openPermission(item: PermissionRecord): void { this.drawerDetail.set({ eyebrow: `RBAC · ${item.id}`, title: item.affectedUser, subtitle: item.resource, fields: [{ label: 'Modificador', value: item.modifiedBy }, { label: 'Fecha', value: item.date }, { label: 'Rol anterior', value: item.previousRole }, { label: 'Rol nuevo', value: item.newRole }, { label: 'Agregados', value: item.added.join(', ') || 'Ninguno' }, { label: 'Eliminados', value: item.removed.join(', ') || 'Ninguno' }], before: { Rol: item.previousRole, Permisos: item.removed.join(', ') || 'Sin cambios' }, after: { Rol: item.newRole, Permisos: item.added.join(', ') || 'Sin cambios' }, details: 'Cambio RBAC mock. El backend deberá validar usuario, tenant, rol y permiso antes de persistir.', actions: [{ label: 'Ver usuario afectado', kind: 'primary' }, { label: 'Ver modificador', kind: 'secondary' }] }); }

  resultClass(result: string): string { return ['Exitoso', 'Publicado', 'Aprobado', 'Activa', 'Ejecutado'].includes(result) ? 'success' : ['Pendiente', 'En revisión', 'Borrador', 'Revisar'].includes(result) ? 'warning' : ['Rechazado', 'Bloqueada'].includes(result) ? 'danger' : 'neutral'; }
  actionClass(action: string): string { return action.includes('Descarg') ? 'download' : action.includes('Modific') ? 'modify' : action.includes('Camb') ? 'permission' : action.includes('Intent') ? 'access' : 'create'; }
  sessionStatusClass(status: string): string { return this.resultClass(status); }
  initials(name: string): string { return name.split(' ').map((part) => part[0]).slice(0, 2).join(''); }

  private mapApiEvent(event: ApiAuditEvent): AuditEvent {
    const successful = event.result === 'SUCCESS';
    return {
      id: String(event.id), timestamp: event.occurredAt, dateLabel: event.occurredAt.slice(0, 10),
      user: event.userId, role: 'Usuario autenticado', tenant: this.tenant(),
      module: event.entityType, action: event.action,
      resource: event.entityId ? `${event.entityType} · ${event.entityId}` : event.entityType,
      ip: 'Registrada', device: 'Registrado', browser: 'Registrado',
      result: successful ? 'Exitoso' : 'Rechazado',
      details: 'Evento inmutable recuperado desde la API del tenant autenticado.',
      icon: successful ? '✓' : '!', tone: successful ? 'teal' : 'rose',
    };
  }

  private isoDate(value: string): string {
    const match = value.match(/(\d{1,2})\s+(?:de\s+)?([a-záéíóú]+)(?:\s+de)?\s+(\d{4})?/i);
    if (!match) return value;
    const months: Record<string, string> = { ene: '01', enero: '01', feb: '02', febrero: '02', mar: '03', marzo: '03', abr: '04', abril: '04', may: '05', mayo: '05', jun: '06', junio: '06', jul: '07', julio: '07', ago: '08', agosto: '08', sep: '09', septiembre: '09', oct: '10', octubre: '10', nov: '11', noviembre: '11', dic: '12', diciembre: '12' };
    const month = months[match[2].toLowerCase()];
    return month ? `${match[3] ?? '2026'}-${month}-${match[1].padStart(2, '0')}` : value;
  }

  private slice<T>(items: T[]): T[] { const start = (this.page() - 1) * this.pageSize(); return items.slice(start, start + this.pageSize()); }
  private matchesTenant(value: string): boolean { return value === this.tenant(); }
  private matches(item: object, fields: Record<string, string>): boolean {
    const record = item as Record<string, unknown>;
    if (!this.matchesTenant(String(record['tenant'] ?? ''))) return false;
    const query = this.globalSearch().trim().toLowerCase();
    const searchable = Object.values(record).flatMap((value) => Array.isArray(value) ? value : [value]).join(' ').toLowerCase();
    if (query && !searchable.includes(query)) return false;
    return Object.entries(this.filterValues()).every(([key, value]) => {
      if (!value) return true;
      const candidate = String(fields[key] ?? '');
      if (key === 'dateFrom') return String(fields['date'] ?? '') >= value;
      if (key === 'dateTo') return String(fields['date'] ?? '') <= value;
      if (key === 'date') return candidate === value;
      return candidate.toLowerCase().includes(value.toLowerCase());
    });
  }
  private groupCreations(items: CreationActivity[]): Array<{ label: string; items: CreationActivity[] }> {
    return items.reduce<Array<{ label: string; items: CreationActivity[] }>>((groups, item) => { const group = groups.find((candidate) => candidate.label === item.dateLabel); if (group) group.items.push(item); else groups.push({ label: item.dateLabel, items: [item] }); return groups; }, []);
  }
}
