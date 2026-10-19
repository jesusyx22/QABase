import type { PermissionKey } from '@qabase/shared'
import { apiFetch } from '@/lib/api'
import type { HistoryEntry } from '@/features/users/history'

export type Role = {
  id: number
  name: string
  isProtected: boolean
  version: number
  permissions: PermissionKey[]
}

export function listRoles(signal?: AbortSignal): Promise<Role[]> {
  return apiFetch<Role[]>('/api/roles', { signal })
}

export function createRole(name: string): Promise<Role> {
  return apiFetch<Role>('/api/roles', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function renameRole(
  id: number,
  input: { name: string; version: number },
): Promise<Role> {
  return apiFetch<Role>(`/api/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function setRolePermissions(
  id: number,
  permissions: PermissionKey[],
): Promise<Role> {
  return apiFetch<Role>(`/api/roles/${id}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  })
}

export function listRoleHistory(
  id: number,
  signal?: AbortSignal,
): Promise<HistoryEntry[]> {
  return apiFetch<HistoryEntry[]>(`/api/roles/${id}/history`, { signal })
}
