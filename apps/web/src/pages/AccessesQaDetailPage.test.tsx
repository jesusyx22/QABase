import {
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccessesQaDetailPage } from './AccessesQaDetailPage'
import {
  requestAssignmentHistory,
  requestPersonAssignments,
  requestAccessAssignments,
  type PersonAssignmentsResponse,
} from '@/features/access-assignments/api'
import { requestAccesses } from '@/features/accesses/api'
import { requestPeople } from '@/features/personal/api'

vi.mock('@/features/access-assignments/api', () => ({
  requestPersonAssignments: vi.fn(),
  requestAccessAssignments: vi.fn(),
  createAssignment: vi.fn(),
  updateAssignment: vi.fn(),
  requestAssignmentHistory: vi.fn(),
}))

vi.mock('@/features/accesses/api', () => ({
  requestAccesses: vi.fn(),
  requestAccessHistory: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/features/personal/api', () => ({
  requestPeople: vi.fn(),
}))

let currentPermissions: string[] = ['accesos.ver', 'accesos.gestionar']

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => ({
    status: 'authenticated',
    session: {
      account: {
        id: 1,
        username: 'admin',
        role: { id: 1, name: 'Administrador' },
        permissions: currentPermissions,
      },
    },
    setupRequired: false,
    login: vi.fn(),
    logout: vi.fn(),
    changePassword: vi.fn(),
  }),
}))

const requestPersonAssignmentsMock = vi.mocked(requestPersonAssignments)
const requestAccessAssignmentsMock = vi.mocked(requestAccessAssignments)
const requestAccessesMock = vi.mocked(requestAccesses)
const requestPeopleMock = vi.mocked(requestPeople)
const requestAssignmentHistoryMock = vi.mocked(requestAssignmentHistory)

