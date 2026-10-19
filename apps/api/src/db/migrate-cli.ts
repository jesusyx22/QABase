import { loadConfig } from '../config'
import { openDatabase } from './database'
import { runMigrations } from './migrate'

const config = loadConfig()
const db = openDatabase(config.databasePath)

try {
  const applied = runMigrations(db, config.migrationsPath)
  console.log(
    applied === 0
      ? 'Sin migraciones pendientes.'
      : `Migraciones aplicadas: ${applied}.`,
  )
} finally {
  db.close()
}
