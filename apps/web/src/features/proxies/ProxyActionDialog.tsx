import { useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import {
  requestRestartProxy,
  requestStopProxy,
  type ProxyServiceView,
} from './api'

export type ProxyActionType = 'stop' | 'restart'

type ProxyActionDialogProps = {
  service: ProxyServiceView | null
  action: ProxyActionType | null
  onClose: () => void
  onSuccess: () => void
}

export function ProxyActionDialog({
  service,
  action,
  onClose,
  onSuccess,
}: ProxyActionDialogProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!service || !action) {
    return null
  }

  const isStop = action === 'stop'
  const isExternal = !service.runtime.managed
  const title = isStop ? 'Detener proxy' : 'Reiniciar proxy'

  const handleConfirm = async () => {
    setSubmitting(true)
    setError(null)

    try {
      if (isStop) {
        await requestStopProxy(service.id, isExternal)
      } else {
        await requestRestartProxy(service.id, isExternal)
      }
      onSuccess()
      onClose()
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          `No se pudo ${isStop ? 'detener' : 'reiniciar'} el servicio.`,
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isStop
              ? `¿Estás seguro de que deseas detener el servicio "${service.name}"?`
              : `¿Estás seguro de que deseas reiniciar el servicio "${service.name}"?`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isExternal ? (
            <Alert className="border-warning/50 bg-warning/5 text-foreground">
              <AlertTitle className="text-xs font-semibold">
                Proceso externo no gestionado por QABase
              </AlertTitle>
              <AlertDescription className="text-xs">
                Este proceso fue iniciado fuera de QABase
                {service.runtime.pid ? ` (PID ${service.runtime.pid})` : ''}.
                {isStop
                  ? ' Detenerlo finalizará la instancia externa en ejecución.'
                  : ' Reiniciarlo reemplazará la instancia externa por una gestionada.'}
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

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
            variant={isStop ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting
              ? isStop
                ? 'Deteniendo…'
                : 'Reiniciando…'
              : isStop
                ? 'Detener'
                : 'Reiniciar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
