import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Eye, Play, Power, RefreshCw, RotateCcw } from 'lucide-react'
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
import { useAuth } from '@/features/auth/useAuth'
import {
  requestProxies,
  requestStartProxy,
  type ProxyEnvironment,
  type ProxyServiceView,
  type ProxySettings,
  type ProxyStatus,
} from '@/features/proxies/api'
import { GlobalHostCard } from '@/features/proxies/GlobalHostCard'
import {
  formatEndpoint,
  formatTarget,
  PROXY_ENVIRONMENT_OPTIONS,
  PROXY_STATUS_OPTIONS,
  proxyEnvironmentLabel,
  proxyProtocolLabel,
  proxyStatusConfig,
} from '@/features/proxies/labels'
import { ProxyActionDialog, type ProxyActionType } from '@/features/proxies/ProxyActionDialog'
import { ProxyDetailDialog } from '@/features/proxies/ProxyDetailDialog'

const SKELETON_ROWS = [0, 1, 2, 3]

function EndpointCell({
  endpoint,
  isMongo = false,
}: {
  endpoint: string
  isMongo?: boolean
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [mongoCopyState, setMongoCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(endpoint)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
    window.setTimeout(() => setCopyState('idle'), 2500)
  }

  const handleCopyMongo = async () => {
    try {
      await navigator.clipboard.writeText(`mongodb://${endpoint}`)
      setMongoCopyState('copied')
    } catch {
      setMongoCopyState('error')
    }
    window.setTimeout(() => setMongoCopyState('idle'), 2500)
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
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
        {isMongo ? (
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="h-6 px-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
            onClick={handleCopyMongo}
            aria-label={`Copiar URI mongodb://${endpoint}`}
            title={`Copiar URI mongodb://${endpoint}`}
          >
            {mongoCopyState === 'copied' ? (
              <>
                <Check className="mr-1 h-3 w-3 text-foreground" aria-hidden="true" />
                <span>Copiado</span>
              </>
            ) : (
              <span>mongodb://</span>
            )}
          </Button>
        ) : null}
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {copyState === 'copied'
          ? 'Endpoint copiado.'
          : copyState === 'error'
            ? 'No se pudo copiar el endpoint. Selecciónalo manualmente.'
            : mongoCopyState === 'copied'
              ? 'URI mongodb copiada.'
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
  const canOperate = permissions.includes('proxies.operar')
  const canManage = permissions.includes('proxies.gestionar')

  const [settings, setSettings] = useState<ProxySettings>({
    host: null,
    version: null,
  })
  const [services, setServices] = useState<ProxyServiceView[]>([])
  const [loadedKey, setLoadedKey] = useState<number | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)

  const loading = loadedKey !== reloadKey

  // Filtros
  const [search, setSearch] = useState('')
  const [environment, setEnvironment] = useState<ProxyEnvironment | 'all'>('all')
  const [status, setStatus] = useState<ProxyStatus | 'all'>('all')

  // Diálogos: guardar ID seleccionado para que el detalle se actualice automáticamente con el auto-refresh
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null)
  const detailTarget = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  )

  const [actionTarget, setActionTarget] = useState<{
    service: ProxyServiceView
    action: ProxyActionType
  } | null>(null)

  // Carga de datos asíncrona sincronizada con reloadKey
  useEffect(() => {
    let active = true
    const currentKey = reloadKey

    requestProxies()
      .then((data) => {
        if (!active) return
        setSettings(data.settings)
        setServices(data.services)
        setLoadedKey(currentKey)
        setError(null)
      })
      .catch((caught) => {
        if (!active) return
        setError(
          errorMessage(
            caught,
            'No se pudieron cargar los servicios de proxy.',
          ),
        )
      })
      .finally(() => {
        if (active) {
          setLoadedKey(currentKey)
          setRefreshing(false)
        }
      })

    return () => {
      active = false
    }
  }, [reloadKey])

  // Auto-refresh cada 10 s mientras la página está visible
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setReloadKey((k) => k + 1)
      }
    }, 10000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setReloadKey((k) => k + 1)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const handleManualRefresh = () => {
    setRefreshing(true)
    setReloadKey((k) => k + 1)
  }

  const handleStart = async (service: ProxyServiceView) => {
    setActionLoadingId(service.id)
    setError(null)
    try {
      await requestStartProxy(service.id)
      setReloadKey((k) => k + 1)
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          `No se pudo iniciar el servicio "${service.name}".`,
        ),
      )
    } finally {
      setActionLoadingId(null)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setEnvironment('all')
    setStatus('all')
  }

  const hasFilters =
    search.trim() !== '' || environment !== 'all' || status !== 'all'

  const filteredServices = useMemo(() => {
    const q = search.trim().toLowerCase()

    return services.filter((service) => {
      // Filtro ambiente
      if (environment !== 'all' && service.environment !== environment) {
        return false
      }

      // Filtro estado
      if (status !== 'all' && service.runtime.status !== status) {
        return false
      }

      // Búsqueda
      if (q !== '') {
        const matchesName = service.name.toLowerCase().includes(q)
        const matchesSlug = service.slug.toLowerCase().includes(q)
        const matchesProtocol = service.protocol.toLowerCase().includes(q)
        const matchesPort = service.ports.some((p) =>
          String(p.port).includes(q),
        )
        const matchesRoute = service.routes.some(
          (r) =>
            r.path.toLowerCase().includes(q) ||
            r.target.toLowerCase().includes(q) ||
            (r.detail && r.detail.toLowerCase().includes(q)) ||
            (r.access &&
              (r.access.address.toLowerCase().includes(q) ||
                (r.access.detail && r.access.detail.toLowerCase().includes(q)))),
        )

        if (
          !matchesName &&
          !matchesSlug &&
          !matchesProtocol &&
          !matchesPort &&
          !matchesRoute
        ) {
          return false
        }
      }

      return true
    })
  }, [services, search, environment, status])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Proxies</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo y control de servicios de proxy operables.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleManualRefresh}
          disabled={loading || refreshing}
          aria-label="Actualizar servicios"
        >
          <RefreshCw
            className={`mr-1.5 h-3.5 w-3.5 ${
              refreshing ? 'animate-spin' : ''
            }`}
            aria-hidden="true"
          />
          <span>Actualizar</span>
        </Button>
      </div>

      <GlobalHostCard
        settings={settings}
        totalServices={services.length}
        canManage={canManage}
        onSaved={() => setReloadKey((k) => k + 1)}
      />

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Servicios de proxy</CardTitle>
          <CardDescription>
            Servicios configurados y estado de ejecución en el host.
          </CardDescription>
          <CardAction>
            {error ? null : loading && services.length === 0 ? (
              <span
                role="status"
                className="text-xs text-muted-foreground tabular-nums"
              >
                Cargando…
              </span>
            ) : (
              <span className="text-sm text-muted-foreground tabular-nums">
                {filteredServices.length}{' '}
                {filteredServices.length === 1 ? 'servicio' : 'servicios'}
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
                placeholder="Buscar por nombre, ruta, destino o puerto"
                autoComplete="off"
              />
            </div>

            <div className="w-full sm:w-48 space-y-1.5">
              <Label htmlFor="proxy-filter-environment">Ambiente</Label>
              <Select
                items={PROXY_ENVIRONMENT_OPTIONS}
                value={environment}
                onValueChange={(val) => {
                  if (val !== null) {
                    setEnvironment(val as ProxyEnvironment | 'all')
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
                  {PROXY_ENVIRONMENT_OPTIONS.map((item) => (
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
                items={PROXY_STATUS_OPTIONS}
                value={status}
                onValueChange={(val) => {
                  if (val !== null) {
                    setStatus(val as ProxyStatus | 'all')
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
                  {PROXY_STATUS_OPTIONS.map((item) => (
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
              <AlertTitle>No se pudieron cargar los servicios</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setReloadKey((k) => k + 1)}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : loading && services.length === 0 ? (
            <div role="status">
              <span className="sr-only">Cargando servicios de proxy…</span>
              <Table aria-hidden="true">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Endpoints</TableHead>
                    <TableHead>Rutas</TableHead>
                    <TableHead>Ambiente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SKELETON_ROWS.map((row) => (
                    <TableRow key={row}>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-24" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-medium">
                {hasFilters ? 'Sin resultados' : 'Sin servicios de proxy'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasFilters
                  ? 'No hay servicios que coincidan con la búsqueda y los filtros.'
                  : 'Todavía no hay servicios de proxy registrados en el catálogo.'}
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
              ) : null}
            </div>
          ) : (
            <Table aria-label="Catálogo de servicios de proxy">
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Endpoints</TableHead>
                  <TableHead>Rutas</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServices.map((service) => {
                  const statusCfg = proxyStatusConfig(service.runtime.status)
                  const isBusy = actionLoadingId === service.id
                  const status = service.runtime.status
                  const hasPid = service.runtime.pid !== null
                  const isConflict = status === 'conflict'

                  // Reglas de acciones:
                  const canStart = status === 'stopped' || status === 'error'
                  const canStop =
                    !isConflict &&
                    (status === 'active' ||
                      status === 'starting' ||
                      status === 'error' ||
                      hasPid)
                  const canRestart =
                    !isConflict &&
                    (status === 'active' || status === 'error' || hasPid)

                  const isMongo =
                    service.protocol === 'tcp' &&
                    (service.slug.includes('mongo') ||
                      service.slug.includes('documentdb') ||
                      service.name.toLowerCase().includes('mongo') ||
                      service.name.toLowerCase().includes('documentdb') ||
                      service.ports.some((p) => p.port === 27017))

                  return (
                    <TableRow key={service.id}>
                      {/* 1. Nombre */}
                      <TableCell className="font-medium align-top">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-foreground">
                              {service.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] uppercase font-semibold text-foreground"
                            >
                              {proxyProtocolLabel(service.protocol)}
                            </Badge>
                            {!service.isActive ? (
                              <Badge
                                variant="outline"
                                className="text-muted-foreground text-[10px] leading-tight px-1 py-0"
                              >
                                Inactivo
                              </Badge>
                            ) : null}
                          </div>
                          <p className="font-mono text-xs text-muted-foreground">
                            {service.slug}
                          </p>
                        </div>
                      </TableCell>

                      {/* 2. Endpoints */}
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          {service.ports.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              Sin puertos
                            </span>
                          ) : (
                            service.ports.map((p) => {
                              const endpoint = formatEndpoint(
                                settings.host,
                                p.port,
                              )
                              return (
                                <EndpointCell
                                  key={p.port}
                                  endpoint={endpoint}
                                  isMongo={isMongo}
                                />
                              )
                            })
                          )}
                        </div>
                      </TableCell>

                      {/* 3. Rutas */}
                      <TableCell className="align-top">
                        <div className="space-y-2">
                          {service.routes.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              Sin rutas
                            </span>
                          ) : (
                            service.routes.map((r) => {
                              const targetFormatted = formatTarget(
                                r.target,
                                service.protocol,
                              )
                              return (
                                <div
                                  key={r.id}
                                  className="space-y-0.5 border-b border-border/40 pb-1.5 last:border-b-0 last:pb-0"
                                >
                                  <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
                                    <span className="font-semibold text-foreground">
                                      {r.path}
                                    </span>
                                    <span className="text-muted-foreground">
                                      &rarr;
                                    </span>
                                    <span className="text-muted-foreground break-all">
                                      {targetFormatted}
                                    </span>
                                  </div>
                                  <div className="text-[11px]">
                                    {r.access ? (
                                      <div className="flex items-center gap-1 text-foreground">
                                        <span
                                          title={
                                            r.access.detail ?? r.access.address
                                          }
                                        >
                                          {r.access.detail ?? r.access.address} (
                                          <span className="font-mono tabular-nums">
                                            {r.access.address}:{r.access.port}
                                          </span>
                                          )
                                        </span>
                                        {!r.access.isActive ? (
                                          <Badge
                                            variant="outline"
                                            className="text-muted-foreground text-[9px] py-0 px-1"
                                          >
                                            Acceso inactivo
                                          </Badge>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">
                                        Sin acceso en el catálogo
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </TableCell>

                      {/* 4. Ambiente */}
                      <TableCell className="align-top">
                        <span className="text-sm">
                          {proxyEnvironmentLabel(service.environment)}
                        </span>
                      </TableCell>

                      {/* 5. Estado */}
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <Badge
                            variant={statusCfg.variant}
                            className={statusCfg.className}
                          >
                            {statusCfg.label}
                          </Badge>
                          {service.runtime.detail ? (
                            <p
                              className="text-[11px] text-muted-foreground max-w-[12rem] truncate"
                              title={service.runtime.detail}
                            >
                              {service.runtime.detail}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>

                      {/* 6. Acciones */}
                      <TableCell className="text-right align-top">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => setSelectedServiceId(service.id)}
                            aria-label={`Ver detalle de ${service.name}`}
                            title="Ver detalle del servicio y logs"
                          >
                            <Eye className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                            <span>Detalle</span>
                          </Button>

                          {canOperate ? (
                            <>
                              {/* Iniciar */}
                              {canStart ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  disabled={isBusy}
                                  onClick={() => handleStart(service)}
                                  aria-label={`Iniciar servicio ${service.name}`}
                                >
                                  <Play className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                  <span>{isBusy ? 'Iniciando…' : 'Iniciar'}</span>
                                </Button>
                              ) : null}

                              {/* Detener */}
                              {canStop ? (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="xs"
                                  disabled={isBusy}
                                  onClick={() =>
                                    setActionTarget({
                                      service,
                                      action: 'stop',
                                    })
                                  }
                                  aria-label={`Detener servicio ${service.name}`}
                                >
                                  <Power className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                  <span>Detener</span>
                                </Button>
                              ) : null}

                              {/* Reiniciar */}
                              {canRestart ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  disabled={isBusy}
                                  onClick={() =>
                                    setActionTarget({
                                      service,
                                      action: 'restart',
                                    })
                                  }
                                  aria-label={`Reiniciar servicio ${service.name}`}
                                >
                                  <RotateCcw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                  <span>Reiniciar</span>
                                </Button>
                              ) : null}
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

      {/* Diálogo de Detalle y Logs */}
      {detailTarget ? (
        <ProxyDetailDialog
          service={detailTarget}
          host={settings.host}
          canOperate={canOperate}
          canManage={canManage}
          onClose={() => setSelectedServiceId(null)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      ) : null}

      {/* Diálogo de Confirmación para Detener / Reiniciar */}
      {actionTarget ? (
        <ProxyActionDialog
          service={actionTarget.service}
          action={actionTarget.action}
          onClose={() => setActionTarget(null)}
          onSuccess={() => setReloadKey((k) => k + 1)}
        />
      ) : null}
    </div>
  )
}
