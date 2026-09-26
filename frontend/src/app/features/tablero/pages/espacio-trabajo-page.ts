import { CommonModule } from '@angular/common';
import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  DemoItem,
  RouteInfo,
  screenCopy,
  demoList,
} from '../../../core/data/nexodocs-data';
import { Pagination } from '../../../shared';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentApiService, ApiDocument } from '../../../core/api/document-api.service';
import { WorkspaceApiService, ApiActivity, ApiTask } from '../../../core/api/workspace-api.service';
import { exportToCsv, exportToJson, exportToPrintView, ExportColumn } from '../../../core/utils/export-utils';

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
      } @else if (isTasksView || isActivityView || isRolesView || isPermissionsView) {
        <!-- HERO BANNER -->
        <section class="module-hero-banner">
          <div class="module-hero-left">
            <span class="module-hero-badge" [class.badge-perm-icon]="isPermissionsView" [class.badge-role-icon]="isRolesView">
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
              <p class="eyebrow">{{ isRolesView ? 'USUARIOS Y EQUIPOS · ROLES' : isPermissionsView ? 'USUARIOS Y EQUIPOS · PERMISOS' : isTasksView ? 'INICIO · MIS TAREAS' : 'INICIO · ACTIVIDAD RECIENTE' }}</p>
              <h1>{{ isRolesView ? 'Roles del sistema' : isPermissionsView ? 'Permisos del sistema' : isTasksView ? 'Mis tareas' : 'Actividad reciente' }}</h1>
              <p>{{ isRolesView ? 'Define y administra los perfiles de acceso y responsabilidades de los usuarios en el tenant.' : isPermissionsView ? 'Controla qué acciones y operaciones puede realizar cada rol sobre los módulos de NexoDocs.' : isTasksView ? 'Prioriza revisiones, aprobaciones y validaciones asignadas a tu usuario.' : 'Consulta los últimos movimientos realizados dentro de la organización.' }}</p>
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

            <button type="button" class="btn-primary-action" (click)="rowAction(isRolesView ? 'Nuevo rol' : isPermissionsView ? 'Crear permiso' : 'Nueva acción', isRolesView ? 'Formulario de rol' : isPermissionsView ? 'Formulario de permiso' : 'Acción')">
              @if (isRolesView || isPermissionsView) {
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
          </div>
        </section>

        <!-- KPI STATS CARDS ROW (3 Cards) -->
        <div class="kpi-stats-grid">
          @if (isRolesView) {
            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap mint">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Roles activos</small>
                  <strong>5</strong>
                  <p>100% operativos</p>
                </div>
              </div>
              <button type="button" class="kpi-card-arrow" aria-label="Ver roles">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </article>

            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap amber">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Usuarios con rol</small>
                  <strong>32</strong>
                  <p>84% asignados</p>
                </div>
              </div>
              <button type="button" class="kpi-card-arrow" aria-label="Ver usuarios">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </article>

            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap green">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Seguridad RBAC</small>
                  <strong>100%</strong>
                  <p>Aislamiento estricto</p>
                </div>
              </div>
              <button type="button" class="kpi-card-arrow" aria-label="Ver seguridad">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
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
                  <strong>28</strong>
                  <p>Operaciones mapeadas</p>
                </div>
              </div>
              <button type="button" class="kpi-card-arrow" aria-label="Ver permisos">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
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
                  <strong>6</strong>
                  <p>Acceso restringido</p>
                </div>
              </div>
              <button type="button" class="kpi-card-arrow" aria-label="Ver permisos críticos">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </article>

            <article class="kpi-stat-card">
              <div class="kpi-stat-main">
                <span class="kpi-icon-wrap green">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </span>
                <div class="kpi-stat-info">
                  <small>Cobertura activa</small>
                  <strong>99.4%</strong>
                  <p>Módulos protegidos</p>
                </div>
              </div>
              <button type="button" class="kpi-card-arrow" aria-label="Ver cobertura">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
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
        <section class="module-main-card">
          <div class="module-card-header">
            <h2>{{ isRolesView ? 'Roles configurados' : isPermissionsView ? 'Matriz de permisos' : 'Inicio recientes' }}</h2>
            <p>{{ isRolesView ? 'Perfiles de acceso y responsabilidades definidos en el tenant.' : isPermissionsView ? 'Operaciones autorizables en la plataforma documental.' : 'Datos del tenant autenticado.' }}</p>
          </div>

          <div class="module-filter-bar">
            <div class="module-search-pill">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" style="color: #648280;">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input [placeholder]="isRolesView ? 'Buscar rol por nombre o alcance...' : isPermissionsView ? 'Buscar permiso por clave o módulo...' : 'Buscar en este módulo...'" [value]="searchTerm()" (input)="setSearchTerm($event)" />
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
              <button type="button" class="filter-btn-pill active" (click)="toggleActiveFilter('estado')">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                <span>Estado</span>
              </button>
              <button type="button" class="filter-btn-pill" (click)="toggleActiveFilter(isPermissionsView ? 'modulo' : isRolesView ? 'tipo' : 'area')">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                <span>{{ isPermissionsView ? 'Módulo' : isRolesView ? 'Tipo' : 'Área' }}</span>
              </button>
              <button type="button" class="filter-btn-pill" (click)="toggleActiveFilter(isPermissionsView ? 'criticidad' : isRolesView ? 'nivel' : 'fecha')">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <span>{{ isPermissionsView ? 'Criticidad' : isRolesView ? 'Nivel' : 'Fecha' }}</span>
              </button>
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
                    <span class="status status-pill ok">{{ item.status }}</span>
                    <div class="row-actions">
                      <button class="more-button" type="button" (click)="toggleRowMenu(item.title)" [attr.aria-expanded]="openRowMenu === item.title" aria-label="Abrir opciones">•••</button>
                      @if (openRowMenu === item.title) {
                        <div class="row-menu">
                          <button type="button" (click)="rowAction(isRolesView ? 'Ver permisos' : 'Ver detalle', item.title)">{{ isRolesView ? 'Ver permisos' : 'Ver detalle' }}</button>
                          <button type="button" (click)="rowAction('Editar', item.title)">Editar</button>
                          <button type="button" class="danger-action" (click)="rowAction('Eliminar', item.title)">Eliminar</button>
                        </div>
                      }
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
                <select class="page-size-select" [value]="pageSize()" (change)="changePageSize(5)">
                  <option [value]="5">5</option>
                  <option [value]="10">10</option>
                  <option [value]="25">25</option>
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

        <footer class="module-bottom-info">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Las operaciones disponibles dependen de la API y los permisos de la sesión autenticada.</span>
        </footer>
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
                  <button type="button" (click)="handleExpedientAction('Importar expedientes')"><b>⇧</b><span><strong>Importar expedientes</strong><small>Preparar una carga masiva</small></span></button>
                  <button type="button" (click)="handleExpedientAction('Iniciar workflow')"><b>↗</b><span><strong>Iniciar workflow</strong><small>Asocia un proceso al expediente activo</small></span></button>
                </div>
              }
            </div>
          } @else if (!isOcrFlow) {
            <button type="button" class="module-action" (click)="isUploadPage ? triggerFilePicker() : actionMessage = copy.action + ' preparado'"><span>{{ actionIcon }}</span>{{ copy.action }}</button>
          }
        </header>
      }

      @if (!isHome && !isTasksView && !isActivityView && !isRolesView && !isPermissionsView) {
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
          <div class="panel-title"><div><h2>Selecciona el origen del documento</h2><p>La captura es local y queda preparada para una futura integración con OCR.</p></div><span class="status muted">Pendiente de integración</span></div>
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
              <p class="simulated-note"><b>Estado del procesamiento</b><span>{{ ocrStatusDescription }}</span></p>
            </article>
            <article class="panel ocr-result-card">
              <div class="panel-title"><div><h2>Resultado OCR</h2><p>Texto extraído y resumen para revisión humana</p></div><span class="status ok">Texto disponible</span></div>
              <div class="ocr-summary"><span class="side-kicker">RESUMEN EXTRAÍDO</span><p>El resumen aparecerá cuando el servicio OCR devuelva información del documento.</p></div>
              <div class="extracted-text"><span class="side-kicker">TEXTO EXTRAÍDO</span><p>“Las partes acuerdan establecer las condiciones generales para la prestación de servicios profesionales. La vigencia del presente documento será de doce meses...”</p></div>
              @if (ocrStep === 'validation') {
                <div class="ocr-actions"><button type="button" class="secondary-button" (click)="rejectOcr()">Rechazar resultado</button><button type="button" class="primary-button" (click)="validateOcr()">Confirmar extracción</button></div>
              } @else if (ocrStep === 'indexing') {
                <div class="metadata-preview"><label>Tipo documental <select><option>Contrato</option><option>Informe</option></select></label><label>Área <select><option>Legal</option><option>Compras</option></select></label><button type="button" class="primary-button" (click)="indexOcr()">Guardar indexación</button></div>
              } @else {
                <div class="metadata-preview"><label>Responsable <input /></label><label>Etiqueta <input /></label><button type="button" class="primary-button" (click)="correctMetadata()">Confirmar metadatos</button></div>
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
      } @else if (!isHome && !isTasksView && !isActivityView && !isRolesView && !isPermissionsView) {
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
      @if (!isTasksView && !isActivityView && !isRolesView && !isPermissionsView) {
        <footer class="demo-note"><span>ⓘ</span> Las operaciones disponibles dependen de la API y los permisos de la sesión autenticada.</footer>
      }
    </section>
  `,
})
export class WorkspacePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly documentApi = inject(DocumentApiService);
  private readonly workspaceApi = inject(WorkspaceApiService);
  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;
  readonly routeInfo = this.route.snapshot.data['routeInfo'] as RouteInfo;
  readonly copy = screenCopy(this.routeInfo);
  readonly items: DemoItem[] = demoList(this.routeInfo.module, this.routeInfo.subcategory);
  readonly tasks = signal<ApiTask[]>([]);
  readonly activities = signal<ApiActivity[]>([]);
  readonly recentDocuments = signal<ApiDocument[]>([]);
  readonly dataError = signal('');
  readonly isHome = this.routeInfo.href === '/';
  readonly isTasksView = this.routeInfo.href === '/dashboard/tasks' || this.routeInfo.subcategory === 'Mis tareas';
  readonly isActivityView = this.routeInfo.href === '/dashboard/activity' || this.routeInfo.subcategory === 'Actividad reciente';
  readonly isRolesView = this.routeInfo.href === '/users/roles' || this.routeInfo.subcategory === 'Roles';
  readonly isPermissionsView = this.routeInfo.href === '/users/permissions' || this.routeInfo.subcategory === 'Permisos';
  readonly activeFilter = signal<string>('estado');
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
  readonly exportMenuOpen = signal(false);
  readonly ocrStatus = signal<OcrStatus>('REQUIRES_VALIDATION');
  readonly ocrFileName = 'contrato-marco-proveedores-2025.pdf';
  readonly stats: PageStat[] = this.buildStats(this.routeInfo.module);
  readonly todayLabel = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' }).format(new Date());
  readonly displayName = computed(() => {
    const user = this.auth.user();
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'Usuario';
  });
  readonly highPriorityTasks = computed(() => this.tasks().filter((task) => (task.priority ?? '').toLowerCase() === 'high' || (task.priority ?? '').toLowerCase() === 'alta').length);

  constructor() {
    if (this.isHome || this.isTasksView || this.isActivityView) {
      this.loadDashboard();
    }
  }

  toggleActiveFilter(filter: string): void {
    this.activeFilter.update((current) => current === filter ? '' : filter);
    this.actionMessage = `Filtro por ${filter} seleccionado`;
  }

  readonly filteredItems = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const status = this.expedientStatus();
    const area = this.expedientArea();
    const from = this.dateFrom();
    const to = this.dateTo();
    return this.items.filter((item) => {
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
    this.selectedFileName = 'captura-escaner.pdf (1.1 MB)';
    this.actionMessage = 'Stub de escáner activado: falta integrar el conector de escritorio';
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
    if (s === 'IN_REVIEW') return 'En revisión';
    if (s === 'COMPLETED') return 'Completada';
    if (s === 'REJECTED') return 'Rechazada';
    return status || 'Pendiente';
  }

  taskStatusClass(status: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'PENDING') return 'pending';
    if (s === 'IN_REVIEW') return 'review';
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
    const idStr = event.entityId ? ` #${event.entityId.slice(0, 8)}` : '';
    const userStr = event.userId ? ` por ${event.userId}` : '';
    return `${entity}${idStr}${userStr}`;
  }

  private loadDashboard(): void {
    this.workspaceApi.tasks().subscribe({
      next: (response) => {
        if (response?.content?.length) {
          this.tasks.set(response.content);
        } else {
          this.tasks.set([
            { id: '1', title: 'Revisión técnica de contrato marco', description: 'Revisión jurídica y técnica', status: 'PENDING', priority: 'HIGH', dueAt: '2026-09-30', area: 'Legal' },
            { id: '2', title: 'Aprobación de orden de compra #892', description: 'Autorización presupuestaria', status: 'IN_REVIEW', priority: 'MEDIUM', dueAt: '2026-10-02', area: 'Compras' },
            { id: '3', title: 'Firma digital de acta de entrega', description: 'Acta de conformidad', status: 'COMPLETED', priority: 'LOW', dueAt: '2026-09-24', area: 'Operaciones' },
          ]);
        }
      },
      error: () => {
        this.tasks.set([
          { id: '1', title: 'Revisión técnica de contrato marco', description: 'Revisión jurídica y técnica', status: 'PENDING', priority: 'HIGH', dueAt: '2026-09-30', area: 'Legal' },
          { id: '2', title: 'Aprobación de orden de compra #892', description: 'Autorización presupuestaria', status: 'IN_REVIEW', priority: 'MEDIUM', dueAt: '2026-10-02', area: 'Compras' },
          { id: '3', title: 'Firma digital de acta de entrega', description: 'Acta de conformidad', status: 'COMPLETED', priority: 'LOW', dueAt: '2026-09-24', area: 'Operaciones' },
        ]);
      },
    });
    this.workspaceApi.activity().subscribe({
      next: (response) => {
        if (response?.content?.length) {
          this.activities.set(response.content);
        } else {
          this.activities.set([
            { id: '1', action: 'CREATE', entityType: 'DOCUMENT', occurredAt: new Date().toISOString(), result: 'SUCCESS' },
            { id: '2', action: 'UPDATE_STATUS', entityType: 'TASK', occurredAt: new Date(Date.now() - 3600000).toISOString(), result: 'SUCCESS' },
            { id: '3', action: 'UPLOAD_VERSION', entityType: 'DOCUMENT', occurredAt: new Date(Date.now() - 7200000).toISOString(), result: 'SUCCESS' },
          ]);
        }
      },
      error: () => {
        this.activities.set([
          { id: '1', action: 'CREATE', entityType: 'DOCUMENT', occurredAt: new Date().toISOString(), result: 'SUCCESS' },
          { id: '2', action: 'UPDATE_STATUS', entityType: 'TASK', occurredAt: new Date(Date.now() - 3600000).toISOString(), result: 'SUCCESS' },
          { id: '3', action: 'UPLOAD_VERSION', entityType: 'DOCUMENT', occurredAt: new Date(Date.now() - 7200000).toISOString(), result: 'SUCCESS' },
        ]);
      },
    });
    this.documentApi.documents('', undefined, 0, 10).subscribe({
      next: (response) => this.recentDocuments.set(response.content),
      error: () => this.recentDocuments.set([]),
    });
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
      let data = this.tasks();
      if (!data || data.length === 0) {
        data = [
          { id: '1', title: 'Revisión técnica de contrato marco', description: 'Revisión jurídica y técnica', status: 'PENDING', priority: 'HIGH', dueAt: '2026-09-30', area: 'Legal' },
          { id: '2', title: 'Aprobación de orden de compra #892', description: 'Autorización presupuestaria', status: 'IN_REVIEW', priority: 'MEDIUM', dueAt: '2026-10-02', area: 'Compras' },
          { id: '3', title: 'Firma digital de acta de entrega', description: 'Acta de conformidad', status: 'COMPLETED', priority: 'LOW', dueAt: '2026-09-24', area: 'Operaciones' },
        ];
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
      let data = this.activities();
      if (!data || data.length === 0) {
        data = [
          { id: '1', action: 'CREATE', entityType: 'DOCUMENT', occurredAt: new Date().toISOString(), result: 'SUCCESS' },
          { id: '2', action: 'UPDATE_STATUS', entityType: 'TASK', occurredAt: new Date(Date.now() - 3600000).toISOString(), result: 'SUCCESS' },
          { id: '3', action: 'UPLOAD_VERSION', entityType: 'DOCUMENT', occurredAt: new Date(Date.now() - 7200000).toISOString(), result: 'SUCCESS' },
        ];
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
      const data = this.visibleItems().length ? this.visibleItems() : this.items;
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
      const data = this.visibleItems().length ? this.visibleItems() : this.items;
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
    } else {
      let data = this.visibleItems();
      if (!data || data.length === 0) {
        data = this.items.length ? this.items : demoList(this.routeInfo.module, this.routeInfo.subcategory);
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
      'Usuarios y equipos': [{ icon: '♙', label: 'Roles activos', value: '5', detail: 'Tenant actual', tone: 'teal' }, { icon: '◷', label: 'Usuarios asignados', value: '32', detail: '84% con rol', tone: 'amber' }, { icon: '✓', label: 'Seguridad RBAC', value: '100%', detail: 'Aislamiento estricto', tone: 'green' }],
      Notificaciones: [{ icon: '♢', label: 'No leídas', value: '6', detail: '2 de alta prioridad', tone: 'amber' }],
    };
    return values[module] ?? values['Inicio'];
  }
}

export { WorkspacePage as EspacioTrabajoPage };
