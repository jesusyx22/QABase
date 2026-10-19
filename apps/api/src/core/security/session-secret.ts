import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

export const MIN_SESSION_SECRET_LENGTH = 32
export const SESSION_SECRET_FILE = 'data/session-secret'

export class MissingSessionSecretError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingSessionSecretError'
  }
}

function validate(secret: string): string {
  if (secret.length < MIN_SESSION_SECRET_LENGTH) {
    throw new MissingSessionSecretError(
      `SESSION_SECRET debe tener al menos ${MIN_SESSION_SECRET_LENGTH} caracteres.`,
    )
  }
  return secret
}

export function sessionSecretPath(rootDir: string): string {
  return join(rootDir, SESSION_SECRET_FILE)
}

/**
 * Secreto obligatorio: variable de entorno o archivo local generado por el
 * setup. El arranque no inventa un valor por defecto (BE-02, SEG-05).
 */
export function requireSessionSecret(
  env: NodeJS.ProcessEnv,
  rootDir: string,
): string {
  const fromEnv = env.SESSION_SECRET
  if (fromEnv !== undefined && fromEnv !== '') {
    return validate(fromEnv)
  }

  const path = sessionSecretPath(rootDir)
  if (!existsSync(path)) {
    throw new MissingSessionSecretError(
      'Falta el secreto de sesión. Ejecuta `npm run setup` para generarlo.',
    )
  }

  return validate(readFileSync(path, 'utf8').trim())
}

/**
 * Genera `data/session-secret` con permisos 0600 si no existe. Si la variable
 * de entorno está definida, la respeta.
 */
export function ensureSessionSecret(
  env: NodeJS.ProcessEnv,
  rootDir: string,
): string {
  const fromEnv = env.SESSION_SECRET
  if (fromEnv !== undefined && fromEnv !== '') {
    return validate(fromEnv)
  }

  const path = sessionSecretPath(rootDir)
  if (existsSync(path)) {
    chmodSync(path, 0o600)
    return validate(readFileSync(path, 'utf8').trim())
  }

  mkdirSync(join(rootDir, 'data'), { recursive: true })
  const secret = randomBytes(32).toString('hex')
  writeFileSync(path, secret, { mode: 0o600, flag: 'wx' })
  return secret
}
