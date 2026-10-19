import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { normalizeSearchText } from '@qabase/shared'

/**
 * Abre la base local con los pragmas requeridos (BD-02).
 * Un proceso, una conexión, un escritor.
 */
export function openDatabase(path: string): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }

  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec('PRAGMA synchronous = NORMAL')

  // Normalización de búsqueda: minúsculas, conservando tildes y Ñ (BD-44).
  db.function(
    'normalize_text',
    { deterministic: true },
    (value: unknown) => normalizeSearchText(String(value ?? '')),
  )

  return db
}
