import { PERMISSION_KEYS } from '@qabase/shared'
import { describe, expect, it } from 'vitest'
import type { PasswordHasher } from '../../core/security/password'
import { createTestDatabase } from '../../test/db'
import type { Actor } from '../identity/actor'
import { findAccountById } from '../identity/repository'
import { createFirstAdmin } from '../identity/service'
import { createAccess, updateAccessDetails } from '../accesses/service'
import { createPerson, updatePersonDetails } from '../personal/service'
import {
  createAssignment,
  listAccessAssignments,
  listAssignmentHistory,
  listPersonAssignments,
  listQaOverview,
  updateAssignmentDetails,
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
  const person = createPerson(db, actor, { name: 'Ana QA', now })
  const access = createAccess(db, actor, {
    address: '10.20.10.15',
    port: 443,
    environment: 'production',
    protocol: 'tcp',
    detail: 'API de pagos',
    now,
  })
  return { db, actor, person, access }
}

function create(
  db: ReturnType<typeof createTestDatabase>,
  actor: Actor,
  personId: number,
  accessId: number,
  expiresOn = '2026-11-20',
) {
  return createAssignment(db, actor, {
    personId,
    accessId,
    expiresOn,
    now,
  })
}

function createExpired(
  db: ReturnType<typeof createTestDatabase>,
  actor: Actor,
  personId: number,
  accessId: number,
  expiresOn = '2026-10-01',
) {
  const assignment = create(db, actor, personId, accessId, '2026-11-20')
  return updateAssignmentDetails(db, actor, assignment.id, {
    expiresOn,
    version: assignment.version,
    now,
  })
}

describe('alta de asignaciones', () => {
  it('crea una asignación con estado, conteos e historial', async () => {
    const { db, actor, person, access } = await setup()
    const assignment = create(db, actor, person.id, access.id)

    expect(assignment).toMatchObject({
      person: { id: person.id, name: 'Ana QA', isActive: true },
      access: {
        id: access.id,
        address: '10.20.10.15',
        port: 443,
        isActive: true,
      },
      expiresOn: '2026-11-20',
      state: 'current',
      urgency: 'ok',
      version: 1,
    })
    expect(listAssignmentHistory(db, assignment.id)[0]).toMatchObject({
      action: 'access_assignment.created',
      actorUsername: 'admin',
      after: {
        personId: person.id,
        accessId: access.id,
        expiresOn: '2026-11-20',
      },
    })

    db.close()
  })

  it('rechaza duplicados y permite el mismo acceso a otro QA', async () => {
    const { db, actor, person, access } = await setup()
    const other = createPerson(db, actor, { name: 'Luis QA', now })
    create(db, actor, person.id, access.id)

    expect(() => create(db, actor, person.id, access.id)).toThrow(
      /ya tiene este acceso/,
    )
    expect(() => create(db, actor, other.id, access.id)).not.toThrow()

    db.close()
  })

  it('rechaza fechas inválidas, pasadas, QAs y accesos inactivos', async () => {
    const { db, actor, person, access } = await setup()

    expect(() => create(db, actor, person.id, access.id, '2026-02-30')).toThrow(
      /fecha/i,
    )
    expect(() => create(db, actor, person.id, access.id, '2026-10-18')).toThrow(
      /anterior a hoy/,
    )

    const inactivePerson = createPerson(db, actor, { name: 'Beto QA', now })
    updatePersonDetails(db, actor, inactivePerson.id, {
      isActive: false,
      version: inactivePerson.version,
      now,
    })
    expect(() => create(db, actor, inactivePerson.id, access.id)).toThrow(
      /QA está inactivo/,
    )

    const inactiveAccess = createAccess(db, actor, {
      address: '10.20.10.16',
      port: 8443,
      environment: 'qa',
      now,
    })
    updateAccessDetails(db, actor, inactiveAccess.id, {
      isActive: false,
      version: inactiveAccess.version,
      now,
    })
    expect(() => create(db, actor, person.id, inactiveAccess.id)).toThrow(
      /acceso está inactivo/,
    )

    db.close()
  })

  it('acepta el día de hoy en Lima aunque en UTC ya sea mañana', async () => {
    const { db, actor, person, access } = await setup()
    const limaNextDay = new Date('2026-10-20T02:00:00.000Z')

    expect(() =>
      createAssignment(db, actor, {
        personId: person.id,
        accessId: access.id,
        expiresOn: '2026-10-19',
        now: limaNextDay,
      }),
    ).not.toThrow()

    db.close()
  })
})

