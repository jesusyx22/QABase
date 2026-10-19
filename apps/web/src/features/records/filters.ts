import type { PageSize, RecordType } from './types'

export type DateRange = {
  from: string
  to: string
}

export type RecordsFilters = {
  from: string | null
  to: string | null
  all: boolean
  qaId: number | null
  type: RecordType | null
  level: number | null
  q: string
  includeAnnulled: boolean
  page: number
  pageSize: PageSize
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function monthRange(reference: Date, monthOffset = 0): DateRange {
  const year = reference.getFullYear()
  const month = reference.getMonth() + monthOffset
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  return {
    from: toLocalDateString(first),
    to: toLocalDateString(last),
  }
}

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return false
  }

  const year = Number(match[1] ?? '')
  const month = Number(match[2] ?? '')
  const day = Number(match[3] ?? '')
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function dateValue(value: string | null): string | null {
  return value !== null && isRealDate(value) ? value : null
}

function positiveInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) {
    return null
  }

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null
}

function levelValue(value: string | null): number | null {
  const parsed = positiveInteger(value)
  return parsed !== null && parsed >= 1 && parsed <= 5 ? parsed : null
}

export function parsePageSize(value: string | null): PageSize {
  const parsed = positiveInteger(value)
  return parsed === 25 || parsed === 50 || parsed === 100
    ? parsed
    : 25
}

export function parseRecordType(value: string | null): RecordType | null {
  return value === 'merito' || value === 'incidencia' ? value : null
}

export function createDefaultFilters(defaultRange: DateRange): RecordsFilters {
  return {
    from: defaultRange.from,
    to: defaultRange.to,
    all: false,
    qaId: null,
    type: null,
    level: null,
    q: '',
    includeAnnulled: false,
    page: 1,
    pageSize: 25,
  }
}

export function hasExplicitRange(params: URLSearchParams): boolean {
  return (
    params.has('from') || params.has('to') || params.get('all') === '1'
  )
}

export function readFilters(
  params: URLSearchParams,
  defaultRange: DateRange,
): RecordsFilters {
  let all = params.get('all') === '1'
  let from = all ? null : dateValue(params.get('from'))
  let to = all ? null : dateValue(params.get('to'))
  const hasDateParams = params.has('from') || params.has('to')

  if (!all && !hasDateParams) {
    from = defaultRange.from
    to = defaultRange.to
  } else if (!all && from === null && to === null) {
    all = true
  }

  return {
    from: all ? null : from,
    to: all ? null : to,
    all,
    qaId: positiveInteger(params.get('qaId')),
    type: parseRecordType(params.get('type')),
    level: levelValue(params.get('level')),
    q: params.get('q') ?? '',
    includeAnnulled: params.get('includeAnnulled') === '1',
    page: positiveInteger(params.get('page')) ?? 1,
    pageSize: parsePageSize(params.get('pageSize')),
  }
}

/**
 * Guarda solo lo que no es predeterminado. La URL conserva la intención:
 * `all=1`, un extremo abierto o los filtros elegidos.
 */
export function filtersToSearchParams(
  filters: RecordsFilters,
): URLSearchParams {
  const params = new URLSearchParams()

  if (filters.all) {
    params.set('all', '1')
  } else {
    if (filters.from !== null) {
      params.set('from', filters.from)
    }
    if (filters.to !== null) {
      params.set('to', filters.to)
    }
  }

  if (filters.qaId !== null) {
    params.set('qaId', String(filters.qaId))
  }
  if (filters.type !== null) {
    params.set('type', filters.type)
  }
  if (filters.level !== null) {
    params.set('level', String(filters.level))
  }
  if (filters.q !== '') {
    params.set('q', filters.q)
  }
  if (filters.includeAnnulled) {
    params.set('includeAnnulled', '1')
  }
  if (filters.page > 1) {
    params.set('page', String(filters.page))
  }
  if (filters.pageSize !== 25) {
    params.set('pageSize', String(filters.pageSize))
  }

  return params
}

/**
 * Query exacta para GET /api/records. `canIncludeAnnulled` aplica el permiso
 * en el cliente; el servidor vuelve a autorizarlo.
 */
export function recordsQueryString(
  filters: RecordsFilters,
  canIncludeAnnulled: boolean,
): string {
  const params = new URLSearchParams()

  if (filters.all) {
    params.set('all', '1')
  } else {
    if (filters.from !== null) {
      params.set('from', filters.from)
    }
    if (filters.to !== null) {
      params.set('to', filters.to)
    }
  }

  if (filters.qaId !== null) {
    params.set('qaId', String(filters.qaId))
  }
  if (filters.type !== null) {
    params.set('type', filters.type)
  }
  if (filters.level !== null) {
    params.set('level', String(filters.level))
  }

  const text = filters.q.trim()
  if (text !== '') {
    params.set('q', text)
  }
  if (filters.includeAnnulled && canIncludeAnnulled) {
    params.set('includeAnnulled', '1')
  }

  params.set('page', String(filters.page))
  params.set('pageSize', String(filters.pageSize))

  return params.toString()
}
