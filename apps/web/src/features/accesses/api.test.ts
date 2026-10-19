import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createAccess,
  requestAccesses,
  requestAccessHistory,
  updateAccess,
} from './api'

function mockFetch(body: unknown) {
  const fetchMock = vi.fn<
    (input: string | URL | Request, init?: RequestInit) => Promise<{
      ok: boolean
      status: number
      json: () => Promise<unknown>
    }>
  >()
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('accesses api', () => {
  it('lista con búsqueda y todos los filtros', async () => {
    const fetchMock = mockFetch([])

    await requestAccesses({
      search: '  API  ',
      environment: 'qa',
      status: 'active',
      protocol: 'none',
    })

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe(
      '/api/accesses?q=API&environment=qa&status=active&protocol=none',
    )
  })

  it('omite búsqueda y filtros por defecto', async () => {
    const fetchMock = mockFetch([])

    await requestAccesses({
      search: '   ',
      environment: 'all',
      status: 'all',
      protocol: 'all',
    })

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/accesses')
  })

  it('crea un acceso con su contrato', async () => {
    const fetchMock = mockFetch({ id: 1 })

    await createAccess({
      address: 'api.empresa.local',
      port: 443,
      environment: 'production',
      protocol: 'tcp',
      detail: 'API de pagos',
    })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/accesses')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      address: 'api.empresa.local',
      port: 443,
      environment: 'production',
      protocol: 'tcp',
      detail: 'API de pagos',
    })
  })

  it('actualiza con versión y campos cambiados', async () => {
    const fetchMock = mockFetch({ id: 7 })

    await updateAccess(7, { isActive: false, version: 3 })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/accesses/7')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({
      isActive: false,
      version: 3,
    })
  })

  it('consulta el historial del acceso', async () => {
    const fetchMock = mockFetch([])

    await requestAccessHistory(9)

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/accesses/9/history')
  })
})
