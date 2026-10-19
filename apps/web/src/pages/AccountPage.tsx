import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/useAuth'

export function AccountPage() {
  const { changePassword } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const currentRef = useRef<HTMLInputElement>(null)
  const newRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)

    if (newPassword.length < 12 || newPassword.length > 128) {
      setError('La contraseña nueva debe tener entre 12 y 128 caracteres.')
      newRef.current?.focus()
      return
    }
    if (newPassword !== confirmation) {
      setError('La confirmación no coincide con la contraseña nueva.')
      confirmRef.current?.focus()
      return
    }

    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudo cambiar la contraseña.',
      )
      currentRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Mi cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Cambia tu contraseña. Las demás sesiones de tu cuenta se cerrarán.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Cambiar contraseña</CardTitle>
          <CardDescription>
            La contraseña actual se verifica en el servidor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="current-password">Contraseña actual</Label>
              <Input
                id="current-password"
                name="current-password"
                ref={currentRef}
                type="password"
                autoComplete="current-password"
                aria-invalid={error !== null}
                aria-describedby={error !== null ? 'password-error' : undefined}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Contraseña nueva</Label>
              <Input
                id="new-password"
                name="new-password"
                ref={newRef}
                type="password"
                autoComplete="new-password"
                aria-invalid={error !== null}
                aria-describedby={error !== null ? 'password-error' : undefined}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Entre 12 y 128 caracteres. No se recortan los espacios.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Repite la contraseña nueva</Label>
              <Input
                id="confirm-password"
                name="confirm-password"
                ref={confirmRef}
                type="password"
                autoComplete="new-password"
                aria-invalid={error !== null}
                aria-describedby={error !== null ? 'password-error' : undefined}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </div>

            {error ? (
              <p
                id="password-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            {success ? (
              <p role="status" className="text-sm text-muted-foreground">
                Contraseña actualizada. Las demás sesiones se cerraron.
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando…' : 'Cambiar contraseña'}
              </Button>
              <Link
                to="/"
                className="text-sm text-muted-foreground underline underline-offset-4"
              >
                Volver al panel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
