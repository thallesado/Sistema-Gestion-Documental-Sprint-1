import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, HostListener, inject, OnDestroy, signal, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  DemoItem,
  RouteInfo,
  screenCopy,
  demoList,
} from '../../../core/data/nexodocs-data';
import { Pagination } from '../../../shared';
import { AdministrationApiService, ApiPermission, ApiRole } from '../../../core/api/administration-api.service';
import { PermissionsCatalog } from '../../users/components/permissions-catalog';
import { RoleFormModal } from '../../users/components/role-form-modal';
import { RolePermissionsModal } from '../../users/components/role-permissions-modal';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentApiService, ApiDocument, ApiDocumentType, ApiDepartment } from '../../../core/api/document-api.service';
import { WorkspaceApiService, ApiActivity, ApiTask } from '../../../core/api/workspace-api.service';
import { exportToCsv, exportToJson, exportToPrintView, ExportColumn } from '../../../core/utils/export-utils';
import { WorkflowApi } from '../../workflows/workflow-api.service';
import { OcrApiService, OcrProcessResult } from '../../../core/api/ocr-api.service';
import { buildStatCards, changedMetadata, OcrMetadataFields, routeForStatus, statusLabel } from '../../../core/utils/ocr-flow';
import {
  cameraFailureMessage,
  captureFrameToFile,
  CameraFacing,
  classifyCameraError,
  isCameraSupported,
  openCameraStream,
  stopStream,
} from '../../../core/utils/camera-capture';

type PageStat = { icon: string; label: string; value: string; detail: string; tone: string };
type OcrStatus = 'QUEUED' | 'PROCESSING' | 'REQUIRES_VALIDATION' | 'VALIDATED' | 'INDEXED';
type TabLink = { label: string; href: string };

