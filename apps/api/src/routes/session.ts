import {
  normalizeUsername,
  type LoginRequest,
  type SessionResponse,
} from '@qabase/shared'
import type { FastifyInstance, FastifyReply } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../core/clock'
import { resolvePermissions } from '../core/permissions'
import type { PasswordHasher } from '../core/security/password'
import {
  parseSessionCookie,
  serializeSessionCookie,
  SESSION_COOKIE,
} from '../core/security/session'
import type { LoginThrottle } from '../core/security/throttle'
import {
  createAnonymousSession,
  createAuthenticatedSession,
  invalidateSession,
  resolveSession,
  type AuthenticatedSession,
} from '../core/sessions/service'
import { requireSession } from '../plugins/auth'
import {
  authenticate,
  setupRequired as isSetupRequired,
} from '../modules/identity/service'

const loginSchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    required: ['username', 'password'],
    properties: {
      username: { type: 'string', minLength: 1, maxLength: 64 },
      password: { type: 'string', minLength: 1, maxLength: 128 },
    },
  },
} as const

export type SessionRoutesOptions = {
  db: DatabaseSync
  sessionSecret: string
  clock: Clock
  hasher: PasswordHasher
  decoyHash: string
  throttle: LoginThrottle
}

function setSessionCookie(
  reply: FastifyReply,
  sessionId: string,
  secret: string,
): void {
  reply.setCookie(
    SESSION_COOKIE,
    serializeSessionCookie(sessionId, secret),
    {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      secure: false,
    },
  )
}

function authenticatedResponse(auth: AuthenticatedSession): SessionResponse {
  return {
    authenticated: true,
    csrfToken: auth.session.csrfToken,
    account: {
      id: auth.account.id,
      username: auth.account.username,
      role: {
        id: auth.role.id,
        name: auth.role.name,
      },
      permissions: auth.permissions,
    },
  }
}

export function registerSessionRoutes(
  app: FastifyInstance,
  options: SessionRoutesOptions,
): void {
  app.get('/api/session', async (request, reply) => {
    if (request.auth) {
      return authenticatedResponse(request.auth)
    }

    const now = options.clock()
    const rawCookie = request.cookies[SESSION_COOKIE]
    const sessionId = rawCookie
      ? parseSessionCookie(rawCookie, options.sessionSecret)
      : null

    if (sessionId) {
      const resolved = resolveSession(options.db, sessionId, now)
      if (resolved?.kind === 'anonymous') {
        return {
          authenticated: false,
          setupRequired: isSetupRequired(options.db),
          csrfToken: resolved.session.csrfToken,
        } satisfies SessionResponse
      }
      if (resolved?.kind === 'authenticated') {
        return authenticatedResponse(resolved)
      }
    }

    const session = createAnonymousSession(options.db, now)
    setSessionCookie(reply, session.id, options.sessionSecret)

    return {
      authenticated: false,
      setupRequired: isSetupRequired(options.db),
      csrfToken: session.csrfToken,
    } satisfies SessionResponse
  })

  app.post('/api/session', { schema: loginSchema }, async (request, reply) => {
    const body = request.body as LoginRequest
    const normalized = normalizeUsername(body.username)

    options.throttle.assertAllowed(normalized)

    let account
    try {
      account = await authenticate(
        {
          db: options.db,
          hasher: options.hasher,
          decoyHash: options.decoyHash,
        },
        { username: body.username, password: body.password },
      )
    } catch (error) {
      options.throttle.recordFailure(normalized)
      throw error
    }

    options.throttle.clear(normalized)

    const now = options.clock()
    const rawCookie = request.cookies[SESSION_COOKIE]
    const previousSessionId = rawCookie
      ? parseSessionCookie(rawCookie, options.sessionSecret)
      : null

    const session = createAuthenticatedSession(options.db, {
      accountId: account.id,
      now,
      rotateFrom: previousSessionId ?? undefined,
    })

    setSessionCookie(reply, session.id, options.sessionSecret)

    const role = {
      id: account.roleId,
      name: account.roleName,
      isProtected: account.roleIsProtected === 1,
    }

    return {
      authenticated: true,
      csrfToken: session.csrfToken,
      account: {
        id: account.id,
        username: account.username,
        role: { id: role.id, name: role.name },
        permissions: resolvePermissions(options.db, role),
      },
    } satisfies SessionResponse
  })

  app.delete('/api/session', async (request, reply) => {
    const auth = requireSession(request)
    invalidateSession(options.db, auth.session.id)
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return reply.code(204).send()
  })
}
