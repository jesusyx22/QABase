import type { DatabaseSync } from 'node:sqlite'

export type SessionRow = {
  id: string
  accountId: number | null
  csrfToken: string
  createdAt: string
  expiresAt: string
}

const SESSION_COLUMNS = `
  id,
  account_id AS accountId,
  csrf_token AS csrfToken,
  created_at AS createdAt,
  expires_at AS expiresAt
`

export function insertSession(
  db: DatabaseSync,
  session: SessionRow,
): void {
  db.prepare(
    `INSERT INTO sessions (id, account_id, csrf_token, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    session.id,
    session.accountId,
    session.csrfToken,
    session.createdAt,
    session.expiresAt,
  )
}

export function findSessionById(
  db: DatabaseSync,
  sessionId: string,
): SessionRow | null {
  return (
    (db
      .prepare(`SELECT ${SESSION_COLUMNS} FROM sessions WHERE id = ?`)
      .get(sessionId) as SessionRow | undefined) ?? null
  )
}

export function deleteSession(db: DatabaseSync, sessionId: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
}

export function deleteSessionsForAccount(
  db: DatabaseSync,
  accountId: number,
  exceptSessionId?: string,
): void {
  if (exceptSessionId === undefined) {
    db.prepare('DELETE FROM sessions WHERE account_id = ?').run(accountId)
    return
  }

  db.prepare('DELETE FROM sessions WHERE account_id = ? AND id <> ?').run(
    accountId,
    exceptSessionId,
  )
}

export function deleteExpiredSessions(
  db: DatabaseSync,
  now: Date,
): void {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(
    now.toISOString(),
  )
}
