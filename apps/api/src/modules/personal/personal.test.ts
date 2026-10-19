import { PERMISSION_KEYS } from '@qabase/shared'
import { describe, expect, it } from 'vitest'
import type { PasswordHasher } from '../../core/security/password'
import { createTestDatabase } from '../../test/db'
import type { Actor } from '../identity/actor'
import { findAccountById } from '../identity/repository'
import { createFirstAdmin } from '../identity/service'
import {
  createPerson,
  listPersonHistory,
  listPersonOptions,
  listPeopleForManagement,
  updatePersonDetails,
} from './service'
import { seedPersonal } from './seed'

const PASSWORD = 'correct horse battery staple'
const now = new Date('2026-10-18T12:00:00.000Z')

const hasher: PasswordHasher = {
  async hash(password) {
    return `fake:${password}`
  },
  async verify(passwordHash, password) {
    return passwordHash === `fake:${password}`
  },
}

async function adminActor(db: ReturnType<typeof createTestDatabase>): Promise<Actor> {
  const id = await createFirstAdmin(
    { db, hasher },
    { username: 'admin', password: PASSWORD, now },
  )
  const account = findAccountById(db, id)!
  return { id: account.id, username: account.username, permissions: [...PERMISSION_KEYS] }
}

function count(db: ReturnType<typeof createTestDatabase>): number {
  return (
    db.prepare('SELECT COUNT(*) AS total FROM personal_qa').get() as {
      total: number
    }
  ).total
}

describe('seed de Personal QA', () => {
  it('crea las 21 personas activas con sus identificadores de origen', async () => {
    const db = createTestDatabase()
    const people = listPeopleForManagement(db, {
      includeInactive: true,
      search: '',
    })

    expect(people).toHaveLength(21)
    expect(people.every((person) => person.isActive)).toBe(true)
    expect(people.map((person) => person.sourceId).sort((a, b) => a! - b!)).toEqual(
      Array.from({ length: 21 }, (_, index) => index + 1),
    )
    expect(people.some((person) => person.name === 'Maritza Natalia Villacorta Muñoz')).toBe(true)

    db.close()
  })

  it('es insert-only: no duplica ni sobrescribe nombres existentes', async () => {
    const db = createTestDatabase()
    db.prepare(
      "UPDATE personal_qa SET name = 'Nombre corregido' WHERE source_id = 1",
    ).run()

    seedPersonal(db, now)

    expect(count(db)).toBe(21)
    expect(
      db
        .prepare('SELECT name FROM personal_qa WHERE source_id = 1')
        .get(),
    ).toEqual({ name: 'Nombre corregido' })

    db.close()
  })
})

describe('listado y búsqueda', () => {
  it('filtra activos, incluye inactivos y ordena alfabéticamente', async () => {
    const db = createTestDatabase()
    const all = listPeopleForManagement(db, {
      includeInactive: false,
      search: '',
    })
    const first = all[0]!

    db.prepare('UPDATE personal_qa SET is_active = 0 WHERE id = ?').run(first.id)

    const active = listPeopleForManagement(db, {
      includeInactive: false,
      search: '',
    })
    const including = listPeopleForManagement(db, {
      includeInactive: true,
      search: '',
    })

    expect(active).toHaveLength(20)
    expect(including).toHaveLength(21)
    expect(active.some((person) => person.id === first.id)).toBe(false)

    const sorted = [...including].sort(
      (left, right) =>
        left.name.localeCompare(right.name, 'es', { sensitivity: 'base' }) ||
        left.id - right.id,
    )
    expect(including.map((person) => person.id)).toEqual(
      sorted.map((person) => person.id),
    )

    db.close()
  })

  it('busca sin distinguir mayúsculas, conservando tildes y Ñ', async () => {
    const db = createTestDatabase()

    expect(
      listPeopleForManagement(db, {
        includeInactive: true,
        search: 'MUÑOZ',
      }).map((person) => person.name),
    ).toEqual(['Maritza Natalia Villacorta Muñoz'])

    expect(
      listPeopleForManagement(db, {
        includeInactive: true,
        search: 'munoz',
      }),
    ).toHaveLength(0)

    db.close()
  })

  it('trata los comodines como texto literal', async () => {
    const db = createTestDatabase()
    const actor = await adminActor(db)
    createPerson(db, actor, { name: 'Persona 100% real', now })

    expect(
      listPeopleForManagement(db, {
        includeInactive: true,
        search: '100%',
      }).map((person) => person.name),
    ).toEqual(['Persona 100% real'])

    expect(
      listPeopleForManagement(db, {
        includeInactive: true,
        search: '100_',
      }),
    ).toHaveLength(0)

    db.close()
  })
})

