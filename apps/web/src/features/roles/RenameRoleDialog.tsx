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
import { errorMessage } from '@/lib/format'
import { renameRole, type Role } from './api'
import { validateRoleName } from './validation'

type RenameRoleDialogProps = {
  role: Role
  open: boolean
  onOpenChange: (open: boolean) => void
  onRenamed: () => void
}

export function RenameRoleDialog({
  role,
  open,
  onOpenChange,
  onRenamed,
}: RenameRoleDialogProps) {
  const [name, setName] = useState(role.name)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const nameError = validateRoleName(name)
    if (nameError) {
      setError(nameError)
      return
    }

    const trimmed = name.trim()
    if (trimmed === role.name) {
      onOpenChange(false)
      return
    }

    setSubmitting(true)
    try {
      await renameRole(role.id, { name: trimmed, version: role.version })
      onRenamed()
      onOpenChange(false)
    } catch (caught) {
      setError(errorMessage(caught, 'No se pudo renombrar el rol.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Renombrar rol</DialogTitle>
          <DialogDescription>
            Los permisos y las cuentas asignadas se conservan.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="rename-role-name">Nombre</Label>
            <Input
              id="rename-role-name"
              name="name"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Entre 1 y 100 caracteres.
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
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar nombre'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
