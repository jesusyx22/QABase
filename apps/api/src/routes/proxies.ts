import type {
  CreateProxyInput,
  UpdateProxyInput,
  UpdateProxySettingsInput,
} from '@qabase/shared'
import type { FastifyInstance } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../core/clock'
import { requirePermission } from '../plugins/auth'
import { actorFromSession } from '../modules/identity/session-actor'
import { createProxy, listAccessOptions, listProxies, updateProxy, updateProxySettings } from '../modules/proxies/service'

const fields = {
  accessId: { type: 'integer', minimum: 1 },
  port: { type: 'integer', minimum: 1, maximum: 65535 },
  detail: { type: 'string', minLength: 1, maxLength: 200 },
} as const
const version = { type: 'integer', minimum: 1 } as const
export function registerProxyRoutes(app: FastifyInstance, options: { db: DatabaseSync; clock: Clock }): void {
  app.get('/api/proxies', async request => {
    requirePermission(request, 'proxies.ver')
    return listProxies(options.db)
  })
  app.get('/api/proxies/access-options', async request => {
    requirePermission(request, 'proxies.gestionar')
    return listAccessOptions(options.db)
  })
  app.patch('/api/proxies/settings', {
    schema: {
      body: {
        type: 'object', additionalProperties: false, required: ['host'],
        properties: { host: { type: 'string', minLength: 1, maxLength: 15 }, version },
      }
    }
  }, async request => {
    const auth = requirePermission(request, 'proxies.gestionar')
    const body = request.body as UpdateProxySettingsInput
    return updateProxySettings(options.db, actorFromSession(auth), { ...body, now: options.clock() })
  })
  app.post('/api/proxies', {
    schema: {
      body: {
        type: 'object', additionalProperties: false, required: ['accessId', 'port', 'detail'], properties: fields,
      }
    }
  }, async (request, reply) => {
    const auth = requirePermission(request, 'proxies.gestionar')
    const body = request.body as CreateProxyInput
    return reply.code(201).send(createProxy(options.db, actorFromSession(auth), { ...body, now: options.clock() }))
  })
  app.patch('/api/proxies/:id', {
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } },
      body: { type: 'object', additionalProperties: false, required: ['version'], properties: { ...fields, isActive: { type: 'boolean' }, version } },
    }
  }, async request => {
    const auth = requirePermission(request, 'proxies.gestionar')
    const { id } = request.params as { id: number }
    const body = request.body as UpdateProxyInput
    return updateProxy(options.db, actorFromSession(auth), id, { ...body, now: options.clock() })
  })
}
