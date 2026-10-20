import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { invalidInput } from '../../core/errors'
import { inTransaction } from '../../core/transaction'
import { normalizeAddress } from '../accesses/validation'
import type { ProxyEnvironment } from '@qabase/shared'

export type ProxyManifestAccess = {
  address: string
  port: number
}

export type ProxyManifestRoute = {
  path: string
  target: string
  detail: string | null
  access: ProxyManifestAccess | null
}

export type ProxyManifest = {
  slug: string
  name: string
  environment: ProxyEnvironment
  entry: string
  ports: number[]
  primaryPort: number
  healthPath: string | null
  routes: ProxyManifestRoute[]
}

const SLUG_PATTERN = /^[a-z][a-z0-9-]{0,31}$/
const ENTRY_PATTERN = /^[A-Za-z0-9._-]+$/
const ENVIRONMENTS: ProxyEnvironment[] = [
  'development',
  'qa',
  'production',
  'unspecified',
]

function validatePort(value: unknown, label: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 65535
  ) {
    throw invalidInput(`${label} debe ser un entero entre 1 y 65535.`)
  }
  return value
}

function validateText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') {
    throw invalidInput(`${label} es obligatorio.`)
  }
  const text = value.trim()
  if (text.length < 1 || text.length > max) {
    throw invalidInput(`${label} debe tener entre 1 y ${max} caracteres.`)
  }
  return text
}

function validateOptionalText(
  value: unknown,
  label: string,
  max: number,
): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw invalidInput(`${label} no es válido.`)
  }
  const text = value.trim()
  if (text === '') {
    return null
  }
  if (text.length > max) {
    throw invalidInput(`${label} no puede superar ${max} caracteres.`)
  }
  return text
}

function validateRoute(value: unknown, slug: string): ProxyManifestRoute {
  if (typeof value !== 'object' || value === null) {
    throw invalidInput(`Ruta inválida en ${slug}.`)
  }
  const route = value as Record<string, unknown>
  const path = validateText(route.path, `path de ${slug}`, 200)
  if (!path.startsWith('/')) {
    throw invalidInput(`path de ${slug} debe empezar con /.`)
  }
  const target = validateText(route.target, `target de ${slug}`, 2000)
  if (!/^https?:\/\/[^/\s]+/i.test(target)) {
    throw invalidInput(`target de ${slug} debe ser una URL http(s).`)
  }
  const detail = validateOptionalText(route.detail, `detail de ${slug}`, 200)
  let access: ProxyManifestAccess | null = null
  if (route.access !== undefined && route.access !== null) {
    if (typeof route.access !== 'object') {
      throw invalidInput(`access de ${slug} no es válido.`)
    }
    const raw = route.access as Record<string, unknown>
    access = {
      address: validateText(raw.address, `access.address de ${slug}`, 255),
      port: validatePort(raw.port, `access.port de ${slug}`),
    }
  }
  return { path, target, detail, access }
}

export function parseProxyManifest(
  slug: string,
  raw: unknown,
): ProxyManifest {
  if (!SLUG_PATTERN.test(slug)) {
    throw invalidInput(`Slug de proxy inválido: ${slug}.`)
  }
  if (typeof raw !== 'object' || raw === null) {
    throw invalidInput(`Manifiesto inválido en ${slug}.`)
  }
  const value = raw as Record<string, unknown>
  const name = validateText(value.name, `name de ${slug}`, 100)
  if (
    typeof value.environment !== 'string' ||
    !ENVIRONMENTS.includes(value.environment as ProxyEnvironment)
  ) {
    throw invalidInput(`environment de ${slug} no es válido.`)
  }
  const entry = validateText(value.entry, `entry de ${slug}`, 100)
  if (!ENTRY_PATTERN.test(entry) || entry.includes('..')) {
    throw invalidInput(`entry de ${slug} debe ser un archivo simple.`)
  }
  if (!Array.isArray(value.ports) || value.ports.length === 0) {
    throw invalidInput(`ports de ${slug} debe tener al menos un puerto.`)
  }
  const ports = value.ports.map((port) =>
    validatePort(port, `ports de ${slug}`),
  )
  if (new Set(ports).size !== ports.length) {
    throw invalidInput(`ports de ${slug} no puede repetir puertos.`)
  }
  const primaryPort = validatePort(
    value.primaryPort,
    `primaryPort de ${slug}`,
  )
  if (!ports.includes(primaryPort)) {
    throw invalidInput(`primaryPort de ${slug} debe estar en ports.`)
  }
  const healthPath = validateOptionalText(
    value.healthPath,
    `healthPath de ${slug}`,
    500,
  )
  if (healthPath !== null && !healthPath.startsWith('/')) {
    throw invalidInput(`healthPath de ${slug} debe empezar con /.`)
  }
  if (!Array.isArray(value.routes) || value.routes.length === 0) {
    throw invalidInput(`routes de ${slug} debe tener al menos una ruta.`)
  }
  const routes = value.routes.map((route) => validateRoute(route, slug))
  const routePaths = new Set<string>()
  for (const route of routes) {
    if (routePaths.has(route.path)) {
      throw invalidInput(`Ruta duplicada en ${slug}: ${route.path}.`)
    }
    routePaths.add(route.path)
  }

  return {
    slug,
    name,
    environment: value.environment as ProxyEnvironment,
    entry,
    ports,
    primaryPort,
    healthPath,
    routes,
  }
}

