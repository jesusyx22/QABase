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
  updateProxySettings,
  type ProxyListResponse,
  type ProxyServiceView,
} from '@/features/proxies/api'

vi.mock('@/features/proxies/api', () => ({
  requestProxies: vi.fn(),
  updateProxySettings: vi.fn(),
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
const requestStartProxyMock = vi.mocked(requestStartProxy)
const requestStopProxyMock = vi.mocked(requestStopProxy)
const requestRestartProxyMock = vi.mocked(requestRestartProxy)
const requestProxyLogsMock = vi.mocked(requestProxyLogs)

const sampleService1: ProxyServiceView = {
  id: 1,
  slug: 'sentinel',
  name: 'Proxy Sentinel',
  environment: 'qa',
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

const sampleService4: ProxyServiceView = {
  id: 4,
  slug: 'external-proxy',
  name: 'External Mock Proxy',
  environment: 'qa',
  healthPath: null,
  isActive: true,
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
  ports: [{ port: 9000, isPrimary: true, listening: true }],
  routes: [{ id: 40, path: '/api', target: 'http://10.0.0.5', detail: null, access: null }],
  runtime: {
    status: 'active',
    pid: 99999,
    managed: false, // Externo!
    health: 'skipped',
    detail: null,
    startedAt: '2026-10-20T09:00:00.000Z',
  },
}

const sampleServiceError: ProxyServiceView = {
  id: 5,
  slug: 'error-service',
  name: 'Error Service Proxy',
  environment: 'qa',
  healthPath: null,
  isActive: true,
  createdAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T00:00:00.000Z',
  ports: [{ port: 9050, isPrimary: true, listening: false }],
  routes: [{ id: 50, path: '/err', target: 'http://10.0.0.6', detail: null, access: null }],
  runtime: {
    status: 'error',
    pid: 8888,
    managed: true,
    health: 'down',
    detail: 'El proceso falló pero el puerto sigue asociado',
    startedAt: '2026-10-20T09:30:00.000Z',
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
    sampleService4,
    sampleServiceError,
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
    expect(screen.getByText('Detenido')).toBeInTheDocument()

    // Fila 3: Mantis BT con 2 puertos y acceso inactivo
    expect(screen.getByText('Mantis BT')).toBeInTheDocument()
    expect(screen.getByText('10.4.24.18:80')).toBeInTheDocument()
    expect(screen.getByText('10.4.24.18:8080')).toBeInTheDocument()
    expect(screen.getByText('Acceso inactivo')).toBeInTheDocument()
    expect(screen.getByText('Conflicto')).toBeInTheDocument()
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

    // GitLab está detenido, así que debe dar 0 resultados
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

  it('advierte y pasa confirmExternal=true al detener un proceso no gestionado por QABase', async () => {
    requestStopProxyMock.mockResolvedValue({
      ...sampleService4,
      runtime: {
        ...sampleService4.runtime,
        status: 'stopped',
        pid: null,
      },
    })

    renderPage()

    await screen.findByText('External Mock Proxy')

    const stopBtn = screen.getByRole('button', {
      name: 'Detener servicio External Mock Proxy',
    })
    fireEvent.click(stopBtn)

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/proceso externo no gestionado por qabase/i),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/este proceso fue iniciado fuera de qabase \(pid 99999\)/i),
    ).toBeInTheDocument()

    // Confirmar
    fireEvent.click(within(dialog).getByRole('button', { name: 'Detener' }))

    await waitFor(() => {
      expect(requestStopProxyMock).toHaveBeenCalledWith(4, true)
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

  it('en estado error ofrece Iniciar, Detener y Reiniciar; en conflict NO ofrece Detener', async () => {
    renderPage()

    await screen.findByText('Error Service Proxy')

    // Servicio en error: debe ofrecer Iniciar, Detener y Reiniciar
    expect(
      screen.getByRole('button', { name: 'Iniciar servicio Error Service Proxy' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Detener servicio Error Service Proxy' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Reiniciar servicio Error Service Proxy' }),
    ).toBeInTheDocument()

    // Servicio en conflict (Mantis BT): NO debe ofrecer Detener
    expect(
      screen.queryByRole('button', { name: 'Detener servicio Mantis BT' }),
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

    // Simular que el auto-refresh / reload recibe cambio de estado en Proxy Sentinel
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
        sampleService4,
        sampleServiceError,
      ],
    })

    // Disparar refresh (el botón en el fondo tiene aria-hidden por el diálogo modal abierto)
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

    // Debe mostrar el error sin quedar cargando indefinidamente
    expect(
      await within(dialog).findByText('No se pudo leer el archivo de log.'),
    ).toBeInTheDocument()

    // El botón Reintentar o Actualizar logs no debe estar deshabilitado
    const retryBtn = within(dialog).getByRole('button', { name: 'Reintentar' })
    expect(retryBtn).not.toBeDisabled()

    fireEvent.click(retryBtn)

    // Tras el reintento exitoso, los logs aparecen
    expect(
      await within(dialog).findByText(/log recuperado tras reintento/i),
    ).toBeInTheDocument()
  })

  it('abre el detalle del servicio y muestra información de proceso, puertos, rutas y logs', async () => {
    renderPage()

    await screen.findByText('Proxy Sentinel')

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalle de Proxy Sentinel' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('25940')).toBeInTheDocument()
    expect(within(dialog).getByText('Saludable (UP)')).toBeInTheDocument()
    expect(within(dialog).getByText('10.4.24.18:3500')).toBeInTheDocument()
    expect(within(dialog).getByText('Escuchando')).toBeInTheDocument()

    // Logs cargados
    expect(
      await within(dialog).findByTestId('proxy-log-output'),
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(/server started on port 3500/i),
    ).toBeInTheDocument()

    // Botón refrescar logs
    fireEvent.click(within(dialog).getByRole('button', { name: 'Actualizar logs' }))
    await waitFor(() => {
      expect(requestProxyLogsMock).toHaveBeenCalledTimes(2)
    })

    // Cerrar
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('oculta acciones operativas y de gestión para usuarios de consulta (solo proxies.ver)', async () => {
    currentPermissions = ['proxies.ver']

    renderPage()

    await screen.findByText('Proxy Sentinel')

    // Sin botón Cambiar IP
    expect(screen.queryByRole('button', { name: /cambiar ip/i })).not.toBeInTheDocument()

    // Sin botones Iniciar, Detener o Reiniciar
    expect(screen.queryByRole('button', { name: /iniciar servicio/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /detener servicio/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reiniciar servicio/i })).not.toBeInTheDocument()

    // SÍ puede ver Detalle
    fireEvent.click(
      screen.getByRole('button', { name: 'Ver detalle de Proxy Sentinel' }),
    )

    const dialog = await screen.findByRole('dialog')
    // No debe mostrar la sección de logs para usuarios sin proxies.operar
    expect(
      within(dialog).queryByText(/últimas 100 líneas de log/i),
    ).not.toBeInTheDocument()
    expect(requestProxyLogsMock).not.toHaveBeenCalled()
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
      within(dialog).getByText(/esta acción modificará el host publicado de 5 servicios/i),
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
