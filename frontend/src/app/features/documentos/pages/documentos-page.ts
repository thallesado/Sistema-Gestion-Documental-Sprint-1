import { CommonModule } from '@angular/common';
import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import {
  DocumentApiService,
  ApiDocument,
  ApiDocumentType,
  ApiDocumentCategory,
  ApiDepartment,
  ApiDocumentVersion,
  DocumentCreatePayload,
} from '../../../core/api/document-api.service';
import { ClinicalApiService, ApiPatient } from '../../../core/api/clinical-api.service';
import { UserSelectorComponent } from '../../../shared';
import { exportToCsv, exportToJson, exportToPrintView, ExportColumn } from '../../../core/utils/export-utils';
import { WorkflowApi } from '../../workflows/workflow-api.service';
import { WorkflowStart } from '../../workflows/components/workflow-start';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-document-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UserSelectorComponent, WorkflowStart],
  template: `
    <section class="page document-page">
      <!-- HERO BANNER -->
      <section class="module-hero-banner">
        <div class="module-hero-left">
          <span class="module-hero-badge">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="9" y1="13" x2="15" y2="13"/>
              <line x1="9" y1="17" x2="13" y2="17"/>
            </svg>
          </span>
          <div class="module-hero-text">
            <p class="eyebrow">DOCUMENTOS · {{ isStatuses() ? 'ESTADOS' : isCreateRoute() ? (isUploadRoute() ? 'SUBIR ARCHIVO' : 'NUEVO DOCUMENTO') : scope() === 'mine' ? 'MIS DOCUMENTOS' : 'CATÁLOGO' }}</p>
            <h1>{{ isStatuses() ? 'Estados documentales' : pageTitle() }}</h1>
            <p>{{ isStatuses() ? 'Ciclo de vida y transiciones del dominio documental.' : isCreateRoute() ? 'Formulario de registro y catalogación de metadatos.' : scope() === 'mine' ? 'Documentos creados por ti o asignados bajo tu responsabilidad.' : 'Consulta, clasificación y control de documentos del tenant autenticado.' }}</p>
          </div>
        </div>

        <div class="module-hero-right">
          <svg viewBox="0 0 160 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="hero-folder-svg" style="width: 140px;">
            <circle cx="80" cy="50" r="45" fill="#d9f3ee" fill-opacity="0.6"/>
            <path d="M110 20 C122 18 130 26 128 38 C120 38 112 30 110 20 Z" fill="#8bc9bd"/>
            <path d="M120 14 C130 12 138 18 136 28 C130 28 124 22 120 14 Z" fill="#a4dcce"/>
            <rect x="45" y="24" width="55" height="65" rx="6" fill="#ffffff" stroke="#c8e4de" stroke-width="1.8"/>
            <rect x="55" y="36" width="34" height="3.5" rx="1.5" fill="#d4ece7"/>
            <rect x="55" y="44" width="26" height="3.5" rx="1.5" fill="#d4ece7"/>
            <rect x="55" y="52" width="20" height="3.5" rx="1.5" fill="#d4ece7"/>
            <path d="M35 52 C35 48 38 45 42 45 L62 45 L70 52 L115 52 C119 52 122 55 122 59 L122 84 C122 88 119 92 115 92 L42 92 C38 92 35 88 35 84 Z" fill="#4ea99b"/>
            <path d="M35 58 C35 54 38 51 42 51 L115 51 C119 51 122 54 122 58 L122 84 C122 88 119 92 115 92 L42 92 C38 92 35 88 35 84 Z" fill="#138072"/>
          </svg>

          @if (!isStatuses() && !isCreateRoute()) {
            <div style="display: flex; gap: 10px; align-items: center;">
              <a class="btn-primary-action" routerLink="/documents/new">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Nuevo documento</span>
              </a>
              <a class="btn-secondary-action" routerLink="/documents/upload">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                <span>Subir archivo</span>
              </a>
            </div>
          }
        </div>
      </section>

      @if (isStatuses()) {
        <!-- VISTA DE ESTADOS DOCUMENTALES -->
        <section class="panel" style="margin-bottom: 20px;">
          <h3>Gestión del ciclo de vida documental</h3>
          <p class="form-note">NexoDocs aplica transiciones formales para garantizar la trazabilidad de los documentos e impedir modificaciones informales.</p>
        </section>
        <section class="status-grid">
          @for (status of statuses; track status.code) {
            <article class="status-card">
              <span [class]="'status-dot ' + status.tone"></span>
              <div>
                <b>{{ status.label }}</b>
                <small>{{ status.description }}</small>
                <code>{{ status.code }}</code>
              </div>
            </article>
          }
        </section>
      } @else {
        <!-- FORMULARIO CREAR / SUBIR DOCUMENTO -->
        @if (isCreateRoute()) {
          <form class="panel create-form" (ngSubmit)="createDocument()" style="margin-bottom: 22px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h2>{{ isUploadRoute() ? 'Subir archivo y registrar metadatos' : 'Nuevo documento' }}</h2>
              <a routerLink="/documents" class="secondary-action" style="text-decoration: none;">✕ Cerrar formulario</a>
            </div>
            <p class="form-note">Registra la clasificación documental y metadatos del documento. Los datos se aislarán bajo el tenant activo.</p>
            @if (createError()) { <div class="notice error" role="alert">{{ createError() }}</div> }
            @if (actionMessage()) { <div class="notice" role="status">{{ actionMessage() }}</div> }

            <div class="form-grid">
              <label>Nombre del documento *
                <input name="documentName" [(ngModel)]="createForm.name" required maxlength="255" placeholder="Ej: Contrato Marco de Adquisición" />
              </label>

              <label>Código institucional *
                <input name="documentCode" [(ngModel)]="createForm.code" required maxlength="60" placeholder="Ej: DOC-2026-001" />
              </label>

              <label>Tipo documental *
                <select name="documentTypeId" [(ngModel)]="createForm.documentTypeId" required>
                  <option value="">Selecciona un tipo documental</option>
                  @for (type of types(); track type.id) {
                    <option [value]="type.id">{{ type.name }} · {{ type.code }}</option>
                  }
                </select>
              </label>

              <label>Servicio / Departamento
                <select name="departmentId" [(ngModel)]="createForm.departmentId">
                  <option value="">Selecciona servicio o área</option>
                  @for (dept of departments(); track dept.id) {
                    <option [value]="dept.id">{{ dept.name }} ({{ dept.code }})</option>
                  }
                </select>
              </label>

              <label>Especialidad
                <select name="specialty" [(ngModel)]="createForm.specialty">
                  <option value="">Selecciona especialidad</option>
                  @for (spec of specialties(); track spec) {
                    <option [value]="spec">{{ spec }}</option>
                  }
                </select>
              </label>

              <label>Proceso institucional
                <select name="institutionalProcess" [(ngModel)]="createForm.institutionalProcess">
                  <option value="">Selecciona proceso</option>
                  @for (proc of processes(); track proc) {
                    <option [value]="proc">{{ proc }}</option>
                  }
                </select>
              </label>

              <label>Paciente asociado (si aplica)
                <select name="patientId" [(ngModel)]="createForm.patientId">
                  <option value="">Sin paciente asociado</option>
                  @for (pat of patients(); track pat.id) {
                    <option [value]="pat.id">{{ pat.firstName }} {{ pat.lastName }} ({{ pat.documentNumber }})</option>
                  }
                </select>
              </label>

              <label>Expediente vinculado (opcional)
                <input name="expedientId" [(ngModel)]="createForm.expedientId" placeholder="UUID del expediente" />
              </label>

              <label>Fecha de emisión
                <input type="date" name="issueDate" [(ngModel)]="createForm.issueDate" />
              </label>

              <label>Fecha de vencimiento
                <input type="date" name="expiryDate" [(ngModel)]="createForm.expiryDate" />
              </label>

              <app-user-selector label="Responsable asignado" [(value)]="createForm.responsibleUserId" />

              <label class="full-width">Descripción / Resumen
                <textarea name="description" rows="3" [(ngModel)]="createForm.description" maxlength="10000" placeholder="Breve descripción del contenido y alcance documental..."></textarea>
              </label>

              @if (isUploadRoute()) {
                <label class="full-width" style="border: 1px dashed #087f7b; padding: 16px; border-radius: 12px; background: #f4faf9;">
                  <strong>Archivo inicial (v1) *</strong>
                  <input type="file" name="initialFile" accept=".pdf,.png,.jpg,.jpeg,.docx" (change)="selectInitialFile($event)" required />
                  <small class="form-note">Formatos admitidos: PDF, JPEG, PNG, DOCX (máx 25 MB). Se almacenará con cálculo de checksum SHA-256 inmutable.</small>
                </label>
              }
            </div>

            <div class="form-actions" style="margin-top: 20px;">
              <a routerLink="/documents" class="secondary-action">Cancelar</a>
              <button class="primary-action" type="submit" [disabled]="creating() || !createForm.name.trim() || !createForm.code.trim() || !createForm.documentTypeId || (isUploadRoute() && !initialFile)">
                {{ creating() ? 'Procesando…' : (isUploadRoute() ? 'Crear y subir versión v1' : 'Crear documento') }}
              </button>
            </div>
          </form>
        }

        @if (apiError()) {
          <div class="notice error" role="alert">
            <b>No se pudo consultar el catálogo documental.</b>
            <span>{{ apiError() }}</span>
            <button type="button" (click)="loadDocuments()">Reintentar</button>
          </div>
        }
        @if (loading()) { <div class="notice" role="status">Cargando catálogo documental…</div> }
        @if (actionMessage()) { <div class="notice" role="status">{{ actionMessage() }}</div> }

        <!-- MATRIZ DE FILTROS (Clasificación Documental y Búsqueda) -->
        <section class="doc-filter-card">
          <div class="doc-filter-card-left">
            <span class="filter-box-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
                <line x1="9" y1="17" x2="13" y2="17"/>
              </svg>
            </span>
            <h3>{{ pageTitle() }}</h3>
            <p>{{ scope() === 'mine' ? 'Documentos donde eres autor o responsable asignado.' : 'Documentos disponibles en el tenant autenticado.' }}</p>
          </div>

          <div class="doc-filter-card-right">
            <!-- Fila 1 de Filtros: Clasificación base -->
            <div class="doc-filter-grid-row">
              <div class="doc-input-box">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input placeholder="Nombre, código, especialidad..." [value]="search()" (input)="setSearch($event)" />
              </div>

              <div class="doc-input-box">
                <select [value]="statusFilter()" (change)="setStatus($event)">
                  <option value="">Todos los estados</option>
                  @for (st of statuses; track st.code) {
                    <option [value]="st.code">{{ st.label }}</option>
                  }
                </select>
              </div>

              <div class="doc-input-box">
                <select [value]="categoryFilter()" (change)="setCategory($event)">
                  <option value="">Todas las categorías</option>
                  @for (cat of categories(); track cat.id) {
                    <option [value]="cat.name">{{ cat.name }}</option>
                  }
                </select>
              </div>

              <div class="doc-input-box">
                <select [value]="typeFilter()" (change)="setFilter('type', $event)">
                  <option value="">Todos los tipos</option>
                  @for (type of types(); track type.id) {
                    <option [value]="type.id">{{ type.name }}</option>
                  }
                </select>
              </div>

              <div class="doc-input-box">
                <input placeholder="Responsable..." [value]="responsibleFilter()" (input)="setFilter('responsible', $event)" />
              </div>
            </div>

            <!-- Fila 2 de Filtros: Especialidad, Servicio, Proceso -->
            <div class="doc-filter-grid-row">
              <div class="doc-input-box">
                <select [value]="departmentFilter()" (change)="setFilter('department', $event)">
                  <option value="">Todos los servicios/áreas</option>
                  @for (dept of departments(); track dept.id) {
                    <option [value]="dept.name">{{ dept.name }}</option>
                  }
                </select>
              </div>

              <div class="doc-input-box">
                <select [value]="specialtyFilter()" (change)="setFilter('specialty', $event)">
                  <option value="">Todas las especialidades</option>
                  @for (spec of specialties(); track spec) {
                    <option [value]="spec">{{ spec }}</option>
                  }
                </select>
              </div>

              <div class="doc-input-box">
                <select [value]="processFilter()" (change)="setFilter('process', $event)">
                  <option value="">Todos los procesos</option>
                  @for (proc of processes(); track proc) {
                    <option [value]="proc">{{ proc }}</option>
                  }
                </select>
              </div>

              <div class="doc-input-box">
                <span style="font-size: 11px; color: #648280;">Desde</span>
                <input type="date" [value]="dateFrom()" (change)="setFilter('dateFrom', $event)" />
              </div>

              <div class="doc-input-box">
                <span style="font-size: 11px; color: #648280;">Hasta</span>
                <input type="date" [value]="dateTo()" (change)="setFilter('dateTo', $event)" />
              </div>
            </div>

            <!-- Fila 3: Ordenar y Exportar -->
            <div class="doc-filter-bottom-row">
              <div class="doc-input-box" style="max-width: 200px;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <select [value]="sortBy()" (change)="setSort($event)">
                  <option value="updated">Última actualización</option>
                  <option value="name">Nombre</option>
                  <option value="created">Fecha de creación</option>
                  <option value="version">Versión</option>
                </select>
              </div>

              <div style="display: flex; gap: 8px; align-items: center;">
                <div class="export-dropdown-wrapper">
                  <button type="button" class="btn-doc-action" (click)="toggleExportMenu($event)" [attr.aria-expanded]="exportMenuOpen()">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    <span>Exportar</span>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  @if (exportMenuOpen()) {
                    <div class="export-dropdown-backdrop" (click)="closeExportMenu()"></div>
                    <div class="export-dropdown-popover">
                      <button type="button" (click)="exportDocuments('Excel')">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                        <div><strong>Exportar a Excel</strong><small>Descargar catálogo en formato CSV para Excel</small></div>
                      </button>
                      <button type="button" (click)="exportDocuments('PDF')">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        <div><strong>Exportar a PDF</strong><small>Vista de impresión y guardado PDF</small></div>
                      </button>
                      <button type="button" (click)="exportDocuments('JSON')">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                        <div><strong>Exportar a JSON</strong><small>Descargar archivo de datos .json</small></div>
                      </button>
                    </div>
                  }
                </div>

                <button type="button" class="btn-doc-action" (click)="clearFilters()">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <span>Limpiar filtros</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- LISTA DE DOCUMENTOS (Catálogo) -->
        <section class="doc-catalog-list-card">
          <div class="doc-list-items">
            @for (item of pagedDocuments(); track item.id) {
              <article class="doc-item-row" tabindex="0" role="button" (click)="openDetails(item)">
                <span class="doc-api-badge">API</span>
                <div class="doc-item-main">
                  <h3>{{ item.name }}</h3>
                  <p>
                    <b>{{ item.code }}</b> ·
                    <span class="pill-mini">{{ item.documentTypeName || 'Tipo general' }}</span>
                    @if (item.categoryName) { <span class="pill-mini">{{ item.categoryName }}</span> }
                    @if (item.departmentName) { <span class="pill-mini">{{ item.departmentName }}</span> }
                    @if (item.specialty) { <span class="pill-mini">{{ item.specialty }}</span> }
                    · versión <b>v{{ item.currentVersion || 1 }}</b>
                  </p>
                </div>
                <div class="doc-item-right">
                  <time>{{ item.effectiveDate || item.createdAt | date:'dd/MM/yyyy' }}</time>
                  <span class="status status-pill" [ngClass]="item.status ? item.status.toLowerCase() : 'draft'">{{ statusLabel(item.status) }}</span>
                  <button type="button" class="btn-doc-action" (click)="$event.stopPropagation(); openVersions(item)">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>Versiones (v{{ item.currentVersion || 1 }})</span>
                  </button>
                  <label class="btn-doc-action" (click)="$event.stopPropagation()">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                    <span>Subir v{{ (item.currentVersion || 1) + 1 }}</span>
                    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" style="display: none;" (change)="uploadVersion(item, $event)" />
                  </label>
                </div>
              </article>
            } @empty {
              @if (!loading()) {
                <div class="module-empty-state">
                  <span class="module-empty-icon">
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </span>
                  <strong>{{ apiDocuments().length ? 'No hay documentos que coincidan con los filtros seleccionados.' : (scope() === 'mine' ? 'No tienes documentos creados o asignados todavía.' : 'No se encontraron documentos en este tenant.') }}</strong>
                  <p>Prueba ajustando los filtros o registra un nuevo documento.</p>
                </div>
              }
            }
          </div>

          <!-- Paginación -->
          @if (filteredDocuments().length) {
            <div class="module-table-footer">
              <div class="module-table-footer-left">
                <label>Documentos por página
                  <select class="page-size-select" [value]="pageSize()" (change)="setPageSize($event)">
                    <option [value]="5">5</option>
                    <option [value]="10">10</option>
                    <option [value]="25">25</option>
                    <option [value]="50">50</option>
                  </select>
                </label>
              </div>

              <div class="module-table-footer-right">
                <button type="button" class="filter-btn-pill" (click)="previousPage()" [disabled]="page() === 0">Anterior</button>
                <button type="button" class="filter-btn-pill active" (click)="nextPage()" [disabled]="page() + 1 >= totalPages()">Siguiente</button>
                <span>Página {{ page() + 1 }} de {{ totalPages() }} (Total: {{ totalDocuments() }})</span>
              </div>
            </div>
          }
        </section>

        <!-- DRAWER DE DETALLES Y METADATOS DOCUMENTALES -->
        @if (selectedDocument()) {
          <div class="modal-backdrop drawer-backdrop" role="presentation" (click)="closeDetails()">
            <aside class="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="document-detail-title" (click)="$event.stopPropagation()">
              <button class="drawer-close" type="button" aria-label="Cerrar detalle" (click)="closeDetails()">×</button>
              <p class="eyebrow">Detalle y Metadatos Documentales</p>
              <h2 id="document-detail-title">{{ selectedDocument()?.name }}</h2>

              <dl>
                <dt>Código</dt><dd><b>{{ selectedDocument()?.code }}</b></dd>
                <dt>Estado actual</dt><dd><span class="status status-pill" [ngClass]="selectedDocument()?.status?.toLowerCase()">{{ statusLabel(selectedDocument()!.status) }}</span></dd>
                <dt>Tipo documental</dt><dd>{{ selectedDocument()?.documentTypeName || selectedDocument()?.documentTypeId }}</dd>
                <dt>Categoría</dt><dd>{{ selectedDocument()?.categoryName || 'No clasificado' }}</dd>
                <dt>Servicio / Área</dt><dd>{{ selectedDocument()?.departmentName || 'No asignado' }}</dd>
                <dt>Especialidad</dt><dd>{{ selectedDocument()?.specialty || 'General' }}</dd>
                <dt>Proceso institucional</dt><dd>{{ selectedDocument()?.institutionalProcess || 'Estándar' }}</dd>
                <dt>Paciente</dt><dd>{{ selectedDocument()?.patientName || 'No aplica' }}</dd>
                <dt>Autor (creador)</dt><dd>{{ selectedDocument()?.authorName || selectedDocument()?.authorId }}</dd>
                <dt>Responsable</dt><dd>{{ selectedDocument()?.responsibleName || 'Sin asignar' }}</dd>
                <dt>Expediente</dt><dd>{{ selectedDocument()?.expedientCode || selectedDocument()?.expedientId || 'No vinculado' }}</dd>
                <dt>Versión actual</dt><dd><b>v{{ selectedDocument()?.currentVersion || 1 }}</b></dd>
                <dt>Fecha de emisión</dt><dd>{{ selectedDocument()?.issueDate ? (selectedDocument()?.issueDate | date:'dd/MM/yyyy') : 'No especificada' }}</dd>
                <dt>Fecha de vencimiento</dt><dd>{{ selectedDocument()?.expiryDate ? (selectedDocument()?.expiryDate | date:'dd/MM/yyyy') : 'Sin vencimiento' }}</dd>
                <dt>Creado en el sistema</dt><dd>{{ selectedDocument()?.createdAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                <dt>Última actualización</dt><dd>{{ selectedDocument()?.updatedAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                <dt>Descripción</dt><dd>{{ selectedDocument()?.description || 'Sin descripción disponible.' }}</dd>
              </dl>

              <section class="workflow-document-panel">
                <h3>Workflow del documento</h3>
                @for (workflow of documentWorkflows(); track workflow.id) {
                  <button type="button" class="btn-doc-action" (click)="router.navigate(['/workflows'], { queryParams: { workflow: workflow.id } })">
                    {{ workflow.code }} · {{ workflow.title }} · {{ workflow.status }}
                  </button>
                  <small>{{ workflow.stage_name || 'Sin etapa' }} · {{ workflow.responsible_name || 'Sin responsable' }} · {{ workflow.progress || 0 }}% · {{ workflow.due_at ? (workflow.due_at | date:'dd/MM/yyyy') : 'Sin vencimiento' }}</small>
                } @empty { <p class="drawer-note">No hay workflows asociados.</p> }
                @if (canStartWorkflow()) { <button type="button" class="btn-primary-action" (click)="openWorkflowStart(selectedDocument()!)">Iniciar workflow</button> }
              </section>

              <!-- TRANSICIONES DE ESTADO PERMITIDAS -->
              @if (allowedStatusTransitions(selectedDocument()!).length) {
                <div class="status-actions">
                  <span>Cambiar estado del documento:</span>
                  @for (status of allowedStatusTransitions(selectedDocument()!); track status) {
                    <button type="button" (click)="changeStatus(selectedDocument()!, status)" [disabled]="changingStatus()">
                      {{ statusLabel(status) }}
                    </button>
                  }
                </div>
              }
              @if (changingStatus()) { <p class="drawer-note">Actualizando estado...</p> }
              @if (detailError()) { <p class="drawer-error" role="alert">{{ detailError() }}</p> }

              <div class="drawer-actions" style="margin-top: 20px;">
                <label class="btn-primary-action" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                  <span>Subir nueva versión (v{{ (selectedDocument()?.currentVersion || 1) + 1 }})</span>
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" style="display: none;" (change)="uploadVersion(selectedDocument()!, $event)" />
                </label>
              </div>

              <!-- HISTORIAL DE VERSIONES -->
              <h3 style="margin-top: 25px;">Historial de Versiones</h3>
              <p class="form-note">Trazabilidad inmutable de archivos y evoluciones del documento.</p>
              @if (detailLoading()) { <p class="drawer-note">Cargando versiones…</p> }
              @if (versions()[selectedDocument()!.id]; as history) {
                @if (!history.length) { <p class="drawer-note">No hay versiones almacenadas para este documento.</p> }
                @for (version of history; track version.id) {
                  <div class="history-item-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                      <div>
                        <strong>v{{ version.versionNumber }} · {{ version.fileName }}</strong>
                        <div style="font-size: 11px; color: #6b8583; margin-top: 2px;">
                          {{ formatBytes(version.fileSizeBytes) }} · {{ version.createdAt | date:'dd/MM/yyyy HH:mm' }}
                        </div>
                      </div>
                      <button class="btn-doc-action" type="button" (click)="download(selectedDocument()!, version)">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Descargar
                      </button>
                    </div>
                    <div style="font-size: 11px; margin-top: 6px; background: #fff; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2eee9;">
                      <b>Motivo:</b> {{ version.changeReason }}
                    </div>
                    @if (version.checksumSha256) {
                      <div style="font-size: 10px; color: #6b8583; font-family: monospace; margin-top: 4px; overflow-wrap: anywhere;">
                        SHA-256: {{ version.checksumSha256 }}
                      </div>
                    }
                  </div>
                }
              }
            </aside>
          </div>
        }

        @if (workflowStartDocument()) {
          <app-workflow-start [options]="workflowOptions()" [initialDocument]="workflowStartDocument()"
            (close)="workflowStartDocument.set(null)" (started)="workflowStarted($event)"></app-workflow-start>
        }

        <!-- MODAL SUBIDA DE VERSIÓN -->
        @if (uploadFile()) {
          <div class="modal-backdrop" role="presentation">
            <section class="modal" role="dialog" aria-modal="true" aria-labelledby="version-title">
              <h2 id="version-title">Subir nueva versión</h2>
              <p>Documento: <b>{{ uploadDocument?.name }}</b> ({{ uploadDocument?.code }})</p>
              <p>Archivo seleccionado: <b>{{ uploadFile()?.name }}</b> ({{ formatBytes(uploadFile()?.size || 0) }})</p>
              <label>Motivo obligatorio del cambio *
                <textarea rows="3" [(ngModel)]="uploadReason" required placeholder="Explica detalladamente la razón de esta actualización..."></textarea>
              </label>
              <div class="modal-actions">
                <button type="button" (click)="cancelUpload()">Cancelar</button>
                <button class="primary-action" type="button" (click)="confirmUpload()" [disabled]="!uploadReason.trim() || uploading()">
                  {{ uploading() ? 'Subiendo versión…' : 'Confirmar versión' }}
                </button>
              </div>
            </section>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .document-page { max-width: 1440px; margin: auto; padding: 30px 36px 48px; color: #153a39; }
    .eyebrow { color: #087f7b; text-transform: uppercase; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
    .notice { display: flex; gap: 10px; flex-wrap: wrap; background: #eef7ff; border: 1px solid #cfe3f5; color: #356d9e; border-radius: 10px; padding: 12px; margin-bottom: 15px; font-size: 12px; }
    .notice span { flex: 1; }
    .notice.error { background: #fff4f3; border-color: #f3d2d0; color: #a65050; }
    .notice.warning { background: #fff8e8; border-color: #f3e1b6; color: #8b671c; }
    .notice button { border: 0; background: transparent; text-decoration: underline; color: inherit; cursor: pointer; }
    .panel { background: #fff; border: 1px solid #dcebe8; border-radius: 16px; padding: 20px; }
    .create-form h2 { margin-top: 0; }
    .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 14px; }
    .form-grid label { display: grid; gap: 5px; font-size: 12px; font-weight: 700; color: #153a39; }
    .form-grid input, .form-grid select, .form-grid textarea { border: 1px solid #c8e0dc; border-radius: 8px; padding: 9px 12px; font-size: 13px; color: #153a39; background: #fff; width: 100%; box-sizing: border-box; }
    .form-grid input:focus, .form-grid select:focus, .form-grid textarea:focus { border-color: #087f7b; outline: none; box-shadow: 0 0 0 3px #087f7b20; }
    .form-grid .full-width { grid-column: span 2; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .primary-action { background: #087f7b; color: white; border: 0; border-radius: 8px; padding: 10px 18px; cursor: pointer; font-weight: 700; font-size: 13px; }
    .primary-action:disabled { opacity: 0.6; cursor: not-allowed; }
    .secondary-action { background: #f0f7f5; border: 1px solid #c8e0dc; color: #153a39; border-radius: 8px; padding: 10px 18px; cursor: pointer; font-weight: 600; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; }
    .modal-backdrop { position: fixed; inset: 0; background: #153a3966; display: grid; place-items: center; padding: 20px; z-index: 50; }
    .modal { background: white; border-radius: 14px; padding: 22px; max-width: 480px; width: 100%; box-shadow: 0 18px 50px #153a3940; }
    .modal h2 { margin-top: 0; }
    .modal label { display: grid; gap: 7px; font-size: 12px; font-weight: 700; }
    .modal textarea { border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; resize: vertical; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
    .modal-actions button { border: 1px solid #c8e0dc; background: #f0f7f5; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-weight: 600; }
    .modal-actions .primary-action { background: #087f7b; color: white; border: 0; }
    .drawer-backdrop { display: flex; justify-content: flex-end; padding: 0; }
    .detail-drawer { background: #fff; height: 100%; max-width: 520px; overflow: auto; padding: 32px 28px; position: relative; width: 100%; box-shadow: -10px 0 30px #153a3940; }
    .drawer-close { background: transparent; border: 0; color: #6b8583; cursor: pointer; font-size: 28px; position: absolute; right: 18px; top: 12px; }
    .detail-drawer h2 { font-size: 22px; margin: 5px 0 18px; color: #153a39; }
    .detail-drawer dl { display: grid; gap: 7px; grid-template-columns: 145px 1fr; font-size: 12px; }
    .detail-drawer dt { color: #6b8583; font-weight: 700; }
    .detail-drawer dd { margin: 0; overflow-wrap: anywhere; color: #153a39; }
    .status-actions { border-top: 1px solid #edf3f1; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; padding-top: 16px; }
    .status-actions span { align-self: center; color: #6b8583; font-size: 11px; font-weight: 800; width: 100%; }
    .status-actions button { border: 1px solid #bfeae5; background: white; color: #087f7b; border-radius: 7px; padding: 7px 11px; cursor: pointer; font-size: 11px; font-weight: 700; transition: all 0.2s; }
    .status-actions button:hover { background: #087f7b; color: white; }
    .drawer-note, .drawer-error { font-size: 11px; line-height: 1.5; margin: 15px 0; }
    .drawer-error { color: #a65050; }
    .status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .status-card { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 17px; display: flex; gap: 12px; }
    .status-card div { display: grid; gap: 5px; }
    .status-card small { color: #6b8583; font-size: 11px; }
    .status-card code { font-size: 10px; color: #087f7b; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; background: #9aa; flex-shrink: 0; }
    .status-dot.teal { background: #087f7b; }
    .status-dot.amber { background: #d99a26; }
    .status-dot.blue { background: #4386c5; }
    .status-dot.green { background: #3b9b69; }
    .status-dot.rose { background: #dc2626; }
    .status-dot.gray { background: #899b9a; }
    .pill-mini { display: inline-block; background: #f0f7f5; border: 1px solid #d4eae5; color: #087f7b; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-right: 4px; }
    .history-item-card { background: #f8fbfa; border: 1px solid #dcebe8; border-radius: 8px; color: #153a39; margin: 8px 0; padding: 12px; }
    .status-pill.draft { background: #f3f4f6; color: #4b5563; border: 1px solid #e5e7eb; }
    .status-pill.pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .status-pill.in_review { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .status-pill.approved { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .status-pill.rejected { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .status-pill.corrected { background: #fef9c3; color: #854d0e; border: 1px solid #fef08a; }
    .status-pill.current { background: #ccfbf1; color: #115e59; border: 1px solid #99f6e4; }
    .status-pill.archived { background: #e0f2fe; color: #075985; border: 1px solid #bae6fd; }
    .status-pill.voided { background: #fee2e2; color: #7f1d1d; border: 1px solid #fca5a5; }
    .status-pill.trashed { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
  `],
})
export class DocumentPage implements OnInit, OnDestroy {
  private readonly api = inject(DocumentApiService);
  private readonly clinicalApi = inject(ClinicalApiService);
  private readonly route = inject(ActivatedRoute);
  readonly router = inject(Router);
  private readonly workflowApi = inject(WorkflowApi);
  private readonly auth = inject(AuthService);

