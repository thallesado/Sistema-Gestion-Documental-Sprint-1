import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from '../routes/app.routes';
import { authInterceptor } from '../auth/auth.interceptor';
import { assistantErrorInterceptor } from '../assistant/assistant-error.interceptor';
import { clientTimestampInterceptor } from '../http/client-timestamp.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // The error recorder goes first (outermost) so it only sees the final outcome, after the token refresh retry.
    provideHttpClient(withInterceptors([assistantErrorInterceptor, authInterceptor, clientTimestampInterceptor]))
  ]
};
