import { useState, type FormEvent } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/format'
import {
  createAccess,
  updateAccess,
  type Access,
  type AccessEnvironment,
  type AccessProtocol,
} from './api'
import { ENVIRONMENT_OPTIONS } from './labels'

type AccessFormDialogProps = {
  mode: 'create' | 'edit'
  access?: Access
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

const ENVIRONMENT_ITEMS = ENVIRONMENT_OPTIONS.filter(
  (item): item is { value: AccessEnvironment; label: string } =>
    item.value !== 'all',
)

const PROTOCOL_ITEMS: Array<{
  value: AccessProtocol | 'none'
  label: string
}> = [
  { value: 'none', label: 'Sin especificar' },
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'both', label: 'TCP/UDP' },
]

function validatePort(value: string): string | null {
  const text = value.trim()
  if (!/^\d{1,5}$/.test(text)) {
    return 'El puerto debe ser un entero entre 1 y 65535.'
  }
  const port = Number(text)
  if (port < 1 || port > 65535) {
    return 'El puerto debe ser un entero entre 1 y 65535.'
  }
  return null
}

function validatePortEnd(value: string, port: number): string | null {
  const text = value.trim()
  if (text === '') {
    return null
  }
  if (!/^\d{1,5}$/.test(text)) {
    return 'El puerto final debe ser un entero entre 1 y 65535.'
  }
  const portEnd = Number(text)
  if (portEnd < 1 || portEnd > 65535) {
    return 'El puerto final debe ser un entero entre 1 y 65535.'
  }
  if (portEnd < port) {
    return 'El puerto final no puede ser menor que el inicial.'
  }
  return null
}

