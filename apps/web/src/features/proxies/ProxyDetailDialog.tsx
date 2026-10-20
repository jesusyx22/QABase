import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { errorMessage, formatDateTimeUtc } from '@/lib/format'
import {
  requestProxyLogs,
  type ProxyServiceView,
} from './api'
import {
  formatEndpoint,
  proxyEnvironmentLabel,
  proxyHealthLabel,
  proxyStatusConfig,
} from './labels'

type ProxyDetailDialogProps = {
  service: ProxyServiceView | null
  host: string | null
  canOperate: boolean
  onClose: () => void
}

export function ProxyDetailDialog({
  service,
  host,
  canOperate,
  onClose,
}: ProxyDetailDialogProps) {
  const [logs, setLogs] = useState<string[] | null>(null)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [resolvedKey, setResolvedKey] = useState<string | null>(null)

  const serviceId = service?.id ?? null
  const currentKey =
    serviceId !== null && canOperate ? `${serviceId}:${reloadKey}` : null
  const isPending = currentKey !== null && currentKey !== resolvedKey

  useEffect(() => {
    if (serviceId === null || !canOperate) {
      return
    }

    let active = true
    const key = `${serviceId}:${reloadKey}`

    requestProxyLogs(serviceId, 100)
      .then((res) => {
        if (!active) return
        setLogs(res.lines)
        setLogsError(null)
        setResolvedKey(key)
      })
      .catch((caught) => {
        if (!active) return
        setLogsError(
          errorMessage(caught, 'No se pudieron cargar los registros de log.'),
        )
        setResolvedKey(key)
      })

    return () => {
      active = false
    }
  }, [serviceId, canOperate, reloadKey])

  const handleRefreshLogs = () => {
    setLogsError(null)
    setReloadKey((k) => k + 1)
  }

  if (!service) {
    return null
  }

  const statusCfg = proxyStatusConfig(service.runtime.status)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle>{service.name}</DialogTitle>
            <Badge variant={statusCfg.variant} className={statusCfg.className}>
              {statusCfg.label}
            </Badge>
          </div>
          <DialogDescription>
            Servicio {proxyEnvironmentLabel(service.environment)} (slug:{' '}
            <span className="font-mono">{service.slug}</span>)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Runtime & Proceso */}
          <div className="border border-border p-3 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Estado y Proceso
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <span className="text-muted-foreground block">PID</span>
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {service.runtime.pid ?? '—'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Origen</span>
                <span className="font-medium text-foreground">
                  {service.runtime.managed ? 'QABase' : 'Externo'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Iniciado</span>
                <span className="tabular-nums text-foreground">
                  {formatDateTimeUtc(service.runtime.startedAt)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Health check</span>
                <span className="font-medium text-foreground">
                  {proxyHealthLabel(service.runtime.health)}
                </span>
              </div>
            </div>

            {service.runtime.detail ? (
              <div className="pt-1 text-xs">
                <span className="text-muted-foreground">Detalle del estado: </span>
                <span className="text-foreground">{service.runtime.detail}</span>
              </div>
            ) : null}
          </div>

          {/* Puertos */}
          <div className="border border-border p-3 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Puertos ({service.ports.length})
            </h3>
            <div className="space-y-1.5">
              {service.ports.map((p) => {
                const endpoint = formatEndpoint(host, p.port)
                return (
                  <div
                    key={p.port}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-border/50 pb-1.5 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold tabular-nums text-foreground">
                        {endpoint}
                      </span>
                      {p.isPrimary ? (
                        <Badge variant="outline" className="text-[10px] py-0 px-1">
                          Primario
                        </Badge>
                      ) : null}
                    </div>
                    <span
                      className={`text-[11px] font-medium ${
                        p.listening ? 'text-success' : 'text-muted-foreground'
                      }`}
                    >
                      {p.listening ? 'Escuchando' : 'No escucha'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Rutas */}
          <div className="border border-border p-3 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rutas configuradas ({service.routes.length})
            </h3>
            <div className="space-y-2">
              {service.routes.map((r) => (
                <div
                  key={r.id}
                  className="space-y-1 border-b border-border/50 pb-2 last:border-b-0 last:pb-0 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono font-medium text-foreground">
                      {r.path}
                    </span>
                    <span className="text-muted-foreground">&rarr;</span>
                    <span className="font-mono text-muted-foreground">
                      {r.target}
                    </span>
                  </div>
                  <div className="text-[11px]">
                    {r.access ? (
                      <span className="text-foreground">
                        {r.access.detail ?? r.access.address} (
                        <span className="font-mono tabular-nums">
                          {r.access.address}:{r.access.port}
                        </span>
                        )
                        {!r.access.isActive ? (
                          <Badge
                            variant="outline"
                            className="ml-1.5 text-muted-foreground text-[10px] py-0 px-1"
                          >
                            Acceso inactivo
                          </Badge>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Sin acceso en el catálogo
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Logs */}
          {canOperate ? (
            <div className="border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Últimas 100 líneas de log
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleRefreshLogs}
                  disabled={isPending}
                  aria-label="Actualizar logs"
                >
                  <RefreshCw
                    className={`mr-1 h-3 w-3 ${isPending ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>Actualizar</span>
                </Button>
              </div>

              {logsError ? (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs flex items-center justify-between gap-2">
                    <span>{logsError}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={handleRefreshLogs}
                      disabled={isPending}
                    >
                      Reintentar
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : isPending && logs === null ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Cargando logs…
                </p>
              ) : logs && logs.length > 0 ? (
                <pre
                  data-testid="proxy-log-output"
                  className="max-h-60 overflow-y-auto overscroll-contain bg-muted p-2.5 font-mono text-[11px] leading-relaxed text-foreground border border-border whitespace-pre-wrap break-all select-text"
                >
                  {logs.join('\n')}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground py-3 text-center">
                  Sin registros de log disponibles.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
