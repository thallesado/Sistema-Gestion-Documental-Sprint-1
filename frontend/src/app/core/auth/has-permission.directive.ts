import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { PermissionService } from './permission.service';
import { PermissionRequirement } from './permission-rules';

/**
 * Renderiza el contenido solo si el usuario tiene el permiso (o cualquiera de la lista):
 * `<button *appHasPermission="'role:create'">Crear grupo</button>`.
 */
@Directive({ selector: '[appHasPermission]' })
export class HasPermissionDirective {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private readonly permissions = inject(PermissionService);
  readonly appHasPermission = input.required<PermissionRequirement>();
  private rendered = false;

  constructor() {
    effect(() => {
      const allowed = this.permissions.can(this.appHasPermission());
      if (allowed && !this.rendered) {
        this.container.createEmbeddedView(this.template);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.container.clear();
        this.rendered = false;
      }
    });
  }
}
