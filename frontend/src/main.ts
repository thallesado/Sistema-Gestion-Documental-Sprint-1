import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/core/config/app.config';
import { App } from './app/shell/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
