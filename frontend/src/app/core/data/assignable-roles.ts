/**
 * "Superadmin"/"Superadministrador" name the platform account, and the server refuses to grant them to tenant
 * users. Do not offer them, except when the user already holds one (so it can be kept or removed).
 */
export function assignableRoles<T extends { id: number; name: string }>(roles: T[], currentIds: number[]): T[] {
  return roles.filter((role) => !/^superadmin/i.test(role.name) || currentIds.includes(role.id));
}
