import type { DatabaseSync } from 'node:sqlite'
import { seedIdentity } from './modules/identity/seed'
import { seedPersonal } from './modules/personal/seed'
import { seedRecords } from './modules/records/seed'

/**
 * Datos iniciales de todos los módulos, insert-only (BD-19, BD-21).
 */
export function seedAll(db: DatabaseSync, now: Date): void {
  seedIdentity(db, now)
  seedPersonal(db, now)
  seedRecords(db)
}
