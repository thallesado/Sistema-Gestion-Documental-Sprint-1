import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  DemoItem,
  RouteInfo,
  screenCopy,
  demoList,
  navigationRoutes
} from '../../../core/data/nexodocs-data';
import { AuthService } from '../../../core/auth/auth.service';
import { DocumentApiService, ApiDocument } from '../../../core/api/document-api.service';
import { WorkspaceApiService, ApiActivity, ApiTask } from '../../../core/api/workspace-api.service';
import { exportToCsv, ExportColumn } from '../../../core/utils/export-utils';
import { WorkspaceHomeDashboardComponent } from '../../../widgets/workspace/workspace-home-dashboard.component';
import { WorkspaceSubviewPanelComponent } from '../../../widgets/workspace/workspace-subview-panel.component';

@Component({
  selector: 'app-workspace-page',
  standalone: true,
  imports: [CommonModule, WorkspaceHomeDashboardComponent, WorkspaceSubviewPanelComponent],
  template: `
    <section class="page">
      @if (isHome) {
        <app-workspace-home-dashboard
          [displayName]="displayName()"
          [tasks]="tasks()"
          [documents]="documents()"
          [activities]="activities()"
          (toggleTask)="toggleTask($event)"
        />
      } @else {
        <app-workspace-subview-panel
          [activeRoute]="currentRoute()"
          [description]="viewCopy().description"
          [actionText]="viewCopy().action"
          [items]="pagedDemoItems()"
          [totalItems]="filteredDemoItems().length"
          [page]="page()"
          [pageSize]="pageSize"
          [searchTerm]="searchTerm()"
          (searchChange)="searchTerm.set($event); page.set(1)"
          (pageChange)="page.set($event)"
          (exportCsv)="exportCsv()"
        />
      }
    </section>
  `
})
export class EspacioTrabajoPage {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly docApi = inject(DocumentApiService);
  private readonly wsApi = inject(WorkspaceApiService);

  readonly isHome = this.route.snapshot.url.length === 0 || this.route.snapshot.url[0]?.path === '';
  readonly currentPath = '/' + this.route.snapshot.url.map(s => s.path).join('/');

  readonly tasks = signal<ApiTask[]>([]);
  readonly documents = signal<ApiDocument[]>([]);
  readonly activities = signal<ApiActivity[]>([]);

  readonly page = signal(1);
  readonly pageSize = 8;
  readonly searchTerm = signal('');

  readonly currentUser = this.auth.user;
  readonly displayName = computed(() => {
    const u = this.currentUser();
    if (!u) return 'Colega';
    const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return full || u.username || 'Colega';
  });

  readonly currentRoute = computed<RouteInfo | null>(() => {
    return navigationRoutes.find(r => r.href === this.currentPath) || null;
  });

  readonly viewCopy = computed(() => {
    const r = this.currentRoute();
    if (!r) return { description: 'Vista del espacio de trabajo institucional.', action: 'Nueva acción' };
    return screenCopy(r);
  });

  readonly rawDemoItems = computed<DemoItem[]>(() => {
    const r = this.currentRoute();
    if (!r) return [];
    return demoList(r.module, r.subcategory);
  });

  readonly filteredDemoItems = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const items = this.rawDemoItems();
    if (!term) return items;
    return items.filter(i => (i.title ?? '').toLowerCase().includes(term) || (i.meta ?? '').toLowerCase().includes(term));
  });

  readonly pagedDemoItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.filteredDemoItems().slice(start, start + this.pageSize);
  });

  constructor() {
    if (this.isHome) {
      this.loadDashboard();
    }
  }

  loadDashboard(): void {
    this.wsApi.tasks().subscribe({ next: t => this.tasks.set(t.content || []), error: () => {} });
    this.wsApi.recentActivity().subscribe({ next: a => this.activities.set(a.content || []), error: () => {} });
    this.docApi.documents('', undefined, 0, 5).subscribe({ next: d => this.documents.set(d.content || []), error: () => {} });
  }

  toggleTask(task: ApiTask): void {
    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    this.wsApi.updateTaskStatus(task.id, newStatus).subscribe({
      next: updated => {
        this.tasks.update(list => list.map(t => t.id === updated.id ? updated : t));
      }
    });
  }

  exportCsv(): void {
    const cols: ExportColumn[] = [{ label: 'Título', key: 'title' }, { label: 'Metadatos', key: 'meta' }, { label: 'Fecha', key: 'date' }, { label: 'Estado', key: 'status' }];
    exportToCsv(this.filteredDemoItems(), 'exportacion.csv', cols);
  }
}

export const WorkspacePage = EspacioTrabajoPage;
