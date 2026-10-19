import { apiFetch } from '@/lib/api'

export type Person = {
  id: number
  sourceId: number | null
  name: string
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export type PersonHistoryEvent = {
  occurredAt: string
  actorUsername: string | null
  channel: 'app' | 'local'
  action: string
  before: unknown
  after: unknown
}

export type PersonListInput = {
  includeInactive: boolean
  search: string
}

export type PersonChanges = {
  name?: string
  isActive?: boolean
  version: number
}

export function requestPeople(input: PersonListInput): Promise<Person[]> {
  const params = new URLSearchParams()
  if (input.includeInactive) {
    params.set('includeInactive', '1')
  }
  const search = input.search.trim()
  if (search !== '') {
    params.set('q', search)
  }

  const query = params.toString()
  return apiFetch<Person[]>(`/api/personal${query === '' ? '' : `?${query}`}`)
}

export function createPerson(name: string): Promise<Person> {
  return apiFetch<Person>('/api/personal', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function updatePerson(
  personId: number,
  changes: PersonChanges,
): Promise<Person> {
  return apiFetch<Person>(`/api/personal/${personId}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}

export function requestPersonHistory(
  personId: number,
): Promise<PersonHistoryEvent[]> {
  return apiFetch<PersonHistoryEvent[]>(`/api/personal/${personId}/history`)
}
