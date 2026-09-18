import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  const authorizedRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authorizedRequest).pipe(
    catchError((error) => {
      const isAuthEndpoint = ['/auth/login', '/auth/logout', '/auth/refresh']
        .some((path) => request.url.endsWith(path));
      if (error.status !== 401 || isAuthEndpoint || !auth.accessToken()) {
        return throwError(() => error);
      }
      return auth.refreshOnce().pipe(
        switchMap((response) => next(request.clone({
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
