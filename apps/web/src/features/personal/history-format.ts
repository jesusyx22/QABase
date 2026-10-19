import type { PersonHistoryEvent } from './api'

const ACTION_LABELS: Record<string, string> = {
  'personal.created': 'Alta',
  'personal.renamed': 'Renombrado',
  'personal.deactivated': 'Desactivado',
  'personal.reactivated': 'Reactivado',
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  isActive: 'Estado',
}

const FIELD_ORDER = ['name', 'isActive']

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
  if (value === null || value === undefined) {
    return '—'
  }
  if (field === 'isActive' && typeof value === 'boolean') {
    return value ? 'Activo' : 'Inactivo'
  }
  if (field === 'name' && typeof value === 'string') {
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

export function describeHistoryChange(
  event: Pick<PersonHistoryEvent, 'before' | 'after'>,
): string {
  const before = asRecord(event.before)
  const after = asRecord(event.after)
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const orderedKeys = [
    ...FIELD_ORDER.filter((key) => keys.has(key)),
    ...[...keys].filter((key) => !FIELD_ORDER.includes(key)).sort(),
  ]

  if (orderedKeys.length === 0) {
    return 'Sin cambios registrados.'
  }

  return orderedKeys
    .map((key) => {
      const label = FIELD_LABELS[key] ?? key
      return `${label}: ${formatFieldValue(key, before[key])} → ${formatFieldValue(key, after[key])}`
    })
    .join('; ')
}