describe('lista por QA', () => {
  it('calcula conteos, próximo vencimiento y urgencia', async () => {
    const { db, actor, person, access } = await setup()
    const second = createAccess(db, actor, {
      address: '10.20.10.16',
      port: 8443,
      environment: 'qa',
      now,
    })
    const third = createAccess(db, actor, {
      address: '10.20.10.17',
      port: 22,
      environment: 'development',
      now,
    })

    create(db, actor, person.id, access.id, '2026-10-19')
    create(db, actor, person.id, second.id, '2026-10-30')
    create(db, actor, person.id, third.id, '2026-12-01')

    const overview = listQaOverview(db, { q: 'Ana' }, now)
    expect(overview.qas).toHaveLength(1)
    expect(overview.qas[0]).toMatchObject({
      person: { id: person.id, name: 'Ana QA' },
      counts: { current: 1, expiring: 2, expired: 0, total: 3 },
      nextExpiry: '2026-10-19',
      urgency: 'critical',
    })
    expect(overview.kpis).toMatchObject({
      qasWithAccess: 1,
      current: 1,
      expiring: 2,
      expired: 0,
    })

    db.close()
  })

  it('filtra por estado, busca y ordena', async () => {
    const { db, actor, person, access } = await setup()
    const secondPerson = createPerson(db, actor, { name: 'Zulema QA', now })
    const secondAccess = createAccess(db, actor, {
      address: '10.20.10.16',
      port: 8443,
      environment: 'qa',
      now,
    })

    create(db, actor, person.id, access.id, '2026-12-01')
    create(db, actor, secondPerson.id, secondAccess.id, '2026-10-19')

    expect(
      listQaOverview(db, { filter: 'current', sort: 'name' }, now).qas.map(
        (qa) => qa.person.name,
      ),
    ).toContain('Ana QA')
    expect(
      listQaOverview(db, { filter: 'expiring' }, now).qas.map(
        (qa) => qa.person.name,
      ),
    ).toContain('Zulema QA')
    expect(listQaOverview(db, { q: 'zulema' }, now).qas).toHaveLength(1)

    const byUrgency = listQaOverview(
      db,
      { filter: 'withAccess', sort: 'urgency' },
      now,
    )
    expect(byUrgency.qas[0]?.person.name).toBe('Zulema QA')
    expect(byUrgency.qas[1]?.person.name).toBe('Ana QA')

    const byName = listQaOverview(
      db,
      { filter: 'withAccess', sort: 'name' },
      now,
    )
    expect(byName.qas[0]?.person.name).toBe('Ana QA')
    expect(byName.qas[1]?.person.name).toBe('Zulema QA')

    db.close()
  })

  it('muestra vencidos, sin accesos e inactivos', async () => {
    const { db, actor, person, access } = await setup()
    createExpired(db, actor, person.id, access.id)

    const expired = listQaOverview(db, { q: 'Ana', filter: 'expired' }, now)
    expect(expired.qas[0]).toMatchObject({
      counts: { expired: 1, total: 1 },
      nextExpiry: null,
      urgency: 'expired',
    })

    const none = listQaOverview(db, { q: 'Ana', filter: 'none' }, now)
    expect(none.qas).toHaveLength(0)

    const inactive = createPerson(db, actor, { name: 'Beto QA', now })
    updatePersonDetails(db, actor, inactive.id, {
      isActive: false,
      version: inactive.version,
      now,
    })
    const inactiveList = listQaOverview(
      db,
      { filter: 'inactive', q: 'Beto' },
      now,
    )
    expect(inactiveList.qas).toHaveLength(1)
    expect(inactiveList.qas[0]?.person.isActive).toBe(false)

    db.close()
  })
})

describe('detalle y vista inversa', () => {
  it('agrupa vigentes y vencidos por QA y por acceso', async () => {
    const { db, actor, person, access } = await setup()
    const expiredAccess = createAccess(db, actor, {
      address: '10.20.10.16',
      port: 8443,
      environment: 'qa',
      now,
    })
    create(db, actor, person.id, access.id, '2026-11-20')
    createExpired(db, actor, person.id, expiredAccess.id)

    const byPerson = listPersonAssignments(db, person.id, now)
    expect(byPerson.person).toMatchObject({ id: person.id, name: 'Ana QA' })
    expect(byPerson.counts).toMatchObject({
      current: 1,
      expiring: 0,
      expired: 1,
      total: 2,
    })
    expect(byPerson.current).toHaveLength(1)
    expect(byPerson.expired).toHaveLength(1)
    expect(byPerson.expired[0]?.urgency).toBe('expired')

    const byAccess = listAccessAssignments(db, access.id, now)
    expect(byAccess.access).toMatchObject({ id: access.id })
    expect(byAccess.current).toHaveLength(1)
    expect(byAccess.expired).toHaveLength(0)

    expect(() => listPersonAssignments(db, 9999, now)).toThrow(/no existe/)
    expect(() => listAccessAssignments(db, 9999, now)).toThrow(/no existe/)

    db.close()
  })
})

