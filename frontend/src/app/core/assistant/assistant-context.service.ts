import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AssistantContextSnapshot, AssistantErrorInfo, MAX_RECENT_ROUTES, pushBounded, stripQuery } from './assistant-context';

/**
 * Collects the context the user assistant (task H2) will send along with each question:
 * where the user is, where they came from and the last failed request.
 * Created in the sprint scaffold and instantiated once by the shell.
 */
@Injectable({ providedIn: 'root' })
export class AssistantContextService {
  private readonly router = inject(Router);

  readonly route = signal(stripQuery(this.router.url));
  readonly recentRoutes = signal<string[]>([]);
  readonly lastError = signal<AssistantErrorInfo | null>(null);

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.recordNavigation(event.urlAfterRedirects));
  }

  recordNavigation(url: string): void {
    const route = stripQuery(url);
    this.route.set(route);
    this.recentRoutes.update((routes) => pushBounded(routes, route, MAX_RECENT_ROUTES));
  }

  recordError(error: { status: number; method: string; url: string }): void {
    this.lastError.set({ status: error.status, method: error.method, url: stripQuery(error.url), at: new Date().toISOString() });
  }

  snapshot(): AssistantContextSnapshot {
    return { route: this.route(), recentRoutes: this.recentRoutes(), lastError: this.lastError() };
  }
}
