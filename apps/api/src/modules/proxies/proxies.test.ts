import { afterEach, expect, it } from 'vitest'
import { createTestDatabase } from '../../test/db'
import type { Actor } from '../identity/actor'
import { createAccess, updateAccessDetails } from '../accesses/service'
import { createFirstAdmin } from '../identity/service'
import { PERMISSION_KEYS } from '@qabase/shared'
import { getProxySettings, updateProxySettings, listProxies, listAccessOptions, createProxy, updateProxy } from './service'

const now = new Date('2026-10-20T12:00:00.000Z')
let actor: Actor
const databases: ReturnType<typeof createTestDatabase>[] = []
async function setup() {
  const db = createTestDatabase(); databases.push(db)
  const id = await createFirstAdmin({ db, hasher: { async hash(value) { return value }, async verify(hash, value) { return hash === value } } }, { username: 'admin', password: 'correct horse battery staple', now })
  actor = { id, username: 'admin', permissions: [...PERMISSION_KEYS] }
  return db
}
afterEach(() => { for (const db of databases.splice(0)) db.close() })
it('configura IPv4 global con versión y rechaza direcciones inválidas o cambios obsoletos', async () => {
  const db = await setup()
  expect(getProxySettings(db)).toEqual({ host: null, version: null })
  expect(updateProxySettings(db, actor, { host: '192.168.1.10', now })).toEqual({ host: '192.168.1.10', version: 1 })
  for (const host of ['example.org', '::1', '256.1.2.3', '1.2.3', '01.2.3.4']) {
    expect(() => updateProxySettings(db, actor, { host, version: 1, now })).toThrow(/IPv4/)
  }
  expect(updateProxySettings(db, actor, { host: '192.168.1.11', version: 1, now })).toEqual({ host: '192.168.1.11', version: 2 })
  expect(() => updateProxySettings(db, actor, { host: '192.168.1.12', version: 1, now })).toThrow(/cambió/)
  expect(() => updateProxySettings(db, actor, { host: '192.168.1.12', now })).toThrow()
  expect(getProxySettings(db)).toEqual({ host: '192.168.1.11', version: 2 })
})

it('lista configuración y ofrece solo accesos activos disponibles con todos sus campos', async () => {
  const db = await setup()
  const access = createAccess(db, actor, { address: '10.0.0.1', port: 443, environment: 'qa', applications: 'Portal', urls: 'https://portal.test', now })
  const inactive = createAccess(db, actor, { address: '10.0.0.2', port: 80, environment: 'production', now })
  updateAccessDetails(db, actor, inactive.id, { isActive: false, version: 1, now })
  expect(listProxies(db)).toEqual({ settings: { host: null, version: null }, proxies: [] })
  expect(listAccessOptions(db)).toEqual([access])
})

it('crea activo, reserva acceso puerto y detalle sin distinguir mayúsculas y exige configuración y acceso activo', async () => {
  const db = await setup()
  const access = createAccess(db, actor, { address: '10.0.0.1', port: 443, environment: 'qa', now })
  const other = createAccess(db, actor, { address: '10.0.0.2', port: 80, environment: 'qa', now })
  const input = { accessId: access.id, port: 8080, detail: '  Portal  ', now }
  expect(() => createProxy(db, actor, input)).toThrow(/global/)
  updateProxySettings(db, actor, { host: '192.168.1.1', now })
  const proxy = createProxy(db, actor, input)
  expect(proxy).toMatchObject({ port: 8080, detail: 'Portal', isActive: true, version: 1, access })
  expect(listProxies(db).proxies).toEqual([proxy])
  expect(listAccessOptions(db)).toEqual([other])
  for (const data of [{ ...input, port: 8081, detail: 'Otro' }, { ...input, accessId: other.id }, { ...input, accessId: other.id, port: 8081, detail: 'portal' }]) {
    expect(() => createProxy(db, actor, data)).toThrow()
  }
  for (const port of [0, 65536, 1.5]) expect(() => createProxy(db, actor, { ...input, accessId: other.id, port, detail: 'Otro' })).toThrow(/puerto/)
  for (const detail of ['   ', 'x'.repeat(201)]) expect(() => createProxy(db, actor, { ...input, accessId: other.id, port: 8081, detail })).toThrow(/detalle/)
  expect(() => createProxy(db, actor, { ...input, accessId: 999 })).toThrow(/no existe/)
  updateAccessDetails(db, actor, other.id, { version: 1, isActive: false, now })
  expect(() => createProxy(db, actor, { ...input, accessId: other.id, port: 8081, detail: 'Otro' })).toThrow(/inactivo/)
})