@Component({
  selector: 'app-workspace-page',
  imports: [CommonModule, RouterLink, Pagination, PermissionsCatalog, RoleFormModal, RolePermissionsModal],
  template: `
    <section class="page">
      @if (isHome) {
        <section class="dashboard-welcome">
          <div class="welcome-left">
            <p class="eyebrow">{{ todayLabel | uppercase }}</p>
            <h1>Buenos días, {{ displayName() }}</h1>
            <p class="welcome-copy">Aquí tienes un resumen de lo que está ocurriendo en tu organización.</p>
          </div>
          <div class="welcome-illustration-wrap">
            <svg viewBox="0 0 240 180" fill="none" xmlns="http://www.w3.org/2000/svg" class="hero-folder-svg">
              <circle cx="120" cy="90" r="75" fill="#d9f3ee" fill-opacity="0.7"/>
              <path d="M178 40 C194 36 206 48 202 65 C192 65 180 54 178 40 Z" fill="#8bc9bd"/>
              <path d="M192 30 C207 27 217 37 214 50 C207 50 197 42 192 30 Z" fill="#a4dcce"/>
              <path d="M188 112 C204 118 208 133 198 143 C188 138 183 123 188 112 Z" fill="#78bfb2"/>
              <rect x="74" y="42" width="72" height="92" rx="8" fill="#ffffff" stroke="#c8e4de" stroke-width="2"/>
              <rect x="88" y="58" width="44" height="4" rx="2" fill="#d4ece7"/>
              <rect x="88" y="68" width="36" height="4" rx="2" fill="#d4ece7"/>
              <rect x="88" y="78" width="28" height="4" rx="2" fill="#d4ece7"/>
              <path d="M58 84 C58 78 63 74 69 74 L98 74 L110 84 L171 84 C177 84 182 89 182 95 L182 136 C182 143 177 148 170 148 L70 148 C63 148 58 143 58 136 Z" fill="#4ea99b"/>
              <path d="M58 92 C58 86 63 82 69 82 L171 82 C177 82 182 87 182 93 L182 136 C182 143 177 148 170 148 L70 148 C63 148 58 143 58 136 Z" fill="#138072"/>
            </svg>
          </div>
          <div class="hero-actions">
            <a routerLink="/documents/new" class="btn-primary-action">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Crear documento</span>
            </a>
            <a routerLink="/documents/upload" class="btn-secondary-action">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              <span>Subir archivo</span>
            </a>
          </div>
        </section>

        <div class="dashboard-grid">
          <!-- Mis tareas Card -->
          <article class="dashboard-card task-card">
            <div class="card-heading">
              <div class="heading-left">
                <span class="card-icon-badge badge-amber">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </span>
                <div>
                  <h2>Mis tareas</h2>
                  <p>Requieren tu atención</p>
                </div>
              </div>
              <a routerLink="/dashboard/tasks" class="card-link">Ver todas →</a>
            </div>

            <div class="task-counter-strip">
              <div class="counter-item"><strong>{{ tasks().length }}</strong><span>pendientes</span></div>
              <div class="counter-item"><b>{{ highPriorityTasks() }}</b><span>alta prioridad</span></div>
            </div>

            @if (tasks().length) {
              @for (task of tasks(); track task.id) {
                <div class="task-line">
                  <span class="dot" [ngClass]="task.status === 'COMPLETED' ? 'green-dot' : task.status === 'IN_REVIEW' ? 'blue-dot' : 'amber-dot'"></span>
                  <div class="task-line-info">
                    <strong class="task-title">{{ task.title }}</strong>
                    <span class="task-meta">
                      <span>{{ task.dueAt ? ('Vence: ' + (task.dueAt | date:'dd/MM/yyyy')) : 'Sin fecha límite' }}</span>
                      @if (task.area) {
                        <span class="meta-separator">·</span>
                        <span class="task-area-pill">{{ task.area }}</span>
                      }
                    </span>
                  </div>
                  <span class="status status-pill" [ngClass]="taskStatusClass(task.status)">{{ formatTaskStatus(task.status) }}</span>
                </div>
              }
            } @else {
              <div class="empty-state-wrap">
                <span class="empty-icon">
                  <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#9bbcb6" stroke-width="1.8">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                    <polyline points="9 13 11 15 15 11"/>
                  </svg>
                </span>
                <p>No tienes tareas pendientes.</p>
              </div>
            }
          </article>

          <!-- Actividad reciente Card -->
          <article class="dashboard-card activity-card">
            <div class="card-heading">
              <div class="heading-left">
                <span class="card-icon-badge badge-mint">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                  </svg>
                </span>
                <div>
                  <h2>Actividad reciente</h2>
                  <p>Últimos movimientos del tenant</p>
                </div>
              </div>
              <a routerLink="/dashboard/activity" class="card-link">Ver actividad →</a>
            </div>

            @if (activities().length) {
              @for (event of activities(); track event.id) {
                <div class="activity-row">
                  <span class="activity-avatar" [class.avatar-doc]="event.entityType === 'DOCUMENT'" [class.avatar-task]="event.entityType === 'TASK'">{{ event.entityType === 'DOCUMENT' ? 'DOC' : event.entityType === 'TASK' ? 'TSK' : initials(event.userId || 'Usuario') }}</span>
                  <div class="activity-info">
                    <strong class="activity-title">{{ formatActivityTitle(event) }}</strong>
                    <span class="activity-detail">{{ formatActivityDetail(event) }}</span>
                  </div>
                  <time class="activity-time">{{ event.occurredAt | date:'dd/MM/yyyy, HH:mm' }}</time>
                </div>
              }
            } @else {
              <div class="empty-state-wrap">
                <span class="empty-icon">
                  <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#9bbcb6" stroke-width="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </span>
                <p>No hay actividad reciente.</p>
              </div>
            }
          </article>
        </div>

        @if (workflowSummary(); as workflow) {
          <section class="panel dashboard-documents" aria-label="Resumen de workflows">
            <div class="panel-title"><div><h2>Workflows que requieren atención</h2><p>Tareas asignadas y plazos de tu cuenta.</p></div><a routerLink="/workflows" class="card-link">Ver workflows →</a></div>
            <div class="task-counter-strip"><a routerLink="/workflows/tasks"><strong>{{ workflow.widgets?.my_tasks || 0 }}</strong><span>Mis tareas</span></a><a routerLink="/workflows/pending-review"><strong>{{ workflow.widgets?.reviews || 0 }}</strong><span>Revisiones</span></a><a routerLink="/workflows/pending-approval"><strong>{{ workflow.widgets?.approvals || 0 }}</strong><span>Aprobaciones</span></a><a routerLink="/workflows/tasks" [queryParams]="{dueSoon:true}"><strong>{{ workflow.widgets?.due_soon || 0 }}</strong><span>Vencen pronto</span></a></div>
          </section>
        }

        <!-- Documentos recientes Panel -->
        <section class="panel dashboard-documents">
          <div class="panel-title">
            <div class="panel-title-left">
              <span class="card-icon-badge badge-teal-light">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
              </span>
              <div>
                <h2>Documentos recientes</h2>
                <p>Los documentos que han tenido actividad recientemente.</p>
              </div>
            </div>
            <a routerLink="/documents" class="card-link">Ver todos →</a>
          </div>

          <div class="list document-list">
            @for (item of recentDocuments(); track item.id) {
              <article>
                <span class="file-icon">DOC</span>
                <div class="doc-info">
                  <h3>{{ item.name }}</h3>
                  <p>{{ item.code }}</p>
                </div>
                <time>{{ item.updatedAt | date:'dd/MM/yyyy' }}</time>
                <span class="status status-pill" [ngClass]="item.status ? item.status.toLowerCase() : 'in_review'">{{ item.status }}</span>
                <div class="row-actions">
                  <button class="more-button" type="button" (click)="toggleRowMenu(item.id)" [attr.aria-expanded]="openRowMenu === item.id" aria-label="Abrir opciones">•••</button>
                  @if (openRowMenu === item.id) {
                    <div class="row-menu">
                      <button type="button" (click)="rowAction('Ver', item.name)">Ver</button>
                      <button type="button" (click)="rowAction('Editar', item.name)">Editar</button>
                      <button type="button" class="danger-action" (click)="rowAction('Eliminar', item.name)">Eliminar</button>
                    </div>
                  }
                </div>
              </article>
            } @empty {
              <div class="empty-state-wrap">
                <span class="empty-icon">
                  <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="#9bbcb6" stroke-width="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                </span>
                <p>No hay documentos recientes.</p>
              </div>
            }
          </div>

          <app-pagination
            [total]="recentDocuments().length"
            [page]="dashboardPage()"
            [pageSize]="dashboardPageSize()"
            (pageChange)="dashboardPage.set($event)"
            (pageSizeChange)="changeDashboardPageSize($event)"
          />
        </section>
      } @else if (isTasksView || isActivityView || isRolesView || isPermissionsView || isNotificationsView) {
        <!-- HERO BANNER -->
        <section class="module-hero-banner">
          <div class="module-hero-left">
            <span class="module-hero-badge" [class.badge-perm-icon]="isPermissionsView" [class.badge-role-icon]="isRolesView" [class.badge-notif-icon]="isNotificationsView">
              @if (isRolesView) {
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M12 8v4"/>
                  <path d="M12 16h.01"/>
                </svg>
              } @else if (isPermissionsView) {
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              } @else if (isNotificationsView) {
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              } @else if (isTasksView) {
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="9" y1="13" x2="15" y2="13"/>
                  <line x1="9" y1="17" x2="13" y2="17"/>
                </svg>
              } @else {
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
                </svg>
              }
            </span>
            <div class="module-hero-text">
              <p class="eyebrow">{{ isRolesView ? 'USUARIOS Y EQUIPOS · ROLES' : isPermissionsView ? 'USUARIOS Y EQUIPOS · PERMISOS' : isNotificationsView ? ('NOTIFICACIONES · ' + (routeInfo.subcategory || 'Todas') | uppercase) : isTasksView ? 'INICIO · MIS TAREAS' : 'INICIO · ACTIVIDAD RECIENTE' }}</p>
              <h1>{{ isRolesView ? 'Roles del sistema' : isPermissionsView ? 'Permisos del sistema' : isNotificationsView ? (routeInfo.subcategory === 'Todas' ? 'Centro de notificaciones' : routeInfo.subcategory === 'No leidas' ? 'Notificaciones no leídas' : routeInfo.subcategory === 'Tareas' ? 'Notificaciones de tareas' : routeInfo.subcategory === 'Aprobaciones' ? 'Solicitudes de aprobación' : routeInfo.subcategory === 'Menciones' ? 'Menciones y comentarios' : routeInfo.subcategory) : isTasksView ? 'Mis tareas' : 'Actividad reciente' }}</h1>
              <p>{{ isRolesView ? 'Define y administra los perfiles de acceso y responsabilidades de los usuarios en el tenant.' : isPermissionsView ? 'Controla qué acciones y operaciones puede realizar cada rol sobre los módulos de NexoDocs.' : isNotificationsView ? copy.description : isTasksView ? 'Prioriza revisiones, aprobaciones y validaciones asignadas a tu usuario.' : 'Consulta los últimos movimientos realizados dentro de la organización.' }}</p>
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

            @if (!isPermissionsView) {
            <button type="button" class="btn-primary-action" (click)="handleHeaderAction()">
              @if (isNotificationsView) {
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Marcar todo leído</span>
              } @else if (isRolesView || isPermissionsView) {
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>{{ isRolesView ? 'Nuevo rol' : 'Crear permiso' }}</span>
              } @else if (isTasksView) {
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                <span>Nueva acción</span>
              } @else {
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2">
                  <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                </svg>
                <span>Nueva acción</span>
              }
            </button>
            }
          </div>
        </section>

        <!-- KPI STATS CARDS ROW (3 Cards) -->
        <div class="kpi-stats-grid">
          @if (isNotificationsView) {
            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap mint">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>No leídas</small>
                  <strong>6</strong>
                  <p>2 de alta prioridad</p>
                </div>
              </div>
              <button type="button" class="kpi-card-arrow" aria-label="Ver no leídas" routerLink="/notifications/unread">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </article>

            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap amber">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Pendientes de acción</small>
                  <strong>4</strong>
                  <p>Aprobaciones y firmas</p>
                </div>
              </div>
              <button type="button" class="kpi-card-arrow" aria-label="Ver pendientes" routerLink="/notifications/approvals">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </article>

            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap green">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Atendidas hoy</small>
                  <strong>12</strong>
                  <p>Tiempo prom. 18 min</p>
                </div>
              </div>
              <button type="button" class="kpi-card-arrow" aria-label="Ver todas" routerLink="/notifications">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </article>
          } @else if (isRolesView) {
            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap mint">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Roles activos</small>
                  <strong>{{ activeRolesCount() }}</strong>
                  <p>{{ roles().length - systemRoles() }} personalizados</p>
                </div>
              </div>
            </article>

            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap amber">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Asignaciones de rol</small>
                  <strong>{{ userAssignments() }}</strong>
                  <p>Usuarios por rol</p>
                </div>
              </div>
            </article>

            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap green">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Roles de sistema</small>
                  <strong>{{ systemRoles() }}</strong>
                  <p>Predefinidos</p>
                </div>
              </div>
            </article>
          } @else if (isPermissionsView) {
            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap mint">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Permisos del sistema</small>
                  <strong>{{ permissions().length }}</strong>
                  <p>Operaciones mapeadas</p>
                </div>
              </div>
            </article>

            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap amber">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Permisos críticos</small>
                  <strong>{{ criticalCount() }}</strong>
                  <p>Acceso restringido</p>
                </div>
              </div>
            </article>

            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap green">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Módulos del sistema</small>
                  <strong>{{ totalModulos() }}</strong>
                  <p>Áreas funcionales</p>
                </div>
              </div>
            </article>
          } @else {
            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap mint">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Registros</small>
                  <strong>1,248</strong>
                  <p>Tenant actual</p>
                </div>
              </div>
              @if (isTasksView) {
                <button type="button" class="kpi-card-more" aria-label="Opciones">•••</button>
              } @else {
                <button type="button" class="kpi-card-arrow" aria-label="Ver registros">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              }
            </article>

            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap amber">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Pendientes</small>
                  <strong>24</strong>
                  <p>Requieren atención</p>
                </div>
              </div>
              @if (isTasksView) {
                <button type="button" class="kpi-card-more" aria-label="Opciones">•••</button>
              } @else {
                <button type="button" class="kpi-card-arrow" aria-label="Ver pendientes">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              }
            </article>

            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap green">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Actividad mensual</small>
                  <strong>+12.5%</strong>
                  <p>Comparado con mayo</p>
                </div>
              </div>
              @if (isTasksView) {
                <button type="button" class="kpi-card-more" aria-label="Opciones">•••</button>
              } @else {
                <button type="button" class="kpi-card-arrow" aria-label="Ver actividad">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              }
            </article>
          }
        </div>

        <!-- MAIN CARD PANEL -->
        @if (isPermissionsView) {
          <app-permissions-catalog [permissions]="permissions()" />
        } @else {
        <section class="module-main-card">
          @if (isNotificationsView) {
            <nav class="internal-tabs" aria-label="Vistas de notificaciones" style="padding-top: 14px; padding-bottom: 6px;">
              @for (tab of notificationTabs; track tab.href) {
                <a [routerLink]="tab.href" [class.active]="routeInfo.href === tab.href">{{ tab.label }}</a>
              }
            </nav>
          }

          <div class="module-card-header">
            <h2>{{ isNotificationsView ? 'Bandeja de notificaciones' : isRolesView ? 'Roles configurados' : isPermissionsView ? 'Matriz de permisos' : 'Inicio recientes' }}</h2>
            <p>{{ isNotificationsView ? 'Avisos, asignaciones y eventos en tiempo real del tenant activo.' : isRolesView ? 'Perfiles de acceso y responsabilidades definidos en el tenant.' : isPermissionsView ? 'Operaciones autorizables en la plataforma documental.' : 'Datos del tenant autenticado.' }}</p>
          </div>

          <div class="module-filter-bar">
            <div class="module-search-pill">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="color: #648280;">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input [placeholder]="isNotificationsView ? 'Buscar notificación por asunto, remitente o detalle...' : isRolesView ? 'Buscar rol por nombre o alcance...' : isPermissionsView ? 'Buscar permiso por clave o módulo...' : 'Buscar en este módulo...'" [value]="searchTerm()" (input)="setSearchTerm($event)" />
            </div>

            <div class="module-filter-group">
              <div class="export-dropdown-wrapper">
                <button type="button" class="filter-btn-pill" (click)="toggleExportMenu($event)" [attr.aria-expanded]="exportMenuOpen()">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span>Exportar</span>
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                @if (exportMenuOpen()) {
                  <div class="export-dropdown-backdrop" (click)="closeExportMenu()"></div>
                  <div class="export-dropdown-popover">
                    <button type="button" (click)="exportAs('Excel')">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                      <div><strong>Exportar a Excel</strong><small>Descargar tabla en formato .csv para Excel</small></div>
                    </button>
                    <button type="button" (click)="exportAs('PDF')">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      <div><strong>Exportar a PDF</strong><small>Vista de impresión y guardado PDF</small></div>
                    </button>
                    <button type="button" (click)="exportAs('JSON')">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                      <div><strong>Exportar a JSON</strong><small>Descargar archivo de datos .json</small></div>
                    </button>
                  </div>
                }
              </div>
              @if (isRolesView) {
                <select class="filter-btn-pill" aria-label="Filtrar por estado" [value]="filtroEstado()" (change)="setFiltroEstado($event)">
                  <option value="">Todos los estados</option><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option>
                </select>
                <select class="filter-btn-pill" aria-label="Filtrar por tipo" [value]="filtroTipo()" (change)="setFiltroTipo($event)">
                  <option value="">Todos los tipos</option><option value="SYSTEM">Sistema</option><option value="CUSTOM">Personalizado</option>
                </select>
              } @else {
              <button type="button" class="filter-btn-pill active" (click)="toggleActiveFilter('estado')">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                <span>Estado</span>
              </button>
              <button type="button" class="filter-btn-pill" (click)="toggleActiveFilter(isPermissionsView ? 'modulo' : isRolesView ? 'tipo' : isNotificationsView ? 'tipo' : 'area')">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                <span>{{ isPermissionsView ? 'Módulo' : isRolesView ? 'Tipo' : isNotificationsView ? 'Tipo' : 'Área' }}</span>
              </button>
              <button type="button" class="filter-btn-pill" (click)="toggleActiveFilter(isPermissionsView ? 'criticidad' : isRolesView ? 'nivel' : isNotificationsView ? 'prioridad' : 'fecha')">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>{{ isPermissionsView ? 'Criticidad' : isRolesView ? 'Nivel' : isNotificationsView ? 'Prioridad' : 'Fecha' }}</span>
              </button>
              }
            </div>
          </div>

          <!-- Items list -->
          @if (isTasksView && tasks().length) {
            <div class="list">
              @for (task of tasks(); track task.id) {
                <article class="doc-item-row">
                  <span class="doc-api-badge">TASK</span>
                  <div class="doc-item-main">
                    <h3>{{ task.title }}</h3>
                    <p>{{ task.dueAt ? ('Fecha límite: ' + (task.dueAt | date:'dd/MM/yyyy')) : 'Sin fecha límite' }}{{ task.area ? ' · ' + task.area : '' }}</p>
                  </div>
                  <span class="status status-pill" [ngClass]="task.status ? task.status.toLowerCase() : 'pending'">{{ task.status }}</span>
                </article>
              }
            </div>
          } @else if (isActivityView && activities().length) {
            <div class="list">
              @for (event of activities(); track event.id) {
                <article class="doc-item-row">
                  <span class="doc-api-badge">LOG</span>
                  <div class="doc-item-main">
                    <h3>{{ event.action }}</h3>
                    <p>{{ event.entityType }}{{ event.entityId ? ' · ' + event.entityId : '' }} · {{ event.userId || 'Usuario' }}</p>
                  </div>
                  <time class="doc-item-right">{{ event.occurredAt | date:'short' }}</time>
                </article>
              }
            </div>
          } @else if (isNotificationsView && visibleItems().length) {
            <div class="list">
              @for (item of visibleItems(); track item.title) {
                <article class="doc-item-row">
                  <span class="doc-api-badge" [ngClass]="getNotifBadgeClass(item.type || 'DOC')">{{ item.type || 'DOC' }}</span>
                  <div class="doc-item-main">
                    <h3>{{ item.title }}</h3>
                    <p>{{ item.meta }}</p>
                  </div>
                  <div class="doc-item-right">
                    <time>{{ item.date }}</time>
                    <span class="status status-pill" [ngClass]="item.status === 'No leída' ? 'review' : 'ok'">{{ item.status }}</span>
                    <div class="row-actions">
                      <button class="more-button" type="button" (click)="toggleRowMenu(item.title)" [attr.aria-expanded]="openRowMenu === item.title" aria-label="Abrir opciones">•••</button>
                      @if (openRowMenu === item.title) {
                        <div class="row-menu">
                          <button type="button" (click)="rowAction(item.status === 'No leída' ? 'Marcar como leída' : 'Marcar como no leída', item.title)">{{ item.status === 'No leída' ? 'Marcar como leída' : 'Marcar como no leída' }}</button>
                          <button type="button" (click)="rowAction('Ver detalle', item.title)">Ver detalle</button>
                          <button type="button" class="danger-action" (click)="rowAction('Eliminar', item.title)">Eliminar</button>
                        </div>
                      }
                    </div>
                  </div>
                </article>
              }
            </div>
          } @else if ((isRolesView || isPermissionsView) && visibleItems().length) {
            <div class="list">
              @for (item of visibleItems(); track item.title) {
                <article class="doc-item-row">
                  <span class="doc-api-badge" [class.badge-perm]="isPermissionsView" [class.badge-role]="isRolesView">{{ isRolesView ? 'ROLE' : 'PERM' }}</span>
                  <div class="doc-item-main">
                    <h3>{{ item.title }}</h3>
                    <p>{{ item.meta }}</p>
                  </div>
                  <div class="doc-item-right">
                    <time>{{ item.date }}</time>
                    <span class="status status-pill" [class.ok]="item.status === 'Activo'" [class.muted]="item.status !== 'Activo'">{{ item.status }}</span>
                    <div class="row-actions row-action-buttons">
                      <button type="button" class="row-action-btn" (click)="editRole(item.title)">Editar</button>
                      <button type="button" class="row-action-btn" [class.warn]="item.status === 'Activo'" [class.ok]="item.status !== 'Activo'" (click)="toggleRoleStatus(roleByName(item.title))">{{ item.status === 'Activo' ? '⏸ Desactivar' : '▶ Activar' }}</button>
                      <button type="button" class="row-action-btn danger" (click)="deleteRole(item.title)" aria-label="Eliminar rol" title="Eliminar rol">Eliminar</button>
                    </div>
                  </div>
                </article>
              }
            </div>
          } @else {
            <div class="module-empty-state">
              <span class="module-empty-icon">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="9" y1="13" x2="15" y2="13"/>
                  <line x1="9" y1="17" x2="13" y2="17"/>
                </svg>
              </span>
              <strong>No hay resultados con estos filtros</strong>
              <p>Prueba una combinación diferente de búsqueda o filtros.</p>
            </div>
          }

          <div class="module-table-footer">
            <div class="module-table-footer-left">
              <span>{{ paginationSummary() }} resultados</span>
              <label>Por página
                <select class="page-size-select" [value]="pageSize()" (change)="onPageSizeChange($event)">
                  <option [value]="5">5</option>
                  <option [value]="10">10</option>
                  <option [value]="25">25</option>
                  <option [value]="50">50</option>
                </select>
              </label>
            </div>

            <div class="module-table-footer-right">
              <span>Página {{ page() }} de {{ totalPages() }}</span>
              <button type="button" class="page-arrow-btn" [disabled]="page() <= 1" (click)="prevPage()" aria-label="Página anterior">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <button type="button" class="page-arrow-btn" [disabled]="page() >= totalPages()" (click)="nextPage()" aria-label="Página siguiente">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        </section>
        }

        <footer class="module-bottom-info">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Las operaciones disponibles dependen de la API y los permisos de la sesión autenticada.</span>
        </footer>
      } @else if (!isScanPage && !isOcrFlow) {
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
                  <button type="button" (click)="handleExpedientAction('Importar expedientes')"><b>⇧</b><span><strong>Importar expedientes</strong><small>Preparar una carga masiva</small></span></button>
                  <button type="button" (click)="handleExpedientAction('Iniciar workflow')"><b>↗</b><span><strong>Iniciar workflow</strong><small>Asocia un proceso al expediente activo</small></span></button>
                </div>
              }
            </div>
          } @else {
            <button type="button" class="module-action" (click)="isUploadPage ? triggerFilePicker() : actionMessage = copy.action + ' preparado'"><span>{{ actionIcon }}</span>{{ copy.action }}</button>
          }
        </header>
      }

      @if (!isHome && !isTasksView && !isActivityView && !isRolesView && !isPermissionsView && !isNotificationsView && !isScanPage && !isOcrFlow) {
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
        <!-- HERO BANNER DIGITALIZACIÓN -->
        <section class="module-hero-banner">
          <div class="module-hero-left">
            <span class="module-hero-badge">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="3" ry="3"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </span>
            <div class="module-hero-text">
              <p class="eyebrow">DIGITALIZACIÓN <span>·</span> VISIÓN MULTIMODAL</p>
              <h1>Escanear y Digitalizar Documentos</h1>
              <p>Ingesta de informes clínicos, laboratorios y recetas físicas mediante motor IA multimodal (Gemini).</p>
            </div>
          </div>
          <div class="module-hero-right">
            @if (ocrStats()?.engineConfigured === true) {
              <span class="ocr-engine ocr-engine-on"><i></i> Motor OCR Activo</span>
            } @else if (ocrStats()?.engineConfigured === false) {
              <span class="ocr-engine ocr-engine-off" title="Falta configurar GEMINI_API_KEY en el servidor"><i></i> Motor OCR sin configurar</span>
            } @else {
              <span class="ocr-engine ocr-engine-unknown"><i></i> Verificando motor OCR...</span>
            }
          </div>
        </section>

        <!-- KPI STATS CARDS ROW (3 Cards) -->
        <div class="kpi-stats-grid">
          <article class="kpi-stat-card">
            <div class="kpi-stat-main">
              <span class="kpi-icon-wrap mint">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </span>
              <div class="kpi-stat-info">
                <small>{{ statCards()[0].label }}</small>
                <strong>{{ statCards()[0].value }}</strong>
                <p>{{ statCards()[0].detail }}</p>
              </div>
            </div>
          </article>

          <article class="kpi-stat-card">
            <div class="kpi-stat-main">
              <span class="kpi-icon-wrap amber">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </span>
              <div class="kpi-stat-info">
                <small>{{ statCards()[1].label }}</small>
                <strong>{{ statCards()[1].value }}</strong>
                <p>{{ statCards()[1].detail }}</p>
                @if (statCards()[1].note) { <p class="kpi-note">{{ statCards()[1].note }}</p> }
              </div>
            </div>
          </article>

          <article class="kpi-stat-card">
            <div class="kpi-stat-main">
              <span class="kpi-icon-wrap green">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </span>
              <div class="kpi-stat-info">
                <small>{{ statCards()[2].label }}</small>
                <strong>{{ statCards()[2].value }}</strong>
                <p>{{ statCards()[2].detail }}</p>
              </div>
            </div>
          </article>
        </div>

        <section class="module-main-card">
          <div class="module-card-header">
            <h2>Selecciona el origen del documento</h2>
            <p>Sube una foto o escaneo clínico para extraer metadatos, paciente y resultados en segundos.</p>
          </div>
          <div class="scan-source-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
            <article class="scan-source" style="background: #f8fbfa; border: 2px dashed #bfeae5; border-radius: 14px; padding: 24px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; transition: all 0.2s ease;">
              <span class="scan-source-icon" style="background: var(--mint); color: var(--teal); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </span>
              <h3 style="font-size: 15px; margin: 0; color: #102d2a; font-weight: 700;">Subir archivo o escaneo</h3>
              <p style="font-size: 12px; color: #557774; margin: 0; line-height: 1.4;">Selecciona un informe en PDF, PNG o JPG desde tu computadora.</p>
              <input #uploadInput type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" (change)="onFileSelected($event, 'Carga de archivo local')" style="display: none;" />
              <button type="button" class="btn-primary-action" style="margin-top: 8px; width: 100%; border-radius: 8px; font-weight: 700; padding: 10px; justify-content: center;" (click)="uploadInput.click()">Elegir archivo</button>
            </article>

            <article class="scan-source" style="background: #f8fbfa; border: 2px dashed #bfeae5; border-radius: 14px; padding: 24px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; transition: all 0.2s ease;">
              <span class="scan-source-icon" style="background: #fef3c7; color: #d97706; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </span>
              <h3 style="font-size: 15px; margin: 0; color: #102d2a; font-weight: 700;">Tomar foto con cámara</h3>
              <p style="font-size: 12px; color: #557774; margin: 0; line-height: 1.4;">Usa la cámara web o del dispositivo móvil para capturar el papel.</p>
              <input #cameraInput type="file" accept="image/*" capture="environment" (change)="onFileSelected($event, 'Cámara del dispositivo')" style="display: none;" />
              <button type="button" class="btn-secondary-action" style="margin-top: 8px; width: 100%; border-radius: 8px; font-weight: 700; padding: 10px; justify-content: center;" (click)="openCamera()">Abrir cámara</button>
            </article>
          </div>

          @if (selectedFileName !== 'Ningún archivo seleccionado') {
            <div class="scan-selection" role="status" style="margin-top: 20px;">
              <span style="font-size: 20px;">✓</span>
              <div>
                <strong>{{ selectedFileName }}</strong>
                <small>Origen: {{ selectedSource }} · Listo para análisis de IA</small>
              </div>
              <button type="button" class="btn-primary-action" style="margin-left: auto; padding: 10px 18px;" (click)="startOcr()">
                <span>⚡ Iniciar procesamiento OCR</span>
              </button>
            </div>
          }

          @if (cameraOpen()) {
            <div class="cam-overlay" role="dialog" aria-modal="true" aria-label="Capturar documento con la cámara">
              <div class="cam-sheet">
                <div class="cam-header">
                  <strong>Capturar documento</strong>
                  <button type="button" class="cam-close" (click)="closeCamera()" aria-label="Cerrar cámara">✕</button>
                </div>
                <div class="cam-stage">
                  <video #cameraVideo class="cam-video" autoplay playsinline muted></video>
                  @if (cameraStarting()) {
                    <div class="cam-status"><span class="ocr-spinner" aria-hidden="true"></span><span>Iniciando cámara...</span></div>
                  }
                  @if (cameraError()) {
                    <div class="cam-status cam-status-error" role="alert">
                      <span>{{ cameraError() }}</span>
                      <button type="button" class="btn-primary-action" (click)="useFilePickerInstead()">Usar selector de archivos</button>
                    </div>
                  }
                </div>
                <div class="cam-actions">
                  <button type="button" class="btn-secondary-action" (click)="closeCamera()">Cancelar</button>
                  <button type="button" class="btn-secondary-action" (click)="switchCamera()" [disabled]="cameraStarting() || !!cameraError()">Cambiar cámara</button>
                  <button type="button" class="btn-primary-action" (click)="capturePhoto()" [disabled]="!cameraReady()">📸 Capturar</button>
                </div>
              </div>
            </div>
          }
        </section>

        <section class="module-main-card ocr-recent">
          <div class="module-card-header">
            <h2>Digitalizaciones recientes</h2>
            <p>Retoma una digitalización donde quedó o revisa su resultado.</p>
          </div>
          @if (recentJobs().length === 0) {
            <p class="ocr-recent-empty">Aún no hay digitalizaciones. Sube un documento para empezar.</p>
          } @else {
            <ul class="ocr-recent-list">
              @for (job of recentJobs(); track job.id) {
                <li>
                  <div class="ocr-recent-main">
                    <strong>{{ job.originalFilename || 'Documento' }}</strong>
                    <small>{{ job.createdAt | date:'dd/MM/yyyy HH:mm' }}@if (job.confidence !== null) { · confianza {{ job.confidence * 100 | number:'1.0-0' }}% }@if (job.processingMs !== null) { · {{ job.processingMs / 1000 | number:'1.1-1' }} s }</small>
                    @if (job.errorMessage && (job.status === 'FAILED' || job.status === 'REJECTED')) { <small class="ocr-recent-reason">{{ job.errorMessage }}</small> }
                  </div>
                  <span class="ocr-status" [attr.data-status]="job.status">{{ statusText(job.status) }}</span>
                  @if (resumeRoute(job.status)) {
                    <button type="button" class="btn-secondary-action" (click)="openRecent(job)">Abrir</button>
                  }
                </li>
              }
            </ul>
          }
        </section>

        <footer class="module-bottom-info" style="margin-top: 22px;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Las operaciones disponibles dependen de la API y los permisos de la sesión autenticada.</span>
        </footer>
      } @else if (isOcrFlow) {
        <!-- HERO BANNER OCR FLOW -->
        <section class="module-hero-banner">
          <div class="module-hero-left">
            <span class="module-hero-badge">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </span>
            <div class="module-hero-text">
              <p class="eyebrow">DIGITALIZACIÓN <span>·</span> PROCESAMIENTO OCR</p>
              <h1>Validación y Extracción Clínica</h1>
              <p>Revisa el texto extraído, la confianza del modelo y los parámetros analíticos antes de indexar.</p>
            </div>
          </div>
          <div class="module-hero-right">
            <a routerLink="/digitization" class="btn-secondary-action">
              <span>← Digitalizar otro</span>
            </a>
          </div>
        </section>
        <section class="ocr-workspace">
          <nav class="step-tabs" aria-label="Pasos del procesamiento OCR" style="background: #ffffff; border: 1px solid var(--line); border-radius: 14px; padding: 6px; display: flex; gap: 6px; box-shadow: 0 2px 8px rgba(10,50,48,0.02); margin-bottom: 20px;">
            @for (tab of ocrTabs; track tab.href) {
              <a [routerLink]="tab.href" [class.active]="routeInfo.href === tab.href" [attr.aria-current]="routeInfo.href === tab.href ? 'step' : null" style="display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 10px; font-size: 12px; font-weight: 700; text-decoration: none;">
                <span style="width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800;">{{ tab.label === 'Validación y extracción' ? '1' : tab.label === 'Indexación' ? '2' : '3' }}</span>
                {{ tab.label }}
              </a>
            }
          </nav>

          <div class="ocr-grid">
            <!-- DOCUMENTO ORIGEN CARD -->
            <article class="module-main-card ocr-source-card">
              <div class="module-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                <div>
                  <h2 style="font-size: 16px; font-weight: 800; color: #102d2a; margin: 0 0 3px;">Documento origen</h2>
                  <p style="font-size: 12px; color: #557774; margin: 0;">Entrada seleccionada para este proceso</p>
                </div>
                <span class="status-pill status review" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 999px;">
                  {{ statusText(ocrStatus()) }}
                </span>
              </div>

              <div class="ocr-file" style="display: flex; align-items: center; gap: 12px; background: #f8fbfa; border: 1px solid #c2ebe3; border-radius: 12px; padding: 12px 14px; margin-bottom: 16px;">
                <span class="file-icon" style="background: var(--mint); color: var(--teal); width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11px; flex-shrink: 0;">
                  {{ ocrRawFile()?.name?.endsWith('.pdf') ? 'PDF' : 'IMG' }}
                </span>
                <div style="min-width: 0; flex: 1;">
                  <strong style="display: block; font-size: 13px; color: #102d2a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ ocrRawFile()?.name || ocrData()?.originalFilename || 'Documento clínico seleccionado' }}</strong>
                  <small style="color: #648280; font-size: 11.5px;">{{ ocrRawFile() ? selectedSource : 'Digitalización guardada' }}{{ ocrFileSize() ? ' · ' + formatFileSize(ocrFileSize()!) : '' }}</small>
                </div>
              </div>

              <dl class="ocr-details" style="display: grid; gap: 10px; margin: 0 0 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf4f3;">
                  <dt style="color: #648280; font-size: 11.5px; margin: 0;">Tipo documental</dt>
                  <dd style="color: #102d2a; font-size: 12px; font-weight: 700; margin: 0;">{{ ocrData()?.documentType || (ocrLoading() ? 'Detectando...' : 'Pendiente') }}</dd>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf4f3;">
                  <dt style="color: #648280; font-size: 11.5px; margin: 0;">Confianza del modelo (autodeclarada)</dt>
                  <dd style="color: #087f7b; font-size: 12px; font-weight: 800; margin: 0;">{{ ocrData()?.confidence != null ? ((ocrData()!.confidence! * 100) | number:'1.1-1') + '%' : (ocrLoading() ? 'Calculando...' : '—') }}</dd>
                </div>
                @if (ocrData()?.patientName) {
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf4f3;">
                    <dt style="color: #648280; font-size: 11.5px; margin: 0;">Paciente</dt>
                    <dd style="color: #102d2a; font-size: 12px; font-weight: 700; margin: 0;">{{ ocrData()?.patientName }}</dd>
                  </div>
                }
                @if (ocrData()?.doctorName) {
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf4f3;">
                    <dt style="color: #648280; font-size: 11.5px; margin: 0;">Médico</dt>
                    <dd style="color: #102d2a; font-size: 12px; font-weight: 700; margin: 0;">{{ ocrData()?.doctorName }}</dd>
                  </div>
                }
                @if (ocrData()?.issueDate) {
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf4f3;">
                    <dt style="color: #648280; font-size: 11.5px; margin: 0;">Fecha del estudio</dt>
                    <dd style="color: #102d2a; font-size: 12px; font-weight: 700; margin: 0;">{{ ocrData()?.issueDate }}</dd>
                  </div>
                }
                @if (ocrData()?.modelUsed) {
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf4f3;">
                    <dt style="color: #648280; font-size: 11.5px; margin: 0;">Modelo</dt>
                    <dd style="color: #102d2a; font-size: 12px; font-weight: 700; margin: 0;">{{ ocrData()?.modelUsed }}</dd>
                  </div>
                }
                @if (ocrData()?.processingMs != null) {
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #edf4f3;">
                    <dt style="color: #648280; font-size: 11.5px; margin: 0;">Tiempo de procesamiento</dt>
                    <dd style="color: #102d2a; font-size: 12px; font-weight: 700; margin: 0;">{{ ocrData()!.processingMs! / 1000 | number:'1.1-1' }} s</dd>
                  </div>
                }
              </dl>

              <div style="background: #f8fbfa; border: 1px solid #c2ebe3; border-radius: 10px; padding: 12px 14px; margin-top: 8px;">
                <b style="color: #087f7b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 4px;">Estado del procesamiento</b>
                <span style="color: #102d2a; font-size: 12px;">{{ ocrStatusDescription }}</span>
              </div>
            </article>

            <!-- RESULTADO OCR CARD -->
            <article class="module-main-card ocr-result-card">
              <div class="module-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px;">
                <div>
                  <h2 style="font-size: 16px; font-weight: 800; color: #102d2a; margin: 0 0 3px;">Resultado OCR</h2>
                  <p style="font-size: 12px; color: #557774; margin: 0;">Texto extraído y metadatos clínicos estructurados</p>
                </div>
                <span class="status-pill status ok" style="background: #ecfdf5; color: #047857; font-weight: 700; border: 1px solid #a7f3d0; font-size: 11px; padding: 4px 10px; border-radius: 999px;">
                  {{ ocrData() ? 'Extracción completada' : (ocrLoading() ? 'Analizando...' : 'Pendiente') }}
                </span>
              </div>

              @if (ocrLoading()) {
                <div class="ocr-loading" role="status" aria-live="polite">
                  <span class="ocr-spinner" aria-hidden="true"></span>
                  <div class="ocr-loading-text">
                    <strong>{{ ocrLoadingMessage() }}</strong>
                    <small>Tiempo transcurrido: {{ ocrElapsed() }} s · No cierres esta pantalla</small>
                    <span class="ocr-progress" aria-hidden="true"><i></i></span>
                  </div>
                </div>
              }
              @if (ocrError(); as ocrErrorMessage) {
                <div class="ocr-error" role="alert">
                  <strong>{{ ocrStatus() === 'ERROR' ? 'No se pudo procesar el documento' : 'No se pudo completar la acción' }}</strong>
                  <p>{{ ocrErrorMessage }}</p>
                  @if (ocrStatus() === 'ERROR') {
                    <div class="ocr-error-actions">
                      <button type="button" class="btn-primary-action" (click)="startOcr()">Reintentar</button>
                      <a routerLink="/digitization" class="btn-secondary-action">Elegir otro documento</a>
                    </div>
                  }
                </div>
              }
              @if (!ocrData() && !ocrLoading() && !ocrError()) {
                <div class="ocr-empty" role="status">
                  <strong>No hay una digitalización abierta</strong>
                  <p>Sube un documento o abre una de las digitalizaciones recientes para continuar.</p>
                  <a routerLink="/digitization" class="btn-primary-action">Ir a Digitalizar</a>
                </div>
              }

              <!-- RESUMEN DETECTADO -->
              <div style="background: #f8fbfa; border: 1px solid #e2ece9; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;">
                <span style="color: var(--teal); font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; display: block; margin-bottom: 6px;">Resumen Clínico Detectado</span>
                <p style="color: #102d2a; font-size: 13px; line-height: 1.6; margin: 0;">
                  {{ ocrData()?.extractedSummary || (ocrLoading() ? 'Analizando resumen y diagnóstico preliminar con IA...' : 'El resumen aparecerá cuando el servicio OCR complete la lectura del documento.') }}
                </p>
              </div>

              <!-- VALORES CLÍNICOS ESTRUCTURADOS -->
              @if (ocrData()?.structuredFields?.length) {
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px;">
                  <span style="color: #166534; font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; display: block; margin-bottom: 10px;">Valores Clínicos / Parámetros Extraídos</span>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                    @for (field of ocrData()!.structuredFields; track field.key) {
                      <div style="padding: 8px 12px; background: #fff; border-radius: 8px; border: 1px solid #dcfce7; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                          <span style="color: #64748b; display: block; font-size: 11px; font-weight: 600;">{{ field.key }}</span>
                          <strong style="color: #0f172a; font-size: 13px;">{{ field.value }}</strong>
                        </div>
                        @if (field.status && field.status !== 'NORMAL' && field.status !== 'N/A') {
                          <span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px;">[{{ field.status }}]</span>
                        } @else if (field.status === 'NORMAL') {
                          <span style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 6px;">[NORMAL]</span>
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- TEXTO COMPLETO -->
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; margin-bottom: 20px;">
                <span style="color: #64748b; font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; display: block; margin-bottom: 8px;">Transcripción Completa del Documento</span>
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; max-height: 200px; overflow-y: auto;">
                  <p style="white-space: pre-wrap; font-family: monospace; font-size: 12px; line-height: 1.5; color: #334155; margin: 0;">{{ ocrData()?.fullText || (ocrLoading() ? 'Transcribiendo texto íntegro...' : 'Sin documento procesado.') }}</p>
                </div>
              </div>

              <!-- ACCIONES DEL PASO -->
              @if (ocrStep === 'validation') {
                <div class="ocr-step-actions">
                  <button type="button" class="btn-secondary-action" (click)="rejectOcr()" [disabled]="!canReject() || ocrBusy()">Rechazar resultado</button>
                  <button type="button" class="btn-primary-action" (click)="validateOcr()" [disabled]="ocrStatus() !== 'REQUIRES_VALIDATION' || ocrBusy()">Confirmar extracción</button>
                </div>
                @if (ocrData() && ocrStatus() !== 'REQUIRES_VALIDATION') {
                  <p class="ocr-step-hint">Esta digitalización está en estado «{{ statusText(ocrStatus()) }}» y ya no se puede validar.</p>
                }
              } @else if (ocrStep === 'indexing') {
                <div class="ocr-step-form">
                  <label>Tipo documental *
                    <select [value]="indexTypeId()" (change)="setIndexField('typeId', $any($event.target).value)">
                      <option value="">Selecciona un tipo</option>
                      @for (type of documentTypes(); track type.id) { <option [value]="type.id">{{ type.name }}</option> }
                    </select>
                  </label>
                  <label>Nombre del documento
                    <input [value]="indexName()" [placeholder]="defaultIndexName()" (input)="setIndexField('name', $any($event.target).value)" maxlength="255" />
                  </label>
                  <label>Código
                    <input [value]="indexCode()" placeholder="Se genera automáticamente" (input)="setIndexField('code', $any($event.target).value)" maxlength="60" />
                  </label>
                  <label>Área hospitalaria
                    <select [value]="indexDepartmentId()" (change)="setIndexField('department', $any($event.target).value)">
                      <option value="">Sin área</option>
                      @for (department of departments(); track department.id) { <option [value]="department.id">{{ department.name }}</option> }
                    </select>
                  </label>
                  <button type="button" class="btn-primary-action" (click)="indexOcr()" [disabled]="ocrStatus() !== 'VALIDATED' || !indexTypeId() || ocrBusy()">Guardar e Indexar Documento</button>
                </div>
                @if (ocrData() && ocrStatus() !== 'VALIDATED') {
                  <p class="ocr-step-hint">Solo se puede indexar una digitalización validada; esta está en estado «{{ statusText(ocrStatus()) }}».</p>
                }
              } @else {
                <div class="ocr-step-form">
                  <label>Tipo documental detectado
                    <select [value]="metaValue('documentType')" (change)="setMetaField('documentType', $any($event.target).value)">
                      @for (type of ocrDocumentTypes; track type) { <option [value]="type">{{ type }}</option> }
                    </select>
                  </label>
                  <label>Paciente detectado
                    <input [value]="metaValue('patientName')" (input)="setMetaField('patientName', $any($event.target).value)" maxlength="200" />
                  </label>
                  <label>Documento del paciente
                    <input [value]="metaValue('patientDocumentNumber')" (input)="setMetaField('patientDocumentNumber', $any($event.target).value)" maxlength="60" />
                  </label>
                  <label>Médico
                    <input [value]="metaValue('doctorName')" (input)="setMetaField('doctorName', $any($event.target).value)" maxlength="200" />
                  </label>
                  <label>Fecha del estudio
                    <input type="date" [value]="metaValue('issueDate')" (input)="setMetaField('issueDate', $any($event.target).value)" />
                  </label>
                  <button type="button" class="btn-primary-action" (click)="correctMetadata()" [disabled]="!canCorrectMetadata() || ocrBusy()">Confirmar metadatos finales</button>
                </div>
                @if (ocrData()?.documentId) {
                  <p class="ocr-step-hint ocr-step-ok">Documento registrado en el repositorio con el archivo original como versión 1. <a routerLink="/documents">Ver en Documentos</a></p>
                } @else if (ocrData() && ocrStatus() !== 'INDEXED' && ocrStatus() !== 'VALIDATED') {
                  <p class="ocr-step-hint">Esta digitalización está en estado «{{ statusText(ocrStatus()) }}»; los metadatos solo se corrigen tras validarla.</p>
                }
              }
            </article>
          </div>
        </section>

        <footer class="module-bottom-info" style="margin-top: 22px;">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Las operaciones disponibles dependen de la API y los permisos de la sesión autenticada.</span>
        </footer>
      } @else if (isFormPage) {
        <div class="content-grid">
          <form class="panel form-panel" (submit)="$event.preventDefault(); actionMessage = 'Borrador guardado localmente'">
            <div class="form-title"><h2>{{ routeInfo.subcategory }}</h2><span class="required-note">* Campos obligatorios</span></div>
            <div class="form-fields">
              <label>Nombre <input placeholder="Ej. Contrato marco proveedores" /></label>
              <label>Responsable <input placeholder="Nombre del responsable" /></label>
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
      } @else if (!isHome && !isTasksView && !isActivityView && !isRolesView && !isPermissionsView && !isNotificationsView) {
        <section class="panel list-panel">
          @if (isDocumentsHub) {
            <nav class="internal-tabs" aria-label="Vistas de documentos">
              @for (tab of documentTabs; track tab.href) {
                <a [routerLink]="tab.href" [class.active]="routeInfo.href === tab.href">{{ tab.label }}</a>
              }
            </nav>
          }
          <div class="panel-title"><div><h2>{{ listTitle }}</h2><p>Datos del tenant autenticado.</p></div>
            <div class="export-dropdown-wrapper">
              <button type="button" class="panel-action" (click)="toggleExportMenu($event)" [attr.aria-expanded]="exportMenuOpen()">↓ Exportar ⌄</button>
              @if (exportMenuOpen()) {
                <div class="export-dropdown-backdrop" (click)="closeExportMenu()"></div>
                <div class="export-dropdown-popover">
                  <button type="button" (click)="exportAs('Excel')">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>
                    <div><strong>Exportar a Excel</strong><small>Descargar tabla en formato .csv para Excel</small></div>
                  </button>
                  <button type="button" (click)="exportAs('PDF')">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    <div><strong>Exportar a PDF</strong><small>Vista de impresión y guardado PDF</small></div>
                  </button>
                  <button type="button" (click)="exportAs('JSON')">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                    <div><strong>Exportar a JSON</strong><small>Descargar archivo de datos .json</small></div>
                  </button>
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
      @if (!isTasksView && !isActivityView && !isRolesView && !isPermissionsView && !isNotificationsView && !isScanPage && !isOcrFlow) {
        <footer class="demo-note"><span>ⓘ</span> Las operaciones disponibles dependen de la API y los permisos de la sesión autenticada.</footer>
      }
      @if (roleFormOpen()) { <app-role-form-modal [role]="editingRole()" (closed)="closeRoleForm()" (saved)="loadRoles(); actionMessage = editingRole() ? 'Rol actualizado correctamente' : 'Rol creado correctamente'" /> }
      <app-role-permissions-modal [roleId]="rolePermissionsId()" (closed)="rolePermissionsId.set(null)" (saved)="loadRoles()" />
    </section>
  `,
})
export class WorkspacePage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly documentApi = inject(DocumentApiService);
  private readonly workspaceApi = inject(WorkspaceApiService);
  private readonly adminApi = inject(AdministrationApiService);
  private readonly workflowApi = inject(WorkflowApi);
  private readonly ocrApi = inject(OcrApiService);
  readonly workflowSummary = signal<any>(null);
  get ocrRawFile() { return this.ocrApi.rawFile; }
  get ocrLoading() { return this.ocrApi.ocrLoading; }
  get ocrData() { return this.ocrApi.ocrData; }
  get ocrStatus() { return this.ocrApi.ocrStatus; }
  get ocrError() { return this.ocrApi.ocrError; }
  get ocrBusy() { return this.ocrApi.ocrBusy; }
  get ocrStats() { return this.ocrApi.stats; }
  get recentJobs() { return this.ocrApi.recentJobs; }
  readonly statCards = computed(() => buildStatCards(this.ocrApi.stats(), this.ocrApi.statsState()));
  readonly ocrDocumentTypes = ['LABORATORIO', 'RECETA', 'CONSENTIMIENTO', 'INFORME_MEDICO', 'OTRO'];
  readonly documentTypes = signal<ApiDocumentType[]>([]);
  readonly departments = signal<ApiDepartment[]>([]);
  private readonly indexEdits = signal({ typeId: '', name: '', code: '', department: '' });
  readonly indexTypeId = computed(() => this.indexEdits().typeId);
  readonly indexName = computed(() => this.indexEdits().name);
  readonly indexCode = computed(() => this.indexEdits().code);
  readonly indexDepartmentId = computed(() => this.indexEdits().department);
  private readonly metaEdits = signal<Partial<OcrMetadataFields>>({});
  get ocrElapsed() { return this.ocrApi.ocrElapsed; }
  readonly ocrLoadingMessage = computed(() => {
    const seconds = this.ocrElapsed();
    if (seconds < 4) return 'Subiendo documento...';
    if (seconds < 12) return 'Analizando con visión multimodal...';
    if (seconds < 25) return 'Extrayendo campos clínicos...';
    return 'Esto está tardando más de lo normal, sigue en curso...';
  });

  readonly cameraOpen = signal(false);
  readonly cameraStarting = signal(false);
  readonly cameraError = signal('');
  readonly cameraReady = signal(false);
  private cameraFacing: CameraFacing = 'environment';
  private cameraRequest = 0;
  private cameraStream: MediaStream | null = null;
  private cameraVideoEl: HTMLVideoElement | null = null;
  @ViewChild('cameraVideo') set cameraVideoRef(ref: ElementRef<HTMLVideoElement> | undefined) {
    this.cameraVideoEl = ref?.nativeElement ?? null;
    this.attachCameraStream();
  }
  @ViewChild('cameraInput') private cameraInput?: ElementRef<HTMLInputElement>;
  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;
  private readonly routeData = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data,
  });

  get routeInfo(): RouteInfo {
    return (this.routeData()?.['routeInfo'] as RouteInfo) ?? (this.route.snapshot.data['routeInfo'] as RouteInfo);
  }

  get copy() {
    return screenCopy(this.routeInfo);
  }

  readonly roles = signal<ApiRole[]>([]);
  readonly roleFormOpen = signal(false);
  readonly editingRole = signal<ApiRole | null>(null);
  readonly rolePermissionsId = signal<number | null>(null);
  readonly filtroEstado = signal<'' | 'ACTIVE' | 'INACTIVE'>('');
  readonly filtroTipo = signal<'' | 'SYSTEM' | 'CUSTOM'>('');
  readonly rolesFiltrados = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    return this.roles().filter((r) =>
      (!this.filtroEstado() || (r.active !== false) === (this.filtroEstado() === 'ACTIVE'))
      && (!this.filtroTipo() || r.system === (this.filtroTipo() === 'SYSTEM'))
      && (!query || `${r.name} ${r.description ?? ''}`.toLowerCase().includes(query)));
  });
  readonly userAssignments = computed(() => this.roles().reduce((sum, r) => sum + (r.userCount || 0), 0));
  readonly activeRolesCount = computed(() => this.roles().filter((r) => r.active !== false).length);
  readonly systemRoles = computed(() => this.roles().filter((r) => r.system).length);

  loadRoles(): void {
    this.adminApi.roles(true).subscribe({
      next: (list) => this.roles.set(list),
      error: () => (this.actionMessage = 'No se pudieron cargar los roles'),
    });
  }

  openRolePermissions(name: string): void {
    this.openRowMenu = '';
    this.rolePermissionsId.set(this.roles().find((r) => r.name === name)?.id ?? null);
  }

  roleByName(name: string): ApiRole | undefined {
    return this.roles().find((r) => r.name === name);
  }

  editRole(name: string): void {
    this.editingRole.set(this.roleByName(name) ?? null);
    this.roleFormOpen.set(true);
  }

  closeRoleForm(): void {
    this.roleFormOpen.set(false);
    this.editingRole.set(null);
  }

  toggleRoleStatus(role: ApiRole | undefined): void {
    if (!role) return;
    const activate = role.active === false;
    this.adminApi.setRoleStatus(role.id, activate).subscribe({
      next: (updated) => {
        this.roles.update((list) => list.map((r) => (r.id === updated.id ? updated : r)));
        this.actionMessage = activate ? 'Rol activado' : 'Rol desactivado';
      },
      error: (err) => (this.actionMessage = err?.error?.message ?? 'No se pudo cambiar el estado del rol'),
    });
  }

  deleteRole(name: string): void {
    const role = this.roleByName(name);
    if (!role || !confirm(`¿Estás seguro de eliminar el rol "${role.name}"? Esta acción no se puede deshacer.`)) return;
    this.adminApi.deleteRole(role.id).subscribe({
      next: () => { this.actionMessage = 'Rol eliminado correctamente'; this.loadRoles(); },
      error: (err) => (this.actionMessage = err?.error?.message ?? 'No se pudo eliminar el rol'),
    });
  }

  readonly permissions = signal<ApiPermission[]>([]);
  readonly criticalCount = computed(() => this.permissions().filter((p) => p.criticality === 'HIGH').length);
  readonly totalModulos = computed(() => new Set(this.permissions().map((p) => p.module)).size);

  readonly items = computed<DemoItem[]>(() => {
    const info = this.routeInfo;
    if (this.isRolesView) {
      return this.rolesFiltrados().map((r) => ({
        title: r.name,
        meta: r.description ?? '',
        date: `${r.userCount ?? 0} usuarios · ${r.permissionCount ?? 0} permisos · ${r.system ? 'Sistema' : 'Personalizado'}`,
        status: r.active !== false ? 'Activo' : 'Inactivo',
        type: r.system ? 'SYSTEM' : 'CUSTOM',
      }));
    }
    return demoList(info?.module || '', info?.subcategory || '');
  });

  readonly tasks = signal<ApiTask[]>([]);
  readonly activities = signal<ApiActivity[]>([]);
  readonly recentDocuments = signal<ApiDocument[]>([]);
  readonly dataError = signal('');

  get isHome() { return this.routeInfo.href === '/'; }
  get isTasksView() { return this.routeInfo.href === '/dashboard/tasks' || this.routeInfo.subcategory === 'Mis tareas'; }
  get isActivityView() { return this.routeInfo.href === '/dashboard/activity' || this.routeInfo.subcategory === 'Actividad reciente'; }
  get isRolesView() { return this.routeInfo.href === '/users/roles' || this.routeInfo.subcategory === 'Roles'; }
  get isPermissionsView() { return this.routeInfo.href === '/users/permissions' || this.routeInfo.subcategory === 'Permisos'; }
  get isNotificationsView() { return this.routeInfo.module === 'Notificaciones' || this.routeInfo.href.startsWith('/notifications'); }
  get isFormPage() { return ['Crear', 'Nuevo', 'Subir'].some((word) => this.routeInfo.subcategory.includes(word)); }
  get isUploadPage() { return this.routeInfo.subcategory.includes('Subir'); }
  get isExpedientsModule() { return this.routeInfo.module === 'Expedientes'; }
  get isExpedientList() { return this.isExpedientsModule && !this.isFormPage; }
  get isDocumentsHub() { return this.routeInfo.module === 'Documentos' && !this.isFormPage; }
  get isScanPage() { return this.routeInfo.href === '/digitization'; }
  get isOcrFlow() { return ['/digitization/ocr', '/digitization/validation', '/digitization/indexing', '/digitization/metadata'].includes(this.routeInfo.href); }
  get ocrStep() { return this.routeInfo.href === '/digitization/indexing' ? 'indexing' : this.routeInfo.href === '/digitization/metadata' ? 'metadata' : 'validation'; }

  readonly activeFilter = signal<string>('estado');
  readonly documentTabs: TabLink[] = [
    { label: 'Todos', href: '/documents' }, { label: 'Recientes', href: '/documents/recent' }, { label: 'Pendientes', href: '/documents/pending' },
    { label: 'En revisión', href: '/documents/in-review' }, { label: 'Aprobados', href: '/documents/approved' }, { label: 'Archivados', href: '/documents/archived' }, { label: 'Papelera', href: '/documents/trash' },
  ];
  readonly notificationTabs: TabLink[] = [
    { label: 'Todas', href: '/notifications' },
    { label: 'No leídas', href: '/notifications/unread' },
    { label: 'Tareas', href: '/notifications/tasks' },
    { label: 'Aprobaciones', href: '/notifications/approvals' },
    { label: 'Menciones', href: '/notifications/mentions' },
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
  private readonly actionMessageState = signal('');
  private actionMessageTimer: ReturnType<typeof setTimeout> | null = null;

  // Todo mensaje asignado (roles creados/editados/eliminados, exportaciones, etc.)
  // se limpia solo a los 3 segundos.
  get actionMessage(): string { return this.actionMessageState(); }
  set actionMessage(value: string) {
    if (this.actionMessageTimer) clearTimeout(this.actionMessageTimer);
    this.actionMessageState.set(value);
    this.actionMessageTimer = value
      ? setTimeout(() => { this.actionMessageState.set(''); this.actionMessageTimer = null; }, 3000)
      : null;
  }
  actionMenuOpen = false;
  openRowMenu = '';
  readonly exportMenuOpen = signal(false);
  get stats(): PageStat[] { return this.buildStats(this.routeInfo.module); }
  readonly todayLabel = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' }).format(new Date());
  readonly displayName = computed(() => {
    const user = this.auth.user();
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'Usuario';
  });
  readonly highPriorityTasks = computed(() => this.tasks().filter((task) => {
    const p = String(task.priority ?? '').toLowerCase();
    return p === 'high' || p === 'alta' || task.priority === 1;
  }).length);

  constructor() {
    if (this.isHome || this.isTasksView || this.isActivityView) {
      this.loadDashboard();
    }
    if(this.isHome)this.workflowApi.get('/summary').subscribe({next:summary=>this.workflowSummary.set(summary),error:()=>this.workflowSummary.set(null)});
    this.route.data.subscribe(() => {
      this.page.set(1);
      this.searchTerm.set('');
      this.openRowMenu = '';
      this.exportMenuOpen.set(false);
      if (this.isScanPage) {
        this.ocrApi.loadStats();
        this.ocrApi.loadRecent();
      }
      if (this.isOcrFlow && this.ocrStep === 'indexing') this.loadIndexOptions();
      if (this.isRolesView) this.loadRoles();
      if (this.isPermissionsView) this.adminApi.permissions().subscribe({ next: (list) => this.permissions.set(list), error: () => (this.actionMessage = 'No se pudo cargar el catálogo de permisos') });
      if (this.isHome || this.isTasksView || this.isActivityView) {
        this.loadDashboard();
      }
      if(this.isHome)this.workflowApi.get('/summary').subscribe({next:summary=>this.workflowSummary.set(summary),error:()=>this.workflowSummary.set(null)});
    });
  }

  toggleActiveFilter(filter: string): void {
    this.activeFilter.update((current) => current === filter ? '' : filter);
    this.actionMessage = `Filtro por ${filter} seleccionado`;
  }

  getNotifBadgeClass(type: string): string {
    const t = (type || '').toUpperCase();
    if (t === 'APR') return 'badge-apr';
    if (t === 'TSK') return 'badge-tsk';
    if (t === 'DOC') return 'badge-doc';
    if (t === 'MEN') return 'badge-men';
    return 'badge-sis';
  }

  markAllNotificationsRead(): void {
    this.actionMessage = 'Todas las notificaciones han sido marcadas como leídas';
  }

  handleHeaderAction(): void {
    if (this.isNotificationsView) {
      this.markAllNotificationsRead();
    } else if (this.isRolesView) {
      this.editingRole.set(null);
      this.roleFormOpen.set(true);
    } else if (this.isPermissionsView) {
      this.rowAction('Crear permiso', 'Formulario de permiso');
    } else {
      this.rowAction('Nueva acción', 'Acción');
    }
  }

  readonly filteredItems = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const status = this.expedientStatus();
    const area = this.expedientArea();
    const from = this.dateFrom();
    const to = this.dateTo();
    return this.items().filter((item) => {
      const matchesQuery = !query || `${item.title} ${item.meta} ${item.date}`.toLowerCase().includes(query);
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

  readonly totalPages = computed(() => {
    const total = this.isTasksView
      ? this.tasks().length
      : this.isActivityView
        ? this.activities().length
        : this.filteredItems().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  readonly paginationSummary = computed(() => {
    const total = this.isTasksView
      ? this.tasks().length
      : this.isActivityView
        ? this.activities().length
        : this.filteredItems().length;
    if (!total) return '0-0 de 0';
    const start = (this.page() - 1) * this.pageSize() + 1;
    const end = Math.min(this.page() * this.pageSize(), total);
    return `${start}-${end} de ${total}`;
  });

  prevPage(): void {
    if (this.page() > 1) this.page.update((p) => p - 1);
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) this.page.update((p) => p + 1);
  }

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
    const status = this.ocrStatus();
    if (status === 'INDEXED') return 'Resultado indexado y listo para consulta.';
    if (status === 'VALIDATED') return 'Extracción confirmada por revisión humana.';
    if (status === 'ERROR') return 'El procesamiento falló; reintenta o elige otro documento.';
    if (status === 'IDLE') return 'Sin documento procesado todavía.';
    if (status === 'PROCESSING') return 'Procesando el documento con visión multimodal...';
    return 'Requiere validación humana antes de indexar.';
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
    if (!this.acceptFile(file, source)) input.value = '';
  }

  private acceptFile(file: File, source: string): boolean {
    if (file.size > 25 * 1024 * 1024) {
      this.actionMessage = 'El archivo supera el límite de 25 MB';
      return false;
    }
    this.ocrApi.setFile(file, source);
    this.selectedFileName = `${file.name} (${this.formatFileSize(file.size)})`;
    this.selectedSource = source;
    this.actionMessage = 'Archivo listo para procesamiento multimodal';
    return true;
  }

  /** Live webcam viewer; without camera API (e.g. plain http) falls back to the native picker/camera app. */
  async openCamera(): Promise<void> {
    if (!isCameraSupported(navigator)) {
      this.cameraInput?.nativeElement.click();
      return;
    }
    this.cameraError.set('');
    this.cameraReady.set(false);
    this.cameraOpen.set(true);
    await this.startCameraStream();
  }

  private async startCameraStream(): Promise<void> {
    const request = ++this.cameraRequest;
    stopStream(this.cameraStream);
    this.cameraStream = null;
    this.cameraReady.set(false);
    this.cameraError.set('');
    this.cameraStarting.set(true);
    try {
      const stream = await openCameraStream(navigator, this.cameraFacing);
      // The viewer may have been closed, reopened or destroyed while the permission prompt was pending.
      if (request !== this.cameraRequest || !this.cameraOpen()) {
        stopStream(stream);
        return;
      }
      this.cameraStream = stream;
      this.attachCameraStream();
    } catch (error) {
      if (request === this.cameraRequest) this.cameraError.set(cameraFailureMessage(classifyCameraError(error)));
    } finally {
      if (request === this.cameraRequest) this.cameraStarting.set(false);
    }
  }

  private attachCameraStream(): void {
    if (!this.cameraVideoEl || !this.cameraStream) return;
    const video = this.cameraVideoEl;
    video.srcObject = this.cameraStream;
    video.onloadedmetadata = () => this.cameraReady.set(true);
    void video.play().catch(() => undefined);
  }

  async switchCamera(): Promise<void> {
    this.cameraFacing = this.cameraFacing === 'environment' ? 'user' : 'environment';
    await this.startCameraStream();
  }

  async capturePhoto(): Promise<void> {
    if (!this.cameraVideoEl) return;
    try {
      const file = await captureFrameToFile(this.cameraVideoEl, () => document.createElement('canvas'));
      if (this.acceptFile(file, 'Cámara web')) this.closeCamera();
      else this.cameraError.set(this.actionMessage);
    } catch (error) {
      this.cameraError.set((error as Error).message || 'No se pudo capturar la imagen');
    }
  }

  closeCamera(): void {
    this.cameraRequest++;
    stopStream(this.cameraStream);
    this.cameraStream = null;
    this.cameraOpen.set(false);
    this.cameraReady.set(false);
    this.cameraError.set('');
    this.cameraStarting.set(false);
  }

  useFilePickerInstead(): void {
    this.closeCamera();
    this.cameraInput?.nativeElement.click();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.cameraOpen()) this.closeCamera();
  }

  ngOnDestroy(): void {
    this.cameraRequest++;
    stopStream(this.cameraStream);
  }

  startOcr(): void {
    const file = this.ocrApi.rawFile();
    if (!file) {
      this.actionMessage = 'Selecciona o toma una foto primero';
      return;
    }
    this.actionMessage = 'Analizando documento con Gemini Multimodal...';
    void this.router.navigateByUrl('/digitization/ocr');

    this.ocrApi.processFile(file).subscribe({
      next: (job) => {
        this.indexEdits.set({ typeId: '', name: '', code: '', department: '' });
        this.metaEdits.set({});
        this.actionMessage = job.status === 'FAILED'
          ? (this.ocrError() || 'No se pudo extraer el documento')
          : 'Extracción completada con éxito por visión multimodal.';
      },
      error: () => {
        this.actionMessage = this.ocrError() || 'Error al procesar el documento con IA multimodal';
      }
    });
  }

  handleExpedientAction(action: string): void {
    this.actionMenuOpen = false;
    this.actionMessage = `${action}: operación pendiente de integración con la API`;
  }

  initials(value: string): string {
    return value.split(/[\s._-]+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'U';
  }

  formatTaskStatus(status: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'PENDING') return 'Pendiente';
    if (s === 'IN_PROGRESS') return 'En curso';
    if (s === 'IN_REVIEW') return 'En revisión';
    if (s === 'OVERDUE') return 'Vencida';
    if (s === 'COMPLETED') return 'Completada';
    if (s === 'REJECTED') return 'Rechazada';
    return status || 'Pendiente';
  }

  taskStatusClass(status: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'PENDING') return 'pending';
    if (s === 'IN_PROGRESS') return 'review';
    if (s === 'IN_REVIEW') return 'review';
    if (s === 'OVERDUE') return 'danger';
    if (s === 'COMPLETED') return 'ok';
    if (s === 'REJECTED') return 'danger';
    return 'pending';
  }

  formatActivityTitle(event: ApiActivity): string {
    const action = event.action?.toUpperCase() || '';
    const entity = event.entityType?.toUpperCase() || '';
    if (action === 'CREATE' && entity === 'DOCUMENT') return 'Documento creado';
    if (action === 'CREATE' && entity === 'TASK') return 'Tarea creada';
    if (action === 'UPDATE_STATUS' && entity === 'TASK') return 'Estado de tarea actualizado';
    if (action === 'UPDATE_STATUS' && entity === 'DOCUMENT') return 'Estado documental actualizado';
    if (action === 'UPLOAD_VERSION' || action === 'VERSION_UPLOAD') return 'Nueva versión cargada';
    if (action === 'CREATE') return 'Nuevo registro creado';
    if (action === 'UPDATE_STATUS') return 'Estado modificado';
    return `${action} · ${entity}`;
  }

  formatActivityDetail(event: ApiActivity): string {
    const entity = event.entityType?.toUpperCase() === 'DOCUMENT' ? 'Documento' : event.entityType?.toUpperCase() === 'TASK' ? 'Tarea' : (event.entityType || 'Entidad');
    const idStr = event.entityId ? ` #${String(event.entityId).slice(0, 8)}` : '';
    const userStr = event.actorName ? ` por ${event.actorName}` : (event.userId ? ` por ${event.userId}` : '');
    return `${entity}${idStr}${userStr}`;
  }

  private loadDashboard(): void {
    this.workspaceApi.dashboard(10).subscribe({
      next: (response) => {
        this.tasks.set(response.tasks || []);
        this.activities.set(response.recentActivity || []);
        if (response.recentDocuments?.length) {
          this.recentDocuments.set(
            response.recentDocuments.map((doc) => ({
              id: doc.id,
              name: doc.name,
              code: doc.code,
              status: doc.status,
              updatedAt: doc.updatedAt,
              expedientId: doc.expedientId ?? undefined,
            } as ApiDocument))
          );
        } else {
          this.recentDocuments.set([]);
        }
      },
      error: (err) => {
        console.error('Error al cargar datos del dashboard:', err);
        this.tasks.set([]);
        this.activities.set([]);
        this.recentDocuments.set([]);
        this.actionMessage = 'No se pudieron sincronizar los datos del dashboard.';
      },
    });
  }

  setSearchTerm(event: Event): void { this.searchTerm.set((event.target as HTMLInputElement).value); this.resetPage(); }
  setFiltroEstado(event: Event): void { this.filtroEstado.set((event.target as HTMLSelectElement).value as '' | 'ACTIVE' | 'INACTIVE'); this.resetPage(); }
  setFiltroTipo(event: Event): void { this.filtroTipo.set((event.target as HTMLSelectElement).value as '' | 'SYSTEM' | 'CUSTOM'); this.resetPage(); }
  setExpedientStatus(event: Event): void { this.expedientStatus.set((event.target as HTMLSelectElement).value); this.resetPage(); }
  setExpedientArea(event: Event): void { this.expedientArea.set((event.target as HTMLSelectElement).value); this.resetPage(); }
  setDateFrom(event: Event): void { this.dateFrom.set((event.target as HTMLInputElement).value); this.resetPage(); }
  setDateTo(event: Event): void { this.dateTo.set((event.target as HTMLInputElement).value); this.resetPage(); }
  resetPage(): void { this.page.set(1); }
  changePageSize(size: number): void { this.pageSize.set(size); this.page.set(1); }
  onPageSizeChange(event: Event): void { this.changePageSize(Number((event.target as HTMLSelectElement).value)); }
  changeDashboardPageSize(size: number): void { this.dashboardPageSize.set(size); this.dashboardPage.set(1); }

  toggleRowMenu(title: string): void {
    this.openRowMenu = this.openRowMenu === title ? '' : title;
    this.exportMenuOpen.set(false);
  }

  toggleExportMenu(event?: Event): void {
    if (event) event.stopPropagation();
    this.exportMenuOpen.update((open) => !open);
  }

  closeExportMenu(): void {
    this.exportMenuOpen.set(false);
  }

  rowAction(action: string, title: string): void {
    this.openRowMenu = '';
    this.actionMessage = `${action} "${title}": operación preparada para la API`;
  }

  exportAs(format: string): void {
    this.exportMenuOpen.set(false);

    if (this.isTasksView) {
      const data = this.tasks();
      if (!data || data.length === 0) {
        this.actionMessage = 'No hay tareas disponibles para exportar.';
        return;
      }
      const cols: ExportColumn[] = [
        { key: 'title', label: 'Título de la tarea' },
        { key: 'status', label: 'Estado' },
        { key: 'priority', label: 'Prioridad' },
        { key: 'area', label: 'Área' },
        { key: 'dueAt', label: 'Fecha límite' },
      ];
      const filename = `tareas-${new Date().toISOString().split('T')[0]}`;
      if (format === 'CSV' || format === 'Excel') exportToCsv(data, filename, cols);
      else if (format === 'JSON') exportToJson(data, filename);
      else if (format === 'PDF') exportToPrintView('Reporte de Mis Tareas', 'Listado de tareas asignadas en NexoDocs', data, cols);
      this.actionMessage = `Exportación de tareas a ${format} completada exitosamente.`;
    } else if (this.isActivityView) {
      const data = this.activities();
      if (!data || data.length === 0) {
        this.actionMessage = 'No hay actividad disponible para exportar.';
        return;
      }
      const cols: ExportColumn[] = [
        { key: 'action', label: 'Acción' },
        { key: 'entityType', label: 'Tipo de entidad' },
        { key: 'result', label: 'Resultado' },
        { key: 'occurredAt', label: 'Fecha y hora' },
      ];
      const filename = `actividad-${new Date().toISOString().split('T')[0]}`;
      if (format === 'CSV' || format === 'Excel') exportToCsv(data, filename, cols);
      else if (format === 'JSON') exportToJson(data, filename);
      else if (format === 'PDF') exportToPrintView('Registro de Actividad Reciente', 'Eventos y auditoría de acciones del tenant', data, cols);
      this.actionMessage = `Exportación de actividad a ${format} completada exitosamente.`;
    } else if (this.isRolesView) {
      const data = this.visibleItems().length ? this.visibleItems() : this.items();
      const cols: ExportColumn[] = [
        { key: 'title', label: 'Rol' },
        { key: 'meta', label: 'Descripción / Alcance' },
        { key: 'date', label: 'Usuarios asignados / Nivel' },
        { key: 'status', label: 'Estado' },
      ];
      const filename = `roles-${new Date().toISOString().split('T')[0]}`;
      if (format === 'CSV' || format === 'Excel') exportToCsv(data, filename, cols);
      else if (format === 'JSON') exportToJson(data, filename);
      else if (format === 'PDF') exportToPrintView('Catálogo de Roles de Usuario', 'Módulo Usuarios y Equipos · Control de Acceso RBAC · NexoDocs', data, cols);
      this.actionMessage = `Exportación de roles a ${format} completada exitosamente.`;
    } else if (this.isPermissionsView) {
      const data = this.visibleItems().length ? this.visibleItems() : this.items();
      const cols: ExportColumn[] = [
        { key: 'title', label: 'Permiso' },
        { key: 'meta', label: 'Descripción / Regla operativa' },
        { key: 'date', label: 'Módulo / Nivel de acceso' },
        { key: 'status', label: 'Estado' },
      ];
      const filename = `permisos-${new Date().toISOString().split('T')[0]}`;
      if (format === 'CSV' || format === 'Excel') exportToCsv(data, filename, cols);
      else if (format === 'JSON') exportToJson(data, filename);
      else if (format === 'PDF') exportToPrintView('Matriz de Permisos del Sistema', 'Módulo Seguridad y Control de Acceso · NexoDocs', data, cols);
      this.actionMessage = `Exportación de permisos a ${format} completada exitosamente.`;
    } else if (this.isNotificationsView) {
      const data = this.visibleItems().length ? this.visibleItems() : this.items();
      const cols: ExportColumn[] = [
        { key: 'title', label: 'Notificación / Asunto' },
        { key: 'meta', label: 'Detalle / Remitente' },
        { key: 'date', label: 'Fecha' },
        { key: 'status', label: 'Estado' },
      ];
      const filename = `notificaciones-${new Date().toISOString().split('T')[0]}`;
      if (format === 'CSV' || format === 'Excel') exportToCsv(data, filename, cols);
      else if (format === 'JSON') exportToJson(data, filename);
      else if (format === 'PDF') exportToPrintView('Bandeja de Notificaciones', 'Avisos y eventos en tiempo real del tenant · NexoDocs', data, cols);
      this.actionMessage = `Exportación de notificaciones a ${format} completada exitosamente.`;
    } else {
      let data = this.visibleItems();
      if (!data || data.length === 0) {
        data = this.items().length ? this.items() : demoList(this.routeInfo.module, this.routeInfo.subcategory);
      }
      const cols: ExportColumn[] = [
        { key: 'title', label: 'Título' },
        { key: 'meta', label: 'Información / Metadatos' },
        { key: 'date', label: 'Fecha' },
        { key: 'status', label: 'Estado' },
      ];
      const label = this.routeInfo.subcategory || this.routeInfo.module;
      const filename = `${label.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
      if (format === 'CSV' || format === 'Excel') exportToCsv(data, filename, cols);
      else if (format === 'JSON') exportToJson(data, filename);
      else if (format === 'PDF') exportToPrintView(`Reporte de ${label}`, `Módulo ${this.routeInfo.module} · NexoDocs`, data, cols);
      this.actionMessage = `Exportación de ${label} a ${format} completada exitosamente.`;
    }
  }

  validateOcr(): void {
    this.ocrApi.validate().subscribe({
      next: () => {
        this.actionMessage = 'Extracción confirmada; avanzando a la fase de indexación...';
        this.loadIndexOptions();
        void this.router.navigateByUrl('/digitization/indexing');
      },
      error: () => (this.actionMessage = this.ocrError() || 'No se pudo confirmar la extracción'),
    });
  }

  rejectOcr(): void {
    this.ocrApi.reject().subscribe({
      next: () => {
        this.actionMessage = 'Resultado rechazado; puedes volver a escanear o seleccionar otra fuente.';
        this.finishDigitization();
        void this.router.navigateByUrl('/digitization');
      },
      error: () => (this.actionMessage = this.ocrError() || 'No se pudo rechazar el resultado'),
    });
  }

  indexOcr(): void {
    const form = this.indexEdits();
    this.ocrApi.index({
      documentTypeId: form.typeId,
      name: form.name.trim() || undefined,
      code: form.code.trim() || undefined,
      departmentId: form.department || undefined,
    }).subscribe({
      next: () => {
        this.actionMessage = 'Documento catalogado e indexado con éxito. Pasando a corrección de metadatos...';
        void this.router.navigateByUrl('/digitization/metadata');
      },
      error: () => (this.actionMessage = this.ocrError() || 'No se pudo indexar el documento'),
    });
  }

  correctMetadata(): void {
    const job = this.ocrApi.ocrData();
    if (!job) return;
    const changes = changedMetadata(this.metaEdits(), {
      documentType: job.documentType, patientName: job.patientName, patientDocumentNumber: job.patientDocumentNumber,
      doctorName: job.doctorName, issueDate: job.issueDate,
    });
    const done = (indexed: boolean) => {
      if (indexed) {
        this.actionMessage = '¡Expediente digitalizado y registrado en el repositorio documental!';
        this.finishDigitization();
        void this.router.navigateByUrl('/documents');
      } else {
        this.actionMessage = 'Metadatos guardados. Falta indexar el documento en el repositorio.';
        void this.router.navigateByUrl('/digitization/indexing');
      }
    };
    if (Object.keys(changes).length === 0) {
      done(job.status === 'INDEXED');
      return;
    }
    this.ocrApi.updateMetadata(changes).subscribe({
      next: (updated) => done(updated.status === 'INDEXED'),
      error: () => (this.actionMessage = this.ocrError() || 'No se pudieron guardar los metadatos'),
    });
  }

  statusText(status: string): string {
    return statusLabel(status as Parameters<typeof statusLabel>[0]);
  }

  resumeRoute(status: string): string | null {
    return routeForStatus(status as Parameters<typeof routeForStatus>[0]);
  }

  openRecent(job: OcrProcessResult): void {
    const route = routeForStatus(job.status);
    if (!route) return;
    this.metaEdits.set({});
    this.indexEdits.set({ typeId: '', name: '', code: '', department: '' });
    this.ocrApi.openJob(job);
    void this.router.navigateByUrl(route);
  }

  ocrFileSize(): number | null {
    return this.ocrApi.rawFile()?.size ?? this.ocrApi.ocrData()?.fileSizeBytes ?? null;
  }

  canReject(): boolean {
    const status = this.ocrApi.ocrStatus();
    return status === 'REQUIRES_VALIDATION' || status === 'VALIDATED';
  }

  canCorrectMetadata(): boolean {
    const status = this.ocrApi.ocrStatus();
    return status === 'VALIDATED' || status === 'INDEXED';
  }

  defaultIndexName(): string {
    const name = this.ocrApi.ocrData()?.originalFilename ?? '';
    const dot = name.lastIndexOf('.');
    return (dot > 0 ? name.slice(0, dot) : name) || 'Documento digitalizado';
  }

  setIndexField(field: 'typeId' | 'name' | 'code' | 'department', value: string): void {
    this.indexEdits.update((current) => ({ ...current, [field]: value }));
  }

  setMetaField(field: keyof OcrMetadataFields, value: string): void {
    this.metaEdits.update((current) => ({ ...current, [field]: value }));
  }

  metaValue(field: keyof OcrMetadataFields): string {
    const edited = this.metaEdits()[field];
    if (edited !== undefined) return edited;
    const job = this.ocrApi.ocrData();
    return (job?.[field] ?? (field === 'documentType' ? 'OTRO' : '')) as string;
  }

  private loadIndexOptions(): void {
    if (this.documentTypes().length === 0) {
      this.documentApi.documentTypes('', 0, 100).subscribe({
        next: (page) => this.documentTypes.set(page.content ?? []),
        error: () => (this.actionMessage = 'No se pudieron cargar los tipos documentales'),
      });
    }
    if (this.departments().length === 0) {
      this.documentApi.departments().subscribe({
        next: (list) => this.departments.set(list),
        error: () => this.departments.set([]),
      });
    }
  }

  /** Back to a clean slate once a digitization is closed (rejected or fully indexed). */
  private finishDigitization(): void {
    this.ocrApi.reset();
    this.selectedFileName = 'Ningún archivo seleccionado';
    this.selectedSource = 'Sin seleccionar';
    this.indexEdits.set({ typeId: '', name: '', code: '', department: '' });
    this.metaEdits.set({});
  }

  private documentMatchesCurrentTab(item: DemoItem): boolean {
    const href = this.routeInfo.href;
    if (href === '/documents/pending') return item.status === 'Pendiente';
    if (href === '/documents/in-review') return item.status === 'En revision';
    if (href === '/documents/approved') return item.status === 'Aprobado';
    if (href === '/documents/archived') return item.status === 'Archivado';
    if (href === '/documents/trash') return item.status === 'Papelera';
    return true;
  }

  formatFileSize(size: number): string {
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
      'Usuarios y equipos': [{ icon: '♙', label: 'Roles activos', value: '5', detail: 'Tenant actual', tone: 'teal' }, { icon: '◷', label: 'Usuarios asignados', value: '32', detail: '84% con rol', tone: 'amber' }, { icon: '✓', label: 'Seguridad RBAC', value: '100%', detail: 'Aislamiento estricto', tone: 'green' }],
      Notificaciones: [{ icon: '♢', label: 'No leídas', value: '6', detail: '2 de alta prioridad', tone: 'amber' }],
    };
    return values[module] ?? values['Inicio'];
  }
}

export { WorkspacePage as EspacioTrabajoPage };
