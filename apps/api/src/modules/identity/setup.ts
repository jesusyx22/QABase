import {
  isValidPassword,
  isValidUsername,
} from '@qabase/shared'
import type { AppConfig } from '../../config'
import type { Clock } from '../../core/clock'
import { systemClock } from '../../core/clock'
import type { PasswordHasher } from '../../core/security/password'
import { createArgon2Hasher } from '../../core/security/password'
import { ensureSessionSecret } from '../../core/security/session-secret'
import { openDatabase } from '../../db/database'
import { runMigrations } from '../../db/migrate'
import { seedAll } from '../../seeds'
import type { CliPrompts } from '../../cli/prompts'
import { createFirstAdmin } from './service'

export async function promptValidUsername(
  prompts: CliPrompts,
): Promise<string> {
  for (;;) {
    const username = await prompts.text('Nombre de usuario: ')
    if (isValidUsername(username)) {
      return username
    }
    console.error(
      'Usuario inválido: 3–64 caracteres, solo letras ASCII, números, punto, guion o guion bajo.',
    )
  }
}

export async function promptValidPassword(
  prompts: CliPrompts,
): Promise<string> {
  for (;;) {
    const first = await prompts.secret('Contraseña: ')
    if (!isValidPassword(first)) {
      console.error('Contraseña inválida: debe tener entre 12 y 128 caracteres.')
      continue
    }

    const second = await prompts.secret('Repite la contraseña: ')
    if (first !== second) {
      console.error('Las contraseñas no coinciden.')
      continue
    }

    return first
  }
}

export type SetupOptions = {
  config: AppConfig
  env: NodeJS.ProcessEnv
  prompts: CliPrompts
  hasher?: PasswordHasher
  clock?: Clock
}

/**
 * Crea la primera cuenta administradora. Falla si ya existe una activa
 * (RN-ID-72). No hay ruta HTTP equivalente.
 */
export async function runSetup(options: SetupOptions): Promise<number> {
  const clock = options.clock ?? systemClock
  const hasher = options.hasher ?? createArgon2Hasher()

  ensureSessionSecret(options.env, options.config.rootDir)

  const db = openDatabase(options.config.databasePath)
  try {
    runMigrations(db, options.config.migrationsPath)
    seedAll(db, clock())

    const username = await promptValidUsername(options.prompts)
    const password = await promptValidPassword(options.prompts)

    return await createFirstAdmin(
      { db, hasher },
      { username, password, now: clock() },
    )
  } finally {
    db.close()
  }
}
