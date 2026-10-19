import { escapeLikePattern, normalizeSearchText } from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'

export type AccountRow = {
  id: number
  username: string
  usernameNormalized: string
  passwordHash: string
  roleId: number
  roleName: string
  roleIsProtected: number
  isActive: number
  version: number
  createdAt: string
  updatedAt: string
}

const ACCOUNT_COLUMNS = `
  a.id,
  a.username,
  a.username_normalized AS usernameNormalized,
  a.password_hash AS passwordHash,
  a.role_id AS roleId,
  r.name AS roleName,
  r.is_protected AS roleIsProtected,
  a.is_active AS isActive,
  a.version,
  a.created_at AS createdAt,
  a.updated_at AS updatedAt
`

export function findAccountByNormalizedUsername(
  db: DatabaseSync,
  usernameNormalized: string,
): AccountRow | null {
  return (
    (db
      .prepare(
        `SELECT ${ACCOUNT_COLUMNS}
           FROM accounts a
           JOIN roles r ON r.id = a.role_id
          WHERE a.username_normalized = ?`,
      )
      .get(usernameNormalized) as AccountRow | undefined) ?? null
  )
}

export function findAccountById(
  db: DatabaseSync,
  accountId: number,
): AccountRow | null {
  return (
    (db
      .prepare(
        `SELECT ${ACCOUNT_COLUMNS}
           FROM accounts a
           JOIN roles r ON r.id = a.role_id
          WHERE a.id = ?`,
      )
      .get(accountId) as AccountRow | undefined) ?? null
  )
}

export function countActiveAdmins(db: DatabaseSync): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total
         FROM accounts a
         JOIN roles r ON r.id = a.role_id
        WHERE r.is_protected = 1 AND a.is_active = 1`,
    )
    .get() as { total: number }
  return row.total
}

export function findProtectedRole(
  db: DatabaseSync,
): { id: number; name: string } | null {
  return (
    (db
      .prepare('SELECT id, name FROM roles WHERE is_protected = 1')
      .get() as { id: number; name: string } | undefined) ?? null
  )
}

export function findRoleBySeedKey(
  db: DatabaseSync,
  seedKey: string,
): { id: number; name: string; isProtected: number } | null {
  return (
    (db
      .prepare(
        'SELECT id, name, is_protected AS isProtected FROM roles WHERE seed_key = ?',
      )
      .get(seedKey) as
      | { id: number; name: string; isProtected: number }
      | undefined) ?? null
  )
}

export function insertAccount(
  db: DatabaseSync,
  input: {
    username: string
    usernameNormalized: string
    passwordHash: string
    roleId: number
    now: string
  },
): number {
  const result = db
    .prepare(
      `INSERT INTO accounts
        (username, username_normalized, password_hash, role_id, is_active,
         version, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, 1, ?, ?)`,
    )
    .run(
      input.username,
      input.usernameNormalized,
      input.passwordHash,
      input.roleId,
      input.now,
      input.now,
    )

  return Number(result.lastInsertRowid)
}

/**
 * Actualiza el hash con control optimista. Devuelve false si la versión no
 * coincide.
 */
export function updateAccountPassword(
  db: DatabaseSync,
  input: {
    accountId: number
    passwordHash: string
    expectedVersion: number
    now: string
  },
): boolean {
  const result = db
    .prepare(
      `UPDATE accounts
          SET password_hash = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?`,
    )
    .run(
      input.passwordHash,
      input.now,
      input.accountId,
      input.expectedVersion,
    )
  return Number(result.changes) === 1
}

export function insertSeedRole(
  db: DatabaseSync,
  input: {
    name: string
    seedKey: string
    isProtected: boolean
    now: string
  },
): void {
  db.prepare(
    `INSERT OR IGNORE INTO roles
      (name, seed_key, is_protected, version, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?)`,
  ).run(
    input.name,
    input.seedKey,
    input.isProtected ? 1 : 0,
    input.now,
    input.now,
  )
}

export function insertSeedRolePermission(
  db: DatabaseSync,
  roleId: number,
  permissionKey: string,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO role_permissions (role_id, permission_key)
     VALUES (?, ?)`,
  ).run(roleId, permissionKey)
}

