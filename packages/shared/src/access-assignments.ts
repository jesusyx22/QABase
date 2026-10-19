export type AssignmentState = 'current' | 'expiring' | 'expired'
export type AssignmentUrgency = 'ok' | 'warning' | 'critical' | 'expired'

export type AssignmentTiming = {
  state: AssignmentState
  urgency: AssignmentUrgency
  daysRemaining: number
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 24 * 60 * 60 * 1000
const LIMA_TIME_ZONE = 'America/Lima'

function parseDateOnly(value: string): {
  year: number
  month: number
  day: number
} | null {
  const match = DATE_ONLY.exec(value)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

function toUtcTime(value: string): number | null {
  const parts = parseDateOnly(value)
  if (!parts) {
    return null
  }
  return Date.UTC(parts.year, parts.month - 1, parts.day)
}

function toDateOnly(time: number): string {
  const date = new Date(time)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Fecha de hoy en America/Lima, sin hora.
 */
export function peruToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function isValidDateOnly(value: string): boolean {
  return parseDateOnly(value) !== null
}

/**
 * Suma días a una fecha AAAA-MM-DD sin pasar por zonas horarias locales.
 */
export function addDaysToDateOnly(value: string, days: number): string {
  const time = toUtcTime(value)
  if (time === null) {
    throw new Error(`Fecha inválida: ${value}`)
  }
  if (!Number.isInteger(days)) {
    throw new Error(`Días inválidos: ${days}`)
  }
  return toDateOnly(time + days * DAY_MS)
}

export function assignmentTiming(
  expiresOn: string,
  today: string,
): AssignmentTiming {
  const expiry = toUtcTime(expiresOn)
  const current = toUtcTime(today)
  if (expiry === null) {
    throw new Error(`Fecha de vencimiento inválida: ${expiresOn}`)
  }
  if (current === null) {
    throw new Error(`Fecha actual inválida: ${today}`)
  }

  const daysRemaining = Math.round((expiry - current) / DAY_MS)
  if (daysRemaining < 0) {
    return { state: 'expired', urgency: 'expired', daysRemaining }
  }
  if (daysRemaining <= 10) {
    return { state: 'expiring', urgency: 'critical', daysRemaining }
  }
  if (daysRemaining <= 30) {
    return { state: 'expiring', urgency: 'warning', daysRemaining }
  }
  return { state: 'current', urgency: 'ok', daysRemaining }
}
