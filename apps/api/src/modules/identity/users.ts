import {
  isValidPassword,
  isValidUsername,
  normalizeUsername,
  type PermissionKey,
} from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import { insertAuditEvent, listAuditEvents } from '../../core/audit'
import { conflict, forbidden, invalidInput, notFound } from '../../core/errors'
import type { PasswordHasher } from '../../core/security/password'
import { deleteSessionsForAccount } from '../../core/sessions/repository'
import { inTransaction } from '../../core/transaction'
import type { Actor } from './actor'
import {
  countActiveAdminsExcluding,
  findAccountById,
  findAccountByNormalizedUsername,
  findRoleById,
  insertAccount,
  listAccounts,
  updateAccount,
  updateAccountPassword,
  type AccountRow,
} from './repository'

export type User = {
  id: number
  username: string
  role: { id: number; name: string; isProtected: boolean }
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export type HistoryEvent = {
  occurredAt: string
  actorUsername: string | null
  channel: 'app' | 'local'
  action: string
  before: unknown
  after: unknown
}

export function toUser(row: AccountRow): User {
  return {
    id: row.id,
    username: row.username,
    role: {
      id: row.roleId,
      name: row.roleName,
      isProtected: row.roleIsProtected === 1,
    },
    isActive: row.isActive === 1,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export function listUsers(
  db: DatabaseSync,
  input: { includeInactive: boolean; search: string },
): User[] {
  return listAccounts(db, input).map(toUser)
}

function requireRolesPermission(actor: Actor): void {
  if (!actor.permissions.includes('roles.gestionar')) {
    throw forbidden('Gestionar cuentas con rol Administrador exige gestionar roles.')
  }
}

function assertCanAssignRole(actor: Actor, roleIsProtected: boolean): void {
  if (roleIsProtected) {
    requireRolesPermission(actor)
  }
}

function audit(
  db: DatabaseSync,
  actor: Actor,
  action: string,
  accountId: number,
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
      entityType: 'account',
      entityId: String(accountId),
      action,
      before,
      after,
    },
    now.toISOString(),
  )
}

export async function createUser(
  deps: { db: DatabaseSync; hasher: PasswordHasher },
  actor: Actor,
  input: { username: string; password: string; roleId: number; now: Date },
): Promise<User> {
  if (!isValidUsername(input.username)) {
    throw invalidInput(
      'El usuario debe tener entre 3 y 64 caracteres y solo letras ASCII, números, punto, guion o guion bajo.',
    )
  }
  if (!isValidPassword(input.password)) {
    throw invalidInput('La contraseña debe tener entre 12 y 128 caracteres.')
  }

  const role = findRoleById(deps.db, input.roleId)
  if (!role) {
    throw invalidInput('El rol seleccionado no existe.')
  }
  assertCanAssignRole(actor, role.isProtected === 1)

  const normalized = normalizeUsername(input.username)
  if (findAccountByNormalizedUsername(deps.db, normalized)) {
    throw conflict('Ya existe una cuenta con ese nombre de usuario.')
  }

  const passwordHash = await deps.hasher.hash(input.password)
  const timestamp = input.now.toISOString()

  return inTransaction(deps.db, () => {
    const accountId = insertAccount(deps.db, {
      username: input.username,
      usernameNormalized: normalized,
      passwordHash,
      roleId: role.id,
      now: timestamp,
    })

    audit(deps.db, actor, 'account.created', accountId, input.now, undefined, {
      username: input.username,
      roleId: role.id,
      roleName: role.name,
      isActive: true,
    })

    return toUser(findAccountById(deps.db, accountId)!)
  })
}

export async function updateUser(
  deps: { db: DatabaseSync },
  actor: Actor,
  targetId: number,
  input: {
    username?: string
    roleId?: number
    isActive?: boolean
    version: number
    now: Date
  },
): Promise<User> {
  const target = findAccountById(deps.db, targetId)
  if (!target) {
    throw notFound('La cuenta no existe.')
  }

  if (target.roleIsProtected === 1) {
    requireRolesPermission(actor)
  }

  if (
    input.username === undefined &&
    input.roleId === undefined &&
    input.isActive === undefined
  ) {
    throw invalidInput('No hay cambios para guardar.')
  }

  let username = target.username
  let usernameNormalized = target.usernameNormalized
  if (input.username !== undefined) {
    if (!isValidUsername(input.username)) {
      throw invalidInput(
        'El usuario debe tener entre 3 y 64 caracteres y solo letras ASCII, números, punto, guion o guion bajo.',
      )
    }
    const normalized = normalizeUsername(input.username)
    const existing = findAccountByNormalizedUsername(deps.db, normalized)
    if (existing && existing.id !== target.id) {
      throw conflict('Ya existe una cuenta con ese nombre de usuario.')
    }
    username = input.username
    usernameNormalized = normalized
  }

  let roleId = target.roleId
  if (input.roleId !== undefined) {
    const role = findRoleById(deps.db, input.roleId)
    if (!role) {
      throw invalidInput('El rol seleccionado no existe.')
    }
    assertCanAssignRole(actor, role.isProtected === 1)
    roleId = role.id
  }

  if (input.isActive === false && target.id === actor.id) {
    throw conflict('No puedes desactivar tu propia cuenta.')
  }

  const targetIsActiveAdmin =
    target.roleIsProtected === 1 && target.isActive === 1
  const leavesAdminRole = roleId !== target.roleId
  const isDeactivation = input.isActive === false

  if (
    targetIsActiveAdmin &&
    (leavesAdminRole || isDeactivation) &&
    countActiveAdminsExcluding(deps.db, target.id) === 0
  ) {
    throw conflict('Debe quedar al menos un administrador activo.')
  }

  const before = {
    username: target.username,
    roleId: target.roleId,
    roleName: target.roleName,
    isActive: target.isActive === 1,
  }

  return inTransaction(deps.db, () => {
    const updated = updateAccount(deps.db, {
      accountId: target.id,
      username,
      usernameNormalized,
      roleId,
      isActive: input.isActive,
      expectedVersion: input.version,
      now: input.now.toISOString(),
    })
    if (!updated) {
      throw conflict()
    }

    const result = findAccountById(deps.db, target.id)!
    audit(deps.db, actor, 'account.updated', target.id, input.now, before, {
      username: result.username,
      roleId: result.roleId,
      roleName: result.roleName,
      isActive: result.isActive === 1,
    })

    return toUser(result)
  })
}

export async function resetUserPassword(
  deps: { db: DatabaseSync; hasher: PasswordHasher },
  actor: Actor,
  targetId: number,
  input: { newPassword: string; now: Date },
): Promise<void> {
  const target = findAccountById(deps.db, targetId)
  if (!target) {
    throw notFound('La cuenta no existe.')
  }
  if (target.roleIsProtected === 1) {
    requireRolesPermission(actor)
  }
  if (!isValidPassword(input.newPassword)) {
    throw invalidInput('La contraseña debe tener entre 12 y 128 caracteres.')
  }

  const passwordHash = await deps.hasher.hash(input.newPassword)
  const timestamp = input.now.toISOString()

  inTransaction(deps.db, () => {
    const updated = updateAccountPassword(deps.db, {
      accountId: target.id,
      passwordHash,
      expectedVersion: target.version,
      now: timestamp,
    })
    if (!updated) {
      throw conflict()
    }
    deleteSessionsForAccount(deps.db, target.id)
    audit(deps.db, actor, 'account.password_reset', target.id, input.now)
  })
}

export function listAccountHistory(
  db: DatabaseSync,
  accountId: number,
): HistoryEvent[] {
  return listAuditEvents(db, 'account', String(accountId)).map((row) => ({
    occurredAt: row.occurred_at,
    actorUsername: row.actor_username,
    channel: row.channel,
    action: row.action,
    before: row.before_json === null ? null : JSON.parse(row.before_json),
    after: row.after_json === null ? null : JSON.parse(row.after_json),
  }))
}

export function hasPermission(
  actor: Actor,
  permission: PermissionKey,
): boolean {
  return actor.permissions.includes(permission)
}