  private routerSub?: Subscription;
  private lastLinkedDocumentId = '';

  // Estados de ruta reactivos
  readonly isStatuses = signal(false);
  readonly isCreateRoute = signal(false);
  readonly isUploadRoute = signal(false);
  readonly scope = signal<'mine' | 'shared' | undefined>(undefined);
  readonly pageTitle = signal('Todos los documentos');

  // Formulario de creación
  readonly createError = signal('');
  readonly creating = signal(false);
  createForm: DocumentCreatePayload & { responsibleUserId: string } = {
    documentTypeId: '',
    code: '',
    name: '',
    description: '',
    responsibleUserId: '',
    departmentId: '',
    specialty: '',
    institutionalProcess: '',
    patientId: '',
    issueDate: '',
    expiryDate: '',
    expedientId: '',
  };
  initialFile: File | null = null;

  // Catálogos auxiliares
  readonly types = signal<ApiDocumentType[]>([]);
  readonly categories = signal<ApiDocumentCategory[]>([]);
  readonly departments = signal<ApiDepartment[]>([]);
  readonly specialties = signal<string[]>([]);
  readonly processes = signal<string[]>([]);
  readonly patients = signal<ApiPatient[]>([]);

  // Listado de documentos y estado API
  readonly loading = signal(false);
  readonly apiError = signal('');
  readonly apiDocuments = signal<ApiDocument[]>([]);
  readonly totalDocuments = signal(0);
  readonly versions = signal<Record<string, ApiDocumentVersion[]>>({});
  readonly actionMessage = signal('');

