import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Role } from '@/features/roles/api'
import { RolesPage } from './RolesPage'

const roles: Role[] = [
  {
    id: 1,
    name: 'Administrador',
    isProtected: true,
    version: 1,
    permissions: ['registros.ver', 'usuarios.gestionar', 'roles.gestionar'],
  },
  {
    id: 2,
    name: 'Editor',
    isProtected: false,
    version: 2,
    permissions: ['registros.ver', 'registros.crear'],
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
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => response(body, status)),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('RolesPage', () => {
  it('lista nombre, protección y número de permisos', async () => {
    mockFetch(roles)

    render(<RolesPage />)

    expect(await screen.findByText('Administrador')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()

    const protectedRow = screen.getByText('Administrador').closest('tr')
    expect(protectedRow).not.toBeNull()
    expect(
      within(protectedRow as HTMLTableRowElement).getByText('Protegido'),
    ).toBeInTheDocument()
    expect(
      within(protectedRow as HTMLTableRowElement).queryByRole('button', {
        name: /Renombrar rol/,
      }),
    ).not.toBeInTheDocument()
    expect(
      within(protectedRow as HTMLTableRowElement).queryByRole('button', {
        name: /Editar permisos del rol/,
      }),
    ).not.toBeInTheDocument()

    const editableRow = screen.getByText('Editor').closest('tr')
    expect(editableRow).not.toBeNull()
    expect(
      within(editableRow as HTMLTableRowElement).getByRole('button', {
        name: /Renombrar rol/,
      }),
    ).toBeInTheDocument()
    expect(
      within(editableRow as HTMLTableRowElement).getByRole('button', {
        name: /Editar permisos del rol/,
      }),
    ).toBeInTheDocument()
  })

  it('muestra el error del servidor y permite reintentar', async () => {
    mockFetch(
      { error: { code: 'internal', message: 'Fallo controlado.' } },
      500,
    )

    render(<RolesPage />)

    expect(
      await screen.findByText('No se pudieron cargar los roles'),
    ).toBeInTheDocument()
    expect(screen.getByText('Fallo controlado.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })
})
