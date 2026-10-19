import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PERMISSION_KEYS } from '@qabase/shared'
import { loadConfig } from '../apps/api/src/config'
import { openDatabase } from '../apps/api/src/db/database'
import { runMigrations } from '../apps/api/src/db/migrate'
import type { Actor } from '../apps/api/src/modules/identity/actor'
import { listAccounts } from '../apps/api/src/modules/identity/repository'
import {
  createAccess,
} from '../apps/api/src/modules/accesses/service'
import {
  findAccessByKey,
} from '../apps/api/src/modules/accesses/repository'
import {
  normalizeAddress,
  type AccessEnvironment,
  type AccessProtocol,
} from '../apps/api/src/modules/accesses/validation'

type ParsedRow = {
  number: string
  destination: string
  type: string
  port: string
  protocol: string
  applications: string
  urls: string
  detail: string
}

type ImportRow = {
  address: string
  addressNormalized: string
  port: number
  portEnd: number
  protocol: AccessProtocol | null
  applications: string | null
  urls: string | null
  detail: string | null
  sourceRows: string[]
}

const DEFAULT_FILE = resolve(
  process.cwd(),
  'data/imports/Destinos_Firewall.md',
)
const ENVIRONMENT: AccessEnvironment = 'unspecified'

function parseTable(path: string): ParsedRow[] {
  const rows: ParsedRow[] = []

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!/^\|\s*\d+\s*\|/.test(line)) {
      continue
    }
    const cells = line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())
    if (cells.length < 10) {
      continue
    }
    rows.push({
      number: cells[0]!,
      destination: cells[1]!,
      type: cells[2]!,
      port: cells[3]!,
      protocol: cells[4]!,
      applications: cells[5]!,
      urls: cells[6]!,
      detail: cells[7]!,
    })
  }

  return rows
}

function protocolOf(value: string): AccessProtocol | null {
  switch (value.trim().toLowerCase()) {
    case 'tcp':
      return 'tcp'
    case 'udp':
      return 'udp'
    default:
      return null
  }
}

function mergeProtocol(
  left: AccessProtocol | null,
  right: AccessProtocol | null,
): AccessProtocol | null {
  if (left === null) {
    return right
  }
  if (right === null) {
    return left
  }
  if (left === right) {
    return left
  }
  return 'both'
}

function uniqueJoined(values: string[], max: number): string | null {
  const parts = [
    ...new Set(
      values
        .flatMap((value) => value.split(/;\s*/))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ]
  if (parts.length === 0) {
    return null
  }
  const joined = parts.join('; ')
  return joined.length <= max ? joined : `${joined.slice(0, max - 1)}…`
}

function resolveAddress(row: ParsedRow): string | null {
  if (row.destination !== 'INTERNET (sin IP)') {
    return row.destination
  }

  if (row.urls.includes('*.smartbear.com')) {
    return '*.smartbear.com'
  }
  if (row.urls.includes('services.formiik.com')) {
    return 'services.formiik.com'
  }

  return null
}

function resolvePorts(
  row: ParsedRow,
): { port: number; portEnd: number } | null {
  if (row.port.toLowerCase() === 'default') {
    if (row.number === '40') {
      return { port: 443, portEnd: 443 }
    }
    return null
  }

  const range = /^(\d+)\s*-\s*(\d+)$/.exec(row.port)
  if (range) {
    return {
      port: Number(range[1]),
      portEnd: Number(range[2]),
    }
  }

  if (/^\d+$/.test(row.port)) {
    const port = Number(row.port)
    return { port, portEnd: port }
  }

  return null
}

function main(): void {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const file = args.find((arg) => !arg.startsWith('--')) ?? DEFAULT_FILE
  const rows = parseTable(file)
  const skipped: Array<{ row: string; reason: string }> = []
  const grouped = new Map<string, ImportRow>()
  let merged = 0

  for (const row of rows) {
    const address = resolveAddress(row)
    if (address === null) {
      skipped.push({ row: row.number, reason: 'destino sin IP/dominio resoluble' })
      continue
    }

    const ports = resolvePorts(row)
    if (ports === null) {
      skipped.push({
        row: row.number,
        reason: `puerto no representable: ${row.port}`,
      })
      continue
    }

    const addressNormalized = normalizeAddress(address)
    const key = `${addressNormalized}|${ports.port}|${ports.portEnd}`
    const protocol = protocolOf(row.protocol)
    const existing = grouped.get(key)

    if (existing) {
      merged += 1
      existing.protocol = mergeProtocol(existing.protocol, protocol)
      existing.sourceRows.push(row.number)
      const applications = uniqueJoined(
        [existing.applications ?? '', row.applications],
        500,
      )
      const urls = uniqueJoined([existing.urls ?? '', row.urls], 4000)
      const detail = uniqueJoined([existing.detail ?? '', row.detail], 200)
      existing.applications = applications
      existing.urls = urls
      existing.detail = detail
      continue
    }

    grouped.set(key, {
      address,
      addressNormalized,
      port: ports.port,
      portEnd: ports.portEnd,
      protocol,
      applications: uniqueJoined([row.applications], 500),
      urls: uniqueJoined([row.urls.replaceAll('<br>', '\n')], 4000),
      detail: uniqueJoined([row.detail], 200),
      sourceRows: [row.number],
    })
  }

  const config = loadConfig()
  const db = openDatabase(config.databasePath)
  runMigrations(db, config.migrationsPath)

  const accounts = listAccounts(db, { includeInactive: false, search: '' })
  const admin = accounts.find((account) => account.roleIsProtected === 1)
  if (!admin) {
    throw new Error('No hay una cuenta Administrador activa para auditar la importación.')
  }
  const actor: Actor = {
    id: admin.id,
    username: admin.username,
    permissions: [...PERMISSION_KEYS],
  }

  let created = 0
  let existing = 0
  const failures: Array<{ key: string; message: string }> = []

  try {
    for (const row of grouped.values()) {
      if (
        findAccessByKey(db, {
          addressNormalized: row.addressNormalized,
          port: row.port,
          portEnd: row.portEnd,
          environment: ENVIRONMENT,
        })
      ) {
        existing += 1
        continue
      }

      if (dryRun) {
        created += 1
        continue
      }

      try {
        createAccess(db, actor, {
          address: row.address,
          port: row.port,
          portEnd: row.portEnd,
          environment: ENVIRONMENT,
          protocol: row.protocol,
          detail: row.detail,
          applications: row.applications,
          urls: row.urls,
          now: new Date(),
        })
        created += 1
      } catch (error) {
        failures.push({
          key: `${row.address}:${row.port}-${row.portEnd}`,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  } finally {
    db.close()
  }

  console.log(`Archivo: ${file}`)
  console.log(`Filas leídas: ${rows.length}`)
  console.log(`Grupos únicos: ${grouped.size} (fusiones: ${merged})`)
  console.log(`Creados${dryRun ? ' (simulación)' : ''}: ${created}`)
  console.log(`Ya existentes: ${existing}`)
  console.log(`Omitidos: ${skipped.length}`)
  for (const item of skipped) {
    console.log(`  - fila ${item.row}: ${item.reason}`)
  }
  console.log(`Errores: ${failures.length}`)
  for (const failure of failures) {
    console.log(`  - ${failure.key}: ${failure.message}`)
  }
}

main()
