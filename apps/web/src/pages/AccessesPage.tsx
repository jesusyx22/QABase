import { useEffect, useState } from 'react'
import {
  Check,
  Copy,
  Eye,
  History,
  Pencil,
  Power,
  PowerOff,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  requestAccesses,
  type Access,
  type AccessEnvironment,
  type AccessProtocolFilter,
  type AccessStatusFilter,
} from '@/features/accesses/api'
import { AccessDetailDialog } from '@/features/accesses/AccessDetailDialog'
import { AccessFormDialog } from '@/features/accesses/AccessFormDialog'
import { AccessHistoryDialog } from '@/features/accesses/AccessHistoryDialog'
import { AccessStatusDialog } from '@/features/accesses/AccessStatusDialog'
import {
  accessPortLabel,
  accessStatusLabel,
  environmentLabel,
  ENVIRONMENT_OPTIONS,
  protocolLabel,
  PROTOCOL_FILTER_OPTIONS,
  STATUS_OPTIONS,
} from '@/features/accesses/labels'
import { useAuth } from '@/features/auth/useAuth'

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5]

function AddressCell({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // El navegador puede bloquear el portapapeles; la dirección sigue visible.
    }
  }

  return (
    <div className="flex max-w-[12rem] items-center gap-1">
      <button
        type="button"
        onClick={copy}
        title={`${address}\nClic para copiar`}
        aria-label={`Copiar dirección ${address}`}
        className="min-w-0 flex-1 truncate text-left font-mono text-xs text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {address}
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        onClick={copy}
        title={copied ? 'Copiado' : 'Copiar dirección'}
        aria-label={
          copied ? `Dirección copiada: ${address}` : `Copiar dirección ${address}`
        }
        className="shrink-0"
      >
        {copied ? (
          <Check aria-hidden="true" />
        ) : (
          <Copy aria-hidden="true" />
        )}
      </Button>
      <span className="sr-only" role="status">
        {copied ? 'Dirección copiada.' : ''}
      </span>
    </div>
  )
}

type LoadedQuery = {
  search: string
  environment: AccessEnvironment | 'all'
  status: AccessStatusFilter
  protocol: AccessProtocolFilter
  reloadKey: number
}

