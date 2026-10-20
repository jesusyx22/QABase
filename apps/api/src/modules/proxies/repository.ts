import type { DatabaseSync } from 'node:sqlite'
export type SettingsRow = { host: string; version: number }
export function findSettings(db: DatabaseSync): SettingsRow | undefined {
  return db.prepare('SELECT host, version FROM proxy_settings WHERE id = 1').get() as SettingsRow | undefined
}
export function saveSettings(db: DatabaseSync, host: string, version: number | undefined, now: string): boolean {
  if (version === undefined) {
    return Number(db.prepare('INSERT OR IGNORE INTO proxy_settings (id, host, version, created_at, updated_at) VALUES (1, ?, 1, ?, ?)').run(host, now, now).changes) === 1
  }
  return Number(db.prepare('UPDATE proxy_settings SET host = ?, version = version + 1, updated_at = ? WHERE id = 1 AND version = ?').run(host, now, version).changes) === 1
}

export type ProxyRow = {
  id: number; accessId: number; port: number; detail: string; isActive: number;
  version: number; createdAt: string; updatedAt: string
}
const PROXY_COLUMNS = 'id, access_id AS accessId, port, detail, is_active AS isActive, version, created_at AS createdAt, updated_at AS updatedAt'
export function listProxyRows(db: DatabaseSync): ProxyRow[] {
  return db.prepare(`SELECT ${PROXY_COLUMNS} FROM proxies ORDER BY detail COLLATE NOCASE, id`).all() as ProxyRow[]
}
export function availableAccessIds(db: DatabaseSync): number[] {
  return (db.prepare('SELECT a.id FROM accesses a WHERE a.is_active = 1 AND NOT EXISTS (SELECT 1 FROM proxies p WHERE p.access_id = a.id) ORDER BY a.detail COLLATE NOCASE, a.id').all() as { id: number }[]).map(row => row.id)
}
export function findProxy(db: DatabaseSync, id: number): ProxyRow | undefined {
  return db.prepare(`SELECT ${PROXY_COLUMNS} FROM proxies WHERE id = ?`).get(id) as ProxyRow | undefined
}
export function insertProxy(db: DatabaseSync, input: { accessId: number; port: number; detail: string; now: string }): number {
  return Number(db.prepare('INSERT INTO proxies (access_id, port, detail, detail_normalized, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(input.accessId, input.port, input.detail, input.detail.toLowerCase(), input.now, input.now).lastInsertRowid)
}
export function updateProxyRow(db: DatabaseSync, input: { id: number; accessId: number; port: number; detail: string; isActive: boolean; version: number; now: string }): boolean {
  return Number(db.prepare('UPDATE proxies SET access_id = ?, port = ?, detail = ?, detail_normalized = ?, is_active = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?').run(input.accessId, input.port, input.detail, input.detail.toLowerCase(), input.isActive ? 1 : 0, input.now, input.id, input.version).changes) === 1
}
