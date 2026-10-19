import type { FastifyInstance } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../core/clock'
import { requirePermission } from '../plugins/auth'
import { actorFromSession } from '../modules/identity/session-actor'
import {
  createAccess,
  getAccessView,
  listAccessHistory,
  listAccessViews,
  updateAccessDetails,
} from '../modules/accesses/service'

const listSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      q: { type: 'string', maxLength: 255 },
      environment: {
        type: 'string',
        enum: ['all', 'development', 'qa', 'production', 'unspecified'],
      },
      status: { type: 'string', enum: ['all', 'active', 'inactive'] },
      protocol: {
        type: 'string',
        enum: ['all', 'tcp', 'udp', 'both', 'none'],
      },
    },
  },
} as const

const idSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } },
  },
} as const

const createSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['address', 'port', 'environment'],
    properties: {
      address: { type: 'string', minLength: 1, maxLength: 255 },
      port: { type: 'integer', minimum: 1, maximum: 65535 },
      portEnd: { type: ['integer', 'null'], minimum: 1, maximum: 65535 },
      environment: {
        type: 'string',
        enum: ['development', 'qa', 'production', 'unspecified'],
      },
      protocol: {
        type: ['string', 'null'],
        enum: ['tcp', 'udp', 'both', null],
      },
      detail: { type: ['string', 'null'], maxLength: 200 },
      applications: { type: ['string', 'null'], maxLength: 500 },
      urls: { type: ['string', 'null'], maxLength: 4000 },
    },
  },
} as const

const updateSchema = {
  params: idSchema.params,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['version'],
    properties: {
      address: { type: 'string', minLength: 1, maxLength: 255 },
      port: { type: 'integer', minimum: 1, maximum: 65535 },
      portEnd: { type: ['integer', 'null'], minimum: 1, maximum: 65535 },
      environment: {
        type: 'string',
        enum: ['development', 'qa', 'production', 'unspecified'],
      },
      protocol: {
        type: ['string', 'null'],
        enum: ['tcp', 'udp', 'both', null],
      },
      detail: { type: ['string', 'null'], maxLength: 200 },
      applications: { type: ['string', 'null'], maxLength: 500 },
      urls: { type: ['string', 'null'], maxLength: 4000 },
      isActive: { type: 'boolean' },
      version: { type: 'integer', minimum: 1 },
    },
  },
} as const

export type AccessRoutesOptions = {
  db: DatabaseSync
  clock: Clock
}

export function registerAccessRoutes(
  app: FastifyInstance,
  options: AccessRoutesOptions,
): void {
  app.get('/api/accesses', { schema: listSchema }, async (request) => {
    requirePermission(request, 'accesos.ver')
    const query = request.query as {
      q?: string
      environment?: string
      status?: string
      protocol?: string
    }
    return listAccessViews(options.db, query)
  })

  app.get(
    '/api/accesses/:id/history',
    { schema: idSchema },
    async (request) => {
      requirePermission(request, 'accesos.gestionar')
      const params = request.params as { id: number }
      return listAccessHistory(options.db, params.id)
    },
  )

  app.get('/api/accesses/:id', { schema: idSchema }, async (request) => {
    requirePermission(request, 'accesos.ver')
    const params = request.params as { id: number }
    return getAccessView(options.db, params.id)
  })

  app.post(
    '/api/accesses',
    { schema: createSchema },
    async (request, reply) => {
      const auth = requirePermission(request, 'accesos.gestionar')
      const body = request.body as {
        address: string
        port: number
        portEnd?: number | null
        environment: string
        protocol?: string | null
        detail?: string | null
        applications?: string | null
        urls?: string | null
      }
      const access = createAccess(
        options.db,
        actorFromSession(auth),
        { ...body, now: options.clock() },
      )
      return reply.code(201).send(access)
    },
  )

  app.patch(
    '/api/accesses/:id',
    { schema: updateSchema },
    async (request) => {
      const auth = requirePermission(request, 'accesos.gestionar')
      const params = request.params as { id: number }
      const body = request.body as {
        address?: string
        port?: number
        portEnd?: number | null
        environment?: string
        protocol?: string | null
        detail?: string | null
        applications?: string | null
        urls?: string | null
        isActive?: boolean
        version: number
      }
      return updateAccessDetails(
        options.db,
        actorFromSession(auth),
        params.id,
        { ...body, now: options.clock() },
      )
    },
  )
}
