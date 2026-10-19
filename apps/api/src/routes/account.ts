import type { FastifyInstance } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../core/clock'
import type { PasswordHasher } from '../core/security/password'
import { changeOwnPassword } from '../modules/identity/service'
import { requireSession } from '../plugins/auth'

const changePasswordSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string', minLength: 1, maxLength: 128 },
      newPassword: { type: 'string', minLength: 12, maxLength: 128 },
    },
  },
} as const

export type AccountRoutesOptions = {
  db: DatabaseSync
  hasher: PasswordHasher
  clock: Clock
}

export function registerAccountRoutes(
  app: FastifyInstance,
  options: AccountRoutesOptions,
): void {
  app.post(
    '/api/account/password',
    { schema: changePasswordSchema },
    async (request, reply) => {
      const auth = requireSession(request)
      const body = request.body as {
        currentPassword: string
        newPassword: string
      }

      await changeOwnPassword(
        { db: options.db, hasher: options.hasher },
        {
          account: auth.account,
          currentPassword: body.currentPassword,
          newPassword: body.newPassword,
          sessionId: auth.session.id,
          now: options.clock(),
        },
      )

      return reply.code(204).send()
    },
  )
}
