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
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useAuth } from '@/features/auth/useAuth'
import { listUsers, type User } from '@/features/users/api'
import { CreateUserDialog } from '@/features/users/CreateUserDialog'
import { EditUserDialog } from '@/features/users/EditUserDialog'
import { ResetPasswordDialog } from '@/features/users/ResetPasswordDialog'
import { UserHistoryDialog } from '@/features/users/UserHistoryDialog'
import { errorMessage } from '@/lib/format'

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit'; user: User }
  | { kind: 'reset'; user: User }
  | { kind: 'history'; user: User }
  | null

type UsersState = {
  requestKey: string
  status: 'loading' | 'success' | 'error'
  users: User[]
  message?: string
}

function UserTableSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Cargando cuentas">
      {[0, 1, 2, 3, 4].map((index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
      <span className="sr-only">Cargando cuentas…</span>
    </div>
  )
}

export function UsersPage() {
  const { session } = useAuth()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)

  const requestKey = `${includeInactive ? '1' : '0'}|${query}|${reloadToken}`
  const [state, setState] = useState<UsersState>({
    requestKey: '',
    status: 'loading',
    users: [],
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim())
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    listUsers({ includeInactive, search: query }, controller.signal)
      .then((users) => {
        if (!controller.signal.aborted) {
          setState({ requestKey, status: 'success', users })
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            requestKey,
            status: 'error',
            users: [],
            message: errorMessage(caught, 'No se pudieron cargar las cuentas.'),
          })
        }
      })
    return () => controller.abort()
  }, [includeInactive, query, requestKey])

  const isLoading = state.requestKey !== requestKey
  const showSkeleton = isLoading && state.status !== 'success'
  const users = state.users

  const reloadWith = (message: string) => {
    setNotice(message)
    setReloadToken((current) => current + 1)
  }

  const emptyTitle =
    query !== ''
      ? 'Sin resultados para la búsqueda.'
      : includeInactive
        ? 'No hay cuentas registradas.'
        : 'No hay cuentas activas.'
  const emptyHint =
    query !== ''
      ? 'Prueba con otro nombre de usuario o incluye las cuentas inactivas.'
      : includeInactive
        ? 'Crea la primera cuenta para que el equipo pueda acceder.'
        : 'Incluye las cuentas inactivas para ver todas.'

  const closeDialog = () => setDialog(null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Cuentas de acceso, rol asignado y estado.
          </p>
        </div>
        <Button onClick={() => setDialog({ kind: 'create' })}>
          Nueva cuenta
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cuentas</CardTitle>
          <CardDescription>
            Las contraseñas nunca se muestran. Usa «Contraseña» para
            restablecerlas.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-full space-y-2 sm:w-64">
              <Label htmlFor="user-search">Buscar</Label>
              <Input
                id="user-search"
                name="q"
                type="search"
                autoComplete="off"
                spellCheck={false}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre de usuario…"
              />
            </div>
            <div className="flex h-8 items-center gap-2">
              <Checkbox
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={(checked) => setIncludeInactive(checked)}
              />
              <Label htmlFor="include-inactive">Incluir inactivos</Label>
            </div>
          </div>

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

          {showSkeleton ? <UserTableSkeleton /> : null}

          {!isLoading && state.status === 'error' ? (
            <Alert variant="destructive">
              <AlertTitle>No se pudieron cargar las cuentas</AlertTitle>
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

          {!isLoading && state.status === 'success' && users.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{emptyTitle}</p>
              <p className="text-sm text-muted-foreground">{emptyHint}</p>
              {query === '' && !includeInactive ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIncludeInactive(true)}
                >
                  Incluir inactivos
                </Button>
              ) : null}
              {query === '' && includeInactive ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDialog({ kind: 'create' })}
                >
                  Nueva cuenta
                </Button>
              ) : null}
            </div>
          ) : null}

          {users.length > 0 ? (
            <Table>
              <TableCaption className="sr-only">
                Cuentas de acceso al panel
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isSelf = session?.account.id === user.id
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.username}
                        {isSelf ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (tú)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {user.role.name}
                        {user.role.isProtected ? (
                          <Badge variant="outline" className="ml-2">
                            Protegido
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={user.isActive ? 'secondary' : 'outline'}
                          className={
                            user.isActive ? undefined : 'text-muted-foreground'
                          }
                        >
                          {user.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDialog({ kind: 'edit', user })}
                            aria-label={`Editar cuenta ${user.username}`}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDialog({ kind: 'reset', user })}
                            aria-label={`Restablecer contraseña de ${user.username}`}
                          >
                            Contraseña
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDialog({ kind: 'history', user })}
                            aria-label={`Ver historial de ${user.username}`}
                          >
                            Historial
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      {dialog?.kind === 'create' ? (
        <CreateUserDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              closeDialog()
            }
          }}
          onCreated={() => reloadWith('Cuenta creada.')}
        />
      ) : null}

      {dialog?.kind === 'edit' ? (
        <EditUserDialog
          key={dialog.user.id}
          user={dialog.user}
          open
          onOpenChange={(open) => {
            if (!open) {
              closeDialog()
            }
          }}
          onUpdated={() => reloadWith('Cuenta actualizada.')}
        />
      ) : null}

      {dialog?.kind === 'reset' ? (
        <ResetPasswordDialog
          user={dialog.user}
          open
          onOpenChange={(open) => {
            if (!open) {
              closeDialog()
            }
          }}
          onReset={() =>
            reloadWith(
              'Contraseña restablecida. Se cerraron las sesiones de la cuenta.',
            )
          }
        />
      ) : null}

      {dialog?.kind === 'history' ? (
        <UserHistoryDialog
          user={dialog.user}
          open
          onOpenChange={(open) => {
            if (!open) {
              closeDialog()
            }
          }}
        />
      ) : null}
    </div>
  )
}
