import type { FastifyInstance } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../core/clock'
import { requirePermission } from '../plugins/auth'
import { actorFromSession } from '../modules/identity/session-actor'
import {
  createRole,
  listAssignableRoles,
  listRoleHistory,
  listRoleViews,
  renameRole,
  setRolePermissions,
} from '../modules/identity/roles'

const roleIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } },
  },
} as const

const createRoleSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['name'],
    properties: { name: { type: 'string', minLength: 1, maxLength: 100 } },
  },
} as const

const renameRoleSchema = {
  params: roleIdSchema.params,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'version'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 100 },
      version: { type: 'integer', minimum: 1 },
    },
  },
} as const

const permissionsSchema = {
  params: roleIdSchema.params,
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['permissions'],
    properties: {
      permissions: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 10,
      },
    },
  },
} as const

export type RoleRoutesOptions = {
  db: DatabaseSync
  clock: Clock
}

export function registerRoleRoutes(
  app: FastifyInstance,
  options: RoleRoutesOptions,
): void {
  app.get('/api/roles/options', async (request) => {
    const auth = requirePermission(request, 'usuarios.gestionar')
    return listAssignableRoles(options.db, actorFromSession(auth))
  })

  app.get('/api/roles', async (request) => {
    requirePermission(request, 'roles.gestionar')
    return listRoleViews(options.db)
  })

  app.post('/api/roles', { schema: createRoleSchema }, async (request, reply) => {
    const auth = requirePermission(request, 'roles.gestionar')
    const body = request.body as { name: string }
    const role = createRole(options.db, actorFromSession(auth), {
      name: body.name,
      now: options.clock(),
    })
    return reply.code(201).send(role)
  })

  app.patch(
    '/api/roles/:id',
    { schema: renameRoleSchema },
    async (request) => {
      const auth = requirePermission(request, 'roles.gestionar')
      const params = request.params as { id: number }
      const body = request.body as { name: string; version: number }
      return renameRole(options.db, actorFromSession(auth), params.id, {
        ...body,
        now: options.clock(),
      })
    },
  )

  app.put(
    '/api/roles/:id/permissions',
    { schema: permissionsSchema },
    async (request) => {
      const auth = requirePermission(request, 'roles.gestionar')
      const params = request.params as { id: number }
      const body = request.body as { permissions: string[] }
      return setRolePermissions(
        options.db,
        actorFromSession(auth),
        params.id,
        { permissions: body.permissions, now: options.clock() },
      )
    },
  )

  app.get(
    '/api/roles/:id/history',
    { schema: roleIdSchema },
    async (request) => {
      requirePermission(request, 'roles.gestionar')
      const params = request.params as { id: number }
      return listRoleHistory(options.db, params.id)
    },
  )
}
