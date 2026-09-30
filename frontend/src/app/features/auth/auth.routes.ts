import { Routes } from '@angular/router';
import { publicGuard } from '../../core/auth/auth.guard';

export const autenticacionRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login-page').then((m) => m.LoginPage),
    title: 'Login - NexoDocs',
    canActivate: [publicGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password-page').then((m) => m.ForgotPasswordPage),
    title: 'Recuperar contraseña - NexoDocs',
    canActivate: [publicGuard],
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password-page').then((m) => m.ResetPasswordPage),
    title: 'Restablecer contraseña - NexoDocs',
  },
  {
    path: 'reset-password/:token',
    loadComponent: () => import('./pages/reset-password-page').then((m) => m.ResetPasswordPage),
    title: 'Restablecer contraseña - NexoDocs',
  },
];

export { autenticacionRoutes as authRoutes };
