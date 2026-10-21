/** Permission codes that grant access to the audit log, matching the backend @PreAuthorize. Kept free of Angular so node --test can load it. */
export const AUDIT_READ_PERMISSIONS = ['audit:read_tenant', 'audit:read_global'] as const;

export interface AuditAccessUser {
  platformAdmin?: boolean;
  permissions?: readonly string[];
}

/** Access follows the user's permissions (B3), not fixed role names, so custom groups work too. */
export function canReadAuditLog(user: AuditAccessUser | null | undefined): boolean {
  if (!user) return false;
  return user.platformAdmin === true || AUDIT_READ_PERMISSIONS.some((code) => user.permissions?.includes(code) === true);
}
