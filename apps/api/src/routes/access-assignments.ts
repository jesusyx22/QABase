import type { FastifyInstance } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../core/clock'
import { requirePermission } from '../plugins/auth'
import { actorFromSession } from '../modules/identity/session-actor'
import {
  createAssignment,
  listAccessAssignments,
  listAssignmentHistory,
  listPersonAssignments,
  listQaOverview,
  updateAssignmentDetails,
} from '../modules/access-assignments/service'

const overviewSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      q: { type: 'string', maxLength: 255 },
      filter: {
        type: 'string',
        enum: [
          'all',
          'withAccess',
          'current',
          'expiring',
          'expired',
          'none',
          'inactive',
        ],
      },
      sort: { type: 'string', enum: ['urgency', 'name'] },
    },
  },
} as const

const assignmentParamsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } },
  },
} as const

const personParamsSchema = {
  params: {
    type: 'object',
    required: ['personId'],
    properties: { personId: { type: 'integer', minimum: 1 } },
  },
} as const

const accessParamsSchema = {
  params: {
    type: 'object',
    required: ['accessId'],
    properties: { accessId: { type: 'integer', minimum: 1 } },
  },
} as const

const createSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['personId', 'accessId', 'expiresOn'],
    properties: {
      personId: { type: 'integer', minimum: 1 },
      accessId: { type: 'integer', minimum: 1 },
      expiresOn: {
        type: 'string',
        pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
      },
    },
  },
} as const

const updateSchema = {
  params: assignmentParamsSchema.params,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['version'],
    properties: {
      personId: { type: 'integer', minimum: 1 },
      accessId: { type: 'integer', minimum: 1 },
      expiresOn: {
        type: 'string',
        pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
      },
      version: { type: 'integer', minimum: 1 },
    },
  },
} as const

export type AccessAssignmentRoutesOptions = {
  db: DatabaseSync
  clock: Clock
}

export function registerAccessAssignmentRoutes(
  app: FastifyInstance,
  options: AccessAssignmentRoutesOptions,
): void {
  app.get(
    '/api/access-assignments/overview',
    { schema: overviewSchema },
    async (request) => {
      requirePermission(request, 'accesos.ver')
      const query = request.query as {
        q?: string
        filter?: string
        sort?: string
      }
      return listQaOverview(options.db, query, options.clock())
    },
  )

  app.get(
    '/api/personal/:personId/access-assignments',
    { schema: personParamsSchema },
    async (request) => {
      requirePermission(request, 'accesos.ver')
      const params = request.params as { personId: number }
      return listPersonAssignments(options.db, params.personId, options.clock())
    },
  )

  app.get(
    '/api/accesses/:accessId/assignments',
    { schema: accessParamsSchema },
    async (request) => {
      requirePermission(request, 'accesos.ver')
      const params = request.params as { accessId: number }
      return listAccessAssignments(options.db, params.accessId, options.clock())
    },
  )

  app.post(
    '/api/access-assignments',
    { schema: createSchema },
    async (request, reply) => {
      const auth = requirePermission(request, 'accesos.gestionar')
      const body = request.body as {
        personId: number
        accessId: number
        expiresOn: string
      }
      const assignment = createAssignment(
        options.db,
        actorFromSession(auth),
        { ...body, now: options.clock() },
      )
      return reply.code(201).send(assignment)
    },
  )

  app.patch(
    '/api/access-assignments/:id',
    { schema: updateSchema },
    async (request) => {
      const auth = requirePermission(request, 'accesos.gestionar')
      const params = request.params as { id: number }
      const body = request.body as {
        personId?: number
        accessId?: number
        expiresOn?: string
        version: number
      }
      return updateAssignmentDetails(
        options.db,
        actorFromSession(auth),
        params.id,
        { ...body, now: options.clock() },
      )
    },
  )

  app.get(
    '/api/access-assignments/:id/history',
    { schema: assignmentParamsSchema },
    async (request) => {
      requirePermission(request, 'accesos.gestionar')
      const params = request.params as { id: number }
      return listAssignmentHistory(options.db, params.id)
    },
  )
}
