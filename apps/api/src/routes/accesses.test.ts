import { PERMISSION_KEYS } from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import type { PasswordHasher } from '../core/security/password'
import { LoginThrottle } from '../core/security/throttle'
import { createFirstAdmin } from '../modules/identity/service'
import {
  findAccountById,
  findRoleBySeedKey,
} from '../modules/identity/repository'
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
): Promise<{ cookie: string; csrfToken: string }> {
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

function authHeaders(session: { cookie: string; csrfToken: string }) {
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
) {
  const role = findRoleBySeedKey(db, seedKey)!
  return createUser(
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

async function createAccessViaApi(
  app: FastifyInstance,
  session: { cookie: string; csrfToken: string },
  overrides: Record<string, unknown> = {},
) {
  return app.inject({
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
}

describe('rutas de accesos', () => {
  it('requiere sesión y permite consultar a Editor y Consulta', async () => {
    const { app, db, admin, now } = await createHarness()
    const adminSession = await login(app)

    const anonymous = await app.inject({
      method: 'GET',
      url: '/api/accesses',
    })
    expect(anonymous.statusCode).toBe(401)

    const created = await createAccessViaApi(app, adminSession)
    expect(created.statusCode).toBe(201)
    const accessId = created.json().id as number

    for (const seedKey of ['editor', 'consulta'] as const) {
      await createEditorOrConsulta(db, admin, seedKey, now)
      const session = await login(app, seedKey)

      const list = await app.inject({
        method: 'GET',
        url: '/api/accesses',
        headers: authHeaders(session),
      })
      expect(list.statusCode).toBe(200)
      expect(list.json()).toHaveLength(1)

      const detail = await app.inject({
        method: 'GET',
        url: `/api/accesses/${accessId}`,
        headers: authHeaders(session),
      })
      expect(detail.statusCode).toBe(200)

      const write = await createAccessViaApi(app, session, {
        address: '10.20.10.16',
      })
      expect(write.statusCode).toBe(403)

      const update = await app.inject({
        method: 'PATCH',
        url: `/api/accesses/${accessId}`,
        headers: authHeaders(session),
        payload: { detail: 'No permitido', version: 1 },
      })
      expect(update.statusCode).toBe(403)

      const history = await app.inject({
        method: 'GET',
        url: `/api/accesses/${accessId}/history`,
        headers: authHeaders(session),
      })
      expect(history.statusCode).toBe(403)
    }
  })

  it('crea, lista, busca y filtra accesos', async () => {
    const { app } = await createHarness()
    const session = await login(app)

    const created = await createAccessViaApi(app, session, {
      address: '  API.Empresa.local  ',
      protocol: 'tcp',
      detail: '  API de pagos  ',
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      address: 'API.Empresa.local',
      port: 443,
      environment: 'production',
      protocol: 'tcp',
      detail: 'API de pagos',
      isActive: true,
      version: 1,
    })
    const accessId = created.json().id as number

    const list = await app.inject({
      method: 'GET',
      url: '/api/accesses',
      headers: authHeaders(session),
    })
    expect(list.statusCode).toBe(200)
    expect(list.json()).toHaveLength(1)

    const detail = await app.inject({
      method: 'GET',
      url: `/api/accesses/${accessId}`,
      headers: authHeaders(session),
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json()).toMatchObject({ id: accessId, isActive: true })

    const byDetail = await app.inject({
      method: 'GET',
      url: '/api/accesses?q=pagos',
      headers: authHeaders(session),
    })
    expect(byDetail.json()).toHaveLength(1)

    const byAddress = await app.inject({
      method: 'GET',
      url: '/api/accesses?q=api.empresa',
      headers: authHeaders(session),
    })
    expect(byAddress.json()).toHaveLength(1)

    const byPort = await app.inject({
      method: 'GET',
      url: '/api/accesses?q=44',
      headers: authHeaders(session),
    })
    expect(byPort.json()).toHaveLength(1)

    const noResults = await app.inject({
      method: 'GET',
      url: '/api/accesses?q=inexistente',
      headers: authHeaders(session),
    })
    expect(noResults.json()).toHaveLength(0)

    const filtered = await app.inject({
      method: 'GET',
      url: '/api/accesses?environment=production&status=active&protocol=tcp',
      headers: authHeaders(session),
    })
    expect(filtered.json()).toHaveLength(1)

    const allEnvironments = await app.inject({
      method: 'GET',
      url: '/api/accesses?environment=all',
      headers: authHeaders(session),
    })
    expect(allEnvironments.statusCode).toBe(200)
    expect(allEnvironments.json()).toHaveLength(1)

    const none = await app.inject({
      method: 'GET',
      url: '/api/accesses?protocol=none',
      headers: authHeaders(session),
    })
    expect(none.json()).toHaveLength(0)

    const invalidStatus = await app.inject({
      method: 'GET',
      url: '/api/accesses?status=archived',
      headers: authHeaders(session),
    })
    expect(invalidStatus.statusCode).toBe(400)

    const optional = await createAccessViaApi(app, session, {
      address: '10.20.10.16',
      port: 8443,
      environment: 'qa',
      protocol: null,
      detail: null,
    })
    expect(optional.statusCode).toBe(201)
    expect(optional.json()).toMatchObject({ protocol: null, detail: null })

    const withoutProtocol = await app.inject({
      method: 'GET',
      url: '/api/accesses?protocol=none',
      headers: authHeaders(session),
    })
    expect(withoutProtocol.json()).toHaveLength(1)

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/accesses/${accessId}`,
      headers: authHeaders(session),
      payload: { protocol: null, detail: null, version: 1 },
    })
    expect(patched.statusCode).toBe(200)
    expect(patched.json()).toMatchObject({ protocol: null, detail: null, version: 2 })

    const missingDetail = await app.inject({
      method: 'GET',
      url: '/api/accesses/9999',
      headers: authHeaders(session),
    })
    expect(missingDetail.statusCode).toBe(404)
  })

  it('acepta rango, ambiente sin clasificar, comodín y metadatos', async () => {
    const { app } = await createHarness()
    const session = await login(app)

    const created = await createAccessViaApi(app, session, {
      address: '*.smartbear.com',
      port: 3000,
      portEnd: 3099,
      environment: 'unspecified',
      protocol: 'tcp',
      applications: 'web-browsing, ssl',
      urls: 'https://example.test/a',
      detail: 'Rango importado',
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      address: '*.smartbear.com',
      port: 3000,
      portEnd: 3099,
      environment: 'unspecified',
      applications: 'web-browsing, ssl',
      urls: 'https://example.test/a',
      detail: 'Rango importado',
    })

    for (const q of ['web-browsing', 'example.test', '3000-3099']) {
      const found = await app.inject({
        method: 'GET',
        url: `/api/accesses?q=${encodeURIComponent(q)}`,
        headers: authHeaders(session),
      })
      expect(found.json()).toHaveLength(1)
    }

    const byEnvironment = await app.inject({
      method: 'GET',
      url: '/api/accesses?environment=unspecified',
      headers: authHeaders(session),
    })
    expect(byEnvironment.json()).toHaveLength(1)

    const invalidRange = await createAccessViaApi(app, session, {
      address: '10.20.10.99',
      port: 4000,
      portEnd: 3999,
    })
    expect(invalidRange.statusCode).toBe(400)
  })

  it('rechaza duplicados y datos inválidos', async () => {
    const { app } = await createHarness()
    const session = await login(app)

    const first = await createAccessViaApi(app, session, {
      address: 'API.Empresa.local',
    })
    expect(first.statusCode).toBe(201)

    const duplicate = await createAccessViaApi(app, session, {
      address: 'api.empresa.local',
    })
    expect(duplicate.statusCode).toBe(409)

    const otherEnvironment = await createAccessViaApi(app, session, {
      address: 'api.empresa.local',
      environment: 'qa',
    })
    expect(otherEnvironment.statusCode).toBe(201)

    const invalidAddress = await createAccessViaApi(app, session, {
      address: 'dirección inválida',
    })
    expect(invalidAddress.statusCode).toBe(400)

    const invalidPort = await createAccessViaApi(app, session, {
      port: 0,
    })
    expect(invalidPort.statusCode).toBe(400)

    const invalidEnvironment = await createAccessViaApi(app, session, {
      environment: 'preproduccion',
    })
    expect(invalidEnvironment.statusCode).toBe(400)

    const invalidProtocol = await createAccessViaApi(app, session, {
      protocol: 'icmp',
    })
    expect(invalidProtocol.statusCode).toBe(400)

    const longDetail = await createAccessViaApi(app, session, {
      detail: 'x'.repeat(201),
    })
    expect(longDetail.statusCode).toBe(400)
  })

  it('edita con versión y deja historial antes/después', async () => {
    const { app } = await createHarness()
    const session = await login(app)
    const created = await createAccessViaApi(app, session)
    const accessId = created.json().id as number

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/accesses/${accessId}`,
      headers: authHeaders(session),
      payload: {
        address: 'api.empresa.local',
        port: 8443,
        environment: 'qa',
        protocol: 'both',
        detail: 'API QA',
        version: 1,
      },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toMatchObject({
      address: 'api.empresa.local',
      port: 8443,
      environment: 'qa',
      protocol: 'both',
      detail: 'API QA',
      version: 2,
    })

    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/accesses/${accessId}`,
      headers: authHeaders(session),
      payload: { detail: 'Versión vieja', version: 1 },
    })
    expect(stale.statusCode).toBe(409)

    const empty = await app.inject({
      method: 'PATCH',
      url: `/api/accesses/${accessId}`,
      headers: authHeaders(session),
      payload: { version: 2 },
    })
    expect(empty.statusCode).toBe(400)

    const missing = await app.inject({
      method: 'PATCH',
      url: '/api/accesses/9999',
      headers: authHeaders(session),
      payload: { detail: 'No existe', version: 1 },
    })
    expect(missing.statusCode).toBe(404)

    const history = await app.inject({
      method: 'GET',
      url: `/api/accesses/${accessId}/history`,
      headers: authHeaders(session),
    })
    expect(history.statusCode).toBe(200)
    expect(history.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'access.created',
          actorUsername: 'admin',
        }),
        expect.objectContaining({
          action: 'access.updated',
          actorUsername: 'admin',
          before: expect.objectContaining({
            address: '10.20.10.15',
            port: 443,
          }),
          after: expect.objectContaining({
            address: 'api.empresa.local',
            port: 8443,
          }),
        }),
      ]),
    )
  })

  it('desactiva y reactiva sin borrar el registro', async () => {
    const { app } = await createHarness()
    const session = await login(app)
    const created = await createAccessViaApi(app, session)
    const accessId = created.json().id as number

    const inactive = await app.inject({
      method: 'PATCH',
      url: `/api/accesses/${accessId}`,
      headers: authHeaders(session),
      payload: { isActive: false, version: 1 },
    })
    expect(inactive.statusCode).toBe(200)
    expect(inactive.json()).toMatchObject({ isActive: false, version: 2 })

    const all = await app.inject({
      method: 'GET',
      url: '/api/accesses',
      headers: authHeaders(session),
    })
    expect(all.json()).toHaveLength(1)

    const onlyInactive = await app.inject({
      method: 'GET',
      url: '/api/accesses?status=inactive',
      headers: authHeaders(session),
    })
    expect(onlyInactive.json()).toHaveLength(1)

    const onlyActive = await app.inject({
      method: 'GET',
      url: '/api/accesses?status=active',
      headers: authHeaders(session),
    })
    expect(onlyActive.json()).toHaveLength(0)

    const active = await app.inject({
      method: 'PATCH',
      url: `/api/accesses/${accessId}`,
      headers: authHeaders(session),
      payload: { isActive: true, version: 2 },
    })
    expect(active.statusCode).toBe(200)
    expect(active.json()).toMatchObject({ isActive: true, version: 3 })

    const history = await app.inject({
      method: 'GET',
      url: `/api/accesses/${accessId}/history`,
      headers: authHeaders(session),
    })
    expect(
      history.json().map((event: { action: string }) => event.action),
    ).toEqual(['access.created', 'access.deactivated', 'access.reactivated'])

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/accesses/${accessId}`,
      headers: authHeaders(session),
    })
    expect(deleted.statusCode).toBe(404)
  })

  it('empieza vacío y no carga datos demo', async () => {
    const { app } = await createHarness()
    const session = await login(app)

    const list = await app.inject({
      method: 'GET',
      url: '/api/accesses',
      headers: authHeaders(session),
    })
    expect(list.statusCode).toBe(200)
    expect(list.json()).toEqual([])
  })
})