export function listAccounts(
  db: DatabaseSync,
  input: { includeInactive: boolean; search: string },
): AccountRow[] {
  const search = input.search.trim()
  const pattern = `%${escapeLikePattern(normalizeSearchText(search))}%`

  return db
    .prepare(
      `SELECT ${ACCOUNT_COLUMNS}
         FROM accounts a
         JOIN roles r ON r.id = a.role_id
        WHERE (? = 1 OR a.is_active = 1)
          AND (? = '' OR a.username_normalized LIKE ? ESCAPE '\\')
        ORDER BY a.username_normalized ASC, a.id ASC`,
    )
    .all(
      input.includeInactive ? 1 : 0,
      search === '' ? '' : pattern,
      pattern,
    ) as AccountRow[]
}

export function findRoleById(
  db: DatabaseSync,
  roleId: number,
): { id: number; name: string; isProtected: number; version: number } | null {
  return (
    (db
      .prepare(
        `SELECT id, name, is_protected AS isProtected, version
           FROM roles WHERE id = ?`,
      )
      .get(roleId) as
      | { id: number; name: string; isProtected: number; version: number }
      | undefined) ?? null
  )
}

export function listRoles(
  db: DatabaseSync,
): Array<{
  id: number
  name: string
  isProtected: number
  version: number
}> {
  return db
    .prepare(
      `SELECT id, name, is_protected AS isProtected, version
         FROM roles ORDER BY name ASC, id ASC`,
    )
    .all() as Array<{
    id: number
    name: string
    isProtected: number
    version: number
  }>
}

export function insertCustomRole(
  db: DatabaseSync,
  input: { name: string; now: string },
): number {
  const result = db
    .prepare(
      `INSERT INTO roles
        (name, seed_key, is_protected, version, created_at, updated_at)
       VALUES (?, NULL, 0, 1, ?, ?)`,
    )
    .run(input.name, input.now, input.now)
  return Number(result.lastInsertRowid)
}

export function updateRoleName(
  db: DatabaseSync,
  input: { roleId: number; name: string; expectedVersion: number; now: string },
): boolean {
  const result = db
    .prepare(
      `UPDATE roles SET name = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?`,
    )
    .run(input.name, input.now, input.roleId, input.expectedVersion)
  return Number(result.changes) === 1
}

export function replaceRolePermissions(
  db: DatabaseSync,
  roleId: number,
  permissionKeys: readonly string[],
): void {
  db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId)
  const insert = db.prepare(
    'INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)',
  )
  for (const permissionKey of permissionKeys) {
    insert.run(roleId, permissionKey)
  }
}

export function countActiveAdminsExcluding(
  db: DatabaseSync,
  accountId: number,
): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total
         FROM accounts a
         JOIN roles r ON r.id = a.role_id
        WHERE r.is_protected = 1 AND a.is_active = 1 AND a.id <> ?`,
    )
    .get(accountId) as { total: number }
  return row.total
}

export function updateAccount(
  db: DatabaseSync,
  input: {
    accountId: number
    username?: string
    usernameNormalized?: string
    roleId?: number
    isActive?: boolean
    expectedVersion: number
    now: string
  },
): boolean {
  const sets: string[] = []
  const values: Array<string | number> = []

  if (input.username !== undefined && input.usernameNormalized !== undefined) {
    sets.push('username = ?', 'username_normalized = ?')
    values.push(input.username, input.usernameNormalized)
  }
  if (input.roleId !== undefined) {
    sets.push('role_id = ?')
    values.push(input.roleId)
  }
  if (input.isActive !== undefined) {
    sets.push('is_active = ?')
    values.push(input.isActive ? 1 : 0)
  }

  sets.push('version = version + 1', 'updated_at = ?')
  values.push(input.now, input.accountId, input.expectedVersion)

  const result = db
    .prepare(
      `UPDATE accounts SET ${sets.join(', ')}
        WHERE id = ? AND version = ?`,
    )
    .run(...values)
  return Number(result.changes) === 1
}
