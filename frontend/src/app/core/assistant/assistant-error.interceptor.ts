import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AssistantContextService } from './assistant-context.service';

/** Remembers the last failed request so the assistant can offer help about it. It never alters the response. */
export const assistantErrorInterceptor: HttpInterceptorFn = (request, next) => {
  const context = inject(AssistantContextService);
  return next(request).pipe(
    catchError((error: unknown) => {
      // The assistant's own failures are answered in its panel; recording them would hide the help offered for the real error.
      if (error instanceof HttpErrorResponse && !request.url.includes('/assistant/')) {
        context.recordError({ status: error.status, method: request.method, url: request.url });
      }
      return throwError(() => error);
    }),
  );
};
