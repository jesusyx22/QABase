import { Link } from 'react-router-dom'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/features/auth/useAuth'
import { visibleModules } from '@/features/modules/registry'

export function PanelPage() {
  const { session } = useAuth()

  if (!session) {
    return null
  }

  const modules = visibleModules(session.account.permissions)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Panel</h1>
        <p className="text-sm text-muted-foreground">
          Accesos directos a los módulos habilitados para tu cuenta.
        </p>
      </div>

      <Card className="max-w-2xl border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle>Cuenta</CardTitle>
          <CardDescription>
            Sesión iniciada como{' '}
            <span className="font-medium text-foreground">
              {session.account.username}
            </span>{' '}
            con el rol{' '}
            <span className="font-medium text-foreground">
              {session.account.role.name}
            </span>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Puedes cambiar tu contraseña en{' '}
            <Link
              to="/cuenta"
              className="text-primary underline underline-offset-4"
            >
              Mi cuenta
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      {modules.length === 0 ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Sin módulos habilitados</CardTitle>
            <CardDescription>
              Tu cuenta no tiene acceso a ningún módulo. Solicita a un
              administrador que revise tus permisos.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {modules.map((module) => (
            <Link key={module.id} to={`/${module.path}`} className="group">
              <Card className="h-full border-l-4 border-l-sidebar transition-[border-color,box-shadow,transform] duration-150 group-hover:border-l-primary group-hover:shadow-md group-hover:-translate-y-0.5">
                <CardHeader>
                  <CardTitle>{module.label}</CardTitle>
                  <CardDescription>{module.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-primary">Abrir módulo →</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
