import type { DatabaseSync } from 'node:sqlite'
import type { Clock } from '../../core/clock'
import { insertAuditEvent, listAuditEvents } from '../../core/audit'
import { conflict, invalidInput, notFound } from '../../core/errors'
import { inTransaction } from '../../core/transaction'
import type { Actor } from '../identity/actor'
import { findPersonById } from '../personal/repository'
import {
  annulRecord as annulRecordRow,
  countRecords,
  findRecordById,
  getByQaMetrics,
  getTotals,
  insertRecord,
  listLevels,
  listPeopleForSummary,
  listRecords,
  updateRecord as updateRecordRow,
  type LevelRow,
  type RecordFilters,
  type RecordType,
  type RecordRow,
} from './repository'

export const PAGE_SIZES = [25, 50, 100] as const
export type PageSize = (typeof PAGE_SIZES)[number]

export type RecordView = {
  id: number
  qa: { id: number; name: string; isActive: boolean }
  type: RecordType
  eventDate: string
  level: number
  levelLabel: string
  detail: string
  status: 'vigente' | 'anulado'
  version: number
  createdAt: string
  updatedAt: string
  annulledAt: string | null
  annulReason: string | null
}

export type ByQaRow = {
  id: number
  name: string
  isActive: boolean
  merits: { count: number; points: number }
  incidents: { count: number; points: number }
}

export type RecordsPage = {
  items: RecordView[]
  page: number
  pageSize: PageSize
  total: number
  totals: {
    merits: { count: number; points: number }
    incidents: { count: number; points: number }
  }
  byQa: ByQaRow[]
}

export type RecordsQuery = {
  from?: string
  to?: string
  all?: boolean
  qaId?: number
  type?: RecordType
  level?: number
  text?: string
  includeAnnulled?: boolean
  page?: number
  pageSize?: number
}

export type HistoryEvent = {
  occurredAt: string
  actorUsername: string | null
  channel: 'app' | 'local'
  action: string
  before: unknown
  after: unknown
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return false
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function validateEventDate(value: string, today: string): void {
  if (!isRealDate(value)) {
    throw invalidInput('La fecha no es válida.')
  }
  if (value > today) {
    throw invalidInput('La fecha no puede ser futura.')
  }
}

function validateType(value: string): RecordType {
  if (value !== 'merito' && value !== 'incidencia') {
    throw invalidInput('El tipo no es válido.')
  }
  return value
}

function validateLevel(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw invalidInput('El nivel debe estar entre 1 y 5.')
  }
  return value
}

function normalizeDetail(value: string): string {
  const detail = value.trim()
  if (detail.length < 1 || detail.length > 5000) {
    throw invalidInput('El detalle debe tener entre 1 y 5000 caracteres.')
  }
  return detail
}

function toRecordView(row: RecordRow): RecordView {
  return {
    id: row.id,
    qa: {
      id: row.qaId,
      name: row.qaName,
      isActive: row.qaIsActive === 1,
    },
    type: row.type,
    eventDate: row.eventDate,
    level: row.level,
    levelLabel: row.levelLabel,
    detail: row.detail,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    annulledAt: row.annulledAt,
    annulReason: row.annulReason,
  }
}

function businessSnapshot(row: RecordRow): {
  qaId: number
  type: RecordType
  eventDate: string
  level: number
  detail: string
  status: string
} {
  return {
    qaId: row.qaId,
    type: row.type,
    eventDate: row.eventDate,
    level: row.level,
    detail: row.detail,
    status: row.status,
  }
}

function audit(
  db: DatabaseSync,
  actor: Actor,
  action: string,
  recordId: number,
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
      module: 'records',
      entityType: 'record',
      entityId: String(recordId),
      action,
      before,
      after,
    },
    now.toISOString(),
  )
}

function currentMonthRange(now: Date): { from: string; to: string } {
  const year = now.getFullYear()
  const month = now.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return {
    from: `${year}-${pad(month + 1)}-01`,
    to: `${year}-${pad(month + 1)}-${pad(lastDay)}`,
  }
}

function resolveFilters(
  query: RecordsQuery,
  now: Date,
): RecordFilters {
  let from = query.from
  let to = query.to

  if (!query.all && from === undefined && to === undefined) {
    const range = currentMonthRange(now)
    from = range.from
    to = range.to
  }

  if (from !== undefined) {
    if (!isRealDate(from)) {
      throw invalidInput('La fecha desde no es válida.')
    }
  }
  if (to !== undefined) {
    if (!isRealDate(to)) {
      throw invalidInput('La fecha hasta no es válida.')
    }
  }
  if (from !== undefined && to !== undefined && from > to) {
    throw invalidInput('El rango de fechas está invertido.')
  }

  if (query.type !== undefined) {
    validateType(query.type)
  }
  if (query.level !== undefined) {
    validateLevel(query.level)
  }
  if (query.qaId !== undefined && (!Number.isInteger(query.qaId) || query.qaId < 1)) {
    throw invalidInput('El QA no es válido.')
  }

  return {
    from,
    to,
    qaId: query.qaId,
    type: query.type,
    level: query.level,
    text: query.text,
    includeAnnulled: query.includeAnnulled === true,
  }
}

