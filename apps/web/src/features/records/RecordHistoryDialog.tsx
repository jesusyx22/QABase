import { useEffect, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage, formatDateTimeUtc } from '@/lib/format'
import { fetchRecordHistory } from './api'
import {
  recordStatusLabel,
  recordTypeLabel,
  type ImpactLevel,
  type RecordHistoryEvent,
  type RecordType,
  type RecordView,
} from './types'

const ACTION_LABELS: Record<string, string> = {
  'record.created': 'Creación',
  'record.updated': 'Edición',
  'record.annulled': 'Anulación',
}

const FIELD_KEYS = [
  'qaId',
  'type',
  'eventDate',
  'level',
  'detail',
  'status',
] as const

const FIELD_LABELS: Record<string, string> = {
  qaId: 'QA',
  type: 'Tipo',
  eventDate: 'Fecha',
  level: 'Nivel',
  detail: 'Detalle',
  status: 'Estado',
}

type Snapshot = Record<string, unknown>

function asSnapshot(value: unknown): Snapshot | null {
  return typeof value === 'object' && value !== null
    ? (value as Snapshot)
    : null
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : null
}

function typeValue(value: unknown): RecordType | null {
  return value === 'merito' || value === 'incidencia' ? value : null
}

function levelText(
  level: number | null,
  type: RecordType | null,
  levels: ImpactLevel[],
): string {
  if (level === null) {
    return '—'
  }
  const label =
    type === null
      ? null
      : levels.find(
          (item) => item.type === type && item.level === level,
        )?.label
  return label ? `${level}. ${label}` : String(level)
}

function formatField(
  key: string,
  snapshot: Snapshot | null,
  levels: ImpactLevel[],
): string {
  if (snapshot === null) {
    return '—'
  }

  switch (key) {
    case 'qaId': {
      const id = numberValue(snapshot.qaId)
      return id === null ? '—' : `QA #${id}`
    }
    case 'type': {
      const type = typeValue(snapshot.type)
      return type === null ? '—' : recordTypeLabel(type)
    }
    case 'eventDate':
      return textValue(snapshot.eventDate) ?? '—'
    case 'level':
      return levelText(
        numberValue(snapshot.level),
        typeValue(snapshot.type),
        levels,
      )
    case 'detail':
      return textValue(snapshot.detail) ?? '—'
    case 'status': {
      const status = textValue(snapshot.status)
      return status === 'vigente' || status === 'anulado'
        ? recordStatusLabel(status)
        : '—'
    }
    default:
      return '—'
  }
}

function valuesEqual(left: unknown, right: unknown): boolean {
  return left === right
}

