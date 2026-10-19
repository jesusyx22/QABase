import { createReadStream, existsSync, statSync } from 'node:fs'
import type { FastifyInstance } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../core/clock'
import { HttpError, notFound } from '../core/errors'
import { safeEqual } from '../core/security/session'
import { SYNC_TOKEN_HEADER } from '../core/security/sync-token'
import { requirePermission } from '../plugins/auth'
import {
  attachmentDownload,
  getTicketView,
  listTicketViews,
} from '../modules/helpdesk/service'
import {
  getSyncStatus,
  ingestTickets,
  type IngestTicket,
} from '../modules/helpdesk/sync'

const ticketIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } },
  },
} as const

const attachmentIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } },
  },
} as const

const ingestSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['tickets'],
    properties: {
      tickets: {
        type: 'array',
        maxItems: 1000,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['reference', 'subject', 'status'],
          properties: {
            reference: { type: 'string', maxLength: 40 },
            subject: { type: 'string', maxLength: 200 },
            status: { type: 'string', maxLength: 100 },
            description: { type: ['string', 'null'], maxLength: 5000 },
            requester: { type: ['string', 'null'], maxLength: 200 },
            organization: { type: ['string', 'null'], maxLength: 200 },
            team: { type: ['string', 'null'], maxLength: 200 },
            analyst: { type: ['string', 'null'], maxLength: 200 },
            reportedAt: { type: ['string', 'null'], maxLength: 40 },
          },
        },
      },
    },
  },
} as const

function requireSyncToken(request: {
  headers: Record<string, string | string[] | undefined>
}, expected: string): void {
  const provided = request.headers[SYNC_TOKEN_HEADER]
  if (typeof provided !== 'string' || !safeEqual(provided, expected)) {
    throw new HttpError(
      'unauthenticated',
      401,
      'Token de sincronización inválido.',
    )
  }
}

export type HelpdeskRoutesOptions = {
  db: DatabaseSync
  clock: Clock
  syncToken: string
}

export function registerHelpdeskRoutes(
  app: FastifyInstance,
  options: HelpdeskRoutesOptions,
): void {
  app.get('/api/helpdesk/tickets', async (request) => {
    requirePermission(request, 'mesa.ver')
    const query = request.query as { q?: string }
    return listTicketViews(options.db, query.q ?? '')
  })

  app.get('/api/helpdesk/sync-status', async (request) => {
    requirePermission(request, 'mesa.ver')
    return getSyncStatus(options.db)
  })

  app.get(
    '/api/helpdesk/tickets/:id',
    { schema: ticketIdSchema },
    async (request) => {
      requirePermission(request, 'mesa.ver')
      const params = request.params as { id: number }
      return getTicketView(options.db, params.id)
    },
  )

  app.get(
    '/api/helpdesk/attachments/:id/download',
    { schema: attachmentIdSchema },
    async (request, reply) => {
      requirePermission(request, 'mesa.ver')
      const params = request.params as { id: number }
      const attachment = attachmentDownload(options.db, params.id)

      if (!attachment.storagePath || !existsSync(attachment.storagePath)) {
        throw notFound('El archivo del anexo no está disponible.')
      }

      const stats = statSync(attachment.storagePath)
      const fileName = attachment.fileName.replace(/["\\\r\n]/g, '_')

      reply
        .header('Content-Type', attachment.contentType ?? 'application/octet-stream')
        .header('Content-Length', String(stats.size))
        .header('Content-Disposition', `attachment; filename="${fileName}"`)

      return reply.send(createReadStream(attachment.storagePath))
    },
  )

  // Ingesta de solo lectura desde el agente local. No crea tickets remotos.
  app.post(
    '/api/helpdesk/ingest',
    { schema: ingestSchema },
    async (request) => {
      requireSyncToken(request, options.syncToken)
      const body = request.body as { tickets: IngestTicket[] }
      return ingestTickets(options.db, body.tickets, options.clock())
    },
  )
}
