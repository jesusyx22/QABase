import { loadConfig } from '../config'
import { createCliPrompts } from './prompts'
import { runResetAdminPassword } from '../modules/identity/reset'

const config = loadConfig()

try {
  const prompts = createCliPrompts()
  await runResetAdminPassword({ config, prompts })
  console.log('Contraseña actualizada. Todas las sesiones de la cuenta se cerraron.')
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : 'No se pudo reiniciar la contraseña.',
  )
  process.exitCode = 1
}
