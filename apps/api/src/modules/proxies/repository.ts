import type { DatabaseSync } from 'node:sqlite'
import type {
  ProxyEnvironment,
  ProxyProtocol,
} from '@qabase/shared'

export type SettingsRow = { host: string; version: number }

export function findSettings(db: DatabaseSync): SettingsRow | undefined {
  return db
    .prepare('SELECT host, version FROM proxy_settings WHERE id = 1')
    .get() as SettingsRow | undefined
}

export function saveSettings(
  db: DatabaseSync,
  host: string,
  version: number | undefined,
  now: string,
): boolean {
  if (version === undefined) {
    return (
      Number(
        db
          .prepare(
            `INSERT OR IGNORE INTO proxy_settings
              (id, host, version, created_at, updated_at)
             VALUES (1, ?, 1, ?, ?)`,
          )
          .run(host, now, now).changes,
      ) === 1
    )
  }
  return (
    Number(
      db
        .prepare(
          `UPDATE proxy_settings
              SET host = ?, version = version + 1, updated_at = ?
            WHERE id = 1 AND version = ?`,
        )
        .run(host, now, version).changes,
    ) === 1
  )
}

export type ServiceRow = {
  id: number
  slug: string
  name: string
  environment: ProxyEnvironment
  protocol: ProxyProtocol
  entry: string
  healthPath: string | null
  isActive: number
  version: number
  createdAt: string
  updatedAt: string
}

export type PortRow = {
  serviceId: number
  port: number
  isPrimary: number
}

export type RouteRow = {
  id: number
  serviceId: number
  path: string
  target: string
  accessId: number | null
  detail: string | null
  sortOrder: number
}

export type RouteAccessRow = {
  id: number
  address: string
  port: number
  portEnd: number
  environment: ProxyEnvironment
  detail: string | null
  isActive: number
}

export type RuntimeRow = {
  serviceId: number
  pid: number | null
  startedAt: string | null
  startedByQabase: number
  lastExitCode: number | null
  lastError: string | null
  updatedAt: string
}

const SERVICE_COLUMNS = `
  id,
  slug,
  name,
  environment,
  protocol,
  entry,
  health_path AS healthPath,
  is_active AS isActive,
  version,
  created_at AS createdAt,
  updated_at AS updatedAt
`

export function listServiceRows(db: DatabaseSync): ServiceRow[] {
  return db
    .prepare(
      `SELECT ${SERVICE_COLUMNS}
         FROM proxy_services
        ORDER BY name COLLATE NOCASE, id`,
    )
    .all() as ServiceRow[]
}

export function findService(
  db: DatabaseSync,
  id: number,
): ServiceRow | undefined {
  return db
    .prepare(`SELECT ${SERVICE_COLUMNS} FROM proxy_services WHERE id = ?`)
    .get(id) as ServiceRow | undefined
}

export function listPortRows(db: DatabaseSync): PortRow[] {
  return db
    .prepare(
      `SELECT service_id AS serviceId, port, is_primary AS isPrimary
         FROM proxy_ports
        ORDER BY service_id, is_primary DESC, port`,
    )
    .all() as PortRow[]
}

export function listRouteRows(db: DatabaseSync): RouteRow[] {
  return db
    .prepare(
      `SELECT id, service_id AS serviceId, path, target,
              access_id AS accessId, detail, sort_order AS sortOrder
         FROM proxy_routes
        ORDER BY service_id, sort_order, id`,
    )
    .all() as RouteRow[]
}

export function findRouteAccess(
  db: DatabaseSync,
  id: number,
): RouteAccessRow | undefined {
  return db
    .prepare(
      `SELECT id, address, port, port_end AS portEnd, environment,
              detail, is_active AS isActive
         FROM accesses
        WHERE id = ?`,
    )
    .get(id) as RouteAccessRow | undefined
}

export type AllowlistRow = {
  serviceId: number
  cidr: string
}

export function listAllowlistRows(db: DatabaseSync): AllowlistRow[] {
  return db
    .prepare(
      `SELECT service_id AS serviceId, cidr
         FROM proxy_allowlist
        ORDER BY service_id, cidr`,
    )
    .all() as AllowlistRow[]
}

export function replaceAllowlist(
  db: DatabaseSync,
  serviceId: number,
  cidrs: string[],
): void {
  db.prepare('DELETE FROM proxy_allowlist WHERE service_id = ?').run(serviceId)
  const insert = db.prepare(
    'INSERT INTO proxy_allowlist (service_id, cidr) VALUES (?, ?)',
  )
  for (const cidr of cidrs) {
    insert.run(serviceId, cidr)
  }
}

export function listRuntimeRows(db: DatabaseSync): RuntimeRow[] {
  return db
    .prepare(
      `SELECT service_id AS serviceId, pid, started_at AS startedAt,
              started_by_qabase AS startedByQabase,
              last_exit_code AS lastExitCode, last_error AS lastError,
              updated_at AS updatedAt
         FROM proxy_runtime`,
    )
    .all() as RuntimeRow[]
}

export function findRuntime(
  db: DatabaseSync,
  serviceId: number,
): RuntimeRow | undefined {
  return db
    .prepare(
      `SELECT service_id AS serviceId, pid, started_at AS startedAt,
              started_by_qabase AS startedByQabase,
              last_exit_code AS lastExitCode, last_error AS lastError,
              updated_at AS updatedAt
         FROM proxy_runtime
        WHERE service_id = ?`,
    )
    .get(serviceId) as RuntimeRow | undefined
}

export function saveRuntime(
  db: DatabaseSync,
  serviceId: number,
  input: {
    pid: number | null
    startedAt: string | null
    startedByQabase: boolean
    lastExitCode: number | null
    lastError: string | null
  },
  now: string,
): void {
  db.prepare(
    `INSERT INTO proxy_runtime
      (service_id, pid, started_at, started_by_qabase, last_exit_code,
       last_error, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (service_id) DO UPDATE SET
       pid = excluded.pid,
       started_at = excluded.started_at,
       started_by_qabase = excluded.started_by_qabase,
       last_exit_code = excluded.last_exit_code,
       last_error = excluded.last_error,
       updated_at = excluded.updated_at`,
  ).run(
    serviceId,
    input.pid,
    input.startedAt,
    input.startedByQabase ? 1 : 0,
    input.lastExitCode,
    input.lastError,
    now,
  )
}
