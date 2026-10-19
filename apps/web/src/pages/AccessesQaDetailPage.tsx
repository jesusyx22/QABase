import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/lib/format'
import { AccessDetailDialog } from '@/features/accesses/AccessDetailDialog'
import type { Access } from '@/features/accesses/api'
import { formatPortRange } from '@/features/accesses/labels'
import {
  requestPersonAssignments,
  type AssignmentView,
  type PersonAssignmentsResponse,
} from '@/features/access-assignments/api'
import { AccessAssignmentFormDialog } from '@/features/access-assignments/AccessAssignmentFormDialog'
import { AssignmentHistoryDialog } from '@/features/access-assignments/AssignmentHistoryDialog'
import {
  environmentLabel,
  formatDaysRemaining,
  formatExpiry,
  protocolLabel,
  semaphoreVariant,
} from '@/features/access-assignments/labels'
import { useAuth } from '@/features/auth/useAuth'

const SKELETON_ROWS = [0, 1, 2]

export function AccessesQaDetailPage() {
  const { personId } = useParams<{ personId: string }>()
  const parsedId = Number(personId)
  const isValidId = !Number.isNaN(parsedId) && parsedId > 0

  const { session } = useAuth()
  const permissions = session?.account.permissions ?? []
  const canManage = permissions.includes('accesos.gestionar')

  const [data, setData] = useState<PersonAssignmentsResponse | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] =
    useState<AssignmentView | null>(null)
  const [historyAssignment, setHistoryAssignment] =
    useState<AssignmentView | null>(null)
  const [detailAccess, setDetailAccess] = useState<Access | null>(null)

  const requestKey = `${parsedId}:${reloadKey}`
  const loading = isValidId && loadedKey !== requestKey

  useEffect(() => {
    if (!isValidId) {
      return
    }

    let active = true
    const key = requestKey

    requestPersonAssignments(parsedId)
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
              'No se pudieron cargar las asignaciones del QA.',
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
  }, [parsedId, isValidId, requestKey])

  const reload = () => {
    setError(null)
    setReloadKey((k) => k + 1)
  }

  if (!isValidId) {
    return (
      <div className="space-y-4">
        <Link
          to="/accesos/qas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver a QAs
        </Link>
        <Alert variant="destructive">
          <AlertTitle>Identificador no válido</AlertTitle>
          <AlertDescription>
            La ruta no contiene un ID de QA válido.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const person = data?.person
  const counts = data?.counts
  const current = data?.current ?? []
  const expired = data?.expired ?? []
  const isEmpty = counts !== undefined && counts.total === 0

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/accesos/qas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Volver a QAs
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-8 w-32" />
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {SKELETON_ROWS.map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar las asignaciones del QA</AlertTitle>
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
      ) : person && counts ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">
                  {person.name}
                </h1>
                <Badge
                  variant={person.isActive ? 'success' : 'outline'}
                  className={
                    person.isActive ? undefined : 'text-muted-foreground'
                  }
                >
                  {person.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="tabular-nums font-medium text-foreground">
                  {counts.total} {counts.total === 1 ? 'asignación' : 'asignaciones'}
                </span>
                {' · '}
                <span className="tabular-nums">
                  {counts.current}{' '}
                  {counts.current === 1 ? 'vigente' : 'vigentes'}
                </span>
                {' · '}
                <span className="tabular-nums">
                  {counts.expiring} por vencer
                </span>
                {' · '}
                <span className="tabular-nums">
                  {counts.expired}{' '}
                  {counts.expired === 1 ? 'vencido' : 'vencidos'}
                </span>
              </p>
            </div>

            {canManage ? (
              <Button
                type="button"
                onClick={() => setCreateOpen(true)}
                disabled={!person.isActive}
              >
                Asignar acceso
              </Button>
            ) : null}
          </div>

          {isEmpty ? (
            <div className="border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-medium">Sin asignaciones registradas</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Este integrante de QA no tiene accesos de firewall asignados
                actualmente.
              </p>
              {canManage && person.isActive ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={() => setCreateOpen(true)}
                >
                  Asignar acceso
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Grupo Vigentes y por vencer */}
              <Card>
                <CardHeader>
                  <CardTitle>Vigentes y por vencer</CardTitle>
                  <CardDescription>
                    Accesos activos asignados ordenados por proximidad de
                    vencimiento.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {current.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No hay asignaciones vigentes o por vencer.
                    </p>
                  ) : (
                    <Table aria-label="Asignaciones vigentes y por vencer">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Acceso</TableHead>
                          <TableHead>Ambiente</TableHead>
                          <TableHead>Protocolo</TableHead>
                          <TableHead>Vence</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {current.map((assignment) => (
                          <TableRow key={assignment.id}>
                            <TableCell>
                              <div className="space-y-0.5">
                                {assignment.access.detail ? (
                                  <div className="font-medium">
                                    {assignment.access.detail}
                                  </div>
                                ) : null}
                                <div className="font-mono text-xs text-muted-foreground">
                                  {assignment.access.address}:
                                  {formatPortRange(
                                    assignment.access.port,
                                    assignment.access.portEnd,
                                  )}
                                </div>
                                {!assignment.access.isActive ? (
                                  <Badge
                                    variant="outline"
                                    className="text-xs text-muted-foreground"
                                  >
                                    Acceso inactivo
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              {environmentLabel(assignment.access.environment)}
                            </TableCell>
                            <TableCell>
                              {protocolLabel(assignment.access.protocol)}
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
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setDetailAccess(assignment.access)}
                                  aria-label={`Ver acceso ${assignment.access.address}:${formatPortRange(assignment.access.port, assignment.access.portEnd)}`}
                                >
                                  Ver acceso
                                </Button>
                                {canManage ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="xs"
                                      disabled={
                                        !person.isActive ||
                                        !assignment.access.isActive
                                      }
                                      onClick={() =>
                                        setEditingAssignment(assignment)
                                      }
                                      aria-label={`Editar vencimiento de ${assignment.access.address}:${formatPortRange(assignment.access.port, assignment.access.portEnd)}`}
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
                                      aria-label={`Historial de asignación ${assignment.access.address}:${formatPortRange(assignment.access.port, assignment.access.portEnd)}`}
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
                </CardContent>
              </Card>

              {/* Grupo Vencidos */}
              <Card>
                <CardHeader>
                  <CardTitle>Vencidos</CardTitle>
                  <CardDescription>
                    Accesos cuya fecha de vencimiento ya expiró.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {expired.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No hay asignaciones vencidas.
                    </p>
                  ) : (
                    <Table aria-label="Asignaciones vencidas">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Acceso</TableHead>
                          <TableHead>Ambiente</TableHead>
                          <TableHead>Protocolo</TableHead>
                          <TableHead>Vence</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expired.map((assignment) => (
                          <TableRow key={assignment.id}>
                            <TableCell>
                              <div className="space-y-0.5">
                                {assignment.access.detail ? (
                                  <div className="font-medium">
                                    {assignment.access.detail}
                                  </div>
                                ) : null}
                                <div className="font-mono text-xs text-muted-foreground">
                                  {assignment.access.address}:
                                  {formatPortRange(
                                    assignment.access.port,
                                    assignment.access.portEnd,
                                  )}
                                </div>
                                {!assignment.access.isActive ? (
                                  <Badge
                                    variant="outline"
                                    className="text-xs text-muted-foreground"
                                  >
                                    Acceso inactivo
                                  </Badge>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              {environmentLabel(assignment.access.environment)}
                            </TableCell>
                            <TableCell>
                              {protocolLabel(assignment.access.protocol)}
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
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  onClick={() => setDetailAccess(assignment.access)}
                                  aria-label={`Ver acceso ${assignment.access.address}:${formatPortRange(assignment.access.port, assignment.access.portEnd)}`}
                                >
                                  Ver acceso
                                </Button>
                                {canManage ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="xs"
                                      disabled={
                                        !person.isActive ||
                                        !assignment.access.isActive
                                      }
                                      onClick={() =>
                                        setEditingAssignment(assignment)
                                      }
                                      aria-label={`Editar vencimiento de ${assignment.access.address}:${formatPortRange(assignment.access.port, assignment.access.portEnd)}`}
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
                                      aria-label={`Historial de asignación ${assignment.access.address}:${formatPortRange(assignment.access.port, assignment.access.portEnd)}`}
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
                </CardContent>
              </Card>
            </div>
          )}

          {createOpen ? (
            <AccessAssignmentFormDialog
              mode="create"
              person={person}
              open
              onOpenChange={(open) => !open && setCreateOpen(false)}
              onSaved={reload}
            />
          ) : null}

          {editingAssignment ? (
            <AccessAssignmentFormDialog
              mode="edit"
              person={person}
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

          {detailAccess ? (
            <AccessDetailDialog
              access={detailAccess}
              onClose={() => {
                setDetailAccess(null)
                reload()
              }}
            />
          ) : null}
        </>
      ) : null}
    </div>
  )
}
