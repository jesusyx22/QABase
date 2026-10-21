/**
 * Contrato de servicios de proxy operables.
 *
 * Solo tipos: no contiene lógica ni acceso a datos. El API y la SPA comparten
 * estas formas para evitar divergencias.
 */

export type ProxyEnvironment =
  | 'development'
  | 'qa'
  | 'production'
  | 'unspecified'

export type ProxyProtocol = 'http' | 'tcp'

export type ProxyStatus =
  | 'active'
  | 'starting'
  | 'stopped'
  | 'conflict'
  | 'error'

export type ProxyHealth = 'up' | 'down' | 'skipped'

export type ProxySettings = {
  host: string | null
  version: number | null
}

export type ProxyRouteAccess = {
  id: number
  address: string
  port: number
  portEnd: number
  environment: ProxyEnvironment
  detail: string | null
  isActive: boolean
}

export type ProxyAllowlistEntry = {
  cidr: string
  label: string
}

export type ProxyRoute = {
  id: number
  path: string
  target: string
  detail: string | null
  access: ProxyRouteAccess | null
}

export type ProxyPort = {
  port: number
  isPrimary: boolean
  listening: boolean
}

export type ProxyRuntime = {
  status: ProxyStatus
  pid: number | null
  managed: boolean
  health: ProxyHealth
  detail: string | null
  startedAt: string | null
}

export type ProxyServiceView = {
  id: number
  slug: string
  name: string
  environment: ProxyEnvironment
  protocol: ProxyProtocol
  healthPath: string | null
  isActive: boolean
  routes: ProxyRoute[]
  ports: ProxyPort[]
  allowlist: ProxyAllowlistEntry[]
  runtime: ProxyRuntime
  createdAt: string
  updatedAt: string
}

export type ProxyListResponse = {
  settings: ProxySettings
  services: ProxyServiceView[]
}

export type UpdateProxySettingsInput = {
  host: string
  version?: number
}

export type UpdateProxyAllowlistInput = {
  entries: ProxyAllowlistEntry[]
}

export type ProxyLogsResponse = {
  lines: string[]
}
