import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPerson,
  requestPeople,
  requestPersonHistory,
  updatePerson,
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

describe('personal api', () => {
  it('lista personas con búsqueda e inactivos', async () => {
    const fetchMock = mockFetch([])

    await requestPeople({ includeInactive: true, search: '  MUÑOZ  ' })

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/personal?includeInactive=1&q=MU%C3%91OZ')
  })

  it('omite los filtros vacíos', async () => {
    const fetchMock = mockFetch([])

    await requestPeople({ includeInactive: false, search: '   ' })

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/personal')
  })

  it('crea una persona con el nombre recibido', async () => {
    const fetchMock = mockFetch({ id: 1 })

    await createPerson('Ana Pérez')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/personal')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'Ana Pérez' })
  })

  it('actualiza con versión y campos cambiados', async () => {
    const fetchMock = mockFetch({ id: 7 })

    await updatePerson(7, { name: 'Ana María', version: 3 })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/personal/7')
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({
      name: 'Ana María',
      version: 3,
    })
  })

  it('consulta el historial de la persona', async () => {
    const fetchMock = mockFetch([])

    await requestPersonHistory(9)

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/personal/9/history')
  })
})
