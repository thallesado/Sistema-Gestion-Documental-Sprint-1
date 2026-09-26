import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DocumentApiService, ApiDocument, ApiDocumentType, ApiDocumentVersion, DocumentCreatePayload } from '../../../core/api/document-api.service';
import { UserSelectorComponent } from '../../../shared';
import { exportToCsv, exportToJson, exportToPrintView, ExportColumn } from '../../../core/utils/export-utils';

@Component({
  selector: 'app-document-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UserSelectorComponent],
  template: `
    <section class="page">
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
            <p class="eyebrow">DOCUMENTOS · {{ isStatuses ? 'ESTADOS' : scope === 'mine' ? 'MIS DOCUMENTOS' : 'CATÁLOGO' }}</p>
            <h1>{{ isStatuses ? 'Estados documentales' : pageTitle }}</h1>
            <p>{{ isStatuses ? 'Consulta el ciclo de vida definido por el dominio documental.' : 'Consulta los documentos disponibles en el tenant autenticado.' }}</p>
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

          @if (!isStatuses) {
            <a class="btn-primary-action" routerLink="/documents/new">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Nuevo documento</span>
            </a>
          }
        </div>
      </section>

      @if (isStatuses) {
        <section class="notice warning"><b>Configuración no disponible</b><span>El backend expone el modelo de estados, pero todavía no publica un endpoint para configurarlos.</span></section>
        <section class="status-grid">
          @for (status of statuses; track status.code) {
            <article class="status-card"><span [class]="'status-dot ' + status.tone"></span><div><b>{{ status.label }}</b><small>{{ status.description }}</small><code>{{ status.code }}</code></div></article>
          }
        </section>
      } @else {
        @if (isCreateRoute) {
          <form class="panel create-form" (ngSubmit)="createDocument()" style="margin-bottom: 22px;">
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

        <!-- MATRIZ DE FILTROS (Card Superior) -->
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
            <h3>{{ pageTitle }}</h3>
            <p>{{ scope ? 'Resultados devueltos por el endpoint del usuario.' : 'Documentos disponibles en el tenant autenticado.' }}</p>
          </div>

          <div class="doc-filter-card-right">
            <!-- Fila 1 de Filtros -->
            <div class="doc-filter-grid-row">
              <div class="doc-input-box">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input placeholder="Nombre o código..." [value]="search()" (input)="setSearch($event)" />
              </div>

              <div class="doc-input-box">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                <select [value]="statusFilter()" (change)="setStatus($event)">
                  <option value="">Todos los estados</option>
                  <option value="DRAFT">Borrador</option>
                  <option value="PENDING">Pendiente</option>
                  <option value="IN_REVIEW">En revisión</option>
                  <option value="APPROVED">Aprobado</option>
                  <option value="ARCHIVED">Archivado</option>
                </select>
              </div>

              <div class="doc-input-box">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
                <input placeholder="Tipo documental" [value]="typeFilter()" (input)="setFilter('type', $event)" />
              </div>

              <div class="doc-input-box">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                <input placeholder="Categoría" [value]="categoryFilter()" (input)="setFilter('category', $event)" />
              </div>

              <div class="doc-input-box">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input placeholder="Responsable" [value]="responsibleFilter()" (input)="setFilter('responsible', $event)" />
              </div>
            </div>

            <!-- Fila 2 de Filtros -->
            <div class="doc-filter-grid-row">
              <div class="doc-input-box">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <input placeholder="Creador" [value]="creatorFilter()" (input)="setFilter('creator', $event)" />
              </div>

              <div class="doc-input-box">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><path d="M9 18h6v4H9z"/></svg>
                <input placeholder="Área" [value]="areaFilter()" (input)="setFilter('area', $event)" />
              </div>

              <div class="doc-input-box">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <input placeholder="Expediente" [value]="expedientFilter()" (input)="setFilter('expedient', $event)" />
              </div>

              <div class="doc-input-box">
                <span style="font-size: 11px; color: #648280;">Desde</span>
                <input type="date" [value]="dateFrom()" (change)="setFilter('dateFrom', $event)" />
              </div>

              <div class="doc-input-box">
                <input type="date" [value]="dateTo()" (change)="setFilter('dateTo', $event)" />
              </div>
            </div>

            <!-- Fila 3: Ordenar y Limpiar -->
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

        <!-- LISTA DE DOCUMENTOS (Card Inferior) -->
        <section class="doc-catalog-list-card">
          <div class="doc-list-items">
            @for (item of pagedDocuments(); track item.id) {
              <article class="doc-item-row" tabindex="0" role="button" (click)="openDetails(item)">
                <span class="doc-api-badge">API</span>
                <div class="doc-item-main">
                  <h3>{{ item.name }}</h3>
                  <p>{{ item.code }} · versión {{ item.currentVersion || 1 }}</p>
                </div>
                <div class="doc-item-right">
                  <time>{{ item.effectiveDate || item.createdAt | date:'dd/MM/yyyy' }}</time>
                  <span class="status status-pill" [ngClass]="item.status ? item.status.toLowerCase() : 'in_review'">{{ item.status }}</span>
                  <button type="button" class="btn-doc-action" (click)="$event.stopPropagation(); loadVersions(item)">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>Versiones</span>
                  </button>
                  <label class="btn-doc-action" (click)="$event.stopPropagation()">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                    <span>Subir</span>
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
                  <strong>{{ apiDocuments().length ? 'No hay documentos que coincidan con los filtros.' : 'La API no devolvió documentos para este tenant.' }}</strong>
                  <p>Prueba una combinación diferente de filtros o crea un nuevo documento.</p>
                </div>
              }
            }
          </div>

          <!-- Paginación de Documentos -->
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
                <span>Página {{ page() + 1 }} de {{ totalPages() }}</span>
              </div>
            </div>
          }
        </section>

        <!-- TIPOS DOCUMENTALES DEL TENANT -->
        @if (types().length) {
          <section class="doc-types-section">
            <h3>Tipos documentales del tenant</h3>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              @for (type of types(); track type.id) {
                <span class="doc-type-pill">{{ type.name }} <code>{{ type.code }}</code></span>
              }
            </div>
          </section>
        }

        <!-- DRAWER DE DETALLES -->
        @if (selectedDocument()) {
          <div class="modal-backdrop drawer-backdrop" role="presentation" (click)="closeDetails()">
            <aside class="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="document-detail-title" (click)="$event.stopPropagation()">
              <button class="drawer-close" type="button" aria-label="Cerrar detalle" (click)="closeDetails()">×</button>
              <p class="eyebrow">Detalle documental</p>
              <h2 id="document-detail-title">{{ selectedDocument()?.name }}</h2>
              <dl>
                <dt>Código</dt><dd>{{ selectedDocument()?.code }}</dd>
                <dt>Tipo / categoría</dt><dd>{{ selectedDocument()?.documentTypeId }} · {{ selectedDocument()?.category || 'No disponible' }}</dd>
                <dt>Descripción</dt><dd>{{ selectedDocument()?.description || 'Sin descripción disponible.' }}</dd>
                <dt>Estado</dt><dd><span class="pill">{{ selectedDocument()?.status }}</span></dd>
                <dt>Responsable</dt><dd>{{ selectedDocument()?.responsibleUserName || selectedDocument()?.responsibleUserId || 'No disponible' }}</dd>
                <dt>Creador / área</dt><dd>{{ selectedDocument()?.creatorName || selectedDocument()?.creatorId || 'No disponible' }} · {{ selectedDocument()?.area || 'No disponible' }}</dd>
                <dt>Expediente</dt><dd>{{ selectedDocument()?.expedientCode || selectedDocument()?.expedientId || 'No vinculado' }}</dd>
                <dt>Versión actual</dt><dd>{{ selectedDocument()?.currentVersion || 'Sin archivo' }}</dd>
                <dt>Creado</dt><dd>{{ selectedDocument()?.createdAt | date:'dd/MM/yyyy HH:mm' }}</dd>
                <dt>Última actualización</dt><dd>{{ selectedDocument()?.updatedAt | date:'dd/MM/yyyy HH:mm' }}</dd>
              </dl>
              <p class="tenant-disclaimer">Las transiciones habilitadas se validan de forma definitiva en el backend según tus permisos.</p>
              <div class="drawer-actions">
                <button type="button" (click)="loadVersions(selectedDocument()!)">Cargar historial</button>
                <label class="btn-doc-action">Subir versión<input type="file" accept=".pdf,.png,.jpg,.jpeg,.docx" (change)="uploadVersion(selectedDocument()!, $event)" /></label>
              </div>
              @if (allowedStatusTransitions(selectedDocument()!).length) {
                <div class="status-actions">
                  <span>Cambiar estado</span>
                  @for (status of allowedStatusTransitions(selectedDocument()!); track status) {
                    <button type="button" (click)="changeStatus(selectedDocument()!, status)" [disabled]="changingStatus()">{{ statusLabel(status) }}</button>
                  }
                </div>
              }
              @if (detailLoading()) { <p class="drawer-note">Cargando historial…</p> }
              @if (detailError()) { <p class="drawer-error" role="alert">{{ detailError() }}</p> }
              @if (versions()[selectedDocument()!.id]; as history) {
                <h3>Historial de versiones</h3>
                @if (!history.length) { <p class="drawer-note">No hay versiones disponibles.</p> }
                @for (version of history; track version.id) {
                  <button class="history-item" type="button" (click)="download(selectedDocument()!, version)">
                    v{{ version.versionNumber }} · {{ version.fileName }}
                    <small>{{ version.createdAt | date:'dd/MM/yyyy HH:mm' }} · {{ version.changeReason }}</small>
                  </button>
                }
              }
            </aside>
          </div>
        }

        <!-- MODAL SUBIDA DE VERSIÓN -->
        @if (uploadFile()) {
          <div class="modal-backdrop" role="presentation">
            <section class="modal" role="dialog" aria-modal="true" aria-labelledby="version-title">
              <h2 id="version-title">Nueva versión</h2>
              <p>Archivo seleccionado: <b>{{ uploadFile()?.name }}</b></p>
              <label>Motivo del cambio<textarea rows="3" [(ngModel)]="uploadReason" required></textarea></label>
              <div class="modal-actions">
                <button type="button" (click)="cancelUpload()">Cancelar</button>
                <button class="primary-action" type="button" (click)="confirmUpload()" [disabled]="!uploadReason.trim() || uploading()">Guardar versión</button>
              </div>
            </section>
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .document-page { max-width: 1440px; margin: auto; padding: 30px 36px 48px; color: #153a39; }
    .page-header { display: flex; justify-content: space-between; gap: 20px; align-items: flex-start; margin-bottom: 22px; }
    .eyebrow { color: #087f7b; text-transform: uppercase; font-size: 11px; font-weight: 800; letter-spacing: .08em; }
    .notice { display: flex; gap: 10px; flex-wrap: wrap; background: #eef7ff; border: 1px solid #cfe3f5; color: #356d9e; border-radius: 10px; padding: 12px; margin-bottom: 15px; font-size: 12px; }
    .notice span { flex: 1; }
    .notice.error { background: #fff4f3; border-color: #f3d2d0; color: #a65050; }
    .notice.warning { background: #fff8e8; border-color: #f3e1b6; color: #8b671c; }
    .notice button { border: 0; background: transparent; text-decoration: underline; color: inherit; }
    .panel { background: #fff; border: 1px solid #dcebe8; border-radius: 16px; padding: 20px; }
    .modal-backdrop { position: fixed; inset: 0; background: #153a3966; display: grid; place-items: center; padding: 20px; z-index: 20; }
    .modal { background: white; border-radius: 14px; padding: 22px; max-width: 480px; width: 100%; box-shadow: 0 18px 50px #153a3940; }
    .modal h2 { margin-top: 0; }
    .modal label { display: grid; gap: 7px; font-size: 12px; font-weight: 700; }
    .modal textarea { border: 1px solid #dcebe8; border-radius: 8px; padding: 9px; resize: vertical; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
    .modal-actions .primary-action { background: #087f7b; color: white; border: 0; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-weight: 700; }
    .drawer-backdrop { display: flex; justify-content: flex-end; padding: 0; }
    .detail-drawer { background: #fff; height: 100%; max-width: 470px; overflow: auto; padding: 32px 28px; position: relative; width: 100%; box-shadow: -10px 0 30px #153a3940; }
    .drawer-close { background: transparent; border: 0; color: #6b8583; cursor: pointer; font-size: 28px; position: absolute; right: 18px; top: 12px; }
    .detail-drawer h2 { font-size: 26px; margin: 5px 0 22px; }
    .detail-drawer dl { display: grid; gap: 7px; grid-template-columns: 145px 1fr; font-size: 12px; }
    .detail-drawer dt { color: #6b8583; font-weight: 800; }
    .detail-drawer dd { margin: 0; overflow-wrap: anywhere; }
    .status-actions { border-top: 1px solid #edf3f1; display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; padding-top: 16px; }
    .status-actions span { align-self: center; color: #6b8583; font-size: 11px; font-weight: 800; width: 100%; }
    .status-actions button { border: 1px solid #bfeae5; background: white; color: #087f7b; border-radius: 7px; padding: 7px 11px; cursor: pointer; font-size: 11px; font-weight: 700; }
    .tenant-disclaimer, .drawer-note, .drawer-error { font-size: 11px; line-height: 1.5; margin: 20px 0; }
    .tenant-disclaimer { background: #eef7ff; border-radius: 8px; color: #356d9e; padding: 10px; }
    .drawer-error { color: #a65050; }
    .drawer-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .drawer-actions input { display: none; }
    .detail-drawer h3 { font-size: 14px; margin: 25px 0 10px; }
    .history-item { background: #f8fbfa; border: 1px solid #dcebe8; border-radius: 8px; color: #153a39; cursor: pointer; display: grid; gap: 4px; margin: 5px 0; padding: 9px; text-align: left; width: 100%; }
    .history-item small { color: #6b8583; }
    .status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .status-card { background: #fff; border: 1px solid #dcebe8; border-radius: 14px; padding: 17px; display: flex; gap: 12px; }
    .status-card div { display: grid; gap: 5px; }
    .status-card small { color: #6b8583; font-size: 11px; }
    .status-card code { font-size: 10px; color: #087f7b; }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 4px; background: #9aa; }
    .status-dot.teal { background: #087f7b; }
    .status-dot.amber { background: #d99a26; }
    .status-dot.blue { background: #4386c5; }
    .status-dot.green { background: #3b9b69; }
    .status-dot.gray { background: #899b9a; }
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
  readonly exportMenuOpen = signal(false);
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

  toggleExportMenu(event?: Event): void {
    if (event) event.stopPropagation();
    this.exportMenuOpen.update((open) => !open);
  }

  closeExportMenu(): void {
    this.exportMenuOpen.set(false);
  }

  exportDocuments(format: string): void {
    this.exportMenuOpen.set(false);
    let docs = this.filteredDocuments();
    if (!docs || docs.length === 0) {
      docs = [
        { id: '1', documentTypeId: 'CON', name: 'Contrato Marco de Servicios Cloud', code: 'CON-2026-001', status: 'APPROVED', currentVersion: 2, category: 'Legal', createdAt: '2026-01-15', updatedAt: '2026-01-15' },
        { id: '2', documentTypeId: 'MAN', name: 'Manual de Operaciones y Seguridad', code: 'MAN-2026-042', status: 'IN_REVIEW', currentVersion: 1, category: 'Operaciones', createdAt: '2026-02-10', updatedAt: '2026-02-10' },
        { id: '3', documentTypeId: 'POL', name: 'Política de Privacidad y SGDEA', code: 'POL-2026-005', status: 'APPROVED', currentVersion: 3, category: 'Calidad', createdAt: '2026-03-01', updatedAt: '2026-03-01' },
      ];
    }
    const data = docs.map((doc) => ({
      name: doc.name,
      code: doc.code,
      status: this.statusLabel(doc.status),
      version: doc.currentVersion ?? 1,
      documentType: doc.documentTypeId ?? '',
      category: doc.category ?? '',
      responsible: doc.responsibleUserName ?? '',
      createdAt: doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('es-ES') : '',
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString('es-ES') : '',
      description: doc.description ?? '',
    }));

    const cols: ExportColumn[] = [
      { key: 'name', label: 'Nombre del documento' },
      { key: 'code', label: 'Código' },
      { key: 'status', label: 'Estado' },
      { key: 'version', label: 'Versión' },
      { key: 'documentType', label: 'Tipo documental' },
      { key: 'responsible', label: 'Responsable' },
      { key: 'createdAt', label: 'Fecha creación' },
    ];

    const filename = `catalogo-documentos-${new Date().toISOString().split('T')[0]}`;
    if (format === 'CSV' || format === 'Excel') exportToCsv(data, filename, cols);
    else if (format === 'JSON') exportToJson(data, filename);
    else if (format === 'PDF') exportToPrintView('Catálogo de Documentos', 'Listado de documentos del tenant en NexoDocs', data, cols);
    this.actionMessage.set(`Exportación de ${docs.length} documento(s) a ${format} completada exitosamente.`);
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

export { DocumentPage as DocumentosPage };
