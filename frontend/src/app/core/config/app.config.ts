import { registerLocaleData } from '@angular/common';
import localeEsBo from '@angular/common/locales/es-BO';
import localeFr from '@angular/common/locales/fr';
import localeZh from '@angular/common/locales/zh';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from '../routes/app.routes';
import { authInterceptor } from '../auth/auth.interceptor';
import { assistantErrorInterceptor } from '../assistant/assistant-error.interceptor';
import { clientTimestampInterceptor } from '../http/client-timestamp.interceptor';
import { startupLocale } from '../i18n/i18n.service';

// Sin esto el pipe `date` formatea en en-US ("11/17/26, 3:04 PM") aunque la interfaz esté en español.
registerLocaleData(localeEsBo, 'es-BO');
registerLocaleData(localeFr, 'fr-FR');
registerLocaleData(localeZh, 'zh-CN');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: LOCALE_ID, useFactory: startupLocale },
    // Anchor scrolling only acts on URLs with a fragment (marketing links such as /welcome#pricing).
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    // The error recorder goes first (outermost) so it only sees the final outcome, after the token refresh retry.
    provideHttpClient(withInterceptors([assistantErrorInterceptor, authInterceptor, clientTimestampInterceptor]))
  ]
};
