import { Routes } from '@angular/router';
import { publicGuard } from '../../core/auth/auth.guard';

export const autenticacionRoutes: Routes = [
  {
    path: 'welcome',
    loadComponent: () => import('../marketing/pages/welcome-page').then((m) => m.WelcomePage),
    title: 'NexoDocs - Gestión documental inteligente',
  },
  {
    path: 'register',
    loadComponent: () => import('../marketing/pages/register-page').then((m) => m.RegisterPage),
    title: 'Crear organización - NexoDocs',
  },
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
