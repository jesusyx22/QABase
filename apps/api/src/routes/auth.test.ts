import type { DatabaseSync } from 'node:sqlite'
import type { FastifyInstance } from 'fastify'
import { afterEach, describe, expect, it } from 'vitest'
import type { PasswordHasher } from '../core/security/password'
import { LoginThrottle } from '../core/security/throttle'
import { createFirstAdmin } from '../modules/identity/service'
import { buildServer } from '../server'
import { createTestDatabase } from '../test/db'

const PASSWORD = 'correct horse battery staple'
const NEW_PASSWORD = 'new correct horse battery'
const SECRET = 'test-secret-with-at-least-32-characters!!'
const ORIGIN = 'http://127.0.0.1:3000'
const DECOY = 'fake:decoy'

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
  clock: { now: Date }
}

const openHarnesses: Harness[] = []

async function createHarness(withAdmin = true): Promise<Harness> {
  const db = createTestDatabase()
  const clock = { now: new Date('2026-10-18T12:00:00.000Z') }
  const app = await buildServer({
    db,
    webDistPath: '/nonexistent-web-dist',
    sessionSecret: SECRET,
    syncToken: 'sync-token-with-at-least-32-characters!!',
    hasher,
    decoyHash: DECOY,
    clock: () => clock.now,
    throttle: new LoginThrottle(() => clock.now),
    allowedOrigins: new Set([ORIGIN]),
  })

  if (withAdmin) {
    await createFirstAdmin(
      { db, hasher },
      { username: 'admin', password: PASSWORD, now: clock.now },
    )
  }

  const harness = { app, db, clock }
  openHarnesses.push(harness)
  return harness
}

afterEach(async () => {
  while (openHarnesses.length > 0) {
    const harness = openHarnesses.pop()
    if (harness) {
      await harness.app.close()
      harness.db.close()
    }
  }
})

function cookieOf(response: { cookies: Array<{ name: string; value: string }> }): string {
  const cookie = response.cookies.find((item) => item.name === 'qabase_session')
  if (!cookie) {
    throw new Error('La respuesta no incluyó la cookie de sesión')
  }
  return cookie.value
}

async function anonymousSession(app: FastifyInstance, remoteAddress?: string) {
  return app.inject({
    method: 'GET',
    url: '/api/session',
    remoteAddress,
  })
}

async function login(
  app: FastifyInstance,
  input: { username?: string; password?: string; cookie?: string; origin?: string | null } = {},
) {
  const headers: Record<string, string> = {}
  if (input.origin !== null) {
    headers.origin = input.origin ?? ORIGIN
  }
  if (input.cookie) {
    headers.cookie = `qabase_session=${input.cookie}`
  }

  return app.inject({
    method: 'POST',
    url: '/api/session',
    headers,
    payload: {
      username: input.username ?? 'admin',
      password: input.password ?? PASSWORD,
    },
  })
}

async function authenticated(
  app: FastifyInstance,
  cookie: string,
): Promise<{ cookie: string; csrfToken: string }> {
  const response = await app.inject({
    method: 'GET',
    url: '/api/session',
    headers: { cookie: `qabase_session=${cookie}` },
  })
  const body = response.json()
  return { cookie, csrfToken: body.csrfToken }
}

describe('sesión anónima y setup', () => {
  it('crea una sesión anónima con cookie segura y setupRequired', async () => {
    const { app } = await createHarness(false)

    const response = await anonymousSession(app)
    const body = response.json()

    expect(response.statusCode).toBe(200)
    expect(body).toMatchObject({
      authenticated: false,
      setupRequired: true,
    })
    expect(typeof body.csrfToken).toBe('string')

    const setCookie = response.headers['set-cookie']
    expect(String(setCookie)).toContain('HttpOnly')
    expect(String(setCookie)).toContain('SameSite=Strict')
    expect(String(setCookie)).toContain('Path=/')
    expect(String(setCookie)).not.toContain('Secure')
    expect(String(setCookie)).not.toContain('Max-Age')
  })

  it('refleja que ya existe un administrador activo', async () => {
    const { app } = await createHarness(true)

    const response = await anonymousSession(app)

    expect(response.json()).toMatchObject({
      authenticated: false,
      setupRequired: false,
    })
  })

  it('reutiliza la sesión anónima y su token CSRF', async () => {
    const { app } = await createHarness(false)
    const first = await anonymousSession(app)
    const cookie = cookieOf(first)

    const second = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: `qabase_session=${cookie}` },
    })

    expect(second.json()).toEqual(first.json())
  })
})

