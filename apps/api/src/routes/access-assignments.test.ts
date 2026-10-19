import { PERMISSION_KEYS } from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import type { PasswordHasher } from '../core/security/password'
import { LoginThrottle } from '../core/security/throttle'
import { createAccess } from '../modules/accesses/service'
import type { Actor } from '../modules/identity/actor'
import {
  findAccountById,
  findRoleBySeedKey,
} from '../modules/identity/repository'
import { createFirstAdmin } from '../modules/identity/service'
import { createUser } from '../modules/identity/users'
import {
  createPerson,
  updatePersonDetails,
} from '../modules/personal/service'
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
  const actor: Actor = {
    id: admin.id,
    username: admin.username,
    permissions: [...PERMISSION_KEYS],
  }
  const person = createPerson(db, actor, { name: 'Ana QA', now })
  const access = createAccess(db, actor, {
    address: '10.20.10.15',
    port: 443,
    environment: 'production',
    protocol: 'tcp',
    detail: 'API de pagos',
    now,
  })

  const harness = { app, db, now }
  harnesses.push(harness)
  return { ...harness, admin, actor, person, access }
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

async function createAssignmentViaApi(
  app: FastifyInstance,
  session: { cookie: string; csrfToken: string },
  input: { personId: number; accessId: number; expiresOn: string },
) {
  return app.inject({
    method: 'POST',
    url: '/api/access-assignments',
    headers: authHeaders(session),
    payload: input,
  })
}

