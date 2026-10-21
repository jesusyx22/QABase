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
import { ProxiesPage } from './ProxiesPage'
import {
  requestProxies,
  requestProxyLogs,
  requestRestartProxy,
  requestStartProxy,
  requestStopProxy,
  requestUpdateProxyAllowlist,
  updateProxySettings,
  type ProxyListResponse,
  type ProxyServiceView,
} from '@/features/proxies/api'

vi.mock('@/features/proxies/api', () => ({
  requestProxies: vi.fn(),
  updateProxySettings: vi.fn(),
  requestUpdateProxyAllowlist: vi.fn(),
  requestStartProxy: vi.fn(),
  requestStopProxy: vi.fn(),
  requestRestartProxy: vi.fn(),
  requestProxyLogs: vi.fn(),
}))

let currentPermissions: string[] = [
  'proxies.ver',
  'proxies.operar',
  'proxies.gestionar',
]

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

const requestProxiesMock = vi.mocked(requestProxies)
const updateProxySettingsMock = vi.mocked(updateProxySettings)
const requestUpdateProxyAllowlistMock = vi.mocked(requestUpdateProxyAllowlist)
const requestStartProxyMock = vi.mocked(requestStartProxy)
const requestStopProxyMock = vi.mocked(requestStopProxy)
const requestRestartProxyMock = vi.mocked(requestRestartProxy)
const requestProxyLogsMock = vi.mocked(requestProxyLogs)

const sampleService1: ProxyServiceView = {
  id: 1,
  slug: 'sentinel',
  name: 'Proxy Sentinel',
  environment: 'qa',
  protocol: 'http',
  allowlist: [],
  healthPath: '/bridge-health',
  isActive: true,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
  ports: [
    { port: 3500, isPrimary: true, listening: true },
  ],
  routes: [
    {
      id: 10,
      path: '/realms',
      target: 'http://10.5.81.60:8080',
      detail: 'Keycloak Auth',
      access: {
        id: 1,
        address: '10.5.81.60',
        port: 8080,
        portEnd: 8080,
        environment: 'qa',
        detail: 'Servidor Keycloak UAT',
        isActive: true,
      },
    },
    {
      id: 11,
      path: '/customer-credit-rating-s',
      target: 'http://apps-test.losandes.pe',
      detail: null,
      access: null, // Sin acceso en el catálogo
    },
  ],
  runtime: {
    status: 'active',
    pid: 25940,
    managed: true,
    health: 'up',
    detail: null,
    startedAt: '2026-10-20T10:00:00.000Z',
  },
}

const sampleService2: ProxyServiceView = {
  id: 2,
  slug: 'gitlab',
  name: 'GitLab Proxy',
  environment: 'development',
  protocol: 'http',
  allowlist: [],
  healthPath: null,
  isActive: false, // Inactivo!
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
  ports: [
    { port: 8081, isPrimary: true, listening: false },
  ],
  routes: [
    {
      id: 20,
      path: '/',
      target: 'http://10.5.5.201:80',
      detail: 'GitLab CE',
      access: null,
    },
  ],
  runtime: {
    status: 'stopped',
    pid: null,
    managed: true,
    health: 'skipped',
    detail: 'Detenido manualmente',
    startedAt: null,
  },
}

const sampleService3: ProxyServiceView = {
  id: 3,
  slug: 'mantis',
  name: 'Mantis BT',
  environment: 'production',
  protocol: 'http',
  allowlist: [],
  healthPath: null,
  isActive: true,
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
  ports: [
    { port: 80, isPrimary: true, listening: true },
    { port: 8080, isPrimary: false, listening: true },
  ],
  routes: [
    {
      id: 30,
      path: '/',
      target: 'http://10.20.22.50:80',
      detail: 'Mantis Bug Tracker',
      access: {
        id: 3,
        address: '10.20.22.50',
        port: 80,
        portEnd: 80,
        environment: 'production',
        detail: 'Servidor Mantis',
        isActive: false, // Inactivo!
      },
    },
  ],
  runtime: {
    status: 'conflict',
    pid: 27780,
    managed: false, // Externo!
    health: 'down',
    detail: 'Puerto 80 ocupado por un proceso no esperado',
    startedAt: '2026-10-20T08:00:00.000Z',
  },
}

