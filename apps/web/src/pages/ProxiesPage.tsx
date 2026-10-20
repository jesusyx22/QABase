import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Plus } from 'lucide-react'
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
import type { Access, AccessEnvironment } from '@/features/accesses/api'
import { AccessDetailDialog } from '@/features/accesses/AccessDetailDialog'
import {
  environmentLabel,
  formatPortRange,
} from '@/features/accesses/labels'
import { useAuth } from '@/features/auth/useAuth'
import {
  requestProxies,
  type ProxySettings,
  type ProxyView,
} from '@/features/proxies/api'
import { GlobalHostCard } from '@/features/proxies/GlobalHostCard'
import {
  ENVIRONMENT_OPTIONS,
  formatEndpoint,
  proxyStatusLabel,
  STATUS_OPTIONS,
} from '@/features/proxies/labels'
import { ProxyFormDialog } from '@/features/proxies/ProxyFormDialog'
import { ProxyStatusDialog } from '@/features/proxies/ProxyStatusDialog'

const SKELETON_ROWS = [0, 1, 2, 3]

function EndpointCell({ endpoint }: { endpoint: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(endpoint)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
    window.setTimeout(() => setCopyState('idle'), 2500)
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
        {endpoint}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6"
        onClick={handleCopy}
        aria-label={`Copiar endpoint ${endpoint}`}
        title={
          copyState === 'error'
            ? 'No se pudo copiar; selecciona el endpoint manualmente'
            : `Copiar ${endpoint}`
        }
      >
        {copyState === 'copied' ? (
          <Check className="h-3.5 w-3.5 text-foreground" aria-hidden="true" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        )}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {copyState === 'copied'
          ? 'Endpoint copiado.'
          : copyState === 'error'
            ? 'No se pudo copiar el endpoint. Selecciónalo manualmente.'
            : ''}
      </span>
      {copyState === 'error' ? (
        <span className="text-[10px] text-muted-foreground">No se pudo copiar</span>
      ) : null}
    </div>
  )
}

