import type { DatabaseSync } from 'node:sqlite'

/**
 * Transacción corta y explícita. Las escrituras de negocio y su evento de
 * auditoría comparten la misma transacción (BE-43).
 */
export function inTransaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = work()
    db.exec('COMMIT')
    return result
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