const sampleServiceMongo: ProxyServiceView = {
  id: 4,
  slug: 'mongodb-qa',
  name: 'MongoDB QA',
  environment: 'qa',
  protocol: 'tcp',
  allowlist: [
    { cidr: '10.4.24.0/24', label: 'Admin' },
    { cidr: '192.168.1.50', label: 'Desarrollador' },
  ],
  healthPath: null,
  isActive: true,
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
  ports: [{ port: 27017, isPrimary: true, listening: true }],
  routes: [
    {
      id: 40,
      path: '/',
      target: 'tcp://10.5.83.84:27017',
      detail: 'Base de datos MongoDB QA',
      access: null,
    },
  ],
  runtime: {
    status: 'active',
    pid: 30120,
    managed: true,
    health: 'skipped',
    detail: null,
    startedAt: '2026-10-20T09:00:00.000Z',
  },
}

const sampleServiceTcpEmpty: ProxyServiceView = {
  id: 5,
  slug: 'tcp-empty',
  name: 'TCP Sin Allowlist',
  environment: 'development',
  protocol: 'tcp',
  allowlist: [],
  healthPath: null,
  isActive: true,
  createdAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T00:00:00.000Z',
  ports: [{ port: 5432, isPrimary: true, listening: false }],
  routes: [
    {
      id: 50,
      path: '/',
      target: 'tcp://10.5.99.1:5432',
      detail: null,
      access: null,
    },
  ],
  runtime: {
    status: 'stopped',
    pid: null,
    managed: true,
    health: 'skipped',
    detail: null,
    startedAt: null,
  },
}

const sampleResponse: ProxyListResponse = {
  settings: {
    host: '10.4.24.18',
    version: 1,
  },
  services: [
    sampleService1,
    sampleService2,
    sampleService3,
    sampleServiceMongo,
    sampleServiceTcpEmpty,
  ],
}

let writeTextMock = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  vi.resetAllMocks()
  currentPermissions = ['proxies.ver', 'proxies.operar', 'proxies.gestionar']
  requestProxiesMock.mockResolvedValue(sampleResponse)
  requestProxyLogsMock.mockResolvedValue({
    lines: [
      '[10:00:00] Server started on port 3500',
      '[10:01:05] GET /bridge-health 200 - 2 ms',
      '[10:05:12] Forwarding /realms to http://10.5.81.60:8080',
    ],
  })
  writeTextMock = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    writable: true,
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ProxiesPage />
    </MemoryRouter>,
  )
}