export function AccessesPage() {
  const { session } = useAuth()
  const permissions = session?.account.permissions ?? []
  const canManage = permissions.includes('accesos.gestionar')

  const [accesses, setAccesses] = useState<Access[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [search, setSearch] = useState('')
  const [environment, setEnvironment] = useState<AccessEnvironment | 'all'>('all')
  const [status, setStatus] = useState<AccessStatusFilter>('all')
  const [protocol, setProtocol] = useState<AccessProtocolFilter>('all')

  const [loadedQuery, setLoadedQuery] = useState<LoadedQuery | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const loading =
    loadedQuery === null ||
    loadedQuery.search !== search ||
    loadedQuery.environment !== environment ||
    loadedQuery.status !== status ||
    loadedQuery.protocol !== protocol ||
    loadedQuery.reloadKey !== reloadKey

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Access | null>(null)
  const [detailTarget, setDetailTarget] = useState<Access | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Access | null>(null)
  const [statusTarget, setStatusTarget] = useState<{
    access: Access
    nextActive: boolean
  } | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchQuery.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    let active = true
    const query: LoadedQuery = {
      search,
      environment,
      status,
      protocol,
      reloadKey,
    }

    requestAccesses({ search, environment, status, protocol })
      .then((result) => {
        if (active) {
          setAccesses(result)
          setLoadedQuery(query)
          setError(null)
        }
      })
      .catch((caught) => {
        if (active) {
          setError(
            errorMessage(caught, 'No se pudo cargar el catálogo de accesos.'),
          )
        }
      })

    return () => {
      active = false
    }
  }, [search, environment, status, protocol, reloadKey])

  const reload = () => {
    setError(null)
    setReloadKey((key) => key + 1)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSearch('')
    setEnvironment('all')
    setStatus('all')
    setProtocol('all')
    setError(null)
  }

  const hasFilters =
    searchQuery.trim() !== '' ||
    environment !== 'all' ||
    status !== 'all' ||
    protocol !== 'all'

  const countLabel = `${accesses.length} ${
    accesses.length === 1 ? 'acceso' : 'accesos'
  }`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Accesos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de firewall y puertos de la empresa.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setCreateOpen(true)}>Nuevo acceso</Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Accesos</CardTitle>
          <CardDescription>
            Catálogo de firewall por ambiente, dirección y puerto.
          </CardDescription>
          <CardAction>
            {error ? null : loading ? (
              <span
                role="status"
                className="text-xs text-muted-foreground tabular-nums"
              >
                {accesses.length === 0 ? 'Cargando…' : 'Actualizando…'}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground tabular-nums">
                {countLabel}
              </span>
            )}
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4">
            <div className="w-full max-w-sm space-y-1.5">
              <Label htmlFor="access-search">Buscar accesos</Label>
              <Input
                id="access-search"
                name="access-search"
                type="search"
                spellCheck={false}
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setError(null)
                }}
                placeholder="Detalle, dirección, aplicación, URL o puerto"
                autoComplete="off"
              />
            </div>

            <div className="w-full sm:w-48 space-y-1.5">
              <Label htmlFor="access-filter-environment">Ambiente</Label>
              <Select
                items={ENVIRONMENT_OPTIONS}
                value={environment}
                onValueChange={(value) => {
                  if (value !== null) {
                    setEnvironment(value as AccessEnvironment | 'all')
                    setError(null)
                  }
                }}
              >
                <SelectTrigger
                  id="access-filter-environment"
                  data-testid="access-filter-environment"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENT_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-44 space-y-1.5">
              <Label htmlFor="access-filter-status">Estado</Label>
              <Select
                items={STATUS_OPTIONS}
                value={status}
                onValueChange={(value) => {
                  if (value !== null) {
                    setStatus(value as AccessStatusFilter)
                    setError(null)
                  }
                }}
              >
                <SelectTrigger
                  id="access-filter-status"
                  data-testid="access-filter-status"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-48 space-y-1.5">
              <Label htmlFor="access-filter-protocol">Protocolo</Label>
              <Select
                items={PROTOCOL_FILTER_OPTIONS}
                value={protocol}
                onValueChange={(value) => {
                  if (value !== null) {
                    setProtocol(value as AccessProtocolFilter)
                    setError(null)
                  }
                }}
              >
                <SelectTrigger
                  id="access-filter-protocol"
                  data-testid="access-filter-protocol"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROTOCOL_FILTER_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>No se pudo cargar el catálogo de accesos</AlertTitle>
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
          ) : loading && accesses.length === 0 ? (
            <div role="status">
              <span className="sr-only">Cargando accesos…</span>
              <Table aria-hidden="true">
                <TableHeader>
                  <TableRow>
                    <TableHead>Detalle</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Puerto</TableHead>
                    <TableHead>Ambiente</TableHead>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SKELETON_ROWS.map((row) => (
                    <TableRow key={row}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-12" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-40" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : accesses.length === 0 ? (
            <div className="border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-medium">
                {hasFilters ? 'Sin resultados' : 'Catálogo vacío'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasFilters
                  ? 'No hay accesos que coincidan con la búsqueda y los filtros.'
                  : 'Todavía no hay accesos registrados en el catálogo.'}
              </p>
              {hasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={clearFilters}
                >
                  Limpiar filtros
                </Button>
              ) : canManage ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={() => setCreateOpen(true)}
                >
                  Nuevo acceso
                </Button>
              ) : null}
            </div>
          ) : (
            <Table aria-label="Catálogo de accesos">
              <TableHeader>
                <TableRow>
                  <TableHead>Detalle</TableHead>
                  <TableHead className="w-[12rem]">Dirección</TableHead>
                  <TableHead>Puerto</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[8.5rem] text-right">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accesses.map((access) => (
                  <TableRow key={access.id}>
                    <TableCell className="font-medium">
                      {access.detail ? (
                        <div
                          className="max-w-[16rem] truncate"
                          title={access.detail}
                        >
                          {access.detail}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="w-[12rem] max-w-[12rem]">
                      <AddressCell address={access.address} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {accessPortLabel(access)}
                    </TableCell>
                    <TableCell>
                      {environmentLabel(access.environment)}
                    </TableCell>
                    <TableCell>
                      {protocolLabel(access.protocol)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={access.isActive ? 'success' : 'outline'}
                        className={
                          access.isActive ? undefined : 'text-muted-foreground'
                        }
                      >
                        {accessStatusLabel(access.isActive)}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[8.5rem]">
                      <div className="flex flex-nowrap items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDetailTarget(access)}
                          title="Ver detalle"
                          aria-label={`Ver detalle de ${access.address}:${accessPortLabel(access)}`}
                        >
                          <Eye aria-hidden="true" />
                        </Button>
                        {canManage ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setHistoryTarget(access)}
                              title="Ver historial"
                              aria-label={`Ver historial de ${access.address}:${accessPortLabel(access)}`}
                            >
                              <History aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-xs"
                              onClick={() => setEditTarget(access)}
                              title="Editar acceso"
                              aria-label={`Editar acceso ${access.address}:${accessPortLabel(access)}`}
                            >
                              <Pencil aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant={
                                access.isActive ? 'destructive' : 'outline'
                              }
                              size="icon-xs"
                              onClick={() =>
                                setStatusTarget({
                                  access,
                                  nextActive: !access.isActive,
                                })
                              }
                              title={
                                access.isActive
                                  ? 'Desactivar acceso'
                                  : 'Reactivar acceso'
                              }
                              aria-label={`${
                                access.isActive ? 'Desactivar' : 'Reactivar'
                              } acceso ${access.address}:${accessPortLabel(access)}`}
                            >
                              {access.isActive ? (
                                <PowerOff aria-hidden="true" />
                              ) : (
                                <Power aria-hidden="true" />
                              )}
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

      {createOpen ? (
        <AccessFormDialog
          mode="create"
          open
          onOpenChange={(open) => !open && setCreateOpen(false)}
          onSaved={reload}
        />
      ) : null}

      {editTarget ? (
        <AccessFormDialog
          mode="edit"
          access={editTarget}
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
          onSaved={reload}
        />
      ) : null}

      {statusTarget ? (
        <AccessStatusDialog
          access={statusTarget.access}
          nextActive={statusTarget.nextActive}
          onClose={() => setStatusTarget(null)}
          onSaved={reload}
        />
      ) : null}

      {detailTarget ? (
        <AccessDetailDialog
          access={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      ) : null}

      {historyTarget ? (
        <AccessHistoryDialog
          access={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      ) : null}
    </div>
  )
}
