import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import {
  historyActionLabel,
  historyFields,
  type HistoryEntry,
  type HistoryField,
} from './history'

type HistoryState =
  | { status: 'loading'; events: HistoryEntry[] }
  | { status: 'success'; events: HistoryEntry[] }
  | { status: 'error'; events: HistoryEntry[]; message: string }

type HistoryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  load: (signal?: AbortSignal) => Promise<HistoryEntry[]>
}

function HistorySnapshot({
  title,
  payload,
}: {
  title: string
  payload: unknown
}) {
  const fields: HistoryField[] = historyFields(payload)

  return (
    <section aria-label={title} className="rounded-md bg-muted/40 p-2">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      {fields.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">Sin datos.</p>
      ) : (
        <dl className="mt-1 space-y-1 text-xs">
          {fields.map((field) => (
            <div key={field.key} className="flex gap-2">
              <dt className="w-20 shrink-0 text-muted-foreground">
                {field.label}
              </dt>
              <dd className="min-w-0 break-words">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

function HistoryEventCard({ event }: { event: HistoryEntry }) {
  return (
    <article className="rounded-lg border border-border p-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">
          {historyActionLabel(event.action)}
        </h3>
        <time
          dateTime={event.occurredAt}
          className="text-xs text-muted-foreground tabular-nums"
        >
          {formatDateTimeUtc(event.occurredAt)} UTC
        </time>
      </header>
      <p className="mt-1 text-xs text-muted-foreground">
        Por {event.actorUsername ?? 'Sistema'}
        {event.channel === 'local' ? ' · origen local' : ''}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <HistorySnapshot title="Antes" payload={event.before} />
        <HistorySnapshot title="Después" payload={event.after} />
      </div>
    </article>
  )
}

function HistorySkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Cargando historial">
      {[0, 1, 2].map((index) => (
        <div key={index} className="space-y-2 rounded-lg border border-border p-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
      <span className="sr-only">Cargando historial…</span>
    </div>
  )
}

export function HistoryDialog({
  open,
  onOpenChange,
  title,
  description,
  load,
}: HistoryDialogProps) {
  const [state, setState] = useState<HistoryState>({
    status: 'loading',
    events: [],
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) {
      return
    }

    const controller = new AbortController()
    load(controller.signal)
      .then((events) => {
        if (!controller.signal.aborted) {
          setState({ status: 'success', events })
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            events: [],
            message: errorMessage(caught, 'No se pudo cargar el historial.'),
          })
        }
      })

    return () => controller.abort()
  }, [open, attempt, load])

  const retry = () => {
    setState({ status: 'loading', events: [] })
    setAttempt((current) => current + 1)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div
          className="max-h-[55vh] overflow-y-auto overscroll-contain pr-1"
          tabIndex={0}
          role="region"
          aria-label="Eventos del historial"
        >
          {state.status === 'loading' ? <HistorySkeleton /> : null}

          {state.status === 'error' ? (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertTitle>No se pudo cargar el historial</AlertTitle>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
              <Button type="button" variant="outline" size="sm" onClick={retry}>
                Reintentar
              </Button>
            </div>
          ) : null}

          {state.status === 'success' && state.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay eventos registrados.
            </p>
          ) : null}

          {state.status === 'success' && state.events.length > 0 ? (
            <div className="space-y-3">
              {state.events.map((event, index) => (
                <HistoryEventCard
                  key={`${event.occurredAt}-${event.action}-${index}`}
                  event={event}
                />
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
