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
import { AccessesPage } from '@/pages/AccessesPage'
import {
  createAccess,
  requestAccesses,
  requestAccessHistory,
  updateAccess,
  type Access,
} from '@/features/accesses/api'
import { requestAccessAssignments } from '@/features/access-assignments/api'

vi.mock('@/features/accesses/api', () => ({
  requestAccesses: vi.fn(),
  createAccess: vi.fn(),
  updateAccess: vi.fn(),
  requestAccessHistory: vi.fn(),
}))

vi.mock('@/features/access-assignments/api', () => ({
  requestAccessAssignments: vi.fn(),
  updateAssignment: vi.fn(),
  requestAssignmentHistory: vi.fn().mockResolvedValue([]),
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

const requestAccessesMock = vi.mocked(requestAccesses)
const createAccessMock = vi.mocked(createAccess)
const updateAccessMock = vi.mocked(updateAccess)
const requestHistoryMock = vi.mocked(requestAccessHistory)
const requestAccessAssignmentsMock = vi.mocked(requestAccessAssignments)

const sampleAccesses: Access[] = [
  {
    id: 1,
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
  },
  {
    id: 2,
    address: 'qa-service.local',
    port: 8080,
    portEnd: 8080,
    environment: 'qa',
    protocol: null,
    applications: null,
    urls: null,
    detail: null,
    isActive: false,
    version: 2,
    createdAt: '2026-10-16T12:00:00.000Z',
    updatedAt: '2026-10-17T14:00:00.000Z',
  },
  {
    id: 3,
    address: 'dev.internal',
    port: 3000,
    portEnd: 3000,
    environment: 'development',
    protocol: 'both',
    applications: null,
    urls: null,
    detail: 'Mock de servicios',
    isActive: true,
    version: 1,
    createdAt: '2026-10-18T08:00:00.000Z',
    updatedAt: '2026-10-18T08:00:00.000Z',
  },
]

beforeEach(() => {
  vi.resetAllMocks()
  currentPermissions = ['accesos.ver', 'accesos.gestionar']
  requestAccessAssignmentsMock.mockResolvedValue({
    access: sampleAccesses[0]!,
    counts: { current: 0, expiring: 0, expired: 0, total: 0 },
    current: [],
    expired: [],
  })
})

afterEach(() => {
  cleanup()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <AccessesPage />
    </MemoryRouter>,
  )
}

describe('AccessesPage', () => {
  it('lista accesos con detalle, dirección, puerto, etiquetas y estado', async () => {
    requestAccessesMock.mockResolvedValue(sampleAccesses)

    renderPage()

    expect(await screen.findByText('10.20.10.15')).toBeInTheDocument()
    expect(screen.getByText('API de pagos')).toBeInTheDocument()
    expect(screen.getByText('443')).toBeInTheDocument()
    expect(screen.getByText('Producción')).toBeInTheDocument()
    expect(screen.getByText('TCP')).toBeInTheDocument()
    expect(screen.getAllByText('Activo').length).toBeGreaterThan(0)

    expect(screen.getByText('qa-service.local')).toBeInTheDocument()
    expect(screen.getByText('8080')).toBeInTheDocument()
    expect(screen.getByText('QA')).toBeInTheDocument()
    expect(screen.getByText('Sin especificar')).toBeInTheDocument()
    expect(screen.getAllByText('Inactivo').length).toBeGreaterThan(0)

    expect(screen.getByText('dev.internal')).toBeInTheDocument()
    expect(screen.getByText('3000')).toBeInTheDocument()
    expect(screen.getByText('Desarrollo')).toBeInTheDocument()
    expect(screen.getByText('TCP/UDP')).toBeInTheDocument()

    expect(screen.getAllByRole('button', { name: /detalle de/i })).toHaveLength(3)
    expect(requestAccessesMock).toHaveBeenCalledWith({
      search: '',
      environment: 'all',
      status: 'all',
      protocol: 'all',
    })
  })

  it('copia la dirección completa al hacer clic', async () => {
    requestAccessesMock.mockResolvedValue([sampleAccesses[0]!])
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    renderPage()

    await screen.findByText('10.20.10.15')
    fireEvent.click(
      screen.getAllByRole('button', {
        name: 'Copiar dirección 10.20.10.15',
      })[0]!,
    )

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('10.20.10.15')
    })
  })

  it('muestra rango de puertos, ambiente sin clasificar y metadatos', async () => {
    const rangeAccess: Access = {
      id: 9,
      address: '*.smartbear.com',
      port: 3000,
      portEnd: 3099,
      environment: 'unspecified',
      protocol: 'tcp',
      detail: 'Rango importado',
      applications: 'web-browsing, ssl',
      urls: 'https://example.test/a',
      isActive: true,
      version: 1,
      createdAt: '2026-10-19T00:00:00.000Z',
      updatedAt: '2026-10-19T00:00:00.000Z',
    }
    requestAccessesMock.mockResolvedValue([rangeAccess])

    renderPage()

    expect(await screen.findByText('3000–3099')).toBeInTheDocument()
    expect(screen.getByText('Sin clasificar')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ver detalle de *.smartbear.com:3000–3099',
      }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('web-browsing, ssl')).toBeInTheDocument()
    expect(within(dialog).getByText('https://example.test/a')).toBeInTheDocument()
    expect(within(dialog).getByText('3000–3099')).toBeInTheDocument()
  })

  it('crea un rango con aplicaciones y URLs', async () => {
    requestAccessesMock.mockResolvedValue([])
    createAccessMock.mockResolvedValue({
      id: 10,
      address: '*.smartbear.com',
      port: 3000,
      portEnd: 3099,
      environment: 'production',
      protocol: null,
      detail: 'Rango',
      applications: 'web-browsing',
      urls: 'https://example.test/a',
      isActive: true,
      version: 1,
      createdAt: '2026-10-19T00:00:00.000Z',
      updatedAt: '2026-10-19T00:00:00.000Z',
    })

    renderPage()

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Nuevo acceso' }))[0]!,
    )
    fireEvent.change(await screen.findByLabelText('Dirección'), {
      target: { value: '*.smartbear.com' },
    })
    fireEvent.change(screen.getByLabelText('Puerto inicio'), {
      target: { value: '3000' },
    })
    fireEvent.change(screen.getByLabelText('Puerto fin'), {
      target: { value: '3099' },
    })
    fireEvent.change(screen.getByLabelText('Aplicaciones'), {
      target: { value: 'web-browsing' },
    })
    fireEvent.change(screen.getByLabelText('URLs / rutas'), {
      target: { value: 'https://example.test/a' },
    })
    fireEvent.change(screen.getByLabelText('Detalle'), {
      target: { value: 'Rango' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear acceso' }))

    await waitFor(() => {
      expect(createAccessMock).toHaveBeenCalledWith({
        address: '*.smartbear.com',
        port: 3000,
        portEnd: 3099,
        environment: 'production',
        protocol: null,
        detail: 'Rango',
        applications: 'web-browsing',
        urls: 'https://example.test/a',
      })
    })
  })

  it('rechaza un puerto final menor que el inicial', async () => {
    requestAccessesMock.mockResolvedValue([])

    renderPage()

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Nuevo acceso' }))[0]!,
    )
    fireEvent.change(await screen.findByLabelText('Dirección'), {
      target: { value: '10.0.0.1' },
    })
    fireEvent.change(screen.getByLabelText('Puerto inicio'), {
      target: { value: '4000' },
    })
    fireEvent.change(screen.getByLabelText('Puerto fin'), {
      target: { value: '3999' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear acceso' }))

    expect(
      await screen.findByText(
        'El puerto final no puede ser menor que el inicial.',
      ),
    ).toBeInTheDocument()
    expect(createAccessMock).not.toHaveBeenCalled()
  })

  it('permite crear, editar, desactivar/reactivar e historial cuando se tiene accesos.gestionar', async () => {
    requestAccessesMock.mockResolvedValue(sampleAccesses)

    renderPage()

    expect(await screen.findByRole('button', { name: 'Nuevo acceso' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /editar/i })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /historial/i })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /desactivar/i })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: /reactivar/i })).toHaveLength(1)
  })

  it('solo muestra listado y detalle cuando el usuario no tiene accesos.gestionar', async () => {
    currentPermissions = ['accesos.ver']
    requestAccessesMock.mockResolvedValue(sampleAccesses)

    renderPage()

    expect(await screen.findByText('10.20.10.15')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo acceso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /historial/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /desactivar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reactivar/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /detalle de/i })).toHaveLength(3)
  })

  it('busca llamando a la API con debouncing', async () => {
    requestAccessesMock.mockResolvedValue(sampleAccesses)

    renderPage()

    await screen.findByText('10.20.10.15')

    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: 'pagos' },
    })

    await waitFor(
      () => {
        expect(requestAccessesMock).toHaveBeenLastCalledWith({
          search: 'pagos',
          environment: 'all',
          status: 'all',
          protocol: 'all',
        })
      },
      { timeout: 1500 },
    )
  })

  it('filtra por ambiente llamando a la API', async () => {
    requestAccessesMock.mockResolvedValue(sampleAccesses)

    renderPage()

    await screen.findByText('10.20.10.15')

    const envTrigger = screen.getByTestId('access-filter-environment')
    fireEvent.click(envTrigger)

    const qaOption = await screen.findByRole('option', { name: 'QA' })
    fireEvent.pointerDown(qaOption)
    fireEvent.pointerUp(qaOption)
    fireEvent.click(qaOption)

    await waitFor(() => {
      expect(requestAccessesMock).toHaveBeenLastCalledWith({
        search: '',
        environment: 'qa',
        status: 'all',
        protocol: 'all',
      })
    })
  })

  it('filtra por estado llamando a la API', async () => {
    requestAccessesMock.mockResolvedValue(sampleAccesses)

    renderPage()

    await screen.findByText('10.20.10.15')

    const statusTrigger = screen.getByTestId('access-filter-status')
    fireEvent.click(statusTrigger)

    const activeOption = await screen.findByRole('option', { name: 'Activos' })
    fireEvent.pointerDown(activeOption)
    fireEvent.pointerUp(activeOption)
    fireEvent.click(activeOption)

    await waitFor(() => {
      expect(requestAccessesMock).toHaveBeenLastCalledWith({
        search: '',
        environment: 'all',
        status: 'active',
        protocol: 'all',
      })
    })
  })

  it('filtra por protocolo llamando a la API', async () => {
    requestAccessesMock.mockResolvedValue(sampleAccesses)

    renderPage()

    await screen.findByText('10.20.10.15')

    const protoTrigger = screen.getByTestId('access-filter-protocol')
    fireEvent.click(protoTrigger)

    const tcpOption = await screen.findByRole('option', { name: 'TCP' })
    fireEvent.pointerDown(tcpOption)
    fireEvent.pointerUp(tcpOption)
    fireEvent.click(tcpOption)

    await waitFor(() => {
      expect(requestAccessesMock).toHaveBeenLastCalledWith({
        search: '',
        environment: 'all',
        status: 'all',
        protocol: 'tcp',
      })
    })
  })

  it('limpia los filtros al hacer clic en Limpiar filtros', async () => {
    requestAccessesMock.mockResolvedValue([])

    renderPage()

    await screen.findByText('Catálogo vacío')

    fireEvent.change(screen.getByLabelText(/buscar/i), {
      target: { value: 'test' },
    })

    expect(await screen.findByText('Sin resultados')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    await waitFor(() => {
      expect(requestAccessesMock).toHaveBeenLastCalledWith({
        search: '',
        environment: 'all',
        status: 'all',
        protocol: 'all',
      })
    })
  })

  it('crea un acceso desde el diálogo', async () => {
    requestAccessesMock.mockResolvedValue([])
    createAccessMock.mockResolvedValue({
      id: 4,
      address: '192.168.1.1',
      port: 80,
      portEnd: 80,
      environment: 'production',
      protocol: null,
      applications: null,
      urls: null,
      detail: 'Router gateway',
      isActive: true,
      version: 1,
      createdAt: '2026-10-19T00:00:00.000Z',
      updatedAt: '2026-10-19T00:00:00.000Z',
    })

    renderPage()

    fireEvent.click((await screen.findAllByRole('button', { name: 'Nuevo acceso' }))[0]!)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nuevo acceso' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Dirección'), {
      target: { value: '192.168.1.1' },
    })
    fireEvent.change(screen.getByLabelText('Puerto inicio'), {
      target: { value: '80' },
    })
    fireEvent.change(screen.getByLabelText('Detalle'), {
      target: { value: 'Router gateway' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Crear acceso' }))

    await waitFor(() => {
      expect(createAccessMock).toHaveBeenCalledWith({
        address: '192.168.1.1',
        port: 80,
        portEnd: 80,
        environment: 'production',
        protocol: null,
        applications: null,
        urls: null,
        detail: 'Router gateway',
      })
    })
    await waitFor(() => {
      expect(requestAccessesMock).toHaveBeenCalledTimes(2)
    })
  })

  it('edita un acceso con su versión', async () => {
    const access = sampleAccesses[0]!
    requestAccessesMock.mockResolvedValue([access])
    updateAccessMock.mockResolvedValue({
      ...access,
      detail: 'API pagos v2',
      version: 2,
    })

    renderPage()

    await screen.findByText('10.20.10.15')

    fireEvent.click(screen.getByRole('button', { name: `Editar acceso ${access.address}:${access.port}` }))

    expect(await screen.findByRole('heading', { name: 'Editar acceso' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Detalle'), {
      target: { value: 'API pagos v2' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateAccessMock).toHaveBeenCalledWith(access.id, {
        address: access.address,
        port: access.port,
        portEnd: access.portEnd,
        environment: access.environment,
        protocol: access.protocol,
        applications: null,
        urls: null,
        detail: 'API pagos v2',
        version: access.version,
      })
    })
    await waitFor(() => {
      expect(requestAccessesMock).toHaveBeenCalledTimes(2)
    })
  })

  it('desactiva un acceso con confirmación y versión', async () => {
    const access = sampleAccesses[0]!
    requestAccessesMock.mockResolvedValue([access])
    updateAccessMock.mockResolvedValue({
      ...access,
      isActive: false,
      version: 2,
    })

    renderPage()

    await screen.findByText('10.20.10.15')

    fireEvent.click(screen.getByRole('button', { name: `Desactivar acceso ${access.address}:${access.port}` }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Desactivar acceso' })).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }))

    await waitFor(() => {
      expect(updateAccessMock).toHaveBeenCalledWith(access.id, {
        isActive: false,
        version: access.version,
      })
    })
    await waitFor(() => {
      expect(requestAccessesMock).toHaveBeenCalledTimes(2)
    })
  })

  it('reactiva un acceso con confirmación y versión', async () => {
    const access = sampleAccesses[1]!
    requestAccessesMock.mockResolvedValue([access])
    updateAccessMock.mockResolvedValue({
      ...access,
      isActive: true,
      version: 3,
    })

    renderPage()

    await screen.findByText('qa-service.local')

    fireEvent.click(screen.getByRole('button', { name: `Reactivar acceso ${access.address}:${access.port}` }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Reactivar acceso' })).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivar' }))

    await waitFor(() => {
      expect(updateAccessMock).toHaveBeenCalledWith(access.id, {
        isActive: true,
        version: access.version,
      })
    })
    await waitFor(() => {
      expect(requestAccessesMock).toHaveBeenCalledTimes(2)
    })
  })

  it('muestra el detalle completo en diálogo y permite cerrarlo', async () => {
    const access = sampleAccesses[0]!
    requestAccessesMock.mockResolvedValue([access])

    renderPage()

    await screen.findByText('10.20.10.15')

    fireEvent.click(screen.getByRole('button', { name: `Ver detalle de ${access.address}:${access.port}` }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Detalle del acceso' })).toBeInTheDocument()
    expect(within(dialog).getByText('Acceso #1 del catálogo de firewall.')).toBeInTheDocument()
    expect(within(dialog).getByText('10.20.10.15')).toBeInTheDocument()
    expect(within(dialog).getByText('443')).toBeInTheDocument()
    expect(within(dialog).getByText('Producción')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('muestra el historial en diálogo solo para quien gestiona', async () => {
    const access = sampleAccesses[0]!
    requestAccessesMock.mockResolvedValue([access])
    requestHistoryMock.mockResolvedValue([
      {
        occurredAt: '2026-10-15T10:00:00.000Z',
        actorUsername: 'admin',
        channel: 'app',
        action: 'access.created',
        before: null,
        after: {
          address: '10.20.10.15',
          port: 443,
          portEnd: 443,
          environment: 'production',
          protocol: 'tcp',
          applications: null,
          urls: null,
          detail: 'API de pagos',
          isActive: true,
        },
      },
    ])

    renderPage()

    await screen.findByText('10.20.10.15')

    fireEvent.click(screen.getByRole('button', { name: `Ver historial de ${access.address}:${access.port}` }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Historial del acceso' })).toBeInTheDocument()
    expect(await within(dialog).findByText('Alta')).toBeInTheDocument()
    expect(within(dialog).getByText('admin')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('muestra el estado vacío cuando el catálogo está vacío', async () => {
    requestAccessesMock.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Catálogo vacío')).toBeInTheDocument()
    expect(
      screen.getByText('Todavía no hay accesos registrados en el catálogo.'),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: 'Nuevo acceso' }).length,
    ).toBeGreaterThan(0)
  })

  it('muestra el estado vacío sin botón de alta para quien solo tiene accesos.ver', async () => {
    currentPermissions = ['accesos.ver']
    requestAccessesMock.mockResolvedValue([])

    renderPage()

    expect(await screen.findByText('Catálogo vacío')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nuevo acceso' })).not.toBeInTheDocument()
  })

  it('muestra error del servidor y permite reintentar', async () => {
    requestAccessesMock.mockRejectedValueOnce(
      new Error('No se pudo conectar con el servidor.'),
    )
    requestAccessesMock.mockResolvedValueOnce([])

    renderPage()

    expect(
      await screen.findByText('No se pudo cargar el catálogo de accesos'),
    ).toBeInTheDocument()
    expect(screen.getByText('No se pudo conectar con el servidor.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Catálogo vacío')).toBeInTheDocument()
  })
})
