import { apiFetch } from '@/lib/api'

export type AssignmentState = 'current' | 'expiring' | 'expired'
export type AssignmentUrgency = 'ok' | 'warning' | 'critical' | 'expired'
export type QaUrgency = 'critical' | 'warning' | 'ok' | 'expired' | 'none'

export type AssignmentCounts = {
  current: number
  expiring: number
  expired: number
  total: number
}

export type AssignmentView = {
  id: number
  person: {
    id: number
    name: string
    isActive: boolean
  }
  access: {
    id: number
    address: string
    port: number
    portEnd: number
    environment: 'development' | 'qa' | 'production' | 'unspecified'
    protocol: 'tcp' | 'udp' | 'both' | null
    detail: string | null
    applications: string | null
    urls: string | null
    isActive: boolean
    version: number
    createdAt: string
    updatedAt: string
  }
  expiresOn: string
  state: AssignmentState
  urgency: AssignmentUrgency
  daysRemaining: number
  version: number
  createdAt: string
  updatedAt: string
}

export type QaOverview = {
  person: {
    id: number
    name: string
    isActive: boolean
  }
  counts: AssignmentCounts
  nextExpiry: string | null
  urgency: QaUrgency
}

export type OverviewKpis = {
  qasWithAccess: number
  current: number
  expiring: number
  expired: number
}

export type OverviewResponse = {
  kpis: OverviewKpis
  qas: QaOverview[]
}

export type PersonAssignmentsResponse = {
  person: {
    id: number
    name: string
    isActive: boolean
  }
  counts: AssignmentCounts
  current: AssignmentView[]
  expired: AssignmentView[]
}

export type AccessAssignmentsResponse = {
  access: {
    id: number
    address: string
    port: number
    portEnd: number
    environment: 'development' | 'qa' | 'production' | 'unspecified'
    protocol: 'tcp' | 'udp' | 'both' | null
    detail: string | null
    applications: string | null
    urls: string | null
    isActive: boolean
    version: number
    createdAt: string
    updatedAt: string
  }
  counts: AssignmentCounts
  current: AssignmentView[]
  expired: AssignmentView[]
}

export type AssignmentHistoryEvent = {
  occurredAt: string
  actorUsername: string | null
  channel: 'app' | 'local'
  action: string
  before: unknown
  after: unknown
}

export type OverviewFilter =
  | 'all'
  | 'withAccess'
  | 'current'
  | 'expiring'
  | 'expired'
  | 'none'
  | 'inactive'

export type OverviewSort = 'urgency' | 'name'

export type OverviewQuery = {
  search?: string
  filter?: OverviewFilter
  sort?: OverviewSort
}

export type CreateAssignmentInput = {
  personId: number
  accessId: number
  expiresOn: string
}

export type UpdateAssignmentInput = {
  personId?: number
  accessId?: number
  expiresOn?: string
  version: number
}

export function requestOverview(
  input: OverviewQuery = {},
): Promise<OverviewResponse> {
  const params = new URLSearchParams()
  const search = (input.search ?? '').trim()
  if (search !== '') {
    params.set('q', search)
  }
  if (input.filter && input.filter !== 'all') {
    params.set('filter', input.filter)
  }
  if (input.sort && input.sort !== 'urgency') {
    params.set('sort', input.sort)
  }

  const query = params.toString()
  return apiFetch<OverviewResponse>(
    `/api/access-assignments/overview${query === '' ? '' : `?${query}`}`,
  )
}

export function requestPersonAssignments(
  personId: number,
): Promise<PersonAssignmentsResponse> {
  return apiFetch<PersonAssignmentsResponse>(
    `/api/personal/${personId}/access-assignments`,
  )
}

export function requestAccessAssignments(
  accessId: number,
): Promise<AccessAssignmentsResponse> {
  return apiFetch<AccessAssignmentsResponse>(
    `/api/accesses/${accessId}/assignments`,
  )
}

export function createAssignment(
  input: CreateAssignmentInput,
): Promise<AssignmentView> {
  return apiFetch<AssignmentView>('/api/access-assignments', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateAssignment(
  id: number,
  input: UpdateAssignmentInput,
): Promise<AssignmentView> {
  return apiFetch<AssignmentView>(`/api/access-assignments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function requestAssignmentHistory(
  id: number,
): Promise<AssignmentHistoryEvent[]> {
  return apiFetch<AssignmentHistoryEvent[]>(
    `/api/access-assignments/${id}/history`,
  )
}
