import type { PermissionKey } from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import { inTransaction } from '../transaction'
import { resolvePermissions, type Role } from '../permissions'
import { isSessionExpired, newCsrfToken, newSessionId, sessionExpiresAt } from '../security/session'
import {
  findAccountById,
  type AccountRow,
} from '../../modules/identity/repository'
import {
  deleteExpiredSessions,
  deleteSession,
  findSessionById,
  insertSession,
  type SessionRow,
} from './repository'

export type AuthenticatedSession = {
  session: SessionRow
  account: AccountRow
  role: Role
  permissions: PermissionKey[]
}

export type ResolvedSession =
  | { kind: 'anonymous'; session: SessionRow }
  | ({ kind: 'authenticated' } & AuthenticatedSession)
  | null

function buildSession(accountId: number | null, now: Date): SessionRow {
  return {
    id: newSessionId(),
    accountId,
    csrfToken: newCsrfToken(),
    createdAt: now.toISOString(),
    expiresAt: sessionExpiresAt(now),
  }
}

function createSessionRow(
  db: DatabaseSync,
  accountId: number | null,
  now: Date,
  rotateFrom?: string,
): SessionRow {
  deleteExpiredSessions(db, now)
  if (rotateFrom !== undefined) {
    deleteSession(db, rotateFrom)
  }

  const session = buildSession(accountId, now)
  insertSession(db, session)
  return session
}

export function createAnonymousSession(
  db: DatabaseSync,
  now: Date,
): SessionRow {
  return inTransaction(db, () => createSessionRow(db, null, now))
}

/**
 * Rota el identificador al iniciar sesión (BE-13) y elimina la sesión
 * anónima anterior.
 */
export function createAuthenticatedSession(
  db: DatabaseSync,
  input: { accountId: number; now: Date; rotateFrom?: string },
): SessionRow {
  return inTransaction(db, () =>
    createSessionRow(db, input.accountId, input.now, input.rotateFrom),
  )
}

/**
 * Resuelve la sesión y sus permisos en cada petición (PERM-13). Una sesión
 * expirada, una cuenta inactiva o una firma inválida no devuelven contexto.
 */
export function resolveSession(
  db: DatabaseSync,
  sessionId: string,
  now: Date,
): ResolvedSession {
  const session = findSessionById(db, sessionId)
  if (!session) {
    return null
  }

  if (isSessionExpired(session.expiresAt, now)) {
    deleteSession(db, session.id)
    return null
  }

  if (session.accountId === null) {
    return { kind: 'anonymous', session }
  }

  const account = findAccountById(db, session.accountId)
  if (!account || account.isActive !== 1) {
    deleteSession(db, session.id)
    return null
  }

  const role: Role = {
    id: account.roleId,
    name: account.roleName,
    isProtected: account.roleIsProtected === 1,
  }

  return {
    kind: 'authenticated',
    session,
    account,
    role,
    permissions: resolvePermissions(db, role),
  }
}

export function authenticateSession(
  db: DatabaseSync,
  sessionId: string,
  now: Date,
): AuthenticatedSession | null {
  const resolved = resolveSession(db, sessionId, now)
  if (!resolved || resolved.kind !== 'authenticated') {
    return null
  }

  const { session, account, role, permissions } = resolved
  return { session, account, role, permissions }
}

export function invalidateSession(db: DatabaseSync, sessionId: string): void {
  deleteSession(db, sessionId)
}
