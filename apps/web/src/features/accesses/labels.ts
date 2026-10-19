import type {
  Access,
  AccessEnvironment,
  AccessHistoryEvent,
  AccessProtocol,
} from './api'

export const ENVIRONMENT_LABELS: Record<AccessEnvironment, string> = {
  development: 'Desarrollo',
  qa: 'QA',
  production: 'Producción',
  unspecified: 'Sin clasificar',
}

export const PROTOCOL_LABELS: Record<AccessProtocol, string> = {
  tcp: 'TCP',
  udp: 'UDP',
  both: 'TCP/UDP',
}

export const ENVIRONMENT_OPTIONS: Array<{
  value: AccessEnvironment | 'all'
  label: string
}> = [
  { value: 'all', label: 'Todos los ambientes' },
  { value: 'development', label: 'Desarrollo' },
  { value: 'qa', label: 'QA' },
  { value: 'production', label: 'Producción' },
  { value: 'unspecified', label: 'Sin clasificar' },
]

export const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
] as const

export const PROTOCOL_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los protocolos' },
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'both', label: 'TCP/UDP' },
  { value: 'none', label: 'Sin especificar' },
] as const

export function environmentLabel(value: AccessEnvironment): string {
  return ENVIRONMENT_LABELS[value]
}

export function protocolLabel(value: AccessProtocol | null): string {
  return value === null ? 'Sin especificar' : PROTOCOL_LABELS[value]
}

export function accessStatusLabel(isActive: boolean): string {
  return isActive ? 'Activo' : 'Inactivo'
}

export function formatPortRange(port: number, portEnd: number): string {
  return port === portEnd ? String(port) : `${port}–${portEnd}`
}

export function accessPortLabel(
  access: Pick<Access, 'port' | 'portEnd'>,
): string {
  return formatPortRange(access.port, access.portEnd)
}

const ACTION_LABELS: Record<string, string> = {
  'access.created': 'Alta',
  'access.updated': 'Edición',
  'access.deactivated': 'Desactivado',
  'access.reactivated': 'Reactivado',
}

const FIELD_LABELS: Record<string, string> = {
  address: 'Dirección',
  port: 'Puerto',
  portEnd: 'Puerto fin',
  environment: 'Ambiente',
  protocol: 'Protocolo',
  detail: 'Detalle',
  applications: 'Aplicaciones',
  urls: 'URLs / rutas',
  isActive: 'Estado',
}

const FIELD_ORDER = [
  'detail',
  'address',
  'port',
  'portEnd',
  'environment',
  'protocol',
  'applications',
  'urls',
  'isActive',
]

export function historyActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

function formatFieldValue(field: string, value: unknown): string {
  if (value === undefined) {
    return '—'
  }
  if (field === 'environment' && typeof value === 'string') {
    return ENVIRONMENT_LABELS[value as AccessEnvironment] ?? value
  }
  if (field === 'protocol') {
    if (value === null) {
      return 'Sin especificar'
    }
    if (typeof value === 'string') {
      return PROTOCOL_LABELS[value as AccessProtocol] ?? value
    }
  }
  if (value === null) {
    return '—'
  }
  if (field === 'isActive' && typeof value === 'boolean') {
    return value ? 'Activo' : 'Inactivo'
  }
  if (
    (field === 'address' || field === 'detail') &&
    typeof value === 'string'
  ) {
    return `«${value}»`
  }
  if (typeof value === 'string') {
    return value
  }
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No'
  }
  if (typeof value === 'number') {
    return String(value)
  }
  try {
    return JSON.stringify(value) ?? '—'
  } catch {
    return '—'
  }
}

export function describeAccessChange(
  event: Pick<AccessHistoryEvent, 'before' | 'after'>,
): string {
  const before = asRecord(event.before)
  const after = asRecord(event.after)
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const orderedKeys = [
    ...FIELD_ORDER.filter((key) => keys.has(key)),
    ...[...keys].filter((key) => !FIELD_ORDER.includes(key)).sort(),
  ]
  const isCreation = Object.keys(before).length === 0
  const changedKeys = orderedKeys.filter(
    (key) => isCreation || before[key] !== after[key],
  )

  if (changedKeys.length === 0) {
    return 'Sin cambios registrados.'
  }

  return changedKeys
    .map((key) => {
      const label = FIELD_LABELS[key] ?? key
      return `${label}: ${formatFieldValue(key, before[key])} → ${formatFieldValue(key, after[key])}`
    })
    .join('; ')
}
