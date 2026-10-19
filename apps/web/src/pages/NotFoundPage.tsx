import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-lg font-semibold">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">
        La dirección no corresponde a ninguna pantalla de QABase.
      </p>
      <Link className="text-sm text-primary underline underline-offset-4" to="/">
        Volver al panel
      </Link>
    </main>
  )
}
