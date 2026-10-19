import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/features/users/api'
import { UsersPage } from './UsersPage'

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    session: {
      account: {
        id: 1,
        username: 'admin',
        role: { id: 1, name: 'Administrador' },
        permissions: ['usuarios.gestionar'],
      },
    },
  }),
}))

const users: User[] = [
  {
    id: 1,
    username: 'admin',
    role: { id: 1, name: 'Administrador', isProtected: true },
    isActive: true,
    version: 1,
    createdAt: '2026-10-18T10:00:00.000Z',
    updatedAt: '2026-10-18T10:00:00.000Z',
  },
  {
    id: 2,
    username: 'ana',
    role: { id: 2, name: 'Editor', isProtected: false },
    isActive: false,
    version: 3,
    createdAt: '2026-10-18T10:00:00.000Z',
    updatedAt: '2026-10-18T10:00:00.000Z',
  },
]

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

function mockFetch(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => response(body, status))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('UsersPage', () => {
  it('lista las cuentas con rol y estado', async () => {
    mockFetch(users)

    render(<UsersPage />)

    expect(await screen.findByText('ana')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
    expect(screen.getAllByText('Protegido').length).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: 'Restablecer contraseña de ana' }),
    ).toBeInTheDocument()
  })

  it('muestra un estado vacío con la opción de incluir inactivos', async () => {
    mockFetch([])

    render(<UsersPage />)

    expect(
      await screen.findByText('No hay cuentas activas.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Incluir inactivos' }),
    ).toBeInTheDocument()
  })

  it('muestra el error del servidor y permite reintentar', async () => {
    mockFetch(
      {
        error: { code: 'forbidden', message: 'No tienes permiso.' },
      },
      403,
    )

    render(<UsersPage />)

    expect(
      await screen.findByText('No se pudieron cargar las cuentas'),
    ).toBeInTheDocument()
    expect(screen.getByText('No tienes permiso.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