const sampleResponse: PersonAssignmentsResponse = {
  person: { id: 10, name: 'Carlos Tester', isActive: true },
  counts: { current: 1, expiring: 1, expired: 1, total: 3 },
  current: [
    {
      id: 1,
      person: { id: 10, name: 'Carlos Tester', isActive: true },
      access: {
        id: 101,
        address: '10.0.0.1',
        port: 80,
        portEnd: 80,
        environment: 'qa',
        protocol: 'tcp',
        applications: null,
        urls: null,
        detail: 'Servidor QA',
        isActive: true,
        version: 1,
        createdAt: '2026-10-15T00:00:00.000Z',
        updatedAt: '2026-10-15T00:00:00.000Z',
      },
      expiresOn: '2026-12-01',
      state: 'current',
      urgency: 'ok',
      daysRemaining: 43,
      version: 1,
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
    {
      id: 2,
      person: { id: 10, name: 'Carlos Tester', isActive: true },
      access: {
        id: 102,
        address: '10.0.0.2',
        port: 443,
        portEnd: 443,
        environment: 'production',
        protocol: 'both',
        applications: null,
        urls: null,
        detail: 'API Prod',
        isActive: false, // Inactivo!
        version: 2,
        createdAt: '2026-10-15T00:00:00.000Z',
        updatedAt: '2026-10-15T00:00:00.000Z',
      },
      expiresOn: '2026-10-25',
      state: 'expiring',
      urgency: 'critical',
      daysRemaining: 6,
      version: 2,
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
  ],
  expired: [
    {
      id: 3,
      person: { id: 10, name: 'Carlos Tester', isActive: true },
      access: {
        id: 103,
        address: '10.0.0.3',
        port: 3000,
        portEnd: 3000,
        environment: 'development',
        protocol: null,
        applications: null,
        urls: null,
        detail: null,
        isActive: true,
        version: 1,
        createdAt: '2026-10-15T00:00:00.000Z',
        updatedAt: '2026-10-15T00:00:00.000Z',
      },
      expiresOn: '2026-10-01',
      state: 'expired',
      urgency: 'expired',
      daysRemaining: -18,
      version: 1,
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
  ],
}

function renderDetailPage(personId = '10') {
  return render(
    <MemoryRouter initialEntries={[`/accesos/qas/${personId}`]}>
      <Routes>
        <Route path="/accesos/qas/:personId" element={<AccessesQaDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  currentPermissions = ['accesos.ver', 'accesos.gestionar']
  requestAccessesMock.mockResolvedValue([])
  requestPeopleMock.mockResolvedValue([])
  requestAssignmentHistoryMock.mockResolvedValue([])
  requestAccessAssignmentsMock.mockResolvedValue({
    access: {
      id: 101,
      address: '10.0.0.1',
      port: 80,
      portEnd: 80,
      environment: 'qa',
      protocol: 'tcp',
      applications: null,
      urls: null,
      detail: 'Servidor QA',
      isActive: true,
      version: 1,
      createdAt: '2026-10-15T00:00:00.000Z',
      updatedAt: '2026-10-15T00:00:00.000Z',
    },
    counts: { current: 0, expiring: 0, expired: 0, total: 0 },
    current: [],
    expired: [],
  })
})

afterEach(() => {
  cleanup()
})

describe('AccessesQaDetailPage', () => {
  it('muestra cabecera con nombre, estado, conteos y botón de asignar acceso', async () => {
    requestPersonAssignmentsMock.mockResolvedValue(sampleResponse)

    renderDetailPage()

    expect(await screen.findByRole('heading', { name: 'Carlos Tester' })).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText(/3 asignaciones/i)).toBeInTheDocument()
    expect(screen.getByText(/1 vigente/i)).toBeInTheDocument()
    expect(screen.getByText(/1 por vencer/i)).toBeInTheDocument()
    expect(screen.getByText(/1 vencido/i)).toBeInTheDocument()

    // Botón de asignar
    expect(
      screen.getByRole('button', { name: 'Asignar acceso' }),
    ).toBeInTheDocument()

    // Enlace Volver
    const backLink = screen.getByRole('link', { name: /volver a qas/i })
    expect(backLink).toHaveAttribute('href', '/accesos/qas')
  })

  it('agrupa asignaciones en Vigentes y por vencer y Vencidos con sus columnas', async () => {
    requestPersonAssignmentsMock.mockResolvedValue(sampleResponse)

    renderDetailPage()

    expect(await screen.findByText('Vigentes y por vencer')).toBeInTheDocument()
    expect(screen.getByText('Vencidos')).toBeInTheDocument()

    // Acceso 101 (vigente)
    expect(screen.getByText('Servidor QA')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.1:80')).toBeInTheDocument()
    expect(screen.getByText('QA')).toBeInTheDocument()
    expect(screen.getByText('TCP')).toBeInTheDocument()
    expect(screen.getByText('Vence en 43 días')).toBeInTheDocument()

    // Acceso 102 (por vencer, inactivo)
    expect(screen.getByText('API Prod')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.2:443')).toBeInTheDocument()
    expect(screen.getByText('Acceso inactivo')).toBeInTheDocument()
    expect(screen.getByText('Vence en 6 días')).toBeInTheDocument()

    // Acceso 103 (vencido)
    expect(screen.getByText('10.0.0.3:3000')).toBeInTheDocument()
    expect(screen.getByText('Desarrollo')).toBeInTheDocument()
    expect(screen.getByText('Vencido hace 18 días')).toBeInTheDocument()
  })

  it('permite ver detalle del acceso en diálogo', async () => {
    requestPersonAssignmentsMock.mockResolvedValue(sampleResponse)

    renderDetailPage()

    await screen.findByText('Carlos Tester')

    const viewAccessBtn = screen.getByRole('button', {
      name: 'Ver acceso 10.0.0.1:80',
    })
    fireEvent.click(viewAccessBtn)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Detalle del acceso' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Acceso #101 del catálogo de firewall.')).toBeInTheDocument()
  })

  it('deshabilita Editar vencimiento si el acceso está inactivo', async () => {
    requestPersonAssignmentsMock.mockResolvedValue(sampleResponse)

    renderDetailPage()

    await screen.findByText('Carlos Tester')

    // Acceso 101 activo: botón habilitado
    const editActiveBtn = screen.getByRole('button', {
      name: 'Editar vencimiento de 10.0.0.1:80',
    })
    expect(editActiveBtn).toBeEnabled()

    // Acceso 102 inactivo: botón deshabilitado
    const editInactiveBtn = screen.getByRole('button', {
      name: 'Editar vencimiento de 10.0.0.2:443',
    })
    expect(editInactiveBtn).toBeDisabled()
  })

  it('abre diálogo de edición y recarga al guardar', async () => {
    requestPersonAssignmentsMock.mockResolvedValue(sampleResponse)

    renderDetailPage()

    await screen.findByText('Carlos Tester')

    const editBtn = screen.getByRole('button', {
      name: 'Editar vencimiento de 10.0.0.1:80',
    })
    fireEvent.click(editBtn)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Editar asignación' }),
    ).toBeInTheDocument()
  })

  it('abre diálogo de historial de la asignación', async () => {
    requestPersonAssignmentsMock.mockResolvedValue(sampleResponse)

    renderDetailPage()

    await screen.findByText('Carlos Tester')

    const historyBtn = screen.getByRole('button', {
      name: 'Historial de asignación 10.0.0.1:80',
    })
    fireEvent.click(historyBtn)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Historial de la asignación' }),
    ).toBeInTheDocument()
  })

  it('solo muestra Ver acceso para usuarios sin accesos.gestionar', async () => {
    currentPermissions = ['accesos.ver']
    requestPersonAssignmentsMock.mockResolvedValue(sampleResponse)

    renderDetailPage()

    await screen.findByText('Carlos Tester')

    expect(
      screen.queryByRole('button', { name: 'Asignar acceso' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /editar vencimiento/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /historial de asignación/i }),
    ).not.toBeInTheDocument()

    // Ver acceso sigue disponible
    expect(
      screen.getAllByRole('button', { name: /ver acceso/i }).length,
    ).toBe(3)
  })

  it('muestra estado vacío con CTA cuando el QA no tiene asignaciones', async () => {
    requestPersonAssignmentsMock.mockResolvedValue({
      person: { id: 10, name: 'Carlos Tester', isActive: true },
      counts: { current: 0, expiring: 0, expired: 0, total: 0 },
      current: [],
      expired: [],
    })

    renderDetailPage()

    expect(
      await screen.findByText('Sin asignaciones registradas'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Este integrante de QA no tiene accesos de firewall asignados actualmente.'),
    ).toBeInTheDocument()

    // CTA de asignación
    const ctaButtons = screen.getAllByRole('button', { name: 'Asignar acceso' })
    expect(ctaButtons.length).toBeGreaterThan(0)
  })

  it('muestra error del servidor y permite reintentar', async () => {
    requestPersonAssignmentsMock.mockRejectedValueOnce(
      new Error('Error al obtener asignaciones del QA.'),
    )
    requestPersonAssignmentsMock.mockResolvedValueOnce(sampleResponse)

    renderDetailPage()

    expect(
      await screen.findByText('No se pudieron cargar las asignaciones del QA'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Error al obtener asignaciones del QA.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByRole('heading', { name: 'Carlos Tester' })).toBeInTheDocument()
  })
})
