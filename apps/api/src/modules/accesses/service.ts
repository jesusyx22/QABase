import type { DatabaseSync } from 'node:sqlite'
import { insertAuditEvent, listAuditEvents } from '../../core/audit'
import { conflict, invalidInput, notFound } from '../../core/errors'
import { inTransaction } from '../../core/transaction'
import type { Actor } from '../identity/actor'
import {
  findAccessById,
  findAccessByKey,
  insertAccess,
  listAccesses,
  updateAccess,
  type AccessFilters,
  type AccessProtocolFilter,
  type AccessRow,
  type AccessStatusFilter,
} from './repository'
import {
  isAccessEnvironment,
  isAccessProtocol,
  validateAddress,
  validateApplications,
  validateDetail,
  validateEnvironment,
  validatePort,
  validatePortEnd,
  validateProtocol,
  validateUrls,
  type AccessEnvironment,
  type AccessProtocol,
} from './validation'

export type AccessView = {
  id: number
  address: string
  port: number
  portEnd: number
  environment: AccessEnvironment
  protocol: AccessProtocol | null
  detail: string | null
  applications: string | null
  urls: string | null
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export type AccessQuery = {
  q?: string
  environment?: string
  status?: string
  protocol?: string
}

export type HistoryEvent = {
  occurredAt: string
  actorUsername: string | null
  channel: 'app' | 'local'
  action: string
  before: unknown
  after: unknown
}

function toView(row: AccessRow): AccessView {
  return {
    id: row.id,
    address: row.address,
    port: row.port,
    portEnd: row.portEnd,
    environment: row.environment,
    protocol: row.protocol,
    detail: row.detail,
    applications: row.applications,
    urls: row.urls,
    isActive: row.isActive === 1,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function snapshot(row: AccessRow): {
  address: string
  port: number
  portEnd: number
  environment: AccessEnvironment
  protocol: AccessProtocol | null
  detail: string | null
  applications: string | null
  urls: string | null
  isActive: boolean
} {
  return {
    address: row.address,
    port: row.port,
    portEnd: row.portEnd,
    environment: row.environment,
    protocol: row.protocol,
    detail: row.detail,
    applications: row.applications,
    urls: row.urls,
    isActive: row.isActive === 1,
  }
}

function audit(
  db: DatabaseSync,
  actor: Actor,
  action: string,
  accessId: number,
  now: Date,
  before?: unknown,
  after?: unknown,
): void {
  insertAuditEvent(
    db,
    {
      actorAccountId: actor.id,
      actorUsername: actor.username,
      channel: 'app',
      module: 'accesses',
      entityType: 'access',
      entityId: String(accessId),
      action,
      before,
      after,
    },
    now.toISOString(),
  )
}

function parseFilters(query: AccessQuery): AccessFilters {
  const status = query.status ?? 'all'
  if (status !== 'all' && status !== 'active' && status !== 'inactive') {
    throw invalidInput('El filtro de estado no es válido.')
  }

  const protocol = query.protocol ?? 'all'
  if (
    protocol !== 'all' &&
    protocol !== 'none' &&
    !isAccessProtocol(protocol)
  ) {
    throw invalidInput('El filtro de protocolo no es válido.')
  }

  const environment =
    query.environment === 'all' ? undefined : query.environment
  if (environment !== undefined && !isAccessEnvironment(environment)) {
    throw invalidInput('El filtro de ambiente no es válido.')
  }

  return {
    q: query.q ?? '',
    environment,
    status: status as AccessStatusFilter,
    protocol: protocol as AccessProtocolFilter,
  }
}

export function listAccessViews(
  db: DatabaseSync,
  query: AccessQuery,
): AccessView[] {
  return listAccesses(db, parseFilters(query)).map(toView)
}

export function getAccessView(
  db: DatabaseSync,
  accessId: number,
): AccessView {
  const row = findAccessById(db, accessId)
  if (!row) {
    throw notFound('El acceso no existe.')
  }
  return toView(row)
}

export function createAccess(
  db: DatabaseSync,
  actor: Actor,
  input: {
    address: string
    port: number
    portEnd?: number | null
    environment: string
    protocol?: string | null
    detail?: string | null
    applications?: string | null
    urls?: string | null
    now: Date
  },
): AccessView {
  const address = validateAddress(input.address)
  const port = validatePort(input.port)
  const portEnd = validatePortEnd(input.portEnd, port)
  const environment = validateEnvironment(input.environment)
  const protocol = validateProtocol(input.protocol)
  const detail = validateDetail(input.detail)
  const applications = validateApplications(input.applications)
  const urls = validateUrls(input.urls)

  if (
    findAccessByKey(db, {
      addressNormalized: address.addressNormalized,
      port,
      portEnd,
      environment,
    })
  ) {
    throw conflict(
      'Ya existe un acceso con esa dirección, rango de puertos y ambiente.',
    )
  }

  const timestamp = input.now.toISOString()

  try {
    return inTransaction(db, () => {
      const accessId = insertAccess(db, {
        ...address,
        port,
        portEnd,
        environment,
        protocol,
        detail,
        applications,
        urls,
        now: timestamp,
      })
      const row = findAccessById(db, accessId)!
      audit(db, actor, 'access.created', accessId, input.now, undefined, snapshot(row))
      return toView(row)
    })
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed: accesses')) {
      throw conflict(
        'Ya existe un acceso con esa dirección, rango de puertos y ambiente.',
      )
    }
    throw error
  }
}

export function updateAccessDetails(
  db: DatabaseSync,
  actor: Actor,
  accessId: number,
  input: {
    address?: string
    port?: number
    portEnd?: number | null
    environment?: string
    protocol?: string | null
    detail?: string | null
    applications?: string | null
    urls?: string | null
    isActive?: boolean
    version: number
    now: Date
  },
): AccessView {
  const existing = findAccessById(db, accessId)
  if (!existing) {
    throw notFound('El acceso no existe.')
  }

  const hasChanges =
    input.address !== undefined ||
    input.port !== undefined ||
    input.portEnd !== undefined ||
    input.environment !== undefined ||
    input.protocol !== undefined ||
    input.detail !== undefined ||
    input.applications !== undefined ||
    input.urls !== undefined ||
    input.isActive !== undefined

  if (!hasChanges) {
    throw invalidInput('No hay cambios para guardar.')
  }

  const address =
    input.address === undefined
      ? { address: existing.address, addressNormalized: existing.address.toLowerCase() }
      : validateAddress(input.address)
  const port = input.port === undefined ? existing.port : validatePort(input.port)
  const portEnd =
    input.portEnd === undefined
      ? input.port === undefined
        ? existing.portEnd
        : port
      : validatePortEnd(input.portEnd, port)
  const environment =
    input.environment === undefined
      ? existing.environment
      : validateEnvironment(input.environment)
  const protocol =
    input.protocol === undefined
      ? existing.protocol
      : validateProtocol(input.protocol)
  const detail =
    input.detail === undefined
      ? existing.detail
      : validateDetail(input.detail)
  const applications =
    input.applications === undefined
      ? existing.applications
      : validateApplications(input.applications)
  const urls =
    input.urls === undefined ? existing.urls : validateUrls(input.urls)

  const nextIsActive =
    input.isActive === undefined
      ? existing.isActive === 1
      : input.isActive

  if (
    address.address === existing.address &&
    port === existing.port &&
    portEnd === existing.portEnd &&
    environment === existing.environment &&
    protocol === existing.protocol &&
    detail === existing.detail &&
    applications === existing.applications &&
    urls === existing.urls &&
    nextIsActive === (existing.isActive === 1)
  ) {
    throw invalidInput('No hay cambios para guardar.')
  }

  if (
    findAccessByKey(db, {
      addressNormalized: address.addressNormalized,
      port,
      portEnd,
      environment,
      exceptId: accessId,
    })
  ) {
    throw conflict(
      'Ya existe un acceso con esa dirección, rango de puertos y ambiente.',
    )
  }

  const before = snapshot(existing)
  const timestamp = input.now.toISOString()

  try {
    return inTransaction(db, () => {
      const updated = updateAccess(db, {
        accessId,
        address: input.address === undefined ? undefined : address.address,
        addressNormalized:
          input.address === undefined ? undefined : address.addressNormalized,
        port: input.port === undefined ? undefined : port,
        portEnd:
          input.portEnd === undefined && input.port === undefined
            ? undefined
            : portEnd,
        environment: input.environment === undefined ? undefined : environment,
        protocol: input.protocol === undefined ? undefined : protocol,
        detail: input.detail === undefined ? undefined : detail,
        applications:
          input.applications === undefined ? undefined : applications,
        urls: input.urls === undefined ? undefined : urls,
        isActive: input.isActive,
        expectedVersion: input.version,
        now: timestamp,
      })
      if (!updated) {
        throw conflict()
      }

      const row = findAccessById(db, accessId)!
      const after = snapshot(row)
      const fieldsChanged =
        before.address !== after.address ||
        before.port !== after.port ||
        before.portEnd !== after.portEnd ||
        before.environment !== after.environment ||
        before.protocol !== after.protocol ||
        before.detail !== after.detail ||
        before.applications !== after.applications ||
        before.urls !== after.urls

      if (fieldsChanged) {
        audit(db, actor, 'access.updated', accessId, input.now, before, after)
      }
      if (before.isActive !== after.isActive) {
        audit(
          db,
          actor,
          after.isActive ? 'access.reactivated' : 'access.deactivated',
          accessId,
          input.now,
          { isActive: before.isActive },
          { isActive: after.isActive },
        )
      }

      return toView(row)
    })
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed: accesses')) {
      throw conflict(
        'Ya existe un acceso con esa dirección, rango de puertos y ambiente.',
      )
    }
    throw error
  }
}

export function listAccessHistory(
  db: DatabaseSync,
  accessId: number,
): HistoryEvent[] {
  return listAuditEvents(db, 'access', String(accessId)).map((row) => ({
    occurredAt: row.occurred_at,
    actorUsername: row.actor_username,
    channel: row.channel,
    action: row.action,
    before: row.before_json === null ? null : JSON.parse(row.before_json),
    after: row.after_json === null ? null : JSON.parse(row.after_json),
  }))
}
