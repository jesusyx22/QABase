import type { PermissionKey } from '@qabase/shared'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../core/clock'
import { forbidden, sessionRequired } from '../core/errors'
import { safeEqual, SESSION_COOKIE, parseSessionCookie } from '../core/security/session'
import {
  authenticateSession,
  type AuthenticatedSession,
} from '../core/sessions/service'

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthenticatedSession | null
    sessionCsrfToken: string | null
  }
}

const LOOPBACK_ADDRESSES = new Set([
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
])

export type AuthOptions = {
  db: DatabaseSync
  sessionSecret: string
  clock: Clock
  allowedOrigins: ReadonlySet<string>
}

export function registerAuth(app: FastifyInstance, options: AuthOptions): void {
  app.decorateRequest('auth', null)
  app.decorateRequest('sessionCsrfToken', null)

  app.addHook('onRequest', async (request) => {
    if (!request.url.startsWith('/api/')) {
      return
    }

    const rawCookie = request.cookies[SESSION_COOKIE]
    if (!rawCookie) {
      return
    }

    const sessionId = parseSessionCookie(rawCookie, options.sessionSecret)
    if (!sessionId) {
      return
    }

    const auth = authenticateSession(options.db, sessionId, options.clock())
    if (auth) {
      request.auth = auth
      request.sessionCsrfToken = auth.session.csrfToken
    }
  })

  // Debe ejecutarse después del hook anterior para conocer request.auth.
  app.addHook('onRequest', async (request) => {
    if (!request.url.startsWith('/api/')) {
      return
    }

    const method = request.method.toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return
    }

    if (!LOOPBACK_ADDRESSES.has(request.ip)) {
      throw forbidden('La operación solo se acepta desde el propio equipo.')
    }

    const isLoginRequest =
      method === 'POST' && request.url.split('?')[0] === '/api/session'

    const origin = request.headers.origin
    if (origin === undefined) {
      if (request.auth && !isLoginRequest) {
        throw forbidden('Origen no válido.')
      }
      return
    }

    if (!options.allowedOrigins.has(origin)) {
      throw forbidden('Origen no válido.')
    }

    if (request.auth && !isLoginRequest) {
      const token = request.headers['x-csrf-token']
      if (
        typeof token !== 'string' ||
        !safeEqual(token, request.auth.session.csrfToken)
      ) {
        throw forbidden('Solicitud no válida.')
      }
    }
  })
}

export function requireSession(
  request: FastifyRequest,
): AuthenticatedSession {
  if (!request.auth) {
    throw sessionRequired()
  }
  return request.auth
}

export function requirePermission(
  request: FastifyRequest,
  permission: PermissionKey,
): AuthenticatedSession {
  const auth = requireSession(request)
  if (!auth.permissions.includes(permission)) {
    throw forbidden()
  }
  return auth
}

export function requireAnyPermission(
  request: FastifyRequest,
  permissions: readonly PermissionKey[],
): AuthenticatedSession {
  const auth = requireSession(request)
  if (!permissions.some((permission) => auth.permissions.includes(permission))) {
    throw forbidden()
  }
  return auth
}
