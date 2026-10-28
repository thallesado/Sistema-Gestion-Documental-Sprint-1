/**
 * Reglas puras de permisos por función (sin dependencias de Angular para poder probarlas con node --test).
 *
 * Un requisito puede ser un código (`document:read`) o una lista de códigos; con una lista basta
 * con tener cualquiera de ellos, igual que `hasAnyAuthority(...)` en el backend.
 * Un requisito ausente no restringe nada.
 */
export type PermissionRequirement = string | readonly string[];

/**
 * Administrador del tenant para suscripción, planes, precios y pagos.
 * Coincide con `PlanController.TENANT_PLAN_ADMIN` en el backend.
 */
export const TENANT_PLAN_ADMIN: readonly string[] = ['tenant:update', 'tenant:manage'];

export function hasPermission(
  granted: Iterable<string> | null | undefined,
  required: PermissionRequirement | null | undefined,
): boolean {
  if (required == null) return true;
  const codes = typeof required === 'string' ? [required] : required;
  if (codes.length === 0) return true;
  const grantedSet = granted instanceof Set ? granted as Set<string> : new Set(granted ?? []);
  return codes.some((code) => grantedSet.has(code));
}

/**
 * Pantalla de inicio personalizada (user:customize) si el usuario puede abrirla; si no, null.
 * `routes` son las entradas de menú con su permiso efectivo (navigationRoutes).
 */
export function permittedLandingPage(
  landingPage: string | null | undefined,
  granted: Iterable<string> | null | undefined,
  routes: ReadonlyArray<{ href: string; permission?: PermissionRequirement }>,
): string | null {
  if (!landingPage || landingPage === '/') return null;
  const route = routes.find((entry) => entry.href === landingPage);
  return route && hasPermission(granted, route.permission) ? landingPage : null;
}

/** Tipos documentales que el usuario puede usar al crear; sin lista personalizada, todos. */
export function allowedDocumentTypes<T extends { id: string }>(
  types: readonly T[],
  allowedIds: readonly string[] | null | undefined,
): T[] {
  if (!allowedIds?.length) return [...types];
  const allowed = new Set(allowedIds);
  return types.filter((type) => allowed.has(type.id));
}

type PermissionGated = { permission?: PermissionRequirement };
type GatedNavItem<C extends PermissionGated> = PermissionGated & { children: C[] };

/** Hijos de una entrada de menú que el usuario puede ver: los suyos propios y los heredados del padre. */
export function permittedChildren<C extends PermissionGated>(
  item: GatedNavItem<C>,
  granted: Iterable<string> | null | undefined,
): C[] {
  const grantedSet = new Set(granted ?? []);
  if (!hasPermission(grantedSet, item.permission)) return [];
  return item.children.filter((child) => hasPermission(grantedSet, child.permission));
}
