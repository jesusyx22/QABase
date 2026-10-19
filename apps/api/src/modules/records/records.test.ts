import { PERMISSION_KEYS } from '@qabase/shared'
import { describe, expect, it } from 'vitest'
import type { PasswordHasher } from '../../core/security/password'
import { createTestDatabase } from '../../test/db'
import type { Actor } from '../identity/actor'
import { findAccountById } from '../identity/repository'
import { createFirstAdmin } from '../identity/service'
import { listPeople } from '../personal/repository'
import { insertRecord } from './repository'
import { seedRecords } from './seed'
import {
  annulRecord,
  createRecord,
  listImpactLevels,
  listRecordHistory,
  listRecordsPage,
  toLocalDateString,
  updateRecord,
} from './service'

const PASSWORD = 'correct horse battery staple'
const now = new Date('2026-10-18T12:00:00.000Z')
const today = toLocalDateString(now)

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
  const person = listPeople(db, { includeInactive: true, search: '' })[0]!
  const otherPerson = listPeople(db, { includeInactive: true, search: '' })[1]!
  return { db, actor, person, otherPerson }
}

function create(
  db: ReturnType<typeof createTestDatabase>,
  actor: Actor,
  personId: number,
  overrides: Partial<{
    type: string
    eventDate: string
    level: number
    detail: string
  }> = {},
) {
  return createRecord(db, actor, {
    qaId: personId,
    type: overrides.type ?? 'merito',
    eventDate: overrides.eventDate ?? today,
    level: overrides.level ?? 3,
    detail: overrides.detail ?? 'Detalle del hecho',
    now,
    today,
  })
}

describe('escala de impacto', () => {
  it('crea las diez combinaciones con etiquetas propias por tipo', async () => {
    const { db } = await setup()
    const levels = listImpactLevels(db)

    expect(levels).toHaveLength(10)
    expect(levels.find((level) => level.type === 'merito' && level.level === 5)?.label).toBe('Excepcional')
    expect(levels.find((level) => level.type === 'incidencia' && level.level === 5)?.label).toBe('Crítico')

    seedRecords(db)
    expect(listImpactLevels(db)).toHaveLength(10)

    db.close()
  })
})

describe('alta de registros', () => {
  it('crea un mérito vigente con versión 1 y auditoría', async () => {
    const { db, actor, person } = await setup()
    const record = create(db, actor, person.id, {
      type: 'merito',
      level: 3,
      detail: '  Previno una regresión  ',
    })

    expect(record.status).toBe('vigente')
    expect(record.version).toBe(1)
    expect(record.detail).toBe('Previno una regresión')
    expect(record.levelLabel).toBe('Relevante')
    expect(record.qa.id).toBe(person.id)

    expect(listRecordHistory(db, record.id)[0]).toMatchObject({
      action: 'record.created',
      actorUsername: 'admin',
    })

    db.close()
  })

  it('rechaza fechas inválidas o futuras, nivel y tipo inválidos y detalle vacío', async () => {
    const { db, actor, person } = await setup()
    const future = toLocalDateString(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000))

    expect(() => create(db, actor, person.id, { eventDate: '2026-02-30' })).toThrow(/fecha/)
    expect(() => create(db, actor, person.id, { eventDate: future })).toThrow(/futura/)
    expect(() => create(db, actor, person.id, { level: 0 })).toThrow(/nivel/)
    expect(() => create(db, actor, person.id, { level: 6 })).toThrow(/nivel/)
    expect(() => create(db, actor, person.id, { type: 'otro' })).toThrow(/tipo/)
    expect(() => create(db, actor, person.id, { detail: '   ' })).toThrow(/detalle/)

    db.close()
  })

  it('rechaza un QA inexistente o inactivo', async () => {
    const { db, actor, person } = await setup()
    db.prepare('UPDATE personal_qa SET is_active = 0 WHERE id = ?').run(person.id)

    expect(() => create(db, actor, person.id)).toThrow(/QA activo/)
    expect(() => create(db, actor, 9999)).toThrow(/QA activo/)

    db.close()
  })
})

