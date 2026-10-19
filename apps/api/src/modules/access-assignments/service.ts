import {
  assignmentTiming,
  normalizeSearchText,
  peruToday,
} from '@qabase/shared'
import type { DatabaseSync } from 'node:sqlite'
import { insertAuditEvent, listAuditEvents } from '../../core/audit'
import { conflict, invalidInput, notFound } from '../../core/errors'
import { inTransaction } from '../../core/transaction'
import { findAccessById } from '../accesses/repository'
import type {
  AccessEnvironment,
  AccessProtocol,
} from '../accesses/validation'
import type { Actor } from '../identity/actor'
import {
  findPersonById,
  listPeople,
  type PersonRow,
} from '../personal/repository'
import {
  findAssignmentById,
  findAssignmentByKey,
  insertAssignment,
  listAllAssignments,
  listAssignmentsByAccess,
  listAssignmentsByPerson,
  updateAssignment,
  type AssignmentRow,
} from './repository'
import {
  validateCreateExpiresOn,
  validateEntityId,
  validateExpiresOn,
  validateVersion,
} from './validation'

export type AssignmentView = {
  id: number
  person: {
    id: number
    name: string
    isActive: boolean
  }
  access: {
    id: number
    address: string
    port: number
    portEnd: number
    environment: AccessEnvironment
    protocol: AccessProtocol | null
    detail: string | null
    applications: string | null
    urls: string | null
    isActive: boolean
    version: number
    createdAt: string
    updatedAt: string
  }
  expiresOn: string
  state: 'current' | 'expiring' | 'expired'
  urgency: 'ok' | 'warning' | 'critical' | 'expired'
  daysRemaining: number
  version: number
  createdAt: string
  updatedAt: string
}

export type AssignmentCounts = {
  current: number
  expiring: number
  expired: number
  total: number
}

export type QaUrgency = 'critical' | 'warning' | 'ok' | 'expired' | 'none'

export type QaOverview = {
  person: {
    id: number
    name: string
    isActive: boolean
  }
  counts: AssignmentCounts
  nextExpiry: string | null
  urgency: QaUrgency
}

export type OverviewResponse = {
  kpis: {
    qasWithAccess: number
    current: number
    expiring: number
    expired: number
  }
  qas: QaOverview[]
}

export type PersonAssignmentsResponse = {
  person: {
    id: number
    name: string
    isActive: boolean
  }
  counts: AssignmentCounts
  current: AssignmentView[]
  expired: AssignmentView[]
}

export type AccessAssignmentsResponse = {
  access: {
    id: number
    address: string
    port: number
    portEnd: number
    environment: AccessEnvironment
    protocol: AccessProtocol | null
    detail: string | null
    applications: string | null
    urls: string | null
    isActive: boolean
    version: number
    createdAt: string
    updatedAt: string
  }
  counts: AssignmentCounts
  current: AssignmentView[]
  expired: AssignmentView[]
}

export type AssignmentQuery = {
  q?: string
  filter?: string
  sort?: string
}

export type HistoryEvent = {
  occurredAt: string
  actorUsername: string | null
  channel: 'app' | 'local'
  action: string
  before: unknown
  after: unknown
}

