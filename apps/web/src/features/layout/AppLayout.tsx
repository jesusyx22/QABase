import { Suspense, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/useAuth'
import { visibleModules } from '@/features/modules/registry'

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return [
    'block rounded-md px-3 py-2 text-sm transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground',
    isActive
      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
  ].join(' ')
}

function SidebarGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="px-2 pb-1 text-[11px] font-medium tracking-wider text-sidebar-foreground/50 uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

function SidebarContent({
  showBrand = true,
  onNavigate,
}: {
  showBrand?: boolean
  onNavigate?: () => void
}) {
  const { session, logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  const modules = session ? visibleModules(session.account.permissions) : []
  const principal = modules.filter((module) => module.group === 'principal')
  const configuracion = modules.filter(
    (module) => module.group === 'configuracion',
  )

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      onNavigate?.()
      navigate('/login', { replace: true })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {showBrand ? (
        <div className="border-b border-sidebar-border px-5 py-5">
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-sidebar-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground"
            onClick={onNavigate}
          >
            QABase
          </Link>
          <p className="mt-1 text-xs text-sidebar-foreground/60">
            Panel interno de QA
          </p>
        </div>
      ) : null}

      <nav
        aria-label="Navegación principal"
        className="min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-4"
      >
        <SidebarGroup label="Principal">
          <NavLink
            to="/"
            end
            className={navLinkClass}
            onClick={onNavigate}
          >
            Panel
          </NavLink>
          {principal.map((module) => (
            <NavLink
              key={module.id}
              to={`/${module.path}`}
              className={navLinkClass}
              onClick={onNavigate}
            >
              {module.label}
            </NavLink>
          ))}
        </SidebarGroup>

        {configuracion.length > 0 ? (
          <SidebarGroup label="Configuración">
            {configuracion.map((module) => (
              <NavLink
                key={module.id}
                to={`/${module.path}`}
                className={navLinkClass}
                onClick={onNavigate}
              >
                {module.label}
              </NavLink>
            ))}
          </SidebarGroup>
        ) : null}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Link
          to="/cuenta"
          onClick={onNavigate}
          className="block max-w-full truncate rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground"
          title={session?.account.username}
        >
          {session?.account.username}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground disabled:opacity-60"
        >
          {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
        </button>
      </div>
    </div>
  )
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-dvh bg-background text-foreground lg:flex">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Saltar al contenido
      </a>

      <aside className="hidden bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-4 py-3 text-sidebar-foreground lg:hidden">
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-sidebar-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sidebar-foreground"
          >
            QABase
          </Link>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            className="border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-sidebar-foreground/60"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? 'Cerrar menú' : 'Menú'}
          </Button>
        </header>

        {mobileOpen ? (
          <div
            id="mobile-nav"
            className="animate-in fade-in slide-in-from-top-1 duration-150 border-b border-sidebar-border bg-sidebar text-sidebar-foreground lg:hidden"
          >
            <SidebarContent
              showBrand={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        ) : null}

        <main
          id="contenido"
          className="mx-auto w-full max-w-content flex-1 px-4 py-6 sm:px-6 sm:py-8"
        >
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">
                Cargando módulo…
              </p>
            }
          >
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </Suspense>
        </main>
      </div>
    </div>
  )
}
