import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { errorMessage } from '@/lib/format'
import { formatPortRange } from '@/features/accesses/labels'
import { updateProxy, type ProxyView } from './api'
import { proxyStatusLabel } from './labels'

type ProxyStatusDialogProps = {
  proxy: ProxyView
  host: string | null
  nextActive: boolean
  onClose: () => void
  onSaved: () => void
}

export function ProxyStatusDialog({
  proxy,
  host,
  nextActive,
  onClose,
  onSaved,
}: ProxyStatusDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setError(null)
    setSubmitting(true)
    try {
      await updateProxy(proxy.id, {
        isActive: nextActive,
        version: proxy.version,
      })
      onSaved()
      onClose()
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          'No se pudo cambiar el estado del proxy.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const endpointText = `${host ?? '—'}:${proxy.port}`
  const accessTarget = `${proxy.access.address}:${formatPortRange(
    proxy.access.port,
    proxy.access.portEnd,
  )}`

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitting) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>
            {nextActive ? 'Reactivar proxy' : 'Desactivar proxy'}
          </DialogTitle>
          <DialogDescription>
            {nextActive
              ? `El proxy ${proxy.detail} (${endpointText}) volverá a estar activo.`
              : `El proxy ${proxy.detail} (${endpointText}) pasará a estar inactivo. Su puerto seguirá reservado.`}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Detalle</dt>
          <dd className="font-medium break-words">{proxy.detail}</dd>

          <dt className="text-muted-foreground">Endpoint</dt>
          <dd className="font-mono font-medium">{endpointText}</dd>

          <dt className="text-muted-foreground">Acceso vinculado</dt>
          <dd className="break-words">
            {proxy.access.detail ? (
              <span>
                {proxy.access.detail}{' '}
                <span className="font-mono text-xs text-muted-foreground">
                  ({accessTarget})
                </span>
              </span>
            ) : (
              <span className="font-mono text-xs">{accessTarget}</span>
            )}
          </dd>

          <dt className="text-muted-foreground">Estado actual</dt>
          <dd className="font-medium">{proxyStatusLabel(proxy.isActive)}</dd>
        </dl>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant={nextActive ? 'default' : 'destructive'}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting
              ? 'Guardando…'
              : nextActive
                ? 'Reactivar'
                : 'Desactivar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
