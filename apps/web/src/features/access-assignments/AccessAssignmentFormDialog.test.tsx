import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { peruToday, addDaysToDateOnly } from '@qabase/shared'
import { AccessAssignmentFormDialog } from './AccessAssignmentFormDialog'
import {
  createAssignment,
  requestPersonAssignments,
  updateAssignment,
  type AssignmentView,
} from './api'
import { requestAccesses, type Access } from '@/features/accesses/api'
import { requestPeople, type Person } from '@/features/personal/api'

vi.mock('./api', () => ({
  createAssignment: vi.fn(),
  updateAssignment: vi.fn(),
  requestPersonAssignments: vi.fn(),
}))

vi.mock('@/features/accesses/api', () => ({
  requestAccesses: vi.fn(),
}))

vi.mock('@/features/personal/api', () => ({
  requestPeople: vi.fn(),
}))

const createAssignmentMock = vi.mocked(createAssignment)
const updateAssignmentMock = vi.mocked(updateAssignment)
const requestPersonAssignmentsMock = vi.mocked(requestPersonAssignments)
const requestAccessesMock = vi.mocked(requestAccesses)
const requestPeopleMock = vi.mocked(requestPeople)

const samplePerson = {
  id: 10,
  name: 'Carlos Tester',
  isActive: true,
}

