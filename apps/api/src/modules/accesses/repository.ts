import { escapeLikePattern, normalizeSearchText } from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import type {
  AccessEnvironment,
  AccessProtocol,
} from './validation'

export type AccessRow = {
  id: number
  address: string
  port: number
  portEnd: number
  environment: AccessEnvironment
  protocol: AccessProtocol | null
  detail: string | null
  applications: string | null
  urls: string | null
  isActive: number
  version: number
  createdAt: string
  updatedAt: string
}

export type AccessStatusFilter = 'all' | 'active' | 'inactive'
export type AccessProtocolFilter = 'all' | AccessProtocol | 'none'

export type AccessFilters = {
  q: string
  environment?: AccessEnvironment
  status: AccessStatusFilter
  protocol: AccessProtocolFilter
}

const ACCESS_COLUMNS = `
  id,
  address,
  port,
  port_end AS portEnd,
  environment,
  protocol,
  detail,
  applications,
  urls,
  is_active AS isActive,
  version,
  created_at AS createdAt,
  updated_at AS updatedAt
`

function buildWhere(filters: AccessFilters): {
  sql: string
  params: Array<string | number>
} {
  const conditions: string[] = []
  const params: Array<string | number> = []
  const search = filters.q.trim()

  if (search !== '') {
    const pattern = `%${escapeLikePattern(normalizeSearchText(search))}%`
    conditions.push(`(
      normalize_text(address) LIKE ? ESCAPE '\\'
      OR normalize_text(COALESCE(detail, '')) LIKE ? ESCAPE '\\'
      OR normalize_text(COALESCE(applications, '')) LIKE ? ESCAPE '\\'
      OR normalize_text(COALESCE(urls, '')) LIKE ? ESCAPE '\\'
      OR CAST(port AS TEXT) LIKE ? ESCAPE '\\'
      OR CAST(port_end AS TEXT) LIKE ? ESCAPE '\\'
      OR (CAST(port AS TEXT) || '-' || CAST(port_end AS TEXT)) LIKE ? ESCAPE '\\'
    )`)
    params.push(
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
    )
  }

  if (filters.environment !== undefined) {
    conditions.push('environment = ?')
    params.push(filters.environment)
  }

  if (filters.status === 'active') {
    conditions.push('is_active = 1')
  } else if (filters.status === 'inactive') {
    conditions.push('is_active = 0')
  }

  if (filters.protocol === 'none') {
    conditions.push('protocol IS NULL')
  } else if (filters.protocol !== 'all') {
    conditions.push('protocol = ?')
    params.push(filters.protocol)
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

export function listAccesses(
  db: DatabaseSync,
  filters: AccessFilters,
): AccessRow[] {
  const where = buildWhere(filters)
  return db
    .prepare(
      `SELECT ${ACCESS_COLUMNS}
         FROM accesses
         ${where.sql}
        ORDER BY
          CASE environment
            WHEN 'development' THEN 0
            WHEN 'qa' THEN 1
            WHEN 'production' THEN 2
            ELSE 3
          END,
          address ASC,
          port ASC,
          port_end ASC,
          id ASC`,
    )
    .all(...where.params) as AccessRow[]
}

export function findAccessById(
  db: DatabaseSync,
  accessId: number,
): AccessRow | null {
  return (
    (db
      .prepare(`SELECT ${ACCESS_COLUMNS} FROM accesses WHERE id = ?`)
      .get(accessId) as AccessRow | undefined) ?? null
  )
}

export function findAccessByKey(
  db: DatabaseSync,
  input: {
    addressNormalized: string
    port: number
    portEnd: number
    environment: AccessEnvironment
    exceptId?: number
  },
): AccessRow | null {
  const row = db
    .prepare(
      `SELECT ${ACCESS_COLUMNS}
         FROM accesses
        WHERE address_normalized = ? AND port = ? AND port_end = ?
          AND environment = ? AND (? IS NULL OR id <> ?)`,
    )
    .get(
      input.addressNormalized,
      input.port,
      input.portEnd,
      input.environment,
      input.exceptId ?? null,
      input.exceptId ?? null,
    ) as AccessRow | undefined

  return row ?? null
}

export function insertAccess(
  db: DatabaseSync,
  input: {
    address: string
    addressNormalized: string
    port: number
    portEnd: number
    environment: AccessEnvironment
    protocol: AccessProtocol | null
    detail: string | null
    applications: string | null
    urls: string | null
    now: string
  },
): number {
  const result = db
    .prepare(
      `INSERT INTO accesses
        (address, address_normalized, port, port_end, environment, protocol,
         detail, applications, urls, is_active, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`,
    )
    .run(
      input.address,
      input.addressNormalized,
      input.port,
      input.portEnd,
      input.environment,
      input.protocol,
      input.detail,
      input.applications,
      input.urls,
      input.now,
      input.now,
    )

  return Number(result.lastInsertRowid)
}

export function updateAccess(
  db: DatabaseSync,
  input: {
    accessId: number
    address?: string
    addressNormalized?: string
    port?: number
    portEnd?: number
    environment?: AccessEnvironment
    protocol?: AccessProtocol | null
    detail?: string | null
    applications?: string | null
    urls?: string | null
    isActive?: boolean
    expectedVersion: number
    now: string
  },
): boolean {
  const sets: string[] = []
  const values: Array<string | number | null> = []

  if (input.address !== undefined && input.addressNormalized !== undefined) {
    sets.push('address = ?', 'address_normalized = ?')
    values.push(input.address, input.addressNormalized)
  }
  if (input.port !== undefined) {
    sets.push('port = ?')
    values.push(input.port)
  }
  if (input.portEnd !== undefined) {
    sets.push('port_end = ?')
    values.push(input.portEnd)
  }
  if (input.environment !== undefined) {
    sets.push('environment = ?')
    values.push(input.environment)
  }
  if (input.protocol !== undefined) {
    sets.push('protocol = ?')
    values.push(input.protocol)
  }
  if (input.detail !== undefined) {
    sets.push('detail = ?')
    values.push(input.detail)
  }
  if (input.applications !== undefined) {
    sets.push('applications = ?')
    values.push(input.applications)
  }
  if (input.urls !== undefined) {
    sets.push('urls = ?')
    values.push(input.urls)
  }
  if (input.isActive !== undefined) {
    sets.push('is_active = ?')
    values.push(input.isActive ? 1 : 0)
  }

  sets.push('version = version + 1', 'updated_at = ?')
  values.push(input.now, input.accessId, input.expectedVersion)

  const result = db
    .prepare(
      `UPDATE accesses SET ${sets.join(', ')}
        WHERE id = ? AND version = ?`,
    )
    .run(...values)

  return Number(result.changes) === 1
}
