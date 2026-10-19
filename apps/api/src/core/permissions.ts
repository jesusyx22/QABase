import { PERMISSION_KEYS, type PermissionKey } from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'

export type Role = {
  id: number
  name: string
  isProtected: boolean
}

/**
 * El rol protegido recibe todas las claves conocidas, incluidas las futuras
 * (PERM-04, RN-ID-64). Los demás roles se resuelven sin caché (PERM-13).
 * Una clave fuera del registro canónico no concede nada.
 */
export function resolvePermissions(
  db: DatabaseSync,
  role: Role,
): PermissionKey[] {
  if (role.isProtected) {
    return [...PERMISSION_KEYS]
  }

  const rows = db
    .prepare('SELECT permission_key FROM role_permissions WHERE role_id = ?')
    .all(role.id) as Array<{ permission_key: string }>

  const granted = new Set(rows.map((row) => row.permission_key))
  return PERMISSION_KEYS.filter((key) => granted.has(key))
}

export function hasPermission(
  permissions: readonly PermissionKey[],
  required: PermissionKey,
): boolean {
  return permissions.includes(required)
}
