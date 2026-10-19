import { fileURLToPath } from 'node:url'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../db/database'
import { runMigrations } from '../db/migrate'
import { seedAll } from '../seeds'

const MIGRATIONS_DIR = fileURLToPath(
  new URL('../../../../migrations/', import.meta.url),
)

export function createTestDatabase(
  now: Date = new Date('2026-10-18T12:00:00.000Z'),
): DatabaseSync {
  const db = openDatabase(':memory:')
  runMigrations(db, MIGRATIONS_DIR)
  seedAll(db, now)
  return db
}
