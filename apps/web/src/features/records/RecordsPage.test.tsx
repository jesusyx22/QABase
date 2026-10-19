import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { PermissionKey } from '@qabase/shared'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { monthRange } from '@/features/records/filters'
import { RecordsPage } from '@/pages/RecordsPage'

type MockResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

type MockApi = {
  calls: string[]
}

function jsonResponse(body: unknown, status = 200): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

const levels = [
  { type: 'merito', level: 1, label: 'Menor', description: '' },
  { type: 'merito', level: 2, label: 'Moderado', description: '' },
  { type: 'merito', level: 3, label: 'Relevante', description: '' },
  { type: 'merito', level: 4, label: 'Alto', description: '' },
  { type: 'merito', level: 5, label: 'Excepcional', description: '' },
  { type: 'incidencia', level: 1, label: 'Menor', description: '' },
  { type: 'incidencia', level: 2, label: 'Moderado', description: '' },
  { type: 'incidencia', level: 3, label: 'Relevante', description: '' },
  { type: 'incidencia', level: 4, label: 'Alto', description: '' },
  { type: 'incidencia', level: 5, label: 'Crítico', description: '' },
]

const recordsPage = {
  items: [
    {
      id: 10,
      qa: { id: 1, name: 'Ana Quispe', isActive: true },
      type: 'merito',
      eventDate: '2026-10-10',
      level: 3,
      levelLabel: 'Relevante',
      detail: 'Previno una regresión en la entrega',
      status: 'vigente',
      version: 1,
      createdAt: '2026-10-10T15:00:00.000Z',
      updatedAt: '2026-10-10T15:00:00.000Z',
      annulledAt: null,
      annulReason: null,
    },
    {
      id: 11,
      qa: { id: 2, name: 'Beto Mamani', isActive: false },
      type: 'incidencia',
      eventDate: '2026-10-09',
      level: 2,
      levelLabel: 'Moderado',
      detail: 'Omitió una validación en la prueba de regresión',
      status: 'vigente',
      version: 1,
      createdAt: '2026-10-09T15:00:00.000Z',
      updatedAt: '2026-10-09T15:00:00.000Z',
      annulledAt: null,
      annulReason: null,
    },
  ],
  page: 1,
  pageSize: 25,
  total: 2,
  totals: {
    merits: { count: 1, points: 3 },
    incidents: { count: 1, points: 2 },
  },
  byQa: [
    {
      id: 1,
      name: 'Ana Quispe',
      isActive: true,
      merits: { count: 1, points: 3 },
      incidents: { count: 0, points: 0 },
    },
    {
      id: 2,
      name: 'Beto Mamani',
      isActive: false,
      merits: { count: 0, points: 0 },
      incidents: { count: 1, points: 2 },
    },
  ],
}

function mockApi(): MockApi {
  const calls: string[] = []

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      calls.push(url)

      if (url.startsWith('/api/personal/options')) {
        return jsonResponse([
          { id: 1, name: 'Ana Quispe', isActive: true },
          { id: 2, name: 'Beto Mamani', isActive: false },
        ])
      }
      if (url.startsWith('/api/records/levels')) {
        return jsonResponse(levels)
      }
      if (url.startsWith('/api/records')) {
        return jsonResponse(recordsPage)
      }

      return jsonResponse({ error: { code: 'not_found', message: 'No existe.' } }, 404)
    }),
  )

  return { calls }
}

function authValue(permissions: PermissionKey[]): AuthContextValue {
  const noop = async () => {}

  return {
    status: 'authenticated',
    session: {
      authenticated: true,
      csrfToken: 'csrf',
      account: {
        id: 1,
        username: 'admin',
        role: { id: 1, name: 'Administrador' },
        permissions,
      },
    },
    setupRequired: false,
    login: noop,
    logout: noop,
    changePassword: noop,
  }
}

function renderPage(permissions: PermissionKey[]) {
  return render(
    <AuthContext.Provider value={authValue(permissions)}>
      <MemoryRouter initialEntries={['/registros']}>
        <RecordsPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

function recordsCalls(calls: string[]): URL[] {
  return calls
    .filter((call) => call.startsWith('/api/records?'))
    .map((call) => new URL(call, 'http://localhost'))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('RecordsPage', () => {
  it('consulta el mes local actual por defecto y muestra el listado y el resumen', async () => {
    const { calls } = mockApi()
    renderPage([
      'registros.ver',
      'registros.crear',
      'registros.historial',
    ])

    expect(
      await screen.findByText('Previno una regresión en la entrega'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Omitió una validación en la prueba de regresión'),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(/Beto Mamani/).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('Inactivo').length).toBeGreaterThan(0)
    expect(screen.queryByText(/saldo neto/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Nuevo registro' }),
    ).toBeInTheDocument()

    const current = monthRange(new Date(), 0)
    const request = recordsCalls(calls)[0]
    expect(request).toBeDefined()
    if (request === undefined) {
      throw new Error('No se consultó el listado de registros.')
    }
    expect(request.searchParams.get('from')).toBe(current.from)
    expect(request.searchParams.get('to')).toBe(current.to)
    expect(request.searchParams.get('page')).toBe('1')
    expect(request.searchParams.get('pageSize')).toBe('25')
  })

  it('el atajo de mes anterior consulta el rango y vuelve a la página 1', async () => {
    const { calls } = mockApi()
    renderPage(['registros.ver'])

    await screen.findByText('Previno una regresión en la entrega')
    fireEvent.click(
      screen.getByRole('button', { name: 'Mes anterior' }),
    )

    const previous = monthRange(new Date(), -1)

    await waitFor(() => {
      expect(
        recordsCalls(calls).some(
          (request) =>
            request.searchParams.get('from') === previous.from &&
            request.searchParams.get('to') === previous.to &&
            request.searchParams.get('page') === '1',
        ),
      ).toBe(true)
    })
  })

  it('solo muestra incluir anulados y nuevo registro con sus permisos', async () => {
    mockApi()
    const { unmount } = renderPage(['registros.ver'])

    await screen.findByText('Previno una regresión en la entrega')
    expect(screen.queryByText('Incluir anulados')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Nuevo registro' }),
    ).not.toBeInTheDocument()

    unmount()
    mockApi()
    renderPage(['registros.ver', 'registros.historial', 'registros.crear'])

    await screen.findByText('Previno una regresión en la entrega')
    expect(screen.getByText('Incluir anulados')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Nuevo registro' }),
    ).toBeInTheDocument()
  })
})
