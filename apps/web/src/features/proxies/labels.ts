import type {
  ProxyEnvironment,
  ProxyHealth,
  ProxyStatus,
} from './api'

const IPV4_PATTERN =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

export function validateIpv4(value: string): string | null {
  const text = value.trim()
  if (text === '') {
    return 'La dirección IP es obligatoria.'
  }
  if (!IPV4_PATTERN.test(text)) {
    return 'La dirección IP debe ser una IPv4 válida (ej. 192.168.1.50).'
  }
  return null
}

export function formatEndpoint(host: string | null, port: number): string {
  if (!host) {
    return `:${port}`
  }
  return `${host}:${port}`
}

export type StatusBadgeConfig = {
  label: string
  variant: 'success' | 'warning' | 'danger' | 'outline'
  className?: string
}

export function proxyStatusConfig(status: ProxyStatus): StatusBadgeConfig {
  switch (status) {
    case 'active':
      return { label: 'Activo', variant: 'success' }
    case 'starting':
      return { label: 'Iniciando', variant: 'warning' }
    case 'stopped':
      return {
        label: 'Detenido',
        variant: 'outline',
        className: 'text-muted-foreground',
      }
    case 'conflict':
      return { label: 'Conflicto', variant: 'danger' }
    case 'error':
      return { label: 'Error', variant: 'danger' }
    default:
      return {
        label: status,
        variant: 'outline',
        className: 'text-muted-foreground',
      }
  }
}

export function proxyEnvironmentLabel(env: ProxyEnvironment): string {
  switch (env) {
    case 'development':
      return 'Desarrollo'
    case 'qa':
      return 'QA'
    case 'production':
      return 'Producción'
    case 'unspecified':
      return 'Sin especificar'
    default:
      return env
  }
}

export function proxyHealthLabel(health: ProxyHealth): string {
  switch (health) {
    case 'up':
      return 'Saludable (UP)'
    case 'down':
      return 'Sin respuesta (DOWN)'
    case 'skipped':
      return 'Sin health check'
    default:
      return health
  }
}

export const PROXY_ENVIRONMENT_OPTIONS = [
  { value: 'all', label: 'Todos los ambientes' },
  { value: 'development', label: 'Desarrollo' },
  { value: 'qa', label: 'QA' },
  { value: 'production', label: 'Producción' },
  { value: 'unspecified', label: 'Sin especificar' },
] as const

export const PROXY_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'active', label: 'Activo' },
  { value: 'starting', label: 'Iniciando' },
  { value: 'stopped', label: 'Detenido' },
  { value: 'conflict', label: 'Conflicto' },
  { value: 'error', label: 'Error' },
] as const
