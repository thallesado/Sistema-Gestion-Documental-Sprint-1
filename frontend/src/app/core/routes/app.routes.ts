import { Routes } from '@angular/router';
import { LoginPage } from '../../features/auth/login-page';
import { navigationRoutes } from '../data/nexodocs-data';
import { NotFoundPage } from '../../features/not-found/not-found-page';
import { WorkspacePage } from '../../features/workspace/workspace-page';
import { ClinicalPage } from '../../features/clinical/clinical-page';

const clinicalPaths = new Set(['expedients/clinical', 'expedients/clinical/notes']);

export const routes: Routes = [
  {
    path: 'login',
    component: LoginPage,
    title: 'Login - NexoDocs',
  },
  {
    path: 'expedients/clinical',
    component: ClinicalPage,
    title: 'Expediente clínico - NexoDocs',
    data: { routeInfo: { module: 'Expedientes', subcategory: 'Expediente clínico', href: '/expedients/clinical' } },
  },
  ...navigationRoutes
    .filter((route) => !clinicalPaths.has(route.href.slice(1)))
    .map((route) => ({
      path: route.href === '/' ? '' : route.href.slice(1),
      component: WorkspacePage,
      title: `${route.subcategory} - NexoDocs`,
      data: { routeInfo: route },
    })),
  {
    path: '**',
    component: NotFoundPage,
    title: 'Pagina no encontrada - NexoDocs',
  },
];
