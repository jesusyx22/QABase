import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDatabase } from './db/database'
import type { PasswordHasher } from './core/security/password'
import { LoginThrottle } from './core/security/throttle'
import { buildServer } from './server'

const openApps: Array<{ close: () => Promise<void>; db: ReturnType<typeof openDatabase> }> = []
const TEST_SECRET = 'test-secret-with-at-least-32-characters!!'

const fakeHasher: PasswordHasher = {
  async hash(password) {
    return `fake:${password}`
  },
  async verify(passwordHash, password) {
    return passwordHash === `fake:${password}`
  },
}

function webDistWithoutBuild(): string {
  return join(mkdtempSync(join(tmpdir(), 'qabase-web-')), 'dist')
}

function webDistWithBuild(): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'qabase-web-')), 'dist')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'index.html'),
    '<!doctype html><html lang="es"><head><title>QABase</title></head><body><div id="root"></div></body></html>',
  )
  return dir
}

async function createApp(webDistPath = webDistWithoutBuild()) {
  const db = openDatabase(':memory:')
  const app = await buildServer({
    db,
    webDistPath,
    sessionSecret: TEST_SECRET,
    syncToken: 'sync-token-with-at-least-32-characters!!',
    hasher: fakeHasher,
    decoyHash: 'fake:decoy',
    clock: () => new Date('2026-10-18T12:00:00.000Z'),
    throttle: new LoginThrottle(),
    allowedOrigins: new Set(['http://127.0.0.1:3000']),
  })
  openApps.push({ close: () => app.close(), db })
  return app
}

afterEach(async () => {
  while (openApps.length > 0) {
    const entry = openApps.pop()
    if (entry) {
      await entry.close()
      entry.db.close()
    }
  }
})

describe('GET /api/health', () => {
  it('responde ok cuando la base está disponible', async () => {
    const app = await createApp()

    const response = await app.inject({ method: 'GET', url: '/api/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'ok' })
  })
})

describe('rutas desconocidas', () => {
  it('devuelve un error estructurado bajo /api', async () => {
    const app = await createApp()

    const response = await app.inject({ method: 'GET', url: '/api/no-existe' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: { code: 'not_found', message: 'Operación no encontrada.' },
    })
  })
})

describe('interfaz compilada', () => {
  it('sirve index.html en la raíz', async () => {
    const app = await createApp(webDistWithBuild())

    const response = await app.inject({ method: 'GET', url: '/' })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toContain('text/html')
    expect(response.body).toContain('<title>QABase</title>')
  })

  it('devuelve index.html en rutas profundas de la SPA', async () => {
    const app = await createApp(webDistWithBuild())

    const response = await app.inject({ method: 'GET', url: '/meritos/123' })

    expect(response.statusCode).toBe(200)
    expect(response.body).toContain('<div id="root"></div>')
  })

  it('no devuelve la SPA para una ruta desconocida del API', async () => {
    const app = await createApp(webDistWithBuild())

    const response = await app.inject({ method: 'GET', url: '/api/no-existe' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: { code: 'not_found' } })
  })
})
