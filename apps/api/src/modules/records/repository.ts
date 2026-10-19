import { escapeLikePattern, normalizeSearchText } from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import { listPeople, type PersonRow } from '../personal/repository'

export type RecordType = 'merito' | 'incidencia'
export type RecordStatus = 'vigente' | 'anulado'

export type RecordRow = {
  id: number
  qaId: number
  qaName: string
  qaIsActive: number
  type: RecordType
  eventDate: string
  level: number
  levelLabel: string
  detail: string
  status: RecordStatus
  annulReason: string | null
  annulledAt: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type RecordFilters = {
  from?: string
  to?: string
  qaId?: number
  type?: RecordType
  level?: number
  text?: string
  includeAnnulled: boolean
}

export type LevelRow = {
  type: RecordType
  level: number
  label: string
  description: string
}

const RECORD_COLUMNS = `
  r.id,
  r.qa_id AS qaId,
  p.name AS qaName,
  p.is_active AS qaIsActive,
  r.type,
  r.event_date AS eventDate,
  r.level,
  il.label AS levelLabel,
  r.detail,
  r.status,
  r.annul_reason AS annulReason,
  r.annulled_at AS annulledAt,
  r.version,
  r.created_at AS createdAt,
  r.updated_at AS updatedAt
`

const RECORD_FROM = `
  FROM records r
  JOIN personal_qa p ON p.id = r.qa_id
  JOIN impact_levels il ON il.type = r.type AND il.level = r.level
`

function buildConditions(
  filters: RecordFilters,
  forceVigente: boolean,
): { sql: string; params: Array<string | number> } {
  const conditions: string[] = []
  const params: Array<string | number> = []

  if (filters.from !== undefined) {
    conditions.push('r.event_date >= ?')
    params.push(filters.from)
  }
  if (filters.to !== undefined) {
    conditions.push('r.event_date <= ?')
    params.push(filters.to)
  }
  if (filters.qaId !== undefined) {
    conditions.push('r.qa_id = ?')
    params.push(filters.qaId)
  }
  if (filters.type !== undefined) {
    conditions.push('r.type = ?')
    params.push(filters.type)
  }
  if (filters.level !== undefined) {
    conditions.push('r.level = ?')
    params.push(filters.level)
  }
  if (filters.text !== undefined && filters.text.trim() !== '') {
    conditions.push("normalize_text(r.detail) LIKE ? ESCAPE '\\'")
    params.push(
      `%${escapeLikePattern(normalizeSearchText(filters.text.trim()))}%`,
    )
  }
  if (forceVigente || !filters.includeAnnulled) {
    conditions.push("r.status = 'vigente'")
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

export function listRecords(
  db: DatabaseSync,
  filters: RecordFilters,
  input: { limit: number; offset: number },
): RecordRow[] {
  const where = buildConditions(filters, false)
  return db
    .prepare(
      `SELECT ${RECORD_COLUMNS}
         ${RECORD_FROM}
         ${where.sql}
        ORDER BY r.event_date DESC, r.created_at DESC, r.id DESC
        LIMIT ? OFFSET ?`,
    )
    .all(...where.params, input.limit, input.offset) as RecordRow[]
}

export function countRecords(
  db: DatabaseSync,
  filters: RecordFilters,
): number {
  const where = buildConditions(filters, false)
  const row = db
    .prepare(`SELECT COUNT(*) AS total FROM records r ${where.sql}`)
    .get(...where.params) as { total: number }
  return row.total
}

export function getTotals(
  db: DatabaseSync,
  filters: RecordFilters,
): Map<RecordType, { count: number; points: number }> {
  const where = buildConditions(filters, true)
  const rows = db
    .prepare(
      `SELECT type, COUNT(*) AS count, COALESCE(SUM(level), 0) AS points
         FROM records r
         ${where.sql}
        GROUP BY type`,
    )
    .all(...where.params) as Array<{
    type: RecordType
    count: number
    points: number
  }>

  return new Map(rows.map((row) => [row.type, { count: row.count, points: row.points }]))
}

export function getByQaMetrics(
  db: DatabaseSync,
  filters: RecordFilters,
): Map<number, Map<RecordType, { count: number; points: number }>> {
  const where = buildConditions(filters, true)
  const rows = db
    .prepare(
      `SELECT qa_id AS qaId, type, COUNT(*) AS count,
              COALESCE(SUM(level), 0) AS points
         FROM records r
         ${where.sql}
        GROUP BY qa_id, type`,
    )
    .all(...where.params) as Array<{
    qaId: number
    type: RecordType
    count: number
    points: number
  }>

  const result = new Map<number, Map<RecordType, { count: number; points: number }>>()
  for (const row of rows) {
    const metrics =
      result.get(row.qaId) ??
      new Map<RecordType, { count: number; points: number }>()
    metrics.set(row.type, { count: row.count, points: row.points })
    result.set(row.qaId, metrics)
  }
  return result
}

export function findRecordById(
  db: DatabaseSync,
  recordId: number,
): RecordRow | null {
  return (
    (db
      .prepare(
        `SELECT ${RECORD_COLUMNS} ${RECORD_FROM} WHERE r.id = ?`,
      )
      .get(recordId) as RecordRow | undefined) ?? null
  )
}

export function insertRecord(
  db: DatabaseSync,
  input: {
    qaId: number
    type: RecordType
    eventDate: string
    level: number
    detail: string
    now: string
  },
): number {
  const result = db
    .prepare(
      `INSERT INTO records
        (qa_id, type, event_date, level, detail, status, version,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'vigente', 1, ?, ?)`,
    )
    .run(
      input.qaId,
      input.type,
      input.eventDate,
      input.level,
      input.detail,
      input.now,
      input.now,
    )
  return Number(result.lastInsertRowid)
}

export function updateRecord(
  db: DatabaseSync,
  input: {
    recordId: number
    qaId: number
    type: RecordType
    eventDate: string
    level: number
    detail: string
    expectedVersion: number
    now: string
  },
): boolean {
  const result = db
    .prepare(
      `UPDATE records
          SET qa_id = ?, type = ?, event_date = ?, level = ?, detail = ?,
              version = version + 1, updated_at = ?
        WHERE id = ? AND version = ? AND status = 'vigente'`,
    )
    .run(
      input.qaId,
      input.type,
      input.eventDate,
      input.level,
      input.detail,
      input.now,
      input.recordId,
      input.expectedVersion,
    )
  return Number(result.changes) === 1
}

export function annulRecord(
  db: DatabaseSync,
  input: {
    recordId: number
    reason: string
    actorAccountId: number
    expectedVersion: number
    now: string
  },
): boolean {
  const result = db
    .prepare(
      `UPDATE records
          SET status = 'anulado', annulled_at = ?, annulled_by = ?,
              annul_reason = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ? AND status = 'vigente'`,
    )
    .run(
      input.now,
      input.actorAccountId,
      input.reason,
      input.now,
      input.recordId,
      input.expectedVersion,
    )
  return Number(result.changes) === 1
}

export function listLevels(db: DatabaseSync): LevelRow[] {
  return db
    .prepare(
      `SELECT type, level, label, description
         FROM impact_levels
        ORDER BY CASE type WHEN 'merito' THEN 0 ELSE 1 END, level ASC`,
    )
    .all() as LevelRow[]
}

export function listPeopleForSummary(db: DatabaseSync): PersonRow[] {
  return listPeople(db, { includeInactive: true, search: '' })
}
