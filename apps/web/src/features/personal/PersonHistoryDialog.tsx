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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage, formatDateTimeUtc } from '@/lib/format'
import {
  requestPersonHistory,
  type Person,
  type PersonHistoryEvent,
} from './api'
import { describeHistoryChange, historyActionLabel } from './history-format'

type PersonHistoryDialogProps = {
  person: Person
  onClose: () => void
}

const SKELETON_ROWS = [0, 1, 2, 3]

export function PersonHistoryDialog({
  person,
  onClose,
}: PersonHistoryDialogProps) {
  const [events, setEvents] = useState<PersonHistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    requestPersonHistory(person.id)
      .then((result) => {
        if (active) {
          setEvents(result)
          setError(null)
        }
      })
      .catch((caught) => {
        if (active) {
          setError(
            errorMessage(caught, 'No se pudo cargar el historial de la persona.'),
          )
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [person.id, reloadKey])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Historial de {person.name}</DialogTitle>
          <DialogDescription>
            Solo lectura. Los momentos se muestran en UTC.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo cargar el historial</AlertTitle>
            <AlertDescription>
              <p>{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={handleRetry}
              >
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : loading ? (
          <div role="status">
            <span className="sr-only">Cargando historial…</span>
            <Table aria-hidden="true">
              <TableHeader>
                <TableRow>
                  <TableHead>Acción</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Momento (UTC)</TableHead>
                  <TableHead>Cambio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SKELETON_ROWS.map((row) => (
                  <TableRow key={row}>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-56" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Sin eventos registrados para esta persona.
          </p>
        ) : (
          <Table aria-label={`Historial de ${person.name}`}>
            <TableHeader>
              <TableRow>
                <TableHead>Acción</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Momento (UTC)</TableHead>
                <TableHead>Cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event, index) => (
                <TableRow key={`${event.occurredAt}-${event.action}-${index}`}>
                  <TableCell>{historyActionLabel(event.action)}</TableCell>
                  <TableCell>{event.actorUsername ?? 'Sistema'}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatDateTimeUtc(event.occurredAt)}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {describeHistoryChange(event)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