  // Filtros
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly categoryFilter = signal('');
  readonly typeFilter = signal('');
  readonly departmentFilter = signal('');
  readonly specialtyFilter = signal('');
  readonly processFilter = signal('');
  readonly responsibleFilter = signal('');
  readonly creatorFilter = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly sortBy = signal('updated');
  readonly page = signal(0);
  readonly pageSize = signal(10);
  readonly exportMenuOpen = signal(false);

  // Detalle y versiones
  readonly selectedDocument = signal<ApiDocument | null>(null);
  readonly documentWorkflows = signal<any[]>([]);
  readonly workflowStartDocument = signal<ApiDocument | null>(null);
  readonly workflowOptions = signal<any>({users:[],roles:[],departments:[]});
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly uploadFile = signal<File | null>(null);
  uploadDocument: ApiDocument | null = null;
  uploadReason = '';
  readonly uploading = signal(false);
  readonly changingStatus = signal(false);

  // Estados documentales
  readonly statuses = [
    { code: 'DRAFT', label: 'Borrador', description: 'Edición inicial en preparación', tone: 'gray' },
    { code: 'PENDING', label: 'Pendiente', description: 'Esperando pase a revisión técnica', tone: 'amber' },
    { code: 'IN_REVIEW', label: 'En revisión', description: 'Validación y evaluación en curso', tone: 'blue' },
    { code: 'APPROVED', label: 'Aprobado', description: 'Revisión superada, listo para emisión', tone: 'green' },
    { code: 'REJECTED', label: 'Rechazado', description: 'No cumple requerimientos; requiere cambios', tone: 'rose' },
    { code: 'CORRECTED', label: 'Corregido', description: 'Observaciones solventadas; en re-evaluación', tone: 'amber' },
    { code: 'CURRENT', label: 'Vigente', description: 'Documento oficial en plena vigencia', tone: 'teal' },
    { code: 'ARCHIVED', label: 'Archivado', description: 'Histórico, fuera de circulación activa', tone: 'gray' },
    { code: 'VOIDED', label: 'Anulado', description: 'Revocado formalmente sin validez legal', tone: 'rose' },
  ];