export function ProxiesPage() {
  const { session } = useAuth()
  const permissions = session?.account.permissions ?? []
  const canManage = permissions.includes('proxies.gestionar')

  const [settings, setSettings] = useState<ProxySettings>({
    host: null,
    version: null,
  })
  const [proxies, setProxies] = useState<ProxyView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Filtros
  const [search, setSearch] = useState('')
  const [environment, setEnvironment] = useState<AccessEnvironment | 'all'>('all')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')

  // Diálogos
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<ProxyView | null>(null)
  const [statusTarget, setStatusTarget] = useState<{
    proxy: ProxyView
    nextActive: boolean
  } | null>(null)
  const [accessDetailTarget, setAccessDetailTarget] = useState<Access | null>(null)

  useEffect(() => {
    let active = true

    requestProxies()
      .then((data) => {
        if (!active) return
        setSettings(data.settings)
        setProxies(data.proxies)
        setError(null)
      })
      .catch((caught) => {
        if (!active) return
        setError(
          errorMessage(
            caught,
            'No se pudieron cargar los proxies publicados.',
          ),
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  const reload = () => {
    setError(null)
    setLoading(true)
    setReloadKey((k) => k + 1)
  }

  const clearFilters = () => {
    setSearch('')
    setEnvironment('all')
    setStatus('all')
  }

  const hasFilters =
    search.trim() !== '' || environment !== 'all' || status !== 'all'

  const filteredProxies = useMemo(() => {
    const q = search.trim().toLowerCase()

    return proxies
      .filter((proxy) => {
        // Filtro estado
        if (status === 'active' && !proxy.isActive) return false
        if (status === 'inactive' && proxy.isActive) return false

        // Filtro ambiente
        if (
          environment !== 'all' &&
          proxy.access.environment !== environment
        ) {
          return false
        }

        // Búsqueda
        if (q !== '') {
          const endpoint = formatEndpoint(settings.host, proxy.port).toLowerCase()
          const portStr = String(proxy.port)
          const detail = proxy.detail.toLowerCase()
          const accessDetail = (proxy.access.detail ?? '').toLowerCase()
          const accessTarget =
            `${proxy.access.address}:${formatPortRange(
              proxy.access.port,
              proxy.access.portEnd,
            )}`.toLowerCase()

          const matches =
            detail.includes(q) ||
            endpoint.includes(q) ||
            portStr.includes(q) ||
            accessDetail.includes(q) ||
            accessTarget.includes(q)

          if (!matches) return false
        }

        return true
      })
      .sort((a, b) =>
        a.detail.localeCompare(b.detail, 'es', { sensitivity: 'base' }),
      )
  }, [proxies, search, environment, status, settings.host])

  const hostConfigured = Boolean(settings.host)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Proxies</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de accesos publicados mediante reverse proxy.
          </p>
        </div>
        {canManage ? (
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={!hostConfigured}
            title={
              !hostConfigured
                ? 'Configura primero la IP global del puente'
                : undefined
            }
          >
            <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Nuevo proxy
          </Button>
        ) : null}
      </div>

      {!hostConfigured && !loading ? (
        <Alert className="border-warning/50 bg-warning/5 text-foreground">
          <AlertDescription className="text-xs">
            No se ha configurado la IP global del puente. Debes configurarla para
            poder publicar nuevos proxies.
          </AlertDescription>
        </Alert>
      ) : null}

      <GlobalHostCard
        settings={settings}
        totalEndpoints={proxies.length}
        canManage={canManage}
        onSaved={reload}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Proxies publicados</CardTitle>
          <CardDescription>
            Endpoints publicados en el reverse proxy.
          </CardDescription>
          <CardAction>
            {error ? null : loading ? (
              <span
                role="status"
                className="text-xs text-muted-foreground tabular-nums"
              >
                Cargando…
              </span>
            ) : (
              <span className="text-sm text-muted-foreground tabular-nums">
                {filteredProxies.length}{' '}
                {filteredProxies.length === 1 ? 'proxy' : 'proxies'}
              </span>
            )}
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4">
            <div className="w-full max-w-sm space-y-1.5">
              <Label htmlFor="proxy-search">Buscar proxies</Label>
              <Input
                id="proxy-search"
                name="proxy-search"
                type="search"
                spellCheck={false}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por detalle, endpoint o acceso"
                autoComplete="off"
              />
            </div>

            <div className="w-full sm:w-48 space-y-1.5">
              <Label htmlFor="proxy-filter-environment">Ambiente</Label>
              <Select
                items={ENVIRONMENT_OPTIONS}
                value={environment}
                onValueChange={(val) => {
                  if (val !== null) {
                    setEnvironment(val as AccessEnvironment | 'all')
                  }
                }}
              >
                <SelectTrigger
                  id="proxy-filter-environment"
                  data-testid="proxy-filter-environment"
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
              <Label htmlFor="proxy-filter-status">Estado</Label>
              <Select
                items={STATUS_OPTIONS}
                value={status}
                onValueChange={(val) => {
                  if (val !== null) {
                    setStatus(val as 'all' | 'active' | 'inactive')
                  }
                }}
              >
                <SelectTrigger
                  id="proxy-filter-status"
                  data-testid="proxy-filter-status"
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
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>No se pudieron cargar los proxies</AlertTitle>
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
          ) : loading && proxies.length === 0 ? (
            <div role="status">
              <span className="sr-only">Cargando proxies…</span>
              <Table aria-hidden="true">
                <TableHeader>
                  <TableRow>
                    <TableHead>Detalle</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Acceso</TableHead>
                    <TableHead>Ambiente</TableHead>
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
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-32" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : filteredProxies.length === 0 ? (
            <div className="border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-medium">
                {hasFilters ? 'Sin resultados' : 'Sin proxies'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasFilters
                  ? 'No hay proxies que coincidan con la búsqueda y los filtros.'
                  : 'Todavía no hay proxies publicados en el catálogo.'}
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
              ) : canManage && hostConfigured ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Nuevo proxy
                </Button>
              ) : null}
            </div>
          ) : (
            <Table aria-label="Catálogo de proxies publicados">
              <TableHeader>
                <TableRow>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Acceso</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProxies.map((proxy) => {
                  const endpoint = formatEndpoint(settings.host, proxy.port)
                  const accessTarget = `${proxy.access.address}:${formatPortRange(
                    proxy.access.port,
                    proxy.access.portEnd,
                  )}`

                  return (
                    <TableRow key={proxy.id}>
                      <TableCell className="font-medium">
                        <div
                          className="max-w-[16rem] truncate"
                          title={proxy.detail}
                        >
                          {proxy.detail}
                        </div>
                      </TableCell>

                      <TableCell>
                        <EndpointCell endpoint={endpoint} />
                      </TableCell>

                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-medium text-foreground text-xs"
                              title={proxy.access.detail ?? accessTarget}
                            >
                              {proxy.access.detail ?? proxy.access.address}
                            </span>
                            {!proxy.access.isActive ? (
                              <Badge
                                variant="outline"
                                className="border-warning text-warning text-[10px] leading-tight px-1 py-0"
                              >
                                Acceso inactivo
                              </Badge>
                            ) : null}
                          </div>
                          <p className="font-mono text-xs text-muted-foreground tabular-nums">
                            {accessTarget}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        {environmentLabel(proxy.access.environment)}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant={proxy.isActive ? 'success' : 'outline'}
                          className={
                            proxy.isActive ? undefined : 'text-muted-foreground'
                          }
                        >
                          {proxyStatusLabel(proxy.isActive)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => setAccessDetailTarget(proxy.access)}
                            aria-label={`Ver acceso de ${proxy.detail}`}
                            title="Ver acceso de firewall vinculado"
                          >
                            Ver acceso
                          </Button>

                          {canManage ? (
                            <>
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => setEditTarget(proxy)}
                                aria-label={`Editar proxy ${proxy.detail}`}
                              >
                                Editar
                              </Button>

                              <Button
                                type="button"
                                variant={
                                  proxy.isActive ? 'destructive' : 'outline'
                                }
                                size="xs"
                                onClick={() =>
                                  setStatusTarget({
                                    proxy,
                                    nextActive: !proxy.isActive,
                                  })
                                }
                                aria-label={`${
                                  proxy.isActive ? 'Desactivar' : 'Reactivar'
                                } proxy ${proxy.detail}`}
                              >
                                {proxy.isActive ? 'Desactivar' : 'Reactivar'}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {createOpen ? (
        <ProxyFormDialog
          mode="create"
          currentHost={settings.host}
          open
          onOpenChange={(open) => !open && setCreateOpen(false)}
          onSaved={reload}
        />
      ) : null}

      {editTarget ? (
        <ProxyFormDialog
          mode="edit"
          proxy={editTarget}
          currentHost={settings.host}
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
          onSaved={reload}
        />
      ) : null}

      {statusTarget ? (
        <ProxyStatusDialog
          proxy={statusTarget.proxy}
          host={settings.host}
          nextActive={statusTarget.nextActive}
          onClose={() => setStatusTarget(null)}
          onSaved={reload}
        />
      ) : null}

      {accessDetailTarget ? (
        <AccessDetailDialog
          access={accessDetailTarget}
          onClose={() => setAccessDetailTarget(null)}
        />
      ) : null}
    </div>
  )
}
