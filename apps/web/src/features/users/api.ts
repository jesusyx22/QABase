import type { PermissionKey } from '@qabase/shared'
import { apiFetch } from '@/lib/api'
import type { HistoryEntry } from './history'

export type UserRole = {
  id: number
  name: string
  isProtected: boolean
}

export type User = {
  id: number
  username: string
  role: UserRole
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export type RoleOption = UserRole & {
  version: number
  permissions: PermissionKey[]
}

export type ListUsersParams = {
  includeInactive: boolean
  search: string
}

export type CreateUserInput = {
  username: string
  password: string
  roleId: number
}

export type UpdateUserInput = {
  username?: string
  roleId?: number
  isActive?: boolean
  version: number
}

export function usersQuery(params: ListUsersParams): string {
  const query = new URLSearchParams()
  if (params.includeInactive) {
    query.set('includeInactive', '1')
  }
  const search = params.search.trim()
  if (search !== '') {
    query.set('q', search)
  }
  const serialized = query.toString()
  return serialized === '' ? '' : `?${serialized}`
}

export function listUsers(
  params: ListUsersParams,
  signal?: AbortSignal,
): Promise<User[]> {
  return apiFetch<User[]>(`/api/users${usersQuery(params)}`, { signal })
}

export function listRoleOptions(signal?: AbortSignal): Promise<RoleOption[]> {
  return apiFetch<RoleOption[]>('/api/roles/options', { signal })
}

export function createUser(input: CreateUserInput): Promise<User> {
  return apiFetch<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateUser(id: number, input: UpdateUserInput): Promise<User> {
  return apiFetch<User>(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function resetUserPassword(
  id: number,
  newPassword: string,
): Promise<void> {
  return apiFetch<void>(`/api/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ newPassword }),
  })
}

export function listUserHistory(
  id: number,
  signal?: AbortSignal,
): Promise<HistoryEntry[]> {
  return apiFetch<HistoryEntry[]>(`/api/users/${id}/history`, { signal })
}