function toView(row: AssignmentRow, today: string): AssignmentView {
  const timing = assignmentTiming(row.expiresOn, today)
  return {
    id: row.id,
    person: {
      id: row.personId,
      name: row.personName,
      isActive: row.personIsActive === 1,
    },
    access: {
      id: row.accessId,
      address: row.accessAddress,
      port: row.accessPort,
      portEnd: row.accessPortEnd,
      environment: row.accessEnvironment,
      protocol: row.accessProtocol,
      detail: row.accessDetail,
      applications: row.accessApplications,
      urls: row.accessUrls,
      isActive: row.accessIsActive === 1,
      version: row.accessVersion,
      createdAt: row.accessCreatedAt,
      updatedAt: row.accessUpdatedAt,
    },
    expiresOn: row.expiresOn,
    ...timing,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function countsOf(views: AssignmentView[]): AssignmentCounts {
  return {
    current: views.filter((view) => view.state === 'current').length,
    expiring: views.filter((view) => view.state === 'expiring').length,
    expired: views.filter((view) => view.state === 'expired').length,
    total: views.length,
  }
}

function groupViews(views: AssignmentView[]): {
  current: AssignmentView[]
  expired: AssignmentView[]
} {
  return {
    current: views
      .filter((view) => view.state !== 'expired')
      .sort(
        (left, right) =>
          left.expiresOn.localeCompare(right.expiresOn) || left.id - right.id,
      ),
    expired: views
      .filter((view) => view.state === 'expired')
      .sort(
        (left, right) =>
          right.expiresOn.localeCompare(left.expiresOn) || right.id - left.id,
      ),
  }
}

function urgencyOf(views: AssignmentView[]): QaUrgency {
  const active = views.filter((view) => view.state !== 'expired')
  if (active.some((view) => view.urgency === 'critical')) {
    return 'critical'
  }
  if (active.some((view) => view.urgency === 'warning')) {
    return 'warning'
  }
  if (active.some((view) => view.urgency === 'ok')) {
    return 'ok'
  }
  if (views.some((view) => view.state === 'expired')) {
    return 'expired'
  }
  return 'none'
}

function nextExpiryOf(views: AssignmentView[]): string | null {
  const dates = views
    .filter((view) => view.state !== 'expired')
    .map((view) => view.expiresOn)
  return dates.length === 0 ? null : dates.sort()[0]!
}

function toPerson(person: PersonRow): {
  id: number
  name: string
  isActive: boolean
} {
  return {
    id: person.id,
    name: person.name,
    isActive: person.isActive === 1,
  }
}

function snapshot(row: AssignmentRow): {
  personId: number
  personName: string
  accessId: number
  accessLabel: string
  expiresOn: string
} {
  return {
    personId: row.personId,
    personName: row.personName,
    accessId: row.accessId,
    accessLabel:
      row.accessPortEnd === row.accessPort
        ? `${row.accessAddress}:${row.accessPort}`
        : `${row.accessAddress}:${row.accessPort}-${row.accessPortEnd}`,
    expiresOn: row.expiresOn,
  }
}

function audit(
  db: DatabaseSync,
  actor: Actor,
  action: string,
  assignmentId: number,
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
      module: 'accesses',
      entityType: 'access_assignment',
      entityId: String(assignmentId),
      action,
      before,
      after,
    },
    now.toISOString(),
  )
}

function parseQuery(query: AssignmentQuery): {
  q: string
  filter:
    | 'all'
    | 'withAccess'
    | 'current'
    | 'expiring'
    | 'expired'
    | 'none'
    | 'inactive'
  sort: 'urgency' | 'name'
} {
  const filter = query.filter ?? 'all'
  if (
    filter !== 'all' &&
    filter !== 'withAccess' &&
    filter !== 'current' &&
    filter !== 'expiring' &&
    filter !== 'expired' &&
    filter !== 'none' &&
    filter !== 'inactive'
  ) {
    throw invalidInput('El filtro de la lista no es válido.')
  }

  const sort = query.sort ?? 'urgency'
  if (sort !== 'urgency' && sort !== 'name') {
    throw invalidInput('El orden de la lista no es válido.')
  }

  return { q: query.q ?? '', filter, sort }
}

function urgencyRank(urgency: QaUrgency): number {
  switch (urgency) {
    case 'critical':
      return 0
    case 'warning':
      return 1
    case 'ok':
      return 2
    case 'expired':
      return 3
    case 'none':
      return 4
  }
}

function compareName(left: QaOverview, right: QaOverview): number {
  return (
    left.person.name.localeCompare(right.person.name, 'es', {
      sensitivity: 'base',
    }) || left.person.id - right.person.id
  )
}

