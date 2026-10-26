/**
 * Platform administrators sign in without a tenant, so tenant-only endpoints
 * (dashboard, backup maintenance, billing revenue per tenant...) answer 403 for them.
 * Callers use this to skip those requests instead of triggering a permission error.
 */
export function isPlatformSession(user: { platformAdmin?: boolean; tenantId?: string | null } | null | undefined): boolean {
  return user?.platformAdmin === true && !user.tenantId;
}

/**
 * Tenant-only requests are skipped for platform sessions and while the person still has a temporary
 * password: the backend answers 403 MUST_CHANGE_PASSWORD to everything except the password change.
 */
export function mustSkipTenantRequests(
  user: { platformAdmin?: boolean; tenantId?: string | null } | null | undefined,
  mustChangePassword: boolean,
): boolean {
  return mustChangePassword || isPlatformSession(user);
}

const RAW_DB_ERROR = /^\s*ERROR:|SQLException|PSQLException|org\.hibernate|org\.postgresql|could not execute statement|violates (?:foreign key|unique|not-null|check) constraint|duplicate key value|JDBC|SQLState|relation ".*" does not exist/i;

export const GENERIC_ERROR_MESSAGE = 'No se pudo completar la operación. Inténtalo de nuevo o contacta a tu administrador.';

/**
 * Returns the server message only when it is safe to show; database or Hibernate text
 * (typically "ERROR: ..." from PostgreSQL) is replaced by a friendly generic message.
 */
export function friendlyApiMessage(message: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  if (typeof message !== 'string' || !message.trim()) return fallback;
  return RAW_DB_ERROR.test(message) ? fallback : message;
}
