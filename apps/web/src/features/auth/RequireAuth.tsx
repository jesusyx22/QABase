import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth'

export function RequireAuth() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Cargando…
      </main>
    )
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export function PublicOnly() {
  const { status } = useAuth()

  if (status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
        Cargando…
      </main>
    )
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
