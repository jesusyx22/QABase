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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/format'
import { requestUpdateProxyAllowlist, type ProxyServiceView } from './api'
import { parseAllowlistInput } from './labels'

type ProxyAllowlistDialogProps = {
  service: ProxyServiceView | null
  onClose: () => void
  onSuccess: () => void
}

function areCidrListsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((val, idx) => val === b[idx])
}

export function ProxyAllowlistDialog({
  service,
  onClose,
  onSuccess,
}: ProxyAllowlistDialogProps) {
  const initialText = service ? service.allowlist.join('\n') : ''
  const [text, setText] = useState(initialText)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!service) {
    return null
  }

  const currentParsed = parseAllowlistInput(text)
  const hasChanges = !areCidrListsEqual(currentParsed, service.allowlist)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const cidrs = parseAllowlistInput(text)
    if (cidrs.length === 0) {
      setError('Debes ingresar al menos una dirección IP o rango CIDR.')
      return
    }

    if (!hasChanges) {
      onClose()
      return
    }

    setSubmitting(true)
    try {
      await requestUpdateProxyAllowlist(service.id, cidrs)
      onSuccess()
      onClose()
    } catch (caught) {
      setError(
        errorMessage(
          caught,
          'No se pudo actualizar la lista de IPs autorizadas.',
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
          <DialogTitle>Editar IPs autorizadas</DialogTitle>
          <DialogDescription>
            Configura las direcciones IP o rangos CIDR permitidos para{' '}
            <span className="font-semibold text-foreground">{service.name}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="proxy-allowlist-textarea">
              Direcciones IP o rangos CIDR
            </Label>
            <Textarea
              id="proxy-allowlist-textarea"
              name="allowlist"
              rows={6}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              className="font-mono text-xs tabular-nums leading-relaxed"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setError(null)
              }}
              disabled={submitting}
              placeholder={'10.4.24.0/24\n192.168.1.50'}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Ingresa una dirección o bloque CIDR por línea (o separados por coma).
            </p>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
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
              type="submit"
              disabled={submitting || !hasChanges}
              title={
                !hasChanges ? 'No hay cambios pendientes por guardar' : undefined
              }
            >
              {submitting ? 'Guardando…' : 'Guardar allowlist'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
