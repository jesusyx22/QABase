import { useState, type FormEvent } from 'react'
import { PERMISSIONS, type PermissionKey } from '@qabase/shared'
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
import { errorMessage } from '@/lib/format'
import { setRolePermissions, type Role } from './api'

type RolePermissionsDialogProps = {
  role: Role
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}

export function RolePermissionsDialog({
  role,
  open,
  onOpenChange,
  onSaved,
}: RolePermissionsDialogProps) {
  const [selected, setSelected] = useState<ReadonlySet<PermissionKey>>(
    () => new Set(role.permissions),
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const toggle = (key: PermissionKey, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const permissions = PERMISSIONS.map((permission) => permission.key).filter(
      (key) => selected.has(key),
    )

    setSubmitting(true)
    try {
      await setRolePermissions(role.id, permissions)
      onSaved()
      onOpenChange(false)
    } catch (caught) {
      setError(errorMessage(caught, 'No se pudieron guardar los permisos.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Permisos de {role.name}</DialogTitle>
          <DialogDescription>
            Se guarda el conjunto completo. Los cambios aplican a las cuentas
            con este rol desde su siguiente petición.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="max-h-[50vh] space-y-3 overflow-y-auto overscroll-contain pr-1">
            {PERMISSIONS.map((permission) => (
              <div key={permission.key} className="flex items-start gap-2">
                <Checkbox
                  id={`role-permission-${permission.key}`}
                  checked={selected.has(permission.key)}
                  onCheckedChange={(checked) =>
                    toggle(permission.key, checked)
                  }
                  disabled={role.isProtected || submitting}
                />
                <div className="space-y-0.5">
                  <Label htmlFor={`role-permission-${permission.key}`}>
                    {permission.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {permission.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {role.isProtected ? (
            <Alert variant="destructive">
              <AlertDescription>
                El rol Administrador no se puede editar.
              </AlertDescription>
            </Alert>
          ) : null}

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
            <Button
              type="submit"
              disabled={submitting || role.isProtected}
            >
              {submitting ? 'Guardando…' : 'Guardar permisos'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
