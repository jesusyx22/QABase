import type { FastifyInstance } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../core/clock'
import type { PasswordHasher } from '../core/security/password'
import { requirePermission } from '../plugins/auth'
import { actorFromSession } from '../modules/identity/session-actor'
import {
  createUser,
  listAccountHistory,
  listUsers,
  resetUserPassword,
  updateUser,
} from '../modules/identity/users'

const createUserSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['username', 'password', 'roleId'],
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 64 },
      password: { type: 'string', minLength: 12, maxLength: 128 },
      roleId: { type: 'integer', minimum: 1 },
    },
  },
} as const

const updateUserSchema = {
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
      username: { type: 'string', minLength: 3, maxLength: 64 },
      roleId: { type: 'integer', minimum: 1 },
      isActive: { type: 'boolean' },
      version: { type: 'integer', minimum: 1 },
    },
  },
} as const

const userIdSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } },
  },
} as const

const resetPasswordSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'integer', minimum: 1 } },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['newPassword'],
    properties: {
      newPassword: { type: 'string', minLength: 12, maxLength: 128 },
    },
  },
} as const

export type UserRoutesOptions = {
  db: DatabaseSync
  hasher: PasswordHasher
  clock: Clock
}

export function registerUserRoutes(
  app: FastifyInstance,
  options: UserRoutesOptions,
): void {
  app.get('/api/users', async (request) => {
    requirePermission(request, 'usuarios.gestionar')
    const query = request.query as { includeInactive?: string; q?: string }
    return listUsers(options.db, {
      includeInactive: query.includeInactive === '1',
      search: query.q ?? '',
    })
  })

  app.post('/api/users', { schema: createUserSchema }, async (request, reply) => {
    const auth = requirePermission(request, 'usuarios.gestionar')
    const body = request.body as {
      username: string
      password: string
      roleId: number
    }
    const user = await createUser(
      { db: options.db, hasher: options.hasher },
      actorFromSession(auth),
      { ...body, now: options.clock() },
    )
    return reply.code(201).send(user)
  })

  app.patch(
    '/api/users/:id',
    { schema: updateUserSchema },
    async (request) => {
      const auth = requirePermission(request, 'usuarios.gestionar')
      const params = request.params as { id: number }
      const body = request.body as {
        username?: string
        roleId?: number
        isActive?: boolean
        version: number
      }
      return updateUser(
        { db: options.db },
        actorFromSession(auth),
        params.id,
        { ...body, now: options.clock() },
      )
    },
  )

  app.post(
    '/api/users/:id/reset-password',
    { schema: resetPasswordSchema },
    async (request, reply) => {
      const auth = requirePermission(request, 'usuarios.gestionar')
      const params = request.params as { id: number }
      const body = request.body as { newPassword: string }
      await resetUserPassword(
        { db: options.db, hasher: options.hasher },
        actorFromSession(auth),
        params.id,
        { newPassword: body.newPassword, now: options.clock() },
      )
      return reply.code(204).send()
    },
  )

  app.get('/api/users/:id/history', { schema: userIdSchema }, async (request) => {
    requirePermission(request, 'usuarios.gestionar')
    const params = request.params as { id: number }
    return listAccountHistory(options.db, params.id)
  })
}
