import type { DatabaseSync } from 'node:sqlite'
import { inTransaction } from '../../core/transaction'
import { ticketExists, upsertTicket } from './repository'

export type IngestTicket = {
  reference: string
  subject: string
  status: string
  description?: string | null
  requester?: string | null
  organization?: string | null
  team?: string | null
  analyst?: string | null
  reportedAt?: string | null
}

export type SyncStatus = {
  status: 'never' | 'success' | 'error'
  lastStartedAt: string | null
  lastFinishedAt: string | null
  message: string | null
  createdCount: number
  updatedCount: number
  rejectedCount: number
}

export type IngestResult = {
  created: number
  updated: number
  rejected: Array<{ row: number; reason: string }>
}

type ParsedTicket = {
  reference: string
  subject: string
  description: string | null
  status: string
  requester: string | null
  organization: string | null
  team: string | null
  analyst: string | null
  reportedAt: string
}

function optionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return false
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  )
}

function parseReportedAt(value: string | null | undefined, now: Date): string {
  const trimmed = value?.trim() ?? ''
  if (trimmed === '') {
    return now.toISOString()
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    if (!isRealDate(trimmed)) {
      throw new Error('fecha de reporte inválida.')
    }
    return `${trimmed}T00:00:00.000Z`
  }
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('fecha de reporte inválida.')
  }
  return parsed.toISOString()
}

function parseTicket(
  ticket: IngestTicket,
  now: Date,
): ParsedTicket {
  const reference = ticket.reference.trim()
  if (!/^R-\d+$/.test(reference)) {
    throw new Error('referencia inválida; se espera R- seguido de números.')
  }

  const subject = ticket.subject.trim()
  if (subject.length < 1 || subject.length > 200) {
    throw new Error('asunto vacío o de más de 200 caracteres.')
  }

  const status = ticket.status.trim()
  if (status === '') {
    throw new Error('estado vacío.')
  }

  const description = optionalText(ticket.description)
  if (description !== null && description.length > 5000) {
    throw new Error('descripción de más de 5000 caracteres.')
  }

  return {
    reference,
    subject,
    status,
    description,
    requester: optionalText(ticket.requester),
    organization: optionalText(ticket.organization),
    team: optionalText(ticket.team),
    analyst: optionalText(ticket.analyst),
    reportedAt: parseReportedAt(ticket.reportedAt, now),
  }
}

export function getSyncStatus(db: DatabaseSync): SyncStatus {
  const row = db
    .prepare(
      `SELECT status, last_started_at AS lastStartedAt,
              last_finished_at AS lastFinishedAt, message,
              created_count AS createdCount, updated_count AS updatedCount,
              rejected_count AS rejectedCount
         FROM helpdesk_sync_state WHERE id = 1`,
    )
    .get() as SyncStatus | undefined

  return (
    row ?? {
      status: 'never',
      lastStartedAt: null,
      lastFinishedAt: null,
      message: null,
      createdCount: 0,
      updatedCount: 0,
      rejectedCount: 0,
    }
  )
}

/**
 * Ingesta de solo lectura desde el agente local. Nunca crea tickets en el
 * sistema institucional; solo actualiza la copia local.
 */
export function ingestTickets(
  db: DatabaseSync,
  tickets: IngestTicket[],
  now: Date,
): IngestResult {
  const startedAt = now.toISOString()
  db.prepare(
    'UPDATE helpdesk_sync_state SET last_started_at = ?, message = NULL WHERE id = 1',
  ).run(startedAt)

  const rejected: IngestResult['rejected'] = []
  const valid: ParsedTicket[] = []
  const seen = new Set<string>()

  for (let index = 0; index < tickets.length; index += 1) {
    try {
      const ticket = parseTicket(tickets[index]!, now)
      if (seen.has(ticket.reference)) {
        throw new Error('referencia duplicada en el lote.')
      }
      seen.add(ticket.reference)
      valid.push(ticket)
    } catch (error) {
      rejected.push({
        row: index + 1,
        reason: error instanceof Error ? error.message : 'ticket inválido.',
      })
    }
  }

  try {
    const result = inTransaction(db, () => {
      let created = 0
      let updated = 0

      for (const ticket of valid) {
        const existed = ticketExists(db, ticket.reference)
        upsertTicket(db, { ...ticket, now: startedAt })
        if (existed) {
          updated += 1
        } else {
          created += 1
        }
      }

      db.prepare(
        `UPDATE helpdesk_sync_state
            SET status = 'success', last_finished_at = ?, message = NULL,
                created_count = ?, updated_count = ?, rejected_count = ?
          WHERE id = 1`,
      ).run(startedAt, created, updated, rejected.length)

      return { created, updated, rejected }
    })

    return result
  } catch (error) {
    db.prepare(
      `UPDATE helpdesk_sync_state
          SET status = 'error', last_finished_at = ?, message = ?,
              created_count = 0, updated_count = 0, rejected_count = ?
        WHERE id = 1`,
    ).run(
      startedAt,
      error instanceof Error ? error.message : 'Error de sincronización.',
      rejected.length,
    )
    throw error
  }
}
