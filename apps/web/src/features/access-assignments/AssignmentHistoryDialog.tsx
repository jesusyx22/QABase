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
  requestAssignmentHistory,
  type AssignmentHistoryEvent,
  type AssignmentView,
} from './api'
import { formatPortRange } from '@/features/accesses/labels'
import { formatExpiry } from './labels'

export type AssignmentHistoryDialogProps = {
  assignment: AssignmentView
  onClose: () => void
}

const SKELETON_ROWS = [0, 1, 2, 3]

function assignmentHistoryActionLabel(action: string): string {
  switch (action) {
    case 'access_assignment.created':
      return 'Asignación creada'
    case 'access_assignment.updated':
      return 'Asignación actualizada'
    default:
      return action
  }
}

function describeAssignmentChange(event: AssignmentHistoryEvent): string {
  const before = (event.before ?? {}) as Record<string, unknown>
  const after = (event.after ?? {}) as Record<string, unknown>

  const isCreation =
    event.action === 'access_assignment.created' ||
    Object.keys(before).length === 0

  if (isCreation) {
    const qa =
      (after.personName as string) ??
      (after.personId ? `QA #${after.personId}` : '—')
    const access =
      (after.accessLabel as string) ??
      (after.accessId ? `Acceso #${after.accessId}` : '—')
    const expiry = after.expiresOn ? formatExpiry(String(after.expiresOn)) : '—'
    return `QA: ${qa}; Acceso: ${access}; Vencimiento: ${expiry}`
  }

  const changes: string[] = []

  if (
    before.personId !== after.personId ||
    before.personName !== after.personName
  ) {
    const beforeQa =
      (before.personName as string) ??
      (before.personId ? `QA #${before.personId}` : '—')
    const afterQa =
      (after.personName as string) ??
      (after.personId ? `QA #${after.personId}` : '—')
    changes.push(`QA: ${beforeQa} → ${afterQa}`)
  }

  if (
    before.accessId !== after.accessId ||
    before.accessLabel !== after.accessLabel
  ) {
    const beforeAcc =
      (before.accessLabel as string) ??
      (before.accessId ? `Acceso #${before.accessId}` : '—')
    const afterAcc =
      (after.accessLabel as string) ??
      (after.accessId ? `Acceso #${after.accessId}` : '—')
    changes.push(`Acceso: ${beforeAcc} → ${afterAcc}`)
  }

  if (before.expiresOn !== after.expiresOn) {
    const beforeExp = before.expiresOn
      ? formatExpiry(String(before.expiresOn))
      : '—'
    const afterExp = after.expiresOn
      ? formatExpiry(String(after.expiresOn))
      : '—'
    changes.push(`Vencimiento: ${beforeExp} → ${afterExp}`)
  }

  return changes.length > 0 ? changes.join('; ') : 'Sin cambios registrados.'
}

export function AssignmentHistoryDialog({
  assignment,
  onClose,
}: AssignmentHistoryDialogProps) {
  const [events, setEvents] = useState<AssignmentHistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    requestAssignmentHistory(assignment.id)
      .then((result) => {
        if (active) {
          setEvents(result)
          setError(null)
        }
      })
      .catch((caught) => {
        if (active) {
          setError(
            errorMessage(
              caught,
              'No se pudo cargar el historial de la asignación.',
            ),
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
  }, [assignment.id, reloadKey])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Historial de la asignación</DialogTitle>
          <DialogDescription>
            {assignment.person.name} · {assignment.access.address}:
            {formatPortRange(
              assignment.access.port,
              assignment.access.portEnd,
            )}{' '}
            · Solo lectura. Los momentos se muestran en UTC.
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
                      <Skeleton className="h-4 w-64" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : events.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Sin eventos registrados para esta asignación.
          </p>
        ) : (
          <Table aria-label="Historial de la asignación">
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
                  <TableCell>
                    {assignmentHistoryActionLabel(event.action)}
                  </TableCell>
                  <TableCell>{event.actorUsername ?? 'Sistema'}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatDateTimeUtc(event.occurredAt)}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {describeAssignmentChange(event)}
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
