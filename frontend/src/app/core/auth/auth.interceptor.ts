import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { I18nService } from '../i18n/i18n.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const subscription = inject(SubscriptionService);
  const i18n = inject(I18nService);
  const router = inject(Router);
  const token = auth.accessToken();
  const authorizedRequest = request.clone({
    setHeaders: {
      'Accept-Language': i18n.language(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return next(authorizedRequest).pipe(
    catchError((error) => {
      // Las respuestas de /plans no abren el modal: el propio modal recarga la suscripción y un
      // error ahí lo reabriría en bucle sin poder cerrarlo.
      const planLimitExceeded = error?.status === 403
        && !request.url.includes('/api/v1/plans')
        && (error?.error?.code === 'PLAN_LIMIT_EXCEEDED'
          || JSON.stringify(error?.error ?? '').includes('PLAN_LIMIT_EXCEEDED'));
      if (planLimitExceeded) {
        subscription.openUpgrade(error?.error?.message || 'Esta acción supera la capacidad de tu plan actual');
      }
      if (error?.status === 403 && error?.error?.code === 'MUST_CHANGE_PASSWORD') {
        auth.mustChangePassword.set(true);
        if (!router.url.startsWith('/change-password')) void router.navigateByUrl('/change-password');
        return throwError(() => error);
      }
      const isAuthEndpoint = ['/auth/login', '/auth/logout', '/auth/refresh']
        .some((path) => request.url.endsWith(path));
      if (error.status !== 401 || isAuthEndpoint || !auth.accessToken()) {
        return throwError(() => error);
      }
      return auth.refreshOnce().pipe(
        switchMap((response) => next(authorizedRequest.clone({
          setHeaders: { Authorization: `Bearer ${response.token}` },
        }))),
        catchError((refreshError) => {
          auth.logout();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
