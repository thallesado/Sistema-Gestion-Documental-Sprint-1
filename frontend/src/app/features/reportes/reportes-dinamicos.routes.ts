import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const reportesDinamicosRoutes: Routes = [
  {
    path: 'reports/queries',
    loadComponent: () => import('./qbe/qbe-page').then((m) => m.QbePage),
    title: 'Consultas Dinámicas (QBE) - NexoDocs',
    canActivate: [authGuard],
  },
  {
    path: 'reports/voice',
    loadComponent: () => import('./voice/voice-report-page').then((m) => m.VoiceReportPage),
    title: 'Reportes por Voz (IA) - NexoDocs',
    canActivate: [authGuard],
  },
];
