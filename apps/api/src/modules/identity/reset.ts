import type { AppConfig } from '../../config'
import type { Clock } from '../../core/clock'
import { systemClock } from '../../core/clock'
import type { PasswordHasher } from '../../core/security/password'
import { createArgon2Hasher } from '../../core/security/password'
import { openDatabase } from '../../db/database'
import { runMigrations } from '../../db/migrate'
import type { CliPrompts } from '../../cli/prompts'
import { promptValidPassword } from './setup'
import { findAdminForLocalReset, resetAdminPasswordLocal } from './service'

export type ResetOptions = {
  config: AppConfig
  prompts: CliPrompts
  hasher?: PasswordHasher
  clock?: Clock
}

export async function runResetAdminPassword(
  options: ResetOptions,
): Promise<void> {
  const clock = options.clock ?? systemClock
  const hasher = options.hasher ?? createArgon2Hasher()
  const db = openDatabase(options.config.databasePath)

  try {
    runMigrations(db, options.config.migrationsPath)

    const username = await options.prompts.text(
      'Nombre de usuario administrador: ',
    )
    const account = findAdminForLocalReset(db, username)

    const confirmation = await options.prompts.text(
      `Escribe "${account.username}" para confirmar el reinicio: `,
    )
    if (confirmation !== account.username) {
      throw new Error('Confirmación cancelada. No se cambió ninguna contraseña.')
    }

    if (account.isActive !== 1) {
      console.warn(
        'Aviso: la cuenta está inactiva; no podrá iniciar sesión hasta reactivarla.',
      )
    }

    const newPassword = await promptValidPassword(options.prompts)

    await resetAdminPasswordLocal(
      { db, hasher },
      { account, newPassword, now: clock() },
    )
  } finally {
    db.close()
  }
}
