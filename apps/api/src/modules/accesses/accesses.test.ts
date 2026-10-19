import { PERMISSION_KEYS } from '@qabase/shared'
import { describe, expect, it } from 'vitest'
import type { PasswordHasher } from '../../core/security/password'
import { createTestDatabase } from '../../test/db'
import type { Actor } from '../identity/actor'
import { findAccountById } from '../identity/repository'
import { createFirstAdmin } from '../identity/service'
import {
  createAccess,
  getAccessView,
  listAccessHistory,
  listAccessViews,
  updateAccessDetails,
} from './service'

const PASSWORD = 'correct horse battery staple'
const now = new Date('2026-10-19T12:00:00.000Z')

const hasher: PasswordHasher = {
  async hash(password) {
    return `fake:${password}`
  },
  async verify(passwordHash, password) {
    return passwordHash === `fake:${password}`
  },
}

async function setup() {
  const db = createTestDatabase()
  const adminId = await createFirstAdmin(
    { db, hasher },
    { username: 'admin', password: PASSWORD, now },
  )
  const admin = findAccountById(db, adminId)!
  const actor: Actor = {
    id: admin.id,
    username: admin.username,
    permissions: [...PERMISSION_KEYS],
  }
  return { db, actor }
}

function create(
  db: ReturnType<typeof createTestDatabase>,
  actor: Actor,
  overrides: Partial<{
    address: string
    port: number
    portEnd: number
    environment: string
    protocol: string | null
    detail: string | null
    applications: string | null
    urls: string | null
  }> = {},
) {
  return createAccess(db, actor, {
    address: overrides.address ?? '10.20.10.15',
    port: overrides.port ?? 443,
    portEnd: overrides.portEnd,
    environment: overrides.environment ?? 'production',
    protocol: overrides.protocol,
    detail: overrides.detail,
    applications: overrides.applications,
    urls: overrides.urls,
    now,
  })
}

describe('alta de accesos', () => {
  it('crea un acceso activo, versión 1 y auditoría', async () => {
    const { db, actor } = await setup()
    const access = create(db, actor, {
      address: '  API.Empresa.local  ',
      port: 443,
      environment: 'production',
      protocol: 'tcp',
      detail: '  API de pagos  ',
    })

    expect(access).toMatchObject({
      address: 'API.Empresa.local',
      port: 443,
      environment: 'production',
      protocol: 'tcp',
      detail: 'API de pagos',
      isActive: true,
      version: 1,
    })
    expect(listAccessHistory(db, access.id)[0]).toMatchObject({
      action: 'access.created',
      actorUsername: 'admin',
    })

    db.close()
  })

  it('acepta IPv4, IPv6, CIDR y dominio', async () => {
    const { db, actor } = await setup()
    const addresses = [
      '10.20.10.15',
      '2001:db8:20::15',
      '10.30.0.0/24',
      'srv-qa-01.empresa.local',
    ]

    for (let index = 0; index < addresses.length; index += 1) {
      const access = create(db, actor, {
        address: addresses[index]!,
        port: 1000 + index,
      })
      expect(access.address).toBe(addresses[index])
    }

    db.close()
  })

  it('rechaza dirección, puerto, ambiente y detalle inválidos', async () => {
    const { db, actor } = await setup()

    expect(() => create(db, actor, { address: 'dirección inválida' })).toThrow(
      /dirección/,
    )
    expect(() => create(db, actor, { address: '10.0.0.0/99' })).toThrow(
      /dirección/,
    )
    expect(() => create(db, actor, { port: 0 })).toThrow(/puerto/)
    expect(() => create(db, actor, { port: 65536 })).toThrow(/puerto/)
    expect(() =>
      create(db, actor, { environment: 'preproduccion' }),
    ).toThrow(/ambiente/)
    expect(() => create(db, actor, { detail: 'x'.repeat(201) })).toThrow(
      /detalle/,
    )

    db.close()
  })

  it('rechaza duplicados por dirección normalizada, puerto y ambiente', async () => {
    const { db, actor } = await setup()
    create(db, actor, {
      address: 'API.Empresa.local',
      port: 443,
      environment: 'production',
    })

    expect(() =>
      create(db, actor, {
        address: 'api.empresa.local',
        port: 443,
        environment: 'production',
      }),
    ).toThrow(/Ya existe/)

    expect(() =>
      create(db, actor, {
        address: 'api.empresa.local',
        port: 443,
        environment: 'qa',
      }),
    ).not.toThrow()

    db.close()
  })

  it('normaliza detalle vacío a null y protocolo opcional', async () => {
    const { db, actor } = await setup()
    const access = create(db, actor, { detail: '   ', protocol: null })

    expect(access.detail).toBeNull()
    expect(access.protocol).toBeNull()

    db.close()
  })

  it('acepta rango de puertos, ambiente sin clasificar y metadatos', async () => {
    const { db, actor } = await setup()
    const access = create(db, actor, {
      address: '*.smartbear.com',
      port: 3000,
      portEnd: 3099,
      environment: 'unspecified',
      protocol: 'tcp',
      detail: 'Rango de QA',
      applications: 'web-browsing, ssl',
      urls: 'https://example.test/a\nhttps://example.test/b',
    })

    expect(access).toMatchObject({
      address: '*.smartbear.com',
      port: 3000,
      portEnd: 3099,
      environment: 'unspecified',
      applications: 'web-browsing, ssl',
      urls: 'https://example.test/a\nhttps://example.test/b',
    })
    expect(listAccessViews(db, { q: 'web-browsing' })).toHaveLength(1)
    expect(listAccessViews(db, { q: 'example.test' })).toHaveLength(1)
    expect(listAccessViews(db, { q: '3000-3099' })).toHaveLength(1)
    expect(listAccessViews(db, { environment: 'unspecified' })).toHaveLength(1)

    db.close()
  })

  it('rechaza un puerto final menor y dominios comodín inválidos', async () => {
    const { db, actor } = await setup()

    expect(() => create(db, actor, { port: 3000, portEnd: 2999 })).toThrow(
      /puerto final/,
    )
    expect(() => create(db, actor, { address: 'foo.*.com' })).toThrow(
      /dirección/,
    )
    expect(() =>
      create(db, actor, { applications: 'x'.repeat(501) }),
    ).toThrow(/aplicaciones/)
    expect(() => create(db, actor, { urls: 'x'.repeat(4001) })).toThrow(
      /URLs/,
    )

    db.close()
  })

  it('permite el mismo puerto con otro rango final', async () => {
    const { db, actor } = await setup()
    create(db, actor, { port: 3000, portEnd: 3000 })
    expect(() => create(db, actor, { port: 3000, portEnd: 3099 })).not.toThrow()

    db.close()
  })
})

