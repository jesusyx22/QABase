import type { DatabaseSync } from 'node:sqlite'
import type {
  AccessEnvironment,
  AccessProtocol,
} from '../accesses/validation'

export type AssignmentRow = {
  id: number
  personId: number
  personName: string
  personIsActive: number
  accessId: number
  accessAddress: string
  accessPort: number
  accessPortEnd: number
  accessEnvironment: AccessEnvironment
  accessProtocol: AccessProtocol | null
  accessDetail: string | null
  accessApplications: string | null
  accessUrls: string | null
  accessIsActive: number
  accessVersion: number
  accessCreatedAt: string
  accessUpdatedAt: string
  expiresOn: string
  version: number
  createdAt: string
  updatedAt: string
}

const ASSIGNMENT_COLUMNS = `
  aa.id,
  p.id AS personId,
  p.name AS personName,
  p.is_active AS personIsActive,
  a.id AS accessId,
  a.address AS accessAddress,
  a.port AS accessPort,
  a.port_end AS accessPortEnd,
  a.environment AS accessEnvironment,
  a.protocol AS accessProtocol,
  a.detail AS accessDetail,
  a.applications AS accessApplications,
  a.urls AS accessUrls,
  a.is_active AS accessIsActive,
  a.version AS accessVersion,
  a.created_at AS accessCreatedAt,
  a.updated_at AS accessUpdatedAt,
  aa.expires_on AS expiresOn,
  aa.version,
  aa.created_at AS createdAt,
  aa.updated_at AS updatedAt
`

const ASSIGNMENT_FROM = `
  FROM access_assignments aa
  JOIN personal_qa p ON p.id = aa.person_id
  JOIN accesses a ON a.id = aa.access_id
`

export function listAllAssignments(db: DatabaseSync): AssignmentRow[] {
  return db
    .prepare(
      `SELECT ${ASSIGNMENT_COLUMNS}
       ${ASSIGNMENT_FROM}
       ORDER BY p.name COLLATE NOCASE ASC, aa.expires_on ASC, aa.id ASC`,
    )
    .all() as AssignmentRow[]
}

export function listAssignmentsByPerson(
  db: DatabaseSync,
  personId: number,
): AssignmentRow[] {
  return db
    .prepare(
      `SELECT ${ASSIGNMENT_COLUMNS}
       ${ASSIGNMENT_FROM}
       WHERE aa.person_id = ?
       ORDER BY aa.expires_on ASC, aa.id ASC`,
    )
    .all(personId) as AssignmentRow[]
}

export function listAssignmentsByAccess(
  db: DatabaseSync,
  accessId: number,
): AssignmentRow[] {
  return db
    .prepare(
      `SELECT ${ASSIGNMENT_COLUMNS}
       ${ASSIGNMENT_FROM}
       WHERE aa.access_id = ?
       ORDER BY aa.expires_on ASC, aa.id ASC`,
    )
    .all(accessId) as AssignmentRow[]
}

export function findAssignmentById(
  db: DatabaseSync,
  assignmentId: number,
): AssignmentRow | null {
  return (
    (db
      .prepare(
        `SELECT ${ASSIGNMENT_COLUMNS}
         ${ASSIGNMENT_FROM}
         WHERE aa.id = ?`,
      )
      .get(assignmentId) as AssignmentRow | undefined) ?? null
  )
}

export function findAssignmentByKey(
  db: DatabaseSync,
  input: { personId: number; accessId: number; exceptId?: number },
): AssignmentRow | null {
  const row = db
    .prepare(
      `SELECT ${ASSIGNMENT_COLUMNS}
       ${ASSIGNMENT_FROM}
       WHERE aa.person_id = ? AND aa.access_id = ?
         AND (? IS NULL OR aa.id <> ?)`,
    )
    .get(
      input.personId,
      input.accessId,
      input.exceptId ?? null,
      input.exceptId ?? null,
    ) as AssignmentRow | undefined

  return row ?? null
}

export function insertAssignment(
  db: DatabaseSync,
  input: {
    personId: number
    accessId: number
    expiresOn: string
    now: string
  },
): number {
  const result = db
    .prepare(
      `INSERT INTO access_assignments
        (access_id, person_id, expires_on, version, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
    )
    .run(
      input.accessId,
      input.personId,
      input.expiresOn,
      input.now,
      input.now,
    )

  return Number(result.lastInsertRowid)
}

export function updateAssignment(
  db: DatabaseSync,
  input: {
    assignmentId: number
    personId: number
    accessId: number
    expiresOn: string
    expectedVersion: number
    now: string
  },
): boolean {
  const result = db
    .prepare(
      `UPDATE access_assignments
          SET person_id = ?, access_id = ?, expires_on = ?,
              version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?`,
    )
    .run(
      input.personId,
      input.accessId,
      input.expiresOn,
      input.now,
      input.assignmentId,
      input.expectedVersion,
    )

  return Number(result.changes) === 1
}
