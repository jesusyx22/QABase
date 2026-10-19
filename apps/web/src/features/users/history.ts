import { PERMISSIONS } from '@qabase/shared'

export type HistoryEntry = {
  occurredAt: string
  actorUsername: string | null
  channel: 'app' | 'local'
  action: string
  before: unknown
  after: unknown
}

export type HistoryField = {
  key: string
  label: string
  value: string
}

const ACTION_LABELS: Record<string, string> = {
  'account.created': 'Cuenta creada',
  'account.updated': 'Cuenta actualizada',
  'account.password_reset': 'Contraseña restablecida',
  'role.created': 'Rol creado',
  'role.renamed': 'Rol renombrado',
  'role.permissions_changed': 'Permisos actualizados',
}

const FIELD_LABELS: Record<string, string> = {
  username: 'Usuario',
  roleId: 'ID del rol',
  roleName: 'Rol',
  isActive: 'Estado',
  name: 'Nombre',
  permissions: 'Permisos',
}

const PERMISSION_LABELS = new Map<string, string>(
  PERMISSIONS.map((permission) => [permission.key, permission.label]),
)

export function historyActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function formatHistoryValue(key: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '—'
  }
  if (key === 'isActive' && typeof value === 'boolean') {
    return value ? 'Activo' : 'Inactivo'
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return key === 'permissions' ? 'Sin permisos' : 'Ninguno'
    }
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return PERMISSION_LABELS.get(item) ?? item
        }
        return typeof item === 'object' ? JSON.stringify(item) : String(item)
      })
      .join(', ')
  }
  if (typeof value === 'boolean') {
    return value ? 'Sí' : 'No'
  }
  if (typeof value === 'string') {
    return value === '' ? '—' : value
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return JSON.stringify(value)
}

export function historyFields(payload: unknown): HistoryField[] {
  if (payload === null || payload === undefined) {
    return []
  }
  if (!isRecord(payload)) {
    return [
      { key: 'value', label: 'Valor', value: formatHistoryValue('value', payload) },
    ]
  }

  const hasRoleName = typeof payload.roleName === 'string'
  return Object.entries(payload)
    .filter(([key]) => !(key === 'roleId' && hasRoleName))
    .map(([key, value]) => ({
      key,
      label: FIELD_LABELS[key] ?? key,
      value: formatHistoryValue(key, value),
    }))
}