export function listQaOverview(
  db: DatabaseSync,
  query: AssignmentQuery,
  now: Date,
): OverviewResponse {
  const { q, filter, sort } = parseQuery(query)
  const today = peruToday(now)
  const people = listPeople(db, { includeInactive: true, search: '' })
  const rows = listAllAssignments(db)
  const viewsByPerson = new Map<number, AssignmentView[]>()

  for (const row of rows) {
    const views = viewsByPerson.get(row.personId) ?? []
    views.push(toView(row, today))
    viewsByPerson.set(row.personId, views)
  }

  const activePeople = people.filter((person) => person.isActive === 1)
  const activeIds = new Set(activePeople.map((person) => person.id))
  const activeViews = [...viewsByPerson.entries()]
    .filter(([personId]) => activeIds.has(personId))
    .flatMap(([, views]) => views)

  const kpis = {
    qasWithAccess: activePeople.filter((person) => {
      const views = viewsByPerson.get(person.id) ?? []
      return views.some((view) => view.state !== 'expired')
    }).length,
    current: activeViews.filter((view) => view.state === 'current').length,
    expiring: activeViews.filter((view) => view.state === 'expiring').length,
    expired: activeViews.filter((view) => view.state === 'expired').length,
  }

  const search = normalizeSearchText(q.trim())
  const qas = people
    .filter((person) => {
      if (filter === 'inactive') {
        return person.isActive === 0
      }
      return person.isActive === 1
    })
    .map((person): QaOverview => {
      const views = viewsByPerson.get(person.id) ?? []
      return {
        person: toPerson(person),
        counts: countsOf(views),
        nextExpiry: nextExpiryOf(views),
        urgency: urgencyOf(views),
      }
    })
    .filter((overview) => {
      if (search !== '') {
        return normalizeSearchText(overview.person.name).includes(search)
      }
      return true
    })
    .filter((overview) => {
      const counts = overview.counts
      switch (filter) {
        case 'all':
        case 'inactive':
          return true
        case 'withAccess':
          return counts.current + counts.expiring > 0
        case 'current':
          return counts.current > 0
        case 'expiring':
          return counts.expiring > 0
        case 'expired':
          return counts.expired > 0
        case 'none':
          return counts.total === 0
      }
    })

  qas.sort((left, right) => {
    if (sort === 'name') {
      return compareName(left, right)
    }
    return urgencyRank(left.urgency) - urgencyRank(right.urgency) ||
      compareName(left, right)
  })

  return { kpis, qas }
}

export function listPersonAssignments(
  db: DatabaseSync,
  personId: number,
  now: Date,
): PersonAssignmentsResponse {
  const person = findPersonById(db, validateEntityId(personId, 'QA'))
  if (!person) {
    throw notFound('El QA no existe.')
  }

  const today = peruToday(now)
  const views = listAssignmentsByPerson(db, personId).map((row) =>
    toView(row, today),
  )
  const groups = groupViews(views)

  return {
    person: toPerson(person),
    counts: countsOf(views),
    ...groups,
  }
}

export function listAccessAssignments(
  db: DatabaseSync,
  accessId: number,
  now: Date,
): AccessAssignmentsResponse {
  const access = findAccessById(db, validateEntityId(accessId, 'Acceso'))
  if (!access) {
    throw notFound('El acceso no existe.')
  }

  const today = peruToday(now)
  const views = listAssignmentsByAccess(db, accessId).map((row) =>
    toView(row, today),
  )
  const groups = groupViews(views)

  return {
    access: {
      id: access.id,
      address: access.address,
      port: access.port,
      portEnd: access.portEnd,
      environment: access.environment,
      protocol: access.protocol,
      detail: access.detail,
      applications: access.applications,
      urls: access.urls,
      isActive: access.isActive === 1,
      version: access.version,
      createdAt: access.createdAt,
      updatedAt: access.updatedAt,
    },
    counts: countsOf(views),
    ...groups,
  }
}

export function createAssignment(
  db: DatabaseSync,
  actor: Actor,
  input: {
    personId: number
    accessId: number
    expiresOn: string
    now: Date
  },
): AssignmentView {
  const personId = validateEntityId(input.personId, 'QA')
  const accessId = validateEntityId(input.accessId, 'Acceso')
  const today = peruToday(input.now)
  const expiresOn = validateCreateExpiresOn(input.expiresOn, today)

  const person = findPersonById(db, personId)
  if (!person) {
    throw notFound('El QA no existe.')
  }
  if (person.isActive !== 1) {
    throw conflict('El QA está inactivo y no admite nuevas asignaciones.')
  }

  const access = findAccessById(db, accessId)
  if (!access) {
    throw notFound('El acceso no existe.')
  }
  if (access.isActive !== 1) {
    throw conflict('El acceso está inactivo y no admite nuevas asignaciones.')
  }

  if (findAssignmentByKey(db, { personId, accessId })) {
    throw conflict('El QA ya tiene este acceso asignado.')
  }

  const timestamp = input.now.toISOString()

  try {
    return inTransaction(db, () => {
      const assignmentId = insertAssignment(db, {
        personId,
        accessId,
        expiresOn,
        now: timestamp,
      })
      const row = findAssignmentById(db, assignmentId)!
      audit(
        db,
        actor,
        'access_assignment.created',
        assignmentId,
        input.now,
        undefined,
        snapshot(row),
      )
      return toView(row, today)
    })
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed: access_assignments')) {
      throw conflict('El QA ya tiene este acceso asignado.')
    }
    throw error
  }
}

