import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PersonalPage } from '@/pages/PersonalPage'
import {
  createPerson,
  requestPeople,
  requestPersonHistory,
  updatePerson,
} from '@/features/personal/api'

vi.mock('@/features/personal/api', () => ({
  createPerson: vi.fn(),
  requestPeople: vi.fn(),
  requestPersonHistory: vi.fn(),
  updatePerson: vi.fn(),
}))

const requestPeopleMock = vi.mocked(requestPeople)
const createPersonMock = vi.mocked(createPerson)
const updatePersonMock = vi.mocked(updatePerson)
const requestHistoryMock = vi.mocked(requestPersonHistory)

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('PersonalPage', () => {
  it('lista personas con su estado y acciones', async () => {
    requestPeopleMock.mockResolvedValue([
      {
        id: 1,
        sourceId: 10,
        name: 'Ana Pérez',
        isActive: true,
        version: 1,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
      },
      {
        id: 2,
        sourceId: 11,
        name: 'Luis Gómez',
        isActive: false,
        version: 2,
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-02T00:00:00.000Z',
      },
    ])

    render(<PersonalPage />)

    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('Luis Gómez')).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /Renombrar a/ }),
    ).toHaveLength(2)
    expect(
      screen.getAllByRole('button', { name: /historial de/i }),
    ).toHaveLength(2)
    expect(requestPeopleMock).toHaveBeenCalledWith({
      includeInactive: false,
      search: '',
    })
  })

  it('muestra el estado vacío cuando no hay personas', async () => {
    requestPeopleMock.mockResolvedValue([])

    render(<PersonalPage />)

    expect(await screen.findByText('Catálogo vacío')).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Nueva persona' }).length,
    ).toBeGreaterThan(0)
  })

  it('muestra el error del servidor y permite reintentar', async () => {
    requestPeopleMock.mockRejectedValueOnce(
      new Error('No tienes permiso para gestionar personal.'),
    )
    requestPeopleMock.mockResolvedValueOnce([])

    render(<PersonalPage />)

    expect(
      await screen.findByText('No tienes permiso para gestionar personal.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Catálogo vacío')).toBeInTheDocument()
  })

  it('no deja crear ni actualizar desde el listado sin abrir un diálogo', () => {
    requestPeopleMock.mockResolvedValue([])

    render(<PersonalPage />)

    expect(createPersonMock).not.toHaveBeenCalled()
    expect(updatePersonMock).not.toHaveBeenCalled()
    expect(requestHistoryMock).not.toHaveBeenCalled()
  })

  it('filtra por nombre e incluye inactivos', async () => {
    requestPeopleMock.mockResolvedValue([])

    render(<PersonalPage />)

    await screen.findByText('Catálogo vacío')

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Incluir inactivos' }),
    )
    await waitFor(() => {
      expect(requestPeopleMock).toHaveBeenLastCalledWith({
        includeInactive: true,
        search: '',
      })
    })

    fireEvent.change(screen.getByLabelText('Buscar por nombre'), {
      target: { value: 'Ana' },
    })
    await waitFor(
      () => {
        expect(requestPeopleMock).toHaveBeenLastCalledWith({
          includeInactive: true,
          search: 'Ana',
        })
      },
      { timeout: 1500 },
    )
  })

  it('crea una persona desde el diálogo con el nombre recortado', async () => {
    requestPeopleMock.mockResolvedValue([])
    createPersonMock.mockResolvedValue({
      id: 3,
      sourceId: null,
      name: 'Carla',
      isActive: true,
      version: 1,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    })

    render(<PersonalPage />)

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Nueva persona' }))[0]!,
    )
    fireEvent.change(await screen.findByLabelText('Nombre'), {
      target: { value: '  Carla  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear persona' }))

    await waitFor(() => {
      expect(createPersonMock).toHaveBeenCalledWith('Carla')
    })
    await waitFor(() => {
      expect(requestPeopleMock).toHaveBeenCalledTimes(2)
    })
  })

  it('renombra con la versión de la persona', async () => {
    const person = {
      id: 1,
      sourceId: 10,
      name: 'Ana',
      isActive: true,
      version: 4,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    }
    requestPeopleMock.mockResolvedValue([person])
    updatePersonMock.mockResolvedValue({ ...person, name: 'Ana María' })

    render(<PersonalPage />)

    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: /Renombrar a/ }))
    fireEvent.change(await screen.findByLabelText('Nombre'), {
      target: { value: 'Ana María' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))

    await waitFor(() => {
      expect(updatePersonMock).toHaveBeenCalledWith(1, {
        name: 'Ana María',
        version: 4,
      })
    })
  })

  it('desactiva con confirmación y la versión actual', async () => {
    const person = {
      id: 1,
      sourceId: 10,
      name: 'Ana',
      isActive: true,
      version: 2,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    }
    requestPeopleMock.mockResolvedValue([person])
    updatePersonMock.mockResolvedValue({ ...person, isActive: false })

    render(<PersonalPage />)

    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: /Desactivar a/ }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }))

    await waitFor(() => {
      expect(updatePersonMock).toHaveBeenCalledWith(1, {
        isActive: false,
        version: 2,
      })
    })
  })

  it('muestra el historial de solo lectura', async () => {
    const person = {
      id: 1,
      sourceId: 10,
      name: 'Ana',
      isActive: true,
      version: 1,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    }
    requestPeopleMock.mockResolvedValue([person])
    requestHistoryMock.mockResolvedValue([
      {
        occurredAt: '2026-10-01T12:00:00.000Z',
        actorUsername: 'admin',
        channel: 'app',
        action: 'personal.renamed',
        before: { name: 'Ana' },
        after: { name: 'Ana María' },
      },
    ])

    render(<PersonalPage />)

    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: /historial de/i }))

    expect(
      await screen.findByText('Historial de Ana'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Renombrado')).toBeInTheDocument()
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(
      screen.getByText('Nombre: «Ana» → «Ana María»'),
    ).toBeInTheDocument()
  })
})
