import { Routes } from '@angular/router';

export const autenticacionRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login-page').then((m) => m.LoginPage),
    title: 'Login - NexoDocs',
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./forgot-password-page').then((m) => m.ForgotPasswordPage),
    title: 'Recuperar contraseña - NexoDocs',
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./reset-password-page').then((m) => m.ResetPasswordPage),
    title: 'Restablecer contraseña - NexoDocs',
  },
  {
    path: 'reset-password/:token',
    loadComponent: () => import('./reset-password-page').then((m) => m.ResetPasswordPage),
    title: 'Restablecer contraseña - NexoDocs',
  },
];

export { autenticacionRoutes as authRoutes };
