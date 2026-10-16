// Pure permission checks used by PermissionService. `null` means the permissions
// have not been loaded yet, which is treated as "nothing is granted".

export function hasPermission(granted: readonly string[] | null, required: string): boolean {
  return granted !== null && granted.includes(required);
}

export function hasAnyPermission(granted: readonly string[] | null, required: readonly string[]): boolean {
  return required.some((permission) => hasPermission(granted, permission));
}
