import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from '@/features/auth/AuthProvider'

function mockSession(body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => body,
    })),
  )
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('redirige a login y avisa cuando falta el setup', async () => {
    mockSession({
      authenticated: false,
      setupRequired: true,
      csrfToken: 'csrf-anonimo',
    })

    renderAt('/')

    expect(await screen.findByText('Iniciar sesión')).toBeInTheDocument()
    expect(screen.getByText('npm run setup')).toBeInTheDocument()
  })

  it('muestra el panel con la cuenta autenticada', async () => {
    mockSession({
      authenticated: true,
      csrfToken: 'csrf-autenticado',
      account: {
        id: 1,
        username: 'admin',
        role: { id: 1, name: 'Administrador' },
        permissions: ['registros.ver'],
      },
    })

    renderAt('/')

    expect(await screen.findByRole('heading', { name: 'Panel' })).toBeInTheDocument()
    expect(screen.getAllByText('admin').length).toBeGreaterThan(0)
    expect(screen.getByText('Administrador')).toBeInTheDocument()
  })

  it('redirige login a panel cuando ya hay sesión', async () => {
    mockSession({
      authenticated: true,
      csrfToken: 'csrf-autenticado',
      account: {
        id: 1,
        username: 'admin',
        role: { id: 1, name: 'Administrador' },
        permissions: [],
      },
    })

    renderAt('/login')

    expect(await screen.findByRole('heading', { name: 'Panel' })).toBeInTheDocument()
  })
})