export function listRecordsPage(
  db: DatabaseSync,
  query: RecordsQuery,
  now: Date,
): RecordsPage {
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 25

  if (!Number.isInteger(page) || page < 1) {
    throw invalidInput('La página no es válida.')
  }
  if (!PAGE_SIZES.includes(pageSize as PageSize)) {
    throw invalidInput('El tamaño de página debe ser 25, 50 o 100.')
  }

  const filters = resolveFilters(query, now)
  const total = countRecords(db, filters)
  const items = listRecords(db, filters, {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  })
  const totals = getTotals(db, filters)
  const metrics = getByQaMetrics(db, filters)

  const merits = totals.get('merito') ?? { count: 0, points: 0 }
  const incidents = totals.get('incidencia') ?? { count: 0, points: 0 }

  const byQa = listPeopleForSummary(db).map((person) => {
    const personMetrics = metrics.get(person.id)
    return {
      id: person.id,
      name: person.name,
      isActive: person.isActive === 1,
      merits: personMetrics?.get('merito') ?? { count: 0, points: 0 },
      incidents: personMetrics?.get('incidencia') ?? { count: 0, points: 0 },
    }
  })

  return {
    items: items.map(toRecordView),
    page,
    pageSize: pageSize as PageSize,
    total,
    totals: { merits, incidents },
    byQa,
  }
}

export function listImpactLevels(db: DatabaseSync): LevelRow[] {
  return listLevels(db)
}

export function createRecord(
  db: DatabaseSync,
  actor: Actor,
  input: {
    qaId: number
    type: string
    eventDate: string
    level: number
    detail: string
    now: Date
    today: string
  },
): RecordView {
  const type = validateType(input.type)
  const level = validateLevel(input.level)
  const eventDate = input.eventDate
  validateEventDate(eventDate, input.today)
  const detail = normalizeDetail(input.detail)

  const person = findPersonById(db, input.qaId)
  if (!person || person.isActive !== 1) {
    throw invalidInput('Selecciona un QA activo.')
  }

  const timestamp = input.now.toISOString()

  return inTransaction(db, () => {
    const recordId = insertRecord(db, {
      qaId: person.id,
      type,
      eventDate,
      level,
      detail,
      now: timestamp,
    })

    const row = findRecordById(db, recordId)!
    audit(db, actor, 'record.created', recordId, input.now, undefined, businessSnapshot(row))
    return toRecordView(row)
  })
}

export function updateRecord(
  db: DatabaseSync,
  actor: Actor,
  recordId: number,
  input: {
    qaId?: number
    type?: string
    eventDate?: string
    level?: number
    detail?: string
    version: number
    now: Date
    today: string
  },
): RecordView {
  const record = findRecordById(db, recordId)
  if (!record) {
    throw notFound('El registro no existe.')
  }
  if (record.status === 'anulado') {
    throw conflict('El registro está anulado y no se puede editar.')
  }
  if (
    input.qaId === undefined &&
    input.type === undefined &&
    input.eventDate === undefined &&
    input.level === undefined &&
    input.detail === undefined
  ) {
    throw invalidInput('No hay cambios para guardar.')
  }

  const qaId = input.qaId ?? record.qaId
  if (input.qaId !== undefined && input.qaId !== record.qaId) {
    const person = findPersonById(db, input.qaId)
    if (!person || person.isActive !== 1) {
      throw invalidInput('Selecciona un QA activo.')
    }
  }

  const type = validateType(input.type ?? record.type)
  const level = validateLevel(input.level ?? record.level)
  const eventDate = input.eventDate ?? record.eventDate
  validateEventDate(eventDate, input.today)
  const detail = normalizeDetail(input.detail ?? record.detail)

  if (
    qaId === record.qaId &&
    type === record.type &&
    eventDate === record.eventDate &&
    level === record.level &&
    detail === record.detail
  ) {
    throw invalidInput('No hay cambios para guardar.')
  }

  const before = businessSnapshot(record)
  const timestamp = input.now.toISOString()

  return inTransaction(db, () => {
    const updated = updateRecordRow(db, {
      recordId,
      qaId,
      type,
      eventDate,
      level,
      detail,
      expectedVersion: input.version,
      now: timestamp,
    })
    if (!updated) {
      throw conflict()
    }

    const row = findRecordById(db, recordId)!
    audit(db, actor, 'record.updated', recordId, input.now, before, businessSnapshot(row))
    return toRecordView(row)
  })
}

export function annulRecord(
  db: DatabaseSync,
  actor: Actor,
  recordId: number,
  input: {
    reason: string
    version: number
    confirm: boolean
    now: Date
  },
): RecordView {
  if (input.confirm !== true) {
    throw invalidInput('La anulación requiere confirmación explícita.')
  }

  const reason = input.reason.trim()
  if (reason.length < 1 || reason.length > 1000) {
    throw invalidInput('El motivo debe tener entre 1 y 1000 caracteres.')
  }

  const record = findRecordById(db, recordId)
  if (!record) {
    throw notFound('El registro no existe.')
  }
  if (record.status === 'anulado') {
    throw conflict('El registro ya está anulado.')
  }

  const timestamp = input.now.toISOString()

  return inTransaction(db, () => {
    const updated = annulRecordRow(db, {
      recordId,
      reason,
      actorAccountId: actor.id,
      expectedVersion: input.version,
      now: timestamp,
    })
    if (!updated) {
      throw conflict()
    }

    const row = findRecordById(db, recordId)!
    audit(db, actor, 'record.annulled', recordId, input.now, {
      status: 'vigente',
    }, {
      status: 'anulado',
      reason,
      annulledAt: timestamp,
    })
    return toRecordView(row)
  })
}

export function listRecordHistory(
  db: DatabaseSync,
  recordId: number,
): HistoryEvent[] {
  return listAuditEvents(db, 'record', String(recordId)).map((row) => ({
    occurredAt: row.occurred_at,
    actorUsername: row.actor_username,
    channel: row.channel,
    action: row.action,
    before: row.before_json === null ? null : JSON.parse(row.before_json),
    after: row.after_json === null ? null : JSON.parse(row.after_json),
  }))
}

export function todayFor(clock: Clock): string {
  return toLocalDateString(clock())
}