describe('edición', () => {
  it('edita con la versión vigente y conserva antes/después', async () => {
    const { db, actor, person, otherPerson } = await setup()
    const record = create(db, actor, person.id, { level: 2 })

    const updated = updateRecord(db, actor, record.id, {
      qaId: otherPerson.id,
      type: 'incidencia',
      level: 5,
      detail: 'Detalle corregido',
      version: record.version,
      now,
      today,
    })

    expect(updated.version).toBe(2)
    expect(updated.qa.id).toBe(otherPerson.id)
    expect(updated.type).toBe('incidencia')
    expect(updated.levelLabel).toBe('Crítico')

    expect(listRecordHistory(db, record.id).at(-1)).toMatchObject({
      action: 'record.updated',
      before: { qaId: person.id, type: 'merito', level: 2 },
      after: { qaId: otherPerson.id, type: 'incidencia', level: 5 },
    })

    db.close()
  })

  it('rechaza una versión vieja y un registro anulado', async () => {
    const { db, actor, person } = await setup()
    const record = create(db, actor, person.id)
    const updated = updateRecord(db, actor, record.id, {
      detail: 'Nuevo detalle',
      version: record.version,
      now,
      today,
    })

    expect(() =>
      updateRecord(db, actor, record.id, {
        detail: 'Versión vieja',
        version: record.version,
        now,
        today,
      }),
    ).toThrow(/cambió/)

    annulRecord(db, actor, record.id, {
      reason: 'Motivo válido',
      version: updated.version,
      confirm: true,
      now,
    })

    expect(() =>
      updateRecord(db, actor, record.id, {
        detail: 'No permitido',
        version: updated.version + 1,
        now,
        today,
      }),
    ).toThrow(/anulado/)

    db.close()
  })

  it('permite conservar un QA inactivo y editar el detalle', async () => {
    const { db, actor, person } = await setup()
    const record = create(db, actor, person.id)
    db.prepare('UPDATE personal_qa SET is_active = 0 WHERE id = ?').run(person.id)

    const updated = updateRecord(db, actor, record.id, {
      detail: 'Corrección sobre QA inactivo',
      version: record.version,
      now,
      today,
    })
    expect(updated.qa.isActive).toBe(false)
    expect(updated.detail).toBe('Corrección sobre QA inactivo')

    db.close()
  })

  it('rechaza cambiar a un QA inactivo', async () => {
    const { db, actor, person, otherPerson } = await setup()
    const record = create(db, actor, person.id)
    db.prepare('UPDATE personal_qa SET is_active = 0 WHERE id = ?').run(otherPerson.id)

    expect(() =>
      updateRecord(db, actor, record.id, {
        qaId: otherPerson.id,
        version: record.version,
        now,
        today,
      }),
    ).toThrow(/QA activo/)

    db.close()
  })
})

describe('anulación', () => {
  it('exige confirmación y motivo, y no cuenta en totales', async () => {
    const { db, actor, person } = await setup()
    const record = create(db, actor, person.id, { level: 4 })

    expect(() =>
      annulRecord(db, actor, record.id, {
        reason: 'Motivo',
        version: record.version,
        confirm: false,
        now,
      }),
    ).toThrow(/confirmación/)

    expect(() =>
      annulRecord(db, actor, record.id, {
        reason: '   ',
        version: record.version,
        confirm: true,
        now,
      }),
    ).toThrow(/motivo/)

    const annulled = annulRecord(db, actor, record.id, {
      reason: '  Motivo real  ',
      version: record.version,
      confirm: true,
      now,
    })

    expect(annulled.status).toBe('anulado')
    expect(annulled.annulReason).toBe('Motivo real')
    expect(annulled.version).toBe(2)

    const page = listRecordsPage(db, { includeAnnulled: true }, now)
    expect(page.totals.merits).toEqual({ count: 0, points: 0 })
    expect(page.byQa.find((row) => row.id === person.id)?.merits).toEqual({
      count: 0,
      points: 0,
    })

    expect(() =>
      annulRecord(db, actor, record.id, {
        reason: 'Otra vez',
        version: annulled.version,
        confirm: true,
        now,
      }),
    ).toThrow(/ya está anulado/)

    db.close()
  })

  it('permite anular un registro de una persona inactiva', async () => {
    const { db, actor, person } = await setup()
    const record = create(db, actor, person.id)
    db.prepare('UPDATE personal_qa SET is_active = 0 WHERE id = ?').run(person.id)

    const annulled = annulRecord(db, actor, record.id, {
      reason: 'Hecho histórico',
      version: record.version,
      confirm: true,
      now,
    })
    expect(annulled.status).toBe('anulado')

    db.close()
  })
})

