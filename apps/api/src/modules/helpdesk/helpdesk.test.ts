import { describe, expect, it } from 'vitest'
import { createTestDatabase } from '../../test/db'
import {
  attachmentDownload,
  getTicketView,
  listTicketViews,
  statusLabel,
} from './service'
import { getSyncStatus, ingestTickets, type IngestTicket } from './sync'

const now = new Date('2026-10-18T12:00:00.000Z')

function ticket(overrides: Partial<IngestTicket> = {}): IngestTicket {
  return {
    reference: 'R-100',
    subject: 'Primer ticket',
    status: 'new',
    description: 'Detalle',
    requester: 'Jesus Arratia',
    organization: 'HelpDesk_TI',
    team: 'Tecnologias',
    analyst: 'JORGE PACOMPIA',
    reportedAt: '2026-10-01',
    ...overrides,
  }
}

describe('ingesta desde el agente local', () => {
  it('crea tickets, traduce estados conocidos y ordena por fecha', () => {
    const db = createTestDatabase()
    const result = ingestTickets(
      db,
      [
        ticket(),
        ticket({
          reference: 'R-101',
          subject: 'Segundo ticket',
          status: 'assigned',
          reportedAt: '2026-10-02',
        }),
      ],
      now,
    )

    expect(result).toEqual({ created: 2, updated: 0, rejected: [] })

    const tickets = listTicketViews(db, '')
    expect(tickets.map((item) => item.reference)).toEqual(['R-101', 'R-100'])
    expect(tickets[0]?.statusLabel).toBe('Asignado')
    expect(tickets[0]?.lastSyncedAt).toBe(now.toISOString())

    db.close()
  })

  it('es idempotente por referencia y conserva la fecha de creación local', () => {
    const db = createTestDatabase()
    ingestTickets(db, [ticket()], now)
    const before = getTicketView(db, 1)

    const result = ingestTickets(
      db,
      [
        ticket({
          subject: 'Actualizado',
          status: 'resolved',
          description: 'Detalle nuevo',
        }),
      ],
      new Date('2026-10-19T12:00:00.000Z'),
    )

    expect(result).toMatchObject({ created: 0, updated: 1 })

    const after = getTicketView(db, 1)
    expect(after.subject).toBe('Actualizado')
    expect(after.statusLabel).toBe('Resuelto')
    expect(after.createdAt).toBe(before.createdAt)
    expect(after.lastSyncedAt).not.toBe(before.lastSyncedAt)

    db.close()
  })

  it('rechaza filas inválidas, duplicadas en el lote e importa las válidas', () => {
    const db = createTestDatabase()
    const result = ingestTickets(
      db,
      [
        ticket({ reference: 'NO-REF' }),
        ticket({ reference: 'R-200', subject: ' ' }),
        ticket({ reference: 'R-201', reportedAt: '2026-02-30' }),
        ticket({ reference: 'R-202' }),
        ticket({ reference: 'R-202' }),
      ],
      now,
    )

    expect(result.created).toBe(1)
    expect(result.rejected).toHaveLength(4)
    expect(listTicketViews(db, '')).toHaveLength(1)

    db.close()
  })

  it('actualiza el estado de sincronización', () => {
    const db = createTestDatabase()

    expect(getSyncStatus(db)).toMatchObject({
      status: 'never',
      createdCount: 0,
      updatedCount: 0,
    })

    ingestTickets(db, [ticket()], now)

    expect(getSyncStatus(db)).toEqual({
      status: 'success',
      lastStartedAt: now.toISOString(),
      lastFinishedAt: now.toISOString(),
      message: null,
      createdCount: 1,
      updatedCount: 0,
      rejectedCount: 0,
    })

    db.close()
  })

  it('conserva tickets que ya no vienen en una sincronización posterior', () => {
    const db = createTestDatabase()
    ingestTickets(
      db,
      [
        ticket({ reference: 'R-300', subject: 'Uno' }),
        ticket({ reference: 'R-301', subject: 'Dos' }),
      ],
      now,
    )

    ingestTickets(db, [ticket({ reference: 'R-300', subject: 'Uno actualizado' })], now)

    expect(listTicketViews(db, '').map((item) => item.reference)).toEqual([
      'R-301',
      'R-300',
    ])

    db.close()
  })
})

describe('búsqueda y presentación', () => {
  function seed(db: ReturnType<typeof createTestDatabase>) {
    ingestTickets(
      db,
      [
        ticket({
          reference: 'R-400',
          subject: 'Caso Muñoz',
          description: 'Texto con secreto',
          analyst: 'JORGE PACOMPIA',
        }),
        ticket({
          reference: 'R-401',
          subject: 'Cumplimiento al 100%',
          status: 'waiting',
          analyst: 'ANA TORRES',
          description: 'Texto con secreto',
        }),
      ],
      now,
    )
  }

  it('busca por referencia, asunto y analista; no por descripción', () => {
    const db = createTestDatabase()
    seed(db)

    expect(listTicketViews(db, 'R-400')).toHaveLength(1)
    expect(listTicketViews(db, 'MUÑOZ')).toHaveLength(1)
    expect(listTicketViews(db, 'ana torres')).toHaveLength(1)
    expect(listTicketViews(db, 'secreto')).toHaveLength(0)

    db.close()
  })

  it('conserva tildes y Ñ en la búsqueda', () => {
    const db = createTestDatabase()
    seed(db)

    expect(listTicketViews(db, 'muñoz')).toHaveLength(1)
    expect(listTicketViews(db, 'munoz')).toHaveLength(0)

    db.close()
  })

  it('trata los comodines como texto literal', () => {
    const db = createTestDatabase()
    seed(db)

    expect(listTicketViews(db, '100%')).toHaveLength(1)
    expect(listTicketViews(db, '100_')).toHaveLength(0)

    db.close()
  })

  it('muestra un estado desconocido sin inventar traducción', () => {
    const db = createTestDatabase()
    seed(db)

    expect(statusLabel('waiting')).toBe('waiting')
    expect(statusLabel('closed')).toBe('Cerrado')

    db.close()
  })

  it('devuelve 404 de dominio para un anexo inexistente', () => {
    const db = createTestDatabase()

    expect(() => attachmentDownload(db, 999)).toThrow(/anexo/)

    db.close()
  })
})
