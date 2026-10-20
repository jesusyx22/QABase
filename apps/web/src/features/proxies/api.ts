import type {
  CreateProxyInput,
  ProxyListResponse,
  ProxySettings,
  ProxyView,
  UpdateProxyInput,
  UpdateProxySettingsInput,
} from '@qabase/shared'
import { apiFetch } from '@/lib/api'
import type { Access } from '@/features/accesses/api'

export type {
  CreateProxyInput,
  ProxyListResponse,
  ProxySettings,
  ProxyView,
  UpdateProxyInput,
  UpdateProxySettingsInput,
} from '@qabase/shared'

export function requestProxies(): Promise<ProxyListResponse> {
  return apiFetch<ProxyListResponse>('/api/proxies')
}

export function requestAccessOptions(): Promise<Access[]> {
  return apiFetch<Access[]>('/api/proxies/access-options')
}

export function updateProxySettings(
  input: UpdateProxySettingsInput,
): Promise<ProxySettings> {
  return apiFetch<ProxySettings>('/api/proxies/settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function createProxy(input: CreateProxyInput): Promise<ProxyView> {
  return apiFetch<ProxyView>('/api/proxies', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateProxy(
  id: number,
  changes: UpdateProxyInput,
): Promise<ProxyView> {
  return apiFetch<ProxyView>(`/api/proxies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(changes),
  })
}
