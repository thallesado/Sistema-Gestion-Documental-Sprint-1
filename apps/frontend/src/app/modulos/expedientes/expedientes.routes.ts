import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

const expedientViews: [string, string, string][] = [
  ['expedients', 'all', 'Todos los expedientes'],
  ['expedients/new', 'new', 'Crear expediente'],
  ['expedients/active', 'active', 'Activos'],
  ['expedients/closed', 'closed', 'Cerrados'],
  ['expedients/archived', 'archived', 'Archivados'],
];

export const expedientesRoutes: Routes = expedientViews.map(([path, expedientView, title]) => ({
  path,
  loadComponent: () => import('./expedientes-page').then((m) => m.ExpedientsPage),
  title: `${title} - NexoDocs`,
  data: { expedientView },
  canActivate: [authGuard],
}));

export { expedientesRoutes as expedientRoutes };
