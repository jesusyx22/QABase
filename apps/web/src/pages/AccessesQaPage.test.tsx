import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccessesQaPage } from '@/pages/AccessesQaPage'
import {
  createAssignment,
  requestOverview,
  requestPersonAssignments,
  type OverviewResponse,
} from '@/features/access-assignments/api'
import { requestAccesses } from '@/features/accesses/api'

vi.mock('@/features/access-assignments/api', () => ({
  requestOverview: vi.fn(),
  requestPersonAssignments: vi.fn(),
  requestAccessAssignments: vi.fn(),
  createAssignment: vi.fn(),
  updateAssignment: vi.fn(),
  requestAssignmentHistory: vi.fn(),
}))

vi.mock('@/features/accesses/api', () => ({
  requestAccesses: vi.fn(),
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

const requestOverviewMock = vi.mocked(requestOverview)
const requestAccessesMock = vi.mocked(requestAccesses)
const requestPersonAssignmentsMock = vi.mocked(requestPersonAssignments)
const createAssignmentMock = vi.mocked(createAssignment)

const sampleOverview: OverviewResponse = {
  kpis: {
    qasWithAccess: 3,
    current: 4,
    expiring: 3,
    expired: 1,
  },
  qas: [
    {
      person: { id: 1, name: 'Ana Gómez', isActive: true },
      counts: { current: 1, expiring: 1, expired: 0, total: 2 },
      nextExpiry: '2026-10-25',
      urgency: 'critical',
    },
    {
      person: { id: 2, name: 'Carlos Díaz', isActive: true },
      counts: { current: 2, expiring: 1, expired: 0, total: 3 },
      nextExpiry: '2026-11-10',
      urgency: 'warning',
    },
    {
      person: { id: 3, name: 'Beatriz Ramos', isActive: true },
      counts: { current: 1, expiring: 0, expired: 0, total: 1 },
      nextExpiry: '2026-12-01',
      urgency: 'ok',
    },
    {
      person: { id: 4, name: 'David Silva', isActive: true },
      counts: { current: 0, expiring: 0, expired: 1, total: 1 },
      nextExpiry: null,
      urgency: 'expired',
    },
    {
      person: { id: 5, name: 'Elena Torres', isActive: false },
      counts: { current: 0, expiring: 0, expired: 0, total: 0 },
      nextExpiry: null,
      urgency: 'none',
    },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  currentPermissions = ['accesos.ver', 'accesos.gestionar']
  requestAccessesMock.mockResolvedValue([])
  requestPersonAssignmentsMock.mockResolvedValue({
    person: { id: 1, name: 'Ana Gómez', isActive: true },
    counts: { current: 0, expiring: 0, expired: 0, total: 0 },
    current: [],
    expired: [],
  })
})

afterEach(() => {
  cleanup()
})

function renderComponent() {
  return render(
    <MemoryRouter>
      <AccessesQaPage />
    </MemoryRouter>,
  )
}

describe('AccessesQaPage', () => {
  it('lista QAs con estado, conteos, próximo vencimiento, semáforo y enlace a detalle', async () => {
    requestOverviewMock.mockResolvedValue(sampleOverview)

    renderComponent()

    expect(await screen.findByText('Ana Gómez')).toBeInTheDocument()
    expect(screen.getByText('Carlos Díaz')).toBeInTheDocument()
    expect(screen.getByText('Beatriz Ramos')).toBeInTheDocument()
    expect(screen.getByText('David Silva')).toBeInTheDocument()
    expect(screen.getByText('Elena Torres')).toBeInTheDocument()

    // Estados
    expect(screen.getAllByText('Activo').length).toBe(4)
    expect(screen.getByText('Inactivo')).toBeInTheDocument()

    // Semáforos
    expect(screen.getByText('Urgente')).toBeInTheDocument()
    expect(screen.getByText('Próximo')).toBeInTheDocument()
    expect(screen.getByText('Al día')).toBeInTheDocument()
    expect(screen.getAllByText('Vencidos').length).toBeGreaterThan(0)
    expect(screen.getByText('Sin accesos')).toBeInTheDocument()

    // Links a detalle
    const detailLinks = screen.getAllByRole('link', { name: /ver detalle/i })
    expect(detailLinks).toHaveLength(5)
    expect(detailLinks[0]).toHaveAttribute('href', '/accesos/qas/1')
    expect(detailLinks[1]).toHaveAttribute('href', '/accesos/qas/2')

    // Llamada a la API
    expect(requestOverviewMock).toHaveBeenCalledWith({
      search: '',
      filter: 'all',
      sort: 'urgency',
    })
  })

  it('los KPIs muestran las cifras globales y filtran la lista al pulsarlos', async () => {
    requestOverviewMock.mockResolvedValue(sampleOverview)

    renderComponent()

    expect(await screen.findByText('Ana Gómez')).toBeInTheDocument()

    // Botones de los 4 KPIs con sus cifras
    const qasKpi = screen.getByRole('button', { name: 'QAs con accesos' })
    const currentKpi = screen.getByRole('button', { name: 'Vigentes' })
    const expiringKpi = screen.getByRole('button', { name: 'Por vencer' })
    const expiredKpi = screen.getByRole('button', { name: 'Vencidas' })

    expect(within(qasKpi).getByText('3')).toBeInTheDocument()
    expect(within(currentKpi).getByText('4')).toBeInTheDocument()
    expect(within(expiringKpi).getByText('3')).toBeInTheDocument()
    expect(within(expiredKpi).getByText('1')).toBeInTheDocument()

    // Clic en KPI "Por vencer"
    expect(expiringKpi).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(expiringKpi)

    await waitFor(() => {
      expect(requestOverviewMock).toHaveBeenLastCalledWith({
        search: '',
        filter: 'expiring',
        sort: 'urgency',
      })
    })

    expect(expiringKpi).toHaveAttribute('aria-pressed', 'true')

    // Al volver a pulsar el mismo KPI, desactiva el filtro y vuelve a 'all'
    fireEvent.click(expiringKpi)

    await waitFor(() => {
      expect(requestOverviewMock).toHaveBeenLastCalledWith({
        search: '',
        filter: 'all',
        sort: 'urgency',
      })
    })

    expect(expiringKpi).toHaveAttribute('aria-pressed', 'false')
  })

  it('busca por nombre llamando a la API con debouncing', async () => {
    requestOverviewMock.mockResolvedValue(sampleOverview)

    renderComponent()

    await screen.findByText('Ana Gómez')

    fireEvent.change(screen.getByLabelText(/buscar qa/i), {
      target: { value: 'Carlos' },
    })

    await waitFor(
      () => {
        expect(requestOverviewMock).toHaveBeenLastCalledWith({
          search: 'Carlos',
          filter: 'all',
          sort: 'urgency',
        })
      },
      { timeout: 1500 },
    )
  })

  it('filtra por estado usando el selector', async () => {
    requestOverviewMock.mockResolvedValue(sampleOverview)

    renderComponent()

    await screen.findByText('Ana Gómez')

    const filterTrigger = screen.getByTestId('qa-filter-select')
    fireEvent.click(filterTrigger)

    const option = await screen.findByRole('option', { name: 'Con accesos' })
    fireEvent.pointerDown(option)
    fireEvent.pointerUp(option)
    fireEvent.click(option)

    await waitFor(() => {
      expect(requestOverviewMock).toHaveBeenLastCalledWith({
        search: '',
        filter: 'withAccess',
        sort: 'urgency',
      })
    })
  })

  it('cambia el orden llamando a la API', async () => {
    requestOverviewMock.mockResolvedValue(sampleOverview)

    renderComponent()

    await screen.findByText('Ana Gómez')

    const sortTrigger = screen.getByTestId('qa-sort-select')
    fireEvent.click(sortTrigger)

    const option = await screen.findByRole('option', { name: 'Por nombre' })
    fireEvent.pointerDown(option)
    fireEvent.pointerUp(option)
    fireEvent.click(option)

    await waitFor(() => {
      expect(requestOverviewMock).toHaveBeenLastCalledWith({
        search: '',
        filter: 'all',
        sort: 'name',
      })
    })
  })

  it('limpia los filtros al hacer clic en Limpiar filtros', async () => {
    requestOverviewMock.mockResolvedValue({
      kpis: { qasWithAccess: 0, current: 0, expiring: 0, expired: 0 },
      qas: [],
    })

    renderComponent()

    await screen.findByText('Sin personal QA')

    fireEvent.change(screen.getByLabelText(/buscar qa/i), {
      target: { value: 'Nadie' },
    })

    expect(await screen.findByText('Sin resultados')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    await waitFor(() => {
      expect(requestOverviewMock).toHaveBeenLastCalledWith({
        search: '',
        filter: 'all',
        sort: 'urgency',
      })
    })
  })

  it('muestra estado vacío cuando no hay personal QA', async () => {
    requestOverviewMock.mockResolvedValue({
      kpis: { qasWithAccess: 0, current: 0, expiring: 0, expired: 0 },
      qas: [],
    })

    renderComponent()

    expect(await screen.findByText('Sin personal QA')).toBeInTheDocument()
    expect(
      screen.getByText('Todavía no hay integrantes de personal QA registrados.'),
    ).toBeInTheDocument()
  })

  it('muestra error del servidor y permite reintentar', async () => {
    requestOverviewMock.mockRejectedValueOnce(
      new Error('Fallo de conexión al cargar la vista por QA.'),
    )
    requestOverviewMock.mockResolvedValueOnce(sampleOverview)

    renderComponent()

    expect(
      await screen.findByText('No se pudo cargar la vista por QA'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Fallo de conexión al cargar la vista por QA.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Ana Gómez')).toBeInTheDocument()
  })

  it('permite abrir el diálogo de asignación para quien tiene accesos.gestionar y recarga al guardar', async () => {
    requestOverviewMock.mockResolvedValue(sampleOverview)
    requestAccessesMock.mockResolvedValue([
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
        createdAt: '',
        updatedAt: '',
      },
    ])
    createAssignmentMock.mockResolvedValue({
      id: 99,
      person: { id: 1, name: 'Ana Gómez', isActive: true },
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
      expiresOn: '2026-11-20',
      state: 'current',
      urgency: 'ok',
      daysRemaining: 30,
      version: 1,
      createdAt: '',
      updatedAt: '',
    })

    renderComponent()

    await screen.findByText('Ana Gómez')

    // Botón Asignar en la fila de Ana Gómez
    const assignButton = screen.getByRole('button', {
      name: 'Asignar acceso a Ana Gómez',
    })
    fireEvent.click(assignButton)

    // Se abre el diálogo
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Asignar acceso' }),
    ).toBeInTheDocument()

    // Atajo +30 días
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

    // Guardar
    fireEvent.click(screen.getByRole('button', { name: 'Asignar acceso' }))

    await waitFor(() => {
      expect(createAssignmentMock).toHaveBeenCalled()
    })

    // Se recarga la vista
    await waitFor(() => {
      expect(requestOverviewMock).toHaveBeenCalledTimes(2)
    })
  })

  it('no muestra el botón Asignar para quien solo tiene accesos.ver', async () => {
    currentPermissions = ['accesos.ver']
    requestOverviewMock.mockResolvedValue(sampleOverview)

    renderComponent()

    await screen.findByText('Ana Gómez')

    expect(
      screen.queryByRole('button', { name: /asignar acceso a/i }),
    ).not.toBeInTheDocument()
  })

  it('deshabilita el botón Asignar para QAs inactivos', async () => {
    requestOverviewMock.mockResolvedValue(sampleOverview)

    renderComponent()

    await screen.findByText('Elena Torres')

    const inactiveAssignBtn = screen.getByRole('button', {
      name: 'Asignar acceso a Elena Torres',
    })
    expect(inactiveAssignBtn).toBeDisabled()
  })
})
