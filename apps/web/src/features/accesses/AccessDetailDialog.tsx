import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import type { Access } from './api'
import {
  accessPortLabel,
  accessStatusLabel,
  environmentLabel,
  protocolLabel,
} from './labels'
import {
  requestAccessAssignments,
  type AccessAssignmentsResponse,
  type AssignmentView,
} from '@/features/access-assignments/api'
import { AccessAssignmentFormDialog } from '@/features/access-assignments/AccessAssignmentFormDialog'
import { AssignmentHistoryDialog } from '@/features/access-assignments/AssignmentHistoryDialog'
import {
  formatDaysRemaining,
  formatExpiry,
  semaphoreVariant,
} from '@/features/access-assignments/labels'
import { useAuth } from '@/features/auth/useAuth'

type AccessDetailDialogProps = {
  access: Access
  onClose: () => void
}

export function AccessDetailDialog({
  access,
  onClose,
}: AccessDetailDialogProps) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const permissions = session?.account.permissions ?? []
  const canManage = permissions.includes('accesos.gestionar')

  const [data, setData] = useState<AccessAssignmentsResponse | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [editingAssignment, setEditingAssignment] =
    useState<AssignmentView | null>(null)
  const [historyAssignment, setHistoryAssignment] =
    useState<AssignmentView | null>(null)

  const requestKey = `${access.id}:${reloadKey}`
  const loading = loadedKey !== requestKey

  useEffect(() => {
    let active = true
    const key = requestKey

    requestAccessAssignments(access.id)
      .then((result) => {
        if (active) {
          setData(result)
          setError(null)
        }
      })
      .catch((caught) => {
        if (active) {
          setError(
            errorMessage(
              caught,
              'No se pudieron cargar los QAs asignados a este acceso.',
            ),
          )
        }
      })
      .finally(() => {
        if (active) {
          setLoadedKey(key)
        }
      })

    return () => {
      active = false
    }
  }, [access.id, requestKey])

  const reload = () => {
    setError(null)
    setReloadKey((k) => k + 1)
  }

  const current = data?.current ?? []
  const expired = data?.expired ?? []
  const counts = data?.counts
  const isEmpty = counts !== undefined && counts.total === 0

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Detalle del acceso</DialogTitle>
          <DialogDescription>
            Acceso #{access.id} del catálogo de firewall.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Detalle</dt>
          <dd className="break-words">{access.detail ?? '—'}</dd>

          <dt className="text-muted-foreground">Dirección</dt>
          <dd className="break-all font-mono">{access.address}</dd>

          <dt className="text-muted-foreground">Puerto</dt>
          <dd className="tabular-nums">{accessPortLabel(access)}</dd>

          <dt className="text-muted-foreground">Ambiente</dt>
          <dd>{environmentLabel(access.environment)}</dd>

          <dt className="text-muted-foreground">Protocolo</dt>
          <dd>{protocolLabel(access.protocol)}</dd>

          <dt className="text-muted-foreground">Aplicaciones</dt>
          <dd className="whitespace-pre-wrap break-words">
            {access.applications ?? '—'}
          </dd>

          <dt className="text-muted-foreground">URLs / rutas</dt>
          <dd className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs">
            {access.urls ?? '—'}
          </dd>

          <dt className="text-muted-foreground">Estado</dt>
          <dd>{accessStatusLabel(access.isActive)}</dd>

          <dt className="text-muted-foreground">Versión</dt>
          <dd className="tabular-nums">{access.version}</dd>

          <dt className="text-muted-foreground">Alta</dt>
          <dd className="tabular-nums">
            {formatDateTimeUtc(access.createdAt)}
          </dd>

          <dt className="text-muted-foreground">Actualización</dt>
          <dd className="tabular-nums">
            {formatDateTimeUtc(access.updatedAt)}
          </dd>
        </dl>

        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">QAs asignados</h3>
            {!loading && counts ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {counts.total}{' '}
                {counts.total === 1 ? 'asignación' : 'asignaciones'}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div role="status" className="space-y-2">
              <span className="sr-only">Cargando QAs asignados…</span>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTitle>No se pudieron cargar los QAs asignados</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={reload}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : isEmpty ? (
            <p className="border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No hay integrantes de QA asignados a este acceso.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vigentes y por vencer
                </h4>
                {current.length === 0 ? (
                  <p className="py-2 text-xs text-muted-foreground">
                    Sin asignaciones vigentes o por vencer.
                  </p>
                ) : (
                  <Table aria-label="QAs con asignaciones vigentes">
                    <TableHeader>
                      <TableRow>
                        <TableHead>QA</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Asignado el</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {current.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">
                            {assignment.person.name}
                            {!assignment.person.isActive ? (
                              <Badge
                                variant="outline"
                                className="ml-2 text-xs text-muted-foreground"
                              >
                                QA inactivo
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatExpiry(assignment.expiresOn)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={semaphoreVariant(assignment.urgency)}
                              className={
                                assignment.urgency === 'expired'
                                  ? 'text-muted-foreground'
                                  : undefined
                              }
                            >
                              {formatDaysRemaining(assignment.daysRemaining)}
                            </Badge>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatDateTimeUtc(assignment.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  onClose()
                                  navigate(
                                    `/accesos/qas/${assignment.person.id}`,
                                  )
                                }}
                                aria-label={`Ver QA ${assignment.person.name}`}
                              >
                                Ver QA
                              </Button>
                              {canManage ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="xs"
                                    disabled={
                                      !access.isActive ||
                                      !assignment.person.isActive
                                    }
                                    onClick={() =>
                                      setEditingAssignment(assignment)
                                    }
                                    aria-label={`Editar vencimiento de ${assignment.person.name}`}
                                  >
                                    Editar vencimiento
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    onClick={() =>
                                      setHistoryAssignment(assignment)
                                    }
                                    aria-label={`Historial de asignación de ${assignment.person.name}`}
                                  >
                                    Historial
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vencidos
                </h4>
                {expired.length === 0 ? (
                  <p className="py-2 text-xs text-muted-foreground">
                    Sin asignaciones vencidas.
                  </p>
                ) : (
                  <Table aria-label="QAs con asignaciones vencidas">
                    <TableHeader>
                      <TableRow>
                        <TableHead>QA</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Asignado el</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expired.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">
                            {assignment.person.name}
                            {!assignment.person.isActive ? (
                              <Badge
                                variant="outline"
                                className="ml-2 text-xs text-muted-foreground"
                              >
                                QA inactivo
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatExpiry(assignment.expiresOn)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={semaphoreVariant(assignment.urgency)}
                              className="text-muted-foreground"
                            >
                              {formatDaysRemaining(assignment.daysRemaining)}
                            </Badge>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatDateTimeUtc(assignment.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  onClose()
                                  navigate(
                                    `/accesos/qas/${assignment.person.id}`,
                                  )
                                }}
                                aria-label={`Ver QA ${assignment.person.name}`}
                              >
                                Ver QA
                              </Button>
                              {canManage ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="xs"
                                    disabled={
                                      !access.isActive ||
                                      !assignment.person.isActive
                                    }
                                    onClick={() =>
                                      setEditingAssignment(assignment)
                                    }
                                    aria-label={`Editar vencimiento de ${assignment.person.name}`}
                                  >
                                    Editar vencimiento
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    onClick={() =>
                                      setHistoryAssignment(assignment)
                                    }
                                    aria-label={`Historial de asignación de ${assignment.person.name}`}
                                  >
                                    Historial
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>

        {editingAssignment ? (
          <AccessAssignmentFormDialog
            mode="edit"
            person={editingAssignment.person}
            assignment={editingAssignment}
            open
            onOpenChange={(open) => !open && setEditingAssignment(null)}
            onSaved={reload}
          />
        ) : null}

        {historyAssignment ? (
          <AssignmentHistoryDialog
            assignment={historyAssignment}
            onClose={() => setHistoryAssignment(null)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
