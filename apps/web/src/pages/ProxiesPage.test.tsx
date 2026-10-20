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
  createProxy,
  requestAccessOptions,
  requestProxies,
  updateProxy,
  updateProxySettings,
  type ProxyListResponse,
  type ProxyView,
} from '@/features/proxies/api'
import { requestAccessAssignments } from '@/features/access-assignments/api'
import type { Access } from '@/features/accesses/api'

vi.mock('@/features/proxies/api', () => ({
  requestProxies: vi.fn(),
  requestAccessOptions: vi.fn(),
  updateProxySettings: vi.fn(),
  createProxy: vi.fn(),
  updateProxy: vi.fn(),
}))

vi.mock('@/features/access-assignments/api', () => ({
  requestAccessAssignments: vi.fn().mockResolvedValue({
    access: { id: 1, address: '10.20.10.15', port: 443, portEnd: 443 },
    counts: { current: 0, expiring: 0, expired: 0, total: 0 },
    current: [],
    expired: [],
  }),
}))

let currentPermissions: string[] = ['proxies.ver', 'proxies.gestionar']

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
const requestAccessOptionsMock = vi.mocked(requestAccessOptions)
const updateProxySettingsMock = vi.mocked(updateProxySettings)
const createProxyMock = vi.mocked(createProxy)
const updateProxyMock = vi.mocked(updateProxy)
const requestAccessAssignmentsMock = vi.mocked(requestAccessAssignments)

const sampleAccess1: Access = {
  id: 1,
  address: '10.20.10.15',
  port: 443,
  portEnd: 443,
  environment: 'production',
  protocol: 'tcp',
  detail: 'API de pagos',
  applications: null,
  urls: null,
  isActive: true,
  version: 1,
  createdAt: '2026-10-15T10:00:00.000Z',
  updatedAt: '2026-10-15T10:00:00.000Z',
}

const sampleAccess2: Access = {
  id: 2,
  address: 'qa-service.local',
  port: 8080,
  portEnd: 8080,
  environment: 'qa',
  protocol: null,
  detail: 'Servicio QA',
  applications: null,
  urls: null,
  isActive: false, // inactivo!
  version: 2,
  createdAt: '2026-10-16T12:00:00.000Z',
  updatedAt: '2026-10-17T14:00:00.000Z',
}

const sampleAccess3: Access = {
  id: 3,
  address: '192.168.5.10',
  port: 3000,
  portEnd: 3005,
  environment: 'development',
  protocol: 'both',
  detail: 'Mock dev',
  applications: null,
  urls: null,
  isActive: true,
  version: 1,
  createdAt: '2026-10-18T08:00:00.000Z',
  updatedAt: '2026-10-18T08:00:00.000Z',
}

const sampleProxies: ProxyView[] = [
  {
    id: 101,
    port: 9001,
    detail: 'Proxy Pagos Producción',
    isActive: true,
    version: 1,
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
    access: sampleAccess1,
  },
  {
    id: 102,
    port: 9002,
    detail: 'Proxy Servicio QA Inactivo',
    isActive: false,
    version: 2,
    createdAt: '2026-10-20T01:00:00.000Z',
    updatedAt: '2026-10-20T01:00:00.000Z',
    access: sampleAccess2,
  },
]

const sampleResponse: ProxyListResponse = {
  settings: {
    host: '192.168.1.50',
    version: 1,
  },
  proxies: sampleProxies,
}

