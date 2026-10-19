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
import { resetUserPassword, type User } from './api'
import {
  validatePassword,
  validatePasswordConfirmation,
} from './validation'

type ResetPasswordDialogProps = {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
  onReset: () => void
}

export function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
  onReset,
}: ResetPasswordDialogProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const passwordError =
      validatePassword(newPassword) ??
      validatePasswordConfirmation(newPassword, confirmation)
    if (passwordError) {
      setError(passwordError)
      return
    }

    setSubmitting(true)
    try {
      await resetUserPassword(user.id, newPassword)
      onReset()
      onOpenChange(false)
    } catch (caught) {
      setError(
        errorMessage(caught, 'No se pudo restablecer la contraseña.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Restablecer contraseña</DialogTitle>
          <DialogDescription>
            Se asignará una contraseña nueva a{' '}
            <span className="font-medium">{user.username}</span> y se cerrarán
            todas sus sesiones.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="reset-password">Contraseña nueva</Label>
            <Input
              id="reset-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Entre 12 y 128 caracteres. No se recortan los espacios.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-confirmation">Repite la contraseña nueva</Label>
            <Input
              id="reset-confirmation"
              name="confirmation"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
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
              {submitting ? 'Guardando…' : 'Restablecer contraseña'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
