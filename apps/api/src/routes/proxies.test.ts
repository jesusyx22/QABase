import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'
import { PERMISSION_KEYS } from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import type { PasswordHasher } from '../core/security/password'
import { LoginThrottle } from '../core/security/throttle'
import {
  findAccountById,
  findRoleBySeedKey,
} from '../modules/identity/repository'
import { createFirstAdmin } from '../modules/identity/service'
import { createUser } from '../modules/identity/users'
import type { PortListener, ProcessInspector } from '../modules/proxies/process'
import type { ProxyProcessController } from '../modules/proxies/control'
import { buildServer } from '../server'
import { createTestDatabase } from '../test/db'

const PASSWORD = 'correct horse battery staple'
const SECRET = 'test-secret-with-at-least-32-characters!!'
const ORIGIN = 'http://127.0.0.1:3000'
const SYNC_TOKEN = 'sync-token-with-at-least-32-characters!!'

function proxiesFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'qabase-routes-proxies-'))
  const manifests = {
    sentinel: {
      name: 'Proxy Sentinel',
      environment: 'qa',
      entry: 'server.js',
      ports: [3500],
      primaryPort: 3500,
      healthPath: '/bridge-health',
      routes: [
        {
          path: '/realms',
          target: 'http://10.5.81.60:8080',
          detail: 'Keycloak',
        },
      ],
    },
    gitlab: {
      name: 'GitLab',
      environment: 'qa',
      entry: 'proxy.js',
      ports: [8081],
      primaryPort: 8081,
      healthPath: null,
      routes: [
        { path: '/', target: 'http://10.5.5.201:80', detail: 'GitLab' },
      ],
    },
    mantis: {
      name: 'Mantis BT',
      environment: 'qa',
      entry: 'proxy.js',
      ports: [80, 8080],
      primaryPort: 80,
      healthPath: null,
      routes: [
        {
          path: '/',
          target: 'http://10.20.22.50:80',
          detail: 'Mantis',
        },
      ],
    },
    'mongodb-qa': {
      name: 'MongoDB QA',
      environment: 'qa',
      protocol: 'tcp',
      entry: 'proxy.cjs',
      ports: [27017],
      primaryPort: 27017,
      healthPath: null,
      routes: [
        {
          path: '/',
          target: 'tcp://10.5.83.84:27017',
          detail: 'MongoDB QA',
        },
      ],
    },
  }
  for (const [slug, manifest] of Object.entries(manifests)) {
    mkdirSync(join(dir, slug))
    writeFileSync(
      join(dir, slug, 'service.json'),
      JSON.stringify(manifest),
    )
    writeFileSync(join(dir, slug, manifest.entry), '')
  }
  return dir
}

const hasher: PasswordHasher = {
  async hash(password) {
    return `fake:${password}`
  },
  async verify(passwordHash, password) {
    return passwordHash === `fake:${password}`
  },
}

type Session = { cookie: string; csrfToken: string }

type Harness = {
  app: FastifyInstance
  db: DatabaseSync
  now: Date
  logs: string
  setListeners: (listeners: PortListener[]) => void
  started: number[]
  stopped: number[]
}

const harnesses: Harness[] = []

function listenerFor(
  slug: string,
  entry: string,
  port: number,
  pid = 4242,
  managed = true,
): PortListener {
  return {
    port,
    address: '0.0.0.0',
    pid,
    processName: 'node.exe',
    commandLine: managed
      ? `node C:\\repo\\scripts\\proxies\\${slug}\\${entry}`
      : 'node proxy.js',
  }
}