let writeTextMock = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  vi.resetAllMocks()
  currentPermissions = ['proxies.ver', 'proxies.gestionar']
  requestProxiesMock.mockResolvedValue(sampleResponse)
  requestAccessOptionsMock.mockResolvedValue([sampleAccess3])
  requestAccessAssignmentsMock.mockResolvedValue({
    access: sampleAccess1,
    counts: { current: 0, expiring: 0, expired: 0, total: 0 },
    current: [],
    expired: [],
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
  it('muestra la IP global y el listado de proxies con detalle, endpoint, acceso, ambiente y estado', async () => {
    renderPage()

    expect(await screen.findByText('Proxies')).toBeInTheDocument()
    expect(
      screen.getByText('Catálogo de accesos publicados mediante reverse proxy.'),
    ).toBeInTheDocument()

    // Tarjeta IP global
    expect(screen.getByText('192.168.1.50')).toBeInTheDocument()

    // Fila 1
    expect(screen.getByText('Proxy Pagos Producción')).toBeInTheDocument()
    expect(screen.getByText('192.168.1.50:9001')).toBeInTheDocument()
    expect(screen.getByText('API de pagos')).toBeInTheDocument()
    expect(screen.getByText('10.20.10.15:443')).toBeInTheDocument()
    expect(screen.getByText('Producción')).toBeInTheDocument()
    expect(screen.getAllByText('Activo').length).toBeGreaterThan(0)

    // Fila 2 (inactivo por defecto visible)
    expect(screen.getByText('Proxy Servicio QA Inactivo')).toBeInTheDocument()
    expect(screen.getByText('192.168.1.50:9002')).toBeInTheDocument()
    expect(screen.getByText('Servicio QA')).toBeInTheDocument()
    expect(screen.getByText('qa-service.local:8080')).toBeInTheDocument()
    expect(screen.getByText('QA')).toBeInTheDocument()
    expect(screen.getAllByText('Inactivo').length).toBeGreaterThan(0)
  })

  it('muestra advertencia "Acceso inactivo" cuando el acceso vinculado está inactivo', async () => {
    renderPage()

    expect(await screen.findByText('Proxy Servicio QA Inactivo')).toBeInTheDocument()
    expect(screen.getByText('Acceso inactivo')).toBeInTheDocument()
  })

  it('copia el endpoint al portapapeles con feedback', async () => {
    renderPage()

    await screen.findByText('Proxy Pagos Producción')

    const copyBtn = screen.getByRole('button', {
      name: 'Copiar endpoint 192.168.1.50:9001',
    })
    fireEvent.click(copyBtn)

    expect(writeTextMock).toHaveBeenCalledWith('192.168.1.50:9001')
  })

  it('muestra un aviso visible y accesible cuando el portapapeles falla', async () => {
    writeTextMock.mockRejectedValueOnce(new Error('Bloqueado por el navegador.'))

    renderPage()

    await screen.findByText('Proxy Pagos Producción')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Copiar endpoint 192.168.1.50:9001',
      }),
    )

    expect(await screen.findByText('No se pudo copiar')).toBeInTheDocument()
    expect(
      screen.getByText(
        'No se pudo copiar el endpoint. Selecciónalo manualmente.',
      ),
    ).toBeInTheDocument()
  })

  it('copia la IP global al portapapeles', async () => {
    renderPage()

    await screen.findByText('192.168.1.50')

    const copyIpBtn = screen.getByRole('button', {
      name: 'Copiar IP global 192.168.1.50',
    })
    fireEvent.click(copyIpBtn)

    expect(writeTextMock).toHaveBeenCalledWith('192.168.1.50')
  })

  it('muestra aviso y deshabilita "Nuevo proxy" cuando no hay IP global configurada', async () => {
    requestProxiesMock.mockResolvedValue({
      settings: { host: null, version: null },
      proxies: [],
    })

    renderPage()

    expect(
      await screen.findByText('No se ha configurado la IP global del puente.'),
    ).toBeInTheDocument()

    const newProxyBtn = screen.getByRole('button', { name: 'Nuevo proxy' })
    expect(newProxyBtn).toBeDisabled()
  })

  it('filtra proxies por búsqueda en detalle, endpoint y acceso', async () => {
    renderPage()

    await screen.findByText('Proxy Pagos Producción')

    const searchInput = screen.getByPlaceholderText(/buscar por detalle, endpoint o acceso/i)
    fireEvent.change(searchInput, { target: { value: '9002' } })

    expect(screen.queryByText('Proxy Pagos Producción')).not.toBeInTheDocument()
    expect(screen.getByText('Proxy Servicio QA Inactivo')).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: 'pagos' } })

    expect(screen.getByText('Proxy Pagos Producción')).toBeInTheDocument()
    expect(screen.queryByText('Proxy Servicio QA Inactivo')).not.toBeInTheDocument()
  })

  it('encuentra por la dirección y el puerto completos del acceso', async () => {
    renderPage()

    await screen.findByText('Proxy Pagos Producción')

    fireEvent.change(
      screen.getByPlaceholderText(/buscar por detalle, endpoint o acceso/i),
      { target: { value: '10.20.10.15:443' } },
    )

    expect(screen.getByText('Proxy Pagos Producción')).toBeInTheDocument()
    expect(screen.queryByText('Proxy Servicio QA Inactivo')).not.toBeInTheDocument()
  })

  it('filtra proxies por ambiente y por estado', async () => {
    renderPage()

    await screen.findByText('Proxy Pagos Producción')

    // Filtro ambiente
    const envTrigger = screen.getByTestId('proxy-filter-environment')
    fireEvent.click(envTrigger)

    const qaOption = await screen.findByRole('option', { name: 'QA' })
    fireEvent.pointerDown(qaOption)
    fireEvent.pointerUp(qaOption)
    fireEvent.click(qaOption)

    await waitFor(() => {
      expect(screen.queryByText('Proxy Pagos Producción')).not.toBeInTheDocument()
      expect(screen.getByText('Proxy Servicio QA Inactivo')).toBeInTheDocument()
    })

    // Filtro estado
    const statusTrigger = screen.getByTestId('proxy-filter-status')
    fireEvent.click(statusTrigger)

    const activeOption = await screen.findByRole('option', { name: 'Activos' })
    fireEvent.pointerDown(activeOption)
    fireEvent.pointerUp(activeOption)
    fireEvent.click(activeOption)

    // Ningún QA es activo en nuestros datos de prueba
    await waitFor(() => {
      expect(screen.getByText('Sin resultados')).toBeInTheDocument()
    })
  })

  it('muestra estado vacío cuando no hay proxies', async () => {
    requestProxiesMock.mockResolvedValue({
      settings: { host: '192.168.1.50', version: 1 },
      proxies: [],
    })

    renderPage()

    expect(await screen.findByText('Sin proxies')).toBeInTheDocument()
    expect(
      screen.getByText('Todavía no hay proxies publicados en el catálogo.'),
    ).toBeInTheDocument()
  })

  it('muestra error del servidor y permite reintentar', async () => {
    requestProxiesMock.mockRejectedValueOnce(new Error('Fallo de red.'))
    requestProxiesMock.mockResolvedValueOnce(sampleResponse)

    renderPage()

    expect(await screen.findByText('No se pudieron cargar los proxies')).toBeInTheDocument()
    expect(screen.getByText('Fallo de red.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    expect(await screen.findByText('Proxy Pagos Producción')).toBeInTheDocument()
  })

  it('configura la IP global inicial sin enviar una versión nula', async () => {
    requestProxiesMock.mockResolvedValue({
      settings: { host: null, version: null },
      proxies: [],
    })
    updateProxySettingsMock.mockResolvedValue({
      host: '10.0.0.1',
      version: 1,
    })

    renderPage()

    await screen.findByText('Sin proxies')
    fireEvent.click(screen.getByRole('button', { name: /configurar ip/i }))

    fireEvent.change(screen.getByLabelText(/dirección ipv4/i), {
      target: { value: '10.0.0.1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar IP' }))

    await waitFor(() => {
      expect(updateProxySettingsMock).toHaveBeenCalledWith({
        host: '10.0.0.1',
      })
    })
  })

  it('permite a Administrador configurar o cambiar la IP global con confirmación', async () => {
    updateProxySettingsMock.mockResolvedValue({
      host: '10.0.0.1',
      version: 2,
    })

    renderPage()

    await screen.findByText('192.168.1.50')

    fireEvent.click(screen.getByRole('button', { name: /cambiar ip/i }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(
      screen.getByText(/esta acción modificará el endpoint de 2 proxies publicados/i),
    ).toBeInTheDocument()

    const hostInput = screen.getByLabelText(/dirección ipv4/i)
    fireEvent.change(hostInput, { target: { value: '10.0.0.1' } })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar IP' }))

    await waitFor(() => {
      expect(updateProxySettingsMock).toHaveBeenCalledWith({
        host: '10.0.0.1',
        version: 1,
      })
    })
  })

  it('permite a Administrador crear un nuevo proxy', async () => {
    createProxyMock.mockResolvedValue({
      id: 103,
      port: 9003,
      detail: 'Mock Dev Proxy',
      isActive: true,
      version: 1,
      createdAt: '2026-10-20T02:00:00.000Z',
      updatedAt: '2026-10-20T02:00:00.000Z',
      access: sampleAccess3,
    })

    renderPage()

    await screen.findByText('Proxy Pagos Producción')

    fireEvent.click(screen.getByRole('button', { name: 'Nuevo proxy' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Nuevo proxy' })).toBeInTheDocument()

    // Selector de acceso
    const selectTrigger = screen.getByTestId('proxy-form-access-select')
    fireEvent.click(selectTrigger)

    const accessOption = await screen.findByRole('option', {
      name: /mock dev/i,
    })
    fireEvent.click(accessOption)

    // Puerto
    fireEvent.change(screen.getByLabelText('Puerto'), {
      target: { value: '9003' },
    })

    // Detalle
    fireEvent.change(screen.getByLabelText('Detalle'), {
      target: { value: 'Mock Dev Proxy' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Publicar proxy' }))

    await waitFor(() => {
      expect(createProxyMock).toHaveBeenCalledWith({
        accessId: 3,
        port: 9003,
        detail: 'Mock Dev Proxy',
      })
    })
  })

  it('permite reintentar la carga de accesos del formulario', async () => {
    requestAccessOptionsMock
      .mockRejectedValueOnce(new Error('No se pudieron cargar los accesos.'))
      .mockResolvedValueOnce([sampleAccess3])

    renderPage()

    await screen.findByText('Proxy Pagos Producción')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo proxy' }))

    expect(
      await screen.findByText('No se pudieron cargar los accesos.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => {
      expect(requestAccessOptionsMock).toHaveBeenCalledTimes(2)
    })
    expect(
      await screen.findByTestId('proxy-form-access-select'),
    ).toBeInTheDocument()
  })

  it('permite a Administrador editar un proxy existente', async () => {
    updateProxyMock.mockResolvedValue({
      ...sampleProxies[0]!,
      detail: 'Proxy Pagos Editado',
      port: 9010,
      version: 2,
    })

    renderPage()

    await screen.findByText('Proxy Pagos Producción')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Editar proxy Proxy Pagos Producción',
      }),
    )

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Editar proxy' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Detalle'), {
      target: { value: 'Proxy Pagos Editado' },
    })
    fireEvent.change(screen.getByLabelText('Puerto'), {
      target: { value: '9010' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateProxyMock).toHaveBeenCalledWith(101, {
        accessId: 1,
        port: 9010,
        detail: 'Proxy Pagos Editado',
        version: 1,
      })
    })
  })

  it('permite editar un proxy cuyo acceso está inactivo conservando el vínculo', async () => {
    updateProxyMock.mockResolvedValue({
      ...sampleProxies[1]!,
      detail: 'Proxy QA Editado',
      version: 3,
    })

    renderPage()

    await screen.findByText('Proxy Servicio QA Inactivo')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Editar proxy Proxy Servicio QA Inactivo',
      }),
    )

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Detalle'), {
      target: { value: 'Proxy QA Editado' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateProxyMock).toHaveBeenCalledWith(102, {
        accessId: 2,
        port: 9002,
        detail: 'Proxy QA Editado',
        version: 2,
      })
    })
  })

  it('permite a Administrador desactivar y reactivar un proxy con confirmación', async () => {
    updateProxyMock.mockResolvedValue({
      ...sampleProxies[0]!,
      isActive: false,
      version: 2,
    })

    renderPage()

    await screen.findByText('Proxy Pagos Producción')

    // Desactivar
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Desactivar proxy Proxy Pagos Producción',
      }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: 'Desactivar proxy' }),
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Desactivar' }))

    await waitFor(() => {
      expect(updateProxyMock).toHaveBeenCalledWith(101, {
        isActive: false,
        version: 1,
      })
    })
  })

  it('permite reactivar un proxy inactivo con confirmación', async () => {
    updateProxyMock.mockResolvedValue({
      ...sampleProxies[1]!,
      isActive: true,
      version: 3,
    })

    renderPage()

    await screen.findByText('Proxy Servicio QA Inactivo')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Reactivar proxy Proxy Servicio QA Inactivo',
      }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: 'Reactivar proxy' }),
    ).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reactivar' }))

    await waitFor(() => {
      expect(updateProxyMock).toHaveBeenCalledWith(102, {
        isActive: true,
        version: 2,
      })
    })
  })

  it('muestra el error del servidor al crear un proxy duplicado', async () => {
    createProxyMock.mockRejectedValueOnce(
      new Error('El puerto ya está reservado.'),
    )

    renderPage()

    await screen.findByText('Proxy Pagos Producción')
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo proxy' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.click(screen.getByTestId('proxy-form-access-select'))
    fireEvent.click(
      await screen.findByRole('option', { name: /mock dev/i }),
    )
    fireEvent.change(screen.getByLabelText('Puerto'), {
      target: { value: '9001' },
    })
    fireEvent.change(screen.getByLabelText('Detalle'), {
      target: { value: 'Proxy duplicado' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar proxy' }))

    expect(
      await within(dialog).findByText('El puerto ya está reservado.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('oculta acciones de gestión para usuarios sin proxies.gestionar', async () => {
    currentPermissions = ['proxies.ver']

    renderPage()

    await screen.findByText('Proxy Pagos Producción')

    // Sin botón Nuevo proxy
    expect(screen.queryByRole('button', { name: 'Nuevo proxy' })).not.toBeInTheDocument()

    // Sin botón Cambiar IP
    expect(screen.queryByRole('button', { name: /cambiar ip/i })).not.toBeInTheDocument()

    // Sin botones de editar ni desactivar
    expect(screen.queryByRole('button', { name: /editar proxy/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /desactivar proxy/i })).not.toBeInTheDocument()

    // Sí ve "Ver acceso" y copiar
    expect(
      screen.getByRole('button', { name: 'Ver acceso de Proxy Pagos Producción' }),
    ).toBeInTheDocument()
  })

  it('abre el detalle del acceso vinculado al pulsar "Ver acceso"', async () => {
    renderPage()

    await screen.findByText('Proxy Pagos Producción')

    fireEvent.click(
      screen.getByRole('button', { name: 'Ver acceso de Proxy Pagos Producción' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByRole('heading', { name: 'Detalle del acceso' }),
    ).toBeInTheDocument()
  })
})
