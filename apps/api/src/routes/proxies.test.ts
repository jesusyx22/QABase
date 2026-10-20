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
import { buildServer } from '../server'
import { createTestDatabase } from '../test/db'

const PASSWORD = 'correct horse battery staple'
const SECRET = 'test-secret-with-at-least-32-characters!!'
const ORIGIN = 'http://127.0.0.1:3000'
const SYNC_TOKEN = 'sync-token-with-at-least-32-characters!!'

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
}

const harnesses: Harness[] = []

async function createHarness() {
  const db = createTestDatabase()
  const now = new Date('2026-10-19T12:00:00.000Z')
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
  })
  const adminId = await createFirstAdmin(
    { db, hasher },
    { username: 'admin', password: PASSWORD, now },
  )
  const admin = findAccountById(db, adminId)!

  const harness = { app, db, now }
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
    {
      username: seedKey,
      password: PASSWORD,
      roleId: role.id,
      now,
    },
  )
}

type AccessJson = { id: number; version: number }

async function createAccessViaApi(
  app: FastifyInstance,
  session: Session,
  overrides: Record<string, unknown> = {},
): Promise<AccessJson> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/accesses',
    headers: authHeaders(session),
    payload: {
      address: '10.20.10.15',
      port: 443,
      environment: 'production',
      protocol: 'tcp',
      detail: 'API de pagos',
      ...overrides,
    },
  })
  if (response.statusCode !== 201) {
    throw new Error(`Crear acceso falló: ${response.body}`)
  }
  return response.json() as AccessJson
}

async function deactivateAccess(
  app: FastifyInstance,
  session: Session,
  accessId: number,
  version = 1,
) {
  return app.inject({
    method: 'PATCH',
    url: `/api/accesses/${accessId}`,
    headers: authHeaders(session),
    payload: { isActive: false, version },
  })
}

function patchSettings(
  app: FastifyInstance,
  session: Session,
  payload: { host: string; version?: number },
) {
  return app.inject({
    method: 'PATCH',
    url: '/api/proxies/settings',
    headers: authHeaders(session),
    payload,
  })
}

function createProxy(
  app: FastifyInstance,
  session: Session,
  payload: { accessId: number; port: number; detail: string },
) {
  return app.inject({
    method: 'POST',
    url: '/api/proxies',
    headers: authHeaders(session),
    payload,
  })
}

