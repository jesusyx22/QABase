import { randomBytes } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

export const MIN_SYNC_TOKEN_LENGTH = 32
export const SYNC_TOKEN_FILE = 'data/sync-token'
export const SYNC_TOKEN_HEADER = 'x-sync-token'

export function syncTokenPath(rootDir: string): string {
  return join(rootDir, SYNC_TOKEN_FILE)
}

function validate(token: string): string {
  if (token.length < MIN_SYNC_TOKEN_LENGTH) {
    throw new Error(
      `El token de sincronización debe tener al menos ${MIN_SYNC_TOKEN_LENGTH} caracteres.`,
    )
  }
  return token
}

/**
 * Token compartido entre QABase y el agente local de Termux. No se muestra en
 * la interfaz ni se registra en logs. Se guarda en `data/sync-token` (0600).
 */
export function ensureSyncToken(
  env: NodeJS.ProcessEnv,
  rootDir: string,
): string {
  const fromEnv = env.HELPDESK_SYNC_TOKEN
  if (fromEnv !== undefined && fromEnv !== '') {
    return validate(fromEnv)
  }

  const path = syncTokenPath(rootDir)
  if (existsSync(path)) {
    chmodSync(path, 0o600)
    return validate(readFileSync(path, 'utf8').trim())
  }

  mkdirSync(join(rootDir, 'data'), { recursive: true })
  const token = randomBytes(32).toString('hex')
  writeFileSync(path, token, { mode: 0o600, flag: 'wx' })
  return token
}
