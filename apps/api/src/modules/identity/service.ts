import {
  isValidPassword,
  isValidUsername,
  normalizeUsername,
} from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import { insertAuditEvent } from '../../core/audit'
import { conflict, invalidInput, unauthenticated } from '../../core/errors'
import type { PasswordHasher } from '../../core/security/password'
import {
  deleteSessionsForAccount,
} from '../../core/sessions/repository'
import { inTransaction } from '../../core/transaction'
import {
  countActiveAdmins,
  findAccountByNormalizedUsername,
  findProtectedRole,
  insertAccount,
  updateAccountPassword,
  type AccountRow,
} from './repository'

export type IdentityServiceDeps = {
  db: DatabaseSync
  hasher: PasswordHasher
}

export function setupRequired(db: DatabaseSync): boolean {
  return countActiveAdmins(db) === 0
}

/**
 * Verificación de credenciales (BE-18). Un usuario inexistente o inactivo
 * se compara contra el hash señuelo; el error es siempre el mismo.
 */
export async function authenticate(
  deps: IdentityServiceDeps & { decoyHash: string },
  input: { username: string; password: string },
): Promise<AccountRow> {
  const normalized = normalizeUsername(input.username)
  const account = findAccountByNormalizedUsername(deps.db, normalized)

  if (!account || account.isActive !== 1) {
    await deps.hasher.verify(deps.decoyHash, input.password)
    throw unauthenticated()
  }

  const valid = await deps.hasher.verify(account.passwordHash, input.password)
  if (!valid) {
    throw unauthenticated()
  }

  return account
}

export async function createFirstAdmin(
  deps: IdentityServiceDeps,
  input: { username: string; password: string; now: Date },
): Promise<number> {
  if (!isValidUsername(input.username)) {
    throw invalidInput(
      'El usuario debe tener entre 3 y 64 caracteres y solo letras ASCII, números, punto, guion o guion bajo.',
    )
  }
  if (!isValidPassword(input.password)) {
    throw invalidInput('La contraseña debe tener entre 12 y 128 caracteres.')
  }

  const passwordHash = await deps.hasher.hash(input.password)
  const timestamp = input.now.toISOString()

  return inTransaction(deps.db, () => {
    if (countActiveAdmins(deps.db) > 0) {
      throw conflict('Ya existe una cuenta administradora activa.')
    }

    const role = findProtectedRole(deps.db)
    if (!role) {
      throw new Error('No existe el rol Administrador. Revisa los seeds.')
    }

    const accountId = insertAccount(deps.db, {
      username: input.username,
      usernameNormalized: normalizeUsername(input.username),
      passwordHash,
      roleId: role.id,
      now: timestamp,
    })

    insertAuditEvent(
      deps.db,
      {
        actorAccountId: null,
        actorUsername: null,
        channel: 'local',
        module: 'identity',
        entityType: 'account',
        entityId: String(accountId),
        action: 'account.created',
        after: {
          username: input.username,
          roleId: role.id,
          roleName: role.name,
          isActive: true,
        },
      },
      timestamp,
    )

    return accountId
  })
}

export async function changeOwnPassword(
  deps: IdentityServiceDeps,
  input: {
    account: AccountRow
    currentPassword: string
    newPassword: string
    sessionId: string
    now: Date
  },
): Promise<void> {
  if (!isValidPassword(input.newPassword)) {
    throw invalidInput('La contraseña debe tener entre 12 y 128 caracteres.')
  }

  const currentValid = await deps.hasher.verify(
    input.account.passwordHash,
    input.currentPassword,
  )
  if (!currentValid) {
    throw invalidInput('La contraseña actual no es correcta.')
  }

  const passwordHash = await deps.hasher.hash(input.newPassword)
  const timestamp = input.now.toISOString()

  inTransaction(deps.db, () => {
    const updated = updateAccountPassword(deps.db, {
      accountId: input.account.id,
      passwordHash,
      expectedVersion: input.account.version,
      now: timestamp,
    })
    if (!updated) {
      throw conflict()
    }

    deleteSessionsForAccount(deps.db, input.account.id, input.sessionId)

    insertAuditEvent(
      deps.db,
      {
        actorAccountId: input.account.id,
        actorUsername: input.account.username,
        channel: 'app',
        module: 'identity',
        entityType: 'account',
        entityId: String(input.account.id),
        action: 'account.password_changed',
      },
      timestamp,
    )
  })
}

export function findAdminForLocalReset(
  db: DatabaseSync,
  username: string,
): AccountRow {
  const account = findAccountByNormalizedUsername(
    db,
    normalizeUsername(username),
  )
  if (!account || account.roleIsProtected !== 1) {
    throw invalidInput(
      'La cuenta no existe o no tiene el rol Administrador protegido.',
    )
  }
  return account
}

export async function resetAdminPasswordLocal(
  deps: IdentityServiceDeps,
  input: { account: AccountRow; newPassword: string; now: Date },
): Promise<void> {
  if (!isValidPassword(input.newPassword)) {
    throw invalidInput('La contraseña debe tener entre 12 y 128 caracteres.')
  }

  const passwordHash = await deps.hasher.hash(input.newPassword)
  const timestamp = input.now.toISOString()

  inTransaction(deps.db, () => {
    const updated = updateAccountPassword(deps.db, {
      accountId: input.account.id,
      passwordHash,
      expectedVersion: input.account.version,
      now: timestamp,
    })
    if (!updated) {
      throw conflict()
    }

    deleteSessionsForAccount(deps.db, input.account.id)

    insertAuditEvent(
      deps.db,
      {
        actorAccountId: null,
        actorUsername: null,
        channel: 'local',
        module: 'identity',
        entityType: 'account',
        entityId: String(input.account.id),
        action: 'account.password_reset_local',
      },
      timestamp,
    )
  })
}
