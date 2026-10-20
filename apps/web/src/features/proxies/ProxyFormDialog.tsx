import { useEffect, useState, type FormEvent } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { errorMessage } from '@/lib/format'
import type { Access } from '@/features/accesses/api'
import {
  environmentLabel,
  formatPortRange,
} from '@/features/accesses/labels'
import {
  createProxy,
  requestAccessOptions,
  updateProxy,
  type ProxyView,
} from './api'
import { validateDetail, validatePort } from './labels'

type ProxyFormDialogProps = {
  mode: 'create' | 'edit'
  proxy?: ProxyView
  currentHost?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

function formatAccessOptionLabel(access: Access): string {
  const target = `${access.address}:${formatPortRange(access.port, access.portEnd)}`
  const env = environmentLabel(access.environment)
  if (access.detail) {
    return `${access.detail} — ${target} (${env})`
  }
  return `${target} (${env})`
}

export function ProxyFormDialog({
  mode,
  proxy,
  currentHost,
  open,
  onOpenChange,
  onSaved,
}: ProxyFormDialogProps) {
  const isEdit = mode === 'edit'

  const [accessOptions, setAccessOptions] = useState<Access[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [optionsReloadKey, setOptionsReloadKey] = useState(0)

  const [selectedAccessId, setSelectedAccessId] = useState<string>(
    proxy ? String(proxy.access.id) : '',
  )
  const [port, setPort] = useState(proxy ? String(proxy.port) : '')
  const [detail, setDetail] = useState(proxy?.detail ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    requestAccessOptions()
      .then((options) => {
        if (!active) return
        if (isEdit && proxy) {
          const exists = options.some((opt) => opt.id === proxy.access.id)
          if (!exists) {
            setAccessOptions([proxy.access, ...options])
          } else {
            setAccessOptions(options)
          }
        } else {
          setAccessOptions(options)
        }
        setOptionsError(null)
      })
      .catch((caught) => {
        if (!active) return
        setOptionsError(
          errorMessage(
            caught,
            'No se pudieron cargar los accesos disponibles.',
          ),
        )
      })
      .finally(() => {
        if (active) setLoadingOptions(false)
      })

    return () => {
      active = false
    }
  }, [isEdit, proxy, optionsReloadKey])

  const retryOptions = () => {
    setOptionsError(null)
    setLoadingOptions(true)
    setOptionsReloadKey((key) => key + 1)
  }

  const unchanged =
    isEdit &&
    proxy !== undefined &&
    selectedAccessId === String(proxy.access.id) &&
    port.trim() === String(proxy.port) &&
    detail.trim() === proxy.detail

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!selectedAccessId) {
      setError('Debes seleccionar un acceso de firewall.')
      return
    }

    const portError = validatePort(port)
    if (portError !== null) {
      setError(portError)
      return
    }

    const detailError = validateDetail(detail)
    if (detailError !== null) {
      setError(detailError)
      return
    }

    const accessId = Number(selectedAccessId)
    const numericPort = Number(port.trim())
    const trimmedDetail = detail.trim()

    setSubmitting(true)
    try {
      if (isEdit && proxy) {
        await updateProxy(proxy.id, {
          accessId,
          port: numericPort,
          detail: trimmedDetail,
          version: proxy.version,
        })
      } else {
        await createProxy({
          accessId,
          port: numericPort,
          detail: trimmedDetail,
        })
      }
      onSaved()
      onOpenChange(false)
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          isEdit
            ? 'No se pudo guardar el proxy.'
            : 'No se pudo crear el proxy.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const selectItems = accessOptions.map((opt) => ({
    value: String(opt.id),
    label: formatAccessOptionLabel(opt),
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar proxy' : 'Nuevo proxy'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifica los datos del proxy publicado en el reverse proxy.'
              : 'Asocia un acceso de firewall a un puerto publicado.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="proxy-access-select">Acceso de firewall</Label>
            {loadingOptions ? (
              <Skeleton className="h-9 w-full" />
            ) : optionsError ? (
              <Alert variant="destructive">
                <AlertDescription>
                  <p>{optionsError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={retryOptions}
                  >
                    Reintentar
                  </Button>
                </AlertDescription>
              </Alert>
            ) : accessOptions.length === 0 ? (
              <p className="border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                No hay accesos de firewall disponibles sin endpoint publicado.
              </p>
            ) : (
              <Select
                id="proxy-access-select"
                items={selectItems}
                value={selectedAccessId}
                onValueChange={(val) => {
                  if (val !== null) {
                    setSelectedAccessId(val)
                    setError(null)
                  }
                }}
                disabled={submitting}
              >
                <SelectTrigger
                  id="proxy-access-select"
                  data-testid="proxy-form-access-select"
                  className="w-full text-left"
                >
                  <SelectValue placeholder="Selecciona un acceso…" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {selectItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-xs text-muted-foreground">
              Solo se muestran accesos activos que no tengan ya un proxy
              asignado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proxy-port">Puerto</Label>
            <Input
              id="proxy-port"
              name="port"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={port}
              onChange={(e) => {
                setPort(e.target.value)
                setError(null)
              }}
              maxLength={5}
              disabled={submitting}
              placeholder="ej. 8080"
            />
            <p className="text-xs text-muted-foreground">
              Entero 1–65535. Debe ser único entre todos los proxies publicados.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proxy-detail">Detalle</Label>
            <Input
              id="proxy-detail"
              name="detail"
              autoComplete="off"
              value={detail}
              onChange={(e) => {
                setDetail(e.target.value)
                setError(null)
              }}
              maxLength={200}
              disabled={submitting}
              placeholder="ej. API de Pagos Externa"
            />
            <p className="text-xs text-muted-foreground">
              Nombre descriptivo del proxy. Obligatorio, único y hasta 200
              caracteres.
            </p>
          </div>

          {currentHost && port.trim() && !validatePort(port) ? (
            <div className="rounded-none border border-border/80 bg-muted/40 p-2.5 text-xs">
              <span className="text-muted-foreground">Endpoint resultante: </span>
              <span className="font-mono font-medium text-foreground">
                {currentHost}:{port.trim()}
              </span>
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                unchanged ||
                (!isEdit && accessOptions.length === 0)
              }
            >
              {submitting
                ? 'Guardando…'
                : isEdit
                  ? 'Guardar cambios'
                  : 'Publicar proxy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
