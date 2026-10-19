import type { FastifyInstance } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../core/clock'
import { forbidden } from '../core/errors'
import { requirePermission } from '../plugins/auth'
import { actorFromSession } from '../modules/identity/session-actor'
import {
  annulRecord,
  createRecord,
  listImpactLevels,
  listRecordHistory,
  listRecordsPage,
  todayFor,
  updateRecord,
} from '../modules/records/service'
import type { RecordType } from '../modules/records/repository'

const listQuerySchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      from: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      to: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      all: { type: 'integer', enum: [0, 1] },
      qaId: { type: 'integer', minimum: 1 },
      type: { type: 'string', enum: ['merito', 'incidencia'] },
      level: { type: 'integer', minimum: 1, maximum: 5 },
      q: { type: 'string', maxLength: 5000 },
      includeAnnulled: { type: 'integer', enum: [0, 1] },
      page: { type: 'integer', minimum: 1 },
      pageSize: { type: 'integer', enum: [25, 50, 100] },
    },
  },
} as const

const recordIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } },
  },
} as const

const createRecordSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['qaId', 'type', 'eventDate', 'level', 'detail'],
    properties: {
      qaId: { type: 'integer', minimum: 1 },
      type: { type: 'string', enum: ['merito', 'incidencia'] },
      eventDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      level: { type: 'integer', minimum: 1, maximum: 5 },
      detail: { type: 'string', minLength: 1, maxLength: 5000 },
    },
  },
} as const

const updateRecordSchema = {
  params: recordIdSchema.params,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['version'],
    properties: {
      qaId: { type: 'integer', minimum: 1 },
      type: { type: 'string', enum: ['merito', 'incidencia'] },
      eventDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      level: { type: 'integer', minimum: 1, maximum: 5 },
      detail: { type: 'string', minLength: 1, maxLength: 5000 },
      version: { type: 'integer', minimum: 1 },
    },
  },
} as const

const annulRecordSchema = {
  params: recordIdSchema.params,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['reason', 'version', 'confirm'],
    properties: {
      reason: { type: 'string', minLength: 1, maxLength: 1000 },
      version: { type: 'integer', minimum: 1 },
      confirm: { type: 'boolean' },
    },
  },
} as const

export type RecordRoutesOptions = {
  db: DatabaseSync
  clock: Clock
}

export function registerRecordRoutes(
  app: FastifyInstance,
  options: RecordRoutesOptions,
): void {
  app.get('/api/records', { schema: listQuerySchema }, async (request) => {
    const auth = requirePermission(request, 'registros.ver')
    const query = request.query as {
      from?: string
      to?: string
      all?: number
      qaId?: number
      type?: RecordType
      level?: number
      q?: string
      includeAnnulled?: number
      page?: number
      pageSize?: number
    }

    const includeAnnulled = query.includeAnnulled === 1
    if (includeAnnulled && !auth.permissions.includes('registros.historial')) {
      throw forbidden('Ver anulados exige permiso de historial.')
    }

    return listRecordsPage(
      options.db,
      {
        from: query.from,
        to: query.to,
        all: query.all === 1,
        qaId: query.qaId,
        type: query.type,
        level: query.level,
        text: query.q,
        includeAnnulled,
        page: query.page,
        pageSize: query.pageSize,
      },
      options.clock(),
    )
  })

  app.get('/api/records/levels', async (request) => {
    requirePermission(request, 'registros.ver')
    return listImpactLevels(options.db)
  })

  app.post(
    '/api/records',
    { schema: createRecordSchema },
    async (request, reply) => {
      const auth = requirePermission(request, 'registros.crear')
      const body = request.body as {
        qaId: number
        type: RecordType
        eventDate: string
        level: number
        detail: string
      }
      const now = options.clock()
      const record = createRecord(options.db, actorFromSession(auth), {
        ...body,
        now,
        today: todayFor(options.clock),
      })
      return reply.code(201).send(record)
    },
  )

  app.patch(
    '/api/records/:id',
    { schema: updateRecordSchema },
    async (request) => {
      const auth = requirePermission(request, 'registros.editar')
      const params = request.params as { id: number }
      const body = request.body as {
        qaId?: number
        type?: RecordType
        eventDate?: string
        level?: number
        detail?: string
        version: number
      }
      const now = options.clock()
      return updateRecord(options.db, actorFromSession(auth), params.id, {
        ...body,
        now,
        today: todayFor(options.clock),
      })
    },
  )

  app.post(
    '/api/records/:id/annul',
    { schema: annulRecordSchema },
    async (request) => {
      const auth = requirePermission(request, 'registros.anular')
      const params = request.params as { id: number }
      const body = request.body as {
        reason: string
        version: number
        confirm: boolean
      }
      return annulRecord(options.db, actorFromSession(auth), params.id, {
        ...body,
        now: options.clock(),
      })
    },
  )

  app.get(
    '/api/records/:id/history',
    { schema: recordIdSchema },
    async (request) => {
      requirePermission(request, 'registros.ver')
      requirePermission(request, 'registros.historial')
      const params = request.params as { id: number }
      return listRecordHistory(options.db, params.id)
    },
  )
}
