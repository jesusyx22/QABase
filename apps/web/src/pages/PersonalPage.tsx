import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/lib/format'
import {
  createPerson,
  requestPeople,
  updatePerson,
  type Person,
} from '@/features/personal/api'
import { PersonHistoryDialog } from '@/features/personal/PersonHistoryDialog'
import { PersonNameDialog } from '@/features/personal/PersonNameDialog'
import { PersonStatusDialog } from '@/features/personal/PersonStatusDialog'

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5]

type LoadedQuery = {
  includeInactive: boolean
  search: string
  reloadKey: number
}

export function PersonalPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [nameQuery, setNameQuery] = useState('')
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [loadedQuery, setLoadedQuery] = useState<LoadedQuery | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const loading =
    loadedQuery === null ||
    loadedQuery.includeInactive !== includeInactive ||
    loadedQuery.search !== search ||
    loadedQuery.reloadKey !== reloadKey

  const [createOpen, setCreateOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<Person | null>(null)
  const [statusTarget, setStatusTarget] = useState<{
    person: Person
    nextActive: boolean
  } | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Person | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(nameQuery.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [nameQuery])

  useEffect(() => {
    let active = true
    const query: LoadedQuery = { includeInactive, search, reloadKey }

    requestPeople({ includeInactive, search })
      .then((result) => {
        if (active) {
          setPeople(result)
          setLoadedQuery(query)
          setError(null)
        }
      })
      .catch((caught) => {
        if (active) {
          setError(
            errorMessage(caught, 'No se pudo cargar el catálogo de personal.'),
          )
        }
      })

    return () => {
      active = false
    }
  }, [includeInactive, search, reloadKey])

  const reload = () => {
    setError(null)
    setReloadKey((key) => key + 1)
  }

  const handleCreate = async (name: string) => {
    await createPerson(name)
    reload()
  }

  const handleRename = async (person: Person, name: string) => {
    await updatePerson(person.id, { name, version: person.version })
    reload()
  }

  const clearFilters = () => {
    setNameQuery('')
    setSearch('')
    setIncludeInactive(false)
    setError(null)
  }

  const hasFilters = nameQuery.trim() !== '' || includeInactive
  const countLabel = `${people.length} ${
    people.length === 1 ? 'persona' : 'personas'
  }`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Personal QA</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de personas para los registros de méritos e incidencias.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Nueva persona</Button>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Personas</CardTitle>
          <CardDescription>
            Alta, renombrado y activación del catálogo.
          </CardDescription>
          <CardAction>
            {error ? null : loading ? (
              <span
                role="status"
                className="text-xs text-muted-foreground tabular-nums"
              >
                {people.length === 0 ? 'Cargando…' : 'Actualizando…'}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground tabular-nums">
                {countLabel}
              </span>
            )}
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full max-w-sm space-y-2">
              <Label htmlFor="personal-search">Buscar por nombre</Label>
              <Input
                id="personal-search"
                name="personal-search"
                type="search"
                spellCheck={false}
                value={nameQuery}
                onChange={(event) => {
                  setNameQuery(event.target.value)
                  setError(null)
                }}
                placeholder="Nombre o parte del nombre"
                autoComplete="off"
              />
            </div>

            <div className="flex items-center gap-2 pb-1">
              <Checkbox
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={(checked) => {
                  setIncludeInactive(checked === true)
                  setError(null)
                }}
              />
              <Label htmlFor="include-inactive">Incluir inactivos</Label>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>No se pudo cargar el personal</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={reload}
                >
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : loading && people.length === 0 ? (
            <div role="status">
              <span className="sr-only">Cargando personal…</span>
              <Table aria-hidden="true">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SKELETON_ROWS.map((row) => (
                    <TableRow key={row}>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-44" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : people.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-medium">
                {hasFilters ? 'Sin resultados' : 'Catálogo vacío'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasFilters
                  ? 'No hay personas que coincidan con la búsqueda y los filtros.'
                  : 'Todavía no hay personas registradas en el catálogo.'}
              </p>
              {hasFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={clearFilters}
                >
                  Limpiar filtros
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  onClick={() => setCreateOpen(true)}
                >
                  Nueva persona
                </Button>
              )}
            </div>
          ) : (
            <Table aria-label="Personal QA">
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">
                      <div
                        className="max-w-[20rem] truncate"
                        title={person.name}
                      >
                        {person.name}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {person.id}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={person.isActive ? 'success' : 'outline'}
                        className={
                          person.isActive ? undefined : 'text-muted-foreground'
                        }
                      >
                        {person.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setHistoryTarget(person)}
                          aria-label={`Ver historial de ${person.name}`}
                        >
                          Historial
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => setRenameTarget(person)}
                          aria-label={`Renombrar a ${person.name}`}
                        >
                          Renombrar
                        </Button>
                        <Button
                          type="button"
                          variant={person.isActive ? 'destructive' : 'outline'}
                          size="xs"
                          onClick={() =>
                            setStatusTarget({
                              person,
                              nextActive: !person.isActive,
                            })
                          }
                          aria-label={`${person.isActive ? 'Desactivar' : 'Reactivar'} a ${person.name}`}
                        >
                          {person.isActive ? 'Desactivar' : 'Reactivar'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {createOpen ? (
        <PersonNameDialog
          mode="create"
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      ) : null}

      {renameTarget ? (
        <PersonNameDialog
          mode="rename"
          initialName={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onSubmit={(name) => handleRename(renameTarget, name)}
        />
      ) : null}

      {statusTarget ? (
        <PersonStatusDialog
          person={statusTarget.person}
          nextActive={statusTarget.nextActive}
          onClose={() => setStatusTarget(null)}
          onSaved={reload}
        />
      ) : null}

      {historyTarget ? (
        <PersonHistoryDialog
          person={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      ) : null}
    </div>
  )
}
