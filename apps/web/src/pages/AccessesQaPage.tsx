import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from 'cn'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  requestOverview,
  type OverviewFilter,
  type OverviewKpis,
  type OverviewResponse,
  type OverviewSort,
} from '@/features/access-assignments/api'
import {
  formatExpiry,
  OVERVIEW_FILTER_OPTIONS,
  OVERVIEW_SORT_OPTIONS,
  semaphoreLabel,
  semaphoreVariant,
} from '@/features/access-assignments/labels'
import { AccessAssignmentFormDialog } from '@/features/access-assignments/AccessAssignmentFormDialog'
import { useAuth } from '@/features/auth/useAuth'

const SKELETON_ROWS = [0, 1, 2, 3, 4]

type LoadedQuery = {
  search: string
  filter: OverviewFilter
  sort: OverviewSort
  reloadKey: number
}

const KPIS: Array<{
  id: OverviewFilter
  label: string
  countKey: keyof OverviewKpis
}> = [
  {
    id: 'withAccess',
    label: 'QAs con accesos',
    countKey: 'qasWithAccess',
  },
  {
    id: 'current',
    label: 'Vigentes',
    countKey: 'current',
  },
  {
    id: 'expiring',
    label: 'Por vencer',
    countKey: 'expiring',
  },
  {
    id: 'expired',
    label: 'Vencidas',
    countKey: 'expired',
  },
]