describe('altas y cambios', () => {
  it('crea personas activas, permite homónimos y registra historial', async () => {
    const db = createTestDatabase()
    const actor = await adminActor(db)

    const first = createPerson(db, actor, { name: '  Persona Nueva  ', now })
    const second = createPerson(db, actor, { name: 'Persona Nueva', now })

    expect(first.name).toBe('Persona Nueva')
    expect(first.isActive).toBe(true)
    expect(first.version).toBe(1)
    expect(first.id).not.toBe(second.id)

    expect(listPersonHistory(db, first.id)[0]).toMatchObject({
      action: 'personal.created',
      actorUsername: 'admin',
      after: { name: 'Persona Nueva', isActive: true },
    })

    db.close()
  })

  it('renombra con versión, desactiva y reactiva', async () => {
    const db = createTestDatabase()
    const actor = await adminActor(db)
    const person = createPerson(db, actor, { name: 'Persona', now })

    const renamed = updatePersonDetails(db, actor, person.id, {
      name: 'Persona Renombrada',
      version: person.version,
      now,
    })
    expect(renamed.name).toBe('Persona Renombrada')
    expect(renamed.version).toBe(2)

    expect(() =>
      updatePersonDetails(db, actor, person.id, {
        name: 'Versión vieja',
        version: person.version,
        now,
      }),
    ).toThrow(/cambió/)

    const deactivated = updatePersonDetails(db, actor, person.id, {
      isActive: false,
      version: renamed.version,
      now,
    })
    expect(deactivated.isActive).toBe(false)

    const reactivated = updatePersonDetails(db, actor, person.id, {
      isActive: true,
      version: deactivated.version,
      now,
    })
    expect(reactivated.isActive).toBe(true)

    expect(
      listPersonHistory(db, person.id).map((event) => event.action),
    ).toEqual([
      'personal.created',
      'personal.renamed',
      'personal.deactivated',
      'personal.reactivated',
    ])

    db.close()
  })

  it('rechaza un cambio sin diferencias y un nombre vacío', async () => {
    const db = createTestDatabase()
    const actor = await adminActor(db)
    const person = createPerson(db, actor, { name: 'Persona', now })

    expect(() =>
      updatePersonDetails(db, actor, person.id, {
        name: 'Persona',
        version: person.version,
        now,
      }),
    ).toThrow(/No hay cambios/)

    expect(() =>
      createPerson(db, actor, { name: '   ', now }),
    ).toThrow(/entre 1 y 200/)

    db.close()
  })
})

describe('opciones para registros', () => {
  it('devuelve solo activas por defecto e incluye inactivas si se pide', async () => {
    const db = createTestDatabase()
    const actor = await adminActor(db)
    const person = createPerson(db, actor, { name: 'Persona Inactiva', now })
    updatePersonDetails(db, actor, person.id, {
      isActive: false,
      version: person.version,
      now,
    })

    expect(listPersonOptions(db, false).some((option) => option.id === person.id)).toBe(false)
    expect(listPersonOptions(db, true).some((option) => option.id === person.id)).toBe(true)

    db.close()
  })
})