describe('consultas', () => {
  it('usa el mes local actual por defecto', async () => {
    const { db, actor, person } = await setup()
    create(db, actor, person.id, { detail: 'Este mes' })
    create(db, actor, person.id, {
      detail: 'Mes anterior',
      eventDate: toLocalDateString(
        new Date(now.getFullYear(), now.getMonth() - 1, 15),
      ),
    })

    const page = listRecordsPage(db, {}, now)
    expect(page.total).toBe(1)
    expect(page.items[0]?.detail).toBe('Este mes')

    const all = listRecordsPage(db, { all: true }, now)
    expect(all.total).toBe(2)

    db.close()
  })

  it('combina filtros y busca texto conservando tildes y Ñ', async () => {
    const { db, actor, person, otherPerson } = await setup()
    create(db, actor, person.id, {
      type: 'merito',
      level: 3,
      detail: 'Trabajo con Muñoz',
    })
    create(db, actor, person.id, {
      type: 'incidencia',
      level: 3,
      detail: 'Otra cosa',
    })
    create(db, actor, otherPerson.id, {
      type: 'merito',
      level: 3,
      detail: 'Muñoz en otro equipo',
    })

    const byText = listRecordsPage(db, { text: 'MUÑOZ' }, now)
    expect(byText.total).toBe(2)

    expect(listRecordsPage(db, { text: 'munoz' }, now).total).toBe(0)

    const combined = listRecordsPage(
      db,
      { qaId: person.id, type: 'merito', level: 3, text: 'Muñoz' },
      now,
    )
    expect(combined.total).toBe(1)
    expect(combined.items[0]?.detail).toBe('Trabajo con Muñoz')

    db.close()
  })

  it('trata los comodines como texto literal', async () => {
    const { db, actor, person } = await setup()
    create(db, actor, person.id, { detail: 'Cumplimiento al 100%' })

    expect(listRecordsPage(db, { text: '100%' }, now).total).toBe(1)
    expect(listRecordsPage(db, { text: '100_' }, now).total).toBe(0)

    db.close()
  })

  it('pagina sin alterar totales ni tabla por QA', async () => {
    const { db, person } = await setup()
    for (let index = 0; index < 26; index += 1) {
      insertRecord(db, {
        qaId: person.id,
        type: 'merito',
        eventDate: today,
        level: 1,
        detail: `Registro ${index}`,
        now: new Date(now.getTime() + index).toISOString(),
      })
    }

    const first = listRecordsPage(db, { includeAnnulled: false }, now)
    expect(first.total).toBe(26)
    expect(first.items).toHaveLength(25)
    expect(first.totals.merits).toEqual({ count: 26, points: 26 })
    expect(first.byQa).toHaveLength(21)
    expect(first.byQa.find((row) => row.id === person.id)?.merits).toEqual({
      count: 26,
      points: 26,
    })

    const second = listRecordsPage(db, { page: 2 }, now)
    expect(second.items).toHaveLength(1)
    expect(second.total).toBe(26)

    db.close()
  })

  it('incluye anulados solo cuando se pide y mantiene totales en vigentes', async () => {
    const { db, actor, person } = await setup()
    const active = create(db, actor, person.id, { detail: 'Vigente' })
    const annulled = create(db, actor, person.id, { detail: 'Anulado' })
    annulRecord(db, actor, annulled.id, {
      reason: 'Motivo',
      version: annulled.version,
      confirm: true,
      now,
    })

    const without = listRecordsPage(db, { includeAnnulled: false }, now)
    expect(without.total).toBe(1)
    expect(without.items[0]?.id).toBe(active.id)

    const withAnnulled = listRecordsPage(db, { includeAnnulled: true }, now)
    expect(withAnnulled.total).toBe(2)
    expect(withAnnulled.totals.merits.count).toBe(1)
    expect(
      withAnnulled.byQa.find((row) => row.id === person.id)?.merits.count,
    ).toBe(1)

    db.close()
  })

  it('etiqueta a las personas inactivas en la tabla por QA', async () => {
    const { db, person } = await setup()
    db.prepare('UPDATE personal_qa SET is_active = 0 WHERE id = ?').run(person.id)

    const page = listRecordsPage(db, {}, now)
    expect(page.byQa.find((row) => row.id === person.id)?.isActive).toBe(false)

    db.close()
  })
})

describe('validaciones de fecha y consulta', () => {
  it('rechaza rangos invertidos y fechas inválidas', async () => {
    const { db } = await setup()

    expect(() =>
      listRecordsPage(db, { from: '2026-10-10', to: '2026-10-01' }, now),
    ).toThrow(/invertido/)

    expect(() =>
      listRecordsPage(db, { from: '2026-02-30' }, now),
    ).toThrow(/desde/)

    db.close()
  })

  it('valida página y tamaño', async () => {
    const { db } = await setup()

    expect(() => listRecordsPage(db, { page: 0 }, now)).toThrow(/página/)
    expect(() =>
      listRecordsPage(db, { pageSize: 30 }, now),
    ).toThrow(/tamaño/)

    db.close()
  })
})
