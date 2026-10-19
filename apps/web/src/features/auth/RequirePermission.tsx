import type { PermissionKey } from '@qabase/shared'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/useAuth'

export function RequirePermission({
  permission,
  children,
}: {
  permission: PermissionKey
  children: ReactNode
}) {
  const { session } = useAuth()

  if (!session?.account.permissions.includes(permission)) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="text-lg font-semibold">Acceso denegado</h1>
        <p className="text-sm text-muted-foreground">
          Tu cuenta no tiene el permiso necesario para este módulo.
        </p>
        <Link
          to="/"
          className="text-sm text-primary underline underline-offset-4"
        >
          Volver al panel
        </Link>
      </div>
    )
  }

  return children
}
