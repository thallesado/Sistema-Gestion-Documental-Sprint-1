import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Interceptor HTTP que adjunta la fecha y hora del cliente junto a su zona horaria (C1).
 * Reemplaza el placeholder inicial (request, next) => next(request).
 * Permite que el servidor registre tanto la hora del servidor como la hora local del cliente.
 */
export const clientTimestampInterceptor: HttpInterceptorFn = (request, next) => {
  const clientTimestamp = new Date().toISOString();
  let clientTimezone = 'UTC';
  try {
    clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    // fallback a UTC
  }

  const modified = request.clone({
    setHeaders: {
      'X-Client-Timestamp': clientTimestamp,
      'X-Client-Timezone': clientTimezone,
    },
  });

  return next(modified);
};