function SnapshotFields({
  snapshot,
  levels,
  keys = FIELD_KEYS,
}: {
  snapshot: Snapshot | null
  levels: ImpactLevel[]
  keys?: readonly string[]
}) {
  if (snapshot === null) {
    return (
      <p className="text-sm text-muted-foreground">Sin datos legibles.</p>
    )
  }

  return (
    <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-sm">
      {keys.map((key) => (
        <div key={key} className="contents">
          <dt className="text-muted-foreground">
            {FIELD_LABELS[key] ?? key}
          </dt>
          <dd className="whitespace-pre-wrap break-words">
            {formatField(key, snapshot, levels)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function EventBody({
  event,
  levels,
}: {
  event: RecordHistoryEvent
  levels: ImpactLevel[]
}) {
  const before = asSnapshot(event.before)
  const after = asSnapshot(event.after)

  if (event.action === 'record.created') {
    return <SnapshotFields snapshot={after} levels={levels} />
  }

  if (event.action === 'record.annulled') {
    const beforeStatus = textValue(before?.status)
    const afterStatus = textValue(after?.status)
    const reason = textValue(after?.reason)
    const annulledAt = textValue(after?.annulledAt)

    return (
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Estado</dt>
        <dd>
          {beforeStatus === 'vigente'
            ? recordStatusLabel('vigente')
            : '—'}{' '}
          →{' '}
          {afterStatus === 'anulado'
            ? recordStatusLabel('anulado')
            : 'Anulado'}
        </dd>
        <dt className="text-muted-foreground">Motivo</dt>
        <dd className="whitespace-pre-wrap break-words">
          {reason ?? '—'}
        </dd>
        <dt className="text-muted-foreground">Momento</dt>
        <dd>{formatDateTimeUtc(annulledAt)}</dd>
      </dl>
    )
  }

  if (event.action === 'record.updated') {
    const changed = FIELD_KEYS.filter(
      (key) => !valuesEqual(before?.[key], after?.[key]),
    )

    if (changed.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          Sin cambios legibles.
        </p>
      )
    }

    return (
      <div className="space-y-2">
        {changed.map((key) => (
          <div key={key} className="text-sm">
            <p className="text-xs text-muted-foreground">
              {FIELD_LABELS[key] ?? key}
            </p>
            <p className="whitespace-pre-wrap break-words">
              <span>{formatField(key, before, levels)}</span>
              <span className="mx-1.5 text-muted-foreground">→</span>
              <span className="font-medium">
                {formatField(key, after, levels)}
              </span>
            </p>
          </div>
        ))}
      </div>
    )
  }

  return <SnapshotFields snapshot={after} levels={levels} />
}

function HistorySkeleton() {
  return (
    <div
      className="space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Cargando historial"
    >
      <span className="sr-only">Cargando historial…</span>
      {[0, 1].map((item) => (
        <div key={item} className="space-y-2 rounded-lg border border-border p-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-64" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  )
}

type HistoryState =
  | { status: 'ready'; events: RecordHistoryEvent[] }
  | { status: 'error'; message: string }

export function RecordHistoryDialog({
  record,
  levels,
  onClose,
}: {
  record: RecordView
  levels: ImpactLevel[]
  onClose: () => void
}) {
  const [state, setState] = useState<HistoryState | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    fetchRecordHistory(record.id, controller.signal)
      .then((events) => {
        if (!controller.signal.aborted) {
          setState({ status: 'ready', events })
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            message: errorMessage(
              caught,
              'No se pudo cargar el historial.',
            ),
          })
        }
      })

    return () => {
      controller.abort()
    }
  }, [record.id, attempt])

  const retry = () => {
    setState(null)
    setAttempt((current) => current + 1)
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto overscroll-contain sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Historial del registro</DialogTitle>
          <DialogDescription>
            Solo lectura. {record.qa.name} ·{' '}
            {recordTypeLabel(record.type)} · {record.eventDate}. Los momentos
            se muestran en UTC.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              Nivel {record.level}. {record.levelLabel}
            </span>
            <Badge
              variant={
                record.status === 'vigente' ? 'outline' : 'destructive'
              }
            >
              {recordStatusLabel(record.status)}
            </Badge>
          </div>
          {record.status === 'anulado' && record.annulReason !== null ? (
            <p className="mt-1 text-muted-foreground">
              Motivo de anulación: {record.annulReason}
            </p>
          ) : null}
        </div>

        <div
          className="max-h-[55vh] overflow-y-auto overscroll-contain pr-1"
          role="region"
          aria-label="Eventos del historial"
          tabIndex={0}
        >
          {state === null ? <HistorySkeleton /> : null}

          {state?.status === 'error' ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
              <div className="mt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retry}
                >
                  Reintentar
                </Button>
              </div>
            </Alert>
          ) : null}

          {state?.status === 'ready' && state.events.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              El registro no tiene eventos de historial.
            </p>
          ) : null}

          {state?.status === 'ready' && state.events.length > 0 ? (
            <ol className="space-y-4">
              {state.events.map((event, index) => (
                <li
                  key={`${event.occurredAt}-${event.action}-${index}`}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-medium">
                      {ACTION_LABELS[event.action] ?? event.action}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {event.actorUsername ?? '—'} ·{' '}
                      {formatDateTimeUtc(event.occurredAt)}
                      {event.channel === 'local'
                        ? ' · Operador local'
                        : ''}
                    </p>
                  </div>
                  <EventBody event={event} levels={levels} />
                </li>
              ))}
            </ol>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
