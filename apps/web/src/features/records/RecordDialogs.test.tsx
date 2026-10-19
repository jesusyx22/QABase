import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnnulRecordDialog } from './AnnulRecordDialog'
import { RecordFormDialog } from './RecordFormDialog'
import { RecordHistoryDialog } from './RecordHistoryDialog'
import type { ImpactLevel, RecordView } from './types'

type MockResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

function jsonResponse(body: unknown, status = 200): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }
}

const levels: ImpactLevel[] = [
  { type: 'merito', level: 1, label: 'Menor', description: '' },
  { type: 'merito', level: 2, label: 'Moderado', description: '' },
  { type: 'merito', level: 3, label: 'Relevante', description: '' },
  { type: 'merito', level: 4, label: 'Alto', description: '' },
  { type: 'merito', level: 5, label: 'Excepcional', description: '' },
  { type: 'incidencia', level: 1, label: 'Menor', description: '' },
  { type: 'incidencia', level: 2, label: 'Moderado', description: '' },
  { type: 'incidencia', level: 3, label: 'Relevante', description: '' },
  { type: 'incidencia', level: 4, label: 'Alto', description: '' },
  { type: 'incidencia', level: 5, label: 'Crítico', description: '' },
]

const record: RecordView = {
  id: 10,
  qa: { id: 2, name: 'Beto Mamani', isActive: false },
  type: 'merito',
  eventDate: '2026-10-10',
  level: 3,
  levelLabel: 'Relevante',
  detail: 'Previno una regresión en la entrega',
  status: 'vigente',
  version: 1,
  createdAt: '2026-10-10T15:00:00.000Z',
  updatedAt: '2026-10-10T15:00:00.000Z',
  annulledAt: null,
  annulReason: null,
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('RecordFormDialog', () => {
  it('envía la versión y conserva el QA inactivo cuando no se cambia', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(record),
    )
    vi.stubGlobal('fetch', fetchMock)
    const onSaved = vi.fn()

    render(
      <RecordFormDialog
        mode="edit"
        record={record}
        people={[
          { id: 1, name: 'Ana Quispe', isActive: true },
          { id: 2, name: 'Beto Mamani', isActive: false },
        ]}
        levels={levels}
        peopleLoading={false}
        levelsLoading={false}
        today="2026-10-18"
        onClose={() => {}}
        onSaved={onSaved}
      />,
    )

    fireEvent.change(screen.getByLabelText('Detalle'), {
      target: { value: 'Detalle corregido' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    )

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith('Registro actualizado.')
    })

    const call = fetchMock.mock.calls[0] as unknown as
      | [string, RequestInit]
      | undefined
    expect(call).toBeDefined()
    if (call === undefined) {
      throw new Error('No se envió la edición.')
    }

    expect(call[0]).toBe('/api/records/10')
    expect(call[1].method).toBe('PATCH')
    const body = JSON.parse(String(call[1].body)) as Record<string, unknown>
    expect(body).toMatchObject({
      detail: 'Detalle corregido',
      version: 1,
    })
    expect(body).not.toHaveProperty('qaId')
  })

  it('rechaza una fecha futura sin llamar al API', () => {
    const fetchMock = vi.fn(async () => jsonResponse(record))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <RecordFormDialog
        mode="edit"
        record={record}
        people={[{ id: 2, name: 'Beto Mamani', isActive: false }]}
        levels={levels}
        peopleLoading={false}
        levelsLoading={false}
        today="2026-10-18"
        onClose={() => {}}
        onSaved={() => {}}
      />,
    )

    fireEvent.change(screen.getByLabelText('Fecha del hecho'), {
      target: { value: '2026-10-19' },
    })
    fireEvent.change(screen.getByLabelText('Detalle'), {
      target: { value: 'Detalle corregido' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Guardar cambios' }),
    )

    expect(
      screen.getByText('La fecha no puede ser futura.'),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('AnnulRecordDialog', () => {
  it('exige confirmación y envía motivo, versión y confirmación', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ ...record, status: 'anulado', version: 2 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const onAnnulled = vi.fn()

    render(
      <AnnulRecordDialog
        record={record}
        onClose={() => {}}
        onAnnulled={onAnnulled}
      />,
    )

    fireEvent.change(screen.getByLabelText('Motivo de la anulación'), {
      target: { value: 'Registro duplicado' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Anular registro' }),
    )

    expect(
      screen.getByText('Confirma que la anulación es definitiva.'),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(
      screen.getByRole('button', { name: 'Anular registro' }),
    )

    await waitFor(() => {
      expect(onAnnulled).toHaveBeenCalledWith('Registro anulado.')
    })

    const call = fetchMock.mock.calls[0] as unknown as
      | [string, RequestInit]
      | undefined
    expect(call).toBeDefined()
    if (call === undefined) {
      throw new Error('No se envió la anulación.')
    }

    expect(call[0]).toBe('/api/records/10/annul')
    expect(call[1].method).toBe('POST')
    const body = JSON.parse(String(call[1].body)) as Record<string, unknown>
    expect(body).toEqual({
      reason: 'Registro duplicado',
      version: 1,
      confirm: true,
    })
  })
})

describe('RecordHistoryDialog', () => {
  it('muestra creación, edición y anulación con actor y antes/después', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([
          {
            occurredAt: '2026-10-10T15:00:00.000Z',
            actorUsername: 'admin',
            channel: 'app',
            action: 'record.created',
            before: null,
            after: {
              qaId: 2,
              type: 'merito',
              eventDate: '2026-10-10',
              level: 3,
              detail: 'Previno una regresión en la entrega',
              status: 'vigente',
            },
          },
          {
            occurredAt: '2026-10-11T15:00:00.000Z',
            actorUsername: 'editor',
            channel: 'app',
            action: 'record.updated',
            before: { detail: 'Detalle anterior' },
            after: { detail: 'Detalle posterior' },
          },
          {
            occurredAt: '2026-10-12T15:00:00.000Z',
            actorUsername: 'admin',
            channel: 'app',
            action: 'record.annulled',
            before: { status: 'vigente' },
            after: {
              status: 'anulado',
              reason: 'Registro duplicado',
              annulledAt: '2026-10-12T15:00:00.000Z',
            },
          },
        ]),
      ),
    )

    render(
      <RecordHistoryDialog
        record={record}
        levels={levels}
        onClose={() => {}}
      />,
    )

    expect(await screen.findByText('Creación')).toBeInTheDocument()
    expect(screen.getByText('Edición')).toBeInTheDocument()
    expect(screen.getByText('Anulación')).toBeInTheDocument()
    expect(
      screen.getByText('Previno una regresión en la entrega'),
    ).toBeInTheDocument()
    expect(screen.getByText('Detalle anterior')).toBeInTheDocument()
    expect(screen.getByText('Detalle posterior')).toBeInTheDocument()
    expect(screen.getByText('Registro duplicado')).toBeInTheDocument()
    expect(screen.getAllByText(/admin/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/editor/).length).toBeGreaterThan(0)
  })
})