it('edita y cambia estado con versión; conserva vínculos inactivos y reservas', async () => {
  const db = await setup()
  updateProxySettings(db, actor, { host: '192.168.1.1', now })
  const access = createAccess(db, actor, { address: '10.0.0.1', port: 443, environment: 'qa', now })
  const other = createAccess(db, actor, { address: '10.0.0.2', port: 80, environment: 'production', now })
  const proxy = createProxy(db, actor, { accessId: access.id, port: 8080, detail: 'Zulu', now })
  const second = createProxy(db, actor, { accessId: other.id, port: 8081, detail: 'Alpha', now })
  const blocked = createAccess(db, actor, { address: '10.0.0.4', port: 81, environment: 'qa', now })
  updateAccessDetails(db, actor, blocked.id, { version: 1, isActive: false, now })
  updateAccessDetails(db, actor, access.id, { version: 1, isActive: false, now })
  const updated = updateProxy(db, actor, proxy.id, { port: 9000, detail: 'Beta', isActive: false, version: 1, now })
  expect(updated).toMatchObject({ port: 9000, detail: 'Beta', isActive: false, version: 2, access: { id: access.id, isActive: false } })
  expect(listProxies(db).proxies.map(p => p.detail)).toEqual(['Alpha', 'Beta'])
  expect(() => updateProxy(db, actor, proxy.id, { port: 9001, version: 1, now })).toThrow(/cambió/)
  expect(() => updateProxy(db, actor, proxy.id, { accessId: blocked.id, version: 2, now })).toThrow(/inactivo/)
  const sameLink = updateProxy(db, actor, proxy.id, { accessId: access.id, detail: 'Beta 2', version: 2, now })
  expect(sameLink).toMatchObject({ detail: 'Beta 2', access: { id: access.id, isActive: false }, version: 3 })
  for (const changes of [{ port: 9000 }, { detail: 'beta 2' }, { accessId: access.id }]) expect(() => updateProxy(db, actor, second.id, { ...changes, version: 1, now })).toThrow()
  expect(updateProxy(db, actor, proxy.id, { isActive: true, version: 3, now }).isActive).toBe(true)
  const third = createAccess(db, actor, { address: '10.0.0.3', port: 80, environment: 'qa', now })
  expect(updateProxy(db, actor, proxy.id, { accessId: third.id, version: 4, now }).access.id).toBe(third.id)
  expect(() => updateProxy(db, actor, 999, { detail: 'X', version: 1, now })).toThrow(/no existe/)
})

it('audita configuración, alta, edición y cambios de estado', async () => {
  const db = await setup()
  updateProxySettings(db, actor, { host: '192.168.1.1', now })
  const access = createAccess(db, actor, { address: '10.0.0.1', port: 443, environment: 'qa', now })
  const proxy = createProxy(db, actor, { accessId: access.id, port: 8080, detail: 'Portal', now })
  updateProxy(db, actor, proxy.id, { detail: 'Portal 2', port: 8081, version: 1, now })
  updateProxy(db, actor, proxy.id, { detail: 'Portal 3', isActive: false, version: 2, now })
  updateProxy(db, actor, proxy.id, { isActive: true, version: 3, now })

  const rows = db.prepare(
    "SELECT action, module, actor_username, before_json, after_json FROM audit_events WHERE module = 'proxies' ORDER BY id",
  ).all() as Array<{ action: string; module: string; actor_username: string | null; before_json: string | null; after_json: string | null }>

  expect(rows.map(row => row.action)).toEqual([
    'proxy.settings_updated',
    'proxy.created',
    'proxy.updated',
    'proxy.updated',
    'proxy.deactivated',
    'proxy.reactivated',
  ])
  expect(rows.every(row => row.module === 'proxies' && row.actor_username === 'admin')).toBe(true)
  expect(JSON.parse(rows[1]!.after_json!)).toMatchObject({ detail: 'Portal', port: 8080, isActive: true })
  expect(JSON.parse(rows[3]!.before_json!)).toMatchObject({ detail: 'Portal 2', isActive: true })
  expect(JSON.parse(rows[3]!.after_json!)).toMatchObject({ detail: 'Portal 3', isActive: false })
  expect(JSON.parse(rows[4]!.before_json!)).toEqual({ isActive: true })
  expect(JSON.parse(rows[4]!.after_json!)).toEqual({ isActive: false })
  expect(JSON.parse(rows[5]!.before_json!)).toEqual({ isActive: false })
  expect(JSON.parse(rows[5]!.after_json!)).toEqual({ isActive: true })
})
