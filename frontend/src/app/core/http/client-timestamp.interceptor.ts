import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Placeholder created in the sprint scaffold: it passes every request through unchanged.
 * Task C1 will add the `X-Client-Timestamp` header (and check the backend CORS configuration).
 */
export const clientTimestampInterceptor: HttpInterceptorFn = (request, next) => next(request);
