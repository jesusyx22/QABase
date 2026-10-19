import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage, formatDate, formatDateTimeUtc } from '@/lib/format'
import {
  requestSyncStatus,
  requestTickets,
  type HelpdeskSyncStatus,
  type HelpdeskTicket,
} from '@/features/helpdesk/api'
import { TicketDetailDialog } from '@/features/helpdesk/TicketDetailDialog'

function syncLabel(status: HelpdeskSyncStatus | null): string {
  if (!status || status.status === 'never') {
    return 'Todavía no se ha ejecutado el agente local.'
  }
  if (status.status === 'error') {
    return 'La última sincronización falló.'
  }
  return 'Última sincronización completada.'
}

export function HelpdeskPage() {
  const [query, setQuery] = useState('')
  const [tickets, setTickets] = useState<HelpdeskTicket[]>([])
  const [syncStatus, setSyncStatus] = useState<HelpdeskSyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [detailTicketId, setDetailTicketId] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([requestTickets(query), requestSyncStatus()])
      .then(([ticketList, status]) => {
        if (active) {
          setTickets(ticketList)
          setSyncStatus(status)
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            errorMessage(caught, 'No se pudo cargar la Mesa de Ayuda.'),
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
  }, [query, reload])

  const countLabel = `${tickets.length} ${
    tickets.length === 1 ? 'ticket' : 'tickets'
  }`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Mesa de Ayuda</h1>
        <p className="text-sm text-muted-foreground">
          Copia local de los tickets asignados que sincroniza tu agente local.
        </p>
      </div>

      <Alert className="bg-muted/40" role="note">
        <AlertTitle>Sincronización de solo lectura</AlertTitle>
        <AlertDescription>
          La extracción se ejecuta desde tu equipo con el agente local. QABase
          no llama a la web institucional, no crea tickets y no modifica el
          sistema de origen.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Copia local</CardTitle>
          <CardDescription>{syncLabel(syncStatus)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">
              Última sincronización:{' '}
              <span className="text-foreground tabular-nums">
                {formatDateTimeUtc(syncStatus?.lastFinishedAt ?? null)}
              </span>
            </p>
            {syncStatus?.status === 'success' ? (
              <p className="text-muted-foreground tabular-nums">
                {syncStatus.createdCount} creados · {syncStatus.updatedCount}{' '}
                actualizados · {syncStatus.rejectedCount} rechazados
              </p>
            ) : null}
            {syncStatus?.status === 'error' && syncStatus.message ? (
              <p className="text-destructive">{syncStatus.message}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true)
              setError(null)
              setReload((value) => value + 1)
            }}
            disabled={loading}
          >
            {loading ? 'Actualizando…' : 'Actualizar lista'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
          <CardDescription>
            Búsqueda local por referencia, asunto o analista.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="w-full max-w-sm space-y-2">
            <Label htmlFor="helpdesk-search">Buscar tickets</Label>
            <Input
              id="helpdesk-search"
              name="helpdesk-search"
              type="search"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setError(null)
              }}
              placeholder="Referencia, asunto o analista"
              autoComplete="off"
            />
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>No se pudo cargar la Mesa de Ayuda</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setLoading(true)
                    setError(null)
                    setReload((value) => value + 1)
                  }}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="space-y-1 py-8 text-center">
              <p className="text-sm font-medium">Sin tickets sincronizados</p>
              <p className="text-sm text-muted-foreground">
                Ejecuta el agente local en tu equipo para traer los tickets
                asignados.
              </p>
            </div>
          ) : (
            <Table aria-label="Tickets de Mesa de Ayuda">
              <TableHeader>
                <TableRow>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Asunto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Analista</TableHead>
                  <TableHead>Fecha de reporte</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="[content-visibility:auto] [contain-intrinsic-size:48px]"
                  >
                    <TableCell className="font-medium">
                      {ticket.reference}
                    </TableCell>
                    <TableCell className="min-w-64 whitespace-normal break-words">
                      {ticket.subject}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ticket.statusLabel}</Badge>
                    </TableCell>
                    <TableCell>{ticket.analyst ?? '—'}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(ticket.reportedAt?.slice(0, 10) ?? null)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => setDetailTicketId(ticket.id)}
                          aria-label={`Ver detalle del ticket ${ticket.reference}`}
                        >
                          Ver detalle
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!loading && tickets.length > 0 ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {countLabel}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {detailTicketId !== null ? (
        <TicketDetailDialog
          ticketId={detailTicketId}
          onClose={() => setDetailTicketId(null)}
        />
      ) : null}
    </div>
  )
}