export function loadProxyManifests(root: string): ProxyManifest[] {
  let entries
  try {
    entries = readdirSync(root, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw invalidInput(
      `No se pudo leer el directorio de proxies: ${root}.`,
    )
  }

  const manifests: ProxyManifest[] = []
  const ports = new Map<number, string>()

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) {
      continue
    }
    const manifestPath = join(root, entry.name, 'service.json')
    let raw: unknown
    try {
      raw = JSON.parse(readFileSync(manifestPath, 'utf8'))
    } catch {
      throw invalidInput(`No se pudo leer ${entry.name}/service.json.`)
    }
    const manifest = parseProxyManifest(entry.name, raw)
    for (const port of manifest.ports) {
      const owner = ports.get(port)
      if (owner !== undefined) {
        throw invalidInput(
          `El puerto ${port} está repetido en ${owner} y ${manifest.slug}.`,
        )
      }
      ports.set(port, manifest.slug)
    }
    manifests.push(manifest)
  }

  return manifests
}

export function findAccessId(
  db: DatabaseSync,
  access: ProxyManifestAccess,
): number | null {
  const row = db
    .prepare(
      `SELECT id
         FROM accesses
        WHERE address_normalized = ?
          AND ? >= port
          AND ? <= port_end
        ORDER BY is_active DESC, id
        LIMIT 1`,
    )
    .get(
      normalizeAddress(access.address),
      access.port,
      access.port,
    ) as { id: number } | undefined
  return row?.id ?? null
}

export type SyncResult = {
  services: number
  routes: number
  ports: number
}

export function syncProxyCatalog(
  db: DatabaseSync,
  root: string,
  now: Date,
): SyncResult {
  const manifests = loadProxyManifests(root)
  const timestamp = now.toISOString()
  const slugs = manifests.map((manifest) => manifest.slug)

  return inTransaction(db, () => {
    let routes = 0
    let ports = 0
    const serviceIds = new Map<string, number>()

    for (const manifest of manifests) {
      const existing = db
        .prepare('SELECT id FROM proxy_services WHERE slug = ?')
        .get(manifest.slug) as { id: number } | undefined
      let serviceId: number
      if (existing) {
        serviceId = existing.id
        db.prepare(
          `UPDATE proxy_services
              SET name = ?, environment = ?, entry = ?, health_path = ?,
                  is_active = 1, version = version + 1, updated_at = ?
            WHERE id = ?`,
        ).run(
          manifest.name,
          manifest.environment,
          manifest.entry,
          manifest.healthPath,
          timestamp,
          serviceId,
        )
      } else {
        serviceId = Number(
          db
            .prepare(
              `INSERT INTO proxy_services
                (slug, name, environment, entry, health_path, is_active,
                 version, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?)`,
            )
            .run(
              manifest.slug,
              manifest.name,
              manifest.environment,
              manifest.entry,
              manifest.healthPath,
              timestamp,
              timestamp,
            ).lastInsertRowid,
        )
      }
      serviceIds.set(manifest.slug, serviceId)
      db.prepare(
        `INSERT INTO proxy_runtime (service_id, updated_at)
         VALUES (?, ?)
         ON CONFLICT (service_id) DO NOTHING`,
      ).run(serviceId, timestamp)
    }

    const ids = [...serviceIds.values()]
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ')
      db.prepare(
        `DELETE FROM proxy_ports WHERE service_id IN (${placeholders})`,
      ).run(...ids)
      db.prepare(
        `DELETE FROM proxy_routes WHERE service_id IN (${placeholders})`,
      ).run(...ids)
    }

    for (const manifest of manifests) {
      const serviceId = serviceIds.get(manifest.slug)!
      const insertPort = db.prepare(
        'INSERT INTO proxy_ports (service_id, port, is_primary) VALUES (?, ?, ?)',
      )
      for (const port of manifest.ports) {
        insertPort.run(serviceId, port, port === manifest.primaryPort ? 1 : 0)
        ports += 1
      }

      const insertRoute = db.prepare(
        `INSERT INTO proxy_routes
          (service_id, path, target, access_id, detail, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      manifest.routes.forEach((route, index) => {
        insertRoute.run(
          serviceId,
          route.path,
          route.target,
          route.access ? findAccessId(db, route.access) : null,
          route.detail,
          index,
        )
        routes += 1
      })
    }

    if (slugs.length === 0) {
      db.prepare(
        'UPDATE proxy_services SET is_active = 0, updated_at = ? WHERE is_active = 1',
      ).run(timestamp)
    } else {
      const placeholders = slugs.map(() => '?').join(', ')
      db.prepare(
        `UPDATE proxy_services
            SET is_active = 0, updated_at = ?
          WHERE is_active = 1 AND slug NOT IN (${placeholders})`,
      ).run(timestamp, ...slugs)
    }

    return { services: manifests.length, routes, ports }
  })
}
