import type { DatabaseSync } from 'node:sqlite'

export type AuditChannel = 'app' | 'local'

export type AuditEventInput = {
  actorAccountId: number | null
  actorUsername: string | null
  channel: AuditChannel
  module: string
  entityType: string
  entityId: string
  action: string
  before?: unknown
  after?: unknown
}

/**
 * Auditoría append-only (BD-32). Este módulo no expone actualización ni
 * borrado. Los llamadores no deben incluir contraseñas, hashes ni secretos
 * en los snapshots (BD-35).
 */
export function insertAuditEvent(
  db: DatabaseSync,
  event: AuditEventInput,
  occurredAt: string,
): void {
  db.prepare(
    `INSERT INTO audit_events
      (occurred_at, actor_account_id, actor_username, channel, module,
       entity_type, entity_id, action, before_json, after_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    occurredAt,
    event.actorAccountId,
    event.actorUsername,
    event.channel,
    event.module,
    event.entityType,
    event.entityId,
    event.action,
    event.before === undefined ? null : JSON.stringify(event.before),
    event.after === undefined ? null : JSON.stringify(event.after),
  )
}

export type AuditEventRow = {
  id: number
  occurred_at: string
  actor_account_id: number | null
  actor_username: string | null
  channel: AuditChannel
  module: string
  entity_type: string
  entity_id: string
  action: string
  before_json: string | null
  after_json: string | null
}

export function listAuditEvents(
  db: DatabaseSync,
  entityType: string,
  entityId: string,
): AuditEventRow[] {
  return db
    .prepare(
      `SELECT id, occurred_at, actor_account_id, actor_username, channel,
              module, entity_type, entity_id, action, before_json, after_json
         FROM audit_events
        WHERE entity_type = ? AND entity_id = ?
        ORDER BY occurred_at ASC, id ASC`,
    )
    .all(entityType, entityId) as AuditEventRow[]
}
