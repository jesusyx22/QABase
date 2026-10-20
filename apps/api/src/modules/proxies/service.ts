import type {
  CreateProxyInput,
  ProxyListResponse,
  ProxySettings,
  ProxyView,
  UpdateProxyInput,
  UpdateProxySettingsInput,
} from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import { insertAuditEvent } from '../../core/audit'
import { conflict, invalidInput, notFound } from '../../core/errors'
import { inTransaction } from '../../core/transaction'
import { getAccessView, type AccessView } from '../accesses/service'
import type { Actor } from '../identity/actor'
import {
  availableAccessIds,
  findProxy,
  findSettings,
  insertProxy,
  listProxyRows,
  saveSettings,
  updateProxyRow,
  type ProxyRow,
} from './repository'
import {
  validateDetail,
  validateEntityId,
  validateHost,
  validatePort,
  validateVersion,
} from './validation'

export function getProxySettings(db: DatabaseSync): ProxySettings {
  return findSettings(db) ?? { host: null, version: null }
}
function audit(db: DatabaseSync, actor: Actor, action: string, entityType: string, id: number, now: Date, before: unknown, after: unknown): void {
  insertAuditEvent(db, { actorAccountId: actor.id, actorUsername: actor.username, channel: 'app', module: 'proxies', entityType, entityId: String(id), action, before, after }, now.toISOString())
}
export function updateProxySettings(db: DatabaseSync, actor: Actor, input: UpdateProxySettingsInput & { now: Date }): ProxySettings {
  const host = validateHost(input.host)
  if (input.version !== undefined) validateVersion(input.version)
  return inTransaction(db, () => {
    const before = getProxySettings(db)
    if (!saveSettings(db, host, input.version, input.now.toISOString())) throw conflict()
    const after = getProxySettings(db)
    audit(db, actor, 'proxy.settings_updated', 'proxy_settings', 1, input.now, before, after)
    return after
  })
}

function toView(db: DatabaseSync, row: ProxyRow): ProxyView {
  const { accessId, isActive, ...fields } = row
  return { ...fields, isActive: isActive === 1, access: getAccessView(db, accessId) }
}
export function listProxies(db: DatabaseSync): ProxyListResponse {
  return { settings: getProxySettings(db), proxies: listProxyRows(db).map(row => toView(db, row)) }
}
export function listAccessOptions(db: DatabaseSync): AccessView[] {
  return availableAccessIds(db).map(id => getAccessView(db, id))
}

function activeAccess(db: DatabaseSync, id: number): void {
  const access = getAccessView(db, validateEntityId(id, 'Acceso'))
  if (!access.isActive) throw conflict('El acceso está inactivo y no admite nuevos vínculos.')
}
function uniquenessError(error: unknown): never {
  const message = String(error)
  if (message.includes('UNIQUE constraint failed: proxies.access_id')) throw conflict('El acceso ya tiene un proxy.')
  if (message.includes('UNIQUE constraint failed: proxies.port')) throw conflict('El puerto ya está reservado.')
  if (message.includes('UNIQUE constraint failed: proxies.detail_normalized')) throw conflict('El detalle ya existe.')
  throw error
}
export function createProxy(db: DatabaseSync, actor: Actor, input: CreateProxyInput & { now: Date }): ProxyView {
  const port = validatePort(input.port)
  const detail = validateDetail(input.detail)
  try {
    return inTransaction(db, () => {
      if (!findSettings(db)) throw conflict('Configura la IP global antes de crear un proxy.')
      activeAccess(db, input.accessId)
      const id = insertProxy(db, { accessId: input.accessId, port, detail, now: input.now.toISOString() })
      const view = toView(db, findProxy(db, id)!)
      audit(db, actor, 'proxy.created', 'proxy', id, input.now, undefined, view)
      return view
    })
  } catch (error) { return uniquenessError(error) }
}
export function updateProxy(db: DatabaseSync, actor: Actor, id: number, input: UpdateProxyInput & { now: Date }): ProxyView {
  validateEntityId(id, 'Proxy')
  validateVersion(input.version)
  try {
    return inTransaction(db, () => {
      const existing = findProxy(db, id)
      if (!existing) throw notFound('El proxy no existe.')
      if (existing.version !== input.version) throw conflict()
      if (input.accessId !== undefined && input.accessId !== existing.accessId) activeAccess(db, input.accessId)
      if (input.isActive !== undefined && typeof input.isActive !== 'boolean') throw invalidInput('El estado no es válido.')
      if (input.accessId === undefined && input.port === undefined && input.detail === undefined && input.isActive === undefined) throw invalidInput('No hay cambios para guardar.')

      const nextAccessId = input.accessId ?? existing.accessId
      const nextPort = input.port === undefined ? existing.port : validatePort(input.port)
      const nextDetail = input.detail === undefined ? existing.detail : validateDetail(input.detail)
      const nextActive = input.isActive ?? (existing.isActive === 1)
      const fieldsChanged =
        nextAccessId !== existing.accessId ||
        nextPort !== existing.port ||
        nextDetail !== existing.detail
      const statusChanged = nextActive !== (existing.isActive === 1)
      if (!fieldsChanged && !statusChanged) throw invalidInput('No hay cambios para guardar.')

      const before = toView(db, existing)
      const changes = {
        id, accessId: nextAccessId, port: nextPort, detail: nextDetail,
        isActive: nextActive, version: input.version, now: input.now.toISOString(),
      }
      if (!updateProxyRow(db, changes)) throw conflict()
      const after = toView(db, findProxy(db, id)!)

      if (fieldsChanged) {
        audit(db, actor, 'proxy.updated', 'proxy', id, input.now, before, after)
      }
      if (statusChanged) {
        audit(
          db, actor,
          after.isActive ? 'proxy.reactivated' : 'proxy.deactivated',
          'proxy', id, input.now,
          { isActive: before.isActive },
          { isActive: after.isActive },
        )
      }
      return after
    })
  } catch (error) { return uniquenessError(error) }
}
