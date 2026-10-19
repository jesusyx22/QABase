import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HelpdeskPage } from '@/pages/HelpdeskPage'
import {
  requestSyncStatus,
  requestTicket,
  requestTickets,
} from '@/features/helpdesk/api'

vi.mock('@/features/helpdesk/api', () => ({
  requestSyncStatus: vi.fn(),
  requestTicket: vi.fn(),
  requestTickets: vi.fn(),
}))

const requestTicketsMock = vi.mocked(requestTickets)
const requestTicketMock = vi.mocked(requestTicket)
const requestSyncStatusMock = vi.mocked(requestSyncStatus)

const summary = {
  id: 1,
  reference: 'R-900',
  subject: 'No abre el sistema',
  description: 'Detalle completo',
  status: 'new',
  statusLabel: 'Nuevo',
  requester: 'Ana',
  organization: 'QA',
  team: 'Soporte',
  analyst: 'JORGE',
  reportedAt: '2026-10-01T00:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  lastSyncedAt: '2026-10-02T00:00:00.000Z',
  attachments: [],
}

const successStatus = {
  status: 'success' as const,
  lastStartedAt: '2026-10-02T00:00:00.000Z',
  lastFinishedAt: '2026-10-02T00:00:00.000Z',
  message: null,
  createdCount: 1,
  updatedCount: 0,
  rejectedCount: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  requestSyncStatusMock.mockResolvedValue(successStatus)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HelpdeskPage', () => {
  it('muestra la sincronización de solo lectura y la lista local', async () => {
    requestTicketsMock.mockResolvedValue([summary])

    render(<HelpdeskPage />)

    expect(await screen.findByText('R-900')).toBeInTheDocument()
    expect(screen.getByText('Nuevo')).toBeInTheDocument()
    expect(screen.getByText('JORGE')).toBeInTheDocument()
    expect(screen.getByText(/Sincronización de solo lectura/)).toBeInTheDocument()
    expect(
      screen.getByText(/QABase no llama a la web institucional/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Importar CSV/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /crear ticket/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Actualizar lista' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Ver detalle del ticket/ }),
    ).toBeInTheDocument()
    expect(requestTicketsMock).toHaveBeenCalledWith('')
  })

  it('muestra la copia vacía sin acciones de importación', async () => {
    requestTicketsMock.mockResolvedValue([])

    render(<HelpdeskPage />)

    expect(await screen.findByText('Sin tickets sincronizados')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Importar CSV/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /crear ticket/i }),
    ).not.toBeInTheDocument()
  })

  it('muestra el error del servidor y permite reintentar', async () => {
    requestTicketsMock.mockRejectedValue(
      new Error('No se pudo leer la copia local.'),
    )

    render(<HelpdeskPage />)

    expect(
      await screen.findByText('No se pudo leer la copia local.'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument()
    expect(requestTicketMock).not.toHaveBeenCalled()
  })

  it('abre el detalle con descripción y enlaces de anexos', async () => {
    requestTicketsMock.mockResolvedValue([summary])
    requestTicketMock.mockResolvedValue({
      ...summary,
      attachments: [
        {
          id: 7,
          fileName: 'anexo.pdf',
          contentType: 'application/pdf',
          sizeBytes: 2048,
          downloadUrl: '/api/helpdesk/attachments/7/download',
        },
      ],
    })

    render(<HelpdeskPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: /Ver detalle del ticket/ }),
    )

    expect(await screen.findByText('Ticket R-900')).toBeInTheDocument()
    expect(screen.getByText('Detalle completo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'anexo.pdf' })).toHaveAttribute(
      'href',
      '/api/helpdesk/attachments/7/download',
    )
  })

  it('indica cuando el detalle no tiene anexos', async () => {
    requestTicketsMock.mockResolvedValue([
      { ...summary, description: null },
    ])
    requestTicketMock.mockResolvedValue({ ...summary, description: null })

    render(<HelpdeskPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: /Ver detalle del ticket/ }),
    )

    expect(await screen.findByText('Sin descripción')).toBeInTheDocument()
    expect(screen.getByText('Sin anexos')).toBeInTheDocument()
  })
})
