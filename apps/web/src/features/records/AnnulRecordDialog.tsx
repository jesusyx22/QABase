import { useState, type FormEvent } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { annulRecord } from './api'
import { recordTypeLabel, type RecordView } from './types'

type AnnulRecordDialogProps = {
  record: RecordView
  onClose: () => void
  onAnnulled: (message: string) => void
}

export function AnnulRecordDialog({
  record,
  onClose,
  onAnnulled,
}: AnnulRecordDialogProps) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const cleanReason = reason.trim()
    if (cleanReason.length < 1 || cleanReason.length > 1000) {
      setError('El motivo debe tener entre 1 y 1000 caracteres.')
      return
    }
    if (!confirmed) {
      setError('Confirma que la anulación es definitiva.')
      return
    }

    setSubmitting(true)
    try {
      await annulRecord(record.id, {
        reason: cleanReason,
        version: record.version,
        confirm: true,
      })
      onAnnulled('Registro anulado.')
    } catch (caught) {
      setError(errorMessage(caught, 'No se pudo anular el registro.'))
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
      <DialogContent
        className="max-h-[90vh] overflow-y-auto overscroll-contain sm:max-w-md"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Anular registro</DialogTitle>
          <DialogDescription>
            La anulación es irreversible. El registro dejará de contar en los
            totales y en el resumen por QA.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <p className="font-medium">
            {record.qa.name} · {recordTypeLabel(record.type)}
          </p>
          <p className="text-muted-foreground">
            {record.eventDate} · Nivel {record.level}.{' '}
            {record.levelLabel}
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="annul-reason">Motivo de la anulación</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {reason.length}/1000
              </span>
            </div>
            <Textarea
              id="annul-reason"
              name="annul-reason"
              rows={4}
              autoComplete="off"
              maxLength={1000}
              value={reason}
              aria-describedby="annul-reason-hint"
              onChange={(event) => setReason(event.target.value)}
            />
            <p
              id="annul-reason-hint"
              className="text-xs text-muted-foreground"
            >
              Entre 1 y 1000 caracteres. Se conserva en el historial.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="annul-confirm"
              name="annul-confirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked)}
            />
            <Label htmlFor="annul-confirm" className="leading-snug">
              Confirmo que la anulación es definitiva y no se puede
              restaurar.
            </Label>
          </div>

          {error !== null ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
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
              variant="destructive"
              disabled={submitting}
            >
              {submitting ? 'Anulando…' : 'Anular registro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