describe('login', () => {
  it('autentica, devuelve permisos y fija la cookie', async () => {
    const { app } = await createHarness()
    const anonymous = await anonymousSession(app)
    const anonymousCookie = cookieOf(anonymous)

    const response = await login(app, { cookie: anonymousCookie })
    const body = response.json()

    expect(response.statusCode).toBe(200)
    expect(body.authenticated).toBe(true)
    expect(body.account.username).toBe('admin')
    expect(body.account.role.name).toBe('Administrador')
    expect(body.account.permissions).toHaveLength(10)

    const setCookie = String(response.headers['set-cookie'])
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).not.toContain('Max-Age')

    const authenticatedCookie = cookieOf(response)
    const session = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: `qabase_session=${authenticatedCookie}` },
    })
    expect(session.json()).toMatchObject({
      authenticated: true,
      account: { username: 'admin' },
    })
  })

  it('rota el identificador y la cookie anónima deja de ser válida', async () => {
    const { app } = await createHarness()
    const anonymous = await anonymousSession(app)
    const anonymousCookie = cookieOf(anonymous)

    const response = await login(app, { cookie: anonymousCookie })
    const sessionCookie = cookieOf(response)

    expect(sessionCookie).not.toBe(anonymousCookie)

    const old = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: `qabase_session=${anonymousCookie}` },
    })
    expect(old.json().authenticated).toBe(false)
  })

  it('devuelve el mismo 401 para usuario inexistente, contraseña incorrecta e inactivo', async () => {
    const { app, db } = await createHarness()

    const unknown = await login(app, { username: 'nadie' })
    const wrong = await login(app, { password: 'incorrecta' })

    expect(unknown.statusCode).toBe(401)
    expect(wrong.statusCode).toBe(401)
    expect(unknown.json()).toEqual(wrong.json())
    expect(unknown.json().error.message).toBe('Usuario o contraseña incorrectos.')

    db.prepare("UPDATE accounts SET is_active = 0 WHERE username = 'admin'").run()
    const inactive = await login(app)
    expect(inactive.statusCode).toBe(401)
    expect(inactive.json()).toEqual(unknown.json())
  })

  it('bloquea el sexto intento y libera la ventana después', async () => {
    const { app, clock } = await createHarness()

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await login(app, { password: 'incorrecta' })
      expect(response.statusCode).toBe(401)
    }

    const blocked = await login(app, { password: PASSWORD })
    expect(blocked.statusCode).toBe(429)
    expect(blocked.json().error.code).toBe('too_many_requests')

    clock.now = new Date('2026-10-18T12:16:00.000Z')
    const afterWindow = await login(app, { password: PASSWORD })
    expect(afterWindow.statusCode).toBe(200)
  })

  it('valida el origen en login cuando viene presente', async () => {
    const { app } = await createHarness()

    const noOrigin = await login(app, { origin: null })
    expect(noOrigin.statusCode).toBe(200)

    const badOrigin = await login(app, { origin: 'http://evil.example' })
    expect(badOrigin.statusCode).toBe(403)
  })

  it('rechaza mutaciones desde una dirección no loopback', async () => {
    const { app } = await createHarness()

    const response = await app.inject({
      method: 'POST',
      url: '/api/session',
      remoteAddress: '10.0.0.8',
      headers: { origin: ORIGIN },
      payload: { username: 'admin', password: PASSWORD },
    })

    expect(response.statusCode).toBe(403)
  })
})

