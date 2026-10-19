import { isPermissionKey, type PermissionKey } from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import { insertAuditEvent, listAuditEvents } from '../../core/audit'
import { conflict, forbidden, invalidInput, notFound } from '../../core/errors'
import { resolvePermissions } from '../../core/permissions'
import { inTransaction } from '../../core/transaction'
import type { Actor } from './actor'
import type { HistoryEvent } from './users'
import {
  findRoleById,
  insertCustomRole,
  listRoles,
  replaceRolePermissions,
  updateRoleName,
} from './repository'

export type RoleView = {
  id: number
  name: string
  isProtected: boolean
  version: number
  permissions: PermissionKey[]
}

function toRoleView(
  db: DatabaseSync,
  row: { id: number; name: string; isProtected: number; version: number },
): RoleView {
  const role = {
    id: row.id,
    name: row.name,
    isProtected: row.isProtected === 1,
  }
  return {
    ...role,
    version: row.version,
    permissions: resolvePermissions(db, role),
  }
}

export function listRoleViews(db: DatabaseSync): RoleView[] {
  return listRoles(db).map((row) => toRoleView(db, row))
}

export function listAssignableRoles(
  db: DatabaseSync,
  actor: Actor,
): RoleView[] {
  const roles = listRoleViews(db)
  return actor.permissions.includes('roles.gestionar')
    ? roles
    : roles.filter((role) => !role.isProtected)
}

function normalizeName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 100) {
    throw invalidInput('El nombre del rol debe tener entre 1 y 100 caracteres.')
  }
  return trimmed
}

function assertNameAvailable(
  db: DatabaseSync,
  name: string,
  exceptRoleId?: number,
): void {
  const existing = listRoles(db).find(
    (role) => role.name === name && role.id !== exceptRoleId,
  )
  if (existing) {
    throw conflict('Ya existe un rol con ese nombre.')
  }
}

function auditRole(
  db: DatabaseSync,
  actor: Actor,
  action: string,
  roleId: number,
  now: Date,
  before?: unknown,
  after?: unknown,
): void {
  insertAuditEvent(
    db,
    {
      actorAccountId: actor.id,
      actorUsername: actor.username,
      channel: 'app',
      module: 'identity',
      entityType: 'role',
      entityId: String(roleId),
      action,
      before,
      after,
    },
    now.toISOString(),
  )
}

export function createRole(
  db: DatabaseSync,
  actor: Actor,
  input: { name: string; now: Date },
): RoleView {
  const name = normalizeName(input.name)
  assertNameAvailable(db, name)
  const timestamp = input.now.toISOString()

  return inTransaction(db, () => {
    const roleId = insertCustomRole(db, { name, now: timestamp })
    auditRole(db, actor, 'role.created', roleId, input.now, undefined, { name })
    return toRoleView(db, findRoleById(db, roleId)!)
  })
}

export function renameRole(
  db: DatabaseSync,
  actor: Actor,
  roleId: number,
  input: { name: string; version: number; now: Date },
): RoleView {
  const role = findRoleById(db, roleId)
  if (!role) {
    throw notFound('El rol no existe.')
  }
  if (role.isProtected === 1) {
    throw forbidden('El rol Administrador no se puede renombrar.')
  }

  const name = normalizeName(input.name)
  assertNameAvailable(db, name, roleId)
  const before = { name: role.name }

  return inTransaction(db, () => {
    const updated = updateRoleName(db, {
      roleId,
      name,
      expectedVersion: input.version,
      now: input.now.toISOString(),
    })
    if (!updated) {
      throw conflict()
    }

    auditRole(db, actor, 'role.renamed', roleId, input.now, before, { name })
    return toRoleView(db, findRoleById(db, roleId)!)
  })
}

export function setRolePermissions(
  db: DatabaseSync,
  actor: Actor,
  roleId: number,
  input: { permissions: string[]; now: Date },
): RoleView {
  const role = findRoleById(db, roleId)
  if (!role) {
    throw notFound('El rol no existe.')
  }
  if (role.isProtected === 1) {
    throw forbidden('Los permisos del rol Administrador no se editan.')
  }

  const unique = new Set<string>()
  for (const permission of input.permissions) {
    if (!isPermissionKey(permission)) {
      throw invalidInput(`Permiso desconocido: ${permission}`)
    }
    unique.add(permission)
  }

  const permissions = [...unique] as PermissionKey[]
  const before = {
    permissions: resolvePermissions(db, {
      id: role.id,
      name: role.name,
      isProtected: false,
    }),
  }

  return inTransaction(db, () => {
    replaceRolePermissions(db, roleId, permissions)
    auditRole(
      db,
      actor,
      'role.permissions_changed',
      roleId,
      input.now,
      before,
      { permissions },
    )
    return toRoleView(db, findRoleById(db, roleId)!)
  })
}

export function listRoleHistory(
  db: DatabaseSync,
  roleId: number,
): HistoryEvent[] {
  return listAuditEvents(db, 'role', String(roleId)).map((row) => ({
    occurredAt: row.occurred_at,
    actorUsername: row.actor_username,
    channel: row.channel,
    action: row.action,
    before: row.before_json === null ? null : JSON.parse(row.before_json),
    after: row.after_json === null ? null : JSON.parse(row.after_json),
  }))
}
