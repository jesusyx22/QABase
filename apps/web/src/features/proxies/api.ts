import type {
  ProxyAllowlistEntry,
  ProxyEnvironment,
  ProxyHealth,
  ProxyListResponse,
  ProxyLogsResponse,
  ProxyPort,
  ProxyProtocol,
  ProxyRoute,
  ProxyRouteAccess,
  ProxyRuntime,
  ProxyServiceView,
  ProxySettings,
  ProxyStatus,
  UpdateProxyAllowlistInput,
  UpdateProxySettingsInput,
} from '@qabase/shared'
import { apiFetch } from '@/lib/api'

export type {
  ProxyAllowlistEntry,
  ProxyEnvironment,
  ProxyHealth,
  ProxyListResponse,
  ProxyLogsResponse,
  ProxyPort,
  ProxyProtocol,
  ProxyRoute,
  ProxyRouteAccess,
  ProxyRuntime,
  ProxyServiceView,
  ProxySettings,
  ProxyStatus,
  UpdateProxyAllowlistInput,
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

export function requestUpdateProxyAllowlist(
  id: number,
  entries: ProxyAllowlistEntry[],
): Promise<ProxyServiceView> {
  return apiFetch<ProxyServiceView>(`/api/proxies/${id}/allowlist`, {
    method: 'PATCH',
    body: JSON.stringify({ entries }),
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
