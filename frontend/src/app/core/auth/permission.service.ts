import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { PermissionRequirement, hasPermission } from './permission-rules';

/**
 * Permisos por función del usuario autenticado, tal como los devuelve /auth/me.
 * Solo decide qué se muestra: la autorización real la aplican @PreAuthorize y RLS en el backend.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  readonly permissions = computed(() => new Set(this.auth.user()?.permissions ?? []));

  /** `true` si el usuario tiene el permiso o, con una lista, cualquiera de ellos. */
  can(required: PermissionRequirement | null | undefined): boolean {
    return hasPermission(this.permissions(), required);
  }

  /** `true` solo si el usuario tiene todos los permisos indicados. */
  canAll(required: readonly string[]): boolean {
    const granted = this.permissions();
    return required.every((code) => granted.has(code));
  }
}
