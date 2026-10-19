import { formatDate } from '@/lib/format'
import type {
  AssignmentState,
  AssignmentUrgency,
  OverviewFilter,
  OverviewSort,
  QaUrgency,
} from './api'

export const ENVIRONMENT_LABELS: Record<
  'development' | 'qa' | 'production' | 'unspecified',
  string
> = {
  development: 'Desarrollo',
  qa: 'QA',
  production: 'Producción',
  unspecified: 'Sin clasificar',
}

export const PROTOCOL_LABELS: Record<'tcp' | 'udp' | 'both', string> = {
  tcp: 'TCP',
  udp: 'UDP',
  both: 'TCP/UDP',
}

export const ASSIGNMENT_STATE_LABELS: Record<AssignmentState, string> = {
  current: 'Vigente',
  expiring: 'Por vencer',
  expired: 'Vencido',
}

export const ASSIGNMENT_URGENCY_LABELS: Record<AssignmentUrgency, string> = {
  ok: 'Al día',
  warning: 'Próximo',
  critical: 'Urgente',
  expired: 'Vencido',
}

export const QA_URGENCY_LABELS: Record<QaUrgency, string> = {
  critical: 'Urgente',
  warning: 'Próximo',
  ok: 'Al día',
  expired: 'Vencidos',
  none: 'Sin accesos',
}

export const OVERVIEW_FILTER_OPTIONS: Array<{
  value: OverviewFilter
  label: string
}> = [
  { value: 'all', label: 'Todos' },
  { value: 'withAccess', label: 'Con accesos' },
  { value: 'current', label: 'Vigentes' },
  { value: 'expiring', label: 'Por vencer' },
  { value: 'expired', label: 'Vencidos' },
  { value: 'none', label: 'Sin accesos' },
  { value: 'inactive', label: 'Inactivos' },
]

export const OVERVIEW_SORT_OPTIONS: Array<{
  value: OverviewSort
  label: string
}> = [
  { value: 'urgency', label: 'Por urgencia' },
  { value: 'name', label: 'Por nombre' },
]

export function environmentLabel(
  value: 'development' | 'qa' | 'production' | 'unspecified',
): string {
  return ENVIRONMENT_LABELS[value] ?? value
}

export function protocolLabel(value: 'tcp' | 'udp' | 'both' | null): string {
  return value === null ? 'Sin especificar' : PROTOCOL_LABELS[value] ?? value
}

export function assignmentStateLabel(state: AssignmentState): string {
  return ASSIGNMENT_STATE_LABELS[state] ?? state
}

export function assignmentUrgencyLabel(urgency: AssignmentUrgency): string {
  return ASSIGNMENT_URGENCY_LABELS[urgency] ?? urgency
}

export function formatExpiry(expiresOn: string | null): string {
  return formatDate(expiresOn)
}

export function formatDaysRemaining(daysRemaining: number): string {
  if (daysRemaining < 0) {
    const days = Math.abs(daysRemaining)
    return days === 1 ? 'Vencido hace 1 día' : `Vencido hace ${days} días`
  }
  if (daysRemaining === 0) {
    return 'Vence hoy'
  }
  if (daysRemaining === 1) {
    return 'Vence en 1 día'
  }
  return `Vence en ${daysRemaining} días`
}

export function semaphoreLabel(
  urgency: QaUrgency | AssignmentUrgency | string,
): string {
  switch (urgency) {
    case 'critical':
      return 'Urgente'
    case 'warning':
      return 'Próximo'
    case 'ok':
      return 'Al día'
    case 'expired':
      return 'Vencidos'
    case 'none':
      return 'Sin accesos'
    default:
      return urgency
  }
}

export function semaphoreVariant(
  urgency: QaUrgency | AssignmentUrgency | string,
): 'danger' | 'warning' | 'success' | 'outline' {
  switch (urgency) {
    case 'critical':
      return 'danger'
    case 'warning':
      return 'warning'
    case 'ok':
      return 'success'
    case 'expired':
    case 'none':
    default:
      return 'outline'
  }
}