const sampleAccesses: Access[] = [
  {
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
  {
    id: 102,
    address: '10.0.0.2',
    port: 443,
    portEnd: 443,
    environment: 'production',
    protocol: 'both',
    applications: null,
    urls: null,
    detail: 'API Prod',
    isActive: true,
    version: 1,
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
  },
]

const samplePeople: Person[] = [
  {
    id: 10,
    name: 'Carlos Tester',
    isActive: true,
    sourceId: null,
    version: 1,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 20,
    name: 'Ana Pérez',
    isActive: true,
    sourceId: null,
    version: 2,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
]

const sampleAssignment: AssignmentView = {
  id: 50,
  person: samplePerson,
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

beforeEach(() => {
  vi.resetAllMocks()
  requestPersonAssignmentsMock.mockResolvedValue({
    person: samplePerson,
    counts: { current: 0, expiring: 0, expired: 0, total: 0 },
    current: [],
    expired: [],
  })
  requestAccessesMock.mockResolvedValue(sampleAccesses)
  requestPeopleMock.mockResolvedValue(samplePeople)
})

afterEach(() => {
  cleanup()
})

describe('AccessAssignmentFormDialog', () => {
  it('crea una asignación con QA fijo, selección de acceso y atajo +30', async () => {
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    const today = peruToday()
    const expectedExpiry = addDaysToDateOnly(today, 30)

    createAssignmentMock.mockResolvedValue({
      ...sampleAssignment,
      expiresOn: expectedExpiry,
    })

    render(
      <AccessAssignmentFormDialog
        mode="create"
        person={samplePerson}
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />,
    )

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Asignar acceso' })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Carlos Tester')).toBeDisabled()

    // Usar atajo +30 días
    fireEvent.click(screen.getByRole('button', { name: '+30 días' }))
    const dateInput = screen.getByLabelText(/fecha de vencimiento/i) as HTMLInputElement
    expect(dateInput.value).toBe(expectedExpiry)

    // Seleccionar acceso 101
    const accessTrigger = screen.getByTestId('assignment-access-select')
    fireEvent.click(accessTrigger)
    const option = await screen.findByRole('option', {
      name: /10\.0\.0\.1:80/i,
    })
    fireEvent.pointerDown(option)
    fireEvent.pointerUp(option)
    fireEvent.click(option)

    // Guardar
    fireEvent.click(screen.getByRole('button', { name: 'Asignar acceso' }))

    await waitFor(() => {
      expect(createAssignmentMock).toHaveBeenCalledWith({
        personId: 10,
        accessId: 101,
        expiresOn: expectedExpiry,
      })
    })

    expect(onSaved).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('mantiene el diálogo abierto si está activada la opción Asignar otro', async () => {
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    const today = peruToday()
    const expectedExpiry = addDaysToDateOnly(today, 60)

    createAssignmentMock.mockResolvedValue({
      ...sampleAssignment,
      expiresOn: expectedExpiry,
    })

    render(
      <AccessAssignmentFormDialog
        mode="create"
        person={samplePerson}
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />,
    )

    await screen.findByRole('dialog')

    // Atajo +60
    fireEvent.click(screen.getByRole('button', { name: '+60 días' }))

    // Seleccionar acceso
    const accessTrigger = screen.getByTestId('assignment-access-select')
    fireEvent.click(accessTrigger)
    const option = await screen.findByRole('option', {
      name: /10\.0\.0\.1:80/i,
    })
    fireEvent.pointerDown(option)
    fireEvent.pointerUp(option)
    fireEvent.click(option)

    // Marcar Asignar otro
    const checkbox = screen.getByLabelText(/asignar otro/i)
    fireEvent.click(checkbox)

    fireEvent.click(screen.getByRole('button', { name: 'Asignar acceso' }))

    await waitFor(() => {
      expect(createAssignmentMock).toHaveBeenCalled()
    })

    expect(onSaved).toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it('los accesos ya asignados aparecen deshabilitados con aviso', async () => {
    requestPersonAssignmentsMock.mockResolvedValue({
      person: samplePerson,
      counts: { current: 1, expiring: 0, expired: 1, total: 2 },
      current: [sampleAssignment],
      expired: [
        {
          ...sampleAssignment,
          id: 51,
          access: sampleAccesses[1]!,
          expiresOn: '2026-10-01',
          state: 'expired',
          urgency: 'expired',
          daysRemaining: -18,
        },
      ],
    })

    render(
      <AccessAssignmentFormDialog
        mode="create"
        person={samplePerson}
        open
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    await screen.findByRole('dialog')

    const accessTrigger = screen.getByTestId('assignment-access-select')
    fireEvent.click(accessTrigger)

    const option1 = await screen.findByRole('option', {
      name: /10\.0\.0\.1:80.*ya asignado/i,
    })
    expect(option1).toHaveAttribute('data-disabled', '')

    const option2 = await screen.findByRole('option', {
      name: /10\.0\.0\.2:443.*ya asignado.*vencid/i,
    })
    expect(option2).toHaveAttribute('data-disabled', '')
  })

  it('edita asignación con versión y permite cambiar QA y fecha', async () => {
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()

    updateAssignmentMock.mockResolvedValue({
      ...sampleAssignment,
      person: samplePeople[1]!,
      expiresOn: '2026-12-15',
      version: 4,
    })

    render(
      <AccessAssignmentFormDialog
        mode="edit"
        person={samplePerson}
        assignment={sampleAssignment}
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Editar asignación' })).toBeInTheDocument()

    // No debe haber botones atajos (+30/+60/+90)
    expect(screen.queryByRole('button', { name: '+30 días' })).not.toBeInTheDocument()

    // Cambiar QA a Ana Pérez
    const personTrigger = screen.getByTestId('assignment-person-select')
    fireEvent.click(personTrigger)
    const personOption = await screen.findByRole('option', { name: 'Ana Pérez' })
    fireEvent.pointerDown(personOption)
    fireEvent.pointerUp(personOption)
    fireEvent.click(personOption)

    // Cambiar fecha a '2026-12-15' (posterior a 2026-12-01, sin warning)
    const dateInput = screen.getByLabelText(/fecha de vencimiento/i)
    fireEvent.change(dateInput, { target: { value: '2026-12-15' } })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateAssignmentMock).toHaveBeenCalledWith(50, {
        personId: 20,
        accessId: 101,
        expiresOn: '2026-12-15',
        version: 3,
      })
    })

    expect(onSaved).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('pide confirmación en el mismo diálogo si la nueva fecha acorta el vencimiento', async () => {
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()

    updateAssignmentMock.mockResolvedValue({
      ...sampleAssignment,
      expiresOn: '2026-11-15',
      version: 4,
    })

    render(
      <AccessAssignmentFormDialog
        mode="edit"
        person={samplePerson}
        assignment={sampleAssignment} // expiresOn: 2026-12-01
        open
        onOpenChange={onOpenChange}
        onSaved={onSaved}
      />,
    )

    await screen.findByRole('heading', { name: 'Editar asignación' })

    // Acortar fecha a 2026-11-15 (anterior a 2026-12-01)
    const dateInput = screen.getByLabelText(/fecha de vencimiento/i)
    fireEvent.change(dateInput, { target: { value: '2026-11-15' } })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    // Aparece confirmación dentro del diálogo y no llama a updateAssignment todavía
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/anterior a la fecha de vencimiento actual/i)).toBeInTheDocument()
    expect(updateAssignmentMock).not.toHaveBeenCalled()

    // Confirmar
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y guardar' }))

    await waitFor(() => {
      expect(updateAssignmentMock).toHaveBeenCalledWith(50, {
        personId: 10,
        accessId: 101,
        expiresOn: '2026-11-15',
        version: 3,
      })
    })

    expect(onSaved).toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('muestra errores del servidor en un alert', async () => {
    createAssignmentMock.mockRejectedValue(
      new Error('El QA ya tiene este acceso asignado.'),
    )

    render(
      <AccessAssignmentFormDialog
        mode="create"
        person={samplePerson}
        open
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
      />,
    )

    await screen.findByRole('dialog')

    // Atajo +30
    fireEvent.click(screen.getByRole('button', { name: '+30 días' }))

    // Seleccionar acceso
    const accessTrigger = screen.getByTestId('assignment-access-select')
    fireEvent.click(accessTrigger)
    const option = await screen.findByRole('option', {
      name: /10\.0\.0\.1:80/i,
    })
    fireEvent.pointerDown(option)
    fireEvent.pointerUp(option)
    fireEvent.click(option)

    fireEvent.click(screen.getByRole('button', { name: 'Asignar acceso' }))

    expect(
      await screen.findByText('El QA ya tiene este acceso asignado.'),
    ).toBeInTheDocument()
  })
})