  ngOnInit(): void {
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.syncRouteState();
      });

    this.syncRouteState();
    this.loadCatalogData();
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  syncRouteState(): void {
    const url = this.router.url.split('?')[0];
    const isStat = url === '/settings/statuses';
    const isCreate = url === '/documents/new' || url === '/documents/upload';
    const isUpload = url === '/documents/upload';
    const scopeVal = url === '/documents/mine' ? 'mine' : url === '/documents/shared' ? 'shared' : undefined;

    this.isStatuses.set(isStat);
    this.isCreateRoute.set(isCreate);
    this.isUploadRoute.set(isUpload);
    this.scope.set(scopeVal);

    if (isStat) {
      this.pageTitle.set('Estados documentales');
    } else if (isCreate) {
      this.pageTitle.set(isUpload ? 'Subir archivo' : 'Nuevo documento');
      this.resetCreateForm();
    } else if (scopeVal === 'mine') {
      this.pageTitle.set('Mis documentos');
    } else if (scopeVal === 'shared') {
      this.pageTitle.set('Compartidos conmigo');
    } else {
      this.pageTitle.set('Todos los documentos');
    }

    if (!isStat) {
      this.loadDocuments();
    }
    const linkedDocumentId=this.route.snapshot.queryParamMap.get('documentId')||'';
    if(linkedDocumentId&&linkedDocumentId!==this.lastLinkedDocumentId){
      this.lastLinkedDocumentId=linkedDocumentId;
      this.api.getById(linkedDocumentId).subscribe({next:doc=>this.openDetails(doc),error:()=>this.detailError.set('No se pudo abrir el documento vinculado al workflow.')});
    }else if(!linkedDocumentId){this.lastLinkedDocumentId='';}
  }

  resetCreateForm(): void {
    this.createForm = {
      documentTypeId: '',
      code: '',
      name: '',
      description: '',
      responsibleUserId: '',
      departmentId: '',
      specialty: '',
      institutionalProcess: '',
      patientId: '',
      issueDate: '',
      expiryDate: '',
      expedientId: '',
    };
    this.initialFile = null;
    this.createError.set('');
  }

  loadCatalogData(): void {
    this.api.documentTypes('', 0, 100).subscribe({
      next: res => this.types.set(res.content || []),
      error: () => {},
    });

    this.api.categories().subscribe({
      next: list => this.categories.set(list || []),
      error: () => {},
    });

    this.api.departments().subscribe({
      next: list => this.departments.set(list || []),
      error: () => {},
    });

    this.api.specialties().subscribe({
      next: list => this.specialties.set(list || []),
      error: () => {},
    });

    this.api.processes().subscribe({
      next: list => this.processes.set(list || []),
      error: () => {},
    });

    this.clinicalApi.patients('', 0, 50).subscribe({
      next: res => this.patients.set(res.content || []),
      error: () => {},
    });
  }

  loadDocuments(): void {
    this.loading.set(true);
    this.apiError.set('');
    this.api.documents(this.search(), this.statusFilter() || undefined, this.page(), this.pageSize(), this.scope()).subscribe({
      next: response => {
        this.apiDocuments.set(response.content || []);
        this.totalDocuments.set(response.totalElements || 0);
        this.apiError.set('');
        this.loading.set(false);
      },
      error: err => {
        this.apiDocuments.set([]);
        this.totalDocuments.set(0);
        this.apiError.set(err?.error?.message || err?.message || 'No se pudo consultar la API de documentos.');
        this.loading.set(false);
      },
    });
  }

  // Filtrado reactivo en memoria sobre la página actual
  readonly filteredDocuments = () => {
    const q = this.search().trim().toLowerCase();
    const cat = this.categoryFilter().toLowerCase();
    const type = this.typeFilter();
    const dept = this.departmentFilter().toLowerCase();
    const spec = this.specialtyFilter().toLowerCase();
    const proc = this.processFilter().toLowerCase();
    const resp = this.responsibleFilter().toLowerCase();

    return [...this.apiDocuments()]
      .filter(doc => {
        if (q && !(`${doc.name} ${doc.code} ${doc.specialty || ''} ${doc.institutionalProcess || ''}`.toLowerCase().includes(q))) return false;
        if (this.statusFilter() && doc.status !== this.statusFilter()) return false;
        if (cat && !(doc.categoryName || '').toLowerCase().includes(cat)) return false;
        if (type && doc.documentTypeId !== type) return false;
        if (dept && !(doc.departmentName || '').toLowerCase().includes(dept)) return false;
        if (spec && !(doc.specialty || '').toLowerCase().includes(spec)) return false;
        if (proc && !(doc.institutionalProcess || '').toLowerCase().includes(proc)) return false;
        if (resp && !(doc.responsibleName || '').toLowerCase().includes(resp)) return false;
        if (this.dateFrom() && (doc.effectiveDate || doc.createdAt) < this.dateFrom()) return false;
        if (this.dateTo() && (doc.effectiveDate || doc.createdAt).slice(0, 10) > this.dateTo()) return false;
        return true;
      })
      .sort((a, b) => {
        if (this.sortBy() === 'name') return (a.name || '').localeCompare(b.name || '');
        if (this.sortBy() === 'version') return (b.currentVersion || 0) - (a.currentVersion || 0);
        const f = this.sortBy() === 'created' ? 'createdAt' : 'updatedAt';
        const aVal = String(a[f] || '');
        const bVal = String(b[f] || '');
        return bVal.localeCompare(aVal);
      });
  };

  readonly pagedDocuments = () => this.filteredDocuments();
  readonly totalPages = () => Math.max(1, Math.ceil(this.totalDocuments() / this.pageSize()));

  selectInitialFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    const error = this.fileValidationError(file);
    this.initialFile = error ? null : file;
    this.createError.set(error);
  }

  createDocument(): void {
    this.createError.set('');
    if (!this.createForm.documentTypeId || !this.createForm.name.trim() || !this.createForm.code.trim()) {
      this.createError.set('Por favor completa el nombre, código y tipo documental.');
      return;
    }
    if (this.isUploadRoute() && !this.initialFile) {
      this.createError.set('Selecciona un archivo PDF, PNG, JPEG o DOCX de hasta 25 MB.');
      return;
    }

    const payload: DocumentCreatePayload = {
      documentTypeId: this.createForm.documentTypeId,
      code: this.createForm.code.trim(),
      name: this.createForm.name.trim(),
    };

    if (this.createForm.description?.trim()) payload.description = this.createForm.description.trim();
    if (this.createForm.expedientId?.trim()) payload.expedientId = this.createForm.expedientId.trim();
    if (this.createForm.responsibleUserId?.trim()) payload.responsibleUserId = this.createForm.responsibleUserId.trim();
    if (this.createForm.departmentId?.trim()) payload.departmentId = this.createForm.departmentId.trim();
    if (this.createForm.patientId?.trim()) payload.patientId = this.createForm.patientId.trim();
    if (this.createForm.specialty?.trim()) payload.specialty = this.createForm.specialty.trim();
    if (this.createForm.institutionalProcess?.trim()) payload.institutionalProcess = this.createForm.institutionalProcess.trim();
    if (this.createForm.issueDate?.trim()) payload.issueDate = this.createForm.issueDate.trim();
    if (this.createForm.expiryDate?.trim()) payload.expiryDate = this.createForm.expiryDate.trim();

    this.creating.set(true);
    this.api.createDocument(payload).subscribe({
      next: doc => {
        if (!this.initialFile) {
          this.creating.set(false);
          this.actionMessage.set(`Documento ${doc.code} registrado con éxito.`);
          this.router.navigateByUrl('/documents');
          return;
        }

        this.api.uploadVersion(doc.id, this.initialFile, 'Carga inicial (versión v1)').subscribe({
          next: () => {
            this.creating.set(false);
            this.actionMessage.set(`Documento ${doc.code} y versión inicial v1 almacenados con éxito.`);
            this.router.navigateByUrl('/documents');
          },
          error: () => {
            this.creating.set(false);
            this.actionMessage.set(`Documento ${doc.code} creado. Puedes subir la versión desde el detalle.`);
            this.router.navigateByUrl('/documents');
          },
        });
      },
      error: err => {
        this.creating.set(false);
        this.createError.set(err?.error?.message || 'No se pudo crear el documento. Verifica los datos.');
      },
    });
  }

  setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.page.set(0);
    this.loadDocuments();
  }

  setStatus(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(0);
    this.loadDocuments();
  }

  setCategory(event: Event): void {
    this.categoryFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(0);
  }

  setFilter(field: 'type' | 'department' | 'specialty' | 'process' | 'responsible' | 'dateFrom' | 'dateTo', event: Event): void {
    const val = (event.target as HTMLInputElement | HTMLSelectElement).value;
    if (field === 'type') this.typeFilter.set(val);
    else if (field === 'department') this.departmentFilter.set(val);
    else if (field === 'specialty') this.specialtyFilter.set(val);
    else if (field === 'process') this.processFilter.set(val);
    else if (field === 'responsible') this.responsibleFilter.set(val);
    else if (field === 'dateFrom') this.dateFrom.set(val);
    else if (field === 'dateTo') this.dateTo.set(val);
    this.page.set(0);
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('');
    this.categoryFilter.set('');
    this.typeFilter.set('');
    this.departmentFilter.set('');
    this.specialtyFilter.set('');
    this.processFilter.set('');
    this.responsibleFilter.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.sortBy.set('updated');
    this.page.set(0);
    this.loadDocuments();
  }

  setSort(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value);
    this.page.set(0);
  }

  setPageSize(event: Event): void {
    this.pageSize.set(Number((event.target as HTMLSelectElement).value));
    this.page.set(0);
    this.loadDocuments();
  }

  previousPage(): void {
    this.page.update(v => Math.max(0, v - 1));
    this.loadDocuments();
  }

  nextPage(): void {
    this.page.update(v => Math.min(this.totalPages() - 1, v + 1));
    this.loadDocuments();
  }

  openDetails(doc: ApiDocument): void {
    this.selectedDocument.set(doc);
    this.detailError.set('');
    this.loadVersions(doc);
    this.workflowApi.page('',{documentId:doc.id,size:20}).subscribe({next:page=>this.documentWorkflows.set(page.content),error:()=>this.documentWorkflows.set([])});
  }

  closeDetails(): void {
    this.selectedDocument.set(null);
    this.documentWorkflows.set([]);
    if(this.route.snapshot.queryParamMap.has('documentId'))void this.router.navigate([], {relativeTo:this.route,queryParams:{documentId:null},queryParamsHandling:'merge',replaceUrl:true});
  }

  canStartWorkflow(): boolean {
    try { const token=this.auth.accessToken(); return !!token&&JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).authorities?.includes('workflow:start'); }
    catch { return false; }
  }
  openWorkflowStart(doc:ApiDocument):void {
    this.workflowApi.get('/options').subscribe({next:options=>{this.workflowOptions.set(options);this.workflowStartDocument.set(doc);},error:()=>this.detailError.set('No se pudieron cargar los responsables para iniciar el workflow.')});
  }
  workflowStarted(flow:any):void { this.workflowStartDocument.set(null);this.closeDetails();void this.router.navigate(['/workflows'],{queryParams:{workflow:flow.id}}); }

  openVersions(doc: ApiDocument): void {
    this.openDetails(doc);
  }

  loadVersions(doc: ApiDocument): void {
    this.detailLoading.set(true);
    this.detailError.set('');
    this.api.versions(doc.id).subscribe({
      next: verList => {
        this.versions.update(curr => ({ ...curr, [doc.id]: verList }));
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.detailError.set('No se pudo cargar el historial de versiones.');
      },
    });
  }

  uploadVersion(doc: ApiDocument, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    const error = this.fileValidationError(file);
    if (error) {
      this.actionMessage.set(error);
      input.value = '';
      return;
    }
    this.uploadDocument = doc;
    this.uploadFile.set(file);
    this.uploadReason = `Actualización de versión v${(doc.currentVersion || 1) + 1}`;
    input.value = '';
  }

  cancelUpload(): void {
    this.uploadDocument = null;
    this.uploadFile.set(null);
    this.uploadReason = '';
  }

  confirmUpload(): void {
    const doc = this.uploadDocument;
    const file = this.uploadFile();
    if (!doc || !file || !this.uploadReason.trim()) return;

    this.uploading.set(true);
    this.api.uploadVersion(doc.id, file, this.uploadReason.trim()).subscribe({
      next: () => {
        this.actionMessage.set(`Nueva versión v${(doc.currentVersion || 1) + 1} almacenada con éxito.`);
        this.loadVersions(doc);
        this.loadDocuments();
        this.uploading.set(false);
        this.cancelUpload();
      },
      error: () => {
        this.actionMessage.set('No se pudo almacenar la versión. Verifica el archivo.');
        this.uploading.set(false);
      },
    });
  }

  download(doc: ApiDocument, version: ApiDocumentVersion): void {
    this.api.downloadVersion(doc.id, version.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        link.download = version.fileName;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.actionMessage.set('No se pudo descargar el archivo.'),
    });
  }

  changeStatus(doc: ApiDocument, status: string): void {
    this.changingStatus.set(true);
    this.detailError.set('');
    this.api.changeStatus(doc.id, status).subscribe({
      next: updated => {
        this.selectedDocument.set(updated);
        this.apiDocuments.update(items => items.map(item => (item.id === updated.id ? updated : item)));
        this.actionMessage.set(`Estado actualizado a ${this.statusLabel(updated.status)}.`);
        this.changingStatus.set(false);
      },
      error: err => {
        this.detailError.set(err?.error?.message || 'No se pudo actualizar el estado.');
        this.changingStatus.set(false);
      },
    });
  }

  toggleExportMenu(event?: Event): void {
    if (event) event.stopPropagation();
    this.exportMenuOpen.update(v => !v);
  }

  closeExportMenu(): void {
    this.exportMenuOpen.set(false);
  }

  exportDocuments(format: string): void {
    this.exportMenuOpen.set(false);
    const docs = this.filteredDocuments();
    const data = docs.map(doc => ({
      name: doc.name,
      code: doc.code,
      status: this.statusLabel(doc.status),
      version: `v${doc.currentVersion || 1}`,
      documentType: doc.documentTypeName || '',
      category: doc.categoryName || '',
      department: doc.departmentName || '',
      specialty: doc.specialty || '',
      responsible: doc.responsibleName || '',
      createdAt: doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('es-ES') : '',
    }));

    const cols: ExportColumn[] = [
      { key: 'name', label: 'Nombre' },
      { key: 'code', label: 'Código' },
      { key: 'status', label: 'Estado' },
      { key: 'version', label: 'Versión' },
      { key: 'documentType', label: 'Tipo' },
      { key: 'category', label: 'Categoría' },
      { key: 'department', label: 'Servicio' },
      { key: 'specialty', label: 'Especialidad' },
      { key: 'responsible', label: 'Responsable' },
      { key: 'createdAt', label: 'Fecha' },
    ];

    const filename = `catalogo-documentos-${new Date().toISOString().split('T')[0]}`;
    if (format === 'CSV' || format === 'Excel') exportToCsv(data, filename, cols);
    else if (format === 'JSON') exportToJson(data, filename);
    else if (format === 'PDF') exportToPrintView('Catálogo Documental', 'Listado de documentos NexoDocs', data, cols);
    this.actionMessage.set(`Exportación de ${docs.length} documento(s) a ${format} completada.`);
  }

  allowedStatusTransitions(doc: ApiDocument): string[] {
    return (
      ({
        DRAFT: ['PENDING', 'TRASHED'],
        PENDING: ['IN_REVIEW', 'REJECTED'],
        IN_REVIEW: ['APPROVED', 'REJECTED', 'CORRECTED'],
        REJECTED: ['CORRECTED', 'DRAFT', 'TRASHED'],
        CORRECTED: ['IN_REVIEW', 'APPROVED', 'DRAFT'],
        APPROVED: ['CURRENT', 'ARCHIVED'],
        CURRENT: ['ARCHIVED', 'VOIDED'],
        ARCHIVED: ['CURRENT'],
        VOIDED: [],
        TRASHED: [],
      } as Record<string, string[]>)[doc.status] ?? []
    );
  }

  statusLabel(status: string): string {
    return (
      ({
        DRAFT: 'Borrador',
        PENDING: 'Pendiente',
        IN_REVIEW: 'En revisión',
        APPROVED: 'Aprobado',
        REJECTED: 'Rechazado',
        CORRECTED: 'Corregido',
        CURRENT: 'Vigente',
        ARCHIVED: 'Archivado',
        VOIDED: 'Anulado',
        TRASHED: 'Papelera',
      } as Record<string, string>)[status] ?? status
    );
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private fileValidationError(file: File | null): string {
    if (!file) return 'Selecciona un archivo.';
    if (file.size > 25 * 1024 * 1024) return 'El archivo supera el límite de 25 MB.';
    const allowed = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    return allowed.has(file.type) ? '' : 'Solo se admiten archivos PDF, JPEG, PNG o DOCX.';
  }
}

export { DocumentPage as DocumentosPage };
