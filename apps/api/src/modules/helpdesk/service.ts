import type { DatabaseSync } from 'node:sqlite'
import { notFound } from '../../core/errors'
import {
  findAttachmentById,
  findTicketById,
  listAttachments,
  listTickets,
  type AttachmentRow,
  type TicketRow,
} from './repository'

const STATUS_LABELS: Record<string, string> = {
  new: 'Nuevo',
  assigned: 'Asignado',
  resolved: 'Resuelto',
  closed: 'Cerrado',
}

export type AttachmentView = {
  id: number
  fileName: string
  contentType: string | null
  sizeBytes: number | null
  downloadUrl: string
}

export type TicketView = {
  id: number
  reference: string
  subject: string
  description: string | null
  status: string
  statusLabel: string
  requester: string | null
  organization: string | null
  team: string | null
  analyst: string | null
  reportedAt: string | null
  createdAt: string
  lastSyncedAt: string
  attachments: AttachmentView[]
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

function toAttachmentView(attachment: AttachmentRow): AttachmentView {
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    downloadUrl: `/api/helpdesk/attachments/${attachment.id}/download`,
  }
}

function toTicketView(
  row: TicketRow,
  attachments: AttachmentRow[] = [],
): TicketView {
  return {
    id: row.id,
    reference: row.reference,
    subject: row.subject,
    description: row.description,
    status: row.status,
    statusLabel: statusLabel(row.status),
    requester: row.requester,
    organization: row.organization,
    team: row.team,
    analyst: row.analyst,
    reportedAt: row.reportedAt,
    createdAt: row.createdAt,
    lastSyncedAt: row.lastSyncedAt,
    attachments: attachments.map(toAttachmentView),
  }
}

export function listTicketViews(
  db: DatabaseSync,
  search: string,
): TicketView[] {
  return listTickets(db, search).map((row) => toTicketView(row))
}

export function getTicketView(
  db: DatabaseSync,
  ticketId: number,
): TicketView {
  const row = findTicketById(db, ticketId)
  if (!row) {
    throw notFound('El ticket no existe.')
  }
  return toTicketView(row, listAttachments(db, ticketId))
}

export function attachmentDownload(
  db: DatabaseSync,
  attachmentId: number,
): AttachmentRow {
  const attachment = findAttachmentById(db, attachmentId)
  if (!attachment) {
    throw notFound('El anexo no existe.')
  }
  return attachment
}
