import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ApiActivity, ApiTask } from '../../core/api/workspace-api.service';
import { ApiDocument } from '../../core/api/document-api.service';
import { WorkspaceWelcomeBannerComponent } from './workspace-welcome-banner.component';
import { WorkspaceTasksCardComponent } from './workspace-tasks-card.component';
import { WorkspaceDocumentsCardComponent } from './workspace-documents-card.component';
import { WorkspaceActivityCardComponent } from './workspace-activity-card.component';
import { WorkspaceDesktopBannerComponent } from './workspace-desktop-banner.component';

@Component({
  selector: 'app-workspace-home-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    WorkspaceWelcomeBannerComponent,
    WorkspaceTasksCardComponent,
    WorkspaceDocumentsCardComponent,
    WorkspaceActivityCardComponent,
    WorkspaceDesktopBannerComponent
  ],
  template: `
    <app-workspace-welcome-banner [displayName]="displayName()" />
    <div class="dashboard-grid">
      <app-workspace-tasks-card [tasks]="tasks()" (toggleTask)="toggleTask.emit($event)" />
      <app-workspace-documents-card [documents]="documents()" />
      <app-workspace-activity-card [activities]="activities()" />
      <app-workspace-desktop-banner />
    </div>
  `
})
export class WorkspaceHomeDashboardComponent {
  readonly displayName = input<string>('');
  readonly tasks = input<ApiTask[]>([]);
  readonly documents = input<ApiDocument[]>([]);
  readonly activities = input<ApiActivity[]>([]);

  readonly toggleTask = output<ApiTask>();
}