describe('edición de asignaciones', () => {
  it('edita fecha, QA y acceso con versión y auditoría', async () => {
    const { db, actor, person, access } = await setup()
    const second = createPerson(db, actor, { name: 'Luis QA', now })
    const secondAccess = createAccess(db, actor, {
      address: '10.20.10.16',
      port: 8443,
      environment: 'qa',
      now,
    })
    const assignment = create(db, actor, person.id, access.id)

    const updated = updateAssignmentDetails(db, actor, assignment.id, {
      personId: second.id,
      accessId: secondAccess.id,
      expiresOn: '2026-12-01',
      version: 1,
      now,
    })
    expect(updated).toMatchObject({
      person: { id: second.id, name: 'Luis QA' },
      access: { id: secondAccess.id },
      expiresOn: '2026-12-01',
      version: 2,
    })
    expect(listAssignmentHistory(db, assignment.id).at(-1)).toMatchObject({
      action: 'access_assignment.updated',
      before: {
        personId: person.id,
        accessId: access.id,
        expiresOn: '2026-11-20',
      },
      after: {
        personId: second.id,
        accessId: secondAccess.id,
        expiresOn: '2026-12-01',
      },
    })

    db.close()
  })

  it('rechaza versión vieja, duplicados y cambios sin diferencias', async () => {
    const { db, actor, person, access } = await setup()
    const secondAccess = createAccess(db, actor, {
      address: '10.20.10.16',
      port: 8443,
      environment: 'qa',
      now,
    })
    const first = create(db, actor, person.id, access.id)
    const second = create(db, actor, person.id, secondAccess.id)

    expect(() =>
      updateAssignmentDetails(db, actor, first.id, {
        expiresOn: '2026-12-01',
        version: 1,
        now,
      }),
    ).not.toThrow()

    expect(() =>
      updateAssignmentDetails(db, actor, first.id, {
        expiresOn: '2026-12-02',
        version: 1,
        now,
      }),
    ).toThrow(/cambió/)

    expect(() =>
      updateAssignmentDetails(db, actor, second.id, {
        accessId: access.id,
        version: second.version,
        now,
      }),
    ).toThrow(/ya tiene este acceso/)

    expect(() =>
      updateAssignmentDetails(db, actor, first.id, {
        version: 2,
        now,
      }),
    ).toThrow(/No hay cambios/)

    db.close()
  })

  it('bloquea ediciones si el acceso o el QA están inactivos', async () => {
    const { db, actor, person, access } = await setup()
    const assignment = create(db, actor, person.id, access.id)
    const inactiveAccess = updateAccessDetails(db, actor, access.id, {
      isActive: false,
      version: access.version,
      now,
    })

    expect(() =>
      updateAssignmentDetails(db, actor, assignment.id, {
        expiresOn: '2026-12-01',
        version: assignment.version,
        now,
      }),
    ).toThrow(/acceso está inactivo/)

    const reactivated = updateAccessDetails(db, actor, access.id, {
      isActive: true,
      version: inactiveAccess.version,
      now,
    })
    expect(reactivated.isActive).toBe(true)

    const inactivePerson = updatePersonDetails(db, actor, person.id, {
      isActive: false,
      version: person.version,
      now,
    })
    expect(() =>
      updateAssignmentDetails(db, actor, assignment.id, {
        expiresOn: '2026-12-01',
        version: assignment.version,
        now,
      }),
    ).toThrow(/QA está inactivo/)
    expect(inactivePerson.isActive).toBe(false)

    db.close()
  })

  it('permite corregir una fecha a pasado', async () => {
    const { db, actor, person, access } = await setup()
    const assignment = create(db, actor, person.id, access.id)
    const updated = updateAssignmentDetails(db, actor, assignment.id, {
      expiresOn: '2026-10-01',
      version: 1,
      now,
    })

    expect(updated).toMatchObject({
      state: 'expired',
      urgency: 'expired',
      daysRemaining: -18,
      version: 2,
    })

    db.close()
  })
})