function updateProxy(
  app: FastifyInstance,
  session: Session,
  proxyId: number,
  payload: Record<string, unknown>,
) {
  return app.inject({
    method: 'PATCH',
    url: `/api/proxies/${proxyId}`,
    headers: authHeaders(session),
    payload,
  })
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

/**
 * La spec fija la forma de `settings` dentro de `GET /api/proxies`, pero no
 * el cuerpo que devuelve `PATCH /api/proxies/settings`. Se acepta tanto el
 * objeto `ProxySettings` como un envoltorio `{ settings }`.
 */
function settingsOf(body: unknown): { host: string | null; version: number | null } {
  if (typeof body === 'object' && body !== null && 'settings' in body) {
    return (body as { settings: { host: string | null; version: number | null } })
      .settings
  }
  return body as { host: string | null; version: number | null }
}

/** `access-options` no fija envoltorio en la spec: array o `{ accesses }`. */
function listOf(body: unknown, key: string): Array<Record<string, unknown>> {
  if (Array.isArray(body)) {
    return body as Array<Record<string, unknown>>
  }
  if (typeof body === 'object' && body !== null) {
    const value = (body as Record<string, unknown>)[key]
    if (Array.isArray(value)) {
      return value as Array<Record<string, unknown>>
    }
  }
  throw new Error(`Respuesta inesperada: ${JSON.stringify(body)}`)
}

const ACCESS_KEYS = [
  'address',
  'applications',
  'createdAt',
  'detail',
  'environment',
  'id',
  'isActive',
  'port',
  'portEnd',
  'protocol',
  'updatedAt',
  'urls',
  'version',
]

describe('rutas de proxies', () => {
  it('exige sesión en todas las rutas del módulo', async () => {
    const { app } = await createHarness()

    const anonymousCalls = [
      { method: 'GET' as const, url: '/api/proxies' },
      { method: 'GET' as const, url: '/api/proxies/access-options' },
      {
        method: 'PATCH' as const,
        url: '/api/proxies/settings',
        payload: { host: '190.14.10.20' },
      },
      {
        method: 'POST' as const,
        url: '/api/proxies',
        payload: { accessId: 1, port: 8443, detail: 'Anónimo' },
      },
      {
        method: 'PATCH' as const,
        url: '/api/proxies/1',
        payload: { version: 1 },
      },
    ]

    for (const call of anonymousCalls) {
      const response = await app.inject(call)
      expect(response.statusCode).toBe(401)
    }
  })

  it('permite al administrador configurar la IP global y gestionar proxies', async () => {
    const { app } = await createHarness()
    const session = await login(app)
    const access = await createAccessViaApi(app, session)

    const initial = await readProxies(app, session)
    expect(initial).toMatchObject({
      settings: { host: null, version: null },
      proxies: [],
    })

    const settings = await patchSettings(app, session, {
      host: '190.14.10.20',
    })
    expect(settings.statusCode).toBe(200)
    expect(settingsOf(settings.json())).toMatchObject({ host: '190.14.10.20' })

    const created = await createProxy(app, session, {
      accessId: access.id,
      port: 8443,
      detail: 'API de pagos',
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      access: { id: access.id },
      port: 8443,
      detail: 'API de pagos',
      isActive: true,
      version: 1,
    })
    const proxyId = created.json().id as number

    const edited = await updateProxy(app, session, proxyId, {
      detail: 'API de pagos v2',
      port: 9443,
      version: 1,
    })
    expect(edited.statusCode).toBe(200)
    expect(edited.json()).toMatchObject({
      detail: 'API de pagos v2',
      port: 9443,
      isActive: true,
      version: 2,
    })

    const deactivated = await updateProxy(app, session, proxyId, {
      isActive: false,
      version: 2,
    })
    expect(deactivated.statusCode).toBe(200)
    expect(deactivated.json()).toMatchObject({ isActive: false, version: 3 })

    const reactivated = await updateProxy(app, session, proxyId, {
      isActive: true,
      version: 3,
    })
    expect(reactivated.statusCode).toBe(200)
    expect(reactivated.json()).toMatchObject({ isActive: true, version: 4 })

    const listing = await readProxies(app, session)
    expect(listing.proxies).toHaveLength(1)
    expect(listing.proxies[0]).toMatchObject({
      id: proxyId,
      detail: 'API de pagos v2',
      port: 9443,
      isActive: true,
      version: 4,
    })
  })

  it('deja consultar a Editor y Consulta y bloquea sus escrituras', async () => {
    const { app, db, admin, now } = await createHarness()
    const adminSession = await login(app)

    await patchSettings(app, adminSession, { host: '190.14.10.20' })
    const published = await createAccessViaApi(app, adminSession, {
      address: '10.20.10.15',
      port: 443,
    })
    const free = await createAccessViaApi(app, adminSession, {
      address: '10.20.10.16',
      port: 8443,
    })
    const created = await createProxy(app, adminSession, {
      accessId: published.id,
      port: 9443,
      detail: 'API de pagos',
    })
    expect(created.statusCode).toBe(201)
    const proxyId = created.json().id as number

    for (const seedKey of ['editor', 'consulta'] as const) {
      await createEditorOrConsulta(db, admin, seedKey, now)
      const session = await login(app, seedKey)

      const list = await app.inject({
        method: 'GET',
        url: '/api/proxies',
        headers: authHeaders(session),
      })
      expect(list.statusCode).toBe(200)
      expect(list.json().proxies).toHaveLength(1)

      const options = await app.inject({
        method: 'GET',
        url: '/api/proxies/access-options',
        headers: authHeaders(session),
      })
      expect(options.statusCode).toBe(403)

      const settings = await patchSettings(app, session, {
        host: '192.168.1.1',
      })
      expect(settings.statusCode).toBe(403)

      const write = await createProxy(app, session, {
        accessId: free.id,
        port: 10443,
        detail: 'Prohibido',
      })
      expect(write.statusCode).toBe(403)

      const update = await updateProxy(app, session, proxyId, {
        detail: 'Prohibido',
        version: 1,
      })
      expect(update.statusCode).toBe(403)

      const toggle = await updateProxy(app, session, proxyId, {
        isActive: false,
        version: 1,
      })
      expect(toggle.statusCode).toBe(403)
    }
  })

  it('devuelve settings nulos y listado vacío sin configuración', async () => {
    const { app } = await createHarness()
    const session = await login(app)

    const body = await readProxies(app, session)
    expect(body).toEqual({
      settings: { host: null, version: null },
      proxies: [],
    })
  })

  it('rechaza hosts que no son IPv4', async () => {
    const { app } = await createHarness()
    const session = await login(app)

    for (const host of [
      'proxy.local',
      '190.14.10',
      '190.14.10.256',
      '::1',
      '2001:db8::1',
      '',
    ]) {
      const response = await patchSettings(app, session, { host })
      expect(response.statusCode, `host inválido: ${host}`).toBe(400)
    }

    const body = await readProxies(app, session)
    expect(body.settings).toEqual({ host: null, version: null })
  })

  it('crea y actualiza la IP global con versión optimista', async () => {
    const { app } = await createHarness()
    const session = await login(app)

    const created = await patchSettings(app, session, { host: '190.14.10.20' })
    expect(created.statusCode).toBe(200)
    const createdSettings = settingsOf(created.json())
    expect(createdSettings.host).toBe('190.14.10.20')
    expect(typeof createdSettings.version).toBe('number')
    const version = createdSettings.version as number

    const listing = await readProxies(app, session)
    expect(listing.settings).toEqual({
      host: '190.14.10.20',
      version,
    })

    const updated = await patchSettings(app, session, {
      host: '181.10.20.30',
      version,
    })
    expect(updated.statusCode).toBe(200)
    expect(settingsOf(updated.json())).toEqual({
      host: '181.10.20.30',
      version: version + 1,
    })

    const reflected = await readProxies(app, session)
    expect(reflected.settings).toEqual({
      host: '181.10.20.30',
      version: version + 1,
    })

    const stale = await patchSettings(app, session, {
      host: '172.16.0.1',
      version,
    })
    expect(stale.statusCode).toBe(409)

    const afterStale = await readProxies(app, session)
    expect(afterStale.settings.host).toBe('181.10.20.30')
  })

  it('rechaza crear proxies sin IP global', async () => {
    const { app } = await createHarness()
    const session = await login(app)
    const access = await createAccessViaApi(app, session)

    const response = await createProxy(app, session, {
      accessId: access.id,
      port: 8443,
      detail: 'API de pagos',
    })
    expect(response.statusCode).toBe(409)

    const listing = await readProxies(app, session)
    expect(listing.proxies).toHaveLength(0)
  })

  it('crea un proxy válido y rechaza duplicados', async () => {
    const { app } = await createHarness()
    const session = await login(app)
    await patchSettings(app, session, { host: '190.14.10.20' })

    const first = await createAccessViaApi(app, session, {
      address: '10.20.10.15',
      port: 443,
    })
    const second = await createAccessViaApi(app, session, {
      address: '10.20.10.16',
      port: 8443,
    })
    const third = await createAccessViaApi(app, session, {
      address: '10.20.10.17',
      port: 9000,
    })

    const created = await createProxy(app, session, {
      accessId: first.id,
      port: 8443,
      detail: '  API de pagos  ',
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      access: { id: first.id },
      port: 8443,
      detail: 'API de pagos',
      isActive: true,
      version: 1,
    })

    const sameAccess = await createProxy(app, session, {
      accessId: first.id,
      port: 9443,
      detail: 'Otro proxy',
    })
    expect(sameAccess.statusCode).toBe(409)

    const samePort = await createProxy(app, session, {
      accessId: second.id,
      port: 8443,
      detail: 'Otro proxy',
    })
    expect(samePort.statusCode).toBe(409)

    const sameDetail = await createProxy(app, session, {
      accessId: third.id,
      port: 9443,
      detail: ' api de PAGOS ',
    })
    expect(sameDetail.statusCode).toBe(409)

    const listing = await readProxies(app, session)
    expect(listing.proxies).toHaveLength(1)
  })

  it('valida acceso, puerto y detalle al crear', async () => {
    const { app } = await createHarness()
    const session = await login(app)
    await patchSettings(app, session, { host: '190.14.10.20' })

    const access = await createAccessViaApi(app, session, {
      address: '10.20.10.15',
      port: 443,
    })
    const inactive = await createAccessViaApi(app, session, {
      address: '10.20.10.16',
      port: 8443,
    })
    expect((await deactivateAccess(app, session, inactive.id)).statusCode).toBe(
      200,
    )

    const forInactive = await createProxy(app, session, {
      accessId: inactive.id,
      port: 9443,
      detail: 'Acceso inactivo',
    })
    expect(forInactive.statusCode).toBe(409)

    const zeroPort = await createProxy(app, session, {
      accessId: access.id,
      port: 0,
      detail: 'Puerto cero',
    })
    expect(zeroPort.statusCode).toBe(400)

    const tooHighPort = await createProxy(app, session, {
      accessId: access.id,
      port: 65536,
      detail: 'Puerto alto',
    })
    expect(tooHighPort.statusCode).toBe(400)

    const longDetail = await createProxy(app, session, {
      accessId: access.id,
      port: 9443,
      detail: 'x'.repeat(201),
    })
    expect(longDetail.statusCode).toBe(400)

    const blankDetail = await createProxy(app, session, {
      accessId: access.id,
      port: 9443,
      detail: '   ',
    })
    expect(blankDetail.statusCode).toBe(400)

    const missingAccess = await createProxy(app, session, {
      accessId: 9999,
      port: 9443,
      detail: 'No existe',
    })
    expect(missingAccess.statusCode).toBe(404)

    const listing = await readProxies(app, session)
    expect(listing.proxies).toHaveLength(0)
  })

  it('expone solo accesos activos sin proxy en access-options', async () => {
    const { app } = await createHarness()
    const session = await login(app)
    await patchSettings(app, session, { host: '190.14.10.20' })

    const published = await createAccessViaApi(app, session, {
      address: '10.20.10.15',
      port: 443,
    })
    const free = await createAccessViaApi(app, session, {
      address: '10.20.10.16',
      port: 8443,
    })
    const inactive = await createAccessViaApi(app, session, {
      address: '10.20.10.17',
      port: 9000,
    })
    expect((await deactivateAccess(app, session, inactive.id)).statusCode).toBe(
      200,
    )

    await createProxy(app, session, {
      accessId: published.id,
      port: 9443,
      detail: 'API de pagos',
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/proxies/access-options',
      headers: authHeaders(session),
    })
    expect(response.statusCode).toBe(200)

    const options = listOf(response.json(), 'accesses')
    expect(options.map((option) => option.id)).toEqual([free.id])
    for (const option of options) {
      expect(option.isActive).toBe(true)
      expect(option).toMatchObject({
        address: '10.20.10.16',
        port: 8443,
        environment: 'production',
      })
    }
  })

  it('edita detalle, puerto y acceso con versión', async () => {
    const { app } = await createHarness()
    const session = await login(app)
    await patchSettings(app, session, { host: '190.14.10.20' })

    const first = await createAccessViaApi(app, session, {
      address: '10.20.10.15',
      port: 443,
    })
    const second = await createAccessViaApi(app, session, {
      address: '10.20.10.16',
      port: 8443,
    })
    const inactive = await createAccessViaApi(app, session, {
      address: '10.20.10.17',
      port: 9000,
    })

    const created = await createProxy(app, session, {
      accessId: first.id,
      port: 9443,
      detail: 'Proxy Alfa',
    })
    expect(created.statusCode).toBe(201)
    const proxyId = created.json().id as number

    const updated = await updateProxy(app, session, proxyId, {
      accessId: second.id,
      detail: 'Proxy Beta',
      port: 10443,
      version: 1,
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toMatchObject({
      access: { id: second.id },
      detail: 'Proxy Beta',
      port: 10443,
      isActive: true,
      version: 2,
    })

    for (const invalid of [
      { port: 0, version: 2 },
      { port: 65536, version: 2 },
      { port: 1.5, version: 2 },
      { detail: '   ', version: 2 },
      { detail: 'x'.repeat(201), version: 2 },
      { accessId: 9999, version: 2 },
      { version: 2 },
    ]) {
      const response = await updateProxy(app, session, proxyId, invalid)
      expect(response.statusCode).toBe(
        'accessId' in invalid && invalid.accessId === 9999 ? 404 : 400,
      )
    }

    const withoutChanges = await updateProxy(app, session, proxyId, {
      accessId: second.id,
      detail: 'Proxy Beta',
      port: 10443,
      version: 2,
    })
    expect(withoutChanges.statusCode).toBe(400)

    const stale = await updateProxy(app, session, proxyId, {
      detail: 'Proxy Gamma',
      version: 1,
    })
    expect(stale.statusCode).toBe(409)

    expect((await deactivateAccess(app, session, inactive.id)).statusCode).toBe(
      200,
    )

    const toInactive = await updateProxy(app, session, proxyId, {
      accessId: inactive.id,
      version: 2,
    })
    expect(toInactive.statusCode).toBe(409)

    const missing = await updateProxy(app, session, 9999, {
      detail: 'No existe',
      version: 1,
    })
    expect(missing.statusCode).toBe(404)

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/proxies/${proxyId}`,
      headers: authHeaders(session),
    })
    expect(deleted.statusCode).toBe(404)

    const listing = await readProxies(app, session)
    expect(listing.proxies).toHaveLength(1)
    expect(listing.proxies[0]).toMatchObject({
      id: proxyId,
      access: { id: second.id },
      detail: 'Proxy Beta',
      port: 10443,
      version: 2,
    })
  })

  it('conserva un proxy cuyo acceso quedó inactivo y permite editarlo', async () => {
    const { app } = await createHarness()
    const session = await login(app)
    await patchSettings(app, session, { host: '190.14.10.20' })

    const access = await createAccessViaApi(app, session, {
      address: '10.20.10.15',
      port: 443,
    })
    const created = await createProxy(app, session, {
      accessId: access.id,
      port: 9443,
      detail: 'Proxy Alfa',
    })
    expect(created.statusCode).toBe(201)
    const proxyId = created.json().id as number

    expect((await deactivateAccess(app, session, access.id)).statusCode).toBe(
      200,
    )

    const listing = await readProxies(app, session)
    expect(listing.proxies).toHaveLength(1)
    expect(listing.proxies[0]).toMatchObject({
      id: proxyId,
      access: { id: access.id, isActive: false },
    })

    const edited = await updateProxy(app, session, proxyId, {
      detail: 'Proxy Alfa v2',
      port: 10443,
      version: 1,
    })
    expect(edited.statusCode).toBe(200)
    expect(edited.json()).toMatchObject({
      detail: 'Proxy Alfa v2',
      port: 10443,
      isActive: true,
      version: 2,
    })

    const deactivated = await updateProxy(app, session, proxyId, {
      isActive: false,
      version: 2,
    })
    expect(deactivated.statusCode).toBe(200)
    expect(deactivated.json()).toMatchObject({ isActive: false, version: 3 })

    const reactivated = await updateProxy(app, session, proxyId, {
      isActive: true,
      version: 3,
    })
    expect(reactivated.statusCode).toBe(200)
    expect(reactivated.json()).toMatchObject({ isActive: true, version: 4 })
  })

  it('lista activos e inactivos ordenados por detalle con el acceso completo', async () => {
    const { app, now } = await createHarness()
    const session = await login(app)
    const configured = await patchSettings(app, session, {
      host: '190.14.10.20',
    })
    const settingsVersion = settingsOf(configured.json()).version

    const ranged = await createAccessViaApi(app, session, {
      address: '*.smartbear.com',
      port: 3000,
      portEnd: 3099,
      environment: 'unspecified',
      protocol: 'both',
      detail: 'Rango QA',
      applications: 'web-browsing, ssl',
      urls: 'https://example.test/a',
    })
    const panel = await createAccessViaApi(app, session, {
      address: '10.20.10.16',
      port: 8443,
      environment: 'qa',
      protocol: 'tcp',
      detail: 'Panel',
    })
    const base = await createAccessViaApi(app, session, {
      address: '10.20.10.17',
      port: 9000,
      protocol: null,
      detail: null,
    })

    const gamma = await createProxy(app, session, {
      accessId: panel.id,
      port: 10443,
      detail: 'Proxy Gamma',
    })
    expect(gamma.statusCode).toBe(201)
    const alfa = await createProxy(app, session, {
      accessId: ranged.id,
      port: 9443,
      detail: 'Proxy Alfa',
    })
    expect(alfa.statusCode).toBe(201)
    const beta = await createProxy(app, session, {
      accessId: base.id,
      port: 11443,
      detail: 'Proxy Beta',
    })
    expect(beta.statusCode).toBe(201)
    expect(
      (
        await updateProxy(app, session, gamma.json().id as number, {
          isActive: false,
          version: 1,
        })
      ).statusCode,
    ).toBe(200)

    const body = await readProxies(app, session)
    expect(body.settings).toEqual({
      host: '190.14.10.20',
      version: settingsVersion,
    })

    expect(
      body.proxies.map((proxy: { detail: string }) => proxy.detail),
    ).toEqual(['Proxy Alfa', 'Proxy Beta', 'Proxy Gamma'])
    expect(
      body.proxies.map((proxy: { isActive: boolean }) => proxy.isActive),
    ).toEqual([true, true, false])

    const first = body.proxies[0]
    expect(first).toMatchObject({
      access: {
        id: ranged.id,
        address: '*.smartbear.com',
        port: 3000,
        portEnd: 3099,
        environment: 'unspecified',
        protocol: 'both',
        detail: 'Rango QA',
        applications: 'web-browsing, ssl',
        urls: 'https://example.test/a',
        isActive: true,
        version: 1,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      port: 9443,
      detail: 'Proxy Alfa',
      isActive: true,
      version: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    expect(Object.keys(first.access as Record<string, unknown>).sort()).toEqual(
      [...ACCESS_KEYS].sort(),
    )
    expect(typeof first.createdAt).toBe('string')
    expect(typeof first.updatedAt).toBe('string')
  })
})
