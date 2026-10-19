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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/useAuth'
import { errorMessage } from '@/lib/format'
import { updateUser, type UpdateUserInput, type User } from './api'
import { RoleSelect } from './RoleSelect'
import { validateUsername } from './validation'

type EditUserDialogProps = {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => void
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onUpdated,
}: EditUserDialogProps) {
  const { session } = useAuth()
  const isSelf = session?.account.id === user.id

  const [username, setUsername] = useState(user.username)
  const [roleId, setRoleId] = useState<number | null>(user.role.id)
  const [isActive, setIsActive] = useState(user.isActive)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const usernameError = validateUsername(username)
    if (usernameError) {
      setError(usernameError)
      return
    }
    if (roleId === null) {
      setError('Selecciona un rol.')
      return
    }

    const changes: UpdateUserInput = { version: user.version }
    if (username !== user.username) {
      changes.username = username
    }
    if (roleId !== user.role.id) {
      changes.roleId = roleId
    }
    if (isActive !== user.isActive) {
      changes.isActive = isActive
    }

    if (
      changes.username === undefined &&
      changes.roleId === undefined &&
      changes.isActive === undefined
    ) {
      onOpenChange(false)
      return
    }

    setSubmitting(true)
    try {
      await updateUser(user.id, changes)
      onUpdated()
      onOpenChange(false)
    } catch (caught) {
      setError(errorMessage(caught, 'No se pudo actualizar la cuenta.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Editar cuenta</DialogTitle>
          <DialogDescription>
            Cambios sobre <span className="font-medium">{user.username}</span>.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <Label htmlFor="edit-username">Usuario</Label>
            <Input
              id="edit-username"
              name="username"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Entre 3 y 64 caracteres: letras ASCII, números, punto, guion o
              guion bajo.
            </p>
          </div>

          <RoleSelect
            id="edit-role"
            value={roleId}
            onChange={setRoleId}
            currentRoleName={user.role.name}
          />

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="edit-active"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked)}
                disabled={isSelf || submitting}
              />
              <Label htmlFor="edit-active">Cuenta activa</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {isSelf
                ? 'No puedes desactivar tu propia cuenta.'
                : 'Una cuenta inactiva no puede iniciar sesión.'}
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
              {submitting ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
