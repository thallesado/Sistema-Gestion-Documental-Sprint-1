import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { TenantSettings, THEME_VARIABLE_NAMES, themeVariables } from './theme-variables';

/**
 * Applies the tenant's look and regional settings. Hook created in the sprint scaffold;
 * task E2 calls `apply` after login with the data from `/tenants/current/settings`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;

  readonly settings = signal<TenantSettings>({});

  apply(settings: TenantSettings): void {
    this.reset();
    this.settings.set(settings);
    Object.entries(themeVariables(settings)).forEach(([name, value]) => this.root.style.setProperty(name, value));
  }

  reset(): void {
    THEME_VARIABLE_NAMES.forEach((name) => this.root.style.removeProperty(name));
    this.settings.set({});
  }
}
