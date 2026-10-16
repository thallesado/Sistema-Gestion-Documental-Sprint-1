import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { I18nService } from '../i18n/i18n.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const subscription = inject(SubscriptionService);
  const i18n = inject(I18nService);
  const token = auth.accessToken();
  const authorizedRequest = request.clone({
    setHeaders: {
      'Accept-Language': i18n.language(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  return next(authorizedRequest).pipe(
    catchError((error) => {
      const planLimitExceeded = error?.status === 403
        && (error?.error?.code === 'PLAN_LIMIT_EXCEEDED'
          || JSON.stringify(error?.error ?? '').includes('PLAN_LIMIT_EXCEEDED'));
      if (planLimitExceeded) {
        subscription.openUpgrade(error?.error?.message || 'Esta acción supera la capacidad de tu plan actual');
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
