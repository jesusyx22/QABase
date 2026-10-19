import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'qabase_session'
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000
export const SESSION_ID_BYTES = 32
export const CSRF_TOKEN_BYTES = 32

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{32,64}$/

export function newSessionId(): string {
  return randomBytes(SESSION_ID_BYTES).toString('base64url')
}

export function newCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_BYTES).toString('base64url')
}

export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function signSessionId(sessionId: string, secret: string): string {
  return createHmac('sha256', secret).update(sessionId).digest('base64url')
}

export function serializeSessionCookie(
  sessionId: string,
  secret: string,
): string {
  return `${sessionId}.${signSessionId(sessionId, secret)}`
}

/**
 * Verifica la firma antes de consultar la base. Un identificador manipulado
 * no llega al repositorio.
 */
export function parseSessionCookie(
  value: string,
  secret: string,
): string | null {
  const separator = value.lastIndexOf('.')
  if (separator <= 0) {
    return null
  }

  const sessionId = value.slice(0, separator)
  const signature = value.slice(separator + 1)

  if (!SESSION_ID_PATTERN.test(sessionId) || signature.length === 0) {
    return null
  }

  return safeEqual(signature, signSessionId(sessionId, secret))
    ? sessionId
    : null
}

export function sessionExpiresAt(now: Date): string {
  return new Date(now.getTime() + SESSION_DURATION_MS).toISOString()
}

export function isSessionExpired(expiresAt: string, now: Date): boolean {
  return new Date(expiresAt).getTime() <= now.getTime()
}
