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
import { updateAccess, type Access } from './api'
import {
  accessPortLabel,
  accessStatusLabel,
  environmentLabel,
  protocolLabel,
} from './labels'

type AccessStatusDialogProps = {
  access: Access
  nextActive: boolean
  onClose: () => void
  onSaved: () => void
}

export function AccessStatusDialog({
  access,
  nextActive,
  onClose,
  onSaved,
}: AccessStatusDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setError(null)
    setSubmitting(true)
    try {
      await updateAccess(access.id, {
        isActive: nextActive,
        version: access.version,
      })
      onSaved()
      onClose()
    } catch (caught) {
      setError(
        errorMessage(caught, 'No se pudo cambiar el estado del acceso.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

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
            {nextActive ? 'Reactivar acceso' : 'Desactivar acceso'}
          </DialogTitle>
          <DialogDescription>
            {nextActive
              ? `El acceso ${access.address}:${accessPortLabel(access)} volverá a estar activo.`
              : `El acceso ${access.address}:${accessPortLabel(access)} pasará a estar inactivo. Podrás reactivarlo más adelante.`}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Dirección</dt>
          <dd className="font-mono font-medium break-all">{access.address}</dd>
          <dt className="text-muted-foreground">Puerto</dt>
          <dd className="font-medium tabular-nums">
            {accessPortLabel(access)}
          </dd>
          <dt className="text-muted-foreground">Ambiente</dt>
          <dd className="font-medium">{environmentLabel(access.environment)}</dd>
          <dt className="text-muted-foreground">Protocolo</dt>
          <dd className="font-medium">{protocolLabel(access.protocol)}</dd>
          {access.detail ? (
            <>
              <dt className="text-muted-foreground">Detalle</dt>
              <dd className="font-medium break-words">{access.detail}</dd>
            </>
          ) : null}
          <dt className="text-muted-foreground">Estado actual</dt>
          <dd className="font-medium">{accessStatusLabel(access.isActive)}</dd>
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