export function AccessesQaPage() {
  const { session } = useAuth()
  const permissions = session?.account.permissions ?? []
  const canManage = permissions.includes('accesos.gestionar')

  const [assigningPerson, setAssigningPerson] = useState<{
    id: number
    name: string
    isActive: boolean
  } | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<OverviewFilter>('all')
  const [sort, setSort] = useState<OverviewSort>('urgency')

  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [loadedQuery, setLoadedQuery] = useState<LoadedQuery | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const loading =
    loadedQuery === null ||
    loadedQuery.search !== search ||
    loadedQuery.filter !== filter ||
    loadedQuery.sort !== sort ||
    loadedQuery.reloadKey !== reloadKey

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchQuery.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    let active = true
    const query: LoadedQuery = {
      search,
      filter,
      sort,
      reloadKey,
    }

    requestOverview({ search, filter, sort })
      .then((result) => {
        if (active) {
          setOverview(result)
          setLoadedQuery(query)
          setError(null)
        }
      })
      .catch((caught) => {
        if (active) {
          setError(
            errorMessage(caught, 'No se pudo cargar la vista por QA.'),
          )
        }
      })

    return () => {
      active = false
    }
  }, [search, filter, sort, reloadKey])

  const reload = () => {
    setError(null)
    setReloadKey((key) => key + 1)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSearch('')
    setFilter('all')
    setSort('urgency')
    setError(null)
  }

  const handleKpiClick = (target: OverviewFilter) => {
    setFilter((current) => (current === target ? 'all' : target))
    setError(null)
  }

  const hasFilters =
    searchQuery.trim() !== '' || filter !== 'all' || sort !== 'urgency'

  const qas = overview?.qas ?? []
  const countLabel = `${qas.length} ${qas.length === 1 ? 'QA' : 'QAs'}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Accesos por QA
          </h1>
          <p className="text-sm text-muted-foreground">
            Supervisión de accesos de firewall asignados a cada QA y sus fechas
            de vencimiento.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {KPIS.map((kpi) => {
          const isPressed = filter === kpi.id
          const count = overview?.kpis[kpi.countKey]

          return (
            <button
              key={kpi.id}
              type="button"
              onClick={() => handleKpiClick(kpi.id)}
              aria-pressed={isPressed}
              aria-label={kpi.label}
              className={cn(
                'h-full bg-card p-4 text-left text-card-foreground shadow-card ring-1 ring-foreground/10 transition-[box-shadow,transform,background-color] duration-150 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isPressed && 'ring-2 ring-primary',
              )}
            >
              <span className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {kpi.label}
              </span>
              <span className="mt-2 block text-2xl font-semibold tabular-nums">
                {count !== undefined ? count : '—'}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Los indicadores consideran solo QAs activos. Los inactivos se consultan
        con el filtro «Inactivos».
      </p>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Personal QA</CardTitle>
          <CardDescription>
            Estado de vencimientos por cada integrante del equipo.
          </CardDescription>
          <CardAction>
            {error ? null : loading ? (
              <span
                role="status"
                className="text-xs text-muted-foreground tabular-nums"
              >
                {overview === null ? 'Cargando…' : 'Actualizando…'}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground tabular-nums">
                {countLabel}
              </span>
            )}
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 border-b border-border pb-4">
            <div className="w-full max-w-sm space-y-1.5">
              <Label htmlFor="qa-search">Buscar QA</Label>
              <Input
                id="qa-search"
                name="qa-search"
                type="search"
                spellCheck={false}
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setError(null)
                }}
                placeholder="Buscar por nombre"
                autoComplete="off"
              />
            </div>

            <div className="w-full sm:w-48 space-y-1.5">
              <Label htmlFor="qa-filter">Filtro</Label>
              <Select
                items={OVERVIEW_FILTER_OPTIONS}
                value={filter}
                onValueChange={(value) => {
                  if (value !== null) {
                    setFilter(value as OverviewFilter)
                    setError(null)
                  }
                }}
              >
                <SelectTrigger
                  id="qa-filter"
                  data-testid="qa-filter-select"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OVERVIEW_FILTER_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-44 space-y-1.5">
              <Label htmlFor="qa-sort">Orden</Label>
              <Select
                items={OVERVIEW_SORT_OPTIONS}
                value={sort}
                onValueChange={(value) => {
                  if (value !== null) {
                    setSort(value as OverviewSort)
                    setError(null)
                  }
                }}
              >
                <SelectTrigger
                  id="qa-sort"
                  data-testid="qa-sort-select"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OVERVIEW_SORT_OPTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>No se pudo cargar la vista por QA</AlertTitle>
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
          ) : loading && overview === null ? (
            <div role="status">
              <span className="sr-only">Cargando personal QA…</span>
              <Table aria-hidden="true">
                <TableHeader>
                  <TableRow>
                    <TableHead>QA</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Vigentes</TableHead>
                    <TableHead className="text-right">Por vencer</TableHead>
                    <TableHead className="text-right">Vencidos</TableHead>
                    <TableHead>Próximo vencimiento</TableHead>
                    <TableHead>Semáforo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SKELETON_ROWS.map((row) => (
                    <TableRow key={row}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-4 w-20" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : qas.length === 0 ? (
            <div className="border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm font-medium">
                {hasFilters ? 'Sin resultados' : 'Sin personal QA'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {hasFilters
                  ? 'No hay integrantes que coincidan con la búsqueda y los filtros.'
                  : 'Todavía no hay integrantes de personal QA registrados.'}
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
              ) : null}
            </div>
          ) : (
            <Table aria-label="Accesos por QA">
              <TableHeader>
                <TableRow>
                  <TableHead>QA</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Vigentes</TableHead>
                  <TableHead className="text-right">Por vencer</TableHead>
                  <TableHead className="text-right">Vencidos</TableHead>
                  <TableHead>Próximo vencimiento</TableHead>
                  <TableHead>Semáforo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qas.map((qa) => (
                  <TableRow key={qa.person.id}>
                    <TableCell className="font-medium">
                      <div
                        className="max-w-[18rem] truncate"
                        title={qa.person.name}
                      >
                        {qa.person.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={qa.person.isActive ? 'success' : 'outline'}
                        className={
                          qa.person.isActive ? undefined : 'text-muted-foreground'
                        }
                      >
                        {qa.person.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {qa.counts.current}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {qa.counts.expiring}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {qa.counts.expired}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {qa.nextExpiry ? formatExpiry(qa.nextExpiry) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={semaphoreVariant(qa.urgency)}
                        className={
                          qa.urgency === 'expired' || qa.urgency === 'none'
                            ? 'text-muted-foreground'
                            : undefined
                        }
                      >
                        {semaphoreLabel(qa.urgency)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Link
                          to={`/accesos/qas/${qa.person.id}`}
                          className={buttonVariants({
                            variant: 'outline',
                            size: 'xs',
                          })}
                          aria-label={`Ver detalle de ${qa.person.name}`}
                        >
                          Ver detalle
                        </Link>
                        {canManage ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            disabled={!qa.person.isActive}
                            onClick={() => setAssigningPerson(qa.person)}
                            aria-label={`Asignar acceso a ${qa.person.name}`}
                          >
                            Asignar
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {assigningPerson ? (
        <AccessAssignmentFormDialog
          mode="create"
          person={assigningPerson}
          open
          onOpenChange={(open) => !open && setAssigningPerson(null)}
          onSaved={reload}
        />
      ) : null}
    </div>
  )
}
