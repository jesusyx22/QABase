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
import { updatePerson, type Person } from './api'

type PersonStatusDialogProps = {
  person: Person
  nextActive: boolean
  onClose: () => void
  onSaved: () => void
}

export function PersonStatusDialog({
  person,
  nextActive,
  onClose,
  onSaved,
}: PersonStatusDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setError(null)
    setSubmitting(true)
    try {
      await updatePerson(person.id, {
        isActive: nextActive,
        version: person.version,
      })
      onSaved()
      onClose()
    } catch (caught) {
      setError(
        errorMessage(caught, 'No se pudo cambiar el estado de la persona.'),
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {nextActive ? 'Reactivar persona' : 'Desactivar persona'}
          </DialogTitle>
          <DialogDescription>
            {nextActive
              ? `${person.name} volverá a estar disponible para nuevos registros.`
              : `${person.name} dejará de ofrecerse para nuevos registros. Podrás reactivarla más adelante.`}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Persona</dt>
          <dd className="font-medium">{person.name}</dd>
          <dt className="text-muted-foreground">ID</dt>
          <dd className="font-medium tabular-nums">{person.id}</dd>
          <dt className="text-muted-foreground">Estado actual</dt>
          <dd className="font-medium">
            {person.isActive ? 'Activo' : 'Inactivo'}
          </dd>
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
