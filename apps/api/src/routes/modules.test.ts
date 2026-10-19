import type { DatabaseSync } from 'node:sqlite'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import { PERMISSION_KEYS } from '@qabase/shared'
import type { PasswordHasher } from '../core/security/password'
import { LoginThrottle } from '../core/security/throttle'
import { createFirstAdmin } from '../modules/identity/service'
import { findAccountById, findRoleBySeedKey } from '../modules/identity/repository'
import { createUser } from '../modules/identity/users'
import { listPeople } from '../modules/personal/repository'
import { toLocalDateString } from '../modules/records/service'
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
  const now = new Date('2026-10-18T12:00:00.000Z')
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

function cookieOf(response: { cookies: Array<{ name: string; value: string }> }): string {
  return response.cookies.find((cookie) => cookie.name === 'qabase_session')!.value
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

describe('rutas de módulos', () => {
  it('protege registros y expone el catálogo con sesión', async () => {
    const { app } = await createHarness()

    const anonymous = await app.inject({ method: 'GET', url: '/api/records' })
    expect(anonymous.statusCode).toBe(401)

    const session = await login(app)
    const records = await app.inject({
      method: 'GET',
      url: '/api/records',
      headers: authHeaders(session),
    })
    expect(records.statusCode).toBe(200)
    expect(records.json()).toMatchObject({
      total: 0,
      totals: {
        merits: { count: 0, points: 0 },
        incidents: { count: 0, points: 0 },
      },
    })
    expect(records.json().byQa).toHaveLength(21)

    const levels = await app.inject({
      method: 'GET',
      url: '/api/records/levels',
      headers: authHeaders(session),
    })
    expect(levels.statusCode).toBe(200)
    expect(levels.json()).toHaveLength(10)
  })

  it('crea un registro y lo devuelve en la consulta', async () => {
    const { app, db, now } = await createHarness()
    const session = await login(app)
    const person = listPeople(db, { includeInactive: false, search: '' })[0]!

    const created = await app.inject({
      method: 'POST',
      url: '/api/records',
      headers: authHeaders(session),
      payload: {
        qaId: person.id,
        type: 'merito',
        eventDate: toLocalDateString(now),
        level: 4,
        detail: 'Prueba de integración',
      },
    })

    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      status: 'vigente',
      levelLabel: 'Alto',
    })

    const list = await app.inject({
      method: 'GET',
      url: '/api/records',
      headers: authHeaders(session),
    })
    expect(list.json()).toMatchObject({
      total: 1,
      totals: { merits: { count: 1, points: 4 } },
    })
  })

  it('respeta los permisos del rol Editor', async () => {
    const { app, db, admin, now } = await createHarness()
    const adminSession = await login(app)
    const editorRole = findRoleBySeedKey(db, 'editor')!
    const editor = await createUser(
      { db, hasher },
      {
        id: admin.id,
        username: admin.username,
        permissions: [...PERMISSION_KEYS],
      },
      {
        username: 'editor',
        password: PASSWORD,
        roleId: editorRole.id,
        now,
      },
    )
    expect(editor.username).toBe('editor')

    const editorSession = await login(app, 'editor')

    const personal = await app.inject({
      method: 'GET',
      url: '/api/personal',
      headers: authHeaders(editorSession),
    })
    expect(personal.statusCode).toBe(403)

    const options = await app.inject({
      method: 'GET',
      url: '/api/personal/options',
      headers: authHeaders(editorSession),
    })
    expect(options.statusCode).toBe(200)

    const users = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: authHeaders(editorSession),
    })
    expect(users.statusCode).toBe(403)

    const records = await app.inject({
      method: 'GET',
      url: '/api/records',
      headers: authHeaders(editorSession),
    })
    expect(records.statusCode).toBe(200)

    const adminUsers = await app.inject({
      method: 'GET',
      url: '/api/users',
      headers: authHeaders(adminSession),
    })
    expect(adminUsers.statusCode).toBe(200)
  })

  it('ingesta tickets del agente local y no expone creación de tickets', async () => {
    const { app } = await createHarness()
    const session = await login(app)

    const unauthorized = await app.inject({
      method: 'POST',
      url: '/api/helpdesk/ingest',
      headers: { 'x-sync-token': 'token-incorrecto' },
      payload: { tickets: [] },
    })
    expect(unauthorized.statusCode).toBe(401)

    const ingested = await app.inject({
      method: 'POST',
      url: '/api/helpdesk/ingest',
      headers: { 'x-sync-token': SYNC_TOKEN },
      payload: {
        tickets: [
          {
            reference: 'R-900',
            subject: 'Ticket de prueba',
            status: 'new',
            requester: 'Jesus',
            organization: 'HelpDesk_TI',
            team: 'Tecnologias',
            analyst: 'JORGE',
            reportedAt: '2026-10-01',
            description: 'Detalle',
          },
        ],
      },
    })

    expect(ingested.statusCode).toBe(200)
    expect(ingested.json()).toEqual({ created: 1, updated: 0, rejected: [] })

    const tickets = await app.inject({
      method: 'GET',
      url: '/api/helpdesk/tickets',
      headers: authHeaders(session),
    })
    expect(tickets.json()).toHaveLength(1)

    const status = await app.inject({
      method: 'GET',
      url: '/api/helpdesk/sync-status',
      headers: authHeaders(session),
    })
    expect(status.json()).toMatchObject({
      status: 'success',
      createdCount: 1,
      updatedCount: 0,
    })

    const creation = await app.inject({
      method: 'POST',
      url: '/api/helpdesk/tickets',
      headers: authHeaders(session),
      payload: {},
    })
    expect(creation.statusCode).toBe(404)
  })

  it('protege la edición de accesos y permite consulta a Editor', async () => {
    const { app, db, admin, now } = await createHarness()
    const adminSession = await login(app)

    const created = await app.inject({
      method: 'POST',
      url: '/api/accesses',
      headers: authHeaders(adminSession),
      payload: {
        address: '10.20.10.15',
        port: 443,
        environment: 'production',
        protocol: 'tcp',
        detail: 'API de pagos',
      },
    })
    expect(created.statusCode).toBe(201)
    const accessId = created.json().id as number

    const adminHistory = await app.inject({
      method: 'GET',
      url: `/api/accesses/${accessId}/history`,
      headers: authHeaders(adminSession),
    })
    expect(adminHistory.statusCode).toBe(200)
    expect(adminHistory.json()).toHaveLength(1)

    const editorRole = findRoleBySeedKey(db, 'editor')!
    const editor = await createUser(
      { db, hasher },
      {
        id: admin.id,
        username: admin.username,
        permissions: [...PERMISSION_KEYS],
      },
      {
        username: 'editor',
        password: PASSWORD,
        roleId: editorRole.id,
        now,
      },
    )
    expect(editor.username).toBe('editor')
    const editorSession = await login(app, 'editor')

    const list = await app.inject({
      method: 'GET',
      url: '/api/accesses',
      headers: authHeaders(editorSession),
    })
    expect(list.statusCode).toBe(200)
    expect(list.json()).toHaveLength(1)

    const write = await app.inject({
      method: 'POST',
      url: '/api/accesses',
      headers: authHeaders(editorSession),
      payload: {
        address: '10.20.10.16',
        port: 443,
        environment: 'production',
      },
    })
    expect(write.statusCode).toBe(403)

    const history = await app.inject({
      method: 'GET',
      url: `/api/accesses/${accessId}/history`,
      headers: authHeaders(editorSession),
    })
    expect(history.statusCode).toBe(403)
  })
})
