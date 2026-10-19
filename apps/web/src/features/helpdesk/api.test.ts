import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestSyncStatus, requestTicket, requestTickets } from './api'

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

describe('helpdesk api', () => {
  it('lista tickets con búsqueda recortada', async () => {
    const fetchMock = mockFetch([])

    await requestTickets('  R-900  ')

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/helpdesk/tickets?q=R-900')
  })

  it('lista todos los tickets cuando no hay búsqueda', async () => {
    const fetchMock = mockFetch([])

    await requestTickets('   ')

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/helpdesk/tickets')
  })

  it('consulta el detalle de un ticket', async () => {
    const fetchMock = mockFetch({ id: 4 })

    await requestTicket(4)

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/helpdesk/tickets/4')
  })

  it('consulta el estado de sincronización', async () => {
    const fetchMock = mockFetch({ status: 'success' })

    await requestSyncStatus()

    const [url] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/helpdesk/sync-status')
  })
})