describe('edición y estado', () => {
  it('edita todos los campos con versión y auditoría antes/después', async () => {
    const { db, actor } = await setup()
    const access = create(db, actor, {
      address: '10.20.10.15',
      port: 443,
      environment: 'production',
      protocol: 'tcp',
      detail: 'API',
    })

    const updated = updateAccessDetails(db, actor, access.id, {
      address: 'api.empresa.local',
      port: 8443,
      environment: 'qa',
      protocol: 'both',
      detail: 'API QA',
      version: access.version,
      now,
    })

    expect(updated).toMatchObject({
      address: 'api.empresa.local',
      port: 8443,
      environment: 'qa',
      protocol: 'both',
      detail: 'API QA',
      version: 2,
    })
    expect(listAccessHistory(db, access.id).at(-1)).toMatchObject({
      action: 'access.updated',
      before: { address: '10.20.10.15', port: 443 },
      after: { address: 'api.empresa.local', port: 8443 },
    })

    db.close()
  })

  it('edita rango, aplicaciones, URLs y ambiente sin clasificar', async () => {
    const { db, actor } = await setup()
    const access = create(db, actor, {
      port: 80,
      environment: 'qa',
    })

    const updated = updateAccessDetails(db, actor, access.id, {
      port: 3000,
      portEnd: 3099,
      environment: 'unspecified',
      applications: 'web-browsing, ssl',
      urls: 'https://example.test/a',
      detail: 'Rango importado',
      version: access.version,
      now,
    })

    expect(updated).toMatchObject({
      port: 3000,
      portEnd: 3099,
      environment: 'unspecified',
      applications: 'web-browsing, ssl',
      urls: 'https://example.test/a',
      detail: 'Rango importado',
      version: 2,
    })
    expect(listAccessHistory(db, access.id).at(-1)).toMatchObject({
      action: 'access.updated',
      after: {
        port: 3000,
        portEnd: 3099,
        applications: 'web-browsing, ssl',
        urls: 'https://example.test/a',
      },
    })

    db.close()
  })

  it('rechaza versión vieja y cambios sin diferencias', async () => {
    const { db, actor } = await setup()
    const access = create(db, actor)
    const updated = updateAccessDetails(db, actor, access.id, {
      detail: 'Nuevo',
      version: access.version,
      now,
    })

    expect(() =>
      updateAccessDetails(db, actor, access.id, {
        detail: 'Versión vieja',
        version: access.version,
        now,
      }),
    ).toThrow(/cambió/)

    expect(() =>
      updateAccessDetails(db, actor, access.id, {
        detail: 'Nuevo',
        version: updated.version,
        now,
      }),
    ).toThrow(/No hay cambios/)

    db.close()
  })

  it('desactiva y reactiva conservando historial', async () => {
    const { db, actor } = await setup()
    const access = create(db, actor)

    const inactive = updateAccessDetails(db, actor, access.id, {
      isActive: false,
      version: access.version,
      now,
    })
    expect(inactive.isActive).toBe(false)

    const active = updateAccessDetails(db, actor, access.id, {
      isActive: true,
      version: inactive.version,
      now,
    })
    expect(active.isActive).toBe(true)

    expect(
      listAccessHistory(db, access.id).map((event) => event.action),
    ).toEqual(['access.created', 'access.deactivated', 'access.reactivated'])

    db.close()
  })

  it('rechaza un cambio que duplica la clave de otro acceso', async () => {
    const { db, actor } = await setup()
    create(db, actor, { address: '10.0.0.1', port: 443 })
    const second = create(db, actor, { address: '10.0.0.2', port: 443 })

    expect(() =>
      updateAccessDetails(db, actor, second.id, {
        address: '10.0.0.1',
        version: second.version,
        now,
      }),
    ).toThrow(/Ya existe/)

    db.close()
  })
})