describe('rutas de asignaciones', () => {
  it('protege las rutas y permite consultar a Editor y Consulta', async () => {
    const { app, db, admin, person, access, now } = await createHarness()
    const adminSession = await login(app)

    const anonymous = await app.inject({
      method: 'GET',
      url: '/api/access-assignments/overview',
    })
    expect(anonymous.statusCode).toBe(401)

    const created = await createAssignmentViaApi(app, adminSession, {
      personId: person.id,
      accessId: access.id,
      expiresOn: '2026-11-20',
    })
    expect(created.statusCode).toBe(201)
    const assignmentId = created.json().id as number

    for (const seedKey of ['editor', 'consulta'] as const) {
      await createEditorOrConsulta(db, admin, seedKey, now)
      const session = await login(app, seedKey)

      const overview = await app.inject({
        method: 'GET',
        url: '/api/access-assignments/overview',
        headers: authHeaders(session),
      })
      expect(overview.statusCode).toBe(200)

      const personDetail = await app.inject({
        method: 'GET',
        url: `/api/personal/${person.id}/access-assignments`,
        headers: authHeaders(session),
      })
      expect(personDetail.statusCode).toBe(200)

      const reverse = await app.inject({
        method: 'GET',
        url: `/api/accesses/${access.id}/assignments`,
        headers: authHeaders(session),
      })
      expect(reverse.statusCode).toBe(200)

      const write = await createAssignmentViaApi(app, session, {
        personId: person.id,
        accessId: access.id,
        expiresOn: '2026-12-01',
      })
      expect(write.statusCode).toBe(403)

      const update = await app.inject({
        method: 'PATCH',
        url: `/api/access-assignments/${assignmentId}`,
        headers: authHeaders(session),
        payload: { expiresOn: '2026-12-01', version: 1 },
      })
      expect(update.statusCode).toBe(403)

      const history = await app.inject({
        method: 'GET',
        url: `/api/access-assignments/${assignmentId}/history`,
        headers: authHeaders(session),
      })
      expect(history.statusCode).toBe(403)
    }
  })

  it('crea, evita duplicados y valida fechas y entidades', async () => {
    const { app, person, access } = await createHarness()
    const session = await login(app)

    const created = await createAssignmentViaApi(app, session, {
      personId: person.id,
      accessId: access.id,
      expiresOn: '2026-11-20',
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      person: { id: person.id, name: 'Ana QA' },
      access: { id: access.id },
      expiresOn: '2026-11-20',
      state: 'current',
    })

    const duplicate = await createAssignmentViaApi(app, session, {
      personId: person.id,
      accessId: access.id,
      expiresOn: '2026-12-01',
    })
    expect(duplicate.statusCode).toBe(409)

    const past = await createAssignmentViaApi(app, session, {
      personId: person.id,
      accessId: access.id,
      expiresOn: '2026-10-18',
    })
    expect(past.statusCode).toBe(400)

    const invalidDate = await createAssignmentViaApi(app, session, {
      personId: person.id,
      accessId: access.id,
      expiresOn: '2026-02-30',
    })
    expect(invalidDate.statusCode).toBe(400)

    const missingPerson = await createAssignmentViaApi(app, session, {
      personId: 9999,
      accessId: access.id,
      expiresOn: '2026-11-20',
    })
    expect(missingPerson.statusCode).toBe(404)

    const missingAccess = await createAssignmentViaApi(app, session, {
      personId: person.id,
      accessId: 9999,
      expiresOn: '2026-11-20',
    })
    expect(missingAccess.statusCode).toBe(404)
  })

  it('expone KPIs, filtros y orden de la lista por QA', async () => {
    const { app, actor, person, access, now, db } = await createHarness()
    const session = await login(app)
    const secondAccess = createAccess(db, actor, {
      address: '10.20.10.16',
      port: 8443,
      environment: 'qa',
      now,
    })

    await createAssignmentViaApi(app, session, {
      personId: person.id,
      accessId: access.id,
      expiresOn: '2026-10-19',
    })
    await createAssignmentViaApi(app, session, {
      personId: person.id,
      accessId: secondAccess.id,
      expiresOn: '2026-12-01',
    })

    const overview = await app.inject({
      method: 'GET',
      url: '/api/access-assignments/overview?q=Ana',
      headers: authHeaders(session),
    })
    expect(overview.statusCode).toBe(200)
    expect(overview.json()).toMatchObject({
      kpis: {
        qasWithAccess: 1,
        current: 1,
        expiring: 1,
        expired: 0,
      },
      qas: [
        {
          person: { id: person.id, name: 'Ana QA' },
          counts: { current: 1, expiring: 1, expired: 0, total: 2 },
          nextExpiry: '2026-10-19',
          urgency: 'critical',
        },
      ],
    })

    const expiring = await app.inject({
      method: 'GET',
      url: '/api/access-assignments/overview?filter=expiring&sort=name',
      headers: authHeaders(session),
    })
    expect(expiring.statusCode).toBe(200)
    expect(
      expiring.json().qas.map((qa: { person: { name: string } }) =>
        qa.person.name,
      ),
    ).toContain('Ana QA')

    const invalidFilter = await app.inject({
      method: 'GET',
      url: '/api/access-assignments/overview?filter=archived',
      headers: authHeaders(session),
    })
    expect(invalidFilter.statusCode).toBe(400)

    const inactive = createPerson(db, actor, { name: 'Beto QA', now })
    updatePersonDetails(db, actor, inactive.id, {
      isActive: false,
      version: inactive.version,
      now,
    })
    const inactiveList = await app.inject({
      method: 'GET',
      url: '/api/access-assignments/overview?filter=inactive',
      headers: authHeaders(session),
    })
    expect(inactiveList.statusCode).toBe(200)
    expect(
      inactiveList.json().qas.map((qa: { person: { name: string } }) =>
        qa.person.name,
      ),
    ).toContain('Beto QA')
  })

  it('expone el detalle por QA y la vista inversa por acceso', async () => {
    const { app, person, access } = await createHarness()
    const session = await login(app)
    await createAssignmentViaApi(app, session, {
      personId: person.id,
      accessId: access.id,
      expiresOn: '2026-11-20',
    })

    const byPerson = await app.inject({
      method: 'GET',
      url: `/api/personal/${person.id}/access-assignments`,
      headers: authHeaders(session),
    })
    expect(byPerson.statusCode).toBe(200)
    expect(byPerson.json()).toMatchObject({
      person: { id: person.id, name: 'Ana QA' },
      counts: { current: 1, expiring: 0, expired: 0, total: 1 },
    })
    expect(byPerson.json().current).toHaveLength(1)
    expect(byPerson.json().expired).toHaveLength(0)

    const byAccess = await app.inject({
      method: 'GET',
      url: `/api/accesses/${access.id}/assignments`,
      headers: authHeaders(session),
    })
    expect(byAccess.statusCode).toBe(200)
    expect(byAccess.json()).toMatchObject({
      access: { id: access.id },
      counts: { current: 1, expiring: 0, expired: 0, total: 1 },
    })
    expect(byAccess.json().current).toHaveLength(1)

    const missing = await app.inject({
      method: 'GET',
      url: '/api/personal/9999/access-assignments',
      headers: authHeaders(session),
    })
    expect(missing.statusCode).toBe(404)
  })

  it('edita con versión, bloquea inactivos y registra historial', async () => {
    const { app, actor, person, access, now, db } = await createHarness()
    const session = await login(app)
    const created = await createAssignmentViaApi(app, session, {
      personId: person.id,
      accessId: access.id,
      expiresOn: '2026-11-20',
    })
    const assignmentId = created.json().id as number

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/access-assignments/${assignmentId}`,
      headers: authHeaders(session),
      payload: { expiresOn: '2026-12-01', version: 1 },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toMatchObject({
      expiresOn: '2026-12-01',
      version: 2,
    })

    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/access-assignments/${assignmentId}`,
      headers: authHeaders(session),
      payload: { expiresOn: '2026-12-02', version: 1 },
    })
    expect(stale.statusCode).toBe(409)

    const past = await app.inject({
      method: 'PATCH',
      url: `/api/access-assignments/${assignmentId}`,
      headers: authHeaders(session),
      payload: { expiresOn: '2026-10-01', version: 2 },
    })
    expect(past.statusCode).toBe(200)
    expect(past.json()).toMatchObject({
      expiresOn: '2026-10-01',
      state: 'expired',
      version: 3,
    })

    const history = await app.inject({
      method: 'GET',
      url: `/api/access-assignments/${assignmentId}/history`,
      headers: authHeaders(session),
    })
    expect(history.statusCode).toBe(200)
    expect(history.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'access_assignment.created' }),
        expect.objectContaining({
          action: 'access_assignment.updated',
          before: expect.objectContaining({ expiresOn: '2026-11-20' }),
          after: expect.objectContaining({ expiresOn: '2026-12-01' }),
        }),
      ]),
    )

    const secondAccess = createAccess(db, actor, {
      address: '10.20.10.16',
      port: 8443,
      environment: 'qa',
      now,
    })
    await createAssignmentViaApi(app, session, {
      personId: person.id,
      accessId: secondAccess.id,
      expiresOn: '2026-11-20',
    })

    const inactiveAccess = await app.inject({
      method: 'PATCH',
      url: `/api/accesses/${access.id}`,
      headers: authHeaders(session),
      payload: { isActive: false, version: 1 },
    })
    expect(inactiveAccess.statusCode).toBe(200)

    const blocked = await app.inject({
      method: 'PATCH',
      url: `/api/access-assignments/${assignmentId}`,
      headers: authHeaders(session),
      payload: { expiresOn: '2026-12-15', version: 3 },
    })
    expect(blocked.statusCode).toBe(409)

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/access-assignments/${assignmentId}`,
      headers: authHeaders(session),
    })
    expect(deleted.statusCode).toBe(404)
  })
})
