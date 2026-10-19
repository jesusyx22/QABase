import { loadConfig } from '../config'
import { createCliPrompts } from './prompts'
import { runSetup } from '../modules/identity/setup'

const config = loadConfig()

try {
  const prompts = createCliPrompts()
  const accountId = await runSetup({
    config,
    env: process.env,
    prompts,
  })
  console.log(`Cuenta administradora creada (id ${accountId}).`)
  console.log('Ya puedes iniciar sesión con QABase.')
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'No se pudo completar el setup.',
  )
  process.exitCode = 1
}
