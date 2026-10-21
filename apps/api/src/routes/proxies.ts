import type {
  UpdateProxyAllowlistInput,
  UpdateProxySettingsInput,
} from '@qabase/shared'
import type { FastifyInstance } from 'fastify'
import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../core/clock'
import { requirePermission } from '../plugins/auth'
import { actorFromSession } from '../modules/identity/session-actor'
import {
  getProxyLogs,
  listProxies,
  restartProxy,
  startProxy,
  stopProxy,
  updateProxyAllowlist,
  updateProxySettings,
} from '../modules/proxies/service'
import type {
  ProcessInspector,
  ProxyHealthCheck,
} from '../modules/proxies/process'
import type { ProxyProcessController } from '../modules/proxies/control'

const version = { type: 'integer', minimum: 1 } as const
const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'integer', minimum: 1 } },
} as const
const externalBody = {
  type: 'object',
  additionalProperties: false,
  properties: { confirmExternal: { type: 'boolean' } },
} as const

export type ProxyRouteOptions = {
  db: DatabaseSync
  clock: Clock
  proxiesPath: string
  logsPath: string
  inspector: ProcessInspector
  controller: ProxyProcessController
  healthCheck: ProxyHealthCheck
}

export function registerProxyRoutes(
  app: FastifyInstance,
  options: ProxyRouteOptions,
): void {
  app.get('/api/proxies', async (request) => {
    requirePermission(request, 'proxies.ver')
    return listProxies(options.db, {
      inspector: options.inspector,
      healthCheck: options.healthCheck,
      now: options.clock(),
    })
  })

  app.patch(
    '/api/proxies/settings',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['host'],
          properties: {
            host: { type: 'string', minLength: 1, maxLength: 15 },
            version,
          },
        },
      },
    },
    async (request) => {
      const auth = requirePermission(request, 'proxies.gestionar')
      const body = request.body as UpdateProxySettingsInput
      return updateProxySettings(options.db, actorFromSession(auth), {
        ...body,
        now: options.clock(),
      })
    },
  )

  app.patch(
    '/api/proxies/:id/allowlist',
    {
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['entries'],
          properties: {
            entries: {
              type: 'array',
              maxItems: 100,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['cidr', 'label'],
                properties: {
                  cidr: { type: 'string', minLength: 1, maxLength: 20 },
                  label: { type: 'string', minLength: 1, maxLength: 80 },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const auth = requirePermission(request, 'proxies.gestionar')
      const { id } = request.params as { id: number }
      const body = request.body as UpdateProxyAllowlistInput
      return updateProxyAllowlist(
        options.db,
        actorFromSession(auth),
        id,
        body.entries,
        {
          logsPath: options.logsPath,
          inspector: options.inspector,
          healthCheck: options.healthCheck,
          now: options.clock(),
        },
      )
    },
  )

  const controlOptions = (now: Date) => ({
    proxiesPath: options.proxiesPath,
    logsPath: options.logsPath,
    inspector: options.inspector,
    controller: options.controller,
    healthCheck: options.healthCheck,
    now,
  })

  app.post(
    '/api/proxies/:id/start',
    { schema: { params: idParams } },
    async (request) => {
      const auth = requirePermission(request, 'proxies.operar')
      const { id } = request.params as { id: number }
      return startProxy(
        options.db,
        actorFromSession(auth),
        id,
        controlOptions(options.clock()),
      )
    },
  )

  app.post(
    '/api/proxies/:id/stop',
    { schema: { params: idParams, body: externalBody } },
    async (request) => {
      const auth = requirePermission(request, 'proxies.operar')
      const { id } = request.params as { id: number }
      const body = (request.body ?? {}) as { confirmExternal?: boolean }
      return stopProxy(options.db, actorFromSession(auth), id, {
        ...controlOptions(options.clock()),
        confirmExternal: body.confirmExternal,
      })
    },
  )

  app.post(
    '/api/proxies/:id/restart',
    { schema: { params: idParams, body: externalBody } },
    async (request) => {
      const auth = requirePermission(request, 'proxies.operar')
      const { id } = request.params as { id: number }
      const body = (request.body ?? {}) as { confirmExternal?: boolean }
      return restartProxy(options.db, actorFromSession(auth), id, {
        ...controlOptions(options.clock()),
        confirmExternal: body.confirmExternal,
      })
    },
  )

  app.get(
    '/api/proxies/:id/logs',
    {
      schema: {
        params: idParams,
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            lines: { type: 'integer', minimum: 1, maximum: 500 },
          },
        },
      },
    },
    async (request) => {
      requirePermission(request, 'proxies.operar')
      const { id } = request.params as { id: number }
      const { lines } = request.query as { lines?: number }
      return getProxyLogs(options.db, id, options.logsPath, lines ?? 100)
    },
  )
}
