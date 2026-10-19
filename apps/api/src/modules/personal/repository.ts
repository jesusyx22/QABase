import { escapeLikePattern, normalizeSearchText } from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'

export type PersonRow = {
  id: number
  sourceId: number | null
  name: string
  isActive: number
  version: number
  createdAt: string
  updatedAt: string
}

const PERSON_COLUMNS = `
  id,
  source_id AS sourceId,
  name,
  is_active AS isActive,
  version,
  created_at AS createdAt,
  updated_at AS updatedAt
`

export function listPeople(
  db: DatabaseSync,
  input: { includeInactive: boolean; search: string },
): PersonRow[] {
  const search = input.search.trim()
  const pattern = `%${escapeLikePattern(normalizeSearchText(search))}%`

  const rows = db
    .prepare(
      `SELECT ${PERSON_COLUMNS}
         FROM personal_qa
        WHERE (? = 1 OR is_active = 1)
          AND (? = '' OR normalize_text(name) LIKE ? ESCAPE '\\')`,
    )
    .all(
      input.includeInactive ? 1 : 0,
      search === '' ? '' : pattern,
      pattern,
    ) as PersonRow[]

  return rows.sort(
    (left, right) =>
      left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }) ||
      left.id - right.id,
  )
}

export function findPersonById(
  db: DatabaseSync,
  personId: number,
): PersonRow | null {
  return (
    (db
      .prepare(`SELECT ${PERSON_COLUMNS} FROM personal_qa WHERE id = ?`)
      .get(personId) as PersonRow | undefined) ?? null
  )
}

export function insertPerson(
  db: DatabaseSync,
  input: { name: string; now: string },
): number {
  const result = db
    .prepare(
      `INSERT INTO personal_qa
        (source_id, name, is_active, version, created_at, updated_at)
       VALUES (NULL, ?, 1, 1, ?, ?)`,
    )
    .run(input.name, input.now, input.now)
  return Number(result.lastInsertRowid)
}

export function updatePerson(
  db: DatabaseSync,
  input: {
    personId: number
    name?: string
    isActive?: boolean
    expectedVersion: number
    now: string
  },
): boolean {
  const sets: string[] = []
  const values: Array<string | number> = []

  if (input.name !== undefined) {
    sets.push('name = ?')
    values.push(input.name)
  }
  if (input.isActive !== undefined) {
    sets.push('is_active = ?')
    values.push(input.isActive ? 1 : 0)
  }

  sets.push('version = version + 1', 'updated_at = ?')
  values.push(input.now, input.personId, input.expectedVersion)

  const result = db
    .prepare(
      `UPDATE personal_qa SET ${sets.join(', ')}
        WHERE id = ? AND version = ?`,
    )
    .run(...values)

  return Number(result.changes) === 1
}

export function insertSeedPerson(
  db: DatabaseSync,
  input: { sourceId: number; name: string; now: string },
): void {
  db.prepare(
    `INSERT OR IGNORE INTO personal_qa
      (source_id, name, is_active, version, created_at, updated_at)
     VALUES (?, ?, 1, 1, ?, ?)`,
  ).run(input.sourceId, input.name, input.now, input.now)
}
