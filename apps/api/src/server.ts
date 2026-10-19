import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import fastifyCookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import type { ApiError } from '@qabase/shared'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Clock } from './core/clock'
import { HttpError } from './core/errors'
import type { PasswordHasher } from './core/security/password'
import type { LoginThrottle } from './core/security/throttle'
import { registerAccountRoutes } from './routes/account'
import { registerHelpdeskRoutes } from './routes/helpdesk'
import { registerPersonalRoutes } from './routes/personal'
import { registerRecordRoutes } from './routes/records'
import { registerRoleRoutes } from './routes/roles'
import { registerSessionRoutes } from './routes/session'
import { registerUserRoutes } from './routes/users'
import { registerAuth } from './plugins/auth'

export type ServerOptions = {
  db: DatabaseSync
  webDistPath: string
  sessionSecret: string
  syncToken: string
  hasher: PasswordHasher
  decoyHash: string
  clock: Clock
  throttle: LoginThrottle
  allowedOrigins: ReadonlySet<string>
}

function errorBody(code: ApiError['error']['code'], message: string): ApiError {
  return { error: { code, message } }
}

export async function buildServer(options: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 5 * 1024 * 1024 })
  const webIndex = join(options.webDistPath, 'index.html')
  const hasWebBuild = existsSync(webIndex)

  await app.register(fastifyCookie)

  registerAuth(app, {
    db: options.db,
    sessionSecret: options.sessionSecret,
    clock: options.clock,
    allowedOrigins: options.allowedOrigins,
  })

  app.addHook('onSend', async (request, reply, payload) => {
    if (request.url.startsWith('/api/')) {
      reply.header('Cache-Control', 'no-store')
    }
    return payload
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      reply
        .code(error.statusCode)
        .send(errorBody(error.code, error.message))
      return
    }

    if ((error as { validation?: unknown }).validation !== undefined) {
      reply
        .code(400)
        .send(errorBody('invalid_input', 'Entrada inválida.'))
      return
    }

    request.log.error(error)
    reply
      .code(500)
      .send(errorBody('internal', 'Error interno.'))
  })

  app.get('/api/health', async () => {
    const row = options.db.prepare('SELECT 1 AS ok').get() as
      | { ok: number }
      | undefined
    if (row?.ok !== 1) {
      throw new Error('La base de datos no respondió')
    }
    return { status: 'ok' }
  })

  registerSessionRoutes(app, {
    db: options.db,
    sessionSecret: options.sessionSecret,
    clock: options.clock,
    hasher: options.hasher,
    decoyHash: options.decoyHash,
    throttle: options.throttle,
  })

  registerAccountRoutes(app, {
    db: options.db,
    hasher: options.hasher,
    clock: options.clock,
  })

  registerUserRoutes(app, {
    db: options.db,
    hasher: options.hasher,
    clock: options.clock,
  })

  registerRoleRoutes(app, {
    db: options.db,
    clock: options.clock,
  })

  registerPersonalRoutes(app, {
    db: options.db,
    clock: options.clock,
  })

  registerRecordRoutes(app, {
    db: options.db,
    clock: options.clock,
  })

  registerHelpdeskRoutes(app, {
    db: options.db,
    clock: options.clock,
    syncToken: options.syncToken,
  })

  if (hasWebBuild) {
    await app.register(fastifyStatic, { root: options.webDistPath, wildcard: false })
  }

  // BE-08: una ruta desconocida bajo /api nunca devuelve la SPA.
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url?.startsWith('/api/')) {
      reply.code(404).send(errorBody('not_found', 'Operación no encontrada.'))
      return
    }

    if (hasWebBuild) {
      reply.sendFile('index.html')
      return
    }

    reply.code(404).send(errorBody('not_found', 'Recurso no encontrado.'))
  })

  return app
}
