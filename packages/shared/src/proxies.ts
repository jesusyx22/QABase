/**
 * Contrato del catálogo de Proxies publicado.
 *
 * Solo tipos: no contiene lógica ni acceso a datos. El API y la SPA comparten
 * estas formas para evitar divergencias al implementar en paralelo.
 */

export type ProxyEnvironment =
  | 'development'
  | 'qa'
  | 'production'
  | 'unspecified'

export type ProxyProtocol = 'tcp' | 'udp' | 'both' | null

export type ProxyAccess = {
  id: number
  address: string
  port: number
  portEnd: number
  environment: ProxyEnvironment
  protocol: ProxyProtocol
  detail: string | null
  applications: string | null
  urls: string | null
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export type ProxySettings = {
  host: string | null
  version: number | null
}

export type ProxyView = {
  id: number
  port: number
  detail: string
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
  access: ProxyAccess
}

export type ProxyListResponse = {
  settings: ProxySettings
  proxies: ProxyView[]
}

export type CreateProxyInput = {
  accessId: number
  port: number
  detail: string
}

export type UpdateProxyInput = {
  accessId?: number
  port?: number
  detail?: string
  isActive?: boolean
  version: number
}

export type UpdateProxySettingsInput = {
  host: string
  version?: number
}
