import type { DatabaseSync } from 'node:sqlite'
import { insertAuditEvent, listAuditEvents } from '../../core/audit'
import { conflict, invalidInput, notFound } from '../../core/errors'
import { inTransaction } from '../../core/transaction'
import type { Actor } from '../identity/actor'
import {
  findPersonById,
  insertPerson,
  listPeople,
  updatePerson,
  type PersonRow,
} from './repository'

export type Person = {
  id: number
  sourceId: number | null
  name: string
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export type PersonOption = {
  id: number
  name: string
  isActive: boolean
}

export type HistoryEvent = {
  occurredAt: string
  actorUsername: string | null
  channel: 'app' | 'local'
  action: string
  before: unknown
  after: unknown
}

function toPerson(row: PersonRow): Person {
  return {
    id: row.id,
    sourceId: row.sourceId,
    name: row.name,
    isActive: row.isActive === 1,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function normalizeName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length < 1 || trimmed.length > 200) {
    throw invalidInput('El nombre debe tener entre 1 y 200 caracteres.')
  }
  return trimmed
}

function audit(
  db: DatabaseSync,
  actor: Actor,
  action: string,
  personId: number,
  now: Date,
  before?: unknown,
  after?: unknown,
): void {
  insertAuditEvent(
    db,
    {
      actorAccountId: actor.id,
      actorUsername: actor.username,
      channel: 'app',
      module: 'personal',
      entityType: 'personal_qa',
      entityId: String(personId),
      action,
      before,
      after,
    },
    now.toISOString(),
  )
}

export function listPeopleForManagement(
  db: DatabaseSync,
  input: { includeInactive: boolean; search: string },
): Person[] {
  return listPeople(db, input).map(toPerson)
}

export function listPersonOptions(
  db: DatabaseSync,
  includeInactive: boolean,
): PersonOption[] {
  return listPeople(db, { includeInactive, search: '' }).map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.isActive === 1,
  }))
}

export function createPerson(
  db: DatabaseSync,
  actor: Actor,
  input: { name: string; now: Date },
): Person {
  const name = normalizeName(input.name)
  const timestamp = input.now.toISOString()

  return inTransaction(db, () => {
    const personId = insertPerson(db, { name, now: timestamp })
    audit(db, actor, 'personal.created', personId, input.now, undefined, {
      name,
      isActive: true,
    })
    return toPerson(findPersonById(db, personId)!)
  })
}

export function updatePersonDetails(
  db: DatabaseSync,
  actor: Actor,
  personId: number,
  input: {
    name?: string
    isActive?: boolean
    version: number
    now: Date
  },
): Person {
  const person = findPersonById(db, personId)
  if (!person) {
    throw notFound('La persona no existe.')
  }
  if (input.name === undefined && input.isActive === undefined) {
    throw invalidInput('No hay cambios para guardar.')
  }

  const name =
    input.name === undefined ? person.name : normalizeName(input.name)
  const isActive =
    input.isActive === undefined ? person.isActive === 1 : input.isActive

  if (name === person.name && isActive === (person.isActive === 1)) {
    throw invalidInput('No hay cambios para guardar.')
  }

  return inTransaction(db, () => {
    const updated = updatePerson(db, {
      personId,
      name,
      isActive,
      expectedVersion: input.version,
      now: input.now.toISOString(),
    })
    if (!updated) {
      throw conflict()
    }

    if (name !== person.name) {
      audit(db, actor, 'personal.renamed', personId, input.now, {
        name: person.name,
      }, { name })
    }

    if (isActive !== (person.isActive === 1)) {
      audit(
        db,
        actor,
        isActive ? 'personal.reactivated' : 'personal.deactivated',
        personId,
        input.now,
        { isActive: person.isActive === 1 },
        { isActive },
      )
    }

    return toPerson(findPersonById(db, personId)!)
  })
}

export function listPersonHistory(
  db: DatabaseSync,
  personId: number,
): HistoryEvent[] {
  return listAuditEvents(db, 'personal_qa', String(personId)).map((row) => ({
    occurredAt: row.occurred_at,
    actorUsername: row.actor_username,
    channel: row.channel,
    action: row.action,
    before: row.before_json === null ? null : JSON.parse(row.before_json),
    after: row.after_json === null ? null : JSON.parse(row.after_json),
  }))
}
