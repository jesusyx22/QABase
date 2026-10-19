import { escapeLikePattern, normalizeSearchText } from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'

export type TicketRow = {
  id: number
  reference: string
  subject: string
  description: string | null
  status: string
  requester: string | null
  organization: string | null
  team: string | null
  analyst: string | null
  reportedAt: string | null
  createdAt: string
  lastSyncedAt: string
}

export type AttachmentRow = {
  id: number
  ticketId: number
  sourceId: string
  fileName: string
  contentType: string | null
  sizeBytes: number | null
  storagePath: string | null
}

const TICKET_COLUMNS = `
  id,
  reference,
  subject,
  description,
  status,
  requester,
  organization,
  team,
  analyst,
  reported_at AS reportedAt,
  created_at AS createdAt,
  last_imported_at AS lastSyncedAt
`

export function listTickets(
  db: DatabaseSync,
  search: string,
): TicketRow[] {
  const trimmed = normalizeSearchText(search.trim())
  const pattern = `%${escapeLikePattern(trimmed)}%`

  return db
    .prepare(
      `SELECT ${TICKET_COLUMNS}
         FROM helpdesk_tickets
        WHERE (? = ''
          OR normalize_text(reference) LIKE ? ESCAPE '\\'
          OR normalize_text(subject) LIKE ? ESCAPE '\\'
          OR normalize_text(COALESCE(analyst, '')) LIKE ? ESCAPE '\\')
        ORDER BY reported_at DESC, id DESC`,
    )
    .all(
      trimmed === '' ? '' : pattern,
      pattern,
      pattern,
      pattern,
    ) as TicketRow[]
}

export function findTicketById(
  db: DatabaseSync,
  ticketId: number,
): TicketRow | null {
  return (
    (db
      .prepare(`SELECT ${TICKET_COLUMNS} FROM helpdesk_tickets WHERE id = ?`)
      .get(ticketId) as TicketRow | undefined) ?? null
  )
}

export function ticketExists(db: DatabaseSync, reference: string): boolean {
  return (
    db
      .prepare('SELECT 1 FROM helpdesk_tickets WHERE reference = ?')
      .get(reference) !== undefined
  )
}

export function upsertTicket(
  db: DatabaseSync,
  input: {
    reference: string
    subject: string
    description: string | null
    status: string
    requester: string | null
    organization: string | null
    team: string | null
    analyst: string | null
    reportedAt: string
    now: string
  },
): void {
  db.prepare(
    `INSERT INTO helpdesk_tickets
      (reference, subject, description, status, requester, organization,
       team, analyst, reported_at, created_at, last_imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (reference) DO UPDATE SET
       subject = excluded.subject,
       description = excluded.description,
       status = excluded.status,
       requester = excluded.requester,
       organization = excluded.organization,
       team = excluded.team,
       analyst = excluded.analyst,
       reported_at = excluded.reported_at,
       last_imported_at = excluded.last_imported_at`,
  ).run(
    input.reference,
    input.subject,
    input.description,
    input.status,
    input.requester,
    input.organization,
    input.team,
    input.analyst,
    input.reportedAt,
    input.now,
    input.now,
  )
}

export function listAttachments(
  db: DatabaseSync,
  ticketId: number,
): AttachmentRow[] {
  return db
    .prepare(
      `SELECT id, ticket_id AS ticketId, source_id AS sourceId,
              file_name AS fileName, content_type AS contentType,
              size_bytes AS sizeBytes, storage_path AS storagePath
         FROM helpdesk_attachments
        WHERE ticket_id = ?
        ORDER BY file_name ASC, id ASC`,
    )
    .all(ticketId) as AttachmentRow[]
}

export function findAttachmentById(
  db: DatabaseSync,
  attachmentId: number,
): AttachmentRow | null {
  return (
    (db
      .prepare(
        `SELECT id, ticket_id AS ticketId, source_id AS sourceId,
                file_name AS fileName, content_type AS contentType,
                size_bytes AS sizeBytes, storage_path AS storagePath
           FROM helpdesk_attachments WHERE id = ?`,
      )
      .get(attachmentId) as AttachmentRow | undefined) ?? null
  )
}