describe('CSRF, origen y logout', () => {
  it('exige token, origen y sesión en las mutaciones autenticadas', async () => {
    const { app } = await createHarness()
    const loginResponse = await login(app)
    const cookie = cookieOf(loginResponse)
    const { csrfToken } = await authenticated(app, cookie)

    const noCsrf = await app.inject({
      method: 'POST',
      url: '/api/account/password',
      headers: {
        cookie: `qabase_session=${cookie}`,
        origin: ORIGIN,
      },
      payload: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    })
    expect(noCsrf.statusCode).toBe(403)

    const wrongCsrf = await app.inject({
      method: 'POST',
      url: '/api/account/password',
      headers: {
        cookie: `qabase_session=${cookie}`,
        origin: ORIGIN,
        'x-csrf-token': 'incorrecto',
      },
      payload: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    })
    expect(wrongCsrf.statusCode).toBe(403)

    const noOrigin = await app.inject({
      method: 'POST',
      url: '/api/account/password',
      headers: {
        cookie: `qabase_session=${cookie}`,
        'x-csrf-token': csrfToken,
      },
      payload: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    })
    expect(noOrigin.statusCode).toBe(403)

    const ok = await app.inject({
      method: 'POST',
      url: '/api/account/password',
      headers: {
        cookie: `qabase_session=${cookie}`,
        origin: ORIGIN,
        'x-csrf-token': csrfToken,
      },
      payload: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    })
    expect(ok.statusCode).toBe(204)
  })

  it('cambia la contraseña, invalida la anterior y cierra otras sesiones', async () => {
    const { app } = await createHarness()
    const first = await login(app)
    const firstCookie = cookieOf(first)
    const firstCsrf = first.json().csrfToken

    const second = await login(app)
    const secondCookie = cookieOf(second)

    const change = await app.inject({
      method: 'POST',
      url: '/api/account/password',
      headers: {
        cookie: `qabase_session=${firstCookie}`,
        origin: ORIGIN,
        'x-csrf-token': firstCsrf,
      },
      payload: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    })
    expect(change.statusCode).toBe(204)

    const oldPassword = await login(app, { cookie: firstCookie })
    expect(oldPassword.statusCode).toBe(401)

    const newPassword = await login(app, {
      password: NEW_PASSWORD,
      cookie: firstCookie,
    })
    expect(newPassword.statusCode).toBe(200)

    const otherSession = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: `qabase_session=${secondCookie}` },
    })
    expect(otherSession.json().authenticated).toBe(false)
  })

  it('logout invalida la sesión y limpia la cookie', async () => {
    const { app } = await createHarness()
    const loginResponse = await login(app)
    const cookie = cookieOf(loginResponse)
    const csrfToken = loginResponse.json().csrfToken

    const logout = await app.inject({
      method: 'DELETE',
      url: '/api/session',
      headers: {
        cookie: `qabase_session=${cookie}`,
        origin: ORIGIN,
        'x-csrf-token': csrfToken,
      },
    })
    expect(logout.statusCode).toBe(204)
    expect(String(logout.headers['set-cookie'])).toContain('Max-Age=0')

    const after = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: `qabase_session=${cookie}` },
    })
    expect(after.json().authenticated).toBe(false)
  })
})

describe('expiración y manipulación', () => {
  it('expira a las ocho horas sin renovar por actividad', async () => {
    const { app, clock } = await createHarness()
    const loginResponse = await login(app)
    const cookie = cookieOf(loginResponse)

    clock.now = new Date('2026-10-18T19:59:59.000Z')
    const stillValid = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: `qabase_session=${cookie}` },
    })
    expect(stillValid.json().authenticated).toBe(true)

    clock.now = new Date('2026-10-18T20:00:00.000Z')
    const expired = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: `qabase_session=${cookie}` },
    })
    expect(expired.json().authenticated).toBe(false)
  })

  it('rechaza una cookie con firma manipulada', async () => {
    const { app } = await createHarness()
    const loginResponse = await login(app)
    const cookie = cookieOf(loginResponse)
    const replacement = cookie.endsWith('A') ? 'B' : 'A'
    const tampered = `${cookie.slice(0, -1)}${replacement}`

    const response = await app.inject({
      method: 'GET',
      url: '/api/session',
      headers: { cookie: `qabase_session=${tampered}` },
    })

    expect(response.json().authenticated).toBe(false)
  })
})
