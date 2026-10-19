import { useState, type FormEvent } from 'react'
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
import { errorMessage } from '@/lib/format'

type PersonNameDialogProps = {
  mode: 'create' | 'rename'
  initialName?: string
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}

export function PersonNameDialog({
  mode,
  initialName = '',
  onClose,
  onSubmit,
}: PersonNameDialogProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const trimmedName = name.trim()
  const isValid = trimmedName.length >= 1 && trimmedName.length <= 200
  const isRename = mode === 'rename'
  const unchanged = isRename && trimmedName === initialName

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!isValid) {
      setError('El nombre debe tener entre 1 y 200 caracteres.')
      return
    }
    if (unchanged) {
      setError('El nombre no ha cambiado.')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(trimmedName)
      onClose()
    } catch (caught) {
      setError(errorMessage(caught, 'No se pudo guardar la persona.'))
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
        <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>
              {isRename ? 'Renombrar persona' : 'Nueva persona'}
            </DialogTitle>
            <DialogDescription>
              {isRename
                ? `Nuevo nombre para ${initialName}.`
                : 'La persona se crea activa en el catálogo.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="person-name">Nombre</Label>
            <Input
              id="person-name"
              name="name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError(null)
              }}
              autoFocus
              autoComplete="off"
              maxLength={200}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              Entre 1 y 200 caracteres. Se guarda sin espacios al inicio ni al
              final.
            </p>
          </div>

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
              type="submit"
              disabled={submitting || unchanged}
            >
              {submitting
                ? 'Guardando…'
                : isRename
                  ? 'Guardar nombre'
                  : 'Crear persona'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
