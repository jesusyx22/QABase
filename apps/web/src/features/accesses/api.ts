import { apiFetch } from '@/lib/api'

export type AccessEnvironment =
  | 'development'
  | 'qa'
  | 'production'
  | 'unspecified'
export type AccessProtocol = 'tcp' | 'udp' | 'both'
export type AccessStatusFilter = 'all' | 'active' | 'inactive'
export type AccessProtocolFilter = 'all' | AccessProtocol | 'none'

export type Access = {
  id: number
  address: string
  port: number
  portEnd: number
  environment: AccessEnvironment
  protocol: AccessProtocol | null
  detail: string | null
  applications: string | null
  urls: string | null
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export type AccessHistoryEvent = {
  occurredAt: string
  actorUsername: string | null
  channel: 'app' | 'local'
  action: string
  before: unknown
  after: unknown
}

export type AccessListInput = {
  search: string
  environment: AccessEnvironment | 'all'
  status: AccessStatusFilter
  protocol: AccessProtocolFilter
}

export type AccessInput = {
  address: string
  port: number
  portEnd?: number | null
  environment: AccessEnvironment
  protocol: AccessProtocol | null
  detail: string | null
  applications?: string | null
  urls?: string | null
}

export type AccessChanges = Partial<AccessInput> & {
  isActive?: boolean
  version: number
}

export function requestAccesses(input: AccessListInput): Promise<Access[]> {
  const params = new URLSearchParams()
  const search = input.search.trim()
  if (search !== '') {
    params.set('q', search)
  }
  if (input.environment !== 'all') {
    params.set('environment', input.environment)
  }
  if (input.status !== 'all') {
    params.set('status', input.status)
  }
  if (input.protocol !== 'all') {
    params.set('protocol', input.protocol)
  }

  const query = params.toString()
  return apiFetch<Access[]>(
    `/api/accesses${query === '' ? '' : `?${query}`}`,
  )
}

export function createAccess(input: AccessInput): Promise<Access> {
  return apiFetch<Access>('/api/accesses', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateAccess(
  accessId: number,
  changes: AccessChanges,
): Promise<Access> {
  return apiFetch<Access>(`/api/accesses/${accessId}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}

export function requestAccessHistory(
  accessId: number,
): Promise<AccessHistoryEvent[]> {
  return apiFetch<AccessHistoryEvent[]>(`/api/accesses/${accessId}/history`)
}