async function createHarness() {
  const db = createTestDatabase()
  const now = new Date('2026-10-20T12:00:00.000Z')
  const logs = mkdtempSync(join(tmpdir(), 'qabase-proxy-logs-'))
  let listeners: PortListener[] = []
  const started: number[] = []
  const stopped: number[] = []
  const inspector: ProcessInspector = {
    async listListeners() {
      return listeners
    },
    async isProcessAlive() {
      return true
    },
    async canBindPort() {
      return true
    },
    async describeProcess(pid) {
      return {
        pid,
        processName: 'node.exe',
        commandLine: 'node C:\\repo\\scripts\\proxies\\gitlab\\proxy.js',
      }
    },
  }
  const controller: ProxyProcessController = {
    async start(input) {
      started.push(input.primaryPort)
      listeners = [
        listenerFor(
          basename(input.serviceDir),
          input.entry,
          input.primaryPort,
        ),
      ]
      return { pid: 4242 }
    },
    async stop(pid) {
      stopped.push(pid)
      listeners = []
    },
  }
  const app = await buildServer({
    db,
    webDistPath: '/nonexistent-web-dist',
    sessionSecret: SECRET,
    syncToken: SYNC_TOKEN,
    hasher,
    decoyHash: 'fake:decoy',
    clock: () => now,
    throttle: new LoginThrottle(() => now),
    allowedOrigins: new Set([ORIGIN]),
    proxiesPath: proxiesFixture(),
    proxyLogsPath: logs,
    proxyInspector: inspector,
    proxyController: controller,
    proxyHealthCheck: async () => true,
  })
  const adminId = await createFirstAdmin(
    { db, hasher },
    { username: 'admin', password: PASSWORD, now },
  )
  const admin = findAccountById(db, adminId)!

  const harness: Harness = {
    app,
    db,
    now,
    logs,
    setListeners(next) {
      listeners = next
    },
    started,
    stopped,
  }
  harnesses.push(harness)
  return { ...harness, admin }
}

afterEach(async () => {
  while (harnesses.length > 0) {
    const harness = harnesses.pop()!
    await harness.app.close()
    harness.db.close()
  }
})

function cookieOf(response: {
  cookies: Array<{ name: string; value: string }>
}): string {
  return response.cookies.find((cookie) => cookie.name === 'qabase_session')!
    .value
}

async function login(
  app: FastifyInstance,
  username = 'admin',
  password = PASSWORD,
): Promise<Session> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/session',
    headers: { origin: ORIGIN },
    payload: { username, password },
  })
  if (response.statusCode !== 200) {
    throw new Error(`Login falló: ${response.body}`)
  }
  return {
    cookie: cookieOf(response),
    csrfToken: response.json().csrfToken,
  }
}

function authHeaders(session: Session) {
  return {
    cookie: `qabase_session=${session.cookie}`,
    origin: ORIGIN,
    'x-csrf-token': session.csrfToken,
  }
}

async function createEditorOrConsulta(
  db: DatabaseSync,
  admin: { id: number; username: string },
  seedKey: 'editor' | 'consulta',
  now: Date,
): Promise<void> {
  const role = findRoleBySeedKey(db, seedKey)!
  await createUser(
    { db, hasher },
    {
      id: admin.id,
      username: admin.username,
      permissions: [...PERMISSION_KEYS],
    },
    { username: seedKey, password: PASSWORD, roleId: role.id, now },
  )
}

async function readProxies(app: FastifyInstance, session: Session) {
  const response = await app.inject({
    method: 'GET',
    url: '/api/proxies',
    headers: authHeaders(session),
  })
  expect(response.statusCode).toBe(200)
  return response.json()
}

function serviceId(body: Record<string, unknown>, slug: string): number {
  const services = body.services as Array<{ id: number; slug: string }>
  return services.find((service) => service.slug === slug)!.id
}

