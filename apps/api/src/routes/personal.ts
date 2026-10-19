import type { FastifyInstance } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../core/clock'
import { requireAnyPermission, requirePermission } from '../plugins/auth'
import { actorFromSession } from '../modules/identity/session-actor'
import {
  createPerson,
  listPersonHistory,
  listPersonOptions,
  listPeopleForManagement,
  updatePersonDetails,
} from '../modules/personal/service'

const createPersonSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['name'],
    properties: { name: { type: 'string', minLength: 1, maxLength: 200 } },
  },
} as const

const updatePersonSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['version'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 200 },
      isActive: { type: 'boolean' },
      version: { type: 'integer', minimum: 1 },
    },
  },
} as const

const personIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } },
  },
} as const

export type PersonalRoutesOptions = {
  db: DatabaseSync
  clock: Clock
}

export function registerPersonalRoutes(
  app: FastifyInstance,
  options: PersonalRoutesOptions,
): void {
  app.get('/api/personal', async (request) => {
    requirePermission(request, 'personal.gestionar')
    const query = request.query as { includeInactive?: string; q?: string }
    return listPeopleForManagement(options.db, {
      includeInactive: query.includeInactive === '1',
      search: query.q ?? '',
    })
  })

  app.get('/api/personal/options', async (request) => {
    requireAnyPermission(request, ['registros.ver', 'registros.crear'])
    const query = request.query as { includeInactive?: string }
    return listPersonOptions(options.db, query.includeInactive === '1')
  })

  app.post(
    '/api/personal',
    { schema: createPersonSchema },
    async (request, reply) => {
      const auth = requirePermission(request, 'personal.gestionar')
      const body = request.body as { name: string }
      const person = createPerson(options.db, actorFromSession(auth), {
        name: body.name,
        now: options.clock(),
      })
      return reply.code(201).send(person)
    },
  )

  app.patch(
    '/api/personal/:id',
    { schema: updatePersonSchema },
    async (request) => {
      const auth = requirePermission(request, 'personal.gestionar')
      const params = request.params as { id: number }
      const body = request.body as {
        name?: string
        isActive?: boolean
        version: number
      }
      return updatePersonDetails(
        options.db,
        actorFromSession(auth),
        params.id,
        { ...body, now: options.clock() },
      )
    },
  )

  app.get(
    '/api/personal/:id/history',
    { schema: personIdSchema },
    async (request) => {
      requirePermission(request, 'personal.gestionar')
      const params = request.params as { id: number }
      return listPersonHistory(options.db, params.id)
    },
  )
}
