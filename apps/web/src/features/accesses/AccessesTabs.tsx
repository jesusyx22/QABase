import { NavLink } from 'react-router-dom'
import { cn } from 'cn'

export function AccessesTabs() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-[border-color,color] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring',
      isActive
        ? 'border-primary text-foreground font-semibold'
        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
    )

  return (
    <nav
      aria-label="Secciones de accesos"
      className="flex border-b border-border"
    >
      <NavLink to="/accesos" end className={linkClass}>
        Catálogo
      </NavLink>
      <NavLink to="/accesos/qas" className={linkClass}>
        Por QA
      </NavLink>
    </nav>
  )
}
