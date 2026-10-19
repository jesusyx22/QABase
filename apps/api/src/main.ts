import { allowedOriginsForPort, loadConfig } from './config'
import { systemClock } from './core/clock'
import { createArgon2Hasher, createDecoyHash } from './core/security/password'
import { requireSessionSecret } from './core/security/session-secret'
import { ensureSyncToken } from './core/security/sync-token'
import { LoginThrottle } from './core/security/throttle'
import { openDatabase } from './db/database'
import { runMigrations } from './db/migrate'
import { seedAll } from './seeds'
import { buildServer } from './server'

const config = loadConfig()

let sessionSecret: string
try {
  sessionSecret = requireSessionSecret(process.env, config.rootDir)
} catch (error) {
  console.error(
    error instanceof Error ? error.message : 'No se pudo resolver el secreto.',
  )
  process.exit(1)
}

const db = openDatabase(config.databasePath)

try {
  runMigrations(db, config.migrationsPath)
  seedAll(db, systemClock())
} catch (error) {
  console.error('No se pudo preparar el esquema. El arranque se aborta.')
  console.error(error)
  db.close()
  process.exit(1)
}

const hasher = createArgon2Hasher()
const decoyHash = await createDecoyHash(hasher)
const syncToken = ensureSyncToken(process.env, config.rootDir)

const app = await buildServer({
  db,
  webDistPath: config.webDistPath,
  sessionSecret,
  syncToken,
  hasher,
  decoyHash,
  clock: systemClock,
  throttle: new LoginThrottle(),
  allowedOrigins: allowedOriginsForPort(config.port),
})

const shutdown = async () => {
  await app.close()
  db.close()
  process.exit(0)
}

process.on('SIGINT', () => {
  void shutdown()
})
process.on('SIGTERM', () => {
  void shutdown()
})

await app.listen({ host: config.host, port: config.port })
console.log(`QABase escuchando en http://${config.host}:${config.port}`)
