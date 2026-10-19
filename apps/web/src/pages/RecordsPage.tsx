import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/useAuth'
import { AnnulRecordDialog } from '@/features/records/AnnulRecordDialog'
import { ByQaTable } from '@/features/records/ByQaTable'
import {
  fetchImpactLevels,
  fetchQaOptions,
  fetchRecords,
} from '@/features/records/api'
import {
  createDefaultFilters,
  filtersToSearchParams,
  hasExplicitRange,
  monthRange,
  readFilters,
  recordsQueryString,
  toLocalDateString,
  type RecordsFilters,
} from '@/features/records/filters'
import { RecordFormDialog } from '@/features/records/RecordFormDialog'
import { RecordHistoryDialog } from '@/features/records/RecordHistoryDialog'
import { RecordsFiltersCard } from '@/features/records/RecordsFiltersCard'
import { RecordsTable } from '@/features/records/RecordsTable'
import { RecordsTotals } from '@/features/records/RecordsTotals'
import type {
  ImpactLevel,
  QaOption,
  RecordsPage as RecordsPageData,
  RecordView,
} from '@/features/records/types'
import { errorMessage } from '@/lib/format'

type FormState =
  | { mode: 'create' }
  | { mode: 'edit'; record: RecordView }

type RecordsResult = {
  key: string
  data: RecordsPageData | null
  error: string | null
}

type OptionsResult =
  | { people: QaOption[]; levels: ImpactLevel[] }
  | { error: string }

function TotalsSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((item) => (
          <Card key={item} size="sm">
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="flex items-end gap-8">
              <div className="space-y-2">
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-8 w-14" />
                <Skeleton className="h-3 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2">
        <Skeleton className="h-5 w-full" />
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <Skeleton key={item} className="h-8 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

function ByQaSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </CardHeader>
      <CardContent className="space-y-2">
        {[0, 1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-7 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

export function RecordsPage() {
  const { session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [todayDate] = useState(() => new Date())
  const today = toLocalDateString(todayDate)

  const currentRange = useMemo(
    () => monthRange(todayDate, 0),
    [todayDate],
  )

  const filters = useMemo(
    () => readFilters(searchParams, currentRange),
    [searchParams, currentRange],
  )

  const permissions = session?.account.permissions ?? []
  const canCreate = permissions.includes('registros.crear')
  const canEdit = permissions.includes('registros.editar')
  const canAnnul = permissions.includes('registros.anular')
  const canViewAnnulled = permissions.includes('registros.historial')

  const [result, setResult] = useState<RecordsResult | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const [options, setOptions] = useState<OptionsResult | null>(null)
  const [optionsAttempt, setOptionsAttempt] = useState(0)

  const [formState, setFormState] = useState<FormState | null>(null)
  const [annulTarget, setAnnulTarget] = useState<RecordView | null>(null)
  const [historyTarget, setHistoryTarget] = useState<RecordView | null>(
    null,
  )
  const [notice, setNotice] = useState<string | null>(null)

  const queryFilters = useMemo<RecordsFilters>(
    () => ({
      ...filters,
      includeAnnulled: canViewAnnulled && filters.includeAnnulled,
    }),
    [filters, canViewAnnulled],
  )

  const queryKey = useMemo(
    () => recordsQueryString(queryFilters, canViewAnnulled),
    [queryFilters, canViewAnnulled],
  )
  const requestKey = `${queryKey}#${reloadToken}`

  useEffect(() => {
    if (hasExplicitRange(searchParams)) {
      return
    }

    const next = new URLSearchParams(searchParams)
    next.set('from', currentRange.from)
    next.set('to', currentRange.to)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, currentRange])

  useEffect(() => {
    const controller = new AbortController()

    fetchRecords(queryFilters, canViewAnnulled, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, data, error: null })
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setResult({
            key: requestKey,
            data: null,
            error: errorMessage(
              caught,
              'No se pudieron cargar los registros.',
            ),
          })
        }
      })

    return () => {
      controller.abort()
    }
  }, [queryFilters, canViewAnnulled, requestKey])

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      fetchQaOptions(controller.signal),
      fetchImpactLevels(controller.signal),
    ])
      .then(([people, levels]) => {
        if (!controller.signal.aborted) {
          setOptions({ people, levels })
        }
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setOptions({
            error: errorMessage(
              caught,
              'No se pudieron cargar los QA y los niveles.',
            ),
          })
        }
      })

    return () => {
      controller.abort()
    }
  }, [optionsAttempt])

  const updateFilters = useCallback(
    (patch: Partial<RecordsFilters>) => {
      setNotice(null)
      setSearchParams(
        (previous) => {
          const next: RecordsFilters = {
            ...readFilters(previous, currentRange),
            ...patch,
            page: patch.page ?? 1,
          }

          if (next.all) {
            next.from = null
            next.to = null
          } else if (next.from === null && next.to === null) {
            next.all = true
          }

          return filtersToSearchParams(next)
        },
        { replace: true },
      )
    },
    [currentRange, setSearchParams],
  )

  const resetFilters = () => {
    setNotice(null)
    setSearchParams(
      filtersToSearchParams(createDefaultFilters(currentRange)),
      { replace: true },
    )
  }

  const retryRecords = () => {
    setReloadToken((current) => current + 1)
  }

  const retryOptions = () => {
    setOptions(null)
    setOptionsAttempt((current) => current + 1)
  }

  const openCreate = () => {
    setNotice(null)
    setFormState({ mode: 'create' })
  }

  const openEdit = (record: RecordView) => {
    setNotice(null)
    setFormState({ mode: 'edit', record })
  }

  const openAnnul = (record: RecordView) => {
    setNotice(null)
    setAnnulTarget(record)
  }

  const openHistory = (record: RecordView) => {
    setNotice(null)
    setHistoryTarget(record)
  }

  const handleSaved = (message: string) => {
    setFormState(null)
    setNotice(message)
    setReloadToken((current) => current + 1)
  }

  const handleAnnulled = (message: string) => {
    setAnnulTarget(null)
    setNotice(message)
    setReloadToken((current) => current + 1)
  }

  const people =
    options !== null && 'people' in options ? options.people : []
  const levels =
    options !== null && 'levels' in options ? options.levels : []
  const optionsError =
    options !== null && 'error' in options ? options.error : null
  const optionsLoading = options === null

  const resultMatches = result?.key === requestKey
  const data = resultMatches ? result?.data ?? null : null
  const error = resultMatches ? result?.error ?? null : null
  const loading = !resultMatches
  const effectiveIncludeAnnulled =
    canViewAnnulled && filters.includeAnnulled

  if (!session) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Méritos e Incidencias
          </h1>
          <p className="text-sm text-muted-foreground">
            Consulta los hechos del Personal QA por fecha, QA, tipo y nivel.
          </p>
        </div>
        {canCreate ? (
          <Button type="button" onClick={openCreate}>
            Nuevo registro
          </Button>
        ) : null}
      </div>

      <RecordsFiltersCard
        filters={filters}
        todayDate={todayDate}
        canViewAnnulled={canViewAnnulled}
        people={people}
        optionsLoading={optionsLoading}
        onChange={updateFilters}
        onReset={resetFilters}
      />

      {optionsError !== null ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar los QA y los niveles</AlertTitle>
          <AlertDescription>{optionsError}</AlertDescription>
          <AlertAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={retryOptions}
            >
              Reintentar
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {notice !== null ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      {effectiveIncludeAnnulled ? (
        <Alert role="status">
          <AlertTitle>El listado incluye registros anulados</AlertTitle>
          <AlertDescription>
            Los totales y la tabla por QA se calculan solo con registros
            vigentes. Los anulados no cuentan.
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div
          className="space-y-6"
          role="status"
          aria-busy="true"
          aria-label="Cargando registros"
        >
          <span className="sr-only">Cargando registros…</span>
          <TotalsSkeleton />
          <TableSkeleton />
          <ByQaSkeleton />
        </div>
      ) : error !== null ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar los registros</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={retryRecords}
            >
              Reintentar
            </Button>
          </AlertAction>
        </Alert>
      ) : data !== null ? (
        <>
          <RecordsTotals totals={data.totals} />

          <RecordsTable
            items={data.items}
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            canEdit={canEdit}
            canAnnul={canAnnul}
            canHistory={canViewAnnulled}
            onCreate={canCreate ? openCreate : null}
            onEdit={openEdit}
            onAnnul={openAnnul}
            onHistory={openHistory}
            onPageChange={(page) => updateFilters({ page })}
          />

          <ByQaTable rows={data.byQa} />
        </>
      ) : null}

      {formState !== null ? (
        <RecordFormDialog
          key={
            formState.mode === 'create'
              ? 'create'
              : `edit-${formState.record.id}`
          }
          mode={formState.mode}
          record={formState.mode === 'edit' ? formState.record : null}
          people={people}
          levels={levels}
          peopleLoading={optionsLoading}
          levelsLoading={optionsLoading}
          today={today}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {annulTarget !== null ? (
        <AnnulRecordDialog
          record={annulTarget}
          onClose={() => setAnnulTarget(null)}
          onAnnulled={handleAnnulled}
        />
      ) : null}

      {historyTarget !== null ? (
        <RecordHistoryDialog
          record={historyTarget}
          levels={levels}
          onClose={() => setHistoryTarget(null)}
        />
      ) : null}
    </div>
  )
}