export function updateAssignmentDetails(
  db: DatabaseSync,
  actor: Actor,
  assignmentId: number,
  input: {
    personId?: number
    accessId?: number
    expiresOn?: string
    version: number
    now: Date
  },
): AssignmentView {
  const existing = findAssignmentById(
    db,
    validateEntityId(assignmentId, 'Asignación'),
  )
  if (!existing) {
    throw notFound('La asignación no existe.')
  }

  const version = validateVersion(input.version)
  const hasChanges =
    input.personId !== undefined ||
    input.accessId !== undefined ||
    input.expiresOn !== undefined

  if (!hasChanges) {
    throw invalidInput('No hay cambios para guardar.')
  }

  const personId =
    input.personId === undefined
      ? existing.personId
      : validateEntityId(input.personId, 'QA')
  const accessId =
    input.accessId === undefined
      ? existing.accessId
      : validateEntityId(input.accessId, 'Acceso')
  const expiresOn =
    input.expiresOn === undefined
      ? existing.expiresOn
      : validateExpiresOn(input.expiresOn)

  if (personId === existing.personId && accessId === existing.accessId &&
      expiresOn === existing.expiresOn) {
    throw invalidInput('No hay cambios para guardar.')
  }

  if (existing.personIsActive !== 1) {
    throw conflict('El QA está inactivo. Reactívalo para editar la asignación.')
  }
  if (existing.accessIsActive !== 1) {
    throw conflict(
      'El acceso está inactivo. Reactívalo para editar la asignación.',
    )
  }

  const person = findPersonById(db, personId)
  if (!person) {
    throw notFound('El QA no existe.')
  }
  if (person.isActive !== 1) {
    throw conflict('El QA está inactivo y no admite asignaciones.')
  }

  const access = findAccessById(db, accessId)
  if (!access) {
    throw notFound('El acceso no existe.')
  }
  if (access.isActive !== 1) {
    throw conflict('El acceso está inactivo y no admite asignaciones.')
  }

  if (
    findAssignmentByKey(db, {
      personId,
      accessId,
      exceptId: assignmentId,
    })
  ) {
    throw conflict('El QA ya tiene este acceso asignado.')
  }

  const before = snapshot(existing)
  const timestamp = input.now.toISOString()

  try {
    return inTransaction(db, () => {
      const updated = updateAssignment(db, {
        assignmentId,
        personId,
        accessId,
        expiresOn,
        expectedVersion: version,
        now: timestamp,
      })
      if (!updated) {
        throw conflict()
      }

      const row = findAssignmentById(db, assignmentId)!
      audit(
        db,
        actor,
        'access_assignment.updated',
        assignmentId,
        input.now,
        before,
        snapshot(row),
      )
      return toView(row, peruToday(input.now))
    })
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed: access_assignments')) {
      throw conflict('El QA ya tiene este acceso asignado.')
    }
    throw error
  }
}

export function listAssignmentHistory(
  db: DatabaseSync,
  assignmentId: number,
): HistoryEvent[] {
  if (!findAssignmentById(db, validateEntityId(assignmentId, 'Asignación'))) {
    throw notFound('La asignación no existe.')
  }

  return listAuditEvents(db, 'access_assignment', String(assignmentId)).map(
    (row) => ({
      occurredAt: row.occurred_at,
      actorUsername: row.actor_username,
      channel: row.channel,
      action: row.action,
      before: row.before_json === null ? null : JSON.parse(row.before_json),
      after: row.after_json === null ? null : JSON.parse(row.after_json),
    }),
  )
}