describe('listado, búsqueda y filtros', () => {
  it('ordena por ambiente, dirección y puerto', async () => {
    const { db, actor } = await setup()
    create(db, actor, { address: '10.0.0.2', port: 443, environment: 'production' })
    create(db, actor, { address: '10.0.0.1', port: 80, environment: 'qa' })
    create(db, actor, { address: '10.0.0.3', port: 22, environment: 'development' })

    const list = listAccessViews(db, {})
    expect(list.map((access) => access.environment)).toEqual([
      'development',
      'qa',
      'production',
    ])

    db.close()
  })

  it('ordena por dirección y puerto dentro del mismo ambiente', async () => {
    const { db, actor } = await setup()
    create(db, actor, { address: '10.0.0.2', port: 443 })
    create(db, actor, { address: '10.0.0.1', port: 8443 })
    create(db, actor, { address: '10.0.0.1', port: 80 })

    const list = listAccessViews(db, {})
    expect(
      list.map((access) => `${access.address}:${access.port}`),
    ).toEqual(['10.0.0.1:80', '10.0.0.1:8443', '10.0.0.2:443'])

    db.close()
  })

  it('busca por detalle, dirección y puerto parcial', async () => {
    const { db, actor } = await setup()
    create(db, actor, {
      address: 'api.empresa.local',
      port: 443,
      detail: 'API de pagos',
    })
    create(db, actor, {
      address: '10.0.0.2',
      port: 8443,
      detail: 'Consola administrativa',
    })

    expect(listAccessViews(db, { q: 'pagos' })).toHaveLength(1)
    expect(listAccessViews(db, { q: 'api.empresa' })).toHaveLength(1)
    expect(listAccessViews(db, { q: '44' })).toHaveLength(2)
    expect(listAccessViews(db, { q: '844' })).toHaveLength(1)
    expect(listAccessViews(db, { q: 'inexistente' })).toHaveLength(0)

    db.close()
  })

  it('conserva tildes y Ñ y escapa comodines', async () => {
    const { db, actor } = await setup()
    create(db, actor, { detail: 'Acceso Muñoz' })
    create(db, actor, { address: '10.0.0.9', detail: 'Literal 100%' })

    expect(listAccessViews(db, { q: 'MUÑOZ' })).toHaveLength(1)
    expect(listAccessViews(db, { q: 'munoz' })).toHaveLength(0)
    expect(listAccessViews(db, { q: '100%' })).toHaveLength(1)
    expect(listAccessViews(db, { q: '100_' })).toHaveLength(0)

    db.close()
  })

  it('filtra por ambiente, estado y protocolo', async () => {
    const { db, actor } = await setup()
    const active = create(db, actor, {
      address: '10.0.0.1',
      port: 80,
      environment: 'qa',
      protocol: 'tcp',
    })
    create(db, actor, {
      address: '10.0.0.2',
      port: 443,
      environment: 'production',
      protocol: 'udp',
    })
    const inactive = create(db, actor, {
      address: '10.0.0.3',
      port: 22,
      environment: 'qa',
    })
    updateAccessDetails(db, actor, inactive.id, {
      isActive: false,
      version: inactive.version,
      now,
    })

    expect(listAccessViews(db, { status: 'active' })).toHaveLength(2)
    expect(listAccessViews(db, { status: 'inactive' })).toHaveLength(1)
    expect(listAccessViews(db, { environment: 'qa' })).toHaveLength(2)
    expect(listAccessViews(db, { protocol: 'tcp' })).toHaveLength(1)
    expect(listAccessViews(db, { protocol: 'none' })).toHaveLength(1)
    expect(listAccessViews(db, { status: 'active', environment: 'qa' })).toEqual([
      expect.objectContaining({ id: active.id }),
    ])

    db.close()
  })

  it('muestra inactivos por defecto y obtiene detalle', async () => {
    const { db, actor } = await setup()
    const access = create(db, actor)
    updateAccessDetails(db, actor, access.id, {
      isActive: false,
      version: access.version,
      now,
    })

    expect(listAccessViews(db, {})).toHaveLength(1)
    expect(getAccessView(db, access.id).isActive).toBe(false)

    db.close()
  })
})
