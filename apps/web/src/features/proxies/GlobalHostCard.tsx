import { useState, type FormEvent } from 'react'
import { Check, Copy, Pencil, Server } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { errorMessage } from '@/lib/format'
import {
  updateProxySettings,
  type ProxySettings,
} from './api'
import { validateIpv4 } from './labels'

type GlobalHostCardProps = {
  settings: ProxySettings
  totalEndpoints: number
  canManage: boolean
  onSaved: () => void
}

export function GlobalHostCard({
  settings,
  totalEndpoints,
  canManage,
  onSaved,
}: GlobalHostCardProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [hostInput, setHostInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const isConfigured = Boolean(settings.host)

  const handleCopy = async () => {
    if (!settings.host) return
    try {
      await navigator.clipboard.writeText(settings.host)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
    window.setTimeout(() => setCopyState('idle'), 2500)
  }

  const handleOpenDialog = () => {
    setHostInput(settings.host ?? '')
    setError(null)
    setDialogOpen(true)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const validationError = validateIpv4(hostInput)
    if (validationError !== null) {
      setError(validationError)
      return
    }

    const trimmed = hostInput.trim()
    if (trimmed === settings.host) {
      setDialogOpen(false)
      return
    }

    setSubmitting(true)
    try {
      await updateProxySettings(
        settings.version === null
          ? { host: trimmed }
          : { host: trimmed, version: settings.version },
      )
      setDialogOpen(false)
      onSaved()
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          'No se pudo actualizar la IP global del puente.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <CardTitle>IP global del puente</CardTitle>
          </div>
          <CardDescription>
            Dirección IPv4 del host donde corre el reverse proxy.
          </CardDescription>
          {canManage ? (
            <CardAction>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenDialog}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {isConfigured ? 'Cambiar IP' : 'Configurar IP'}
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {isConfigured ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-lg font-semibold tracking-tight text-foreground">
                {settings.host}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleCopy}
                aria-label={`Copiar IP global ${settings.host}`}
                title={
                  copyState === 'error'
                    ? 'No se pudo copiar; selecciona la IP manualmente'
                    : `Copiar ${settings.host}`
                }
              >
                {copyState === 'copied' ? (
                  <>
                    <Check className="mr-1 h-3.5 w-3.5 text-foreground" aria-hidden="true" />
                    <span className="text-muted-foreground">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copiar</span>
                  </>
                )}
              </Button>
              <span className="sr-only" role="status" aria-live="polite">
                {copyState === 'copied'
                  ? 'IP global copiada.'
                  : copyState === 'error'
                    ? 'No se pudo copiar la IP global. Selecciónala manualmente.'
                    : ''}
              </span>
              {copyState === 'error' ? (
                <p className="w-full text-xs text-muted-foreground">
                  No se pudo copiar. Selecciona la IP manualmente.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium text-warning">
                No se ha configurado la IP global del puente.
              </p>
              <p className="text-xs text-muted-foreground">
                Debes definir una dirección IPv4 para poder publicar endpoints.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-md"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle>
              {isConfigured ? 'Cambiar IP global' : 'Configurar IP global'}
            </DialogTitle>
            <DialogDescription>
              {isConfigured
                ? 'Actualiza la dirección IPv4 del host puente.'
                : 'Define la dirección IPv4 donde corre el reverse proxy.'}
            </DialogDescription>
          </DialogHeader>

          {isConfigured && totalEndpoints > 0 ? (
            <Alert className="border-warning/50 bg-warning/5 text-foreground">
              <AlertDescription className="text-xs">
                Esta acción modificará el endpoint de {totalEndpoints}{' '}
                {totalEndpoints === 1 ? 'proxy publicado' : 'proxies publicados'}.
              </AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="global-host-input">Dirección IPv4</Label>
              <Input
                id="global-host-input"
                name="host"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={hostInput}
                onChange={(e) => {
                  setHostInput(e.target.value)
                  setError(null)
                }}
                disabled={submitting}
                placeholder="ej. 192.168.1.50"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Debe ser una dirección IPv4 válida (ej. 192.168.1.50).
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
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando…' : 'Guardar IP'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
