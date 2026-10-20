import { mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HttpError } from '../errors'
import {
  createArgon2Hasher,
  createDecoyHash,
} from './password'
import {
  ensureSessionSecret,
  requireSessionSecret,
  sessionSecretPath,
} from './session-secret'
import {
  isSessionExpired,
  newSessionId,
  parseSessionCookie,
  serializeSessionCookie,
  sessionExpiresAt,
} from './session'
import { LoginThrottle } from './throttle'

const SECRET = 'a'.repeat(64)

describe('cookie de sesión', () => {
  it('firma y verifica el identificador', () => {
    const sessionId = newSessionId()
    const cookie = serializeSessionCookie(sessionId, SECRET)

    expect(parseSessionCookie(cookie, SECRET)).toBe(sessionId)
    expect(parseSessionCookie(cookie, `${SECRET}b`)).toBeNull()
  })

  it('rechaza valores manipulados o mal formados', () => {
    const sessionId = newSessionId()
    const cookie = serializeSessionCookie(sessionId, SECRET)
    const [id, signature] = cookie.split('.') as [string, string]
    const replacement = signature.endsWith('A') ? 'B' : 'A'
    const tampered = `${signature.slice(0, -1)}${replacement}`

    expect(parseSessionCookie(`${id}.${tampered}`, SECRET)).toBeNull()
    expect(parseSessionCookie('sin-punto', SECRET)).toBeNull()
    expect(parseSessionCookie('.firma', SECRET)).toBeNull()
    expect(parseSessionCookie('id.', SECRET)).toBeNull()
  })

  it('calcula una expiración absoluta de ocho horas', () => {
    const now = new Date('2026-10-18T12:00:00.000Z')
    const expiresAt = sessionExpiresAt(now)

    expect(expiresAt).toBe('2026-10-18T20:00:00.000Z')
    expect(isSessionExpired(expiresAt, new Date('2026-10-18T19:59:59.999Z'))).toBe(false)
    expect(isSessionExpired(expiresAt, new Date('2026-10-18T20:00:00.000Z'))).toBe(true)
  })
})

describe('secreto de sesión', () => {
  it('falla si no hay variable ni archivo', () => {
    const root = mkdtempSync(join(tmpdir(), 'qabase-secret-'))
    expect(() => requireSessionSecret({}, root)).toThrow(/npm run setup/)
  })

  it('genera el archivo con permisos 0600 y lo reutiliza', () => {
    const root = mkdtempSync(join(tmpdir(), 'qabase-secret-'))
    const secret = ensureSessionSecret({}, root)

    expect(secret).toHaveLength(64)
    const mode = statSync(sessionSecretPath(root)).mode & 0o777
    if (process.platform === 'win32') {
      expect(mode & 0o200).toBe(0o200)
    } else {
      expect(mode).toBe(0o600)
    }
    expect(ensureSessionSecret({}, root)).toBe(secret)
    expect(requireSessionSecret({}, root)).toBe(secret)
  })

  it('la variable de entorno tiene prioridad y exige longitud', () => {
    const root = mkdtempSync(join(tmpdir(), 'qabase-secret-'))
    const fromEnv = 'b'.repeat(32)

    expect(requireSessionSecret({ SESSION_SECRET: fromEnv }, root)).toBe(fromEnv)
    expect(() => requireSessionSecret({ SESSION_SECRET: 'corto' }, root)).toThrow(
      /32 caracteres/,
    )
  })
})

describe('bloqueo de intentos', () => {
  it('bloquea el sexto intento y se libera al pasar la ventana', () => {
    let now = new Date('2026-10-18T12:00:00.000Z')
    const throttle = new LoginThrottle(() => now)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      throttle.assertAllowed('editor')
      throttle.recordFailure('editor')
    }

    expect(() => throttle.assertAllowed('editor')).toThrow(HttpError)
    expect(() => throttle.assertAllowed('editor')).toThrowError(
      /Demasiados intentos/,
    )

    now = new Date('2026-10-18T12:15:00.001Z')
    expect(() => throttle.assertAllowed('editor')).not.toThrow()
  })

  it('un login exitoso limpia el conteo y no afecta a otros usuarios', () => {
    const throttle = new LoginThrottle(() => new Date('2026-10-18T12:00:00.000Z'))

    for (let attempt = 0; attempt < 5; attempt += 1) {
      throttle.recordFailure('editor')
    }
    throttle.clear('editor')

    expect(() => throttle.assertAllowed('editor')).not.toThrow()
    expect(() => throttle.assertAllowed('consulta')).not.toThrow()
  })
})

describe('Argon2id', () => {
  it('genera un hash PHC y verifica la contraseña', async () => {
    const hasher = createArgon2Hasher()
    const passwordHash = await hasher.hash('una contraseña larga')

    expect(passwordHash.startsWith('$argon2id$')).toBe(true)
    await expect(hasher.verify(passwordHash, 'una contraseña larga')).resolves.toBe(true)
    await expect(hasher.verify(passwordHash, 'otra contraseña')).resolves.toBe(false)
  })

  it('genera un hash señuelo distinto', async () => {
    const hasher = createArgon2Hasher()
    const decoy = await createDecoyHash(hasher)

    expect(decoy.startsWith('$argon2id$')).toBe(true)
    await expect(hasher.verify(decoy, 'cualquiera')).resolves.toBe(false)
  })
})
