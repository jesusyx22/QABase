import type {
  ProxyEnvironment,
  ProxyHealth,
  ProxyListResponse,
  ProxyLogsResponse,
  ProxyPort,
  ProxyRoute,
  ProxyRouteAccess,
  ProxyRuntime,
  ProxyServiceView,
  ProxySettings,
  ProxyStatus,
  UpdateProxySettingsInput,
} from '@qabase/shared'
import { apiFetch } from '@/lib/api'

export type {
  ProxyEnvironment,
  ProxyHealth,
  ProxyListResponse,
  ProxyLogsResponse,
  ProxyPort,
  ProxyRoute,
  ProxyRouteAccess,
  ProxyRuntime,
  ProxyServiceView,
  ProxySettings,
  ProxyStatus,
  UpdateProxySettingsInput,
}

export function requestProxies(): Promise<ProxyListResponse> {
  return apiFetch<ProxyListResponse>('/api/proxies')
}

export function updateProxySettings(
  input: UpdateProxySettingsInput,
): Promise<ProxySettings> {
  return apiFetch<ProxySettings>('/api/proxies/settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function requestStartProxy(id: number): Promise<ProxyServiceView> {
  return apiFetch<ProxyServiceView>(`/api/proxies/${id}/start`, {
    method: 'POST',
  })
}

export function requestStopProxy(
  id: number,
  confirmExternal = false,
): Promise<ProxyServiceView> {
  return apiFetch<ProxyServiceView>(`/api/proxies/${id}/stop`, {
    method: 'POST',
    body: JSON.stringify({ confirmExternal }),
  })
}

export function requestRestartProxy(
  id: number,
  confirmExternal = false,
): Promise<ProxyServiceView> {
  return apiFetch<ProxyServiceView>(`/api/proxies/${id}/restart`, {
    method: 'POST',
    body: JSON.stringify({ confirmExternal }),
  })
}

export function requestProxyLogs(
  id: number,
  lines = 100,
): Promise<ProxyLogsResponse> {
  return apiFetch<ProxyLogsResponse>(`/api/proxies/${id}/logs?lines=${lines}`)
}
