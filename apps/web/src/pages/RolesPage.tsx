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
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listRoles, type Role } from '@/features/roles/api'
import { CreateRoleDialog } from '@/features/roles/CreateRoleDialog'
import { RenameRoleDialog } from '@/features/roles/RenameRoleDialog'
import { RoleHistoryDialog } from '@/features/roles/RoleHistoryDialog'
import { RolePermissionsDialog } from '@/features/roles/RolePermissionsDialog'
import { errorMessage } from '@/lib/format'

type DialogState =
  | { kind: 'create' }
  | { kind: 'rename'; role: Role }
  | { kind: 'permissions'; role: Role }
  | { kind: 'history'; role: Role }
  | null

type RolesState = {
  requestKey: string
  status: 'loading' | 'success' | 'error'
  roles: Role[]
  message?: string
}

function RoleTableSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Cargando roles">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
      <span className="sr-only">Cargando roles…</span>
    </div>
  )
}

export function RolesPage() {
  const [reloadToken, setReloadToken] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)

  const requestKey = String(reloadToken)
  const [state, setState] = useState<RolesState>({
    requestKey: '',
    status: 'loading',
    roles: [],
  })

  useEffect(() => {
    const controller = new AbortController()
    listRoles(controller.signal)
      .then((roles) => {
        if (!controller.signal.aborted) {
          setState({ requestKey, status: 'success', roles })
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            requestKey,
            status: 'error',
            roles: [],
            message: errorMessage(caught, 'No se pudieron cargar los roles.'),
          })
        }
      })
    return () => controller.abort()
  }, [requestKey])

  const isLoading = state.requestKey !== requestKey
  const showSkeleton = isLoading && state.status !== 'success'
  const roles = state.roles

  const reloadWith = (message: string) => {
    setNotice(message)
    setReloadToken((current) => current + 1)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Roles</h1>
          <p className="text-sm text-muted-foreground">
            Los roles agrupan permisos; las cuentas heredan los del rol.
          </p>
        </div>
        <Button onClick={() => setDialog({ kind: 'create' })}>Nuevo rol</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles del sistema</CardTitle>
          <CardDescription>
            El rol Administrador está protegido: no se renombra ni se le editan
            permisos.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {notice ? (
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          ) : null}

          {isLoading && state.status === 'success' ? (
            <p role="status" className="text-xs text-muted-foreground">
              Actualizando…
            </p>
          ) : null}

          {showSkeleton ? <RoleTableSkeleton /> : null}

          {!isLoading && state.status === 'error' ? (
            <Alert variant="destructive">
              <AlertTitle>No se pudieron cargar los roles</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2">
                <span>{state.message}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReloadToken((current) => current + 1)}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {!isLoading && state.status === 'success' && roles.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">No hay roles registrados.</p>
              <p className="text-sm text-muted-foreground">
                Crea un rol para agrupar permisos y asignarlo a las cuentas.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialog({ kind: 'create' })}
              >
                Nuevo rol
              </Button>
            </div>
          ) : null}

          {roles.length > 0 ? (
            <Table>
              <TableCaption className="sr-only">
                Roles y permisos del sistema
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Protegido</TableHead>
                  <TableHead className="text-right">Permisos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">
                      <div className="max-w-[20rem] truncate" title={role.name}>
                        {role.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {role.isProtected ? (
                        <Badge variant="outline">Protegido</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {role.permissions.length}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        {role.isProtected ? null : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDialog({ kind: 'rename', role })
                              }
                              aria-label={`Renombrar rol ${role.name}`}
                            >
                              Renombrar
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDialog({ kind: 'permissions', role })
                              }
                              aria-label={`Editar permisos del rol ${role.name}`}
                            >
                              Permisos
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDialog({ kind: 'history', role })}
                          aria-label={`Ver historial de ${role.name}`}
                        >
                          Historial
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      {dialog?.kind === 'create' ? (
        <CreateRoleDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialog(null)
            }
          }}
          onCreated={() => reloadWith('Rol creado.')}
        />
      ) : null}

      {dialog?.kind === 'rename' ? (
        <RenameRoleDialog
          key={dialog.role.id}
          role={dialog.role}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialog(null)
            }
          }}
          onRenamed={() => reloadWith('Rol renombrado.')}
        />
      ) : null}

      {dialog?.kind === 'permissions' ? (
        <RolePermissionsDialog
          key={dialog.role.id}
          role={dialog.role}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialog(null)
            }
          }}
          onSaved={() => reloadWith('Permisos actualizados.')}
        />
      ) : null}

      {dialog?.kind === 'history' ? (
        <RoleHistoryDialog
          role={dialog.role}
          open
          onOpenChange={(open) => {
            if (!open) {
              setDialog(null)
            }
          }}
        />
      ) : null}
    </div>
  )
}
