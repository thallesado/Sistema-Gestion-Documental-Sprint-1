import { Routes, CanDeactivateFn } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';
import type { WorkflowsPage } from './workflows-page';

const leaveDesigner: CanDeactivateFn<WorkflowsPage> = page => page.canLeave();
export const workflowsRoutes: Routes = [
  ['', 'all'], ['tasks', 'tasks'], ['pending-review', 'review'], ['pending-approval', 'approval'],
  ['active', 'active'], ['completed', 'completed'], ['templates', 'templates'], ['designer', 'designer'],
  ['review', 'review'], ['approval', 'approval'],
].map(([path, mode]) => ({ path: 'workflows' + (path ? '/' + path : ''),
  loadComponent: () => import('./workflows-page').then(m => m.WorkflowsPage),
  canActivate: [authGuard], canDeactivate: [leaveDesigner], data: { workflowMode: mode }, title: 'Workflows - NexoDocs' }));
