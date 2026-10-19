import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'

const MIGRATION_FILE = /^(\d+)-[a-z0-9-]+\.sql$/

/**
 * Aplica migraciones SQL en orden, de forma atómica y solo hacia adelante
 * (BD-09 a BD-16). Una migración fallida aborta el arranque.
 */
export function runMigrations(db: DatabaseSync, migrationsDir: string): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)

  if (!existsSync(migrationsDir)) {
    return 0
  }

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  const appliedRows = db
    .prepare('SELECT version FROM schema_migrations')
    .all() as Array<{ version: string }>
  const applied = new Set(appliedRows.map((row) => row.version))

  let count = 0

  for (const file of files) {
    const match = MIGRATION_FILE.exec(file)
    if (!match) {
      throw new Error(`Migración inválida (se espera NNN-nombre.sql): ${file}`)
    }

    const version = match[1]
    if (version === undefined || applied.has(version)) {
      continue
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8')

    db.exec('BEGIN')
    try {
      db.exec(sql)
      db.prepare(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      ).run(version, file, new Date().toISOString())
      db.exec('COMMIT')
      count += 1
    } catch (error) {
      db.exec('ROLLBACK')
      throw new Error(`Falló la migración ${file}`, { cause: error })
    }
  }

  return count
}
