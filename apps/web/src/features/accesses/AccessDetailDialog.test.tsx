import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccessDetailDialog } from './AccessDetailDialog'
import type { Access } from './api'
import {
  requestAccessAssignments,
  type AccessAssignmentsResponse,
} from '@/features/access-assignments/api'

vi.mock('@/features/access-assignments/api', () => ({
  requestAccessAssignments: vi.fn(),
  updateAssignment: vi.fn(),
  requestAssignmentHistory: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/features/accesses/api', () => ({
  requestAccesses: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/features/personal/api', () => ({
  requestPeople: vi.fn().mockResolvedValue([]),
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

const requestAccessAssignmentsMock = vi.mocked(requestAccessAssignments)

const sampleAccess: Access = {
  id: 101,
  address: '10.20.10.15',
  port: 443,
  portEnd: 443,
  environment: 'production',
  protocol: 'tcp',
  applications: null,
  urls: null,
  detail: 'API de pagos',
  isActive: true,
  version: 1,
  createdAt: '2026-10-15T10:00:00.000Z',
  updatedAt: '2026-10-15T10:00:00.000Z',
}

const sampleResponse: AccessAssignmentsResponse = {
  access: sampleAccess,
  counts: { current: 1, expiring: 1, expired: 1, total: 3 },
  current: [
    {
      id: 1,
      person: { id: 10, name: 'Carlos Tester', isActive: true },
      access: sampleAccess,
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
      person: { id: 20, name: 'Elena Inactiva', isActive: false },
      access: sampleAccess,
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
      person: { id: 30, name: 'David Vencido', isActive: true },
      access: sampleAccess,
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

function renderDialog(access: Access = sampleAccess) {
  return render(
    <MemoryRouter>
      <AccessDetailDialog access={access} onClose={vi.fn()} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  currentPermissions = ['accesos.ver', 'accesos.gestionar']
  requestAccessAssignmentsMock.mockResolvedValue(sampleResponse)
})

afterEach(() => {
  cleanup()
})

describe('AccessDetailDialog', () => {
  it('muestra detalle del acceso y carga la sección de QAs asignados agrupada', async () => {
    renderDialog()

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Detalle del acceso' })).toBeInTheDocument()
    expect(screen.getByText('10.20.10.15')).toBeInTheDocument()
    expect(screen.getByText('443')).toBeInTheDocument()

    // Sección inversa
    expect(await screen.findByText('QAs asignados')).toBeInTheDocument()
    expect(screen.getByText('Vigentes y por vencer')).toBeInTheDocument()
    expect(screen.getByText('Vencidos')).toBeInTheDocument()

    // Filas
    expect(screen.getByText('Carlos Tester')).toBeInTheDocument()
    expect(screen.getByText('Vence en 43 días')).toBeInTheDocument()

    expect(screen.getByText('Elena Inactiva')).toBeInTheDocument()
    expect(screen.getByText('QA inactivo')).toBeInTheDocument()
    expect(screen.getByText('Vence en 6 días')).toBeInTheDocument()

    expect(screen.getByText('David Vencido')).toBeInTheDocument()
    expect(screen.getByText('Vencido hace 18 días')).toBeInTheDocument()
  })

  it('muestra acciones de gestión solo para admin y deshabilita si el QA está inactivo', async () => {
    renderDialog()

    await screen.findByText('QAs asignados')

    // Ver QA
    expect(screen.getAllByRole('button', { name: /ver qa/i })).toHaveLength(3)

    // Editar vencimiento
    const editEnabled = screen.getByRole('button', {
      name: 'Editar vencimiento de Carlos Tester',
    })
    expect(editEnabled).toBeEnabled()

    const editDisabled = screen.getByRole('button', {
      name: 'Editar vencimiento de Elena Inactiva',
    })
    expect(editDisabled).toBeDisabled()

    // Historial
    expect(screen.getAllByRole('button', { name: /historial de asignación/i })).toHaveLength(3)
  })

  it('oculta acciones de gestión para usuarios sin accesos.gestionar', async () => {
    currentPermissions = ['accesos.ver']

    renderDialog()

    await screen.findByText('QAs asignados')

    expect(screen.queryByRole('button', { name: /editar vencimiento/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /historial de asignación/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /ver qa/i })).toHaveLength(3)
  })

  it('muestra mensaje vacío cuando no hay QAs asignados', async () => {
    requestAccessAssignmentsMock.mockResolvedValue({
      access: sampleAccess,
      counts: { current: 0, expiring: 0, expired: 0, total: 0 },
      current: [],
      expired: [],
    })

    renderDialog()

    expect(
      await screen.findByText('No hay integrantes de QA asignados a este acceso.'),
    ).toBeInTheDocument()
  })

  it('muestra error del servidor y permite reintentar', async () => {
    requestAccessAssignmentsMock.mockRejectedValueOnce(
      new Error('Fallo al cargar asignaciones.'),
    )
    requestAccessAssignmentsMock.mockResolvedValueOnce(sampleResponse)

    renderDialog()

    expect(
      await screen.findByText('No se pudieron cargar los QAs asignados'),
    ).toBeInTheDocument()
    expect(screen.getByText('Fallo al cargar asignaciones.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Carlos Tester')).toBeInTheDocument()
  })
})
