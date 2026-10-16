import { Injectable, computed, signal } from '@angular/core';
import { hasAnyPermission, hasPermission } from './permission-check';

/**
 * Permission codes of the signed-in user (for example `document:create`).
 * Hook created in the sprint scaffold: the backend does not send the codes yet.
 * Task B3 feeds it through `setPermissions` and starts using it in menus, guards and directives.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly granted = signal<readonly string[] | null>(null);

  readonly loaded = computed(() => this.granted() !== null);

  setPermissions(permissions: readonly string[] | null): void {
    this.granted.set(permissions);
  }

  can(permission: string): boolean {
    return hasPermission(this.granted(), permission);
  }

  canAny(...permissions: string[]): boolean {
    return hasAnyPermission(this.granted(), permissions);
  }
}
