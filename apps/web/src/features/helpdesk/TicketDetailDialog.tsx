import { useEffect, useState, type ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  errorMessage,
  formatBytes,
  formatDate,
  formatDateTimeUtc,
} from '@/lib/format'
import { requestTicket, type HelpdeskTicket } from './api'

type TicketDetailDialogProps = {
  ticketId: number
  onClose: () => void
}

function DetailField({
  label,
  children,
  wide = false,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
    </div>
  )
}

export function TicketDetailDialog({
  ticketId,
  onClose,
}: TicketDetailDialogProps) {
  const [ticket, setTicket] = useState<HelpdeskTicket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let active = true

    requestTicket(ticketId)
      .then((result) => {
        if (active) {
          setTicket(result)
          setError(null)
        }
      })
      .catch((caught) => {
        if (active) {
          setError(errorMessage(caught, 'No se pudo cargar el ticket.'))
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
  }, [ticketId, reloadKey])

  const handleRetry = () => {
    setLoading(true)
    setError(null)
    setReloadKey((key) => key + 1)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {ticket ? `Ticket ${ticket.reference}` : 'Detalle del ticket'}
          </DialogTitle>
          <DialogDescription>
            Consulta de solo lectura de la copia local.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudo cargar el ticket</AlertTitle>
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
        ) : loading || !ticket ? (
          <div role="status" className="space-y-4">
            <span className="sr-only">Cargando ticket…</span>
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3, 4, 5].map((field) => (
                <div key={field} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ))}
            </div>
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              <DetailField label="ID local">
                <span className="tabular-nums">{ticket.id}</span>
              </DetailField>
              <DetailField label="Referencia">
                <span className="font-medium">{ticket.reference}</span>
              </DetailField>
              <DetailField label="Estado">
                <Badge variant="secondary">{ticket.statusLabel}</Badge>
              </DetailField>
              <DetailField label="Asunto" wide>
                {ticket.subject}
              </DetailField>
              <DetailField label="Analista">
                {ticket.analyst ?? '—'}
              </DetailField>
              <DetailField label="Solicitante">
                {ticket.requester ?? '—'}
              </DetailField>
              <DetailField label="Organización">
                {ticket.organization ?? '—'}
              </DetailField>
              <DetailField label="Equipo">
                {ticket.team ?? '—'}
              </DetailField>
              <DetailField label="Fecha de reporte">
                {formatDate(ticket.reportedAt?.slice(0, 10) ?? null)}
              </DetailField>
              <DetailField label="Creado en la copia local">
                {formatDateTimeUtc(ticket.createdAt)}
              </DetailField>
              <DetailField label="Última sincronización">
                {formatDateTimeUtc(ticket.lastSyncedAt)}
              </DetailField>
            </dl>

            <Separator />

            <section aria-labelledby="ticket-description">
              <h3
                id="ticket-description"
                className="text-sm font-medium"
              >
                Descripción
              </h3>
              <p className="mt-1.5 break-words whitespace-pre-wrap text-sm text-muted-foreground">
                {ticket.description ?? 'Sin descripción'}
              </p>
            </section>

            <section aria-labelledby="ticket-attachments">
              <h3 id="ticket-attachments" className="text-sm font-medium">
                Anexos
              </h3>
              {ticket.attachments.length === 0 ? (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Sin anexos
                </p>
              ) : (
                <ul className="mt-1.5 space-y-2">
                  {ticket.attachments.map((attachment) => (
                    <li key={attachment.id} className="text-sm">
                      <a
                        href={attachment.downloadUrl}
                        download
                        className="break-words text-primary underline underline-offset-4"
                      >
                        {attachment.fileName}
                      </a>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {attachment.contentType ?? 'Archivo'} ·{' '}
                        {formatBytes(attachment.sizeBytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
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