describe('ProxiesPage', () => {
  it('muestra la IP global y el listado de servicios con nombre, endpoints, rutas, ambiente y estado', async () => {
    renderPage()

    expect(await screen.findByText('Proxies')).toBeInTheDocument()
    expect(
      screen.getByText('Catálogo y control de servicios de proxy operables.'),
    ).toBeInTheDocument()

    // Tarjeta IP global
    expect(screen.getByText('10.4.24.18')).toBeInTheDocument()

    // Fila 1: Proxy Sentinel
    expect(screen.getByText('Proxy Sentinel')).toBeInTheDocument()
    expect(screen.getByText('sentinel')).toBeInTheDocument()
    expect(screen.getByText('10.4.24.18:3500')).toBeInTheDocument()
    expect(screen.getByText('/realms')).toBeInTheDocument()
    expect(screen.getByText('http://10.5.81.60:8080')).toBeInTheDocument()
    expect(screen.getByText(/Servidor Keycloak UAT/)).toBeInTheDocument()
    expect(screen.getAllByText('Sin acceso en el catálogo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Activo').length).toBeGreaterThan(0)

    // Fila 2: GitLab Proxy
    expect(screen.getByText('GitLab Proxy')).toBeInTheDocument()
    expect(screen.getByText('10.4.24.18:8081')).toBeInTheDocument()
    expect(screen.getAllByText('Detenido').length).toBeGreaterThan(0)

    // Fila 3: Mantis BT con 2 puertos y acceso inactivo
    expect(screen.getByText('Mantis BT')).toBeInTheDocument()
    expect(screen.getByText('10.4.24.18:80')).toBeInTheDocument()
    expect(screen.getByText('10.4.24.18:8080')).toBeInTheDocument()
    expect(screen.getByText('Acceso inactivo')).toBeInTheDocument()
    expect(screen.getByText('Conflicto')).toBeInTheDocument()
  })

  it('muestra distintivos TCP y HTTP visibles en el listado junto a cada servicio', async () => {
    renderPage()

    await screen.findByText('Proxy Sentinel')

    // HTTP badges
    expect(screen.getAllByText('HTTP').length).toBeGreaterThanOrEqual(3)

    // TCP badges
    expect(screen.getAllByText('TCP').length).toBeGreaterThanOrEqual(2)
  })

  it('para servicios MongoDB TCP ofrece un botón para copiar la URI mongodb://IP:puerto', async () => {
    renderPage()

    await screen.findByText('MongoDB QA')

    const mongoBtn = screen.getByRole('button', {
      name: 'Copiar URI mongodb://10.4.24.18:27017',
    })
    expect(mongoBtn).toBeInTheDocument()

    fireEvent.click(mongoBtn)
    expect(writeTextMock).toHaveBeenCalledWith('mongodb://10.4.24.18:27017')
  })

  it('los badges Inactivo y Acceso inactivo usan estilo neutro/gris (DESIGN.md)', async () => {
    renderPage()

    await screen.findByText('GitLab Proxy')

    // Servicio inactivo
    const serviceInactiveBadge = screen.getByText('Inactivo')
    expect(serviceInactiveBadge.className).toContain('text-muted-foreground')
    expect(serviceInactiveBadge.className).not.toContain('text-warning')

    // Acceso inactivo
    const accessInactiveBadge = screen.getByText('Acceso inactivo')
    expect(accessInactiveBadge.className).toContain('text-muted-foreground')
    expect(accessInactiveBadge.className).not.toContain('text-warning')
  })

  it('copia el endpoint al portapapeles con feedback accesible', async () => {
    renderPage()

    await screen.findByText('Proxy Sentinel')

    const copyBtn = screen.getByRole('button', {
      name: 'Copiar endpoint 10.4.24.18:3500',
    })
    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('10.4.24.18:3500')
  })

  it('copia la IP global al portapapeles', async () => {
    renderPage()

    await screen.findByText('10.4.24.18')

    const copyIpBtn = screen.getByRole('button', {
      name: 'Copiar IP global 10.4.24.18',
    })
    fireEvent.click(copyIpBtn)

    expect(writeTextMock).toHaveBeenCalledWith('10.4.24.18')
  })

  it('muestra aviso cuando el portapapeles falla', async () => {
    writeTextMock.mockRejectedValueOnce(new Error('Bloqueado.'))

    renderPage()

    await screen.findByText('Proxy Sentinel')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Copiar endpoint 10.4.24.18:3500',
      }),
    )

    expect(await screen.findByText('No se pudo copiar')).toBeInTheDocument()
  })

  it('filtra servicios por búsqueda en nombre, slug, puertos y rutas', async () => {
    renderPage()

    await screen.findByText('Proxy Sentinel')

    const searchInput = screen.getByPlaceholderText(
      /buscar por nombre, ruta, destino o puerto/i,
    )
    fireEvent.change(searchInput, { target: { value: '8081' } })

    expect(screen.queryByText('Proxy Sentinel')).not.toBeInTheDocument()
    expect(screen.getByText('GitLab Proxy')).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: 'keycloak' } })

    expect(screen.getByText('Proxy Sentinel')).toBeInTheDocument()
    expect(screen.queryByText('GitLab Proxy')).not.toBeInTheDocument()
  })

  it('filtra servicios por ambiente y por estado', async () => {
    renderPage()

    await screen.findByText('Proxy Sentinel')

    // Filtro ambiente: Desarrollo
    const envTrigger = screen.getByTestId('proxy-filter-environment')
    fireEvent.click(envTrigger)

    const devOption = await screen.findByRole('option', { name: 'Desarrollo' })
    fireEvent.pointerDown(devOption)
    fireEvent.pointerUp(devOption)
    fireEvent.click(devOption)

    await waitFor(() => {
      expect(screen.queryByText('Proxy Sentinel')).not.toBeInTheDocument()
      expect(screen.getByText('GitLab Proxy')).toBeInTheDocument()
    })

    // Filtro estado: Activo
    const statusTrigger = screen.getByTestId('proxy-filter-status')
    fireEvent.click(statusTrigger)

    const activeOption = await screen.findByRole('option', { name: 'Activo' })
    fireEvent.pointerDown(activeOption)
    fireEvent.pointerUp(activeOption)
    fireEvent.click(activeOption)

    // En desarrollo solo tenemos GitLab y tcp-empty (ambos stopped), por lo que Activo da 0 resultados
    await waitFor(() => {
      expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    await waitFor(() => {
      expect(screen.getByText('Proxy Sentinel')).toBeInTheDocument()
    })
  })

  it('muestra estado vacío cuando no hay servicios en el catálogo', async () => {
    requestProxiesMock.mockResolvedValue({
      settings: { host: '10.4.24.18', version: 1 },
      services: [],
    })

    renderPage()

    expect(await screen.findByText('Sin servicios de proxy')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Todavía no hay servicios de proxy registrados en el catálogo.',
      ),
    ).toBeInTheDocument()
  })

  it('muestra error del servidor y permite reintentar', async () => {
    requestProxiesMock.mockRejectedValueOnce(new Error('Fallo de conexión.'))
    requestProxiesMock.mockResolvedValueOnce(sampleResponse)

    renderPage()

    expect(
      await screen.findByText('No se pudieron cargar los servicios'),
    ).toBeInTheDocument()
    expect(screen.getByText('Fallo de conexión.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Proxy Sentinel')).toBeInTheDocument()
  })

  it('permite actualizar manualmente los servicios con el botón Actualizar', async () => {
    renderPage()

    await screen.findByText('Proxy Sentinel')

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar servicios' }))

    await waitFor(() => {
      expect(requestProxiesMock).toHaveBeenCalledTimes(2)
    })
  })

  it('inicia un servicio detenido llamando a requestStartProxy', async () => {
    requestStartProxyMock.mockResolvedValue({
      ...sampleService2,
      runtime: {
        ...sampleService2.runtime,
        status: 'active',
        pid: 12345,
      },
    })

    renderPage()

    await screen.findByText('GitLab Proxy')

    const startBtn = screen.getByRole('button', {
      name: 'Iniciar servicio GitLab Proxy',
    })
    fireEvent.click(startBtn)

    await waitFor(() => {
      expect(requestStartProxyMock).toHaveBeenCalledWith(2)
    })
  })

  it('detiene un servicio activo gestionado con diálogo de confirmación', async () => {
    requestStopProxyMock.mockResolvedValue({
      ...sampleService1,
      runtime: {
        ...sampleService1.runtime,
        status: 'stopped',
        pid: null,
      },
    })

    renderPage()

    await screen.findByText('Proxy Sentinel')

    const stopBtn = screen.getByRole('button', {
      name: 'Detener servicio Proxy Sentinel',
    })
    fireEvent.click(stopBtn)

    // Diálogo de confirmación
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: 'Detener proxy' }),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/¿estás seguro de que deseas detener el servicio "proxy sentinel"\?/i),
    ).toBeInTheDocument()

    // Confirmar
    fireEvent.click(within(dialog).getByRole('button', { name: 'Detener' }))

    await waitFor(() => {
      expect(requestStopProxyMock).toHaveBeenCalledWith(1, false)
    })
  })

  it('reinicia un servicio activo con confirmación', async () => {
    requestRestartProxyMock.mockResolvedValue(sampleService1)

    renderPage()

    await screen.findByText('Proxy Sentinel')

    const restartBtn = screen.getByRole('button', {
      name: 'Reiniciar servicio Proxy Sentinel',
    })
    fireEvent.click(restartBtn)

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: 'Reiniciar proxy' }),
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reiniciar' }))

    await waitFor(() => {
      expect(requestRestartProxyMock).toHaveBeenCalledWith(1, false)
    })
  })

  it('en servicios HTTP NO muestra la sección de allowlist en el diálogo de detalle', async () => {
    renderPage()

    await screen.findByText('Proxy Sentinel')

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalle de Proxy Sentinel' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText(/IPs autorizadas/i)).not.toBeInTheDocument()
  })

  it('en servicios TCP muestra la sección IPs autorizadas con las direcciones configuradas', async () => {
    renderPage()

    await screen.findByText('MongoDB QA')

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalle de MongoDB QA' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/IPs autorizadas \(2\)/i)).toBeInTheDocument()
    expect(within(dialog).getByText('Admin — 10.4.24.0/24')).toBeInTheDocument()
    expect(within(dialog).getByText('Desarrollador — 192.168.1.50')).toBeInTheDocument()
  })

  it('en servicios TCP con allowlist vacía muestra el aviso sin IPs autorizadas', async () => {
    renderPage()

    await screen.findByText('TCP Sin Allowlist')

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalle de TCP Sin Allowlist' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(
        'Sin IPs autorizadas: no se aceptarán conexiones',
      ),
    ).toBeInTheDocument()
  })

  it('permite a Administrador editar la allowlist por filas y llama a requestUpdateProxyAllowlist', async () => {
    const updatedMongo: ProxyServiceView = {
      ...sampleServiceMongo,
      allowlist: [
        { cidr: '10.4.24.0/24', label: 'Admin' },
        { cidr: '10.0.0.1', label: 'Admin' },
      ],
    }
    requestUpdateProxyAllowlistMock.mockResolvedValue(updatedMongo)

    renderPage()

    await screen.findByText('MongoDB QA')

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalle de MongoDB QA' }),
    )

    const detailDialog = await screen.findByRole('dialog')

    // Botón de edición de allowlist
    const editBtn = within(detailDialog).getByRole('button', {
      name: 'Editar allowlist',
    })
    fireEvent.click(editBtn)

    // Diálogo de allowlist
    const allowlistDialog = await screen.findByRole('heading', {
      name: 'Editar IPs autorizadas',
    })
    expect(allowlistDialog).toBeInTheDocument()

    // Filas iniciales
    const cidrInput1 = screen.getByLabelText('IP o CIDR 1') as HTMLInputElement
    const labelInput1 = screen.getByLabelText('Nombre 1') as HTMLInputElement
    const cidrInput2 = screen.getByLabelText('IP o CIDR 2') as HTMLInputElement
    const labelInput2 = screen.getByLabelText('Nombre 2') as HTMLInputElement

    expect(cidrInput1.value).toBe('10.4.24.0/24')
    expect(labelInput1.value).toBe('Admin')
    expect(cidrInput2.value).toBe('192.168.1.50')
    expect(labelInput2.value).toBe('Desarrollador')

    // Si no hay cambios, el botón Guardar debe estar deshabilitado
    const saveBtn = screen.getByRole('button', { name: 'Guardar allowlist' })
    expect(saveBtn).toBeDisabled()

    // Agregar nueva IP
    const addBtn = screen.getByRole('button', { name: 'Agregar IP' })
    fireEvent.click(addBtn)

    // Se agrega fila 3 con CIDR y nombre vacíos
    const cidrInput3 = screen.getByLabelText('IP o CIDR 3') as HTMLInputElement
    const labelInput3 = screen.getByLabelText('Nombre 3') as HTMLInputElement
    expect(cidrInput3.value).toBe('')
    expect(labelInput3.value).toBe('')

    // Con cambios pendientes, el botón Guardar se habilita
    expect(saveBtn).not.toBeDisabled()

    // Si se intenta guardar con CIDR vacío, la validación cliente lo impide
    fireEvent.click(saveBtn)
    expect(
      await screen.findByText(/la dirección ip o cidr no puede estar vacía/i),
    ).toBeInTheDocument()

    // Llenar CIDR y nombre en la fila 3
    fireEvent.change(cidrInput3, { target: { value: '10.0.0.1' } })
    fireEvent.change(labelInput3, { target: { value: 'Nuevo' } })

    // Quitar la fila 2 (Desarrollador)
    const removeBtn2 = screen.getByRole('button', { name: 'Quitar entrada 2' })
    fireEvent.click(removeBtn2)

    // Guardar
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(requestUpdateProxyAllowlistMock).toHaveBeenCalledWith(4, [
        { cidr: '10.4.24.0/24', label: 'Admin' },
        { cidr: '10.0.0.1', label: 'Nuevo' },
      ])
    })
  })

  it('permite vaciar la allowlist, muestra el aviso y guarda lista vacía [] en el API', async () => {
    const clearedMongo: ProxyServiceView = {
      ...sampleServiceMongo,
      allowlist: [],
    }
    requestUpdateProxyAllowlistMock.mockResolvedValue(clearedMongo)

    renderPage()

    await screen.findByText('MongoDB QA')

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalle de MongoDB QA' }),
    )

    const detailDialog = await screen.findByRole('dialog')
    fireEvent.click(
      within(detailDialog).getByRole('button', { name: 'Editar allowlist' }),
    )

    await screen.findByRole('heading', { name: 'Editar IPs autorizadas' })

    // Quitar ambas entradas
    fireEvent.click(screen.getByRole('button', { name: 'Quitar entrada 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Quitar entrada 1' }))

    // Muestra aviso de lista vacía
    expect(
      screen.getByText('Sin IPs autorizadas: no se aceptarán conexiones'),
    ).toBeInTheDocument()

    // Permite guardar lista vacía
    const saveBtn = screen.getByRole('button', { name: 'Guardar allowlist' })
    expect(saveBtn).not.toBeDisabled()

    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(requestUpdateProxyAllowlistMock).toHaveBeenCalledWith(4, [])
    })
  })

  it('valida en el cliente que no existan CIDRs duplicados ni nombres vacíos en la allowlist', async () => {
    renderPage()
    await screen.findByText('MongoDB QA')

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalle de MongoDB QA' }),
    )
    const detailDialog = await screen.findByRole('dialog')
    fireEvent.click(
      within(detailDialog).getByRole('button', { name: 'Editar allowlist' }),
    )

    await screen.findByRole('heading', { name: 'Editar IPs autorizadas' })

    // Poner mismo CIDR que fila 1 en fila 2
    const cidrInput2 = screen.getByLabelText('IP o CIDR 2')
    fireEvent.change(cidrInput2, { target: { value: '10.4.24.0/24' } })

    const saveBtn = screen.getByRole('button', { name: 'Guardar allowlist' })
    fireEvent.click(saveBtn)

    expect(
      await screen.findByText(/está duplicada en la allowlist/i),
    ).toBeInTheDocument()
    expect(requestUpdateProxyAllowlistMock).not.toHaveBeenCalled()
  })

  it('numera las filas visibles con # de 1 a N y se reinicia dinámicamente al filtrar', async () => {
    renderPage()

    await screen.findByText('Proxy Sentinel')

    // Verificar encabezado #
    expect(screen.getByRole('columnheader', { name: '#' })).toBeInTheDocument()

    // Comprobar filas iniciales (5 servicios en sampleResponse)
    const table = screen.getByRole('table', {
      name: /catálogo de servicios de proxy/i,
    })
    const rows = within(table).getAllByRole('row')
    // row 0 es el encabezado, rows 1..5 son los servicios
    expect(rows).toHaveLength(6)
    expect(within(rows[1]!).getByText('1')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('2')).toBeInTheDocument()
    expect(within(rows[3]!).getByText('3')).toBeInTheDocument()
    expect(within(rows[4]!).getByText('4')).toBeInTheDocument()
    expect(within(rows[5]!).getByText('5')).toBeInTheDocument()

    // Filtrar por búsqueda 'MongoDB'
    const searchInput = screen.getByLabelText(/buscar proxies/i)
    fireEvent.change(searchInput, { target: { value: 'MongoDB' } })

    const filteredRows = within(table).getAllByRole('row')
    expect(filteredRows).toHaveLength(2) // header + 1 servicio
    expect(within(filteredRows[1]!).getByText('1')).toBeInTheDocument()
    expect(within(filteredRows[1]!).getByText('MongoDB QA')).toBeInTheDocument()

    // Limpiar búsqueda
    fireEvent.change(searchInput, { target: { value: '' } })
    expect(within(table).getAllByRole('row')).toHaveLength(6)
  })

  it('los botones Detener y Reiniciar tienen el mismo ancho fijo w-28, estilo outline tintado y colores semánticos', async () => {
    renderPage()

    await screen.findByText('Proxy Sentinel')

    const stopBtn = screen.getByRole('button', {
      name: 'Detener servicio Proxy Sentinel',
    })
    const restartBtn = screen.getByRole('button', {
      name: 'Reiniciar servicio Proxy Sentinel',
    })

    // Ambos botones tienen el mismo ancho fijo w-28
    expect(stopBtn.className).toContain('w-28')
    expect(restartBtn.className).toContain('w-28')

    // Detener usa rojo --danger y outline tintado
    expect(stopBtn.className).toContain('text-danger')
    expect(stopBtn.className).toContain('border-danger/40')
    expect(stopBtn.className).toContain('bg-danger/10')

    // Reiniciar usa azul primario y outline tintado
    expect(restartBtn.className).toContain('text-primary')
    expect(restartBtn.className).toContain('border-primary/40')
    expect(restartBtn.className).toContain('bg-primary/10')
  })

  it('oculta el botón Editar allowlist para usuarios sin permiso proxies.gestionar', async () => {
    currentPermissions = ['proxies.ver', 'proxies.operar']

    renderPage()

    await screen.findByText('MongoDB QA')

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalle de MongoDB QA' }),
    )

    const dialog = await screen.findByRole('dialog')

    // Sí ve la allowlist
    expect(within(dialog).getByText(/IPs autorizadas \(2\)/i)).toBeInTheDocument()

    // NO ve el botón de editar
    expect(
      within(dialog).queryByRole('button', { name: 'Editar allowlist' }),
    ).not.toBeInTheDocument()
  })

  it('actualiza el diálogo de detalle automáticamente si el servicio cambia mientras está abierto', async () => {
    renderPage()

    await screen.findByText('Proxy Sentinel')

    // Abrir detalle
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalle de Proxy Sentinel' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('25940')).toBeInTheDocument()
    expect(within(dialog).getByText('Saludable (UP)')).toBeInTheDocument()

    // Simular que el reload recibe cambio de estado en Proxy Sentinel
    const updatedService1: ProxyServiceView = {
      ...sampleService1,
      runtime: {
        status: 'error',
        pid: null,
        managed: true,
        health: 'down',
        detail: 'Proceso detenido inesperadamente',
        startedAt: null,
      },
    }

    requestProxiesMock.mockResolvedValueOnce({
      ...sampleResponse,
      services: [
        updatedService1,
        sampleService2,
        sampleService3,
        sampleServiceMongo,
        sampleServiceTcpEmpty,
      ],
    })

    // Disparar refresh
    fireEvent.click(
      screen.getByRole('button', { name: 'Actualizar servicios', hidden: true }),
    )

    // El diálogo que continúa abierto debe reflejar el nuevo estado derivado
    await waitFor(() => {
      expect(within(dialog).getByText('Sin respuesta (DOWN)')).toBeInTheDocument()
      expect(within(dialog).getByText('Proceso detenido inesperadamente')).toBeInTheDocument()
    })
  })

  it('gestiona el rechazo de requestProxyLogs y permite reintentar sin bloquear', async () => {
    requestProxyLogsMock.mockRejectedValueOnce(
      new Error('No se pudo leer el archivo de log.'),
    )
    requestProxyLogsMock.mockResolvedValueOnce({
      lines: ['[10:10:00] Log recuperado tras reintento'],
    })

    renderPage()

    await screen.findByText('Proxy Sentinel')

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalle de Proxy Sentinel' }),
    )

    const dialog = await screen.findByRole('dialog')

    expect(
      await within(dialog).findByText('No se pudo leer el archivo de log.'),
    ).toBeInTheDocument()

    const retryBtn = within(dialog).getByRole('button', { name: 'Reintentar' })
    expect(retryBtn).not.toBeDisabled()

    fireEvent.click(retryBtn)

    expect(
      await within(dialog).findByText(/log recuperado tras reintento/i),
    ).toBeInTheDocument()
  })

  it('permite a Administrador configurar y cambiar la IP global', async () => {
    updateProxySettingsMock.mockResolvedValue({
      host: '10.9.3.24',
      version: 2,
    })

    renderPage()

    await screen.findByText('10.4.24.18')

    fireEvent.click(screen.getByRole('button', { name: /cambiar ip/i }))

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/esta acción cambia la ip de escucha de 5 servicios/i),
    ).toBeInTheDocument()

    const input = within(dialog).getByLabelText(/dirección ipv4/i)
    fireEvent.change(input, { target: { value: '10.9.3.24' } })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar IP' }))

    await waitFor(() => {
      expect(updateProxySettingsMock).toHaveBeenCalledWith({
        host: '10.9.3.24',
        version: 1,
      })
    })
  })
})