export function AccessFormDialog({
  mode,
  access,
  open,
  onOpenChange,
  onSaved,
}: AccessFormDialogProps) {
  const [address, setAddress] = useState(access?.address ?? '')
  const [port, setPort] = useState(access ? String(access.port) : '')
  const [portEnd, setPortEnd] = useState(
    access ? String(access.portEnd) : '',
  )
  const [environment, setEnvironment] = useState<AccessEnvironment>(
    access?.environment ?? 'production',
  )
  const [protocol, setProtocol] = useState<AccessProtocol | 'none'>(
    access?.protocol ?? 'none',
  )
  const [detail, setDetail] = useState(access?.detail ?? '')
  const [applications, setApplications] = useState(
    access?.applications ?? '',
  )
  const [urls, setUrls] = useState(access?.urls ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isEdit = mode === 'edit'
  const trimmedAddress = address.trim()
  const trimmedDetail = detail.trim()
  const trimmedApplications = applications.trim()
  const trimmedUrls = urls.trim()
  const nextProtocol = protocol === 'none' ? null : protocol
  const nextPort = Number(port.trim())
  const nextPortEnd =
    portEnd.trim() === '' ? nextPort : Number(portEnd.trim())

  const unchanged =
    isEdit &&
    access !== undefined &&
    trimmedAddress === access.address &&
    nextPort === access.port &&
    nextPortEnd === access.portEnd &&
    environment === access.environment &&
    nextProtocol === access.protocol &&
    (trimmedDetail === '' ? null : trimmedDetail) === access.detail &&
    (trimmedApplications === '' ? null : trimmedApplications) ===
      access.applications &&
    (trimmedUrls === '' ? null : trimmedUrls) === access.urls

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (trimmedAddress.length < 1 || trimmedAddress.length > 255) {
      setError('La dirección debe tener entre 1 y 255 caracteres.')
      return
    }
    const portError = validatePort(port)
    if (portError !== null) {
      setError(portError)
      return
    }
    const portEndError = validatePortEnd(portEnd, nextPort)
    if (portEndError !== null) {
      setError(portEndError)
      return
    }
    if (trimmedDetail.length > 200) {
      setError('El detalle no puede superar los 200 caracteres.')
      return
    }
    if (trimmedApplications.length > 500) {
      setError('Las aplicaciones no pueden superar los 500 caracteres.')
      return
    }
    if (trimmedUrls.length > 4000) {
      setError('Las URLs no pueden superar los 4000 caracteres.')
      return
    }

    const input = {
      address: trimmedAddress,
      port: nextPort,
      portEnd: nextPortEnd,
      environment,
      protocol: nextProtocol,
      detail: trimmedDetail === '' ? null : trimmedDetail,
      applications:
        trimmedApplications === '' ? null : trimmedApplications,
      urls: trimmedUrls === '' ? null : trimmedUrls,
    }

    setSubmitting(true)
    try {
      if (isEdit && access) {
        await updateAccess(access.id, { ...input, version: access.version })
      } else {
        await createAccess(input)
      }
      onSaved()
      onOpenChange(false)
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          isEdit
            ? 'No se pudo guardar el acceso.'
            : 'No se pudo crear el acceso.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-lg"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar acceso' : 'Nuevo acceso'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza los datos del acceso. Los cambios quedan auditados.'
              : 'Registra una dirección, puerto y ambiente del catálogo.'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="access-address">Dirección</Label>
            <Input
              id="access-address"
              name="address"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={address}
              onChange={(event) => {
                setAddress(event.target.value)
                setError(null)
              }}
              maxLength={255}
              autoFocus
              disabled={submitting}
              placeholder="10.20.10.15, 2001:db8::1, 10.0.0.0/24, api.empresa.local o *.empresa.local"
            />
            <p className="text-xs text-muted-foreground">
              IPv4, IPv6, CIDR, dominio o dominio comodín. Se recorta y la
              unicidad no distingue mayúsculas.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="access-port">Puerto inicio</Label>
              <Input
                id="access-port"
                name="port"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={port}
                onChange={(event) => {
                  setPort(event.target.value)
                  setError(null)
                }}
                maxLength={5}
                disabled={submitting}
                placeholder="443"
              />
              <p className="text-xs text-muted-foreground">Entero 1–65535.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-port-end">Puerto fin</Label>
              <Input
                id="access-port-end"
                name="portEnd"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={portEnd}
                onChange={(event) => {
                  setPortEnd(event.target.value)
                  setError(null)
                }}
                maxLength={5}
                disabled={submitting}
                placeholder="Opcional; igual al inicio"
              />
              <p className="text-xs text-muted-foreground">
                Para rangos, por ejemplo 3000–3099.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-environment">Ambiente</Label>
              <Select
                id="access-environment"
                items={ENVIRONMENT_ITEMS}
                value={environment}
                onValueChange={(value) => {
                  if (
                    value === 'development' ||
                    value === 'qa' ||
                    value === 'production' ||
                    value === 'unspecified'
                  ) {
                    setEnvironment(value)
                    setError(null)
                  }
                }}
                disabled={submitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENVIRONMENT_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-protocol">Protocolo</Label>
            <Select
              id="access-protocol"
              items={PROTOCOL_ITEMS}
              value={protocol}
              onValueChange={(value) => {
                if (
                  value === 'none' ||
                  value === 'tcp' ||
                  value === 'udp' ||
                  value === 'both'
                ) {
                  setProtocol(value)
                  setError(null)
                }
              }}
              disabled={submitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROTOCOL_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-applications">Aplicaciones</Label>
            <Textarea
              id="access-applications"
              name="applications"
              value={applications}
              onChange={(event) => {
                setApplications(event.target.value)
                setError(null)
              }}
              rows={2}
              maxLength={500}
              disabled={submitting}
              placeholder="web-browsing, ssl, mssql…"
            />
            <p className="text-xs text-muted-foreground">
              Opcional, hasta 500 caracteres.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-urls">URLs / rutas</Label>
            <Textarea
              id="access-urls"
              name="urls"
              value={urls}
              onChange={(event) => {
                setUrls(event.target.value)
                setError(null)
              }}
              rows={3}
              maxLength={4000}
              disabled={submitting}
              placeholder={'https://ejemplo.local/api\n/ruta/consulta'}
            />
            <p className="text-xs text-muted-foreground">
              Opcional, hasta 4,000 caracteres. Una URL o ruta por línea.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-detail">Detalle</Label>
            <Textarea
              id="access-detail"
              name="detail"
              value={detail}
              onChange={(event) => {
                setDetail(event.target.value)
                setError(null)
              }}
              rows={3}
              maxLength={200}
              disabled={submitting}
              placeholder="Para qué sirve este acceso"
            />
            <p className="text-xs text-muted-foreground">
              Opcional, hasta 200 caracteres. Se guarda sin espacios al inicio
              ni al final.
            </p>
          </div>

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
            <Button type="submit" disabled={submitting || unchanged}>
              {submitting
                ? 'Guardando…'
                : isEdit
                  ? 'Guardar cambios'
                  : 'Crear acceso'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
