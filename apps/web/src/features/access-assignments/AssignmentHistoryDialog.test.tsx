import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssignmentHistoryDialog } from './AssignmentHistoryDialog'
import {
  requestAssignmentHistory,
  type AssignmentHistoryEvent,
  type AssignmentView,
} from './api'

vi.mock('./api', () => ({
  requestAssignmentHistory: vi.fn(),
}))

const requestAssignmentHistoryMock = vi.mocked(requestAssignmentHistory)

const sampleAssignment: AssignmentView = {
  id: 42,
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
  version: 3,
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
}

const sampleEvents: AssignmentHistoryEvent[] = [
  {
    occurredAt: '2026-10-15T10:00:00.000Z',
    actorUsername: 'admin',
    channel: 'app',
    action: 'access_assignment.created',
    before: null,
    after: {
      personId: 10,
      personName: 'Carlos Tester',
      accessId: 101,
      accessLabel: '10.0.0.1:80',
      expiresOn: '2026-11-15',
    },
  },
  {
    occurredAt: '2026-10-16T14:30:00.000Z',
    actorUsername: 'supervisor',
    channel: 'app',
    action: 'access_assignment.updated',
    before: {
      personId: 10,
      personName: 'Carlos Tester',
      accessId: 101,
      accessLabel: '10.0.0.1:80',
      expiresOn: '2026-11-15',
    },
    after: {
      personId: 20,
      personName: 'Ana Pérez',
      accessId: 101,
      accessLabel: '10.0.0.1:80',
      expiresOn: '2026-12-15',
    },
  },
  {
    occurredAt: '2026-10-17T11:00:00.000Z',
    actorUsername: null,
    channel: 'local',
    action: 'access_assignment.updated',
    before: {
      personId: 20,
      accessId: 101,
      expiresOn: '2026-12-15',
    },
    after: {
      personId: 20,
      accessId: 102,
      expiresOn: '2026-12-15',
    },
  },
]

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('AssignmentHistoryDialog', () => {
  it('muestra eventos de creación y actualización con formato de cambios', async () => {
    requestAssignmentHistoryMock.mockResolvedValue(sampleEvents)

    render(
      <AssignmentHistoryDialog
        assignment={sampleAssignment}
        onClose={vi.fn()}
      />,
    )

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Historial de la asignación' })).toBeInTheDocument()

    // Acciones y actores
    expect(await screen.findByText('Asignación creada')).toBeInTheDocument()
    expect(screen.getAllByText('Asignación actualizada')).toHaveLength(2)
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('supervisor')).toBeInTheDocument()
    expect(screen.getByText('Sistema')).toBeInTheDocument()

    // Creación
    expect(screen.getByText(/QA: Carlos Tester; Acceso: 10\.0\.0\.1:80/i)).toBeInTheDocument()

    // Actualización con nombres
    expect(screen.getByText(/QA: Carlos Tester → Ana Pérez/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Vencimiento:/i)).toHaveLength(2)

    // Actualización con fallback a IDs si faltan labels
    expect(screen.getByText(/Acceso: Acceso #101 → Acceso #102/i)).toBeInTheDocument()
  })

  it('muestra mensaje cuando no hay eventos', async () => {
    requestAssignmentHistoryMock.mockResolvedValue([])

    render(
      <AssignmentHistoryDialog
        assignment={sampleAssignment}
        onClose={vi.fn()}
      />,
    )

    expect(
      await screen.findByText('Sin eventos registrados para esta asignación.'),
    ).toBeInTheDocument()
  })

  it('muestra error del servidor y permite reintentar', async () => {
    requestAssignmentHistoryMock.mockRejectedValueOnce(
      new Error('No se pudo conectar.'),
    )
    requestAssignmentHistoryMock.mockResolvedValueOnce(sampleEvents)

    render(
      <AssignmentHistoryDialog
        assignment={sampleAssignment}
        onClose={vi.fn()}
      />,
    )

    expect(
      await screen.findByText('No se pudo cargar el historial'),
    ).toBeInTheDocument()
    expect(screen.getByText('No se pudo conectar.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Asignación creada')).toBeInTheDocument()
  })
})
