import { apiFetch } from '@/lib/api'

export type HelpdeskAttachment = {
  id: number
  fileName: string
  contentType: string | null
  sizeBytes: number | null
  downloadUrl: string
}

export type HelpdeskTicket = {
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
  attachments: HelpdeskAttachment[]
}

export type HelpdeskSyncStatus = {
  status: 'never' | 'success' | 'error'
  lastStartedAt: string | null
  lastFinishedAt: string | null
  message: string | null
  createdCount: number
  updatedCount: number
  rejectedCount: number
}

export function requestTickets(search: string): Promise<HelpdeskTicket[]> {
  const params = new URLSearchParams()
  const trimmed = search.trim()
  if (trimmed !== '') {
    params.set('q', trimmed)
  }

  const query = params.toString()
  return apiFetch<HelpdeskTicket[]>(
    `/api/helpdesk/tickets${query === '' ? '' : `?${query}`}`,
  )
}

export function requestTicket(ticketId: number): Promise<HelpdeskTicket> {
  return apiFetch<HelpdeskTicket>(`/api/helpdesk/tickets/${ticketId}`)
}

export function requestSyncStatus(): Promise<HelpdeskSyncStatus> {
  return apiFetch<HelpdeskSyncStatus>('/api/helpdesk/sync-status')
}