describe('rutas de proxies', () => {
  it('exige sesión en todas las rutas del módulo', async () => {
    const { app } = await createHarness()
    const calls = [
      { method: 'GET' as const, url: '/api/proxies' },
      {
        method: 'PATCH' as const,
        url: '/api/proxies/settings',
        payload: { host: '10.4.24.18' },
      },
      { method: 'POST' as const, url: '/api/proxies/1/start' },
      { method: 'POST' as const, url: '/api/proxies/1/stop', payload: {} },
      { method: 'POST' as const, url: '/api/proxies/1/restart', payload: {} },
      { method: 'GET' as const, url: '/api/proxies/1/logs' },
    ]
    for (const call of calls) {
      const response = await app.inject(call)
      expect(response.statusCode).toBe(401)
    }
  })

  it('lista los tres servicios, configura la IP y refleja el cambio', async () => {
    const { app } = await createHarness()
    const session = await login(app)

    const initial = await readProxies(app, session)
    expect(initial.settings).toEqual({ host: null, version: null })
    expect(initial.services).toHaveLength(4)
    expect(initial.services.every((service: { runtime: { status: string } }) => service.runtime.status === 'stopped')).toBe(true)

    const settings = await app.inject({
      method: 'PATCH',
      url: '/api/proxies/settings',
      headers: authHeaders(session),
      payload: { host: '10.4.24.18' },
    })
    expect(settings.statusCode).toBe(200)
    expect(settings.json()).toMatchObject({ host: '10.4.24.18', version: 1 })

    const after = await readProxies(app, session)
    expect(after.settings.host).toBe('10.4.24.18')
  })

  it('permite operar a Editor y bloquea a Consulta', async () => {
    const { app, db, admin, now } = await createHarness()
    const adminSession = await login(app)
    const initial = await readProxies(app, adminSession)
    const gitlabId = serviceId(initial, 'gitlab')

    await createEditorOrConsulta(db, admin, 'editor', now)
    const editor = await login(app, 'editor')
    const started = await app.inject({
      method: 'POST',
      url: `/api/proxies/${gitlabId}/start`,
      headers: authHeaders(editor),
    })
    expect(started.statusCode).toBe(200)
    expect(started.json().runtime.status).toBe('active')

    const editorLogs = await app.inject({
      method: 'GET',
      url: `/api/proxies/${gitlabId}/logs`,
      headers: authHeaders(editor),
    })
    expect(editorLogs.statusCode).toBe(200)

    await createEditorOrConsulta(db, admin, 'consulta', now)
    const consulta = await login(app, 'consulta')
    const listing = await readProxies(app, consulta)
    expect(listing.services).toHaveLength(4)

    const forbiddenStart = await app.inject({
      method: 'POST',
      url: `/api/proxies/${gitlabId}/start`,
      headers: authHeaders(consulta),
    })
    expect(forbiddenStart.statusCode).toBe(403)

    const forbiddenStop = await app.inject({
      method: 'POST',
      url: `/api/proxies/${gitlabId}/stop`,
      headers: authHeaders(consulta),
      payload: {},
    })
    expect(forbiddenStop.statusCode).toBe(403)

    const forbiddenLogs = await app.inject({
      method: 'GET',
      url: `/api/proxies/${gitlabId}/logs`,
      headers: authHeaders(consulta),
    })
    expect(forbiddenLogs.statusCode).toBe(403)

    const forbiddenSettings = await app.inject({
      method: 'PATCH',
      url: '/api/proxies/settings',
      headers: authHeaders(consulta),
      payload: { host: '10.4.24.18' },
    })
    expect(forbiddenSettings.statusCode).toBe(403)
  })

  it('permite al Administrador editar la allowlist TCP y bloquea a los demás', async () => {
    const { app, db, admin, now } = await createHarness()
    const adminSession = await login(app)
    const listing = await readProxies(app, adminSession)
    const mongoId = serviceId(listing, 'mongodb-qa')
    const httpId = serviceId(listing, 'gitlab')

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/proxies/${mongoId}/allowlist`,
      headers: authHeaders(adminSession),
      payload: { cidrs: ['10.4.24.18', '10.4.24.0/24'] },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toMatchObject({
      protocol: 'tcp',
      allowlist: ['10.4.24.0/24', '10.4.24.18/32'],
    })

    const audit = db
      .prepare(
        "SELECT action FROM audit_events WHERE action = 'proxy.allowlist_updated'",
      )
      .get() as { action: string } | undefined
    expect(audit?.action).toBe('proxy.allowlist_updated')

    const invalid = await app.inject({
      method: 'PATCH',
      url: `/api/proxies/${mongoId}/allowlist`,
      headers: authHeaders(adminSession),
      payload: { cidrs: ['mongo.local'] },
    })
    expect(invalid.statusCode).toBe(400)

    const http = await app.inject({
      method: 'PATCH',
      url: `/api/proxies/${httpId}/allowlist`,
      headers: authHeaders(adminSession),
      payload: { cidrs: ['10.4.24.18'] },
    })
    expect(http.statusCode).toBe(400)

    await createEditorOrConsulta(db, admin, 'editor', now)
    const editor = await login(app, 'editor')
    const forbidden = await app.inject({
      method: 'PATCH',
      url: `/api/proxies/${mongoId}/allowlist`,
      headers: authHeaders(editor),
      payload: { cidrs: ['10.4.24.18'] },
    })
    expect(forbidden.statusCode).toBe(403)

    await createEditorOrConsulta(db, admin, 'consulta', now)
    const consulta = await login(app, 'consulta')
    const consultaForbidden = await app.inject({
      method: 'PATCH',
      url: `/api/proxies/${mongoId}/allowlist`,
      headers: authHeaders(consulta),
      payload: { cidrs: ['10.4.24.18'] },
    })
    expect(consultaForbidden.statusCode).toBe(403)
  })

  it('inicia, detiene y reinicia con confirmación y auditoría', async () => {
    const { app, db, started, stopped } = await createHarness()
    const session = await login(app)
    const listing = await readProxies(app, session)
    const id = serviceId(listing, 'gitlab')

    const startedResponse = await app.inject({
      method: 'POST',
      url: `/api/proxies/${id}/start`,
      headers: authHeaders(session),
    })
    expect(startedResponse.statusCode).toBe(200)
    expect(startedResponse.json().runtime).toMatchObject({
      status: 'active',
      pid: 4242,
    })
    expect(started).toEqual([8081])

    const stop = await app.inject({
      method: 'POST',
      url: `/api/proxies/${id}/stop`,
      headers: authHeaders(session),
      payload: {},
    })
    expect(stop.statusCode).toBe(200)
    expect(stop.json().runtime.status).toBe('stopped')
    expect(stopped).toEqual([4242])

    const restart = await app.inject({
      method: 'POST',
      url: `/api/proxies/${id}/restart`,
      headers: authHeaders(session),
      payload: {},
    })
    expect(restart.statusCode).toBe(200)
    expect(restart.json().runtime.status).toBe('active')

    const actions = (
      db
        .prepare(
          "SELECT action FROM audit_events WHERE module = 'proxies' ORDER BY id",
        )
        .all() as Array<{ action: string }>
    ).map((row) => row.action)
    expect(actions).toContain('proxy.started')
    expect(actions).toContain('proxy.stopped')
    expect(actions).toContain('proxy.restarted')
  })

  it('exige confirmación para detener un proceso externo', async () => {
    const { app, setListeners } = await createHarness()
    setListeners([listenerFor('gitlab', 'proxy.js', 8081, 9999, false)])
    const session = await login(app)
    const listing = await readProxies(app, session)
    const id = serviceId(listing, 'gitlab')

    const rejected = await app.inject({
      method: 'POST',
      url: `/api/proxies/${id}/stop`,
      headers: authHeaders(session),
      payload: {},
    })
    expect(rejected.statusCode).toBe(409)
    expect(rejected.json().error.message).toMatch(/fuera de QABase/)

    const confirmed = await app.inject({
      method: 'POST',
      url: `/api/proxies/${id}/stop`,
      headers: authHeaders(session),
      payload: { confirmExternal: true },
    })
    expect(confirmed.statusCode).toBe(200)
    expect(confirmed.json().runtime.status).toBe('stopped')
  })

  it('devuelve 404 para un servicio inexistente y 400 para IP inválida', async () => {
    const { app } = await createHarness()
    const session = await login(app)

    const missing = await app.inject({
      method: 'POST',
      url: '/api/proxies/9999/start',
      headers: authHeaders(session),
    })
    expect(missing.statusCode).toBe(404)

    const invalid = await app.inject({
      method: 'PATCH',
      url: '/api/proxies/settings',
      headers: authHeaders(session),
      payload: { host: 'proxy.local' },
    })
    expect(invalid.statusCode).toBe(400)
  })

  it('devuelve las últimas líneas del log del servicio', async () => {
    const { app, logs, db } = await createHarness()
    const session = await login(app)
    writeFileSync(join(logs, 'gitlab.log'), 'uno\ndos\ntres\n')
    const listing = await readProxies(app, session)
    const id = serviceId(listing, 'gitlab')
    expect(db).toBeDefined()

    const response = await app.inject({
      method: 'GET',
      url: `/api/proxies/${id}/logs?lines=2`,
      headers: authHeaders(session),
    })
    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ lines: ['dos', 'tres'] })
  })
})
